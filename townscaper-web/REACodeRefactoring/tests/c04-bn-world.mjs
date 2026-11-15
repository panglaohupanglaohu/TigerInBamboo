// 第 56 批 C04（Bad North 网格 / 光照 / 地形 + 杂项）逻辑测试：
// 818857408848130048 / 832633189277409280 field-surface-c04 · 798580832906739712 vertex-openness ·
// 823848950553780226 + 815236105079398400 battle-c04 · 959752525867036672 + 793557992931266561 view-c04 ·
// 974564862729838592 / 974579499802202113 bary-gizmo · 781957658597269506 mushroom-c04
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
globalThis.document = new Proxy({}, { get: () => () => ({ style: {}, getContext: () => null }) });

const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const FS = await import('../src/core/field-surface.js');
const C = await import('../src/core/field-surface-c04.js');
const { bakeVertexOpenness } = await import('../src/core/vertex-openness.js');
const { particleAO, hexSlotOutlines } = await import('../src/badnorth/battle-c04.js');
const { gridVertexDual } = await import('../src/core/vertex-dual.js');
const { parseC04, ssaoKernel, dualCellSegments, C04_KEYS } = await import('../src/world/view-c04.js');
const { gizmoState, pickGizmoCell } = await import('../src/world/bary-gizmo.js');
const { buildMushroomStack, mushroomReport } = await import('../src/terrain/mushroom-c04.js');
const { buildNav } = await import('../src/world/navgraph.js');
const { ladderAnchors, ladderProfile, ladderContact } = await import('../src/core/ladder-profile.js');
const L = .5;
const mkWorld = (build, opts) => { const g = build(opts); decorateCells(g); return { grid: g, world: new World(g), index: buildCellIndex(g) }; };
const out = {};

/* ---------- ① field-surface-c04：分层 / 暗碎块 / 带状水线 / 镜像 ---------- */
{
  const plan = C.layeredPlan(C.LAYERED_SHAPES.A, C.LAYERED_SHAPES.B, { chunk: 3, seed: 3, dur: .45, gap: .5 });
  assert.ok(plan.every((c) => c.from.every((b) => !b.house) && c.to.every((b) => !b.house)), '房子不进地形盒');
  assert.equal(C.housesAt(plan, 0, { lift: 5 }).length, C.LAYERED_SHAPES.A.houses.length, 't=0 = 形态 A 的房子');
  assert.equal(C.housesAt(plan, 1, { lift: 5 }).length, C.LAYERED_SHAPES.B.houses.length, 't=1 = 形态 B 的房子');
  // chunkPhase 与 morphField 同一公式：逐块重算实心格数与 morphField 返回值一致
  const f = FS.makeField([34, 22, 34]);
  for (const t of [0, .2, .37, .5, .71, 1]) {
    const st = FS.morphField(f, plan, t, { lift: 5 });
    let solid = 0; const g = FS.makeField([34, 22, 34]);
    for (const c of plan) { const p = C.chunkPhase(c, t, { lift: 5 }); if (!p.visible) continue; solid += FS.rasterizeBoxes(g, FS.shrinkBoxes(p.fromSide ? c.from : c.to, p.s), { lift: p.up }); }
    assert.equal(solid, st.solid, `t=${t} 区块相位与 morphField 一致`);
  }
  // 暗度：成品 0，过渡中 > 0
  const dark = (t) => { FS.morphField(f, plan, t, { lift: 5 }); FS.blurField(f, { passes: 2, radius: 1 }); const m = FS.surfaceNets(f); return C.transitionDarkness(plan, t, m.positions, { chunk: 3, lift: 5 }); };
  assert.ok(dark(0).every((x) => x === 0) && dark(1).every((x) => x === 0), '成品不变暗');
  const mid = dark(.6); assert.ok(mid.some((x) => x > .3), '过渡碎块变暗');
  // 带状水线：陆内 0，外侧距离单调；带覆盖 > 0 且全在陆外
  FS.morphField(f, plan, 0, { lift: 5 }); FS.blurField(f, { passes: 2, radius: 1 });
  const di = C.waterlineDistance(f, 1.6, { res: 4, span: 3 }), band = C.waterlineBand(di);
  assert.ok(band.covered > 100, '带状水线有像素');
  for (let p = 0; p < di.w * di.h; p++) if (band.rgba[p * 4 + 3] > 128) assert.ok(di.dist[p] > .2 && di.dist[p] < 1.3, '白带在陆外等距处');
  assert.ok(di.dist.some((x) => x === 0) && di.dist.some((x) => x > 3), '有陆有海');
  // 镜像矩阵：y = h + d → h − d
  const M = C.mirrorMatrixY(1.6), y = 1.6 + .7, my = M[5] * y + M[13];
  assert.ok(Math.abs(my - (1.6 - .7)) < 1e-12, '关于水面镜像');
  const h = C.houseTriangles({ w: 2, d: 2 }); assert.equal(h.tris.length % 3, 0); assert.ok(h.dark.some(Boolean), '门洞是暗面');
  out.fieldSurface = { chunks: plan.length, band: band.covered, darkMid: mid.filter((x) => x > .3).length };
}

