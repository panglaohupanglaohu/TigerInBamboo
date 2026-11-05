/**
 * trigraph.js — 通用三角图：增量 Delaunay（Bowyer–Watson）+ 流形检查。
 *
 * 依据：
 *   1677242779162877952 "rewriting my generic triangle graph system to (hopefully) be more robust and generic.
 *     Here's a stress test where I'm adding random verts, making sure the graph stays mainifold and delauney-ish"
 *     全279帧可见不规则线框逐步扩展与局部彩色边变化；视觉不能证明无重叠或严格 Delaunay。
 *   1338829205157646336 "one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection …
 *     My points are sorted vertically, which means radially, which makes the algorithm faster"
 *     画面：投影平面上，中心是密集小三角、越往外越大，最外面一个超级三角。
 *
 * API：
 *   const T = new TriGraph();           // 平面
 *   T.add(x, y) → 内部顶点序号（含3个超级顶点，坏输入拒绝且不占序号）；内部维护 tris（[a, b, c] 逆时针）
 *   T.triangles() → 去掉超级三角之后的三角形
 *   T.check() → { manifold, delaunay }：每条边最多被两个三角共用、方向相反；外接圆抽样检查（确定性取样；Infinity全查，仍使用浮点容差）
 */

export class TriGraph {
  constructor(bound = 1e5) {
    if (!Number.isFinite(bound) || bound <= 0 || bound > 1e70) throw new RangeError('bound must be finite and positive (<= 1e70)');
    this.bound = bound;
    this.x = [-bound * 3, bound * 3, 0];
    this.y = [-bound * 3, -bound * 3, bound * 3];
    this.tris = [[0, 1, 2]];
    this.circ = [this.#circum(0, 1, 2)];
  }

  #circum(a, b, c) {
    const { x, y } = this;
    const ax = x[a], ay = y[a], bx = x[b], by = y[b], cx = x[c], cy = y[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return [ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2];
  }

  /** 加一个点：删掉外接圆包含它的三角（"坏三角"），用空洞的边界连到新点 */
  add(px, py) {
    if (!Number.isFinite(px) || !Number.isFinite(py)) throw new TypeError('coordinates must be finite');
    // The fixed super triangle is the supported domain. Reject before changing input IDs.
    const b = this.bound;
    if (!(py > -3*b && py < 3*b - 2*Math.abs(px))) throw new RangeError('point outside super triangle');
    for (let i = 3; i < this.x.length; i++) {
      if (this.x[i] === px && this.y[i] === py) throw new RangeError('duplicate point');
    }
    const id = this.x.length;
    const bad = [];
    for (let t = 0; t < this.tris.length; t++) {
      const [ux, uy, r2] = this.circ[t];
      if ((px - ux) ** 2 + (py - uy) ** 2 < r2 * (1 + 1e-12)) bad.push(t);
    }
    if (!bad.length) throw new RangeError('no insertion cavity; graph unchanged');
    this.x.push(px); this.y.push(py);
    // 空洞边界 = 坏三角里只出现一次的边
    const edges = new Map();
    for (const t of bad) {
      const [a, b, c] = this.tris[t];
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const k = u < v ? u + ',' + v : v + ',' + u;
        if (edges.has(k)) edges.delete(k); else edges.set(k, [u, v]);
      }
    }
    for (let i = bad.length - 1; i >= 0; i--) {
      const t = bad[i], last = this.tris.length - 1;
      this.tris[t] = this.tris[last]; this.circ[t] = this.circ[last];
      this.tris.pop(); this.circ.pop();
    }
    for (const [u, v] of edges.values()) { this.tris.push([u, v, id]); this.circ.push(this.#circum(u, v, id)); }
    return id;
  }

  /** 去掉超级三角的三个顶点；返回的顶点号减 3，和输入点的顺序一致 */
  triangles() {
    return this.tris.filter((t) => t[0] > 2 && t[1] > 2 && t[2] > 2).map((t) => t.map((v) => v - 3));
  }

  /** 流形 + 近 Delaunay 体检（1677242779162877952 的"stress test"） */
  check(samples = 200) {
    if (samples !== Infinity && (!Number.isInteger(samples) || samples < 0)) throw new RangeError('samples must be a nonnegative integer or Infinity');
    const edges = new Map(), faces = new Set(), referenced = new Set();
    let manifold = true, finite = this.x.every(Number.isFinite) && this.y.every(Number.isFinite), degenerate = 0;
    for (let t = 0; t < this.tris.length; t++) {
      const tri = this.tris[t], key = [...tri].sort((a,b)=>a-b).join(',');
      if (faces.has(key)) manifold = false;
      faces.add(key);
      const valid = tri.length === 3 && new Set(tri).size === 3 && tri.every(v=>Number.isInteger(v) && v>=0 && v<this.x.length);
      if (!valid) { manifold = false; degenerate++; continue; }
      tri.forEach(v=>referenced.add(v));
      const [a,b,c] = tri;
      const area = (this.x[b]-this.x[a])*(this.y[c]-this.y[a])-(this.y[b]-this.y[a])*(this.x[c]-this.x[a]);
      if (!(area > 0)) { manifold = false; degenerate++; }
      if (!this.circ[t]?.every(Number.isFinite)) finite = false;
      for (const [u,v] of [[a,b],[b,c],[c,a]]) {
        const k = u < v ? u+','+v : v+','+u;
        const uses = edges.get(k) || []; uses.push([u,v]); edges.set(k,uses);
      }
    }
    for (const uses of edges.values()) {
      if (uses.length > 2 || (uses.length === 2 && uses[0][0] !== uses[1][1])) manifold = false;
    }
    const orphanVertices = this.x.length - referenced.size;
    // Evenly spaced deterministic faces; Infinity requests every face, never random evidence.
    const checkedTriangles = Math.min(samples, this.tris.length);
    let delaunay = finite && degenerate === 0;
    for (let s = 0; s < checkedTriangles; s++) {
      const t = Math.floor(s * this.tris.length / checkedTriangles);
      const circle = this.circ[t];
      if (!circle || !circle.every(Number.isFinite)) { delaunay = false; continue; }
      const [ux,uy,r2] = circle, tri = this.tris[t];
      for (let i=3; i<this.x.length; i++) {
        if (tri.includes(i)) continue;
        if ((this.x[i]-ux)**2+(this.y[i]-uy)**2 < r2*(1-1e-9)) { delaunay = false; break; }
      }
    }
    return {manifold: manifold && finite && !orphanVertices, delaunay, tris:this.tris.length,
      finite, degenerate, orphanVertices, checkedTriangles, full:checkedTriangles === this.tris.length};
  }
}
