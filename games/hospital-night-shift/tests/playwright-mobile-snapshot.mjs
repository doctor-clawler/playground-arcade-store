import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://192.168.219.121:18120/";
const outDir = path.resolve("output/visual-qa/mobile");
fs.mkdirSync(outDir, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console.error", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "pageerror", text: String(error) }));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.click("#start-button");
await page.evaluate((ms) => window.advanceTime(ms), 3800);

const box = await page.locator("canvas").first().boundingBox();
assert.ok(box, "canvas should have a bounding box");
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(120);
await page.screenshot({ path: path.join(outDir, "mobile-dialogue.png"), fullPage: true });

const text = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
assert.equal(text.dialogueOpen, true);
assert.deepEqual(errors, []);

await browser.close();
console.log(JSON.stringify({ ok: true, screenshot: "mobile-dialogue.png" }, null, 2));
