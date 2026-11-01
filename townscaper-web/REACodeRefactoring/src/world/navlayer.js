/**
 * navlayer.js — 把 navgraph 画出来：
 *   楼梯（默认开）：落差 1 层的区域之间一架三级台阶，贴着高的那一侧崖壁（1181464374839521280）
 *   导航图调试（toggle 'nav'）：最短路树 —— 颜色 = 从起点走过去的时间（青 → 橙），
 *     河上的边是白色、并且明显"更远也更快"；区域节点 = 白点（1582293326815862786 / 1795831296952041691）
 */

import * as THREE from 'three';
import { buildNav } from './navgraph.js';

export class NavLayer {
  constructor({ scene, levelHeight = 0.5 }) {
    this.L = levelHeight;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.stairs = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xbfb197, roughness: 0.95, flatShading: true }));
    this.stairs.castShadow = true; this.stairs.receiveShadow = true;
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }));
    this.nodes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: false, depthTest: false }));
    this.lines.renderOrder = this.nodes.renderOrder = 20;
    this.lines.visible = this.nodes.visible = false;
    this.group.add(this.stairs, this.lines, this.nodes);
    this.nav = null;
  }

  set showGraph(on) { this.lines.visible = this.nodes.visible = on; }
  set showStairs(on) { this.stairs.visible = on; }

  refresh(world, shape) {
    const nav = (this.nav = buildNav(world));
    const L = this.L;
    const at = (p, s) => (shape ? shape.at(p, s) : [p.x, p.z]);

    // ---- 楼梯 ----
    const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    const bp = box.attributes.position.array, bn = box.attributes.normal.array;
    const pos = [], nor = [];
    const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
    for (const s of nav.stairs) {
      const c = s.low, h = nav.hgt[c.id], i = s.edge;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      // 崖壁经过笼形变形，底部比顶边更往外：贴着墙脚（切面 h）放，否则会埋进墙里
      const [ax, az] = at(a, h), [bx, bz] = at(b, h);   // 墙脚
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const ux = bx - ax, uz = bz - az, len = Math.hypot(ux, uz);
      if (len < 0.2) continue;
      // 朝低格中心的方向
      let vx = -uz / len, vz = ux / len;
      // 低格中心也要用变形后的（切面 h 上各角点的平均），否则边被推开时方向会反
      let ccx = 0, ccz = 0;
      for (const p of c.pts) { const [x, z] = at(p, h); ccx += x / c.n; ccz += z / c.n; }
      if ((ccx - mx) * vx + (ccz - mz) * vz < 0) { vx = -vx; vz = -vz; }
      const rise = s.rise || 1, width = Math.min(0.36, len * 0.6), steps = rise * 3, depth = 0.11;
      for (let k = 0; k < steps; k++) {
        const top = h * L + (rise * L * (steps - k)) / steps;          // 最靠墙的一级最高
        const cx = mx + vx * (depth * (k + 0.5)), cz = mz + vz * (depth * (k + 0.5));
        const y0 = h * L - 0.02;
        m.makeBasis(v.set(ux / len, 0, uz / len), new THREE.Vector3(0, 1, 0), new THREE.Vector3(vx, 0, vz));
        m.scale(new THREE.Vector3(width, top - y0, depth));
        m.setPosition(cx, (top + y0) / 2, cz);
        nm.getNormalMatrix(m);
        for (let j = 0; j < bp.length; j += 3) {
          v.set(bp[j], bp[j + 1], bp[j + 2]).applyMatrix4(m); pos.push(v.x, v.y, v.z);
          v.set(bn[j], bn[j + 1], bn[j + 2]).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
        }
      }
    }
    box.dispose();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    this.stairs.geometry.dispose(); this.stairs.geometry = sg;

    // ---- 最短路树 ----
    const { parent, time } = nav.tree;
    let tmax = 0;
    for (const t of time) if (Number.isFinite(t)) tmax = Math.max(tmax, t);
    const lp = [], lc = [], cA = new THREE.Color(0x3fd6d0), cB = new THREE.Color(0xff8a3d), cR = new THREE.Color(0xffffff), col = new THREE.Color();
    for (const c of world.cells) {
      const p = parent[c.id];
      if (p < 0) continue;
      const q = world.cells[p];
      const river = world.river[c.id] && world.river[p];
      col.copy(river ? cR : cA).lerp(river ? cR : cB, Math.min(1, time[c.id] / (tmax || 1)));
      lp.push(q.cx, nav.hgt[p] * L + 0.06, q.cz, c.cx, nav.hgt[c.id] * L + 0.06, c.cz);
      lc.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    this.lines.geometry.dispose(); this.lines.geometry = lg;

    const np = [];
    for (const r of nav.regions) np.push(r.cx, r.h * L + 0.1, r.cz);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
    this.nodes.geometry.dispose(); this.nodes.geometry = ng;
    return nav;
  }
}
