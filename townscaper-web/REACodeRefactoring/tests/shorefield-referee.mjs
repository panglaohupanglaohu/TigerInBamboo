// shorefield-referee.mjs — 1664566546683899905 残差核销：独立原版 buildShoreDistance API 移植的裁判对照。
// 裁判 = 只读 ../../REACode/engine/shorefield.js（原版实现原样跑，它内部用 REACode/src/town.js 的
// buildCellIndex 桶4/3×3邻域 与 4 角 pointInQuad）。本侧 = src/water/shorefield.js（逐式移植，
// 内部用 core/spatial.js 的 buildCellIndex 桶2/所在桶 与 n 角 pointInQuad；两者在四边形网格上
// 返回同一候选超集，逐值应相等）。
// 结论（2026-11-25 实测，见下方 console.log）：两套真实双网格上 sample/march 逐位一致（maxDiff=0）、
// 两种 Town 实现结果一致、重跑逐位一致；shore 消费路径（traceShoreLoops + sampleShoreline + march）
// 端点落在 field≈target 上。
import assert from 'node:assert/strict';
import { buildGrid as buildRefGrid } from '../../REACode/src/grid.js';
import { Town as RefTown, decorateCells as refDecorate } from '../../REACode/src/town.js';
import { buildShoreDistance as referee } from '../../REACode/engine/shorefield.js';
import { buildShoreDistance } from '../src/water/shorefield.js';
import { buildQuadGrid, buildMixedGrid } from '../src/core/grid.js';
import { decorateCells } from '../src/core/spatial.js';
import { Town } from '../src/core/town-graph.js';
import { traceShoreLoops } from '../src/core/shore-loops.js';
import { sampleShoreline } from '../src/core/shore-profile.js';

/** 同一网格喂两种 Town：裁判 Town（REACode/src/town.js）与共享 World 的 core/town-graph Town。 */
function makeTowns(grid, isLand) {
  const ref = new RefTown(grid), local = new Town(grid);
  let n = 0;
  for (const c of grid.cells) if (isLand(c)) { ref.setSolid(c, 1, true); local.setSolid(c, 1, true); n++; }
  return { ref, local, landCells: n };
}

// 带深湾的岛：主岛圆盘挖一条朝 +x 开口的窄湾，外加一颗远处独石（岬角收紧 / 湾内放宽两个方向都要验）。
const islandWithBay = (c) => {
  const r = Math.hypot(c.cx, c.cz);
  if (r >= 3.6) return false;
  if (c.cx > 0.4 && Math.abs(c.cz) < 0.85) return false;   // 窄湾，~1.7 宽、3.2 深
  return true;
};
const islet = (c) => Math.hypot(c.cx - 6.2, c.cz + 1.5) < 0.6;
const land = (c) => islandWithBay(c) || islet(c);

/** 全场栅格上逐点对比 sample；maxDiff 取绝对值最大者，n 为采样点数。 */
function compareSamples(a, b, { step = 0.05 } = {}) {
  let maxDiff = 0, n = 0;
  for (let z = a.origin.z; z <= a.origin.z + a.size; z += step) {
    for (let x = a.origin.x; x <= a.origin.x + a.size; x += step) {
      const d = Math.abs(a.sample(x, z) - b.sample(x, z));
      if (d > maxDiff) maxDiff = d;
      n++;
    }
  }
  return { maxDiff, n };
}

/* ---------- A. 裁判自己的真实双网格（抖动四边形对偶网） ---------- */
const gridA = refDecorate(buildRefGrid({ radius: 6, hexSize: 0.9 }));
const townsA = makeTowns(gridA, land);
const refA = referee(townsA.ref, gridA, { res: 0.12 });
const ourA = buildShoreDistance(townsA.local, gridA, { res: 0.12 });
assert.equal(ourA.res, refA.res);
assert.equal(ourA.origin.x, refA.origin.x);
assert.equal(ourA.origin.z, refA.origin.z);
assert.equal(ourA.size, refA.size);
assert.equal(ourA.w, ourA.h, '原版场是正方形（size = max 跨度 + 2·pad）');
const cmpA = compareSamples(refA, ourA);
console.log('A referee dual mesh:', { cells: gridA.cells.length, land: townsA.landCells, w: ourA.w, ...cmpA });
assert.equal(cmpA.maxDiff, 0, 'A: sample 应与裁判逐位一致');

// march 逐值对照：岸环法线方向 + 场内的随意射线
const marchesA = [];
for (let i = 0; i < 64; i++) {
  const t = (i / 64) * Math.PI * 2;
  marchesA.push([Math.cos(t) * 3.0, Math.sin(t) * 3.0, Math.cos(t), Math.sin(t), 0.5, 4]);
  marchesA.push([Math.cos(t) * 3.0, Math.sin(t) * 3.0, -Math.cos(t), -Math.sin(t), 0.3, 4]);
}
let marchDiff = 0;
for (const [x, z, nx, nz, target, max] of marchesA) {
  const d = Math.abs(refA.march(x, z, nx, nz, target, max) - ourA.march(x, z, nx, nz, target, max));
  marchDiff = Math.max(marchDiff, d);
}
assert.equal(marchDiff, 0, 'A: march 应与裁判逐位一致');

