import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { primaryActions } from "./browser-actions.mjs";
import { browserOrigin } from "./browser-origin.mjs";

const servedUrl = process.env.PORTAL_BASE_URL;
if (!servedUrl) throw new Error("Set PORTAL_BASE_URL to the verified preview or public URL");
const output = "output/visual-qa/saves";
await mkdir(output, { recursive: true });
const profile = await mkdtemp(`${output}/profile-`);
const catalog = JSON.parse(await readFile("public/catalog.json", "utf8"));
const expected = {}, results = [], errors = [];
let context, baseUrl;
async function launch() {
  context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  baseUrl = await browserOrigin(context, servedUrl);
  // Observe the real adapter immediately after hydration, before real-time game
  // simulation advances. This does not replace storage, state, or game actions.
  await context.addInitScript(() => {
    Object.defineProperty(window, "LoaSave", { configurable: true, set(api) {
      const register = api.register;
      api.register = (adapter) => {
        register(adapter);
        window.__restoredCheckpoint = JSON.parse(JSON.stringify(adapter.capture()));
      };
      Object.defineProperty(window, "LoaSave", { value: api, configurable: true });
    } });
  });
}
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
}
async function open(page, id) {
  await page.goto(`${baseUrl}#game/${id}`);
  await page.locator("#detail-title").waitFor();
  await page.locator("#start-game").click();
  await page.locator('#player-shell[data-state="ready"]').waitFor({ timeout: 12000 });
  return (await page.locator("iframe").elementHandle()).contentFrame();
}
async function leave(page) {
  if (await page.locator("#exit-mobile-player").isVisible()) await page.locator("#exit-mobile-player").click();
  await page.locator("#back-button").click();
  await page.locator("#home-view").waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector("iframe"));
}
async function record(page, id) {
  return page.evaluate((gameId) => JSON.parse(localStorage.getItem(`loa.save.v1:${gameId}`)), id);
}
async function canvasControl(frame, id) {
  const point = await frame.evaluate((controlId) => {
    const state = JSON.parse(window.render_game_to_text());
    const { rect } = state.visibleControls.find((c) => c.id === controlId);
    const canvas = document.querySelector("canvas");
    return { x: (rect.x + rect.w / 2) / canvas.width, y: (rect.y + rect.h / 2) / canvas.height };
  }, id);
  const canvas = frame.locator("canvas");
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: point.x * box.width, y: point.y * box.height } });
}
async function meaningfulProgress(frame, id) {
  await primaryActions[id](frame);
  if (id === "merge-restaurant") {
    await frame.locator("#basket").click();
    await frame.locator('[data-index="0"]').click();
    await frame.locator('[data-index="1"]').click();
  }
  if (id === "character-customizer") await canvasControl(frame, "skin_color_2");
  if (id === "korean-word-chain") {
    await frame.locator("#word-input").fill("사과");
    await frame.locator("#submit-word").click();
    const submitted = JSON.parse(await frame.evaluate(() => window.render_game_to_text()));
    assert.ok(submitted.history.some((item) => item.word === "사과"), "word submission did not reach the game");
  }
  if (id === "word-spy-party") {
    await frame.locator("#primaryAction").click();
    await frame.locator("#primaryAction").click();
  }
  if (id === "hospital-night-shift") await frame.locator("#talisman-button").click();
  if (id === "building-playground-3d") {
    await frame.getByRole("button", { name: "자작나무", exact: true }).click();
    // Use the game's existing placement bridge to select an unambiguous grid cell;
    // menu selection above still uses the actual player control.
    await frame.evaluate(() => window.__buildingGame.placeSelected(0, 0, 0));
    assert.equal(JSON.parse(await frame.evaluate(() => window.render_game_to_text())).objectCount, 1);
  }
}

