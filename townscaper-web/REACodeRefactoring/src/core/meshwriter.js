/**
 * meshwriter.js — 所有网格生成器共用的顶点池（Placemaker.BigMesh）。
 *
 * 地形、建筑都往同一个 MeshWriter 里写三角形，最后整体烘焙光照、一次 draw call
 * （1401145625572425728：自己合并网格让 Switch 上渲染快了约 3 倍）。
 * 每个三角形按给定的"朝向"自动翻转绕序，调用方不用关心顶点顺序。
 *
 * 软法线（1062374549407350790 Bad North "extra smoothing … using my voxel normals"）：
 *   writer.soft = true 期间写入的三角形，法线在同一位置的软顶点之间平均，
 *   但只和夹角小于 softAngle 的面平均 —— 弯曲的崖壁变圆润，崖顶边缘仍然是硬的。
 */

import * as THREE from 'three';

export const UP = [0, 1, 0];
export const DOWN = [0, -1, 0];

export class MeshWriter {
  constructor() {
    this.pos = [];
    this.col = [];
    this.glow = [];
    this.field = [];
    this.fieldFrame = null; // [axisX, axisZ, optional caller-owned surface kind]; null writes zero.
    this.softTri = [];      // 每个三角形一个标记
    this.soft = false;
    this.softAngle = 55;
    this.colorCache = new Map();
  }

  /** 十六进制颜色 → THREE.Color（线性空间），带缓存。 */
  c(hex) {
    let c = this.colorCache.get(hex);
    if (!c) this.colorCache.set(hex, (c = new THREE.Color(hex)));
    return c;
  }

