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
  // 离岛心最近、四周同高的陆格（三角形完整躺在一块台地上）；先按"周边 2 圈最高点最低"挑空旷处，
  // 否则相机/三角形会被贴着的塔基挡住（原片背景是一片开阔灰地 + 三角网）。
  const flat = world.cells.filter((c) => world.top(c) >= minTop && !world.topIsBuilt(c) && c.edgeNeighbors.every((n) => n >= 0 && world.top(world.cells[n]) === world.top(c)));
  if (!flat.length) throw new RangeError('no flat land cell for the gizmo');
  const clearance = (c) => { let m = 0; for (const o of world.cells) { const d = Math.hypot(o.cx - c.cx, o.cz - c.cz); if (d <= 2.4 && world.top(o) > m) m = world.top(o); } return m - world.top(c); };
  return flat.reduce((a, b) => { const ca = clearance(a), cb = clearance(b); if (ca !== cb) return cb < ca ? b : a; return Math.hypot(b.cx, b.cz) < Math.hypot(a.cx, a.cz) ? b : a; });
}

/** 三角形面积（3D，只用于读数：拖第三个顶点时面积随 spread² 变）。 */
export function triArea(a, b, c) {
  const u = [b.x - a.x, b.y - a.y, b.z - a.z], v = [c.x - a.x, c.y - a.y, c.z - a.z];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return Math.hypot(...n) / 2;
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
    // 三个边用细长盒子画（LineBasicMaterial 的 linewidth 在 WebGL 里恒 1px，原片的白边比 1px 粗）
    this.edge = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, .012, .012), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })); m.renderOrder = 21; m.frustumCulled = false; this.group.add(m); return m; });
    this.spokes = RGB.map((c) => line(c)); this.drop = line(0xffffff);
    this.dots = RGB.map((c) => ball(c, 1)); this.point = ball(0xffffff, .045); this.proj = ball(0xffffff, .02);
    this.arrows = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((d, i) => { const a = new THREE.ArrowHelper(new THREE.Vector3(...d), new THREE.Vector3(), .28, RGB[i], .07, .045); a.traverse((o) => { if (o.material) { o.material.depthTest = false; o.material.transparent = true; } o.renderOrder = 22; }); this.group.add(a); return a; });
    this.update(0);
  }
  set(p) { this.manual = p ? { ...p } : null; this.update(0); return this.stats; }
  /** 自动轨迹：沿一个会越出三角形的椭圆绕行，高度一升一落，三角形周期性变窄再张开。 */
  autoParams(t) {
    return { u: .33 + .45 * Math.cos(t * .9), v: .33 + .45 * Math.sin(t * 1.3), h: Math.max(0, .45 * Math.sin(t * .7)), spread: 1 + .45 * Math.sin(t * .5) };
  }
  /** 当帧参数（manual 优先，否则按时间自动）。 */
  params() { return this.manual ?? this.autoParams(this.t); }
  /** 当帧几何（页面/测试共用，不读日志）。 */
  state() { return this.s; }
  update(dt) {
    this.t += dt || 0; const p = this.params(), s = gizmoState(this.tri, p), V = (q) => new THREE.Vector3(q.x, q.y, q.z);
    // 边：A→B、B→C、C→A，盒子沿边摆（位置=中点，朝向=边方向，长度=边长）
    [s.A, s.B, s.C].forEach((p, i) => {
      const q = [s.B, s.C, s.A][i], m = this.edge[i], d = new THREE.Vector3(q.x - p.x, q.y - p.y, q.z - p.z), len = d.length() || 1e-6;
      m.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
      m.scale.set(len, 1, 1);
    });
    [s.A, s.B, s.C].forEach((p, i) => {
      const a = this.spokes[i].geometry.attributes.position; a.setXYZ(0, p.x, p.y, p.z); a.setXYZ(1, s.Q.x, s.Q.y, s.Q.z); a.needsUpdate = true;
      this.spokes[i].material.opacity = s.w[i] < 0 ? .35 : 1;
      const d = this.dots[i]; d.position.copy(V(p)); d.scale.setScalar(.018 + .05 * Math.min(1.5, Math.abs(s.w[i]))); d.material.color.setHex(RGB[i]).multiplyScalar(s.w[i] < 0 ? .35 : 1);
    });
    const dr = this.drop.geometry.attributes.position; dr.setXYZ(0, s.P.x, s.P.y, s.P.z); dr.setXYZ(1, s.Q.x, s.Q.y, s.Q.z); dr.needsUpdate = true;
    this.point.position.copy(V(s.P)); this.proj.position.copy(V(s.Q)); for (const a of this.arrows) a.position.copy(V(s.P));
    this.s = s;
    this.stats = { cell: this.cell.id, w: s.w.map((x) => +x.toFixed(4)), cramerErr: s.err, height: +s.height.toFixed(4), inside: s.inside, ops: s.ops, spread: +p.spread.toFixed(3), drag: this.dragStats ?? null, u: +p.u.toFixed(4), v: +p.v.toFixed(4), h: +p.h.toFixed(4), area: +triArea(s.A, s.B, s.C).toFixed(5) };
    return this.stats;
  }
  /**
   * 真实指针拖拽 —— 片子里鼠标光标一直按在白球上：抓球 = 在三角面内改 u/v（球可越出三角形），
   * 抓第三个顶点 = 沿中线拉窄/张开三角形（spread）。命中判定走屏幕像素（球可能离面很高）。
   */
  attach(canvas, { pickPx = 26 } = {}) {
    const cam = this.view.camera, nd = new THREE.Vector2(), ray = new THREE.Raycaster(), v3 = new THREE.Vector3();
    const rect = () => canvas.getBoundingClientRect();
    const toPx = (p) => { v3.set(p.x, p.y, p.z).project(cam); const r = rect(); return { x: r.left + (v3.x * .5 + .5) * r.width, y: r.top + (-v3.y * .5 + .5) * r.height }; };
    const planeHit = (ev) => {
      const r = rect(); nd.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(nd, cam);
      const s = this.state(), plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...s.normal), new THREE.Vector3(s.A.x, s.A.y, s.A.z));
      const hit = new THREE.Vector3(); return ray.ray.intersectPlane(plane, hit) ? hit : null;
    };
    // Shift + 拖球 = 把球沿三角面法线抬起来（原片里球是真的被拖离平面的，不是拉滑杆）。
    // 轴向拖拽要用"射线与轴线最近点"，不能拿"过球且垂直视线"的平面去截 —— 那样截点永远在那个平面上，位移恒 0（本轮踩过）。
    const axisT = (ev, p0, axis) => {
      const r = rect(); nd.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(nd, cam);
      const o = ray.ray.origin, v = [ray.ray.direction.x, ray.ray.direction.y, ray.ray.direction.z], w0 = [p0.x - o.x, p0.y - o.y, p0.z - o.z];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const A = dot(axis, axis), B = dot(axis, v), C = dot(v, v), D = dot(axis, w0), E = dot(v, w0), den = A * C - B * B;
      return Math.abs(den) < 1e-9 ? 0 : (B * E - C * D) / den;
    };
    const apply = (ev, drag) => {
      if (drag.kind === 'lift') {
        const s = this.state(), t = axisT(ev, drag.from, s.normal);
        const p = { ...drag.p0, h: Math.max(0, Math.min(0.8, drag.h0 + t)) };
        this.manual = p; this.update(0);
        this.dragStats.moves++; this.dragStats.last = { u: +p.u.toFixed(4), v: +p.v.toFixed(4), h: +p.h.toFixed(4) };
        return true;
      }
      const hit = planeHit(ev); if (!hit) return false;
      const p = { ...this.params() }, s = this.state();
      if (drag.kind === 'ball') {
        const q = baryPrep3(s.A, s.B, s.C), w = q(hit.x, hit.y, hit.z);
        p.u = w[1]; p.v = w[2];
      } else {
        const M = { x: (s.A.x + s.B.x) / 2, y: (s.A.y + s.B.y) / 2, z: (s.A.z + s.B.z) / 2 }, C0 = this.tri[2];
        const d = [C0.x - M.x, C0.y - M.y, C0.z - M.z], l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
        p.spread = Math.max(.3, Math.min(1.8, l2 > 0 ? ((hit.x - M.x) * d[0] + (hit.y - M.y) * d[1] + (hit.z - M.z) * d[2]) / l2 : 1));
      }
      this.manual = p; this.update(0);
      const r0 = rect();
      this.dragStats.moves++; this.dragStats.last = { raw: [+(ev.clientX).toFixed(1), +(ev.clientY).toFixed(1)], rect: [r0.left, r0.top, r0.width, r0.height], x: +(ev.clientX - r0.left).toFixed(1), y: +(ev.clientY - r0.top).toFixed(1), u: +p.u.toFixed(4), v: +p.v.toFixed(4), hit: [+hit.x.toFixed(4), +hit.y.toFixed(4), +hit.z.toFixed(4)] };
      return true;
    };
    const ac = new AbortController(), sig = ac.signal;
    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const s = this.state(), a = toPx(s.P), c = toPx(s.C);
      const onBall = Math.hypot(a.x - ev.clientX, a.y - ev.clientY) <= pickPx;
      const kind = onBall ? (ev.shiftKey ? 'lift' : 'ball') : Math.hypot(c.x - ev.clientX, c.y - ev.clientY) <= pickPx ? 'vertex' : null;
      if (!kind) return;                                     // 没抓到 gizmo 就把事件让给场景（涂格/转镜）
      ev.stopImmediatePropagation(); ev.preventDefault();     // 抓到就必须吃掉，否则 index 的左键会开始画格
      try { canvas.setPointerCapture?.(ev.pointerId); } catch { /* 合成事件里 pointerId 可能不存在，忽略 */ }
      const pNow = { ...this.params() };
      this.drag = { kind, from: { ...s.P }, h0: pNow.h, p0: pNow };
      this.dragStats = { mode: kind, starts: (this.dragStats?.starts ?? 0) + 1, moves: 0, ends: this.dragStats?.ends ?? 0 };
      this.onDragStart?.(kind); apply(ev, this.drag);
    }, { signal: sig, capture: true });
    window.addEventListener('pointermove', (ev) => { if (this.drag) { ev.preventDefault(); apply(ev, this.drag); } }, { signal: sig });
    window.addEventListener('pointerup', () => { if (this.drag) { this.dragStats.ends = (this.dragStats.ends ?? 0) + 1; this.drag = null; this.onDragEnd?.(this.params()); } }, { signal: sig });
    this._attachAc = ac; return this;
  }
  dispose() { this._attachAc?.abort(); this.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); this.group.removeFromParent(); }
}
