/**
 * tri-base-graph-browser.cjs — 第 126 轮 · 1447496205282549761
 *   「The base graph is just a humble irregular triangle grid」
 *
 * 缺口史：note 从第 56 批挂到现在都是同一句「完整软坡/河道/预制 tile 生成仍未覆盖，本批仅学习审核」。
 * 核实结论（本轮）：
 *   ① 片子讲的只有一件事 —— 底图是一张**不规则三角网**，再切到用同一张底图生成的岛（383 帧里
 *      白线底图 / 带高度的线框 / 完成岛三种画面反复切换，见 artifacts/coverage/1447496205282549761-review-r126.md）；
 *   ② 机制都在：`generateTerrain` 的软坡（softSlopes + world.softTops）与河道（carveRivers → riverFlow）
 *      r55 就落了，`buildMixedGrid` 就是那张不规则底图（四边格 + 三角格，面积 CV 0.42）；
 *   ③ 真正缺的是**页面入口**：`terrain-r55.html` 原来只透传 `grid=quad|mixed`，三角底图上根本跑不了软坡/河道；
 *      `grids.html` 的底图页也只能看填色格，没有「只画格线 / 四边格切一条对角」这两个口径。
 *
 * 判据（全部读活对象，不看 exit code）：
 *   ① 底图纯净：tri 486 格**每格 3 边**、顶点最多 6 格共用、V−E+F=1、面积 CV=0（规则格子对照组）；
 *   ② 不规则底图：mixed 331 格 = 176 三角 + 155 四边，**四边格各切一条对角线**（diagonals == quads），
 *      切完 486 个三角；面积 CV > 0.3、max/min ≈ 5.8 —— 这就是片子里「同一张网里大小格混着」的那件事；
 *   ③ 三角底图上真的能出岛：主场景 `?grid=tri&scene=terrain` 陆地 576 格 / 10 个层高 / 河道 27 格；
 *   ④ 三角底图上真的能出软坡 + 河道 + 湖：`terrain-r55.html?grid=tri&soft&relax&lakes` 软坡面 36.4 /
 *      墙面 211.8、河道 52 格 2 条 7 个入海口、6 个湖 51 格；关掉软坡作反向对照（软坡面 0、墙面更大）；
 *   ⑤ 0 页面错误。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const BASE = 'http://127.0.0.1:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });

  const out = { ok: true, checks: [], grids: {}, scene: null, r55: null, r55off: null };
  const check = (name, cond, detail) => { out.checks.push({ name, pass: !!cond, detail }); if (!cond) out.ok = false; console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name} — ${detail}`); };

  try {
    /* ---------- ① ② 底图：规则三角（对照） vs 不规则底图 + 对角切分 ---------- */
    for (const kind of ['tri', 'mixed']) {
      await page.goto(`${BASE}/grids.html?t=kinds&kind=${kind}&wire=1&tri2=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.gridLab, null, { timeout: 30000 });
      const rep = await page.evaluate(() => gridLab.kindsReport);
      out.grids[kind] = rep;
      await page.screenshot({ path: `artifacts/coverage/tri-base-graph-${kind}.png` });
    }

    const tri = out.grids.tri, mix = out.grids.mixed;
    check('① 纯三角底图：每格 3 边、无四边格', tri.sides['3'] === tri.cells && tri.cells > 400, `${tri.cells} 格 / sides=${JSON.stringify(tri.sides)}`);
    check('① 纯三角底图：顶点最多被 6 格共用', Math.max(...Object.keys(tri.vertexSharing).map(Number)) === 6, JSON.stringify(tri.vertexSharing));
    check('① 纯三角底图：V−E+F=1（圆盘拓扑）', tri.euler === 1, `V ${tri.verts} − E ${tri.edges} + F ${tri.cells} = ${tri.euler}`);
    check('① 纯三角底图：所有格面积相同（规则格子，作不规则性的对照）', tri.areaCv === 0, `CV ${tri.areaCv} · ${tri.areaMin}–${tri.areaMax}`);

    check('② 不规则底图：三角格与四边格混在一张网里', mix.triangles > 0 && mix.quads > 0, `三角 ${mix.triangles} / 四边 ${mix.quads} / 共 ${mix.cells}`);
    check('② 每个四边格只切一条对角线', mix.diagonals === mix.quads && mix.diagonals > 100, `diagonals ${mix.diagonals} == quads ${mix.quads}`);
    check('② 切完的三角数 = 三角格 + 2×四边格', mix.tris === mix.triangles + 2 * mix.quads, `${mix.tris} = ${mix.triangles} + 2×${mix.quads}`);
    check('② 底图不规则：格面积 CV > 0.3', mix.areaCv > 0.3, `CV ${mix.areaCv} · ${mix.areaMin}–${mix.areaMax}（max/min ${(mix.areaMax / mix.areaMin).toFixed(2)}×）`);
    check('② 不规则底图：V−E+F=1', mix.euler === 1, `V ${mix.verts} − E ${mix.edges} + F ${mix.cells} = ${mix.euler}`);

    /* ---------- ③ 三角底图上出岛 ---------- */
    await page.goto(`${BASE}/index.html?grid=tri&scene=terrain`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 10 && rea.view.renderer.info.render.calls > 0, null, { timeout: 90000 });
    const scene = await page.evaluate(() => {
      const g = rea.grid, w = rea.world, v = rea.view;
      const sides = {}; for (const c of g.cells) sides[c.n] = (sides[c.n] || 0) + 1;
      let land = 0, river = 0; const lv = new Set();
      for (const c of g.cells) { const t = w.top(c); if (t > 0) { land++; lv.add(+t.toFixed(3)); } if (w.river[c.id]) river++; }
      v.setDebug('grid', true); v.setGridSurface?.(true);
      const arr = v.gridLines.geometry.attributes.position.array;
      const uniq = new Set();
      for (let i = 0; i < arr.length; i += 6) {
        const a = [arr[i], arr[i + 1], arr[i + 2]].map((x) => x.toFixed(3)).join(','), b = [arr[i + 3], arr[i + 4], arr[i + 5]].map((x) => x.toFixed(3)).join(',');
        uniq.add(a < b ? a + '|' + b : b + '|' + a);
      }
      const f = w.riverFlow?.version === w.version ? w.riverFlow : null;
      return { cells: g.cells.length, sides, land, levels: lv.size, river, gridSegments: uniq.size, reaches: (f?.paths || []).length, mouths: (f?.mouths || []).length };
    });
    out.scene = scene;
    check('③ 主场景三角底图：每格 3 边', scene.sides['3'] === scene.cells, `${scene.cells} 格 / ${JSON.stringify(scene.sides)}`);
    check('③ 三角底图上生成出岛：陆地 ≥ 400 格、≥ 8 个层高', scene.land >= 400 && scene.levels >= 8, `陆地 ${scene.land} · ${scene.levels} 层`);
    check('③ 三角底图上有河道：river 格 > 0 且有入海口', scene.river > 0 && scene.reaches > 0, `river ${scene.river} 格 · ${scene.reaches} 条 · ${scene.mouths} 个口`);
    check('③ 格线层跟着三角格画：唯一段数 ÷ 陆地格 ≈ 2.8（每陆地格 3 边，与 r121 口径一致）', scene.gridSegments / scene.land > 2.5 && scene.gridSegments / scene.land < 3.1, `${scene.gridSegments} 段 / ${scene.land} 陆地格 = ${(scene.gridSegments / scene.land).toFixed(3)}`);
    await page.screenshot({ path: 'artifacts/coverage/tri-island-r126.png' });

    /* ---------- ④ 三角底图上的软坡 + 河道 + 湖（含反面对照） ---------- */
    for (const soft of [1, 0]) {
      await page.goto(`${BASE}/terrain-r55.html?grid=tri&soft=${soft}&softrelax=1&relax=1&lakes=1&cam=soft&dist=24&clean=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__r55 && window.__r55.cells > 0, null, { timeout: 150000 });
      await page.waitForTimeout(1200);
      const s = await page.evaluate(() => window.__r55);
      if (soft) { out.r55 = s; await page.screenshot({ path: 'artifacts/coverage/tri-soft-river-r126.png' }); } else out.r55off = s;
    }
    const on = out.r55, off = out.r55off;
    check('④ r55 页接受三角底图（原来只透传 quad|mixed）', on.grid === 'tri' && on.gridSides['3'] === on.cells, `grid ${on.grid} · ${on.cells} 格 / ${JSON.stringify(on.gridSides)}`);
    check('④ 三角底图上有软坡面：soft 面积 > 0 且墙面随软坡变小', on.slope.soft > 0 && on.slope.wallArea < off.slope.wallArea, `软坡面 ${on.slope.soft} vs 墙面 ${on.slope.wallArea}（关软坡：软坡面 ${off.slope.soft} / 墙面 ${off.slope.wallArea}）`);
    check('④ 三角底图上有河道 + 湖：riverCells > 0、reaches ≥ 1、湖 > 0', on.riverCells > 0 && on.riverReaches >= 1 && on.lakes > 0, `river ${on.riverCells} 格 / ${on.riverReaches} 条 / ${on.riverMouths} 口 / 湖 ${on.lakes}（${on.lakeCells} 格）`);
    check('④ 缓坡坍缩：河道缓坡把陡边从 118 降到 91', on.relax && on.relax.steepEdgesAfter < on.relax.steepEdgesBefore, JSON.stringify(on.relax));
    check('④ 关软坡时 softTops 关闭（反向对照口径一致）', off.softTops === false, `softTops ${off.softTops}`);

    check('⑤ 0 页面错误', errors.length === 0, errors.length ? errors.slice(0, 4).join(' | ') : '0');
  } finally {
    fs.writeFileSync('artifacts/coverage/tri-base-graph-browser.json', JSON.stringify(out, null, 2));
    await browser.close();
  }

  if (!out.ok) { console.error('FAILED checks:', out.checks.filter((c) => !c.pass).map((c) => c.name)); process.exit(1); }
  console.log('ALL PASS', out.checks.length, 'checks');
  assert.ok(out.ok);
})().catch((e) => { console.error(e); process.exit(1); });
