export const primaryActions = {
  "tooth-runner": async (frame) => frame.locator("#startButton").click({ timeout: 2_000 }),
  "merge-restaurant": async (frame) => frame.locator("#basket").click({ timeout: 2_000 }),
  "mystic-candy-shop": async (frame) => {
    const canvas = frame.locator("canvas");
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width * 126 / 390, y: box.height * 790 / 844 }, timeout: 2_000 });
  },
  "neon-lane-dodger": async (frame) => frame.locator("#btn-start").click({ timeout: 2_000 }),
  "mafia-midnight": async (frame) => {
    const canvas = frame.locator("canvas");
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width * 295 / 1280, y: box.height * 450 / 720 }, timeout: 2_000 });
    await canvas.click({ position: { x: box.width * 640 / 1280, y: box.height * 560 / 720 }, timeout: 2_000 });
  },
  "character-customizer": async (frame) => {
    const target = await frame.evaluate(() => {
      const state = JSON.parse(window.render_game_to_text());
      const rect = state.visibleControls.find((control) => control.id === "start").rect;
      const canvas = document.querySelector("canvas");
      return { x: (rect.x + rect.w / 2) / canvas.width, y: (rect.y + rect.h / 2) / canvas.height };
    });
    const canvas = frame.locator("canvas");
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width * target.x, y: box.height * target.y }, timeout: 2_000 });
  },
  "hospital-night-shift": async (frame) => frame.locator("#start-button").click({ timeout: 2_000 }),
  "korean-word-chain": async (frame) => frame.locator("#play-button").click({ timeout: 2_000 }),
  "camping-town-3d": async (frame) => {
    await frame.locator('[data-move-key="arrowup"]').click({ delay: 600 });
  },
  "word-spy-party": async (frame) => frame.locator("#primaryAction").click({ timeout: 2_000 }),
  "building-playground-3d": async (frame) => frame.locator("#build-toggle").click({ timeout: 2_000 }),
  "gomdori-escape-3d": async (frame) => frame.locator("#start3d").click({ timeout: 2_000 })
};

