// 第 56 批 C07：Townscaper 生命 / 光照 / 贴图 / 水（17 条片子里本轮新写的共享模块）
//   town-skin（1430227487376781317 / 1241096929490149376 / 1241046107125399552）· decal-accum（1427721874490933250）
//   splash-c07（1258421104756097029）· garden-plots-c07（1178731576982724611 / 1290997501332525056）· view-c07 开关解析
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const TS = await import('../src/core/town-skin.js');
const { DecalAtlas, BOIL_CHARTS } = await import('../src/core/decal-accum.js');
const SP = await import('../src/life/splash-c07.js');
const GP = await import('../src/build/garden-plots-c07.js');
const { parseC07, C07_KEYS, aoLayerField } = await import('../src/world/view-c07.js');
const { recordVertexBase } = await import('../src/world/town-skin-layer.js');
const { generateModulePatch } = await import('../src/core/module-patch.js');
const { World } = await import('../src/core/world.js');
const { WorldMesh } = await import('../src/world/worldmesh.js');
const { buildBuildings } = await import('../src/build/buildings.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { classifyCourtyards } = await import('../src/core/courtyards.js');
const { PALETTES } = await import('../src/core/palette.js');

/* ---------- ① TownColor 总贴图 ---------- */
assert.equal(TS.SKIN_SLOTS.length, 60, '8×8 色格去掉右下 2×2 植物角 = 60');
assert.ok(TS.SKIN_SLOTS.every(([x, y]) => !(x >= 6 && y >= 6)));
const cols = Array.from({ length: 12 }, (_, i) => ({ r: (i + 1) / 14, g: 0.5, b: 1 - (i + 1) / 14 }));
const atlas = TS.buildSkinAtlas(cols);
// 细线纹均值 = 1：色格平均色 ≈ 底色（换肤前后画面一致的前提）
for (let i = 0; i < cols.length; i++) { const m = TS.cellMean(atlas, i); assert.ok(Math.abs(m.r - cols[i].r) < 0.012 && Math.abs(m.b - cols[i].b) < 0.012, 'cell mean ≈ base ' + i); }
// 植物角 = 叶纹（灰阶、有起伏）
{ let lo = 255, hi = 0; for (let y = 96; y < 128; y++) for (let x = 96; x < 128; x++) { const v = atlas[(y * 128 + x) * 4]; lo = Math.min(lo, v); hi = Math.max(hi, v); } assert.ok(hi - lo > 200, 'leaf motif in 32² corner'); }
// mip：每格独立 box 滤波，第 4 级 1 像素 = 格均值，且不跨格渗色
const mips = TS.buildSkinMips(atlas);
for (let i = 0; i < cols.length; i++) {
  const [gx, gy] = TS.SKIN_SLOTS[i], o = (gy * 128 + 112 + gx) * 4, m = TS.cellMean(atlas, i);
  assert.ok(Math.abs(mips[o] / 255 - m.r) < 0.01 && Math.abs(mips[o + 2] / 255 - m.b) < 0.01, 'level-4 texel = cell mean');
}
{ // 相邻两格一黑一白：第 1 级里黑格的最右列不能被白格污染
  const a2 = TS.buildSkinAtlas([{ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }]), m2 = TS.buildSkinMips(a2);
  for (let y = 0; y < 8; y++) assert.ok(m2[(y * 128 + 7) * 4] < 5, 'no bleed between cells at mip 1');
}
// 光照比：采样（≈底色）× 比 = 烘焙色
{
  const base = [cols[0], cols[0], cols[0], cols[3], cols[3], cols[3]], baked = new Float32Array(18);
  base.forEach((c, v) => { const k = 0.4 + 0.1 * v; baked.set([c.r * k, c.g * k, c.b * k], v * 3); });
  const a = TS.skinAttributes(baked, base);
  assert.equal(a.colors.length, 2); assert.equal(a.overflow, 0);
  for (let v = 0; v < 6; v++) { const c = base[v]; assert.ok(Math.abs(c.g * a.ratio[v * 3 + 1] - baked[v * 3 + 1]) < 1e-6, 'ratio reproduces bake'); }
  assert.deepEqual([...a.cell.slice(0, 2)], TS.SKIN_SLOTS[a.slotIndex.size ? 0 : 0].slice()); // 第一色格
  // 超过 60 种颜色：多的并进最近格，不丢顶点
  const many = Array.from({ length: 70 * 3 }, (_, i) => ({ r: (i / 3 | 0) / 70, g: 0.2, b: 0.3 })), bk = new Float32Array(many.length * 3).fill(0.2);
  const b = TS.skinAttributes(bk, many); assert.equal(b.colors.length, 60); assert.equal(b.overflow, 10); assert.ok([...b.cell].every((x) => x >= 0));
}
// 涂鸦：改了墙格、不碰植物角
{ const d = TS.buildSkinAtlas(cols), leaf = d.slice(), n = TS.scribble(d, { seed: 3 }); assert.ok(n > 1500, 'scribble paints'); for (let y = 96; y < 128; y++) for (let x = 96; x < 128; x++) assert.equal(d[(y * 128 + x) * 4], leaf[(y * 128 + x) * 4]); }

/* ---------- 真 WorldMesh：重跑生成器拿到的底色与主网格逐顶点对齐 ---------- */
const N = 10, vertices = [], faces = [];
for (let x = 0; x <= N; x++) for (let z = 0; z <= N; z++) vertices.push([x - N / 2, z - N / 2]);
for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) { const a = x * (N + 1) + z; faces.push([a, a + N + 1, a + N + 2, a + 1]); }
const world = new World(generateModulePatch({ vertices, faces })); world.palette = PALETTES.town;
const ring = (c) => Math.max(Math.abs(c.cx), Math.abs(c.cz));
for (const c of world.cells) { const r = ring(c); if (r < 4.6) world.fill(c, 1); if (r > 2.9 && r < 4.6) { world.fill(c, 3); world.color[c.id] = c.id % 4; } }
const L = 0.5, wm = new WorldMesh(world, { levelHeight: L }); wm.rebuild();
const rec = recordVertexBase(wm, wm.geometry);
assert.equal(rec.mismatch, 0, 'recorded writer order/positions match WorldMesh');
const skinA = TS.skinAttributes(wm.geometry.getAttribute('color').array, rec.base);
assert.ok(skinA.colors.length >= 4 && skinA.colors.length <= 60, 'palette slots ' + skinA.colors.length);
{ let bad = 0; const col = wm.geometry.getAttribute('color').array; for (let v = 0; v < rec.vertices; v++) { if (!rec.base[v]) continue; const s = skinA.colors[TS.SKIN_SLOTS.findIndex(([x, y]) => x === skinA.cell[v * 2 - (v % 3) * 2] && y === skinA.cell[v * 2 + 1 - (v % 3) * 2])]; if (s && Math.abs(s.g * skinA.ratio[v * 3 + 1] - col[v * 3 + 1]) > 1e-4 && skinA.ratio[v * 3 + 1] < 3) bad++; } assert.ok(bad === 0, 'every skinned vertex reproduces its baked colour: bad ' + bad); }