/* ---------- B. 本仓真实双网格（buildQuadGrid，buildShore 实际消费的格形） ---------- */
const gridB = decorateCells(buildQuadGrid({ radius: 9, hexSize: 0.8 }));
const townsB = makeTowns(gridB, land);
const refB = referee(townsB.ref, gridB, { res: 0.12 });
const ourB = buildShoreDistance(townsB.local, gridB, { res: 0.12 });
const cmpB = compareSamples(refB, ourB);
console.log('B local quad dual mesh:', { cells: gridB.cells.length, land: townsB.landCells, w: ourB.w, ...cmpB });
assert.equal(cmpB.maxDiff, 0, 'B: sample 应与裁判逐位一致');
let marchDiffB = 0;
for (const [x, z, nx, nz, target, max] of marchesA) {
  const d = Math.abs(refB.march(x, z, nx, nz, target, max) - ourB.march(x, z, nx, nz, target, max));
  marchDiffB = Math.max(marchDiffB, d);
}
assert.equal(marchDiffB, 0, 'B: march 应与裁判逐位一致');

/* ---------- C. 确定性 + 两种 Town 实现可互换 ---------- */
const ourA2 = buildShoreDistance(townsA.local, gridA, { res: 0.12 });
const ourARefTown = buildShoreDistance(townsA.ref, gridA, { res: 0.12 });
assert.equal(compareSamples(ourA, ourA2, { step: 0.09 }).maxDiff, 0, '确定性：重跑逐位一致');
assert.equal(compareSamples(ourA, ourARefTown, { step: 0.09 }).maxDiff, 0, 'Town 实现可互换（都只读 top）');

/* ---------- D. 与现有 shore 消费兼容：traceShoreLoops → sampleShoreline → march ---------- */
// shore.js / 原版 waves.js 的消费形状：岸环点沿外法线 march 到 field=target 得到蓝线。
const loops = traceShoreLoops(gridB.cells, (c) => townsB.local.top(c) > 0);
assert.ok(loops.length >= 2, '主岛外环 + 湾内/独石环');
let pts = 0, maxResid = 0, capped = 0;
for (const loop of loops) {
  const ring = loop.map((seg, i) => {
    const prev = loop[(i + loop.length - 1) % loop.length];
    const nx = seg.nx + prev.nx, nz = seg.nz + prev.nz, l = Math.hypot(nx, nz);
    return { x: seg.a.x, z: seg.a.z, nx: l > 1e-9 ? nx / l : seg.nx, nz: l > 1e-9 ? nz / l : seg.nz };
  });
  for (const p of sampleShoreline(ring)) {
    const d = ourB.march(p.x, p.z, p.nx, p.nz, 0.7, 2.1);
    assert.ok(Number.isFinite(d) && d >= 0 && d <= 2.1);
    if (d >= 2.1) capped++;                       // 对岸陆地压住时封顶（原版同样返回 maxTravel）
    else maxResid = Math.max(maxResid, Math.abs(ourB.sample(p.x + p.nx * d, p.z + p.nz * d) - 0.7));
    pts++;
  }
}
console.log('D shore consumer path:', { loops: loops.length, pts, capped, maxResid });
assert.ok(pts > 40);
assert.ok(maxResid < 1e-3, `march 端点应落在 field≈target（maxResid=${maxResid}）`);

/* ---------- E. 边界与防御 ---------- */
const emptyTowns = makeTowns(gridA, () => false);
const refE = referee(emptyTowns.ref, gridA, { res: 0.12 });
const ourE = buildShoreDistance(emptyTowns.local, gridA, { res: 0.12 });
assert.equal(compareSamples(refE, ourE, { step: 0.4 }).maxDiff, 0, '无陆地：全 INF 场也与裁判一致');
assert.equal(ourE.march(0, 0, 1, 0, 2e9, 4), 4, '全场都够不到 target → maxTravel（原版口径）');
assert.equal(refE.march(0, 0, 1, 0, 2e9, 4), 4);
assert.equal(ourE.march(0, 0, 1, 0, 0.5, 4), 0, '起点已 ≥ target → 0（原版口径：bisect [0,0]）');
assert.equal(refE.march(0, 0, 1, 0, 0.5, 4), 0);
assert.equal(ourA.sample(0, 0), 0, '陆地内距离 0');
assert.equal(ourA.sample(1e4, 1e4), 1e9, '场域外 = 1e9（原版口径）');
assert.throws(() => buildShoreDistance(townsA.local, gridA, { res: 0 }), RangeError);
assert.throws(() => buildShoreDistance(townsA.local, gridA, { res: 0.12, pad: -1 }), RangeError);
assert.throws(() => buildShoreDistance(townsA.local, { cells: [] }), RangeError);
assert.throws(() => buildShoreDistance(townsA.local, { cells: [{ id: 0, pts: [] }] }), RangeError);

/* ---------- F. 超出裁判范围：三角/四方混合双网格（裁判 pointInQuad 写死4角会崩，本侧按n角巡边） ---------- */
const gridM = decorateCells(buildMixedGrid({ radius: 8, hexSize: 0.9 }));
assert.ok(gridM.triangles > 0 && gridM.cells.some((c) => c.n === 3), '混合网里确有三角格');
const townsM = makeTowns(gridM, land);
const ourM = buildShoreDistance(townsM.local, gridM, { res: 0.12 });
assert.ok(ourM.sample(0, 0) === 0 && ourM.sample(4.5, 0) > 0 && Number.isFinite(ourM.march(2.5, 0, 1, 0, 0.5, 2)),
  '混合双网格上场可用');

console.log('PASS referee parity: sample/march bitwise on both dual meshes, deterministic, Town-interchangeable, shore-consumer endpoints on field');
