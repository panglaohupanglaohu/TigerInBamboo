/**
 * sphere-stages.js — r55 (engine/sphere.js "阶段动画"): a playable timeline of how the sphere
 * grid is made, built from REAL per-iteration snapshots (buildSphere({history:true})), not tweens.
 *
 *   1338825080844021760 "1. Random points 2. Space out the points 3. Triangulate 4. Relax using
 *                        the triangles"
 *   1338829205157646336 "Delaunay Triangulation on a sphere ... on a Stereographic Projection.
 *                        My points are sorted vertically, which means radially" — so the
 *                        triangulation is revealed in that radial insertion order (pole last).
 *
 * Timeline t ∈ [0, 5]:
 *   0–1 random → spaced   spacing iterations (steps.spacingFrames)
 *   1–2 triangulate       faces appear in projection-radius order (rank = latest-inserted corner)
 *   2–3 relax             relax iterations (steps.relaxFrames), faces kept
 *   3–4 Delaunay repair   relax broke the empty-circle property on a few faces (red), Lawson
 *                         flips repair them (green = new edges) — planet-town.js flipToDelaunay
 *   4–5 planet            the page shows the tile planet (cells = dual of the triangles)
 * The repair stage is ours (r53 G4 measured the violations); the clip stops at "relax".
 */
import { sphericalDelaunayViolations, flipToDelaunay } from './planet-town.js';

export const STAGES = [
  { id: 'spacing', label: '1–2 随机点 → 散开' },
  { id: 'triangulate', label: '3 三角化（球极投影平面，按半径插入）' },
  { id: 'relax', label: '4 按三角形松弛' },
  { id: 'repair', label: '+ Delaunay 翻边修复' },
  { id: 'planet', label: '5 星球' },
];

/** Precompute the reveal order and the repair once per sphere. */
export function prepareStages(sphere) {
  const st = sphere.steps;
  if (!st?.spacingFrames || !st?.relaxFrames) throw new RangeError('prepareStages needs buildSphere({history:true})');
  const n = sphere.pts.length, rank = new Int32Array(n).fill(n);
  st.projection.order.forEach((id, r) => { rank[id] = r; });
  const faceRank = sphere.tris.map((t) => Math.max(rank[t[0]], rank[t[1]], rank[t[2]]));
  const reveal = sphere.tris.map((_, i) => i).sort((a, b) => faceRank[a] - faceRank[b] || a - b);
  const bad = sphericalDelaunayViolations(sphere.pts, sphere.tris);
  const fixed = flipToDelaunay(sphere.pts, sphere.tris);
  const key = (a, b) => a < b ? a + ',' + b : b + ',' + a, edges = (T) => { const s = new Set(); for (const [a, b, c] of T) { s.add(key(a, b)); s.add(key(b, c)); s.add(key(c, a)); } return s; };
  const before = edges(sphere.tris), after = edges(fixed.tris);
  const badEdges = [];
  const seen = new Set();
  for (const { tri } of bad) { const t = sphere.tris[tri]; for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) if (!after.has(key(a, b)) && !seen.has(key(a, b))) { seen.add(key(a, b)); badEdges.push([a, b]); } }
  const newEdges = [...after].filter((k) => !before.has(k)).map((k) => k.split(',').map(Number));
  return { reveal, faceRank, bad, badEdges, newEdges, fixed, n };
}

/** Frame at time t: { stage, label, progress, points, tris, red, green }. */
export function sphereStageFrame(sphere, prep, t) {
  if (!Number.isFinite(t)) throw new RangeError('Invalid stage time');
  t = Math.max(0, Math.min(5, t));
  const st = sphere.steps, k = Math.min(4, Math.floor(t)), p = t - k;
  const pick = (frames, q) => frames.length ? frames[Math.min(frames.length - 1, Math.floor(q * frames.length))] : null;
  const S = STAGES[k];
  if (k === 0) return { stage: S.id, label: S.label, progress: p, points: p <= 0 ? st.random : pick(st.spacingFrames, p) ?? st.spaced, tris: [], red: [], green: [] };
  if (k === 1) { const m = Math.round(p * prep.reveal.length); return { stage: S.id, label: S.label, progress: p, points: st.triangulated, tris: prep.reveal.slice(0, m).map((i) => sphere.tris[i]), red: [], green: [], faces: m }; }
  if (k === 2) return { stage: S.id, label: S.label, progress: p, points: pick(st.relaxFrames, p) ?? st.relaxed, tris: sphere.tris, red: [], green: [] };
  if (k === 3) return p < .5
    ? { stage: S.id, label: S.label + `：${prep.bad.length} 个面违例`, progress: p, points: st.relaxed, tris: sphere.tris, red: prep.badEdges, green: [] }
    : { stage: S.id, label: S.label + `：翻 ${prep.fixed.flips} 条边`, progress: p, points: st.relaxed, tris: prep.fixed.tris, red: [], green: prep.newEdges };
  return { stage: S.id, label: S.label, progress: p, points: st.relaxed, tris: prep.fixed.tris, red: [], green: [] };
}
