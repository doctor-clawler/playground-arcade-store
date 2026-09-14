import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { browserOrigin } from "./browser-origin.mjs";

const servedUrl = process.env.PORTAL_BASE_URL;
if (!servedUrl) throw new Error("Set PORTAL_BASE_URL");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const baseUrl = await browserOrigin(context, servedUrl);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
const output = "output/visual-qa/saves";
await mkdir(output, { recursive: true });
async function open(id) {
  await page.goto(`${baseUrl}#game/${id}`);
  await page.locator("#start-game").click();
  await page.locator('#player-shell[data-state="ready"]').waitFor();
  return (await page.locator("iframe").elementHandle()).contentFrame();
}
async function leave() {
  if (await page.locator("#exit-mobile-player").isVisible()) await page.locator("#exit-mobile-player").click();
  await page.locator("#back-button").click();
  await page.locator("#home-view").waitFor({ state: "visible" });
}
async function checkpoint(frame) {
  await frame.evaluate(() => window.LoaSave.flush());
  return frame.evaluate(() => JSON.parse(window.LoaSave.storage.getItem("__loa_checkpoint_v1")).data);
}
async function seed(id, data) {
  // Explicit fixture writes in an isolated test profile, using the real record
  // validation/checksum. These cases verify scene reconstruction, not full runs.
  await page.evaluate(({ id, data }) => {
    const store = LoaSaveStore.createStore(localStorage);
    const record = store.read(id);
    store.write(id, record, { ...record.entries, __loa_checkpoint_v1: JSON.stringify({ version: 1, data }) });
  }, { id, data });
}
try {
  let frame = await open("gomdori-escape-3d");
  const escape = await checkpoint(frame);
  await leave();
  Object.assign(escape, {
    mode: "stage2", stage: 2, hammer: true, codeFound: { a: true, b: true, c: true },
    keypadOpen: true, codeInput: "37", bounds: { minX: -4.4, maxX: 20.4, minZ: -5.2, maxZ: 5.2 },
    player: { ...escape.player, x: 8, z: -3.5, yaw: 0, pitch: 0 },
  });
  await seed("gomdori-escape-3d", escape);
  frame = await open("gomdori-escape-3d");
  assert.equal(await frame.locator("#codeDisplay").innerText(), "37_");
  await frame.locator('[data-key="8"]').click();
  await frame.locator('[data-key="확인"]').click();
  await frame.waitForFunction(() => JSON.parse(window.render_game_to_text()).stage === 3);
  const stage3 = await checkpoint(frame);
  assert.equal(stage3.stage, 3);
  await leave();
  frame = await open("gomdori-escape-3d");
  assert.equal((await checkpoint(frame)).mode, "stage3");
  await page.screenshot({ path: `${output}/gomdori-stage3-restored.png` });
  await leave();
  const reward = { ...stage3, mode: "reward", stage: 4, coins: 5000, finalKey: true, chestOpen: true };
  await seed("gomdori-escape-3d", reward);
  frame = await open("gomdori-escape-3d");
  // A pre-existing mid-transition checkpoint also finishes the delayed return.
  await page.waitForTimeout(1100);
  const completed = await checkpoint(frame);
  assert.equal(completed.coins, 5000);
  await leave();
  frame = await open("gomdori-escape-3d");
  assert.equal((await checkpoint(frame)).mode, "menu");
  assert.ok(await frame.locator("#start3d").isVisible());
  await leave();

  frame = await open("camping-town-3d");
  const camp = await checkpoint(frame);
  await leave();
  const tent = camp.state.tents[0];
  Object.assign(tent, { claimed: true, name: "별빛 텐트", furniture: [{ id: "save-fixture-bag", type: "bag", gridX: 1, gridY: 1, width: 2, height: 1 }] });
  Object.assign(camp, { mode: "tent", activeTentId: tent.id, position: [0, 0, 2.1] });
  camp.state.money = 4321;
  await seed("camping-town-3d", camp);
  frame = await open("camping-town-3d");
  const restored = JSON.parse(await frame.evaluate(() => window.render_game_to_text()));
  assert.equal(restored.mode, "tent");
  assert.equal(restored.money, 4321);
  assert.ok(restored.namedTents.some((t) => t.name === "별빛 텐트" && t.furniture === 1));
  await page.screenshot({ path: `${output}/camping-furnished-tent-restored.png` });
  await leave();
  await page.goto(`${baseUrl}games/merge-restaurant/index.html`);
  await page.waitForURL(`${baseUrl}#game/merge-restaurant`);
  assert.equal(await page.locator("#detail-title").innerText(), "스파게티 머지");
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(`${output}/scenes-report.json`, JSON.stringify({ servedUrl, checks: ["restored keypad accepts input and advances to stage 3", "stage 3 scene reopens", "reward coins retained without duplicate grant", "furnished named tent reconstructed", "direct game links enter portal"], errors }, null, 2));
  console.log("Save scene QA passed: keypad/stage/reward, furnished tent, direct game link");
} finally {
  await context.unrouteAll({ behavior: "wait" });
  await browser.close();
}
