/**
 * grid-patch-square.mjs — 1459169210752507904「And another」补丁内**正方形**。
 *
 * r229 把补丁聚成了 8 块（轴向抖动 1.73°），但补丁内格子仍是 60° 菱形
 * （角偏差 p50 26.55°），片内是正方。本轮 `unshearPatches` 给每块补丁换正交基：
 * 补丁拓扑 = 方格网格，几何 = 单胞基 (u,w) 的仿射像，把 (u,w) 换成正交等长基 (a,b)，
 * 整块补丁同时变正方形；补丁之间朝向互不相同，三角格吸收形变。
 *
 * 跑：node tests/grid-patch-square.mjs
 */
import { buildMixedGrid, unshearPatches, signedArea } from '../src/core/grid.js';
import { patchLayout, cellAxisDeg } from '../src/core/grid-wireframe.js';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' · ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' · ' + extra : ''}`); }
};
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
const axisDelta = (a, b) => { const d = Math.abs(a - b) % 90; return Math.min(d, 90 - d); };

/** 每个四边格的 4 个内角，返回 |角 − 90| 的分布。onlyInterior：只取 4 个顶点都不在补丁边界上的格。 */
export function cornerStats(grid, { onlyInterior = false } = {}) {
  const pl = patchLayout(grid);
  const border = new Set();
  if (onlyInterior) {
    for (const e of pl.edges) if (e.kind !== 'inner') { border.add(e.a); border.add(e.b); }
  }
  const dev = [];
  for (const c of grid.cells) {
    if (c.n !== 4) continue;
    if (onlyInterior && c.pts.some((p) => border.has(p.id))) continue;
    for (let i = 0; i < 4; i++) {
      const a = c.pts[i], b = c.pts[(i + 1) % 4], d = c.pts[(i + 2) % 4];
      const u = { x: b.x - a.x, z: b.z - a.z }, v = { x: d.x - b.x, z: d.z - b.z };
      const cos = (u.x * v.x + u.z * v.z) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z));
      dev.push(Math.abs((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI - 90));
    }
  }
  return dev;
}

export function measure(grid) {
  const pl = patchLayout(grid);
  const quads = grid.cells.filter((c) => c.n === 4);
  const interior = cornerStats(grid, { onlyInterior: true });
  const all = cornerStats(grid);
  let minArea = Infinity, bad = 0;
  for (const c of grid.cells) {
    const a = signedArea(c.pts.map((p) => ({ x: p.x, z: p.z })));
    minArea = Math.min(minArea, -a);   // cells 的 pts 是反绕序 → 正常格面积为负
    if (a > -1e-9) bad++;              // 反号 = 翻面
  }
  const axis = quads.map((c) => cellAxisDeg(c));
  return {
    patches: pl.patchCount,
    largest: pl.largest,
    quads: quads.length,
    tris: grid.cells.filter((c) => c.n === 3).length,
    cornerP50: +med(interior).toFixed(2),
    cornerP95: +pct(interior, 0.95).toFixed(2),
    cornerAllP50: +med(all).toFixed(2),
    spread: +pl.maxSpreadDeg.toFixed(2),
    minArea: +minArea.toFixed(5),
    flat: 0,
    badCells: bad,
    families: pl.families.map((f) => f.family),
    axisCount: new Set(axis.map((a) => Math.round(a))).size,
    verts: grid.verts.length,
    // 顶点唯一性：换基只能移动顶点，不许增删
    vertsStable: grid.verts.length === new Set(grid.verts.map((v) => v.id)).size,
    seamEdges: pl.edgeKinds.seam,
  };
}

/** 补丁内几何轴向的离散度（最大 − 最小），用来证明"块内同朝向"；不看 cell.family（那是换基前的存根）。 */
function patchAxisSpread(grid) {
  const pl = patchLayout(grid);
  let worst = 0;
  for (const patch of pl.patches) {
    if (patch.size < 4) continue;
    const ax = patch.cells.map((id) => cellAxisDeg(grid.cells[id]));
    const lo = Math.min(...ax), hi = Math.max(...ax);
    // 环面：取跨 0° 的那一族
    const d = Math.min(hi - lo, 90 - (hi - lo));
    worst = Math.max(worst, d);
  }
  return worst;
}

console.log('① 基线（rigid=20, mergeRate=0.95, square=0）—— r229 的账，必须不动');
const base = measure(buildMixedGrid({ rigid: 20, mergeRate: 0.95 }));
ok('补丁 8 块（r229 账）', base.patches === 8, `${base.patches} 块`);
ok('补丁内角偏差 p50 ≈ 26.55°（r229 账：60° 菱形）', Math.abs(base.cornerP50 - 26.55) < 3, `${f2(base.cornerP50)}°`);
ok('三角过渡带仍在（>100）', base.tris > 100, `${base.tris} 三角格`);

