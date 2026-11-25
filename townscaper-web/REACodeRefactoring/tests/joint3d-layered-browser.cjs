// 1447494168448753667「mix of triangular and square tiles（方格沿两条对角线切成 4 个三角形）」运行验收（第 119 轮）。
//
// note 挂了很久的「四子格联合模块约束及原 3Dtile 仍缺」，本轮 grep 核实：
//   · 联合约束 = `src/core/wfc.js#jointSubtileCatalog()` + `#layeredJointCatalog()`（辐条插槽 spoke: 把同父格的 4 个子格绑成同一模块）；
//   · 3D tile  = `joint3d.html`（layerGrid 叠 3 层，层间 up/down 半边相连，`tall:` 插槽把 4 子格 × 2 层绑成一个高塔模块）；
//   · 已有 `tests/joint-subtiles.mjs` / `tests/tri-subtiles.mjs` 全 PASS。
// 所以这条是 A 性质：机制在，缺的是「从页面上真跑一遍 + 关掉约束做反向对照」。
//
// 片子逐帧（178 帧，本片实测）看到的三件事，和本页一一对应：
//   ① 方格被两条对角线切成 4 个三角形（帧 0050 地面网格）；
//   ② 三角/方格混合 tile 跑 WFC，每条边有不同颜色的插槽（帧 0050/0130 的彩色描边与色点）；
//   ③ 三维体块：单层块、两层塔、连成条带的房间（帧 0130）。
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');

const OUT = path.resolve(__dirname, '../artifacts/coverage');
const BASE = process.env.REA_TEST_URL || 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({viewport: {width: 1320, height: 900}});
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const out = {};
  try {
    const run = async (q, shot) => {
      await page.goto(BASE + '/joint3d.html' + q);
      await page.waitForFunction(() => window.__joint3d, null, {timeout: 90000});
      // 顺便把「每个父格的子格数」量出来：方格=4（对角四分），三角=1
      const s = await page.evaluate(async () => {
        const stats = window.__joint3d;
        const {buildMixedGrid, buildTriangularSubgrid} = await import('/src/core/grid.js');
        const sub = buildTriangularSubgrid(buildMixedGrid({radius: 4, seed: 5}));
        const groups = sub.subdivision.groups;
        return {...stats, groups: groups.length,
          childCounts: [...new Set(groups.map((g) => g.children.length))].sort((a, b) => a - b),
          quads: groups.filter((g) => g.children.length === 4).length};
      });
      if (shot) fs.writeFileSync(path.join(OUT, shot), await page.locator('#c').screenshot());
      return s;
    };

    // ---- 正例：联合约束开
    out.on = await run('?joint=1&seed=3', 'joint3d-on.png');
    const on = out.on;
    if (!on.joint) throw new Error('?joint=1 没被页面认成开：' + JSON.stringify(on));
    if (!on.ok) throw new Error('联合约束下 WFC 没解：' + on.reason);
    if (on.conflicts !== 0) throw new Error('解出来还有冲突：' + on.conflicts);
    if (on.mismatchedGroupLevels !== 0) throw new Error('同一父格的 4 个子格没有每层选同一模块：' + on.mismatchedGroupLevels);
    if (on.levels !== 3) throw new Error('没有叠 3 层：' + on.levels);
    if (on.subcells !== on.parents + 3 * on.quads)
      throw new Error('子格数 ≠ 三角父格 + 方格父格×4（没有对角四分）：' + JSON.stringify({parents: on.parents, quads: on.quads, subcells: on.subcells}));
    if (on.childCounts.join(',') !== '1,4') throw new Error('子格分组的子数不是 {1,4}：' + on.childCounts.join(','));
    if (on.groups !== on.parents) throw new Error('分组数 ≠ 父格数：' + on.groups + ' vs ' + on.parents);
    if (!(on.towers >= 1)) throw new Error('没有跨两层的塔模块（tall: 插槽）：' + on.towers);
    if (on.decodeError) throw new Error('decode 失败：' + on.decodeError);

    // ---- 反向对照：辐条变通配 → 同一父格子格必须开始不一致（证明这条约束真的在起作用）
    out.off = await run('?joint=0&seed=3', 'joint3d-off.png');
    if (out.off.joint) throw new Error('?joint=0 没关掉：' + JSON.stringify(out.off));
    if (!(out.off.mismatchedGroupLevels > 0))
      throw new Error('关掉联合约束后同父格子格仍然一致 —— 约束是空的：' + JSON.stringify(out.off));

    // ---- 换种子仍成立（不是恰好命中）
    out.seed9 = await run('?joint=1&seed=9', null);
    if (!(out.seed9.ok && out.seed9.conflicts === 0 && out.seed9.mismatchedGroupLevels === 0))
      throw new Error('换种子后联合约束破了：' + JSON.stringify(out.seed9));

    if (errors.length) throw new Error('console/page errors: ' + errors.slice(0, 3).join(' | '));
    fs.writeFileSync(path.join(OUT, 'joint3d-layered-browser.json'), JSON.stringify(out, null, 1));
    console.log('PASS joint3d layered', JSON.stringify({
      on: {parents: on.parents, subcells: on.subcells, levels: on.levels, catalog: on.catalog,
        conflicts: on.conflicts, mismatch: on.mismatchedGroupLevels, towers: on.towers, ms: on.ms, backtracks: on.backtracks},
      off: {conflicts: out.off.conflicts, mismatch: out.off.mismatchedGroupLevels},
      seed9: {ok: out.seed9.ok, mismatch: out.seed9.mismatchedGroupLevels, towers: out.seed9.towers},
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
