// 903647529203634176 · 伤害数字（+4）与命中集联动：真机位下打起来，看是否只有「真的掉了血」的单位跳数字。
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [], reports = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    for (const grid of ['quad', 'mixed']) {
      await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=' + grid, { waitUntil: 'load' });
      await page.waitForFunction(() => window.rea?.battle?.running, null, { polling: 200, timeout: 90000 });
      // 摆一场一定会互砍的近战：两个维京人贴着一名守军，所有人 cd 归零
      const setup = await page.evaluate(() => {
        const b = window.rea.battle, w = b.world;
        const c = w.cells.find((c) => w.top(c) >= 1 && w.top(c) === w.ground(c) && c.edgeNeighbors.every((id) => id >= 0 && w.top(w.cells[id]) === w.top(c)));
        if (!c) throw Error('no open fixture');
        const mk = (team, dx, dz, hp) => ({ uid: 9000 + Math.round((dx + dz) * 1000), team, squad: null, k: 0, hp, max: hp, x: c.cx + dx, z: c.cz + dz, y: w.top(c) * b.L, navFloor: w.top(c), cd: 0, dead: false, onBoat: null, face: 0, soak: 0, stunRemaining: 0, radius: .055 });
        b.paused = true; b.nextWave = Infinity;
        b.units = [mk(0, 0, 0, 3), mk(1, .16, 0, 2), mk(1, .16, .22, 2)];   // 步兵 reach 0.28：必须贴到 0.28 内
        b.units[0].squad = b.squads[0];   // 流场那段会读守军的 squad.archer/pike
        window.dmgFixture = { b, c, hp0: b.units.map((u) => u.hp) };
        window.rea.view.target.set(c.cx, w.top(c) * b.L, c.cz);
        window.rea.view.distance = 3.4; window.rea.view.pitch = .95; window.rea.view.updateCamera();
        return { cell: c.id, units: b.units.length, top: w.top(c) };
      });
      // 打几帧（每帧 0.05s），记录掉血集合与飘字
      let stats = null;
      for (let i = 0; i < 40; i++) {
        stats = await page.evaluate(() => {
          const { b } = window.dmgFixture;
          b.paused = false; b.update(0.05); b.paused = true;
          const damaged = b.units.filter((u, i) => u.hp < window.dmgFixture.hp0[i]).map((u, i) => ({ uid: u.uid, hp: u.hp }));
          return {
            spawned: b.damageStats.spawned, live: b.damageStats.live, last: b.damageStats.lastValue,
            merged: b.damageStats.merged, damaged: damaged.length,
            spritesVisible: b.damageSprites.filter((s) => s.visible).length,
            spriteTexts: [...new Set(b.damageSprites.filter((s) => s.visible).map((s) => s.material.map?.image?.width ? 'tex' : 'none'))],
            numbersOnDamaged: damaged.every((d) => b.damageNumbers.some((p) => p.unitId === d.uid) || b.damageStats.live === 0),
          };
        });
        if (stats.spawned >= 3) break;
      }
      await page.screenshot({ path: `${OUT}/damage-numbers-${grid}.png` });
      // 断言：有数字、字值与掉血对应（1 点血 = +4）、屏上精灵数 = 存活数字数
      const bad = [];
      if (!(stats.spawned > 0)) bad.push('没有生成任何伤害数字');
      if (![4, 8, 12].includes(stats.last)) bad.push('伤害数值不在 1 点血=+4 的档位上：' + stats.last);
      if (stats.spritesVisible !== stats.live) bad.push(`精灵数 ${stats.spritesVisible} ≠ 存活数字数 ${stats.live}`);
      if (stats.merged > 0 && stats.damaged < 2) bad.push('不同单位被合并了');
      reports.push({ grid, setup, stats, bad });
      if (bad.length) problems.push(grid + ': ' + bad.join(' / '));
    }
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(`${OUT}/damage-numbers-browser.json`, JSON.stringify({ reports, problems }, null, 2));
  const ok = problems.length === 0 && reports.length === 2 && reports.every((r) => r.stats?.spawned > 0);
  console.log(JSON.stringify({ ok, problems, reports }, null, 1));
  if (!ok) process.exitCode = 1;
})();
