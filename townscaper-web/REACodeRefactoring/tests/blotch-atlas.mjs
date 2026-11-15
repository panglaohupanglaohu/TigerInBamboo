// engine/blotch.js → src/terrain/blotch-atlas.js：图集分布/平铺、共享 World 边缘场、受控渗漏等深收口、漩涡/密度、GLSL 同式。
import assert from 'node:assert/strict';
import { buildQuadGrid } from '../src/core/grid.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { decorateCells, buildCellIndex } from '../src/core/spatial.js';
import { BLOTCH_GLSL } from '../src/terrain/blotch-pattern.js';
import { createBlotchAtlasData, sampleBlotchAtlas, buildBlotchRimField, blotchMasks, swirlUV, blotchRimTint, BLOTCH_RIM_GLSL, blotchRimUniformValues } from '../src/terrain/blotch-atlas.js';

// 1) 图集：Math.imul 哈希分布不被压扁（原版浮点哈希坑：值全落在 0.09~0.39，阈值 0.42 进不去）
const atlas = createBlotchAtlasData();
const R = [], G = [];
for (let i = 0; i < atlas.size * atlas.size; i++) { R.push(atlas.data[i * 4] / 255); G.push(atlas.data[i * 4 + 1] / 255); }
R.sort((a, b) => a - b); G.sort((a, b) => a - b);
const pct = (a, q) => a[Math.floor(a.length * q)];
assert.ok(pct(R, .9) > .60 && pct(R, .1) < .44, `cold channel spans blotch threshold p10=${pct(R, .1)} p90=${pct(R, .9)}`);
assert.ok(pct(G, .9) > .55, 'warm channel reaches its threshold');
const cover = R.filter((v) => v > .52).length / R.length;
assert.ok(cover > .15 && cover < .6, `cold blotch coverage ${cover}`);
// 可平铺：跨贴图边界的相邻差 与 内部相邻差 同量级（周期噪声，没有直线接缝）
let seam = 0, inner = 0; const S = atlas.size;
for (let y = 0; y < S; y++) { seam += Math.abs(atlas.data[(y * S + S - 1) * 4] - atlas.data[(y * S) * 4]); inner += Math.abs(atlas.data[(y * S + 40) * 4] - atlas.data[(y * S + 41) * 4]); }
assert.ok(seam / S < 3 * Math.max(1, inner / S) + 2, `atlas seam ${seam / S} vs inner ${inner / S}`);
assert.deepEqual(sampleBlotchAtlas(atlas, .3, .7).map((v) => +v.toFixed(5)), sampleBlotchAtlas(atlas, 1.3, -.3).map((v) => +v.toFixed(5)), 'repeat wrap');
// 大笔触：冷色块平均直径应远大于一个纹素（低频）—— 一行里阈值穿越次数少
let crossings = 0; for (let x = 1; x < S; x++) if ((atlas.data[(64 * S + x) * 4] > 133) !== (atlas.data[(64 * S + x - 1) * 4] > 133)) crossings++;
assert.ok(crossings <= 14, `blotch crossings per row ${crossings}`);

// 2) 共享 World 边缘场
const grid = decorateCells(buildQuadGrid({ radius: 8 }));
const world = new World(grid); generateTerrain(world, { seed: 3 });
const index = buildCellIndex(grid), L = .5;
const rim = buildBlotchRimField(world, { res: 96, levelHeight: L, index });
assert.equal(rim.version, world.version);
assert.ok(rim.rimCount > 10, 'rim cells exist');
let rimTex = 0, interiorFar = 0, topOk = 0, topN = 0;
for (let i = 0; i < rim.res * rim.res; i++) {
  const id = rim.owner[i]; if (id < 0) continue; const c = grid.cells[id], t = world.top(c);
  if (t > 0) { topN++; if (Math.abs(rim.topY[i] - t * L) < 1e-6) topOk++; }
  if (t > 0 && rim.rimCell[id]) { assert.equal(rim.dist[i], 0); rimTex++; }
  if (t > 0 && !rim.rimCell[id] && rim.dist[i] > .3) interiorFar++;
}
assert.equal(topOk, topN, 'G channel = own top height');
assert.ok(rimTex > 50 && interiorFar > 20, `rim texels ${rimTex}, interior far ${interiorFar}`);
// 每个非崖肩台地格心到最近崖肩的距离 ≈ 栅格距离（chamfer 误差 < 1.5 纹素）
const texel = Math.hypot(1 / rim.xform[2], 1 / rim.xform[3]) / rim.res;
for (const c of grid.cells) {
  if (!world.top(c) || rim.rimCell[c.id]) continue;
  const [d] = rim.sample(c.cx, c.cz); assert.ok(d > 0, 'interior plateau has positive rim distance');
  let best = Infinity; for (const r of grid.cells) if (rim.rimCell[r.id]) for (const p of r.pts) best = Math.min(best, Math.hypot(p.x - c.cx, p.z - c.cz));
  assert.ok(d <= Math.min(rim.maxDist, best) + 1.5 * texel + 1e-6, `chamfer bound ${d} vs ${best}`);
}
// 编辑共享 World：抬起一个内部格 → 版本变化，它和邻居变成崖肩
const inside = grid.cells.find((c) => world.top(c) > 0 && !rim.rimCell[c.id] && c.edgeNeighbors.every((n) => n >= 0 && !rim.rimCell[n]));
assert.ok(inside, 'found interior cell');
world.setSolid(inside, world.top(inside) + 1, true, { rock: true });
const rim2 = buildBlotchRimField(world, { res: 96, levelHeight: L, index });
assert.ok(rim2.version > rim.version && rim2.rimCell[inside.id] === 1);
assert.equal(rim2.sample(inside.cx, inside.cz)[0], 0, 'edited cell is now a rim');

