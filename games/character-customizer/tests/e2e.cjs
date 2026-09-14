const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const url = process.argv[2] || "http://127.0.0.1:18036/";
const outputDir = path.resolve("output/visual-qa/character-customizer");
fs.mkdirSync(outputDir, { recursive: true });

async function readState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function clickControl(page, id) {
  const state = await readState(page);
  const control = state.visibleControls.find((item) => item.id === id);
  assert.ok(control, `control ${id} should be visible`);
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  const logical = await canvas.evaluate((node) => ({ width: node.width, height: node.height }));
  const centerX = control.rect.x + control.rect.w / 2;
  const centerY = control.rect.y + control.rect.h / 2;
  await page.mouse.click(box.x + (centerX / logical.width) * box.width, box.y + (centerY / logical.height) * box.height);
  await page.waitForTimeout(70);
}

function assertControlsInBounds(state) {
  const match = state.coordinate_system.match(/canvas (\d+)x(\d+)/);
  assert.ok(match, "canvas size should be present in text state");
  const width = Number(match[1]);
  const height = Number(match[2]);
  for (const control of state.visibleControls) {
    assert.ok(control.rect.x >= 0, `${control.id} starts inside canvas`);
    assert.ok(control.rect.y >= 0, `${control.id} starts inside canvas`);
    assert.ok(control.rect.x + control.rect.w <= width, `${control.id} ends inside canvas width`);
    assert.ok(control.rect.y + control.rect.h <= height, `${control.id} ends inside canvas height`);
  }
}

async function screenshotCanvas(page, filename) {
  const dataUrl = await page.locator("#game").evaluate((node) => node.toDataURL("image/png"));
  fs.writeFileSync(path.join(outputDir, filename), Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function preparePage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  return { context, page, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await preparePage(browser, { width: 1280, height: 800 });
    const { page, errors } = desktop;

    let state = await readState(page);
    assert.equal(state.mode, "start");
    assert.deepEqual(state.visibleControls.map((control) => control.id), ["start"]);
    await screenshotCanvas(page, "desktop-start.png");

    await clickControl(page, "start");
    state = await readState(page);
    assert.deepEqual(state.character, {
      skinColor: "#ffffff",
      outfit: null,
      outfitName: null,
      outfitColor: "#ffffff",
      eyes: false,
      mouth: false,
      anchor: { x: 338, y: 126 },
    });
    assert.equal(state.activeTab, "skin");
    assertControlsInBounds(state);
    await screenshotCanvas(page, "desktop-default-character.png");

    await clickControl(page, "skin_color_3");
    state = await readState(page);
    assert.equal(state.character.skinColor, "#bd7d52");

    await clickControl(page, "tab_clothes");
    const outfitSequence = ["short", "long", "coat", "windbreaker"];
    for (const outfit of outfitSequence) {
      await clickControl(page, `outfit_${outfit}`);
      state = await readState(page);
      assert.equal(state.character.outfit, outfit);
      assert.equal(state.character.outfitColor, "#ffffff", `${outfit} starts white`);
      await screenshotCanvas(page, `desktop-${outfit}-white.png`);
      await clickControl(page, "outfit_color_1");
      state = await readState(page);
      assert.equal(state.character.outfitColor, "#f05f56");
      await screenshotCanvas(page, `desktop-${outfit}-red.png`);
    }

    await clickControl(page, "outfit_coat");
    await clickControl(page, "outfit_color_4");
    await screenshotCanvas(page, "desktop-blue-coat.png");

    await clickControl(page, "erase");
    state = await readState(page);
    assert.equal(state.character.outfit, null);
    assert.equal(state.character.outfitColor, "#ffffff");

    await clickControl(page, "outfit_windbreaker");
    await clickControl(page, "outfit_color_6");
    await clickControl(page, "save_exit");
    state = await readState(page);
    assert.equal(state.mode, "start");
    assert.equal(state.savedCharacterExists, true);

    await page.reload({ waitUntil: "networkidle" });
    await clickControl(page, "start");
    state = await readState(page);
    assert.equal(state.character.skinColor, "#bd7d52");
    assert.equal(state.character.outfit, "windbreaker");
    assert.equal(state.character.outfitColor, "#a779c9");
    await screenshotCanvas(page, "desktop-saved-reload.png");

    await clickControl(page, "tab_skin");
    await clickControl(page, "skin_color_1");
    await clickControl(page, "exit");
    await clickControl(page, "start");
    state = await readState(page);
    assert.equal(state.character.skinColor, "#bd7d52", "plain exit discards unsaved skin color");
    assert.deepEqual(errors, []);
    await desktop.context.close();

    const mobile = await preparePage(browser, { width: 390, height: 844 });
    await screenshotCanvas(mobile.page, "mobile-start.png");
    await clickControl(mobile.page, "start");
    state = await readState(mobile.page);
    assert.equal(state.orientation, "portrait");
    assert.equal(state.character.outfit, null);
    assertControlsInBounds(state);
    await screenshotCanvas(mobile.page, "mobile-default-character.png");
    await clickControl(mobile.page, "skin_color_2");
    await clickControl(mobile.page, "tab_clothes");
    await clickControl(mobile.page, "outfit_windbreaker");
    await clickControl(mobile.page, "outfit_color_3");
    state = await readState(mobile.page);
    assert.equal(state.character.skinColor, "#eab48b");
    assert.equal(state.character.outfit, "windbreaker");
    assert.equal(state.character.outfitColor, "#4cb78e");
    assertControlsInBounds(state);
    await screenshotCanvas(mobile.page, "mobile-windbreaker.png");
    assert.deepEqual(mobile.errors, []);
    await mobile.context.close();

    fs.writeFileSync(
      path.join(outputDir, "e2e-result.json"),
      JSON.stringify({ status: "passed", desktop: true, mobile: true, consoleErrors: 0 }, null, 2),
    );
    console.log("character customizer e2e: passed");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
