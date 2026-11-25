// r74 补学「每层地被」残差：分层草型参数按层/表面型区分 + 雨生态色组 + 共享 leaf atlas。
// 只读裁判 = ../../REACode/src/levelflora.js（buildTerrain/buildFlora/measure 原样跑，
// 提取 presence/丛内数/半径/缩放四组分布当对照；表面型密度与雨生态色组是本地近似）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const judge = await import('../../REACode/src/levelflora.js');
const { levelFloraSpecies, levelFloraRanks, levelFloraCluster, LEVEL_SPECIES, FLORA_JUDGE, FLORA_SURFACES, SURFACE_DENSITY, FLORA_SHAPE_SCALE, RAIN_COLORS, RAIN_CROWN, FLORA_ECOLOGIES } = await import('../src/core/level-flora.js');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells, pointInQuad } = await import('../src/core/spatial.js');
const { Vegetation } = await import('../src/life/vegetation.js');
const { FloraSpecies, SPECIES_SHAPES } = await import('../src/life/flora-species.js');
const { sharedLeafTexture, makeLeafSurface } = await import('../src/life/leaf-surface.js');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/* ---------- 1) 只读裁判参数实测（REACode/src/levelflora.js 原样跑） ---------- */
const terr = judge.buildTerrain(18, 7), jf = judge.buildFlora(terr, { mode: 'perLevel' }), JM = judge.measure(terr, jf);
for (const cl of jf.clusters) {
  assert.ok(cl.items.length >= FLORA_JUDGE.items[0] && cl.items.length <= FLORA_JUDGE.items[1], '裁判丛内数 4–9');
  assert.ok(cl.rad >= FLORA_JUDGE.radius[0] - 1e-9 && cl.rad <= FLORA_JUDGE.radius[1] + 1e-9, '裁判半径 .20–.46');
  for (const it of cl.items) assert.ok(it.s >= FLORA_JUDGE.scale[0] - 1e-9 && it.s <= FLORA_JUDGE.scale[1] + 1e-9, '裁判缩放 .55–1.25');
}
const jPresence = jf.clusters.length / JM.landCells;
const jItems = mean(jf.clusters.map((c) => c.items.length));
const jRad = mean(jf.clusters.map((c) => c.rad));
const jScale = mean(jf.clusters.flatMap((c) => c.items.map((i) => i.s)));
assert.ok(jPresence > .3 && jPresence < .55, '裁判 presence ≈ .43: ' + jPresence);

/* ---------- 2) levelFloraCluster 纯函数 ---------- */
for (let rank = 0; rank < 6; rank++) for (let id = 0; id < 200; id++) {
  const cl = levelFloraCluster(rank, id);
  const sp = levelFloraSpecies(rank, id);
  assert.equal(cl.key, sp.key, '成丛物种与该格物种同键');
  assert.equal(cl.shape, sp.shape); assert.deepEqual(cl.colors, sp.colors);
  assert.ok(cl.count >= 4 && cl.count <= 9 && cl.radius >= .2 - 1e-9 && cl.radius <= .46 + 1e-9);
  assert.equal(cl.items.length, cl.count);
  for (const it of cl.items) { assert.ok(Math.hypot(it.dx, it.dz) <= .46 + 1e-9); assert.ok(it.scale >= .55 - 1e-9 && it.scale <= 1.25 + 1e-9); }
  assert.deepEqual(levelFloraCluster(rank, id), cl, '确定性');
}
assert.equal(levelFloraCluster(9, 3).key, levelFloraCluster(3, 3).key, '4 级以上复用顶层物种组');
for (const bad of [{ rank: -1 }, { surface: 'sky' }, { ecology: 'acid' }, { density: -1 }]) {
  const { rank = 0, surface = 'interior', ecology = 'meadow', density } = bad;
  assert.throws(() => levelFloraCluster(rank, 0, { surface, ecology, density }), JSON.stringify(bad));
}
// 每个物种键都能被某层某格取到（形状图例覆盖 8 物种 / 6 形）
const seenKeys = new Set(); for (let id = 0; id < 400; id++) for (let r = 0; r < 4; r++) seenKeys.add(levelFloraCluster(r, id).key);
assert.equal(seenKeys.size, 8); for (const k of seenKeys) assert.ok(SPECIES_SHAPES.includes(LEVEL_SPECIES[k].shape));

