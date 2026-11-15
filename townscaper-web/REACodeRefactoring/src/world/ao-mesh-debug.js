/**
 * ao-mesh-debug.js — 把 AO 烘焙用的那层体素壳画出来（1298689301488775169 第四个视图
 * "my AO baking mesh"）。
 *
 * 本仓的 AO 不是在多边形网格上打射线，而是 src/light/bake.js 里的**分层占用栅格**：
 * 每个实心体素把它那一层写进栅格，模糊两遍再采样回顶点。所以「烘焙网格」在这里等于
 * 每个 (格, 层) 实心体素的外壳 —— 只画朝向空气的那几面，颜色按该层邻居的占用度压暗
 * （邻居越堵越暗），这就是烘焙真正在用的那层几何。
 */

import * as THREE from 'three';

/**
 * @param {import('../core/world.js').World} world
 * @param {{ L:number, shape?:object, strength?:number }} o
 * @returns {THREE.BufferGeometry}
 */
export function buildBakeShellGeometry(world, { L, shape = null, strength = 0.62 }) {
  if (!world?.cells) throw new TypeError('buildBakeShellGeometry 需要 World');
  const pos = [], col = [];
  const at = shape ? (p, sl) => shape.at(p, sl) : (p) => [p.x, p.z];
  const P = (p, sl, y) => { const [x, z] = at(p, sl); return [x, y, z]; };
  const tri = (a, b, c, k) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) col.push(k, k, k);
  };
  // 该层邻里的占用度：4 个边邻 + 上方一格，0 = 全空（最亮）
  const occupancy = (c, lv) => {
    let n = 0;
    for (let i = 0; i < c.n; i++) {
      const nb = world.neighbor(c, i);
      if (nb && world.isSolid(nb, lv)) n++;
    }
    if (world.isSolid(c, lv + 1)) n++;
    return n;
  };
  for (const c of world.cells) {
    const top = world.top(c);
    for (let lv = 1; lv <= top; lv++) {
      if (!world.isSolid(c, lv)) continue;
      const occ = occupancy(c, lv);
      const k = Math.max(0.15, 0.92 - strength * 0.9 * (occ / (c.n + 1)));
      const y0 = (lv - 1) * L, y1 = lv * L;
      // 侧壁：只画朝向空气的那一面（内部面不画，不然整块是不透光的实心）
      for (let i = 0; i < c.n; i++) {
        const nb = world.neighbor(c, i);
        if (nb && world.isSolid(nb, lv)) continue;
        const p0 = c.pts[i], p1 = c.pts[(i + 1) % c.n];
        const A = P(p0, lv - 1, y0), B = P(p1, lv - 1, y0), C = P(p1, lv, y1), D = P(p0, lv, y1);
        tri(A, B, C, k); tri(A, C, D, k);
      }
      // 顶面：上方是空气时补一块（烘焙采样的就是这一面）
      if (!world.isSolid(c, lv + 1)) {
        const kt = Math.max(0.15, 0.98 - strength * 0.5 * (occ / (c.n + 1)));
        for (let i = 1; i < c.n - 1; i++) {
          tri(P(c.pts[0], lv, y1), P(c.pts[i], lv, y1), P(c.pts[i + 1], lv, y1), kt);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.userData.voxels = pos.length / 18;   // 每 2 个三角形 = 1 个面
  return g;
}