/* ---------- ② 贴花累加 + padding ---------- */
{
  const d = new DecalAtlas({ charts: BOIL_CHARTS, size: 32, pad: 2, seed: 9 });
  const grey = (k) => { let n = 0; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const t = d.texel(k, x, y); if (t[0] === BOIL_CHARTS[k].base[0] && t[1] === BOIL_CHARTS[k].base[1]) n++; } return n; };
  const g0 = grey(0); d.stamp(6); const g1 = grey(0); for (let i = 0; i < 30; i++) d.stamp(6); const g2 = grey(0);
  assert.ok(g0 === 1024 && g1 < g0 && g2 < g1 * 0.4, 'decals progressively cover the grey base ' + [g0, g1, g2]);
  const changes = Array.from({ length: 10 }, () => d.stamp(6));
  assert.ok(changes.every((c) => c > 20), 'every frame keeps changing pixels (line boil) ' + changes);
  assert.equal(d.seamBleed(0), 0, 'with padding the tiling seam samples the wrapped chart');
  assert.equal(d.seamBleed(1), 0);
  const z = new DecalAtlas({ charts: BOIL_CHARTS, size: 32, pad: 0, seed: 9 }); for (let i = 0; i < 20; i++) z.stamp(6);
  assert.ok(z.seamBleed(1) > 3, 'without padding chart 1 bleeds into chart 0 at the seam: ' + z.seamBleed(1));
  assert.throws(() => new DecalAtlas({ charts: [] }));
}

