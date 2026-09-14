import assert from "node:assert/strict";

import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://192.168.219.121:18120/";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.click("#start-button");
await page.evaluate((ms) => window.advanceTime(ms), 3800);

const box = await page.locator("canvas").first().boundingBox();
assert.ok(box, "canvas should have a bounding box");

await page.mouse.click(box.x + box.width / 2, box.y + 280);
await page.waitForTimeout(120);

const text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
assert.equal(text.dialogueOpen, true);

await browser.close();
console.log(JSON.stringify({ ok: true, dialogueOpen: text.dialogueOpen }, null, 2));
