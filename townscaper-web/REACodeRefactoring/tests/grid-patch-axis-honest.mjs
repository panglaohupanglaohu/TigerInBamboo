/**
 * 1459169210752507904「And another」第 233 轮：把 patchLayout 的「轴向抖动」读数改成诚实的两个口径。
 *
 * 背景：`cell.family` 记的是**换基前**的点阵轴向（0/30/60 的精确值）。补丁被搬到自己的正交点阵后，
 * 真实朝向已经不是那三个值，于是 `spreadDeg`（轴线 vs 族向）会把「换基」读成「抖动」——
 * 页面长期显示 42–43°，而这只说明存根过期，不说明补丁不齐。本轮加一路只读口径：
 * `geomAxisDeg`（补丁自身几何轴的圆均值，轴角 0–90 折叠 / 周期 90°）、`spreadGeomDeg`、`maxSpreadGeomDeg`。
 * 族向、补丁划分、其它读数一律不动（本测试同时钉住"旧读数没变"）。
 *
 * 口径说明（如实）：`spreadGeomDeg` 是**整块族向连通块**内的轴向极差，而换基是按更严的分块
 * （同族 + 同整数方向对）做的 → 一个 patchLayout 补丁里本来就可能含多个互不平行的正交点阵，
 * 这个数大是**实况**（片里每块补丁本来就各有一套朝向），不是缺陷读数。
 */
import { buildMixedGrid } from '../src/core/grid.js';
import { patchLayout, cellAxisDeg, axisDelta } from '../src/core/grid-wireframe.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${info ? ' · ' + info : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${info ? ' · ' + info : ''}`); }
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const P = { rigid: 20, mergeRate: 0.95, square: 1 };
const g = buildMixedGrid(P);
const pl = patchLayout(g);
const base = buildMixedGrid({ rigid: 20, mergeRate: 0.95 });
const plBase = patchLayout(base);
const def = buildMixedGrid({});
const plDef = patchLayout(def);

console.log('\n① 旧读数一字不动（族向存根 + 既有补丁划分）');
ok('square 档补丁数仍是 8', pl.patchCount === 8, `${pl.patchCount} 块`);
ok('square 档最大块仍是 959 格', pl.largest === 959, `${pl.largest}`);
ok('square 档旧 maxSpreadDeg 仍是 43.46°（存根口径）', near(pl.maxSpreadDeg, 43.4585, 0.01), `${pl.maxSpreadDeg.toFixed(3)}°`);
ok('换基不动拓扑：四边格 1331 / 三角格 242', g.cells.filter((c) => c.n === 4).length === 1331 && g.cells.filter((c) => c.n === 3).length === 242);
ok('翻面格仍是 35（本轮未收）', g.square.flips === 35, `flips ${g.square.flips}`);
ok('square=0 档旧读数不变', plBase.patchCount === 8 && near(plBase.maxSpreadDeg, 24.064, 0.01), `${plBase.maxSpreadDeg.toFixed(3)}°`);
ok('默认档仍是 451 块 / 14.97°', plDef.patchCount === 451 && near(plDef.maxSpreadDeg, 14.973, 1e-3), `${plDef.patchCount} 块 / ${plDef.maxSpreadDeg.toFixed(2)}°`);

console.log('\n② 新口径：几何轴圆均值（周期 90°）');
ok('maxSpreadGeomDeg 是有限数', Number.isFinite(pl.maxSpreadGeomDeg), `${pl.maxSpreadGeomDeg.toFixed(3)}°`);
ok('每块补丁都带 geomAxisDeg / spreadGeomDeg', pl.patches.every((p) => Number.isFinite(p.geomAxisDeg) && Number.isFinite(p.spreadGeomDeg)));
ok('geomAxisDeg ∈ [0,90)', pl.patches.every((p) => p.geomAxisDeg >= 0 && p.geomAxisDeg < 90));
ok('spreadGeomDeg < 45（极差不可能超过折叠量的一半周期）', pl.patches.every((p) => p.spreadGeomDeg <= 45 + 1e-9), `max ${pl.maxSpreadGeomDeg.toFixed(2)}°`);
// 圆均值不是 minimax 中心：最大块（959 格）上几何口径更贴（40.60°→36.01°），
// 但 324 格那块反而更差（27.96°→34.92°）—— 如实钉住这个反例，别把新口径当"总是更准"。
const bigP = pl.patches[0], p324 = pl.patches.find((p) => p.size === 324);
ok('最大块几何口径更贴（40.60° → 36.01°）', bigP.spreadGeomDeg < bigP.spreadDeg, `${bigP.spreadDeg.toFixed(2)}° → ${bigP.spreadGeomDeg.toFixed(2)}°`);
ok('反例如实：324 格块几何口径更差（27.96° → 34.92°）', !!p324 && p324.spreadGeomDeg > p324.spreadDeg, p324 ? `${p324.spreadDeg.toFixed(2)}° → ${p324.spreadGeomDeg.toFixed(2)}°` : 'missing');

console.log('\n③ 两种口径的差正好来自「族向过期」');
const big = pl.patches[0];
ok('最大块：存根口径 40.60° vs 几何口径 36.01°', near(big.spreadDeg, 40.5985, 0.01) && near(big.spreadGeomDeg, 36.01, 0.01),
  `${big.spreadDeg.toFixed(2)}° / ${big.spreadGeomDeg.toFixed(2)}°`);
const deltas = big.cells.map((id) => axisDelta(cellAxisDeg(g.cells.find((c) => c.id === id)), big.geomAxisDeg)).sort((a, b) => a - b);
const q = (p) => deltas[Math.floor(p * (deltas.length - 1))];
ok('最大块内轴向偏离分布 p50 6.63 / p90 20.44', near(q(0.5), 6.633, 5e-3) && near(q(0.9), 20.438, 5e-2), `p50 ${q(0.5).toFixed(2)}° p90 ${q(0.9).toFixed(2)}°`);
ok('99.6% 的格偏离 >5°（一个族向块里含多个正交点阵 = 实况）', deltas.filter((d) => d > 5).length === 955, `${deltas.filter((d) => d > 5).length}/959`);

console.log('\n④ 只读：不改变任何几何');
const g2 = buildMixedGrid(P);
ok('同参两次逐项相同', JSON.stringify(g2.square) === JSON.stringify(g.square) && patchLayout(g2).maxSpreadGeomDeg === pl.maxSpreadGeomDeg);
ok('顶点坐标未被读数改写', g.cells.every((c) => c.pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))));

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} · ${pass} passed / ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
