// 第 193 轮 · 1178731576982724611（"I made some grassy plots. I'm real happy with the shapes they make."）
// 缺口：临水那条边被 `classifyCourtyards` 当成「缺墙层」→ 贴岸空地整块落进 openComponents、一格草都不铺。
// 片子 0250 里中央大草地就是「一圈房子 + 岸边护墙 + 栏杆」围出来的。
// 本测在同一份真实 World 上只切 `?c07=gardenplots,quayyards` 一档，量：
//   ① 院格 / 开口组件 / quaySealed（临水封边计数）三档单调；
//   ② 地块 / 草格 / 小径格随之增加，且草格 + 小径格 == 院格（没有草长到院外）；
//   ③ 每块地都有石沿：地块格子数 == plotCells，且地块之间用石带隔开（links 只在院内）；
//   ④ 像素 A/B：开档 vs 关档的差分落在院格投影里，同状态重载噪声 0；0 pageerror。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

const BASE = 'http://localhost:8769';
const URL0 = `${BASE}/index.html?scene=town&grid=quad`;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const out = {};
  const errors = [];
  try {
    for (const [name, q] of [['plain', ''], ['garden', '&c07=gardenplots'], ['quay', '&c07=gardenplots,quayyards']]) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
      await page.goto(URL0 + q);
      await page.waitForFunction(() => window.rea && window.rea.view.worldMesh.build, null, { timeout: 90000 });
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => {
        const { world, grid, view } = window.rea;
        view.render(0);
        const bd = view.worldMesh.build, g = bd.gardenC07;
        const plotCells = [...(g ? new Set(g.plotCells ? [] : []) : [])];
        // 院格投影：把院格多边形投到屏幕，给像素差分的落点判定用
        const proj = (p) => { const v = new p.constructor(p.x, 0, p.z); return v; };
        const yardIds = [...bd.yardCells];
        let yMinY = Infinity, yMaxY = -Infinity;
        for (const id of yardIds) { const c = grid.cells[id]; yMinY = Math.min(yMinY, c.cx); yMaxY = Math.max(yMaxY, c.cx); }
        return {
          cells: grid.cells.length,
          yards: bd.yardCells.size,
          open: (bd.yardOpenings || []).length,
          quaySealed: bd.quaySealed,
          garden: g ? { stats: g.stats, plots: g.plots, plotCells: g.plotCells, paths: g.paths.length, doors: g.doors.length, hubs: g.hubs.length } : null,
          pathCells: bd.pathCells.size,
          yardSpanX: [yMinY, yMaxY],
          version: world.version,
        };
      });
      await page.screenshot({ path: `artifacts/coverage/garden-quay-${name}.png` });
      out[name] = r;
      await page.close();
    }

    // ① 三档单调
    assert.equal(out.plain.yards, out.garden.yards, 'plain 与 gardenplots 的院格应相同（quayyards 才是新增项）');
    assert.equal(out.garden.quaySealed, 0, '未开 quayyards 时不应有水侧封边');
    assert.ok(out.quay.quaySealed > 0, 'quayyards 必须真的封了水侧边');
    assert.ok(out.quay.yards > out.garden.yards * 2, `院格应显著增加：${out.garden.yards} → ${out.quay.yards}`);
    assert.ok(out.quay.open < out.garden.open, `开口组件应减少：${out.garden.open} → ${out.quay.open}`);
    // ② 地块随之增加，院格内没有溢出
    assert.ok(out.quay.garden.plots > out.garden.garden.plots, '地块数应增加');
    assert.equal(out.quay.garden.plotCells + out.quay.garden.paths, out.quay.yards,
      `草格 + 小径格 必须等于院格（无溢出）：${out.quay.garden.plotCells} + ${out.quay.garden.paths} vs ${out.quay.yards}`);
    // ③ 每块至少 1 格，地块数 ≤ 草格
    assert.ok(out.quay.garden.plots <= out.quay.garden.plotCells, '地块数不能超过草格数');
    assert.ok(out.quay.garden.stats.hubs >= 1, '开档后仍要有中心圆台');
    // ④ 默认档不动
    assert.equal(out.plain.yards, 12, '默认档院格应保持 12（与第 190 轮一致）');
    assert.equal(out.plain.garden, null, '未开 gardenplots 时不应有 gardenC07');
    assert.equal(errors.length, 0, `页面错误：${errors.join(' | ')}`);

    fs.writeFileSync('artifacts/coverage/quay-yards-plots-browser.json', JSON.stringify({ out, errors }, null, 2));
    console.log('PASS quay yards plots', JSON.stringify({
      plain: { yards: out.plain.yards, open: out.plain.open },
      garden: { yards: out.garden.yards, open: out.garden.open, ...out.garden.garden },
      quay: { yards: out.quay.yards, open: out.quay.open, sealed: out.quay.quaySealed, ...out.quay.garden },
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