/* ---------- 3) 合成 World：分层 + 表面型 + 裁判偏差 ---------- */
const grid = buildQuadGrid({ radius: 7, seed: 3 }); decorateCells(grid);
const world = new World(grid);
for (const c of world.cells) { const r = Math.hypot(c.cx, c.cz); if (r < 6.5) world.fill(c, r < 1.8 ? 8 : r < 3.4 ? 6 : r < 5 ? 4 : 2, { rock: true }); }
const kindOk = (c) => { const g = world.ground(c); return g > 1 && world.top(c) === g && !world.river[c.id]; };
const surfaceOf = (c) => { const g = world.ground(c); let lo = Infinity; for (let i = 0; i < c.n; i++) { const o = world.neighbor(c, i); lo = Math.min(lo, o ? world.top(o) : 0); } return g <= 2 && lo <= 1 ? 'shore' : lo < g ? 'edge' : 'interior'; };
const ranks = levelFloraRanks(world.cells.map((c) => (kindOk(c) ? world.ground(c) : 0)));
assert.equal(ranks.size, 4, '4 个草层');
const surfCount = { interior: 0, edge: 0, shore: 0 };
const agg = { present: 0, cells: 0, counts: [], rads: [], scales: [], bySurface: { interior: [0, 0], edge: [0, 0], shore: [0, 0] }, perLevel: new Map() };
for (const c of world.cells) {
  if (!kindOk(c)) continue;
  const g = world.ground(c), s = surfaceOf(c), rank = ranks.get(g);
  surfCount[s]++; agg.cells++; agg.bySurface[s][1]++;
  const cl = levelFloraCluster(rank, c.id, { surface: s });
  if (!agg.perLevel.has(rank)) agg.perLevel.set(rank, new Set());
  agg.perLevel.get(rank).add(cl.key);
  if (!cl.present) continue;
  agg.present++; agg.bySurface[s][0]++; agg.counts.push(cl.count); agg.rads.push(cl.radius); agg.scales.push(...cl.items.map((i) => i.scale));
}
assert.ok(surfCount.edge > 0 && surfCount.interior > 0, '边/内部两类表面都存在 ' + JSON.stringify(surfCount));
const pShore = agg.bySurface.shore[1] ? agg.bySurface.shore[0] / agg.bySurface.shore[1] : 0;
const pInner = agg.bySurface.interior[0] / agg.bySurface.interior[1];
assert.ok(pShore >= pInner, `临水 presence ${pShore} ≥ 内部 ${pInner}`);
for (const [rank, set] of agg.perLevel) { assert.ok(set.size <= 2, '每级至多两物种'); for (const k of set) assert.ok(LEVEL_SPECIES[k], k); }
const byLevelSets = [...agg.perLevel.values()];
for (let i = 0; i < byLevelSets.length; i++) for (let j = i + 1; j < byLevelSets.length; j++) assert.ok(![...byLevelSets[i]].some((k) => byLevelSets[j].has(k)), '层间物种不共用（草型=层高图例）');
// 裁判偏差（不同 RNG → 比分布阈值）
const ourPresence = agg.present / agg.cells;
assert.ok(Math.abs(ourPresence - jPresence) <= .12, `presence ${ourPresence} vs 裁判 ${jPresence}`);
assert.ok(Math.abs(mean(agg.counts) - jItems) <= .4, `items ${mean(agg.counts)} vs ${jItems}`);
assert.ok(Math.abs(mean(agg.rads) - jRad) <= .04, `radius ${mean(agg.rads)} vs ${jRad}`);
assert.ok(Math.abs(mean(agg.scales) - jScale) <= .1, `scale ${mean(agg.scales)} vs ${jScale}`);

/* ---------- 4) 雨生态色组（近似） ---------- */
assert.deepEqual(FLORA_ECOLOGIES, ['meadow', 'rain']);
assert.equal(Object.keys(RAIN_COLORS).length, 8);
for (let id = 0; id < 50; id++) {
  const dry = levelFloraSpecies(1, id), wet = levelFloraSpecies(1, id, { ecology: 'rain' });
  assert.equal(wet.key, dry.key); assert.equal(wet.shape, dry.shape, '雨生态不换物种键/形状');
  assert.notDeepEqual(wet.colors, dry.colors); assert.deepEqual(wet.colors, [...RAIN_COLORS[wet.key]]);
}
assert.ok(RAIN_CROWN.length >= 3);

