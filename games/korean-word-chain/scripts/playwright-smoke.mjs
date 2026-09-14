import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.env.PREVIEW_URL ?? "http://192.168.219.121:8770/";
const outDir = path.resolve("output/visual-qa/word-chain");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function resetPage(page) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(
    overflow.scrollWidth <= overflow.innerWidth + 1,
    `page overflows horizontally: ${overflow.scrollWidth} > ${overflow.innerWidth}`,
  );
}

const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  desktop.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  desktop.on("pageerror", (error) => errors.push(String(error)));

  await resetPage(desktop);
  await assertNoHorizontalOverflow(desktop);
  await desktop.screenshot({ path: path.join(outDir, "01-lobby-desktop.png"), fullPage: true });

  await desktop.click("#play-button");
  await assertNoHorizontalOverflow(desktop);
  await desktop.screenshot({ path: path.join(outDir, "02-playing-empty-desktop.png"), fullPage: true });

  await desktop.fill("#word-input", "계란");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterAiBlocked = await readState(desktop);
  assert.equal(afterAiBlocked.mode, "lobby");
  assert.equal(afterAiBlocked.lastResult.winner, "player");
  assert.deepEqual(
    afterAiBlocked.history.map((item) => item.word),
    ["계란"],
  );
  await desktop.screenshot({ path: path.join(outDir, "03-ai-cannot-answer-desktop.png"), fullPage: true });

  await resetPage(desktop);
  await desktop.click("#play-button");
  await desktop.fill("#word-input", "컴퓨터");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterComputer = await readState(desktop);
  assert.equal(afterComputer.mode, "playing");
  assert.deepEqual(
    afterComputer.history.map((item) => item.word),
    ["컴퓨터", "터치"],
  );
  assert.match(afterComputer.message, /예: 치킨/);
  await desktop.screenshot({ path: path.join(outDir, "04-extra-dictionary-word-desktop.png"), fullPage: true });

  await resetPage(desktop);
  await desktop.click("#play-button");
  await desktop.fill("#word-input", "가격");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterGeneratedDictionaryWord = await readState(desktop);
  assert.equal(afterGeneratedDictionaryWord.mode, "lobby");
  assert.equal(afterGeneratedDictionaryWord.lastResult.winner, "player");
  assert.deepEqual(
    afterGeneratedDictionaryWord.history.map((item) => item.word),
    ["가격"],
  );
  await desktop.screenshot({ path: path.join(outDir, "05-generated-dictionary-word-desktop.png"), fullPage: true });

  await resetPage(desktop);
  await desktop.click("#play-button");
  await desktop.fill("#word-input", "박수");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterPlayableBranch = await readState(desktop);
  assert.equal(afterPlayableBranch.mode, "playing");
  assert.deepEqual(
    afterPlayableBranch.history.map((item) => item.word),
    ["박수", "수건"],
  );
  assert.match(afterPlayableBranch.message, /예: 건물/);
  await desktop.screenshot({ path: path.join(outDir, "06-playable-branch-desktop.png"), fullPage: true });

  await resetPage(desktop);
  await desktop.click("#play-button");
  await desktop.fill("#word-input", "기차");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterTrain = await readState(desktop);
  assert.equal(afterTrain.mode, "playing");
  assert.deepEqual(
    afterTrain.history.map((item) => item.word),
    ["기차", "차도"],
  );
  assert.match(afterTrain.message, /예: 도시/);
  await desktop.screenshot({ path: path.join(outDir, "07-train-road-desktop.png"), fullPage: true });

  await desktop.fill("#word-input", "도시");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterCity = await readState(desktop);
  assert.equal(afterCity.mode, "playing");
  assert.deepEqual(
    afterCity.history.map((item) => item.word),
    ["기차", "차도", "도시", "시계"],
  );
  assert.match(afterCity.message, /예: 계란/);
  const wordListScroll = await desktop.locator(".word-list").evaluate((element) => ({
    scrollTop: element.scrollTop,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  assert.ok(
    wordListScroll.scrollTop + wordListScroll.clientHeight >= wordListScroll.scrollHeight - 2,
    `word list should scroll to latest word: ${JSON.stringify(wordListScroll)}`,
  );
  await desktop.screenshot({ path: path.join(outDir, "08-train-city-desktop.png"), fullPage: true });

  await resetPage(desktop);
  await desktop.click("#play-button");
  await desktop.fill("#word-input", "사과");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterFirst = await readState(desktop);
  assert.equal(afterFirst.mode, "playing");
  assert.equal(afterFirst.currentSyllable, "자");
  assert.deepEqual(
    afterFirst.history.map((item) => item.word),
    ["사과", "과자"],
  );
  await desktop.screenshot({ path: path.join(outDir, "09-after-ai-desktop.png"), fullPage: true });

  await desktop.fill("#word-input", "자두");
  await desktop.click("#submit-word");
  await desktop.waitForTimeout(250);
  const afterWin = await readState(desktop);
  assert.equal(afterWin.mode, "lobby");
  assert.equal(afterWin.balance, 2000);
  assert.equal(afterWin.lastResult.winner, "player");
  await desktop.screenshot({ path: path.join(outDir, "10-win-lobby-desktop.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  mobile.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  mobile.on("pageerror", (error) => errors.push(String(error)));

  await resetPage(mobile);
  await assertNoHorizontalOverflow(mobile);
  await mobile.screenshot({ path: path.join(outDir, "11-lobby-mobile.png"), fullPage: true });
  await mobile.click("#play-button");
  await assertNoHorizontalOverflow(mobile);
  await mobile.screenshot({ path: path.join(outDir, "12-playing-mobile.png"), fullPage: true });

  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}

console.log(`visual smoke passed: ${outDir}`);