/* ---------- ③ 冠状水花 ---------- */
assert.equal(SP.crownHeight(-0.1), 0); assert.ok(SP.crownHeight(0.35) > 0.59); assert.ok(SP.crownHeight(0.6) < SP.crownHeight(0.35)); assert.equal(SP.crownHeight(1.0), 0);
assert.equal(SP.RING_DELAYS.length, 3, '3 圈环');
{ const [r0, a0] = SP.ringState(3.2, 0), [r1, a1] = SP.ringState(3.2, 1); assert.ok(a0 > 0.1 && a1 > 0.05, 'faint rings still visible at 3.2 s'); assert.ok(r1 > r0, 'outer ring larger'); assert.deepEqual(SP.ringState(4.5, 0), [0, 0]); }
{ const [ra] = SP.ringState(0.5, 0), [rb] = SP.ringState(2.5, 0), [rc] = SP.ringState(3.5, 0); assert.ok(rb - ra > rc - rb, 'decelerating expansion'); }
{
  const scene = new THREE.Group(), uTime = { value: 10 }; let seed = 1; const rnd = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const cs = new SP.CrownSplash({ scene, uTime, random: rnd }), cell = { id: 4, cx: 1, cz: 2, minX: 0.5, maxX: 1.5, minZ: 1.5, maxZ: 2.5 };
  const r = cs.spawn(cell); assert.ok(r.drops >= 10 && r.drops <= 12, '10–12 drops');
  assert.equal(cs.crown.count, SP.CROWN_STRIPS); assert.equal(cs.rings.count, 3);
  const vy = []; for (let i = 0; i < cs.P; i++) if (cs.life[i] > 0) { assert.ok(cs.v[i * 3 + 1] > Math.hypot(cs.v[i * 3], cs.v[i * 3 + 2]) * 3, 'spray is mostly vertical'); vy.push(cs.v[i * 3 + 1]); }
  for (let k = 0; k < 60; k++) cs.update(0.05); assert.equal(cs.drops, 0, 'drops die on hitting water');
  cs.dispose();
}