/* ---------- 5) Vegetation 实际 World 路径 ---------- */
const shapeTerrainNull = null;
const veg = new Vegetation({ scene: new THREE.Scene(), levelHeight: .5, uTime: { value: 0 } });
// 5a) 基线：关状态逐字节
veg.refresh(world, shapeTerrainNull, {}, 11);
const baseMat = Array.from(veg.tufts.instanceMatrix.array), baseCol = Array.from(veg.tuftColor.array), baseCount = veg.tufts.count;
// 5b) levelFlora + levelFloraShapes：颜色来自物种色组，scale y/x 比来自 FLORA_SHAPE_SCALE
veg.levelFlora = true; veg.levelFloraShapes = true; veg.refresh(world, shapeTerrainNull, {}, 11);
const specByCell = new Map(veg.floraSpecies.map((r) => [r.cell, r]));
// 一丛可达 2–3 格：边上丛会溢进邻格（原片也是整丛跨格、不按格碎），所以允许
// 「本格或其边/角邻格的物种比例」，但必须是某个物种的比例（不是通用 1:1）。
const allowedRatios = (cell) => new Set([cell, ...cell.edgeNeighbors.filter((id) => id >= 0).map((id) => world.cells[id]), ...cell.cornerNeighbors.map((id) => world.cells[id])]
  .map((c) => specByCell.get(c.id)).filter(Boolean).map((r) => { const w = FLORA_SHAPE_SCALE[r.shape]; return w.y / w.xz; }));
const mat = new THREE.Matrix4(), pos = new THREE.Vector3(), col = new THREE.Color();
let ratioChecked = 0, colorChecked = 0; const ratioSeen = new Set();
for (let i = 0; i < veg.tufts.count; i++) {
  veg.tufts.getMatrixAt(i, mat); pos.setFromMatrixPosition(mat);
  const cell = world.cells.find((c) => pointInQuad(c.pts, pos.x, pos.z));
  if (!cell || !specByCell.has(cell.id)) continue;
  const sx = Math.hypot(mat.elements[0], mat.elements[1], mat.elements[2]), sy = Math.hypot(mat.elements[4], mat.elements[5], mat.elements[6]);
  const ratio = sy / sx;
  assert.ok([...allowedRatios(cell)].some((w) => Math.abs(ratio - w) < .02), `${cell.id} y/x=${ratio.toFixed(2)} not a neighbour species factor`); ratioChecked++;
  ratioSeen.add(+ratio.toFixed(2));
  const sp = specByCell.get(cell.id);
  const got = [veg.tuftColor.getX(i), veg.tuftColor.getY(i), veg.tuftColor.getZ(i)];
  if ([LEVEL_SPECIES[sp.key].col, LEVEL_SPECIES[sp.key].hi].some((h) => { col.set(h); return Math.abs(col.r - got[0]) + Math.abs(col.g - got[1]) + Math.abs(col.b - got[2]) < 1e-5; })) colorChecked++;
}
assert.ok(ratioChecked > 30 && colorChecked > 10, `ratio ${ratioChecked} color ${colorChecked}`);
assert.ok(ratioSeen.size >= 4, '多种物种比例上场 ' + JSON.stringify([...ratioSeen]));
// 5c) 雨生态：草丛色 = RAIN_COLORS，树冠色 = RAIN_CROWN
veg.floraEcology = 'rain'; veg.refresh(world, shapeTerrainNull, {}, 11);
const rainColorsOf = (cell) => new Set([cell, ...cell.edgeNeighbors.filter((id) => id >= 0).map((id) => world.cells[id]), ...cell.cornerNeighbors.map((id) => world.cells[id])]
  .map((c) => specByCell.get(c.id)).filter(Boolean).flatMap((r) => RAIN_COLORS[r.key]));
let rainChecked = 0;
for (let i = 0; i < veg.tufts.count; i++) {
  veg.tufts.getMatrixAt(i, mat); pos.setFromMatrixPosition(mat);
  const cell = world.cells.find((c) => pointInQuad(c.pts, pos.x, pos.z));
  if (!cell || !specByCell.has(cell.id)) continue;
  const got = [veg.tuftColor.getX(i), veg.tuftColor.getY(i), veg.tuftColor.getZ(i)];
  assert.ok([...rainColorsOf(cell)].some((h) => { col.set(h); return Math.abs(col.r - got[0]) + Math.abs(col.g - got[1]) + Math.abs(col.b - got[2]) < 1e-5; }), `${cell.id} 雨生态色不属本格/邻格物种`);
  rainChecked++;
}
assert.ok(rainChecked > 30, '雨生态草丛色 ' + rainChecked);
if (veg.crowns[0].m.count + veg.crowns[1].m.count + veg.crowns[2].m.count > 0) {
  const anyCrown = veg.crowns.flatMap((c) => c.m).find((m2) => m2.count > 0 && m2.instanceColor);
  if (anyCrown) { const got = [anyCrown.instanceColor.getX(0), anyCrown.instanceColor.getY(0), anyCrown.instanceColor.getZ(0)]; assert.ok(RAIN_CROWN.some((h) => { col.set(h); return Math.abs(col.r - got[0]) + Math.abs(col.g - got[1]) + Math.abs(col.b - got[2]) < 1e-5; }), '雨生态紫树冠'); }
}
veg.setTimeOfDay('rain'); assert.ok(veg.uLight.value < 1 && veg.uLight.value > .4, '雨景光照挡位');
// 5d) 关档完全还原（落点矩阵逐字节、色组还原、层数不变）
veg.levelFlora = false; veg.levelFloraShapes = false; veg.floraEcology = 'meadow'; veg.refresh(world, shapeTerrainNull, {}, 11);
assert.equal(veg.tufts.count, baseCount); assert.deepEqual(Array.from(veg.tufts.instanceMatrix.array), baseMat, '关档矩阵逐字节还原');
assert.deepEqual(Array.from(veg.tuftColor.array), baseCol, '关档颜色逐字节还原');