try {
  await launch();
  let page = await context.newPage(); watch(page);
  for (const game of catalog.games) {
    const frame = await open(page, game.id);
    const initial = await frame.evaluate(() => window.LoaSave.storage.getItem("__loa_checkpoint_v1"));
    await meaningfulProgress(frame, game.id);
    await frame.evaluate(() => window.LoaSave.flush());
    await page.waitForFunction(() => document.querySelector("#save-status").dataset.state === "saved");
    await leave(page);
    const saved = await record(page, game.id);
    assert.ok(saved?.entries.__loa_checkpoint_v1, `${game.id}: missing durable checkpoint`);
    assert.notEqual(saved.entries.__loa_checkpoint_v1, initial, `${game.id}: no meaningful progress saved`);
    expected[game.id] = JSON.parse(saved.entries.__loa_checkpoint_v1).data;
    const reopened = await open(page, game.id);
    assert.deepEqual(await reopened.evaluate(() => window.__restoredCheckpoint), expected[game.id], `${game.id}: revisit restored wrong state`);
    await page.screenshot({ path: `${output}/${game.id}-restored.png` });
    await leave(page);
    // Real-time games may advance after the comparison and before leaving.
    expected[game.id] = JSON.parse((await record(page, game.id)).entries.__loa_checkpoint_v1).data;
    results.push({ id: game.id, revisit: true });
    console.log(`saved and revisited ${game.id}`);
  }
  await context.unrouteAll({ behavior: "wait" });
  await context.close();
  await launch();
  page = await context.newPage(); watch(page);
  for (const game of catalog.games) {
    const frame = await open(page, game.id);
    assert.deepEqual(await frame.evaluate(() => window.__restoredCheckpoint), expected[game.id], `${game.id}: browser restart lost progress`);
    const before = await record(page, game.id);
    assert.ok(before.revision > 0);
    await leave(page);
    results.find((r) => r.id === game.id).browserRestart = true;
    console.log(`browser restart restored ${game.id}`);
  }

  let frame = await open(page, "merge-restaurant");
  const before = await record(page, "merge-restaurant");
  if (await page.locator("#exit-mobile-player").isVisible()) await page.locator("#exit-mobile-player").click();
  await page.locator("#reload-game").click();
  await page.locator('#player-shell[data-state="ready"]').waitFor();
  const replacementFrame = await (await page.locator("iframe").elementHandle()).contentFrame();
  assert.deepEqual(await replacementFrame.evaluate(() => window.__restoredCheckpoint), JSON.parse(before.entries.__loa_checkpoint_v1).data);
  frame = replacementFrame;
  // Parent-window messages and wrong nonces have no save authority.
  await page.evaluate(() => window.postMessage({ source: "loa-save", type: "hello", protocol: 1, nonce: "forged" }, "*"));
  await frame.evaluate(() => parent.postMessage({ source: "loa-save", type: "snapshot", entries: { money: "99999" }, sequence: 999 }, "*"));
  await page.waitForTimeout(150);
  assert.deepEqual((await record(page, "merge-restaurant")).entries, before.entries);
  const other = await context.newPage(); watch(other);
  await other.goto(`${baseUrl}#game/merge-restaurant`);
  await other.locator("#start-game").click();
  await other.locator('#player-shell[data-state="error"]').waitFor();
  assert.match(await other.locator("#save-status").innerText(), /다른 탭/);
  await leave(page);
  await other.locator("#retry-game").click();
  await other.locator('#player-shell[data-state="ready"]').waitFor();
  await leave(other);
  await other.close();

  // Reload the whole page while playing, then restore the last acknowledged save.
  const reloadFrame = await open(page, "korean-word-chain");
  const reloadExpected = await reloadFrame.evaluate(() => window.__restoredCheckpoint);
  await page.reload();
  await page.locator("#start-game").click();
  await page.locator('#player-shell[data-state="ready"]').waitFor();
  const reloaded = await (await page.locator("iframe").elementHandle()).contentFrame();
  assert.deepEqual(await reloaded.evaluate(() => window.__restoredCheckpoint), reloadExpected);
  await leave(page);

  const denied = await context.newPage(); watch(denied);
  await denied.addInitScript(() => {
    if (window === top) Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  await denied.goto(`${baseUrl}#game/merge-restaurant`);
  await denied.locator("#start-game").click();
  await denied.locator('#player-shell[data-state="error"]').waitFor();
  assert.match(await denied.locator("#save-status").innerText(), /저장이 차단/);
  await leave(denied);
  await denied.close();

  const quota = await context.newPage(); watch(quota);
  await quota.addInitScript(() => {
    if (window === top) Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  });
  const quotaBefore = await record(page, "merge-restaurant");
  const quotaFrame = await open(quota, "merge-restaurant");
  await quotaFrame.locator("#basket").click();
  await quota.locator('#save-warning:not([hidden])').waitFor();
  assert.match(await quota.locator("#save-warning").innerText(), /공간이 부족/);
  assert.equal((await record(page, "merge-restaurant")).checksum, quotaBefore.checksum);
  await quota.screenshot({ path: `${output}/mobile-save-quota.png` });
  await leave(quota);
  await quota.close();

  // A corrupted record remains intact and cannot silently reset progress.
  await page.evaluate(() => localStorage.setItem("loa.save.v1:mafia-midnight", "damaged"));
  await page.goto(`${baseUrl}#game/mafia-midnight`);
  await page.locator("#start-game").click();
  await page.locator('#player-shell[data-state="error"]').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("loa.save.v1:mafia-midnight")), "damaged");
  const untouched = await record(page, "merge-restaurant");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#delete-save").click();
  await page.waitForFunction(() => localStorage.getItem("loa.save.v1:mafia-midnight") === null);
  assert.deepEqual(await record(page, "merge-restaurant"), untouched);
  await page.screenshot({ path: `${output}/mobile-save-info.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${output}/desktop-save-info.png`, fullPage: true });
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(`${output}/report.json`, JSON.stringify({ servedUrl, testOrigin: baseUrl, results, checks: ["full page reload", "forged messages", "same-game tab lock", "corrupt save preserved", "per-game delete isolation", "denied storage", "quota warning and last-save preservation"], errors }, null, 2));
  console.log("Save QA passed: 12 gameplay checkpoints, revisits, browser restart, isolation and failure handling");
} finally {
  await context?.unrouteAll({ behavior: "wait" });
  await context?.close();
}
