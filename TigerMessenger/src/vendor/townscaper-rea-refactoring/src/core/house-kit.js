/** 781027725452648448 "This is so much fun" (REACode housekit called it a house kit):
 * one shared kit, variants only by proportions. Migrated constraints that apply to
 * the shared World: integer storeys (World levels), equal eaves, chimney seated on
 * the drawn roof surface (no floating corner), same-storey window rows level.
 * The thatch art set and REACode makeHouse/buildVillage scatter are not migrated:
 * World cells, not random rectangles, own the footprint.
 */
const EPS = 1e-9;
/** r55: REACode housekit pitch pool (8 steps, degrees), storey pool, and the procedural
 * thatch palette (stand-in for the original yellow thatch art — no art assets migrated). */
export const PITCHES = [26, 29, 32, 35, 38, 41, 42, 44];
export const FLOORS = [1, 2, 3];
export const THATCH = ['#d9b45e', '#c39a46', '#8f6d30'];
/** REACode makeHouse ratioOK: roof rise / wall height must stay in [0.20, 0.95]. */
export function pitchPool(width, wallH) { return PITCHES.filter(p => { const r = (width / 2) * Math.tan(p * Math.PI / 180) / wallH; return r >= .2 && r <= .95; }); }
/** Height of a drawn roof triangle soup at (x,z); null when outside every triangle. */
export function roofHeightAt(tris, x, z) {
  let best = null;
  for (const [a, b, c] of tris) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-14) continue;
    const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2;
    if (l1 < -EPS || l2 < -EPS || l3 < -EPS) continue;
    const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
    best = best === null ? y : Math.max(best, y);
  }
  return best;
}
/** Put a chimney on a slope: between ridge point and an eave midpoint, base at the
 * lowest roof height under its footprint so no corner floats. */
export function seatChimney(tris, ridge, eave, { t = .45, half = .035 } = {}) {
  if (!(t > 0 && t < 1) || !(half > 0)) throw new RangeError('invalid chimney seat');
  const x = ridge[0] + (eave[0] - ridge[0]) * t, z = ridge[2] + (eave[2] - ridge[2]) * t;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => roofHeightAt(tris, x + u * half, z + v * half));
  const centre = roofHeightAt(tris, x, z);
  if (centre === null || corners.some(y => y === null)) return null;
  return { x, z, base: Math.min(...corners), top: Math.max(...corners), centre, half };
}
/** REACode housekit.verify adapted to World records: chimney float/centre error
 * against an independently captured roof, eave skew, window bottoms snapped to
 * the global storey line (y - level*L is one of the kit row offsets); gable
 * windows sit in roof triangles and are reported as offGrid. */
export function verifyHouseKit({ chimneys = [], roofTris = [], eaves = [], windowBottoms = [], L = 1, rowOffsets = [.35, .28] }) {
  let chimneyFloat = 0, chimneyCentreErr = 0, unseated = 0;
  for (const c of chimneys) {
    const s = c.seat, h = s.half, ys = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => roofHeightAt(roofTris, s.x + u * h, s.z + v * h)), yc = roofHeightAt(roofTris, s.x, s.z);
    if (yc === null || ys.some(y => y === null)) { unseated++; continue; }
    chimneyFloat = Math.max(chimneyFloat, s.base - Math.min(...ys)); chimneyCentreErr = Math.max(chimneyCentreErr, Math.abs(s.centre - yc));
  }
  let eaveSkew = 0; for (const e of eaves) eaveSkew = Math.max(eaveSkew, e.eaveHi - e.eaveLo);
  const frac = y => y / L - Math.floor(y / L + 1e-9), offGrid = windowBottoms.filter(y => !rowOffsets.some(o => Math.abs(frac(y) - o) < 1e-6)).length;
  return { chimneys: chimneys.length, unseated, chimneyFloat, chimneyCentreErr, eaveSkew, offGrid, windows: windowBottoms.length };
}
