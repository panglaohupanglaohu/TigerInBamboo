/**
 * marching-cubes.js — 第 56 批 C06：不规则四边形（及三角/多边形）网格上的三维等值面。
 *
 * 1163836000688365571 "Basic marching cubes on my funky grid. Next up is turning this into mixed initiative WFC."
 *   画面：不规则四边形线框地面上，红色实体从一点长成带拱洞的脊、桥、板；面只在格边交点上，
 *   同一格里有两种切分，底面/侧面沿格子阶梯化。
 * 1120036868966502401 "It's marching squares on irregular quadrilateral grids"
 *   画面：编辑器里画一块四边区域 → 生成不规则四边格 → 角点逐个变实 → 深色厚板，板沿切角（marching squares 轮廓）。
 *   这里同一个函数只开一层角点（slab），就是挤出成厚板的 marching squares。
 *
 * 做法（不用 256 情形硬编码表，按面走一圈直接生成每格的等值多边形，等价于带面歧义规则的 marching cubes）：
 *   每格 × 每层 = 一个棱柱体（底环 = 格角点在 l 层，顶环 = l+1 层），角点标量 = value(vertexId, level)。
 *   对体的每个面按「从外面看逆时针」走一圈：外→内的边记「进」，内→外记「出」，
 *   每段连续的内部角点给出一条从「进」到「出」的线段（面歧义一律「内部角点分开」→ 共享面两侧结论相同 → 水密）。
 *   共享的交点在另一面里正好是相反事件，所以线段首尾相接成环；每个环扇形三角化成等值面片。
 *   交点按「顶点 id + 层」的边键全局焊接，插值在规范顺序下做 → 相邻格算出同一个点。
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * @param cells  网格格子：{ id, pts:[{id,x,z}] }（凸多边形，角点有共享 id）
 * @param levels 层数 L（角点层 0..L）
 * @param value  (vertexId, level) → 标量；> iso 为实心
 * @returns { positions:Float32Array, indices:Uint32Array, triangles, vertices, cellsTouched, closed, boundaryEdges, nonManifoldEdges }
 */