/* ---------- ④ 草地块 + 门优先小径 ---------- */
assert.deepEqual(GP.insetPolygon([[0, 0], [1, 0], [1, 1], [0, 1]], [0.1, 0, 0, 0]).map((p) => p.map((x) => +x.toFixed(6))), [[0, 0.1], [1, 0.1], [1, 1], [0, 1]]);
assert.deepEqual(GP.insetPolygon([[0, 0], [0, 1], [1, 1], [1, 0]], [0.1, 0.1, 0.1, 0.1]).map((p) => p.map((x) => +x.toFixed(6))), [[0.1, 0.1], [0.1, 0.9], [0.9, 0.9], [0.9, 0.1]], 'winding independent');
{
  const comps = classifyCourtyards(world).components;
  assert.equal(comps.length, 1, 'one enclosed courtyard'); const inner = comps[0]; assert.ok(inner.length >= 25);
  // 门：取院子边上一个房子格朝院子那条边
  const nbr = (c, i) => world.neighbor(c, i), byId = new Set(inner.map((c) => c.id));
  const doorCell = world.cells.find((c) => world.top(c) === 3 && Array.from({ length: c.n }, (_, i) => nbr(c, i)).some((b) => b && byId.has(b.id)));
  const edge = Array.from({ length: doorCell.n }, (_, i) => i).find((i) => byId.has(nbr(doorCell, i)?.id));
  const door = new Map([[0, { k: 0, key: doorCell.id + ':' + edge }]]), path = new Uint8Array(world.cells.length);
  const plan = GP.planGardenC07(world, comps, door, nbr, path);
  const yardDoor = nbr(doorCell, edge);
  assert.ok(plan.doorCells.has(yardDoor.id) && path[yardDoor.id], 'door cell is on the path');
  assert.equal(plan.hubs.size, 1); const hub = [...plan.hubs][0]; assert.ok(path[hub]);
  // 门格 → 中心沿 links 连通
  const seen = new Set([yardDoor.id]), q = [world.cells[yardDoor.id]];
  while (q.length) { const c = q.pop(); for (const i of plan.links.get(c.id) || []) { const b = nbr(c, i); if (b && path[b.id] && !seen.has(b.id)) { seen.add(b.id); q.push(b); } } }
  assert.ok(seen.has(hub), 'door path reaches the hub');
  // r194：草格够 2×bigMin 时先切一块大田（片 0095 的「一块大田 + 若干小块」），余下仍 ≤5 格
  const over = plan.plots.filter((p) => p.cells.length > 5);
  assert.ok(plan.plots.length >= 4 && plan.plots.filter((p) => p.cells.length <= 5).length >= 2, 'lawn split into ≤5-cell plots (+ one big field)');
  assert.ok(over.length <= 1 && (over.length === 0 || (over[0].big && over[0].cells.length >= 9 && over[0].cells.length <= 16)), 'at most one big field, [9,16] cells: ' + JSON.stringify(plan.stats.plotSizes));
  assert.ok(inner.every((c) => path[c.id] || plan.plotOf.has(c.id)), 'every courtyard cell is path or plot');
  // 加一扇门 → 多一条路（片子 0141–0143）
  const other = world.cells.find((c) => world.top(c) === 3 && c.id !== doorCell.id && c.cz > 2.9 && Math.abs(c.cx) < 1 && Array.from({ length: c.n }, (_, i) => nbr(c, i)).some((b) => b && byId.has(b.id)));
  const e2 = Array.from({ length: other.n }, (_, i) => i).find((i) => byId.has(nbr(other, i)?.id));
  const path2 = new Uint8Array(world.cells.length), plan2 = GP.planGardenC07(world, comps, new Map([...door, [1, { k: 0, key: other.id + ':' + e2 }]]), nbr, path2);
  assert.ok(path2.reduce((s, x) => s + x, 0) > path.reduce((s, x) => s + x, 0), 'second door grows another path');
  assert.ok(plan2.doorCells.has(nbr(other, e2).id));
  // buildBuildings：开关关 = 旧几何不变；开 = 有小径条 / 石沿，三角形变多
  const geo = (flag) => { world.gardenPlots = flag; const w = new MeshWriter(); buildBuildings(w, world, { L }); return w.pos.length; };
  const off1 = geo(false), on = geo(true), off2 = geo(false); delete world.gardenPlots;
  assert.equal(off1, off2); assert.ok(on > off1, 'garden plots add curb/strip geometry ' + [off1, on]);
}

/* ---------- ⑤ 分层 AO 纹理（1168571866405097472）：同一 World → 0/1 投影层 + 模糊层；改一格两层都变 ---------- */
{
  const f = aoLayerField(world, L), size = f.W * f.H, sum = (a, lv) => { let s = 0; for (let i = lv * size; i < (lv + 1) * size; i++) s += a[i]; return s; };
  assert.ok(f.layers >= 4 && sum(f.bits, 1) > 0 && sum(f.bits, 3) > 0, 'layered raster has ground + wall layers');
  let halo = 0; for (let i = size; i < size * 2; i++) if (!f.bits[i] && f.occ[i] > 0.02) halo++;
  assert.ok(halo > 0, 'blurred layer spreads past the raw footprint');
  const b3 = sum(f.bits, 3); world.fill(world.cells.find((c) => world.top(c) === 1), 3); const g = aoLayerField(world, L);
  assert.ok(sum(g.bits, 3) > b3, 'reprojected at each change');
}

/* ---------- ⑥ 开关 ---------- */
assert.deepEqual([...parseC07('?c07=townskin,splash,nope')], ['townskin', 'splash']);
assert.equal(parseC07('').size, 0); assert.equal(C07_KEYS.length, 8);   // r194 修历史遗留：sungizmo 早在 C07_KEYS 里，这里是旧计数
console.log('c07-look ok', { slots: skinA.colors.length, vertices: rec.vertices });
