// 第 60 轮 · 903647529203634176：击杀金色 "+10" 是否真的走了伤害数字同一套 Sprite 池（kind='kill'）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  let ok = false;
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.battle?.running, null, { polling: 200, timeout: 90000 });
    report.setup = await page.evaluate(() => {
      const b = window.rea.battle, w = b.world;
      const c = w.cells.find((c) => w.top(c) >= 1 && w.top(c) === w.ground(c) && c.edgeNeighbors.every((id) => id >= 0 && w.top(w.cells[id]) === w.top(c)));
      if (!c) throw Error('no open fixture');
      const mk = (team, dx, dz, hp) => ({ uid: 9100 + Math.round((dx + dz) * 1000), team, squad: null, k: 0, hp, max: hp, x: c.cx + dx, z: c.cz + dz, y: w.top(c) * b.L, navFloor: w.top(c), cd: 0, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, radius: .055 });
      b.paused = true; b.nextWave = Infinity;
      b.units = [mk(0, 0, 0, 8), mk(1, .16, 0, 1)];   // 敌人只有 1 点血 → 一刀必死，触发 +10
      b.units[0].squad = b.squads[0];
      window.killFixture = { b, c };
      window.rea.view.target.set(c.cx, w.top(c) * b.L, c.cz);
      window.rea.view.distance = 3.4; window.rea.view.pitch = .95; window.rea.view.updateCamera();
      return { cell: c.id, top: w.top(c) };
    });
    for (let i = 0; i < 40; i++) {
      report.stats = await page.evaluate(() => {
        const { b } = window.killFixture;
        b.paused = false; b.update(0.05); b.paused = true;
        return {
          kills: b.damageStats.kills, lastKind: b.damageStats.lastKind, live: b.damageStats.live,
          dead: b.units.filter((u) => u.dead).length,
          texts: b.damageNumbers.map((p) => p.kind + ':' + p.text),
          texKeys: [...b.damageTexCache.keys()],
          sprites: b.damageSprites.filter((s) => s.visible).length,
        };
      });
      if (report.stats.kills > 0) break;
    }
    await page.screenshot({ path: `${OUT}/damage-kill-popup.png` });
    ok = problems.length === 0
      && report.stats.kills > 0
      && report.stats.kills >= 1
      && report.stats.texts.some((t) => t === 'kill:+10')
      && report.stats.texKeys.includes('kill|+10')
      && report.stats.dead >= 1;
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();