/* ---------- ② 顶点开阔度：室内 < 屋顶 ---------- */
{
  const { world, index } = mkWorld(buildQuadGrid, { radius: 5 });
  const c = world.cells.reduce((a, b) => (Math.hypot(b.cx, b.cz) < Math.hypot(a.cx, a.cz) ? b : a));
  for (const x of world.cells) world.fill(x, 1, { rock: true });
  world.setSolid(c, 4, true, { rock: true }); for (const id of c.edgeNeighbors) if (id >= 0) world.fill(world.cells[id], 4, { rock: true });   // 一间有顶的屋子
  const far = world.cells.reduce((a, b) => (Math.hypot(b.cx, b.cz) > Math.hypot(a.cx, a.cz) ? b : a));
  const pos = new Float32Array([c.cx, L, c.cz, far.cx, L, far.cz, c.cx, 4 * L, c.cz]), nor = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const r = bakeVertexOpenness(world, index, pos, nor, { levelHeight: L });
  assert.ok(r.values[0] < .3 && r.values[1] > .6 && r.values[2] > .8, `室内暗、空地与屋顶亮 ${[...r.values].map((v) => v.toFixed(2))}`);
  const r2 = bakeVertexOpenness(world, index, pos, nor, { levelHeight: L }); assert.deepEqual([...r2.values], [...r.values], '确定性');
  assert.throws(() => bakeVertexOpenness(world, index, pos, nor, { levelHeight: L, budget: 10 }), /budget/);
  assert.throws(() => bakeVertexOpenness(world, index, pos, nor.slice(3), {}), /mismatch/);
  out.openness = [...r.values].map((v) => +v.toFixed(3));
}

/* ---------- ③ 尘粒 AO + 不规则六边形 ---------- */
{
  const { world, index } = mkWorld(buildMixedGrid, { radius: 6 });
  for (const x of world.cells) world.fill(x, 1, { rock: true });
  const c = world.cells.reduce((a, b) => (Math.hypot(b.cx, b.cz) < Math.hypot(a.cx, a.cz) ? b : a));
  const wall = world.cells[c.edgeNeighbors.find((n) => n >= 0)]; world.fill(wall, 4, { rock: true });
  const occ = (x, y, z) => { if (y < 0) return true; const k = index.cellAt(x, z); return !!(k && world.isSolid(k, Math.floor(y / L) + 1)); };
  const far = world.cells.filter((k) => world.top(k) === 1).reduce((a, b) => (Math.hypot(b.cx - wall.cx, b.cz - wall.cz) > Math.hypot(a.cx - wall.cx, a.cz - wall.cz) ? b : a));
  const ex = c.pts.findIndex((p, i) => c.edgeNeighbors[i] === wall.id), a = c.pts[ex], b = c.pts[(ex + 1) % c.n];
  const wx = (a.x + b.x) / 2 * .7 + c.cx * .3, wz = (a.z + b.z) / 2 * .7 + c.cz * .3, nearWall = particleAO(occ, wx, L + .05, wz, { levelHeight: L });
  const open = particleAO(occ, far.cx, L + .05, far.cz, { levelHeight: L }), high = particleAO(occ, far.cx, L + 1.5, far.cz, { levelHeight: L });
  world.setSolid(c, 3, true, { rock: true });   // 同一点头顶加盖 → 洞里
  const cave = particleAO(occ, wx, L + .05, wz, { levelHeight: L });
  assert.ok(cave < nearWall && nearWall < open && open <= high, `洞内 < 贴墙 < 开阔 ≤ 高空：${[cave, nearWall, open, high].map((v) => v.toFixed(2))}`);
  assert.throws(() => particleAO(occ, NaN, 0, 0));
  world.setSolid(c, 3, false);
  const dual = gridVertexDual(world.grid), hex = hexSlotOutlines(world, dual, far);
  assert.ok(hex.length >= 3, '目标格每个顶点一块');
  for (const h of hex) { assert.ok(h.sides >= 3 && h.area > 0); assert.ok(h.wedges.every((w) => world.top(world.cells[w.cell]) === world.top(far)), '只取同一台地层'); }
  out.dust = { cave: +cave.toFixed(3), nearWall: +nearWall.toFixed(3), open: +open.toFixed(3) }; out.hex = hex.map((h) => h.sides);
}