  tri(a, b, c, dir, color, s0 = 1, s1 = s0, s2 = s0, g = 0) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (dir && nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) { [b, c] = [c, b]; [s1, s2] = [s2, s1]; }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.col.push(color.r * s0, color.g * s0, color.b * s0, color.r * s1, color.g * s1, color.b * s1, color.r * s2, color.g * s2, color.b * s2);
    this.glow.push(g, g, g);
    const q = this.fieldFrame;
    for (const p of [a, b, c]) this.field.push(q ? p[0]*q[0]+p[2]*q[1] : 0, q ? -p[0]*q[1]+p[2]*q[0] : 0, q ? (q[2] ?? 1) : 0);
    this.softTri.push(this.soft ? 1 : 0);
  }

  /** 三个顶点各自的颜色（本地顶面混色；不是投射/手工UV patch）。 */
  triC(a, b, c, dir, ca, cb, cc, g = 0) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (dir && nx * dir[0] + ny * dir[1] + nz * dir[2] < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    this.glow.push(g, g, g);
    const q = this.fieldFrame;
    for (const p of [a, b, c]) this.field.push(q ? p[0]*q[0]+p[2]*q[1] : 0, q ? -p[0]*q[1]+p[2]*q[0] : 0, q ? (q[2] ?? 1) : 0);
    this.softTri.push(this.soft ? 1 : 0);
  }

  /** 凸多边形（格子的顶面、洞顶）：扇形三角化。 */
  poly(pts, dir, color, s = 1, g = 0) {
    for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], dir, color, s, s, s, g);
  }

  quad(a, b, c, d, dir, color, s = 1, g = 0, s2 = s) {
    this.tri(a, b, c, dir, color, s, s, s2, g);
    this.tri(a, c, d, dir, color, s, s2, s2, g);
  }

  /** 方截面梁（钢架、栏杆、树干）。 */
  beam(a, b, thick, color, shade = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    let px = 0, py = 1, pz = 0;
    if (Math.abs(uy) > 0.9) { px = 1; py = 0; }
    let nx = uy * pz - uz * py, ny = uz * px - ux * pz, nz = ux * py - uy * px;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const bx = uy * nz - uz * ny, by = uz * nx - ux * nz, bz = ux * ny - uy * nx;
    const h = thick / 2;
    const P = (p, s1, s2) => [p[0] + (nx * s1 + bx * s2) * h, p[1] + (ny * s1 + by * s2) * h, p[2] + (nz * s1 + bz * s2) * h];
    const ring = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let k = 0; k < 4; k++) {
      const [s1, s2] = ring[k];
      const [t1, t2] = ring[(k + 1) % 4];
      const out = [nx * (s1 + t1) + bx * (s2 + t2), ny * (s1 + t1) + by * (s2 + t2), nz * (s1 + t1) + bz * (s2 + t2)];
      this.quad(P(a, s1, s2), P(b, s1, s2), P(b, t1, t2), P(a, t1, t2), out, color, shade);
    }
  }

  box(cx, y0, cz, sx, sy, sz, color, shade = 1) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = y0 + sy;
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], color, shade);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], color, shade);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], color, shade);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color, shade);
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], UP, color, shade * 1.05);
  }

  /** 低多边形团块（八面体细分一次）：树冠、灌木。 */
  blob(cx, cy, cz, rx, ry, color) {
    const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const F = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
    const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const mid = (p, q) => norm([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
    const P = (v) => [cx + v[0] * rx, cy + v[1] * ry, cz + v[2] * rx];
    for (const [i, j, k] of F) {
      const a = V[i], b = V[j], c = V[k];
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      for (const [p, q, r] of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) {
        const m = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[2] + q[2] + r[2]) / 3];
        this.tri(P(p), P(q), P(r), m, color, 0.82 + 0.3 * Math.max(0, m[1]));
      }
    }
  }

  get triangles() { return this.pos.length / 9; }

  /**
   * normal：面法线；软三角形的顶点按位置分组、按夹角阈值平均。
   * outline：同一位置所有面的法线平均（不分软硬），描边沿它外扩，拐角不会裂开。
   */
  normals(halo = null) {
    // halo：相邻块的三角形 { pos, soft }，只参与平均、不输出（分块后接缝处法线一致）
    const pos = this.pos, T = pos.length / 9;
    const hp = halo ? halo.pos : [], HT = hp.length / 9;
    const fn = new Float32Array((T + HT) * 3), fa = new Float32Array(T + HT);
    const soft = (t) => (t < T ? this.softTri[t] : halo.soft[t - T]);
    for (let t = 0; t < T + HT; t++) {
      const P = t < T ? pos : hp, o = (t < T ? t : t - T) * 9;
      const ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2];
      const vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l; fa[t] = l;
    }
    const out = new Float32Array(T * 9);
    for (let t = 0; t < T; t++) for (let v = 0; v < 3; v++) out.set(fn.subarray(t * 3, t * 3 + 3), t * 9 + v * 3);
    // 按位置分组所有顶点
    const groups = new Map();
    const q = (x) => Math.round(x * 2000);
    for (let t = 0; t < T; t++) {
      for (let v = 0; v < 3; v++) {
        const o = t * 9 + v * 3;
        const key = q(pos[o]) + ',' + q(pos[o + 1]) + ',' + q(pos[o + 2]);
        let g = groups.get(key);
        if (!g) groups.set(key, (g = []));
        g.push(t * 3 + v);
      }
    }
    for (let t = 0; t < HT; t++) {
      for (let v = 0; v < 3; v++) {
        const o = t * 9 + v * 3;
        const g = groups.get(q(hp[o]) + ',' + q(hp[o + 1]) + ',' + q(hp[o + 2]));
        if (g) g.push((T + t) * 3 + v);
      }
    }
    const outline = new Float32Array(T * 9);
    const cosT = Math.cos(this.softAngle * Math.PI / 180);
    for (const g of groups.values()) {
      let ox = 0, oy = 0, oz = 0;
      for (const b of g) { const tb = (b / 3) | 0; ox += fn[tb * 3]; oy += fn[tb * 3 + 1]; oz += fn[tb * 3 + 2]; }
      const ol = Math.hypot(ox, oy, oz) || 1;
      for (const a of g) { if (a < T * 3) { outline[a * 3] = ox / ol; outline[a * 3 + 1] = oy / ol; outline[a * 3 + 2] = oz / ol; } }
      if (g.length < 2) continue;
      for (const a of g) {
        if (a >= T * 3 || !soft((a / 3) | 0)) continue;
        const ta = (a / 3) | 0;
        let sx = 0, sy = 0, sz = 0;
        for (const b of g) {
          const tb = (b / 3) | 0;
          if (!soft(tb)) continue;
          const d = fn[ta * 3] * fn[tb * 3] + fn[ta * 3 + 1] * fn[tb * 3 + 1] + fn[ta * 3 + 2] * fn[tb * 3 + 2];
          if (d < cosT) continue;
          const wgt = Math.min(fa[tb], 0.5);
          sx += fn[tb * 3] * wgt; sy += fn[tb * 3 + 1] * wgt; sz += fn[tb * 3 + 2] * wgt;
        }
        const l = Math.hypot(sx, sy, sz);
        if (l > 1e-6) { out[a * 3] = sx / l; out[a * 3 + 1] = sy / l; out[a * 3 + 2] = sz / l; }
      }
    }
    return { normal: out, outline };
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.setAttribute('aField', new THREE.Float32BufferAttribute(this.field, 3));
    const { normal, outline } = this.normals();
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    g.setAttribute('aOutline', new THREE.Float32BufferAttribute(outline, 3));   // 描边外扩方向（world/outline.js）
    g.computeBoundingSphere();
    return g;
  }
}

/** 格子第 i 条边的单位外法线（指离格心）。 */
export function edgeOut(cell, i) {
  const a = cell.pts[i], b = cell.pts[(i + 1) % cell.pts.length];
  let nx = -(b.z - a.z), nz = b.x - a.x;
  const l = Math.hypot(nx, nz) || 1;
  nx /= l; nz /= l;
  if (nx * ((a.x + b.x) / 2 - cell.cx) + nz * ((a.z + b.z) / 2 - cell.cz) < 0) { nx = -nx; nz = -nz; }
  return [nx, nz];
}