export function marchIrregular(cells, { levels, value, iso = .5, levelHeight = .5, yOf = null } = {}) {
  if (!Array.isArray(cells) || !Number.isInteger(levels) || levels < 1 || typeof value !== 'function' || !Number.isFinite(iso)) throw new RangeError('invalid marching cubes input');
  const Y = yOf ?? ((l) => l * levelHeight);
  const verts = [], vkey = new Map(), tris = [];
  // 顶点类别：1 = 格边上的真实交点（等值面只在这里穿过）；0 = 环扇形三角化补的中心点（内部辅助点，不在格边上）
  const kinds = [];
  let fanCenters = 0;
  const vcache = new Map();
  const val = (vid, l) => { const k = vid * 4096 + l; let v = vcache.get(k); if (v === undefined) { v = value(vid, l); if (!Number.isFinite(v)) throw new TypeError('nonfinite field sample'); vcache.set(k, v); } return v; };
  let touched = 0;
  for (const c of cells) {
    const n = c.pts.length;
    if (n < 3) throw new RangeError('invalid cell');
    for (let l = 0; l < levels; l++) {
      // 角点：0..n-1 底环，n..2n-1 顶环
      const K = [];
      for (let k = 0; k < n; k++) K.push({ vid: c.pts[k].id, l, p: [c.pts[k].x, Y(l), c.pts[k].z] });
      for (let k = 0; k < n; k++) K.push({ vid: c.pts[k].id, l: l + 1, p: [c.pts[k].x, Y(l + 1), c.pts[k].z] });
      const ins = K.map((q) => val(q.vid, q.l) > iso);
      if (ins.every((x) => x) || ins.every((x) => !x)) continue;
      touched++;
      const ctr = K.reduce((s, q) => [s[0] + q.p[0] / K.length, s[1] + q.p[1] / K.length, s[2] + q.p[2] / K.length], [0, 0, 0]);
      const faces = [Array.from({ length: n }, (_, k) => k), Array.from({ length: n }, (_, k) => n + k)];
      for (let k = 0; k < n; k++) faces.push([k, (k + 1) % n, n + (k + 1) % n, n + k]);
      // 统一成「从体外看逆时针」：Newell 法向指向体外
      const oriented = faces.map((f) => {
        let nn = [0, 0, 0], fc = [0, 0, 0];
        for (let i = 0; i < f.length; i++) { const a = K[f[i]].p, b = K[f[(i + 1) % f.length]].p; nn[0] += (a[1] - b[1]) * (a[2] + b[2]); nn[1] += (a[2] - b[2]) * (a[0] + b[0]); nn[2] += (a[0] - b[0]) * (a[1] + b[1]); fc = [fc[0] + a[0], fc[1] + a[1], fc[2] + a[2]]; }
        fc = fc.map((x) => x / f.length);
        return dot(nn, sub(fc, ctr)) >= 0 ? f : f.slice().reverse();
      });
      const crossing = (a, b) => {
        const A = K[a], B = K[b];
        const ka = A.vid * 4096 + A.l, kb = B.vid * 4096 + B.l;
        const [lo, hi] = ka < kb ? [A, B] : [B, A];
        const key = (ka < kb ? ka : kb) + '|' + (ka < kb ? kb : ka);
        let id = vkey.get(key);
        if (id === undefined) {
          const vl = val(lo.vid, lo.l), vh = val(hi.vid, hi.l), t = (iso - vl) / (vh - vl);
          id = verts.length / 3; verts.push(lo.p[0] + (hi.p[0] - lo.p[0]) * t, lo.p[1] + (hi.p[1] - lo.p[1]) * t, lo.p[2] + (hi.p[2] - lo.p[2]) * t); kinds.push(1); vkey.set(key, id);
        }
        return id;
      };
      const next = new Map();   // 进 → 出
      for (const f of oriented) {
        const m = f.length, ev = [];
        for (let i = 0; i < m; i++) {
          const a = f[i], b = f[(i + 1) % m];
          if (ins[a] !== ins[b]) ev.push({ enter: ins[b], id: crossing(a, b) });
        }
        // 事件按走向排列：进、出交替；每个「进」和它后面的第一个「出」围住一段连续内部角点
        for (let i = 0; i < ev.length; i++) if (ev[i].enter) { const x = ev[(i + 1) % ev.length]; next.set(ev[i].id, x.id); }
      }
      const used = new Set();
      for (const start of next.keys()) {
        if (used.has(start)) continue;
        const loop = [];
        let cur = start;
        while (!used.has(cur)) { used.add(cur); loop.push(cur); cur = next.get(cur); if (cur === undefined) throw new Error('open iso loop'); }
        if (loop.length < 3) continue;
        // 环按「进→出」顺序直接扇形三角化，法向朝外（指向低值）；meshVolume > 0 已在测试里验证
        if (loop.length === 3) tris.push(loop[0], loop[1], loop[2]);
        else {
          let cx = 0, cy = 0, cz = 0;
          for (const id of loop) { cx += verts[id * 3]; cy += verts[id * 3 + 1]; cz += verts[id * 3 + 2]; }
          const cid = verts.length / 3; verts.push(cx / loop.length, cy / loop.length, cz / loop.length); kinds.push(0); fanCenters++;
          for (let i = 0; i < loop.length; i++) tris.push(cid, loop[i], loop[(i + 1) % loop.length]);
        }
      }
    }
  }
  // 拓扑统计：有向边配对
  const half = new Map();
  for (let i = 0; i < tris.length; i += 3) for (let k = 0; k < 3; k++) { const a = tris[i + k], b = tris[i + (k + 1) % 3]; const key = a + ',' + b; half.set(key, (half.get(key) || 0) + 1); }
  let boundaryEdges = 0, nonManifoldEdges = 0, windingConflicts = 0;
  for (const [key, cnt] of half) { const [a, b] = key.split(','); const back = half.get(b + ',' + a) || 0; if (cnt > 1) windingConflicts++; if (!back) boundaryEdges++; else if (back > 1 || cnt > 1) nonManifoldEdges++; }
  return { positions: new Float32Array(verts), indices: new Uint32Array(tris), triangles: tris.length / 3, vertices: verts.length / 3, cellsTouched: touched, closed: boundaryEdges === 0 && windingConflicts === 0, boundaryEdges, nonManifoldEdges, windingConflicts, vertexKinds: new Uint8Array(kinds), fanCenters };
}

/** 有符号体积（闭合网格）：正 = 法向朝外。用来验证朝向。 */
export function meshVolume({ positions, indices }) {
  let v = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const A = [positions[a], positions[a + 1], positions[a + 2]], B = [positions[b], positions[b + 1], positions[b + 2]], C = [positions[c], positions[c + 1], positions[c + 2]];
    v += dot(A, cross(B, C)) / 6;
  }
  return v;
}

/**
 * 生长场：从一个角点开始，按确定性伪随机逐个点亮相邻角点（同层邻点 + 上下层），偏向水平延伸成脊/桥。
 * 返回 order：[[vid, level]…]，前 k 个为实心 → 第 k 帧的场。邻接来自网格共享角点。
 */