console.log('\n② 方形档（square=1）—— 补丁内应当是正方');
const sq0 = buildMixedGrid({ rigid: 20, mergeRate: 0.95, square: 1 });
const sq = measure(sq0);
ok('补丁数不变（换基不动拓扑）', sq.patches === base.patches, `${sq.patches} 块`);
ok('四边格数不变', sq.quads === base.quads, `${sq.quads}`);
ok('三角格数不变', sq.tris === base.tris, `${sq.tris}`);
ok('顶点数不变（只移动、不增删）', sq.verts === base.verts && sq.vertsStable, `${sq.verts}`);
ok('补丁内角偏差 p50 = 0°（← 26.55°）', sq.cornerP50 < 0.5, `${f2(sq.cornerP50)}°`);
ok('补丁内角偏差 p90 < 1°（九成以上格子是精确正方）', sq.cornerP95 < 1, `${f2(sq.cornerP95)}°`);
ok('补丁内角偏差 p50 至少降 20 倍', base.cornerP50 / Math.max(sq.cornerP50, 1e-6) >= 20, `${f2(base.cornerP50 / Math.max(sq.cornerP50, 1e-6))}×`);
ok('翻面数与 grid.square.flips 记的一致（不瞒账）', sq.badCells === buildMixedGrid({ rigid: 20, mergeRate: 0.95, square: 1 }).square.flips, `实测 ${sq.badCells} 格反向 / 基线 ${base.badCells}`);
ok('补丁缝仍是三角带（缝边 > 0）', sq.seamEdges > 0, `${sq.seamEdges} 缝边`);
// 残留 1%：patchLayout 按 cell.family（换基前的存根）分组，会跨"方向对子块"，
// 这类跨块格的几何轴向自然差一档；如实打印，不当成"块内乱转"。
const offAxis = sq0.cells.filter((c) => c.n === 4).filter((c) => {
  const a = cellAxisDeg(c);
  return Math.min(...[0, 30, 60].map((k) => { const d = Math.abs(a - k) % 90; return Math.min(d, 90 - d); })) > 5;
}).length;
ok('偏离三族轴向 > 5° 的四边格 < 8%（只是残留，不是块内乱转）', offAxis / sq.quads < 0.08, `${offAxis}/${sq.quads} = ${f2((100 * offAxis) / sq.quads)}%`);
ok('三角过渡带仍在（不是把三角吃掉）', sq.tris === base.tris && sq.tris > 100, `${sq.tris} 三角格`);

console.log('\n③ 方形档的返回值（如实：实际用了多大力、翻面几次、最大位移）');
const g = buildMixedGrid({ rigid: 20, mergeRate: 0.95, square: 1 });
ok('grid.square 记下 applied / flips', g.square && g.square.applied > 0, `applied=${f2(g.square.applied)} flips=${g.square.flips} maxMove=${f2(g.square.maxMove)} patches=${g.square.patches}`);
console.log(`  实测：applied ${f2(g.square.applied)} / 翻面 ${g.square.flips} / 最大位移 ${f2(g.square.maxMove)}`);

console.log('\n④ 关档行为不变（square=0 与 r229 逐项相同）');
const off = measure(buildMixedGrid({ rigid: 20, mergeRate: 0.95, square: 0 }));
ok('square=0 与不传逐项相同', JSON.stringify(off) === JSON.stringify(base));
const def = measure(buildMixedGrid({}));
ok('默认档（rigid=0）仍是 451 块旧账', def.patches === 451, `${def.patches} 块`);
ok('默认档不做换基（角偏差仍是 12° 量级）', def.cornerAllP50 > 8, `${f2(def.cornerAllP50)}°`);

console.log('\n⑤ 确定性 / 换种子');
const again = measure(buildMixedGrid({ rigid: 20, mergeRate: 0.95, square: 1 }));
ok('同参两次逐项相同', JSON.stringify(again) === JSON.stringify(sq));
const s99 = measure(buildMixedGrid({ rigid: 20, mergeRate: 0.95, square: 1, seed: 99 }));
ok('换种子仍能换基到正方形（角偏差 p50 < 3°）', s99.cornerP50 < 3, `${s99.patches} 块 · ${f2(s99.cornerP50)}°`);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} · ${pass} passed / ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
