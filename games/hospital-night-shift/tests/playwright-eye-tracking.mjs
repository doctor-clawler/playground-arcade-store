import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://192.168.219.121:18120/";
const outDir = path.resolve("output/visual-qa/eye-tracking");
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.click("#start-button");

const hasDebug = await page.evaluate(() => typeof window.__hospitalGame.getGuestRenderDebug === "function");
assert.equal(hasDebug, true);

await page.evaluate(() => {
  window.__hospitalGame.clearGuests();
  window.__hospitalGame.spawnGuestWithBehavior("stare");
});
await page.evaluate((ms) => window.advanceTime(ms), 2500);

const before = await stareEyeOffset();
await page.screenshot({ path: path.join(outDir, "01-stare-centered.png"), fullPage: true });
await page.keyboard.down("KeyA");
await page.evaluate((ms) => window.advanceTime(ms), 1200);
await page.keyboard.up("KeyA");
const after = await stareEyeOffset();
await page.screenshot({ path: path.join(outDir, "02-stare-looking-left.png"), fullPage: true });

assert.ok(Math.abs(after.pupilOffsetX - before.pupilOffsetX) > 0.015, JSON.stringify({ before, after }));
assert.equal(after.trackingPlayer, true);

await browser.close();
console.log(JSON.stringify({ ok: true, before, after }, null, 2));

async function stareEyeOffset() {
  return page.evaluate(() => {
    const debug = window.__hospitalGame.getGuestRenderDebug();
    const stare = debug.find((guest) => guest.behavior === "stare");
    if (!stare) throw new Error("No stare guest in render debug");
    return stare;
  });
}
