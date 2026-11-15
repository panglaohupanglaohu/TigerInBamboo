// r56 C08 · 1677242779162877952「generic triangle graph ... stress test where I'm adding random verts,
// making sure the graph stays manifold and delauney-ish along the way」。
// 片中每加一个点，被改动的边短暂亮成彩色（绿/黄/青），外轮廓不断外扩。这里在共享 core/trigraph.js
// 之上补「局部编辑」：addTracked（插点并返回新增/删除边差分）、removeVertex（删点：取星形环、耳切重三角、
// Lawson 合法化）、moveVertex（删 + 插，失败回滚）。TriGraph 本身不改。
import { TriGraph } from './trigraph.js';

const ekey = (u, v) => (u < v ? u + ',' + v : v + ',' + u);
function edgeSet(g) { const s = new Set(); for (const [a, b, c] of g.tris) { s.add(ekey(a, b)); s.add(ekey(b, c)); s.add(ekey(c, a)); } return s; }
function circum(g, a, b, c) {
  const { x, y } = g, ax = x[a], ay = y[a], bx = x[b], by = y[b], cx = x[c], cy = y[c];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d, uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return [ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2];
}
const orient = (g, a, b, c) => (g.x[b] - g.x[a]) * (g.y[c] - g.y[a]) - (g.y[b] - g.y[a]) * (g.x[c] - g.x[a]);

/** 差分（内部顶点号，含超级顶点 0..2；外部用时减 3） */
function diff(before, g) {
  const after = edgeSet(g), added = [], removed = [];
  for (const k of after) if (!before.has(k)) added.push(k.split(',').map(Number));
  for (const k of before) if (!after.has(k)) removed.push(k.split(',').map(Number));
  return { added, removed };
}

export function addTracked(g, x, y) {
  const before = edgeSet(g), id = g.add(x, y);
  return { id, ...diff(before, g) };
}

/** 删掉一个输入顶点（内部号 ≥3）。顶点号保持（坐标留作孤立记录 → 标记 removed），图保持流形与近 Delaunay。 */
export function removeVertex(g, id) {
  if (!Number.isInteger(id) || id < 3 || id >= g.x.length) throw new RangeError('vertex id');
  if ((g.removed ||= new Set()).has(id)) throw new RangeError('vertex already removed');
  const star = []; g.tris.forEach((t, i) => { if (t.includes(id)) star.push(i); });
  if (!star.length) throw new RangeError('vertex not in graph');
  const before = edgeSet(g);
  // ordered link ring: each star tri (ccw) contributes edge (next,prev) opposite to id
  const nxt = new Map();
  for (const i of star) { const t = g.tris[i], k = t.indexOf(id); nxt.set(t[(k + 1) % 3], t[(k + 2) % 3]); }
  const ring = []; let s = nxt.keys().next().value, cur = s;
  do { ring.push(cur); cur = nxt.get(cur); if (ring.length > star.length + 1) throw new Error('non-manifold star'); } while (cur !== s);
  // ear clipping on the (star-shaped, ccw) ring
  const poly = ring.slice(), newTris = [];
  let guard = poly.length * poly.length + 10;
  while (poly.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[(i + poly.length - 1) % poly.length], b = poly[i], c = poly[(i + 1) % poly.length];
      if (orient(g, a, b, c) <= 0) continue;
      let inside = false;
      for (const p of poly) { if (p === a || p === b || p === c) continue; if (orient(g, a, b, p) >= 0 && orient(g, b, c, p) >= 0 && orient(g, c, a, p) >= 0) { inside = true; break; } }
      if (inside) continue;
      newTris.push([a, b, c]); poly.splice(i, 1); clipped = true; break;
    }
    if (!clipped) throw new Error('ear clipping failed');
  }
  newTris.push(poly.slice());
  // replace star triangles
  star.sort((a, b) => b - a).forEach((i) => { const last = g.tris.length - 1; g.tris[i] = g.tris[last]; g.circ[i] = g.circ[last]; g.tris.pop(); g.circ.pop(); });
  for (const t of newTris) { g.tris.push(t); g.circ.push(circum(g, ...t)); }
  // Lawson: legalize every edge inside the former star + ring edges
  g.lastFlips = [];
  const cand = new Set(); for (const [a, b, c] of newTris) { cand.add(ekey(a, b)); cand.add(ekey(b, c)); cand.add(ekey(c, a)); }
  let flips = 0; for (const k of cand) { const [u, v] = k.split(',').map(Number); flips += g.legalize(u, v); }
  g.removed.add(id);
  return { id, ring: ring.length, flips, ...diff(before, g) };
}

/** 移动顶点：删 + 在新位置插（新号）；插入失败时用 clone 回滚 */
export function moveVertex(g, id, x, y) {
  const snap = g.clone(); snap.removed = new Set(g.removed || []);
  try { const r = removeVertex(g, id); const a = addTracked(g, x, y); return { from: id, to: a.id, added: a.added, removed: r.removed, flips: r.flips }; }
  catch (e) { Object.assign(g, { x: snap.x, y: snap.y, tris: snap.tris, circ: snap.circ, removed: snap.removed }); throw e; }
}

/** check() 把被删顶点当孤立点；这里给出排除已删点后的同口径体检 */
export function checkLive(g, samples = Infinity) {
  const r = g.check(samples), rm = g.removed || new Set();
  const orphans = r.orphanVertices - rm.size;
  // Delaunay over live vertices only (removed coordinates stay in x/y as a record)
  let delaunay = r.finite && r.degenerate === 0;
  for (let t = 0; t < g.tris.length && delaunay; t++) {
    const [ux, uy, r2] = g.circ[t], tri = g.tris[t];
    for (let i = 3; i < g.x.length; i++) {
      if (rm.has(i) || tri.includes(i)) continue;
      if ((g.x[i] - ux) ** 2 + (g.y[i] - uy) ** 2 < r2 * (1 - 1e-9)) { delaunay = false; break; }
    }
  }
  return { ...r, delaunay, orphanVertices: orphans, removed: rm.size, manifold: r.finite && r.degenerate === 0 && orphans === 0 && edgeManifold(g) };
}
function edgeManifold(g) {
  const m = new Map();
  for (const [a, b, c] of g.tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) { const k = ekey(u, v), l = m.get(k) || []; l.push([u, v]); m.set(k, l); }
  for (const l of m.values()) if (l.length > 2 || (l.length === 2 && l[0][0] !== l[1][1])) return false;
  return true;
}

export { TriGraph };
