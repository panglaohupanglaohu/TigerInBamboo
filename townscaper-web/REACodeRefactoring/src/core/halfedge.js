/**
 * halfedge.js — 共享网格上的显式半边结构（1458921394855718917「exploring the Half Edge data structure … lightweight, powerful and versatile」，
 * 1584623053061099520 / 1447494168448753667 混合网格；第 51 轮迁自 REACode src/halfedge.js）。
 *
 * 重构版的 core/grid.js 已有共享顶点 id 与互反的 edgeNeighbors / edgeTwins，但没有显式 next / prev / twin 遍历、
 * 边界环、顶点扇、Euler 检查和「方格切成两个三角」的分割编辑（coverage 记的缺口）。这里在任意多边形格集合上建：
 *   he[i] = { origin（起点顶点 id）, cell, next, prev, twin（-1 = 边界） }，每个格的半边逆时针成环；
 *   boundaryLoops：边界半边沿「终点的下一条边界出边」串环；vertexFan(v)：绕顶点的出边扇（twin→next）；
 *   euler = V − E + F（圆盘 = 1）；splitQuads：按种子把一部分四边形沿对角线切两个三角，结果仍是流形。
 */
const ccw = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.z - b.x * a.z; } return s; };

export function buildHalfEdge(cells) {
  const he = [], byPair = new Map(), outgoing = new Map(), verts = new Set();
  for (const c of cells) {
    const pts = ccw(c.pts) < 0 ? [...c.pts].reverse() : c.pts, base = he.length, n = pts.length;
    if (n < 3) throw new RangeError('cell needs ≥3 corners');
    for (let i = 0; i < n; i++) {
      const a = pts[i].id, b = pts[(i + 1) % n].id; if (a === undefined || b === undefined) throw new TypeError('corners need shared ids');
      he.push({ id: base + i, origin: a, dest: b, cell: c.id, next: base + (i + 1) % n, prev: base + (i - 1 + n) % n, twin: -1 });
      const k = a + '>' + b; if (byPair.has(k)) throw new Error('non-manifold: directed edge used twice ' + k); byPair.set(k, base + i);
      if (!outgoing.has(a)) outgoing.set(a, []); outgoing.get(a).push(base + i); verts.add(a); verts.add(b);
    }
  }
  let interior = 0, boundary = 0;
  for (const h of he) { const t = byPair.get(h.dest + '>' + h.origin); if (t !== undefined) { h.twin = t; if (h.id < t) interior++; } else boundary++; }
  const boundaryLoops = [], seen = new Set();
  for (const h of he) {
    if (h.twin >= 0 || seen.has(h.id)) continue;
    const loop = []; let cur = h;
    for (let guard = 0; guard < he.length && !seen.has(cur.id); guard++) {
      seen.add(cur.id); loop.push(cur.id);
      // 下一条边界半边：从 cur.dest 出发、自身是边界的那条（绕顶点转到边界上）
      let x = he[cur.next]; while (x.twin >= 0) x = he[he[x.twin].next];
      cur = x;
    }
    boundaryLoops.push(loop);
  }
  const vertexFan = (v) => {   // 从一条出边开始绕顶点：x → twin(prev(x))（逆时针），碰到边界停，再反向补齐
    const outs = outgoing.get(v) || []; if (!outs.length) return [];
    const start = outs.find((i) => he[i].twin < 0) ?? outs[0], fan = [start];   // 边界顶点：从「自身是边界」的出边开始，正向转到另一侧边界为止
    for (let x = start, guard = 0; guard < outs.length; guard++) { const p = he[he[x].prev]; if (p.twin < 0) break; x = he[p.twin].id; if (x === start) break; fan.push(x); }
    return fan;
  };
  return { he, cells: cells.length, verts: verts.size, interiorEdges: interior, boundaryEdges: boundary, edges: interior + boundary, boundaryLoops, outgoing, vertexFan, euler: verts.size - (interior + boundary) + cells.length };
}

/** 一致性检查：next/prev 成环且互逆、twin 互反且方向相反、每格半边数 = 角数、每个顶点扇覆盖全部出边。返回错误列表。 */
export function checkHalfEdge(H) {
  const err = [], he = H.he;
  for (const h of he) {
    if (he[h.next].prev !== h.id || he[h.prev].next !== h.id) err.push('next/prev ' + h.id);
    if (he[h.next].origin !== h.dest) err.push('chain ' + h.id);
    if (h.twin >= 0 && (he[h.twin].twin !== h.id || he[h.twin].origin !== h.dest)) err.push('twin ' + h.id);
  }
  for (const [v, outs] of H.outgoing) if (new Set(H.vertexFan(v)).size !== outs.length) err.push('fan ' + v);
  return err;
}

/** 把一部分四边形沿对角线切成两个三角（种子决定哪些、切哪条对角线）；返回新格集合（id 重新编号，角点对象共享）。 */
export function splitQuads(cells, { share = 0.45, seed = 1 } = {}) {
  let s = (seed >>> 0) || 1; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out = []; let split = 0;
  for (const c of cells) {
    if (c.pts.length === 4 && rnd() < share) { const d = rnd() < 0.5 ? 0 : 1, p = c.pts; const A = d ? [p[0], p[1], p[2]] : [p[0], p[1], p[3]], B = d ? [p[0], p[2], p[3]] : [p[1], p[2], p[3]]; out.push({ id: out.length, n: 3, pts: A, parent: c.id }, { id: out.length + 1, n: 3, pts: B, parent: c.id }); split++; }
    else out.push({ id: out.length, n: c.pts.length, pts: c.pts, parent: c.id });
  }
  return { cells: out, split };
}
