/**
 * bary-gizmo.js — 第 56 批 C04：974564862729838592「pedagogical gizmos for my GDC microtalk, like this illustration of
 * Barycentric Coordinates」+ 974579499802202113「1 subtraction and 1 dot product (if you've precalculated some nice vectors)」。
 *
 * 片子（478 + 815 帧）：灰色岛面上的导航三角形（白边），一个白球（带红绿蓝移动箭头）被拖来拖去，可离开三角面升到空中、
 * 也可拖出三角形外；白球落到三角面上的投影点（小白点）、三个顶点到投影点的红 / 绿 / 蓝连线随权重变化；三角形本身也被拉窄 / 张开。
 * 这里在**真实共享 World**（index.html 的 View）里取一格的扇三角，叠同样的教学 gizmo：
 *   · 权重用 core/spatial.js baryPrep3（预算对偶向量，查询 = 1 次减法 + 每坐标 1 次点积，离面距离另 1 次点积）；
 *   · 每帧同时用 baryCramer3 对账，误差写进 stats；
 *   · 顶点小球大小 ∝ |权重|，负权重（点在三角形外）画成暗色；投影点 = baryPoint(权重)。
 * 交互：stats/状态由调用方读；set({u,v,h,spread}) 可定格（页面滑杆用），否则按时间自动绕行。
 */
import * as THREE from 'three';
import { baryPrep3, baryCramer3, baryPoint, baryInside } from '../core/spatial.js';

const RGB = [0xff4040, 0x40e060, 0x4080ff];

export function pickGizmoCell(world, { minTop = 1 } = {}) {
  // 离岛心最近、四周同高的陆格（三角形完整躺在一块台地上）
  const flat = world.cells.filter((c) => world.top(c) >= minTop && !world.topIsBuilt(c) && c.edgeNeighbors.every((n) => n >= 0 && world.top(world.cells[n]) === world.top(c)));
  if (!flat.length) throw new RangeError('no flat land cell for the gizmo');
  return flat.reduce((a, b) => (Math.hypot(b.cx, b.cz) < Math.hypot(a.cx, a.cz) ? b : a));
}

/** 纯函数：gizmo 在参数 (u,v,h,spread) 下的几何与权重（测试与页面共用）。 */
export function gizmoState(tri, { u = .3, v = .3, h = 0, spread = 1 } = {}) {
  const [A, B, C0] = tri, M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, z: (A.z + B.z) / 2 };
  // spread：把第三个顶点沿"中线"拉近 / 推远 → 三角形变窄 / 张开（片子里拖顶点的效果）
  const C = { x: M.x + (C0.x - M.x) * spread, y: M.y + (C0.y - M.y) * spread, z: M.z + (C0.z - M.z) * spread };
  const q = baryPrep3(A, B, C), n = q.normal;
  // 点 = A + u·AB + v·AC + h·n（u,v 可越出 [0,1] → 点在三角形外）
  const P = { x: A.x + u * (B.x - A.x) + v * (C.x - A.x) + h * n[0], y: A.y + u * (B.y - A.y) + v * (C.y - A.y) + h * n[1], z: A.z + u * (B.z - A.z) + v * (C.z - A.z) + h * n[2] };
  const w = q(P.x, P.y, P.z), ref = baryCramer3(A, B, C, P), Q = baryPoint(A, B, C, w);
  return { A, B, C, P, Q, w, ref, err: Math.max(...w.map((x, i) => Math.abs(x - ref[i]))), height: q.distance(P.x, P.y, P.z), inside: baryInside(w, 1e-12), ops: q.ops, normal: n };
}

