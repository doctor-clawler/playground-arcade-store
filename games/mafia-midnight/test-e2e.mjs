import playwright from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = playwright;

const url = 'http://127.0.0.1:18035';
const roleX = { detective: 295, doctor: 525, citizen: 755, mafia: 985 };
const pos = i => ({ x: 108 + (i % 4) * 260 + 119, y: 160 + Math.floor(i / 4) * 138 + 58 });
const browser = await chromium.launch({ headless: true });
const reports = [];

for (const role of Object.keys(roleX)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  const click = (x,y) => page.mouse.click(x,y);
  const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await click(roleX[role],450); await click(640,560);
  let s = await read(), turns = 0;
  while (s.mode !== 'end' && turns++ < 12) {
    if (s.mode === 'day') await click(640,650);
    else if (s.mode === 'vote') {
      const idx = s.players.findIndex((p,i)=>i>0 && p.alive && !(role==='mafia'&&p.knownRole==='mafia'));
      const p=pos(idx); await click(p.x,p.y); await click(640,631);
    } else if (s.mode === 'voteResult') await click(640,530);
    else if (s.mode === 'night') {
      if (role === 'citizen') await click(640,631);
      else {
        const idx = s.players.findIndex((p,i)=>p.alive && (role==='doctor' || i>0) && !(role==='mafia'&&p.knownRole==='mafia'));
        const p=pos(idx); await click(p.x,p.y); await click(640,631);
      }
    }
    s = await read();
  }
  reports.push({ role, terminal: s.mode, winner: s.winner, day: s.day, playerAlive: s.players[0].alive, errors });
  if (role === 'mafia') {
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'output/visual-qa/desktop-end-1280x720.png' });
  }
  await page.close();
}
const mobile = await browser.newPage({ viewport: { width: 844, height: 390 } });
await mobile.goto(url);
await mobile.screenshot({ path: 'output/visual-qa/mobile-title-844x390.png' });
const box = await mobile.locator('canvas').boundingBox();
const mc = (x,y) => mobile.mouse.click(box.x + x * box.width / 1280, box.y + y * box.height / 720);
await mc(295,450); await mc(640,560);
await mobile.screenshot({ path: 'output/visual-qa/mobile-day-844x390.png' });
await mobile.close();
console.log(JSON.stringify(reports, null, 2));
await browser.close();