// 3) 受控渗漏：顶面在崖肩前收住；崖面只在贴边处、到 bleed 深度齐平归零（底边是等深线）
assert.equal(blotchMasks({ rimDist: 0, below: 0, normalY: 1 }).rimMask, 0, 'top stops before rim');
assert.equal(blotchMasks({ rimDist: .5, below: 0, normalY: 1 }).rimMask, 1);
const bleed = .14, at = (below, rimDist = 0) => blotchMasks({ rimDist, below, normalY: 0, bleed }).bleedMask;
assert.ok(at(.06) > .5, 'hangs just below rim');
assert.equal(at(bleed), 0); assert.equal(at(bleed + .2), 0); assert.equal(at(0), 0, 'not on the top itself');
for (let d = .04; d < bleed; d += .01) assert.ok(at(d + .01) <= at(d) + 1e-9 || d < .05, 'monotone fade to isodepth');
assert.equal(at(.06, .2), 0, 'no bleed where rim is horizontally far');
assert.equal(blotchMasks({ rimDist: 0, below: .06, normalY: 0, bleed: 0 }).bleedMask, 0, 'bleed=0 disables');

// 4) 漩涡：角度场低频、岛内正负都有（顺/逆时针），旋转保长
const angs = []; for (let x = -8; x <= 8; x += .5) for (let z = -8; z <= 8; z += .5) angs.push(swirlUV(x, z).at(2));
assert.ok(Math.min(...angs) < -.5 && Math.max(...angs) > .5, 'swirl both directions');
const [su, sv] = swirlUV(3, 4, { scale: .1 }); assert.ok(Math.abs(Math.hypot(su, sv) - .5) < 1e-9, 'rotation is length preserving');
assert.deepEqual(swirlUV(3, 4, { swirl: 0, scale: .1 }), [.30000000000000004, .4, 0]);

// 5) 完整调色在真实世界上：顶面崖肩无色块、内部有；密度起伏；崖面渗漏只在 bleed 深度内
let topCov = [], rimCov = [], dens = new Set();
for (const c of grid.cells) {
  const t = world.top(c); if (!t) continue;
  const r = blotchRimTint(atlas, rim2, [c.cx, t * L, c.cz], [0, 1, 0]);
  (rim2.rimCell[c.id] ? rimCov : topCov).push(r.coverage); dens.add(r.density.toFixed(2));
  assert.ok(r.tint.every((v) => Number.isFinite(v) && v > .5 && v < 1.5));
}
assert.ok(rimCov.every((v) => v < 1e-9), 'no top blotch on rim cells (cell centres of rim plateau are within rimDist≈0)');
assert.ok(topCov.some((v) => v > .2), 'interior tops receive blotches');
assert.ok(dens.size > 5, 'variable density');
const cliffCell = grid.cells.find((c) => rim2.rimCell[c.id] && world.top(c) >= 3);
const e = cliffCell.pts[0], top = world.top(cliffCell) * L;
const hang = blotchRimTint(atlas, rim2, [e.x, top - .3, e.z], [1, 0, 0], { bleed: .14 });
assert.equal(hang.bleedMask, 0, 'below bleed depth the cliff stays clean');

// 6) GLSL：函数名不与已有 BLOTCH_GLSL 冲突、uniform 全部声明
for (const fn of ['brHash', 'brNoise', 'brWobble', 'blotchRimTint']) assert.ok(!new RegExp(`\\b${fn}\\b`).test(BLOTCH_GLSL), fn);
const u = blotchRimUniformValues(rim2);
for (const k of Object.keys(u)) assert.ok(BLOTCH_RIM_GLSL.includes(`uniform ${k === 'uBlotchRimSeg' ? 'float' : 'vec4'} ${k};`), k);
assert.throws(() => buildBlotchRimField({}, {}), TypeError);
assert.throws(() => blotchRimUniformValues(rim2, { density: 2 }), RangeError);
console.log(`PASS blotch atlas (cover ${cover.toFixed(2)}, crossings ${crossings}), shared-World rim field (${rim.rimCount} rim cells, edit→rebuild), controlled isodepth bleed, swirl/density, GLSL names`);
