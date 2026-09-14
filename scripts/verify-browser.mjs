import { browserOrigin } from "./browser-origin.mjs";
import { primaryActions } from "./browser-actions.mjs";
import playwright from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const { chromium } = playwright;
let baseUrl = process.env.PORTAL_BASE_URL;
if (!baseUrl) throw new Error("Set PORTAL_BASE_URL to the verified preview or public URL");
await mkdir("output/visual-qa", { recursive: true });
const catalog = JSON.parse(await readFile(new URL("../public/catalog.json", import.meta.url), "utf8"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
baseUrl = await browserOrigin(context, baseUrl);
const page = await context.newPage();
const errors = [];
const failures = [];

page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
page.on("requestfailed", (request) => errors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
const cardCount = await page.locator(".game-item").count();
if (cardCount !== catalog.games.length) failures.push(`catalog cards ${cardCount}/${catalog.games.length}`);
await page.screenshot({ path: "output/visual-qa/expanded-mobile-home.png", fullPage: true });
await page.screenshot({ path: "output/visual-qa/portal-mobile.png" });
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push("mobile horizontal page overflow");
await page.locator("#search-input").fill("끝말잇기");
if (await page.locator(".game-item").count() !== 1) failures.push("search failed");
await page.locator("#search-input").fill("");
await page.locator(".filter-button").filter({ hasText: /^퍼즐$/ }).click();
const puzzleCount = catalog.games.filter(g => g.genre === "퍼즐").length;
if (await page.locator(".game-item").count() !== puzzleCount) failures.push("genre filter failed");
await page.locator(".filter-button").filter({ hasText: /^전체$/ }).click();
await page.goto(`${baseUrl}#game/missing-game`);
if (!(await page.locator('#not-found-view').isVisible())) failures.push("404 route failed");



const results = [];
for (const game of catalog.games) {
  const errorStart = errors.length;
  try {
    await page.goto(`${baseUrl}#game/${game.id}`, { waitUntil: "networkidle", timeout: 10_000 });
    await page.locator("#start-game").click({ timeout: 3_000 });
    await page.locator('#player-shell[data-state="ready"]').waitFor({ timeout: 15_000 });
    const iframe = page.locator('iframe[data-testid="game-frame"]');
    const frame = await (await iframe.elementHandle()).contentFrame();
    await frame.locator("body").waitFor({ state: "visible", timeout: 3_000 });
    const before = await frame.evaluate(() => typeof window.render_game_to_text === "function" ? window.render_game_to_text() : document.body.innerText);
    const surfaceCount = await frame.locator("canvas, button, input").count();
    if (!surfaceCount) failures.push(`${game.id}: no interactive surface`);
    let action = "ok";
    try {
      if (!primaryActions[game.id]) throw new Error(`Add a gameplay smoke action for ${game.id}`);
      await primaryActions[game.id](frame);
    } catch (error) {
      action = `failed: ${error.message.split("\n")[0]}`;
      failures.push(`${game.id}: ${action}`);
    }
    await page.waitForTimeout(250);
    const state = await frame.evaluate(() => {
      if (typeof window.render_game_to_text === "function") return window.render_game_to_text();
      return document.body.innerText.trim().slice(0, 200);
    });
    if (String(state) === before) failures.push(`${game.id}: input did not change runtime state`);
    if (!state) failures.push(`${game.id}: empty runtime state`);
    await page.screenshot({ path: `output/visual-qa/expanded-${game.id}.png`, timeout: 5_000 });
    if (game.id === "gomdori-escape-3d") await frame.locator("canvas").screenshot({ path: "output/visual-qa/gomdori-canvas.png" });
    results.push({ id: game.id, surfaceCount, action, state: String(state).slice(0, 180), newErrors: errors.slice(errorStart) });
    console.log(`verified ${game.id}`);
  } catch (error) {
    const message = error.message.split("\n")[0];
    failures.push(`${game.id}: ${message}`);
    results.push({ id: game.id, failed: message, newErrors: errors.slice(errorStart) });
    console.log(`failed ${game.id}: ${message}`);
  }
}

const desktop = await context.newPage();
await desktop.setViewportSize({ width: 1440, height: 1000 });
await desktop.goto(baseUrl);
await desktop.screenshot({ path: "output/visual-qa/portal-desktop.png", fullPage: true });
const report = { cardCount, gameCount: catalog.games.length, results, errors, failures };
await writeFile("output/visual-qa/expanded-report.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ cardCount, gameCount: catalog.games.length, errors, failures }, null, 2));
await context.unrouteAll({ behavior: "wait" });
await browser.close();
if (errors.length || failures.length) process.exitCode = 1;
