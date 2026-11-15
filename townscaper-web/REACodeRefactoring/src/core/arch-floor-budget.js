/** Vertical opening budget adapted from REACode/piercefloor.
 * Preserve a slab below the supporting voxel base, including floating arches.
 * Existing default crown/rise are retained; this is not a new Boolean cutter.
 */
export function archFloorBudget({base,floor,storey,slab=.05}){
 if(![base,floor,storey,slab].every(Number.isFinite)||storey<=0||slab<=0||slab>=storey||base-floor<=slab)throw new RangeError('invalid opening/slab budget');
 const crown=base-slab,rise=Math.min((base-floor)*.75,storey*.8,crown-floor);
 return{base,floor,crown,rise,spring:crown-rise,slab};
}
/** piercefloor.piercedFloors/corniceBreaks on the shared voxel budget: how many
 * storey slabs the curved opening crosses and whether the band at the supported
 * voxel base stays continuous. raw=true reproduces the Boolean cutter contrast.
 */
export function openingPierce(budget,{storey,raw=false,rawRise=null}={}){
 const{base,floor,crown,spring,slab}=budget;if(![base,floor,crown,spring,slab,storey].every(Number.isFinite)||storey<=0)throw new RangeError('invalid pierce query');
 const top=raw?spring+(rawRise??(base-floor)):crown;let slabsCut=0;
 for(let k=Math.floor(floor/storey+1e-9)+1;k*storey<=Math.max(top,base)+1e-9;k++){const bottom=k*storey-slab;if(bottom>spring+1e-9&&top>bottom+1e-9)slabsCut++;}
 return{top,slabsCut,overSlab:top-(base-slab),corniceContinuous:top<=base-slab+1e-9};
}
/** r55 piercefloor: clearance under the drawn arch. rec = buildings.js archBudgets entry
 * ({floor, spring, span, points:[{u,height}], quad:[A0,A1,B1,B0] as [x,z]}). The soffit is drawn
 * as strips P(u0,0)P(u1,0)P(u1,1)P(u0,1) split into triangles (a,b,c)+(a,c,d); on skewed cells
 * those strips are not planar, so every query here uses exactly those triangles. */
const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
export function archAt(rec, u, v) { const [A0, A1, B1, B0] = rec.quad; return lerp2(lerp2(A0, B0, u), lerp2(A1, B1, u), v); }
function strips(rec) {
  const out = [], P = rec.points;
  for (let k = 0; k + 1 < P.length; k++) {
    const y0 = rec.spring + P[k].height, y1 = rec.spring + P[k + 1].height;
    const a = [...archAt(rec, P[k].u, 0), y0], b = [...archAt(rec, P[k + 1].u, 0), y1], c = [...archAt(rec, P[k + 1].u, 1), y1], d = [...archAt(rec, P[k].u, 1), y0];
    out.push({ u0: P[k].u, u1: P[k + 1].u, a, b, c, d, tris: [[a, b, c], [a, c, d]] });
  }
  return out;
}
function triY(t, x, z) {
  const [a, b, c] = t, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-15) return null;
  const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d, l3 = 1 - l1 - l2;
  return l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9 ? null : l1 * a[2] + l2 * b[2] + l3 * c[2];
}
/** Soffit height of the drawn triangles at span coordinate u, depth v (0 / 1 = the two open faces). */
export function archSoffitAt(rec, u, v = .5) {
  if (!(u >= 0 && u <= 1)) return rec.floor;
  const [x, z] = archAt(rec, u, v);
  for (const s of strips(rec)) if (u >= s.u0 - 1e-9 && u <= s.u1 + 1e-9) for (const t of s.tris) { const y = triY(t, x, z); if (y !== null) return y; }
  return rec.spring;
}
/** Can a unit of given height and half-width pass along the arch axis (lateral offset x)? Exact
 * minimum of the piecewise-planar soffit over the band u∈[u0,u1] × v∈[0,1]: strip vertices inside
 * the band, plus the band borders crossed with each strip's open edges and its diagonal a–c. */
export function archPassage(rec, { height, radius = 0, x = 0 } = {}) {
  if (!(height > 0) || !(radius >= 0)) throw new RangeError('invalid passage query');
  const u0 = .5 + (x - radius) / rec.span, u1 = .5 + (x + radius) / rec.span;
  if (u0 < -1e-12 || u1 > 1 + 1e-12) return { ok: false, headroom: 0, band: [u0, u1], reason: 'wider than span' };
  let low = Infinity;
  for (const s of strips(rec)) {
    if (s.u1 < u0 - 1e-12 || s.u0 > u1 + 1e-12) continue;
    if (s.u0 >= u0 - 1e-12 && s.u0 <= u1 + 1e-12) low = Math.min(low, s.a[2]);
    if (s.u1 >= u0 - 1e-12 && s.u1 <= u1 + 1e-12) low = Math.min(low, s.b[2]);
    for (const ub of [u0, u1]) {
      if (ub < s.u0 - 1e-12 || ub > s.u1 + 1e-12) continue;
      const f = s.u1 > s.u0 ? (ub - s.u0) / (s.u1 - s.u0) : 0, yEdge = s.a[2] + (s.b[2] - s.a[2]) * f;
      low = Math.min(low, yEdge);   // v=0 and v=1 edges share the same height at ub
      // crossing of the border segment P(ub,0)–P(ub,1) with the diagonal a–c
      const p = archAt(rec, ub, 0), q = archAt(rec, ub, 1), A = [s.a[0], s.a[1]], C = [s.c[0], s.c[1]];
      const r1 = [q[0] - p[0], q[1] - p[1]], r2 = [C[0] - A[0], C[1] - A[1]], den = r1[0] * r2[1] - r1[1] * r2[0];
      if (Math.abs(den) > 1e-15) { const tt = ((A[0] - p[0]) * r2[1] - (A[1] - p[1]) * r2[0]) / den, ss = ((A[0] - p[0]) * r1[1] - (A[1] - p[1]) * r1[0]) / den; if (tt >= -1e-12 && tt <= 1 + 1e-12 && ss >= -1e-12 && ss <= 1 + 1e-12) low = Math.min(low, s.a[2] + (s.c[2] - s.a[2]) * ss); }
    }
  }
  const headroom = low - rec.floor;
  return { ok: headroom >= height, headroom, band: [u0, u1] };
}
/** Widest centred corridor (metric) with at least `height` of headroom — the nav width under the arch. */
export function archPassableWidth(rec, height) {
  let lo = 0, hi = rec.span / 2;
  if (!archPassage(rec, { height, radius: 0 }).ok) return 0;
  for (let k = 0; k < 48; k++) { const m = (lo + hi) / 2; if (archPassage(rec, { height, radius: m }).ok) lo = m; else hi = m; }
  return 2 * lo;
}
