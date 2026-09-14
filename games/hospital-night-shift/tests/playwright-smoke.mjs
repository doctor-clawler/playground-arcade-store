import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const url = process.argv[2] ?? "http://192.168.219.121:18120/";
const outDir = path.resolve("output/visual-qa/smoke");
fs.mkdirSync(outDir, { recursive: true });
for (const fileName of fs.readdirSync(outDir)) {
  if (fileName.endsWith(".png")) {
    fs.rmSync(path.join(outDir, fileName));
  }
}

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push({ type: "console.error", text: message.text() });
  }
});
page.on("pageerror", (error) => {
  errors.push({ type: "pageerror", text: String(error) });
});

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.click("#start-button");
await advance(3800);
await clickCanvasCenter();
await page.click("#admit-button");
await advance(1000);
await screenshot("01-admitted.png");

let snapshot = await gameSnapshot();
assert.equal(snapshot.state.rooms[0].occupantId, 1);
assert.equal(snapshot.guests[0].status, "in-room");
assert.equal(snapshot.text.dialogueOpen, false);

await advance(7200);
await page.click("#talisman-button");
await advance(100);
await screenshot("02-repeat-banished.png");

snapshot = await gameSnapshot();
const repeatGuest = snapshot.guests.find((guest) => guest.behavior === "repeat");
assert.equal(repeatGuest.status, "gone");
assert.equal(repeatGuest.dialogue, "부적이 싫어!");

await advance(6600);
await page.click("#talisman-button");
await advance(100);

snapshot = await gameSnapshot();
const stareGuest = snapshot.guests.find((guest) => guest.behavior === "stare");
assert.equal(stareGuest.status, "gone");
assert.equal(stareGuest.dialogue, "부적이 싫어!");

await advance(7200);
snapshot = await gameSnapshot();
const attackGuest = snapshot.guests.find((guest) => guest.behavior === "attack");
assert.equal(attackGuest.status, "attacking");
await screenshot("03-attack-before-hold.png");

await mouseDownCanvasCenter();
await advance(3200);
await page.mouse.up({ button: "left" });
await screenshot("04-attack-held.png");

snapshot = await gameSnapshot();
const heldAttackGuest = snapshot.guests.find((guest) => guest.behavior === "attack");
assert.equal(heldAttackGuest.status, "gone");
assert.equal(heldAttackGuest.dialogue, "사라진다...");
assert.equal(snapshot.state.player.health < 100, true);

assert.deepEqual(errors, []);
await browser.close();

console.log(JSON.stringify({ ok: true, screenshots: fs.readdirSync(outDir).sort() }, null, 2));

async function advance(ms) {
  await page.evaluate((value) => window.advanceTime(value), ms);
  await page.waitForTimeout(80);
}

async function gameSnapshot() {
  return page.evaluate(() => ({
    text: JSON.parse(window.render_game_to_text()),
    state: {
      rooms: window.__hospitalGame.state.rooms.map((room) => ({ ...room })),
      player: { ...window.__hospitalGame.state.player },
    },
    guests: window.__hospitalGame.state.guests.map((guest) => ({
      id: guest.id,
      behavior: guest.behavior,
      status: guest.status,
      dialogue: guest.dialogue,
      roomId: guest.roomId,
      holdProgress: guest.holdProgress,
    })),
  }));
}

async function canvasBox() {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  assert.ok(box, "canvas should have a bounding box");
  return box;
}

async function clickCanvasCenter() {
  const box = await canvasBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(120);
}

async function mouseDownCanvasCenter() {
  const box = await canvasBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: "left" });
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}
