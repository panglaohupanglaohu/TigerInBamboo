/** 1584623053061099520: "I wrote a thing to splice houses into the terrain ... would be
 * useful insert them at will too". Adapted from REACode/splice: the footprint is cut
 * in the cell's own parameter domain, so on skewed/cage-deformed cells the ring patch
 * follows the skew. Extended beyond the original rectangle-in-quad: any convex cell
 * (triangles too) and any convex footprint, ring triangulated by an angular zipper
 * around an interior point. Cell edges are never split, so neighbouring terrain tops
 * keep matching edges (no T-junctions). Not the author's mesh system / prefab tiles.
 */
const area2 = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p.x * q.z - q.x * p.z; } return s; };
export function bilinear(pts, u, v) {
  const [a, b, c, d] = pts;
  return { x: (1 - u) * (1 - v) * a.x + u * (1 - v) * b.x + u * v * c.x + (1 - u) * v * d.x, z: (1 - u) * (1 - v) * a.z + u * (1 - v) * b.z + u * v * c.z + (1 - u) * v * d.z };
}
/** Original quad case: rectangle [u0,u1]x[v0,v1] in the bilinear domain -> 4 quad patches + hole. */
export function spliceRect(pts, { u0, v0, u1, v1 }) {
  if (pts.length !== 4 || !(0 < u0 && u0 < u1 && u1 < 1 && 0 < v0 && v0 < v1 && v1 < 1)) throw new RangeError('invalid rect splice');
  const P = (u, v) => bilinear(pts, u, v);
  const patches = [[[0, u0], [0, 1]], [[u1, 1], [0, 1]], [[u0, u1], [0, v0]], [[u0, u1], [v1, 1]]].map(([u, v]) => [P(u[0], v[0]), P(u[1], v[0]), P(u[1], v[1]), P(u[0], v[1])]);
  return { patches, hole: [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)] };
}
/** Footprint for any convex cell: quads use the bilinear rect (original), others shrink toward the centroid. */
export function footprintFor(pts, { inset = .2 } = {}) {
  if (!(inset > 0 && inset < .5)) throw new RangeError('inset must be in (0, .5)');
  if (pts.length === 4) return spliceRect(pts, { u0: inset, v0: inset, u1: 1 - inset, v1: 1 - inset }).hole;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length, k = 1 - 2 * inset;
  return pts.map(p => ({ x: cx + (p.x - cx) * k, z: cz + (p.z - cz) * k }));
}
/** Annulus between a convex cell (outer) and a convex footprint (inner), both CCW. */
export function splicePolygon(outer, inner) {
  if (outer.length < 3 || inner.length < 3) throw new RangeError('polygons need 3+ vertices');
  const so = Math.sign(area2(outer)), si = Math.sign(area2(inner));
  if (!so || so !== si) throw new RangeError('outer/inner must share a non-degenerate winding');
  const c = { x: inner.reduce((s, p) => s + p.x, 0) / inner.length, z: inner.reduce((s, p) => s + p.z, 0) / inner.length };
  const ang = p => Math.atan2(p.z - c.z, p.x - c.x) * so;
  const start = (poly) => { let best = 0; for (let i = 1; i < poly.length; i++) if (ang(poly[i]) < ang(poly[best])) best = i; return best; };
  const unwrap = (poly) => { const s = start(poly), out = []; let prev = -Infinity; for (let k = 0; k <= poly.length; k++) { const p = poly[(s + k) % poly.length]; let a = ang(p); while (a < prev) a += 2 * Math.PI; out.push({ p, a, i: (s + k) % poly.length }); prev = a; } return out; };
  const O = unwrap(outer), I = unwrap(inner), tris = [];
  // align: both sequences start at their minimum angle; zip by smaller next angle
  let i = 0, j = 0;
  while (i < outer.length || j < inner.length) {
    const advanceOuter = j >= inner.length || (i < outer.length && O[i + 1].a <= I[j + 1].a);
    if (advanceOuter) { tris.push({ kind: 'outer', pts: [O[i].p, O[i + 1].p, I[j].p], edge: O[i].i }); i++; }
    else { tris.push({ kind: 'inner', pts: [O[i].p, I[j + 1].p, I[j].p], edge: I[j].i }); j++; }
  }
  const cellArea = Math.abs(area2(outer)) / 2, holeArea = Math.abs(area2(inner)) / 2, ringArea = tris.reduce((s, t) => s + Math.abs(area2(t.pts)) / 2, 0);
  return { tris, hole: inner, cellArea, holeArea, ringArea, closure: (ringArea + holeArea - cellArea) / cellArea, minSignedArea: Math.min(...tris.map(t => area2(t.pts) * so / 2)) };
}
/** Insert a house at will on an exposed rock-topped cell. Stored as a splice overlay
 * (World voxels are untouched). r55: the overlay is part of World.snapshot/restore (undo
 * stack), of the v5 save tail (save.js) and of the editor ('splice' tool in app.js).
 * inset/sink are quantized to 0.01 so a save round-trip is exact. */
export const q01 = (v) => Math.round(v * 100) / 100;
export function spliceHouse(world, cellId, { inset = .2, stories = 1, sink = .08 } = {}) {
  const c = world.cells[cellId];
  if (!c) return { ok: false, reason: 'cell' };
  const g = world.ground(c);
  if (g < 1 || world.river[c.id] || !world.isRock(c, g) || world.isSolid(c, g + 1)) return { ok: false, reason: 'not-exposed-rock' };
  inset = q01(inset); sink = q01(sink);
  if (!Number.isInteger(stories) || stories < 1 || stories > 4 || !(sink >= 0 && sink < .5)) return { ok: false, reason: 'template' };
  footprintFor(c.pts, { inset });
  (world.splicedHouses ??= new Map()).set(c.id, { inset, stories, sink });
  return { ok: true, cell: c.id, ground: g };
}
/** Editor click: remove an existing spliced house, otherwise splice one in. Returns true when the World changed. */
export function toggleSplice(world, cell, opts = {}) {
  let ok = true;
  if (world.splicedHouses?.has(cell.id)) world.splicedHouses.delete(cell.id);
  else ok = spliceHouse(world, cell.id, { stories: 1 + (cell.id % 2), ...opts }).ok;
  if (ok) touchOverlay(world);
  return ok;
}
/** Re-mesh without invalidating voxel-derived data: river flow / network / drainage stay valid (voxels untouched). */
function touchOverlay(world) {
  const live = ['riverFlow', 'riverNetwork', 'drainage'].filter((k) => world[k] && world[k].version === world.version);
  world.touch();
  for (const k of live) world[k].version = world.version;
}
