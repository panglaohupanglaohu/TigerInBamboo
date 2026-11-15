// r56 C05·C：运河拱桥（806904557502464000 / 802496920790777856）、教堂高拱龛（1275089608758484992）、
// 门窗模板挖洞几何（1205422438437273601）、道具美术（1205416648397721601）。真实网格 / 真实 buildBuildings / 射线穿洞判定。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { buildCanalTown } = await import('../src/build/canal-scene-r56.js');
const { canalBridgeAxis, canalArchParams } = await import('../src/build/canal-bridge-r56.js');
const { nicheShape } = await import('../src/build/church-niche-r56.js');
const { punchGeometry } = await import('../src/render/opening-punch-layer.js');
const { propKind } = await import('../src/build/yard-prop-art-r56.js');
const { propOverlap } = await import('../src/core/opening-footprint.js');
const { edgeOut } = await import('../src/core/meshwriter.js');
const L = F.L;

// Möller–Trumbore：线段 p→q 与 writer 全部三角形的交点参数（0..1）
function hits(m, p, q) {
  const P = m.pos, out = [], d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  for (let t = 0; t < P.length; t += 9) {
    const a = [P[t], P[t + 1], P[t + 2]], e1 = [P[t + 3] - a[0], P[t + 4] - a[1], P[t + 5] - a[2]], e2 = [P[t + 6] - a[0], P[t + 7] - a[1], P[t + 8] - a[2]];
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-12) continue;
    const s = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    if (u < 0 || u > 1) continue;
    const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const tt = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
    if (tt >= 0 && tt <= 1) out.push(tt);
  }
  return out.sort((x, y) => x - y);
}
const sameArr = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const mid = (c, i, s = 0.5) => { const a = c.pts[i % c.n], b = c.pts[(i + 1) % c.n]; return [a.x + (b.x - a.x) * s, a.z + (b.z - a.z) * s]; };

// ---- 0) 开关关：几何逐项不变（显式 false 与未设置一致；town 场景没有运河，开 canalBridges 也逐项不变）
for (const kind of ['quad', 'mixed']) {
  const w = F.world(kind, 'town', 7), base = F.build(w, {});
  const off = F.build(w, { canalBridges: false, churchDoors: false, yardPropArt: false });
  assert.ok(sameArr(base.m.pos, off.m.pos) && sameArr(base.m.col, off.m.col), `${kind}: flags off identical`);
  assert.equal(base.r.canalBridges.length, 0); assert.equal(base.r.churchDoors.length, 0);
  const cb = F.build(w, { canalBridges: true });
  // town 里偶有天然“一格水道”上的码头格，同样被识别成桥；其余格几何不受影响
  if (!cb.r.canalBridges.length) assert.ok(sameArr(base.m.pos, cb.m.pos), `${kind}: no canal → canalBridges is a no-op`);
  else for (const r of cb.r.canalBridges) assert.ok(canalBridgeAxis(w, w.cells[r.cell]) >= 0);
  console.log(kind, 'town natural bridge faces', cb.r.canalBridges.length);
  assert.ok(base.r.openings.length > 100, 'opening log records real windows/doors');
}

// ---- 1) 运河拱桥：桥格判定、拱下水流通道（射线沿水流轴穿过拱心）
const w = new F.World(F.grid('quad')); w.palette = F.PALETTES.town;
const sc = buildCanalTown(w);
assert.ok(sc.strip.length >= 12 && sc.bridges.length === 2, `canal strip ${sc.strip.length}, bridges ${sc.bridges}`);
for (const id of sc.strip) { const c = w.cells[id]; assert.ok(sc.bridges.includes(id) ? w.isBuilt(c, 1) : !w.isSolid(c, 1)); }
const on = F.build(w, { canalBridges: true, archVoussoirs: true }), offB = F.build(w, { archVoussoirs: true });
assert.equal(on.r.canalBridges.length, 4, 'two canal faces per bridge');
let passages = 0;
for (const id of sc.bridges) {
  const c = w.cells[id], ax = canalBridgeAxis(w, c);
  const recs = on.r.canalBridges.filter((r) => r.cell === id);
  assert.deepEqual(recs.map((r) => r.face).sort(), [ax, ax + 2]);
  for (const r of recs) {
    const len = Math.hypot(c.pts[(r.face + 1) % 4].x - c.pts[r.face].x, c.pts[(r.face + 1) % 4].z - c.pts[r.face].z), p = canalArchParams(L, { len });
    assert.ok(Math.abs(r.rise - p.rise) < 1e-12 && r.crown < L - 0.055 - 0.045, 'crown + voussoir ring stays under the coping');
    assert.equal(r.wedges, 9); assert.equal(r.vault, r.face === ax ? 12 : 0);
  }
  // 射线：从本面外 0.3 到对面外 0.3，过拱心、高 0.45·rise
  const [ax0, az0] = mid(c, ax), [bx0, bz0] = mid(c, ax + 2), [n1x, n1z] = edgeOut(c, ax), [n2x, n2z] = edgeOut(c, ax + 2), y = 0.45 * Math.min(...recs.map((r) => r.rise));
  const P = [ax0 + n1x * 0.3, y, az0 + n1z * 0.3], Q = [bx0 + n2x * 0.3, y, bz0 + n2z * 0.3];
  const hOn = hits(on.m, P, Q), hOff = hits(offB.m, P, Q);
  assert.equal(hOn.length, 0, `bridge ${id}: water passes under the arch (hits ${hOn.length})`);
  assert.ok(hOff.length >= 2, `bridge ${id}: without canalBridges the quay block is solid (hits ${hOff.length})`);
  // 拱顶以上桥体实心：同一射线抬到 deck 下 0.03 必被挡
  const P2 = [P[0], L - 0.085, P[2]], Q2 = [Q[0], L - 0.085, Q[2]];
  assert.ok(hits(on.m, P2, Q2).length >= 2, 'spandrel above the arch is closed');
  passages++;
}
assert.equal(passages, 2);
// 跨渠楼体下仍是 World 已有拱（802 / 806 塔楼拱洞），楔石环照常
assert.ok(on.r.archBudgets.length >= 1 && on.r.archWedges >= 9);