export class BaryGizmo {
  constructor(view, world, { cell = null } = {}) {
    this.view = view; this.world = world; this.cell = cell ?? pickGizmoCell(world); this.manual = null; this.t = 0;
    const L = view.levelHeight, c = this.cell, y = world.top(c) * L + .015;
    this.tri = [0, 1, 2].map((i) => ({ x: c.pts[i].x, y, z: c.pts[i].z }));
    if (c.n === 4) { // 四边格取较大的那个扇三角
      const area = (a, b, d) => Math.abs((b.x - a.x) * (d.z - a.z) - (b.z - a.z) * (d.x - a.x));
      const t2 = [0, 2, 3].map((i) => ({ x: c.pts[i].x, y, z: c.pts[i].z }));
      if (area(...t2) > area(...this.tri)) this.tri = t2;
    }
    this.group = new THREE.Group(); this.group.renderOrder = 20; view.scene.add(this.group);
    const line = (color) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })); l.renderOrder = 21; l.frustumCulled = false; this.group.add(l); return l; };
    const ball = (color, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true })); m.renderOrder = 22; this.group.add(m); return m; };
    this.edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([0, 1, 2].map(() => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
    this.edge.renderOrder = 21; this.edge.frustumCulled = false; this.group.add(this.edge);
    this.spokes = RGB.map((c) => line(c)); this.drop = line(0xffffff);
    this.dots = RGB.map((c) => ball(c, 1)); this.point = ball(0xffffff, .045); this.proj = ball(0xffffff, .02);
    this.arrows = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((d, i) => { const a = new THREE.ArrowHelper(new THREE.Vector3(...d), new THREE.Vector3(), .28, RGB[i], .07, .045); a.traverse((o) => { if (o.material) { o.material.depthTest = false; o.material.transparent = true; } o.renderOrder = 22; }); this.group.add(a); return a; });
    this.update(0);
  }
  set(p) { this.manual = p ? { ...p } : null; this.update(0); return this.stats; }
  params(t) {
    // 自动：沿一个会越出三角形的椭圆绕行，高度一升一落，三角形周期性变窄再张开
    return { u: .33 + .45 * Math.cos(t * .9), v: .33 + .45 * Math.sin(t * 1.3), h: Math.max(0, .45 * Math.sin(t * .7)), spread: 1 + .45 * Math.sin(t * .5) };
  }
  update(dt) {
    this.t += dt || 0; const s = gizmoState(this.tri, this.manual ?? this.params(this.t)), V = (p) => new THREE.Vector3(p.x, p.y, p.z);
    const e = this.edge.geometry.attributes.position; [s.A, s.B, s.C].forEach((p, i) => e.setXYZ(i, p.x, p.y, p.z)); e.needsUpdate = true;
    [s.A, s.B, s.C].forEach((p, i) => {
      const a = this.spokes[i].geometry.attributes.position; a.setXYZ(0, p.x, p.y, p.z); a.setXYZ(1, s.Q.x, s.Q.y, s.Q.z); a.needsUpdate = true;
      this.spokes[i].material.opacity = s.w[i] < 0 ? .35 : 1;
      const d = this.dots[i]; d.position.copy(V(p)); d.scale.setScalar(.018 + .05 * Math.min(1.5, Math.abs(s.w[i]))); d.material.color.setHex(RGB[i]).multiplyScalar(s.w[i] < 0 ? .35 : 1);
    });
    const dr = this.drop.geometry.attributes.position; dr.setXYZ(0, s.P.x, s.P.y, s.P.z); dr.setXYZ(1, s.Q.x, s.Q.y, s.Q.z); dr.needsUpdate = true;
    this.point.position.copy(V(s.P)); this.proj.position.copy(V(s.Q)); for (const a of this.arrows) a.position.copy(V(s.P));
    this.stats = { cell: this.cell.id, w: s.w.map((x) => +x.toFixed(4)), cramerErr: s.err, height: +s.height.toFixed(4), inside: s.inside, ops: s.ops, spread: +(this.manual?.spread ?? this.params(this.t).spread).toFixed(3) };
    return this.stats;
  }
  dispose() { this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); this.group.removeFromParent(); }
}