/* ---------- 6) FloraSpecies：成丛 + 表面型 + 共享 leaf atlas 单例 ---------- */
const veg2 = new Vegetation({ scene: new THREE.Scene(), levelHeight: .5, uTime: { value: 0 } });
const fs = new FloraSpecies({ vegetation: veg2 });
assert.ok(veg2.leafSurface.shared, 'leafSurface 共享标记');
assert.equal(veg2.leafSurface.texture, sharedLeafTexture().texture, 'Vegetation 绑进程级单例纹理');
assert.equal(makeLeafSurface().texture, sharedLeafTexture().texture, '共享纹理单例不被新建破坏');
for (const s of SPECIES_SHAPES) assert.equal(fs.meshes[s].material.alphaToCoverage, true, s + ' 物种材质绑了共享叶图集支路');
fs.setModes({ levelFlora: true });
assert.equal(veg2.floraEcology, 'meadow');
const s1 = fs.rebuild(world, null);
const total = Object.values(s1.counts).reduce((a, b) => a + b, 0);
assert.ok(total > 200 && s1.absentCells > 0, `成丛总数 ${total} 空格 ${s1.absentCells}`);
assert.ok(s1.absentCells + s1.cells <= agg.cells, 'present+absent ≤ 候选格');
assert.ok(SPECIES_SHAPES.filter((s) => s1.counts[s] > 0).length >= 4, '多种形状上场 ' + JSON.stringify(s1.counts));
for (const r of fs.rows) assert.ok(FLORA_SURFACES.includes(r.surface) && r.items >= 4 && r.items <= 9, '行带表面型与丛内数');
const s1b = fs.rebuild(world, null);
assert.deepEqual(s1b.counts, s1.counts, '重放确定性');
const m4 = new THREE.Matrix4(); fs.meshes.blade.getMatrixAt(0, m4); const b0 = Array.from(m4.elements);
fs.rebuild(world, null); fs.meshes.blade.getMatrixAt(0, m4); assert.deepEqual(Array.from(m4.elements), b0, '实例矩阵逐字节确定');
// 雨生态：色组换、物种键/形状不换
fs.setModes({ ecology: 'rain' }); const s2 = fs.rebuild(world, null);
assert.equal(s2.ecology, 'rain'); assert.equal(veg2.floraEcology, 'rain', '生态同步到 Vegetation 调色');
const rainCols = new Set(Object.values(RAIN_COLORS).flat());
let rainHit = 0;
for (const s of SPECIES_SHAPES) { const mesh = fs.meshes[s]; for (let i = 0; i < Math.min(mesh.count, 30); i++) { const got = [mesh.instanceColor.getX(i), mesh.instanceColor.getY(i), mesh.instanceColor.getZ(i)]; for (const h of rainCols) { col.set(h); if (Math.abs(col.r - got[0]) + Math.abs(col.g - got[1]) + Math.abs(col.b - got[2]) < 1e-5) { rainHit++; break; } } } }
assert.ok(rainHit > 30, '雨生态实例色 ' + rainHit);
fs.setModes({ levelFlora: false, ecology: 'meadow' });
assert.equal(fs.group.visible, false); assert.equal(veg2.tufts.visible, true, '全关恢复通用地被丛');

console.log('PASS level-flora-layers:', JSON.stringify({
  judge: { presence: +jPresence.toFixed(3), items: +jItems.toFixed(2), radius: +jRad.toFixed(3), scale: +jScale.toFixed(3), spread: +JM.meanSpread.toFixed(2) },
  ours: { presence: +ourPresence.toFixed(3), items: +mean(agg.counts).toFixed(2), radius: +mean(agg.rads).toFixed(3), scale: +mean(agg.scales).toFixed(3), bySurface: Object.fromEntries(Object.entries(agg.bySurface).map(([k, [p, n]]) => [k, +(n ? p / n : 0).toFixed(2)])) },
  surfCount, ratioChecked, rainChecked, floraCounts: s1.counts, absent: s1.absentCells, rainHit,
}));
