/** Campaign graph support, posts 1042732450730913793 / 1078792665980915714.
 * README: spread/cull nodes, random walk start→finish, more walks, extra nodes.
 * Delaunay + nearest neighbours is our existing approximation; the videos do
 * not prove that exact adjacency rule. Component bridges are an explicit local
 * playability repair, not a claim about the original implementation.
 */
import { TriGraph } from './trigraph.js';

export function campaignGraph(nodes) {
  if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > 512 ||
      nodes.some(p => !p || ![p.x, p.y, p.r].every(Number.isFinite) || p.r <= 0)) {
    throw new RangeError('campaignGraph requires 2..512 finite circles');
  }
  const nb = nodes.map(() => new Set()), tri = [], nearest = [], bridges = [];
  const seen = new Set(), parent = nodes.map((_, i) => i);
  const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const distance = (a, b) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
  const add = (a, b, list) => {
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo + ':' + hi;
    if (lo === hi || seen.has(key)) return;
    seen.add(key); nb[lo].add(hi); nb[hi].add(lo); list.push([lo, hi]);
    parent[root(hi)] = root(lo);
  };
  const bound = Math.max(1, ...nodes.flatMap(p => [Math.abs(p.x), Math.abs(p.y)])) * 8;
  const T = new TriGraph(bound);
  for (const p of nodes) T.add(p.x, p.y);
  for (const t of T.triangles()) for (let k = 0; k < 3; k++) {
    const a = t[k], b = t[(k + 1) % 3];
    // Normalize undirected edges instead of discarding a>b: hull edges occur once.
    if (distance(a, b) <= (nodes[a].r + nodes[b].r) * 2.6 + .6) add(a, b, tri);
  }
  for (let a = 0; a < nodes.length; a++) {
    const near = nodes.map((_, b) => b).filter(b => b !== a)
      .sort((b, c) => distance(a, b) - distance(a, c) || b - c).slice(0, 2);
    for (const b of near) add(a, b, nearest);
  }
  const componentsBeforeRepair = new Set(parent.map((_, i) => root(i))).size;
  // Kruskal across the existing components, shortest available pairs first.
  // These edges may be long/cross another route: keep them separately visible.
  if (componentsBeforeRepair > 1) {
    const pairs = [];
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      if (root(a) !== root(b)) pairs.push([a, b, distance(a, b)]);
    }
    pairs.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
    for (const [a, b] of pairs) if (root(a) !== root(b)) add(a, b, bridges);
  }
  return { nb: nb.map(s => [...s]), tri, nearest, bridges, componentsBeforeRepair };
}

/** Bounded biased random walk; loop-erased main route and explicit BFS fallback.
 * A disconnected destination returns [] rather than the old fabricated [end].
 */
export function campaignWalk(nodes, nb, from, to, rng, maxSteps = 300) {
  if (![from, to].every(i => Number.isInteger(i) && i >= 0 && i < nodes.length) ||
      !Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > 10000) throw new RangeError('invalid campaign walk');
  const path = [from], visited = new Set(path);
  let cur = from;
  for (let k = 0; k < maxSteps && cur !== to; k++) {
    const opts = nb[cur];
    if (!opts.length) break;
    const goal = nodes[to], d0 = Math.hypot(nodes[cur].x - goal.x, nodes[cur].y - goal.y);
    const weights = opts.map(o => {
      const d1 = Math.hypot(nodes[o].x - goal.x, nodes[o].y - goal.y);
      return Math.exp(Math.max(-40, Math.min(40, (d0 - d1) * 2.2))) * (visited.has(o) ? .15 : 1);
    });
    let r = rng() * weights.reduce((a, b) => a + b, 0), pick = opts.at(-1);
    for (let i = 0; i < opts.length; i++) if ((r -= weights[i]) <= 0) { pick = opts[i]; break; }
    const at = path.indexOf(pick);
    if (at >= 0) path.length = at + 1; else path.push(pick);
    visited.add(pick); cur = pick;
  }
  if (cur === to) return path;
  const prev = new Map([[from, -1]]), queue = [from];
  for (let h = 0; h < queue.length && !prev.has(to); h++) {
    for (const o of nb[queue[h]]) if (!prev.has(o)) { prev.set(o, queue[h]); queue.push(o); }
  }
  if (!prev.has(to)) return [];
  const fallback = [];
  for (let c = to; c !== -1; c = prev.get(c)) fallback.push(c);
  return fallback.reverse();
}
