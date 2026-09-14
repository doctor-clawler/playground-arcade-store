import assert from "node:assert/strict";

import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://192.168.219.121:18120/";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
const errors = [];

page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console.error", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "pageerror", text: String(error) }));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.click("#start-button");
await page.waitForTimeout(100);

const before = await playerPosition();
await page.locator("#move-forward").dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch" });
await page.evaluate((ms) => window.advanceTime(ms), 1000);
await page.locator("#move-forward").dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch" });
const after = await playerPosition();

assert.ok(after.z < before.z - 1, `expected forward movement; before=${before.z}, after=${after.z}`);
assert.deepEqual(errors, []);

await browser.close();
console.log(JSON.stringify({ ok: true, before, after }, null, 2));

async function playerPosition() {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()).player.position);
}