// ---- 2) 教堂高拱龛：跨两层的真洞 + 后墙另色 + 洞里没有门窗
const ch = F.build(w, { churchDoors: true }), chOff = F.build(w, {});
assert.ok(ch.r.churchDoors.length >= 1, 'canal town has a church niche');
for (const kind of ['quad', 'mixed']) { const t = F.world(kind, 'town', 7), r = F.build(t, { churchDoors: true }).r; assert.ok(r.churchDoors.length >= 1, `${kind} town: niches ${r.churchDoors.length}`); }
for (const n of ch.r.churchDoors) {
  const c = w.cells[n.cell], i = n.edge, [mx, mz] = mid(c, i), [nx, nz] = edgeOut(c, i);
  assert.ok(w.isBuilt(c, 2) && w.isBuilt(c, 3) && n.bottom < 2 * L && n.top > 2 * L + 0.3, 'spans storeys 2 and 3');
  for (const y of [1.6 * L, 2.4 * L]) {
    const P = [mx + nx * 0.4, y, mz + nz * 0.4], Q = [mx - nx * 0.4, y, mz - nz * 0.4];
    const hOn = hits(ch.m, P, Q), hOff = hits(chOff.m, P, Q);
    // 关：0.4 处撞墙（或贴墙门窗）；开：一直走到后墙 0.4+depth 处
    assert.ok(hOff[0] * 0.8 < 0.4 + 0.02, `no niche: wall at the facade (${hOff[0] * 0.8})`);
    assert.ok(Math.abs(hOn[0] * 0.8 - (0.4 + n.depth - 0.006)) < 0.012 || Math.abs(hOn[0] * 0.8 - (0.4 + n.depth)) < 0.012, `niche: first hit is the recessed back wall (${(hOn[0] * 0.8).toFixed(3)})`);
  }
  const len = Math.hypot(c.pts[(i + 1) % c.n].x - c.pts[i].x, c.pts[(i + 1) % c.n].z - c.pts[i].z);
  for (const o of ch.r.openings) if (o.cell === c.id && o.edge === i && o.y0 < n.top && o.y1 > n.bottom) assert.ok(Math.abs(o.t - 0.5) * len > n.width / 2 + 0.03, 'no window/door inside the niche');
  assert.deepEqual(nicheShape(len, L).width, n.width);
}

// ---- 3) 模板挖洞几何：mask 在墙外 0.014、凹洞盒子全在墙内、每洞 2 + 10 三角
for (const kind of ['quad', 'mixed']) {
  const r = F.build(F.world(kind, 'town', 7), {}).r, g = punchGeometry(r.openings, { depth: 0.06 });
  assert.equal(g.mask.length, r.openings.length * 18); assert.equal(g.recess.length, r.openings.length * 90); assert.equal(g.recessColor.length, g.recess.length);
  r.openings.forEach((o, k) => {
    for (let v = 0; v < 6; v++) { const x = g.mask[k * 18 + v * 3], z = g.mask[k * 18 + v * 3 + 2], d = (x - o.ax) * o.nx + (z - o.az) * o.nz; assert.ok(Math.abs(d - 0.014) < 2e-5); }
    for (let v = 0; v < 30; v++) { const x = g.recess[k * 90 + v * 3], z = g.recess[k * 90 + v * 3 + 2], d = (x - o.ax) * o.nx + (z - o.az) * o.nz; assert.ok(d <= 2e-5 && d >= -0.06 - 2e-5, 'recess behind the wall plane'); }
  });
  assert.ok(g.boxes.every((b) => b.depth === 0.06 && b.area > 0));
}

// ---- 4) 道具美术：同一 footprint（位置 / 尺寸 / 不重叠结论不变），三种都出现
{
  const kinds = {};
  for (const [kind, seed] of [['quad', 7], ['mixed', 7], ['quad', 3]]) {
  const t = F.world(kind, 'town', seed), a = F.build(t, { yardProps: true }).r.yardProps, b = F.build(t, { yardProps: true, yardPropArt: true }).r.yardProps;
  assert.equal(a.length, b.length);
  a.forEach((ya, k) => { assert.equal(ya.count, b[k].count); ya.props.forEach((p, j) => { assert.deepEqual(p.poly, b[k].props[j].poly); kinds[b[k].props[j].kind] = (kinds[b[k].props[j].kind] ?? 0) + 1; }); for (let x = 0; x < ya.props.length; x++) for (let y = x + 1; y < ya.props.length; y++) assert.ok(!propOverlap(ya.props[x].poly, ya.props[y].poly)); });
  }
  assert.ok(kinds.table && kinds.crate && kinds.planter, JSON.stringify(kinds));
  assert.equal(propKind({ poly: [{ x: 0, z: 0 }, { x: 0.12, z: 0 }, { x: 0.12, z: 0.12 }, { x: 0, z: 0.12 }] }), 'table');
  console.log('yard prop kinds', JSON.stringify(kinds));
}
console.log('PASS openings-c05c-r56: canal bridges', sc.bridges.length, 'church niches', ch.r.churchDoors.length, 'openings', on.r.openings.length);