/* ---------- ④ view-c04 纯函数：开关解析 / SSAO 核 / 对偶格线段 ---------- */
{
  assert.deepEqual([...parseC04('?c04=ssao,bogus,rayvis')].sort(), ['rayvis', 'ssao']);
  assert.equal(parseC04('').size, 0, '默认全关');
  assert.deepEqual(C04_KEYS, ['dualcells', 'rayvis', 'ssao', 'dustao', 'hexslots']);
  const k = ssaoKernel(); assert.equal(k.length, 16); assert.ok(k.every((v) => v[2] >= 0 && Math.hypot(...v) <= 1 + 1e-9), '半球核');
  const { world } = mkWorld(buildQuadGrid, { radius: 5 }); for (const x of world.cells) world.fill(x, 1 + (x.id % 2), { rock: true });
  const seg = dualCellSegments(world, gridVertexDual(world.grid), L);
  assert.ok(seg.segments > world.cells.length * 2, '每格每角两条对偶边');
  for (let i = 0; i < seg.pos.length; i += 3) assert.ok([1, 2].some((lv) => Math.abs(seg.pos[i + 1] - (lv * L + .03)) < 1e-9), '线段贴在所在格的台地高度');
  out.dualSegments = seg.segments;
}

/* ---------- ⑤ 重心 gizmo ---------- */
{
  const tri = [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: .2, y: 1, z: .9 }];
  for (const p of [{ u: .3, v: .3, h: .4, spread: 1 }, { u: 1.2, v: .2, h: .5, spread: .5 }, { u: -.3, v: .5, h: 0, spread: 1.6 }]) {
    const s = gizmoState(tri, p);
    assert.ok(Math.abs(s.w[0] + s.w[1] + s.w[2] - 1) < 1e-12 && s.err < 1e-12, '和为 1、与 Cramer 一致');
    assert.ok(Math.abs(s.height - p.h) < 1e-12, '离面距离 = h');
    const d = Math.hypot(s.P.x - s.Q.x, s.P.y - s.Q.y, s.P.z - s.Q.z); assert.ok(Math.abs(d - p.h) < 1e-12, '投影点在面上正下方');
    assert.equal(s.inside, p.u >= 0 && p.v >= 0 && p.u + p.v <= 1);
    assert.deepEqual(s.ops, { sub: 1, dotPerWeight: 1, dot: 2 });
  }
  const { world } = mkWorld(buildMixedGrid, { radius: 6 }); for (const x of world.cells) world.fill(x, 2, { rock: true });
  const c = pickGizmoCell(world); assert.ok(world.top(c) === 2 && c.edgeNeighbors.every((n) => n >= 0));
}

/* ---------- ⑥ 层叠薄平台 + 木梯 ---------- */
for (const build of [buildQuadGrid, buildMixedGrid]) {
  const { world } = mkWorld(build, {});   // 与 mushroom-stack.html 同一默认网格
  const b = buildMushroomStack(world), rep = mushroomReport(world, b);
  assert.ok(rep.every((r) => r.cells > 10 && r.overhang > r.cells / 2), '每片平台大半悬空');
  assert.ok(b.houses.length === 1 && world.topIsBuilt(world.cells[b.houses[0]]), '顶片房子');
  const nav = buildNav(world), stairs = nav.stairs.filter((s) => (s.rise || 1) === 2);
  assert.ok(stairs.length >= 1, `平台间有 rise=2 连接：${nav.stairs.map((s) => s.rise)}`);
  let thin = 0;
  for (const s of stairs) { const h = world.top(s.low), an = ladderAnchors(s, h, { L }), pr = ladderProfile(an.foot, an.lip, { side: { x: -an.vz ?? 0, y: 0, z: an.vx ?? 1 } }), ct = ladderContact(world, s, an, pr, { L }); if (ct.thinPlatform && ct.columnClear) thin++; }
  assert.ok(thin >= 1, '至少一把梯子搭在薄平台上（支撑深度 < rise），梯身不在岩里');
  out['mushroom-' + (build === buildQuadGrid ? 'quad' : 'mixed')] = { caps: rep.map((r) => r.cells + '/' + r.overhang), ladders: stairs.length, thin };
}
console.log(JSON.stringify(out), 'PASS c04-bn-world');
