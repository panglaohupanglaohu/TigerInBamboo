/** Rectangular equal-pitch hip roof, adapted from REACode/hiproof.
 * Local footprint strategy, not a recovered swarm-pathfinding algorithm.
 * Vertices are normalized [u,v,rise]; consumers map into their actual quad.
 */
export function hipRoof(width,depth,rise){
 if(![width,depth,rise].every(Number.isFinite)||width<=0||depth<=0||rise<=0)throw new RangeError('positive finite roof dimensions required');
 const alongU=width>=depth,long=Math.max(width,depth),short=Math.min(width,depth),inset=short/(2*long);
 const a=alongU?[inset,.5,rise]:[.5,inset,rise],b=alongU?[1-inset,.5,rise]:[.5,1-inset,rise];
 const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0]];
 const faces=alongU?[[corners[0],corners[1],b,a],[corners[1],corners[2],b],[corners[2],corners[3],a,b],[corners[3],corners[0],a]]:[[corners[0],corners[1],a],[corners[1],corners[2],b,a],[corners[2],corners[3],b],[corners[3],corners[0],a,b]];
 return{faces:faces.map(face=>face.filter((p,i)=>i===0||p.some((x,k)=>x!==face[i-1][k]))),ridge:[a,b],ridgeLength:long-short,eaveHeight:0};
}
/** REACode/hiproof audit interface in metric units: ridge = long - short, apex on
 * squares, hip has 0 gable walls / 4 slopes, gable comparison keeps equal pitch.
 * overhang widens both eave directions equally, so ridge length is unchanged.
 */
export function hipRoofMetric(width,depth,rise,overhang=0){
 if(![width,depth,rise,overhang].every(Number.isFinite)||width<=0||depth<=0||rise<=0||overhang<0)throw new RangeError('invalid metric hip roof');
 const W=Math.max(width,depth)+2*overhang,D=Math.min(width,depth)+2*overhang,ridgeLength=W-D,apex=ridgeLength<=1e-9;
 const r=hipRoof(W,D,rise),faces=r.faces.map(f=>f.map(([u,v,y])=>[u*W,v*D,y]));
 const area3=f=>{let x=0,y=0,z=0;for(let i=0;i<f.length;i++){const a=f[i],b=f[(i+1)%f.length];x+=a[1]*b[2]-a[2]*b[1];y+=a[2]*b[0]-a[0]*b[2];z+=a[0]*b[1]-a[1]*b[0];}return Math.hypot(x,y,z)/2;};
 const kinds=faces.map(f=>f.length===3||apex?'tri':'trap');
 return{width:W,depth:D,rise,overhang,ridgeLength,apex,faces,slopeDeg:Math.atan2(rise,D/2)*180/Math.PI,surfArea:faces.reduce((s,f)=>s+area3(f),0),triCount:kinds.filter(k=>k==='tri').length,trapCount:kinds.filter(k=>k==='trap').length,gableWalls:0,eaveSpread:Math.max(...faces.flat().filter(p=>p[2]<rise/2).map(p=>p[2]))-Math.min(...faces.flat().filter(p=>p[2]<rise/2).map(p=>p[2]))};
}
export function gableRoofMetric(width,depth,rise,overhang=0){
 const h=hipRoofMetric(width,depth,rise,overhang),W=h.width,D=h.depth;
 return{...h,ridgeLength:W,apex:false,triCount:0,trapCount:2,gableWalls:2,gableWallArea:D*rise,surfArea:2*W*Math.hypot(D/2,rise)};
}

/* ---- r55: exact straight-skeleton hip roofs over arbitrary multi-cell regions ----------
 * 807256278154301441 / REACode hiproof: equal pitch on every eave. regionRings traces the
 * region outline (interior on the left; at a pinch vertex the left-most turn keeps loops
 * apart; courtyards become hole loops). skeletonRoof runs the exact wavefront skeleton
 * (core/straight-skeleton.js) and maps time → height: y = base + t·slope, eave at
 * t = −overhang, flat top at t = cap. Optional thatch courses cut the faces into bands. */
import { straightSkeleton, skeletonTriangles, auditSkeleton, ringArea, offsetRing } from './straight-skeleton.js';
export function regionRings(regionCells, has) {
  const out = new Map(), area = (c) => { let a = 0; for (let i = 0; i < c.n; i++) { const p = c.pts[i], q = c.pts[(i + 1) % c.n]; a += p.x * q.z - q.x * p.z; } return a; };
  const halfs = [];
  for (const c of regionCells) {
    const ccw = area(c) > 0;
    for (let i = 0; i < c.n; i++) {
      const nb = c.edgeNeighbors[i]; if (nb >= 0 && has(nb)) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n], h = ccw ? { a, b, cell: c.id, edge: i } : { a: b, b: a, cell: c.id, edge: i };
      halfs.push(h); (out.get(h.a.id) ?? out.set(h.a.id, []).get(h.a.id)).push(h);
    }
  }
  const used = new Set(), rings = [], meta = [];
  for (const h0 of halfs) {
    if (used.has(h0)) continue;
    const ring = [], src = [];
    for (let h = h0; h && !used.has(h);) {
      used.add(h); ring.push({ x: h.a.x, z: h.a.z }); src.push({ cell: h.cell, edge: h.edge });
      const dx = h.b.x - h.a.x, dz = h.b.z - h.a.z, cand = (out.get(h.b.id) ?? []).filter(o => !used.has(o) || o === h0);
      let best = null, bestA = -Infinity;
      for (const o of cand) { const ex = o.b.x - o.a.x, ez = o.b.z - o.a.z, ang = Math.atan2(dx * ez - dz * ex, dx * ex + dz * ez); if (ang > bestA) { bestA = ang; best = o; } }
      if (!best || best === h0) break;
      h = best;
    }
    if (ring.length >= 3) { rings.push(ring); meta.push(src); }
  }
  return { rings, sources: meta };
}
export function skeletonRoof(rings, { base = 0, slope = 1, overhang = 0, cap = Infinity, course = 0, lift = 0 } = {}) {
  const forced = [];
  if (course > 0) for (let t = -overhang + course; t < (Number.isFinite(cap) ? cap : 50); t += course) forced.push(t);
  const sk = straightSkeleton(rings, { overhang, cap, forced });
  // thatch: each course's lower edge is lifted by `lift`, fading to 0 at the next course (planar per band).
  const tLo = (band) => -overhang + band * course;
  const y = (t, pc) => base + Math.min(t, cap) * slope + (course > 0 && pc ? lift * (1 - Math.min(1, Math.max(0, (t - tLo(pc.band)) / course))) : 0);
  const { tris, meta } = skeletonTriangles(sk, { y });
  const audit = auditSkeleton(rings, sk, { overhang });
  audit.footprintArea = rings.reduce((s, r) => s + ringArea(r), 0);
  audit.offsetArea = rings.reduce((s, r) => s + ringArea(offsetRing(r, overhang)), 0);
  audit.areaErr = Math.abs(audit.pieceArea - audit.offsetArea) / audit.offsetArea;
  return { sk, tris, meta, audit, eaveY: base - overhang * slope + (course > 0 ? lift : 0), y };
}
