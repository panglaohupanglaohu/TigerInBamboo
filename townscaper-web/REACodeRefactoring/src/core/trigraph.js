/**
 * trigraph.js — 通用三角图：增量 Delaunay（Bowyer–Watson）+ 流形检查。
 *
 * 依据：
 *   1677242779162877952 "rewriting my generic triangle graph system to (hopefully) be more robust and generic.
 *     Here's a stress test where I'm adding random verts, making sure the graph stays mainifold and delauney-ish"
 *     画面：一个点一个点往里加，三角网一直保持干净（没有重叠、没有破洞）。
 *   1338829205157646336 "one way to do Delaunay Triangulation on a sphere is to do it on a Stereographic Projection …
 *     My points are sorted vertically, which means radially, which makes the algorithm faster"
 *     画面：投影平面上，中心是密集小三角、越往外越大，最外面一个超级三角。
 *
 * API：
 *   const T = new TriGraph();           // 平面
 *   T.add(x, y) → 顶点序号；内部维护 tris（[a, b, c] 逆时针）
 *   T.triangles() → 去掉超级三角之后的三角形
 *   T.check() → { manifold, delaunay }：每条边最多被两个三角共用、方向相反；外接圆里没有别的点（抽样）
 */

export class TriGraph {
  constructor(bound = 1e5) {
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
    const id = this.x.length;
    this.x.push(px); this.y.push(py);
    const bad = [];
    for (let t = 0; t < this.tris.length; t++) {
      const [ux, uy, r2] = this.circ[t];
      if ((px - ux) ** 2 + (py - uy) ** 2 < r2 * (1 + 1e-12)) bad.push(t);
    }
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
    const use = new Map();
    let manifold = true;
    for (const [a, b, c] of this.tris) {
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const k = u + ',' + v;
        if (use.has(k)) manifold = false;   // 同一条有向边出现两次 = 重叠 / 翻折
        use.set(k, 1);
      }
    }
    let delaunay = true;
    const n = this.x.length;
    for (let s = 0; s < samples && this.tris.length; s++) {
      const t = (Math.random() * this.tris.length) | 0;
      const [ux, uy, r2] = this.circ[t];
      const [a, b, c] = this.tris[t];
      for (let i = 3; i < n; i++) {
        if (i === a || i === b || i === c) continue;
        if ((this.x[i] - ux) ** 2 + (this.y[i] - uy) ** 2 < r2 * (1 - 1e-9)) { delaunay = false; break; }
      }
    }
    return { manifold, delaunay, tris: this.tris.length };
  }
}
