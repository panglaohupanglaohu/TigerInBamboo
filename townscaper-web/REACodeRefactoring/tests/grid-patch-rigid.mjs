/**
 * grid-patch-rigid.mjs — 1459169210752507904「And another」补丁级刚性。
 *
 * 片内：整片被切成约 8 块方格补丁，**补丁内所有格同朝向**（抖动 0°），
 * 补丁之间才是三角过渡带；全片平面正视、无 3D 场景。
 *
 * 旧生成器：三角形逐格随机跨任意边合并 → 每个菱形的对角方向都是随机的 →
 * patchLayout 数出 451 块（285 块只有 1 格），邻格轴向差 p50 12.7°。
 * 本轮：`rigid` 让合并方向按补丁块族约束（四边格起点再统一到 id 最小角，
 * 否则同一对角方向会因起笔端点不同读成两个相差 30° 的轴向）。
 *
 * 跑：node tests/grid-patch-rigid.mjs
 */
import { buildMixedGrid } from '../src/core/grid.js';
import { patchLayout } from '../src/core/grid-wireframe.js';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' · ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' · ' + extra : ''}`); }
};
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

const axis = (pts) => {
  const a = pts[0], b = pts[1];
  const t = (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
  return ((t % 90) + 90) % 90;
};
const axisDelta = (a, b) => { const d = Math.abs(a - b) % 90; return Math.min(d, 90 - d); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const cornerDev = (cells) => {
  const out = [];
  for (const c of cells) {
    if (c.n !== 4) continue;
    for (let i = 0; i < 4; i++) {
      const a = c.pts[i], b = c.pts[(i + 1) % 4], d = c.pts[(i + 2) % 4];
      const u = { x: b.x - a.x, z: b.z - a.z }, v = { x: d.x - b.x, z: d.z - b.z };
      const ang = (Math.acos((u.x * v.x + u.z * v.z) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z))) * 180) / Math.PI;
      out.push(Math.abs(ang - 90));
    }
  }
  return median(out);
};
const measure = (grid) => {
  const pl = patchLayout(grid);
  const quads = grid.cells.filter((c) => c.n === 4);
  const axisDev = [];
  for (const c of quads) if (c.family != null) axisDev.push(axisDelta(axis(c.pts), c.family));
  const nbr = [];
  const pts = new Map(quads.map((c) => [c.id, c.pts]));
  for (const c of quads) {
    for (const nb of c.edgeNeighbors) {
      if (nb < 0 || !pts.has(nb)) continue;
      nbr.push(axisDelta(axis(c.pts), axis(pts.get(nb))));
    }
  }
  const inner = pl.edgeKinds.inner || 0;
  const patchEdges = inner + (pl.edgeKinds.patchRim || 0);
  return {
    patchCount: pl.patchCount,
    largest: pl.largest,
    maxSpread: pl.maxSpreadDeg,
    quads: quads.length,
    tris: grid.cells.filter((c) => c.n === 3).length,
    innerShare: patchEdges ? inner / patchEdges : 0,
    axisDev: axisDev.length ? median(axisDev) : null,
    nbrDev: nbr.length ? median(nbr) : null,
    cornerDev: cornerDev(quads),
    singles: pl.patches.filter((p) => p.size === 1).length,
    families: pl.families.map((f) => f.family),
  };
};

console.log('① 默认档（rigid=0）行为不变 —— 旧账锁在这里');
const base = measure(buildMixedGrid({}));
ok('补丁 451 块（旧账）', base.patchCount === 451, `${base.patchCount} 块`);
ok('最大块 24 格（旧账）', base.largest === 24, `${base.largest} 格`);
ok('单格碎片 285 块（旧账）', base.singles === 285, `${base.singles} 块`);
ok('无生成期族向（cell.family 为空）', base.axisDev === null);
ok('邻格轴向差 p50 ≈ 12.7°（逐格各转各的）', Math.abs(base.nbrDev - 12.7) < 1.5, `${f2(base.nbrDev)}°`);
const explicitZero = measure(buildMixedGrid({ rigid: 0 }));
ok('显式 rigid:0 与不传逐项相同', JSON.stringify(explicitZero) === JSON.stringify(base));

console.log('\n② 刚性档（rigid=20 · mergeRate=0.95）—— 对上片内「约 8 块大补丁」');
const rigid = measure(buildMixedGrid({ rigid: 20, mergeRate: 0.95 }));
ok('补丁 8 块（片内约 8 块）', rigid.patchCount === 8, `${rigid.patchCount} 块`);
ok('最大块 ≥ 900 格（片内每块几十格起）', rigid.largest >= 900, `${rigid.largest}/${rigid.quads} 格 = ${f2(100 * rigid.largest / rigid.quads)}%`);
ok('补丁内边占比 ≥ 0.80（补丁缝只占少数）', rigid.innerShare >= 0.8, `${f2(100 * rigid.innerShare)}%`);
ok('单格碎片 ≤ 3 块', rigid.singles <= 3, `${rigid.singles} 块`);
ok('生成期轴向偏差 p50 < 3°（补丁内同朝向）', rigid.axisDev != null && rigid.axisDev < 3, `${f2(rigid.axisDev)}°`);
ok('邻格轴向差 p50 < 5°（旧 12.7°）', rigid.nbrDev < 5, `${f2(rigid.nbrDev)}°`);
ok('族向只有 2 个轴向（0°/30°，三角点阵只能给出这两族）', rigid.families.length === 2, rigid.families.join('/'));
ok('仍有三角过渡带（三角格 > 100）', rigid.tris > 100, `${rigid.tris} 三角格`);

console.log('\n③ 确定性 / 复现');
const again = measure(buildMixedGrid({ rigid: 20, mergeRate: 0.95 }));
ok('同参两次逐项相同', JSON.stringify(again) === JSON.stringify(rigid));
const otherSeed = measure(buildMixedGrid({ rigid: 20, mergeRate: 0.95, seed: 99 }));
ok('换种子仍 ≈8 块（不是钉死一张图）', Math.abs(otherSeed.patchCount - 8) <= 6, `seed 99 → ${otherSeed.patchCount} 块`);
ok('换种子补丁划分不同（largest 变了）', otherSeed.largest !== rigid.largest, `${otherSeed.largest} vs ${rigid.largest}`);

console.log('\n④ 如实（残差，不进断言强度）');
console.log(`  补丁内角偏差 p50 = ${f2(rigid.cornerDev)}°（默认档 ${f2(base.cornerDev)}°）—— 三角点阵单向合并只能得到 60° 菱形，`);
console.log('  松弛后落在 ~64°/116°，片内是正方；这是本轮未收的形制差，不是机制缺口。');
console.log(`  补丁数 ${rigid.patchCount} 对片内约 8，最大块 ${rigid.largest} 格；片内补丁边界是折线三角带，本仓 block 边界是世界坐标方块分块。`);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} · ${pass} passed / ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