export function growthOrder(cells, { levels, start, seed = 7, count = 400, upBias = .25, minLevel = 1 } = {}) {
  const nb = new Map();
  for (const c of cells) { const n = c.pts.length; for (let k = 0; k < n; k++) { const a = c.pts[k].id, b = c.pts[(k + 1) % n].id; if (!nb.has(a)) nb.set(a, new Set()); if (!nb.has(b)) nb.set(b, new Set()); nb.get(a).add(b); nb.get(b).add(a); } }
  // 网格外圈角点不点亮（保证等值面在网格内闭合）
  const edgeUse = new Map();
  for (const c of cells) { const n = c.pts.length; for (let k = 0; k < n; k++) { const a = c.pts[k].id, b = c.pts[(k + 1) % n].id, key = a < b ? a + ',' + b : b + ',' + a; edgeUse.set(key, (edgeUse.get(key) || 0) + 1); } }
  const rim = new Set(); for (const [key, u] of edgeUse) if (u === 1) for (const id of key.split(',')) rim.add(+id);
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const on = new Set(), order = [], frontier = [], k = (v, l) => v * 4096 + l;
  const push = (v, l) => { if (l < minLevel || l >= levels || rim.has(v) || on.has(k(v, l))) return; on.add(k(v, l)); order.push([v, l]); for (const w of nb.get(v) || []) frontier.push([w, l, 1]); if (l + 1 < levels) frontier.push([v, l + 1, upBias]); if (l - 1 >= minLevel) frontier.push([v, l - 1, upBias * .6]); };
  push(start, minLevel);
  while (order.length < count && frontier.length) {
    // 偏向最近加入的点（形成连贯的脊），按权重抽
    const span = Math.min(frontier.length, 24), base = frontier.length - span;
    let tot = 0; for (let i = base; i < frontier.length; i++) tot += frontier[i][2];
    let r = rnd() * tot, pick = frontier.length - 1;
    for (let i = base; i < frontier.length; i++) { r -= frontier[i][2]; if (r <= 0) { pick = i; break; } }
    const [v, l] = frontier.splice(pick, 1)[0];
    push(v, l);
  }
  return order;
}

/**
 * 1120036868966502401 编辑器的第一步：在画出的四边区域里铺一张不规则四边格。
 * 四个角点 + 一条边外鼓（bulge）→ 双线性映射 nu×nv 格 → 内部点抖动 → 外圈钉住松弛（共享 grid.js relaxPolygons）。
 * 返回 { cells:[{id,n:4,pts:[{id,x,z}]}], verts }，与 buildQuadGrid 的格子同构，可直接喂 marchIrregular。
 */
export function quadRegionGrid(corners, { nu = 8, nv = 7, bulge = .35, jitter = .32, seed = 5, relax = 24, relaxPolygons = null } = {}) {
  if (!Array.isArray(corners) || corners.length !== 4 || !Number.isInteger(nu) || !Number.isInteger(nv) || nu < 1 || nv < 1) throw new RangeError('invalid region');
  const [A, B, Cc, D] = corners;
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const verts = [];
  const at = (u, v) => {
    const x = (1 - u) * (1 - v) * A[0] + u * (1 - v) * B[0] + u * v * Cc[0] + (1 - u) * v * D[0];
    const z = (1 - u) * (1 - v) * A[1] + u * (1 - v) * B[1] + u * v * Cc[1] + (1 - u) * v * D[1];
    // B→C 边向外鼓（片中右下那条弧边）
    const bx = Cc[1] - B[1], bz = -(Cc[0] - B[0]), bl = Math.hypot(bx, bz) || 1, w = Math.sin(Math.PI * v) * u * u * bulge;
    return [x + bx / bl * w * bl * .5, z + bz / bl * w * bl * .5];
  };
  const id = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const [x, z] = at(i / nu, j / nv), inner = i > 0 && j > 0 && i < nu && j < nv;
    const h = Math.hypot(...sub([...at((i + 1) / nu, j / nv), 0], [x, z, 0]));
    verts.push({ id: id(i, j), x: x + (inner ? (rnd() - .5) * jitter * h : 0), z: z + (inner ? (rnd() - .5) * jitter * h : 0), pinned: !inner });
  }
  const cells = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) cells.push({ id: cells.length, n: 4, pts: [verts[id(i, j)], verts[id(i + 1, j)], verts[id(i + 1, j + 1)], verts[id(i, j + 1)]] });
  if (relaxPolygons && relax > 0) relaxPolygons(cells.map((c) => c.pts), verts, relax);
  return { cells, verts };
}
