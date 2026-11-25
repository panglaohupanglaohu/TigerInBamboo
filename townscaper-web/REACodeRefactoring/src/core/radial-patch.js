/** 1301816247479345152: "random patches of hand crafted grid".
 * Video shows quad templates/radial rings, not a regular hex-cell lattice.
 * Local approach: replace a bounded star-shaped disk with regular inner rings,
 * reuse its exact boundary vertices, and retain every outside polygon.
 * Fresh grid only: no implicit migration of a populated World's cell IDs.
 */
import {finishGrid,signedArea,isConvex} from './grid.js';
export function insertRadialPatch(grid,{x=0,z=0,radius=3,rings=3,innerRatio=.5}={}) {
 if(!grid?.cells?.length||![x,z,radius,innerRatio].every(Number.isFinite)||radius<=0||innerRatio<.15||innerRatio>.7||!Number.isInteger(rings)||rings<1||rings>8)throw new RangeError('invalid radial patch');
 const removed=new Set(grid.cells.filter(c=>Math.hypot(c.cx-x,c.cz-z)<radius).map(c=>c.id)),edges=[];
 if(!removed.size)throw new RangeError('empty patch');
 for(const id of removed){const c=grid.cells[id];for(let i=0;i<c.n;i++){const n=c.edgeNeighbors[i];if(n<0)throw new RangeError('patch reaches grid boundary');if(!removed.has(n))edges.push([c.pts[i],c.pts[(i+1)%c.n]])}}
 const next=new Map();for(const [a,b]of edges){if(next.has(a.id))throw new RangeError('patch boundary branches');next.set(a.id,b)}
 const boundary=[];let v=edges[0][0];for(let k=0;k<edges.length;k++){boundary.push(v);v=next.get(v.id);if(!v)throw new RangeError('open patch')}
 if(v.id!==boundary[0].id||new Set(boundary.map(p=>p.id)).size!==edges.length)throw new RangeError('patch has holes');
 if(signedArea(boundary)<0)boundary.reverse();const N=boundary.length;
 if(N<8||N%2)throw new RangeError('patch needs an even boundary of at least eight edges');
 const cross=(a,b)=>(a.x-x)*(b.z-z)-(a.z-z)*(b.x-x);
 if(boundary.some((a,i)=>cross(a,boundary[(i+1)%N])<=1e-8))throw new RangeError('patch is not star-shaped');
 const verts=[],byId=new Map(),add=(px,pz,pinned=false)=>{const v={id:verts.length,x:px,z:pz,pinned};verts.push(v);return v},clone=p=>{if(!byId.has(p.id))byId.set(p.id,add(p.x,p.z,p.pinned));return byId.get(p.id)};
 const polys=grid.cells.filter(c=>!removed.has(c.id)).map(c=>{const p=c.pts.map(clone);if(signedArea(p)<0)p.reverse();return p}),outsideCount=polys.length;
 let outer=boundary.map(clone);const minR=Math.min(...boundary.map(p=>Math.hypot(p.x-x,p.z-z))),R=minR*innerRatio;
 // Unwrap angles, then average phase; this preserves cyclic ordering.
 let prev=Math.atan2(boundary[0].z-z,boundary[0].x-x),sum=prev;
 for(let i=1;i<N;i++){let a=Math.atan2(boundary[i].z-z,boundary[i].x-x);while(a<=prev)a+=2*Math.PI;sum+=a-i*2*Math.PI/N;prev=a}const phase=sum/N;
 for(let r=1;r<=rings;r++){const t=r/rings,inner=boundary.map((p,i)=>{const a=phase+i*2*Math.PI/N;return add(p.x*(1-t)+(x+Math.cos(a)*R)*t,p.z*(1-t)+(z+Math.sin(a)*R)*t)});for(let i=0;i<N;i++)polys.push([outer[i],outer[(i+1)%N],inner[(i+1)%N],inner[i]]);outer=inner}
 const center=add(x,z);for(let i=0;i<N;i+=2)polys.push([center,outer[i],outer[(i+1)%N],outer[(i+2)%N]]);
 for(const p of polys){if(signedArea(p)<0)p.reverse();if(signedArea(p)<1e-8||!isConvex(p))throw new RangeError('unsafe patch geometry: choose another radius/centre')}
 const result=finishGrid(polys,verts,{radius:grid.radius,hexSize:grid.hexSize,kind:grid.kind,triangles:polys.filter(p=>p.length===3).length});
 result.sourceCellOf=grid.cells.filter(c=>!removed.has(c.id)).map(c=>c.id).concat(Array(result.cells.length-outsideCount).fill(-1));result.patch={x,z,sourceRadius:radius,rings,innerRadius:R,boundaryIds:boundary.map(p=>clone(p).id),cellIds:result.cells.slice(outsideCount).map(c=>c.id),removedCells:removed.size,regularRing:outer.map(p=>p.id)};return result;
}

/** Several hand-crafted patches on one fresh grid ("sprinkling ... random patches").
 * Applied in order; a later patch may not swallow an earlier patch's cells (RangeError).
 * Every patch keeps its own cellIds in the final numbering, and sourceCellOf maps final
 * cells back to the ORIGINAL grid (-1 = generated inside some patch).
 */
export function insertRadialPatches(grid,specs){
 if(!Array.isArray(specs)||!specs.length||specs.length>16)throw new RangeError('1..16 patch specs required');
 let g=grid,origin=grid.cells.map(c=>c.id),owner=grid.cells.map(()=>-1);
 for(let k=0;k<specs.length;k++){
  const r=specs[k]||{},cx=r.x??0,cz=r.z??0,rad=r.radius??3;
  if(g.cells.some(c=>owner[c.id]>=0&&Math.hypot(c.cx-cx,c.cz-cz)<rad))throw new RangeError('patches overlap');
  const next=r.template&&r.template!=='radial'?insertTemplatePatch(g,r):insertRadialPatch(g,r);   // r55: 模板库
  origin=next.sourceCellOf.map(id=>id<0?-1:origin[id]);owner=next.sourceCellOf.map((id,i)=>id<0?k:owner[id]);g=next;
 }
 g.sourceCellOf=origin;g.patches=specs.map((_,k)=>({...(k===specs.length-1?g.patch:{}),index:k,cellIds:g.cells.filter(c=>owner[c.id]===k).map(c=>c.id)}));
 return g;
}

/** Migrate an EXISTING World onto a patched grid (the step insertRadialPatch refuses to do implicitly).
 * Outside cells copy their column (solid/rock/color/river) by provenance; each generated patch
 * cell takes the column of the nearest removed source cell (by centroid), so terrain and
 * buildings under a gem are resampled, not wiped. Returns {world, copied, resampled}.
 */
export function migrateWorldToPatch(world,patched,WorldClass){
 const src=world.grid,map=patched.sourceCellOf;
 if(!Array.isArray(map)||map.length!==patched.cells.length)throw new TypeError('patched grid with sourceCellOf required');
 if(typeof WorldClass!=='function')throw new TypeError('World class required');
 const kept=new Set(map.filter(id=>id>=0)),removed=src.cells.filter(c=>!kept.has(c.id));
 if(map.some(id=>id>=src.cells.length))throw new RangeError('patched grid does not come from this world');
 const out=new WorldClass(patched);let copied=0,resampled=0;
 for(const c of patched.cells){
  let from=map[c.id];
  if(from<0){if(!removed.length)throw new RangeError('no removed cells to resample');let best=Infinity;for(const r of removed){const d=(r.cx-c.cx)**2+(r.cz-c.cz)**2;if(d<best||(d===best&&r.id<from)){best=d;from=r.id;}}resampled++;}else copied++;
  out.solid[c.id]=world.solid[from];out.rock[c.id]=world.rock[from];out.color[c.id]=world.color[from];out.river[c.id]=world.river[from];
 }
 out.palette=world.palette;out.touch();return{world:out,copied,resampled};
}

/* ---- r55：手工模板库 + 带洞边界（1301816247479345152 "random patches of hand crafted grid,
 * like little gems to find and build your tempels upon"）------------------------------------
 * 模板只决定补丁内部怎么铺；与外部网格的接缝始终是原边界顶点对象（原样共用），外部格不动。
 *   radial     放射环 + 中心扇（同 insertRadialPatch）
 *   block      规整方格块：格距≈原格边长的 a×b 正方格，外环径向投影后与格阵周长拉链成四边格
 *   rhombus    菱形块：同 block，但格阵两轴夹 60°（a×b 个菱形格）
 *   courtyard  环院：补丁是圆环，内部 holeRadius 以内的原格**原样保留**（带洞边界），
 *              外环收成正 N 边形、洞环外扩成正 K 边形，两圈之间按角度拉链两两并成四边格
 * 所有新格必须凸、面积为正（拒绝翻折）；补丁面积 = 被删格面积（守恒）。原版模板美术未迁，几何为程序化。
 */
export const PATCH_TEMPLATES = ['radial', 'block', 'rhombus', 'courtyard'];

function boundaryLoops(grid, removed) {
  const edges = [];
  for (const id of removed) { const c = grid.cells[id]; for (let i = 0; i < c.n; i++) { const n = c.edgeNeighbors[i]; if (n < 0) throw new RangeError('patch reaches grid boundary'); if (!removed.has(n)) edges.push([c.pts[i], c.pts[(i + 1) % c.n]]); } }
  const next = new Map(); for (const [a, b] of edges) { if (next.has(a.id)) throw new RangeError('patch boundary branches'); next.set(a.id, b); }
  const used = new Set(), loops = [];
  for (const [a] of edges) {
    if (used.has(a.id)) continue;
    const loop = []; let v = a;
    while (!used.has(v.id)) { used.add(v.id); loop.push(v); v = next.get(v.id); if (!v) throw new RangeError('open patch'); }
    if (v.id !== a.id) throw new RangeError('patch boundary is not a simple loop');
    loops.push(loop);
  }
  return loops;
}
const angOf = (p, x, z) => Math.atan2(p.z - z, p.x - x);
/** CCW 环相对正 N 边形的平均相位（与 insertRadialPatch 同一做法）。 */
function phaseOf(loop, x, z) {
  const N = loop.length; let prev = angOf(loop[0], x, z), sum = prev;
  for (let i = 1; i < N; i++) { let a = angOf(loop[i], x, z); while (a <= prev) a += 2 * Math.PI; sum += a - i * 2 * Math.PI / N; prev = a; }
  return sum / N;
}
function starShaped(loop, x, z) { const N = loop.length, cr = (a, b) => (a.x - x) * (b.z - z) - (a.z - z) * (b.x - x); return loop.every((a, i) => cr(a, loop[(i + 1) % N]) > 1e-8); }
/** 两个围同一中心的 CCW 凸环（外 A、内 B）之间的角度拉链三角带，相邻两三角并成凸四边形。 */
function zipperQuads(A, B, x, z) {
  const unwrap = (P) => { let s = 0; for (let i = 1; i < P.length; i++) if (angOf(P[i], x, z) < angOf(P[s], x, z)) s = i; const out = []; let prev = -Infinity; for (let k = 0; k <= P.length; k++) { const p = P[(s + k) % P.length]; let a = angOf(p, x, z); while (a < prev) a += 2 * Math.PI; out.push({ p, a }); prev = a; } return out; };
  const O = unwrap(A), I = unwrap(B);
  const tris = []; let i = 0, j = 0;
  while (i < A.length || j < B.length) {
    const outer = j >= B.length || (i < A.length && O[i + 1].a <= I[j + 1].a);
    if (outer) { tris.push({ pts: [O[i].p, O[i + 1].p, I[j].p], shared: [O[i + 1].p, I[j].p] }); i++; }
    else { tris.push({ pts: [O[i].p, I[j + 1].p, I[j].p], shared: [O[i].p, I[j + 1].p] }); j++; }
  }
  // 相邻两三角共一条边（拉链的辐条），并成凸四边形；环上的完美配对只有两种相位，都不行时
  // 贪心配对，配不上的保留为三角格（混合网格本来就有三角格；四边网格会多出少量三角格，计数上报）。
  const merge = (t1, t2) => {
    const pts = [...new Set([...t1.pts, ...t2.pts])];
    if (pts.length !== 4) return null;
    const cx = pts.reduce((s, p) => s + p.x, 0) / 4, cz = pts.reduce((s, p) => s + p.z, 0) / 4;
    pts.sort((p, q) => Math.atan2(p.z - cz, p.x - cx) - Math.atan2(q.z - cz, q.x - cx));
    const [s0, s1] = t1.shared, a = pts.indexOf(s0), b = pts.indexOf(s1);
    return Math.abs(a - b) === 2 && signedArea(pts) > 1e-8 && isConvex(pts) ? pts : null;
  };
  const T = tris.length;
  if (T % 2 === 0) for (const off of [0, 1]) {
    const quads = [];
    for (let k = 0; k < T; k += 2) { const q = merge(tris[(k + off) % T], tris[(k + off + 1) % T]); if (!q) break; quads.push(q); }
    if (quads.length === T / 2) return quads;
  }
  const out = [], used = new Uint8Array(T);
  for (let k = 0; k < T; k++) {
    if (used[k]) continue;
    const n = (k + 1) % T, q = !used[n] && n !== k ? merge(tris[k], tris[n]) : null;
    if (q) { out.push(q); used[k] = used[n] = 1; } else { out.push(tris[k].pts.slice()); used[k] = 1; }
  }
  return out;
}

/** 按模板插入一个补丁。opts: {template, x, z, radius, rings, innerRatio, holeRadius, angle}. */
export function insertTemplatePatch(grid, { template = 'radial', x = 0, z = 0, radius = 3, rings = 2, innerRatio = .55, holeRadius = 1.2, angle = 0 } = {}) {
  if (!PATCH_TEMPLATES.includes(template)) throw new RangeError('unknown patch template ' + template);
  if (!grid?.cells?.length || ![x, z, radius, innerRatio, holeRadius, angle].every(Number.isFinite) || radius <= 0 || innerRatio < .15 || innerRatio > .8 || !Number.isInteger(rings) || rings < 1 || rings > 8 ) throw new RangeError('invalid template patch');
  const holed = template === 'courtyard';
  if (holed && !(holeRadius > 0 && holeRadius < radius)) throw new RangeError('courtyard needs 0 < holeRadius < radius');
  const dist = (c) => Math.hypot(c.cx - x, c.cz - z);
  const removed = new Set(grid.cells.filter((c) => dist(c) < radius && (!holed || dist(c) >= holeRadius)).map((c) => c.id));
  const keptHole = holed ? grid.cells.filter((c) => dist(c) < holeRadius).map((c) => c.id) : [];
  if (!removed.size || (holed && !keptHole.length)) throw new RangeError('empty patch or hole');
  const loops = boundaryLoops(grid, removed).map((l) => (signedArea(l) < 0 ? [...l].reverse() : l)).sort((a, b) => signedArea(b) - signedArea(a));
  if (loops.length !== (holed ? 2 : 1)) throw new RangeError(holed ? 'courtyard needs exactly one hole' : 'patch has holes (use template courtyard)');
  const boundary = loops[0], hole = loops[1] ?? null, N = boundary.length;
  if (N < 8 || (N % 2 && template === 'radial')) throw new RangeError('patch needs an even boundary of at least eight edges');
  if (!starShaped(boundary, x, z)) throw new RangeError('patch is not star-shaped');
  if (hole && (hole.length < 3 || !starShaped(hole, x, z))) throw new RangeError('hole must be a star-shaped loop');
  const verts = [], byId = new Map(), add = (px, pz, pinned = false) => { const v = { id: verts.length, x: px, z: pz, pinned }; verts.push(v); return v; }, clone = (p) => { if (!byId.has(p.id)) byId.set(p.id, add(p.x, p.z, p.pinned)); return byId.get(p.id); };
  const keptCells = grid.cells.filter((c) => !removed.has(c.id));
  const polys = keptCells.map((c) => { const p = c.pts.map(clone); if (signedArea(p) < 0) p.reverse(); return p; }), outsideCount = polys.length;
  const minR = Math.min(...boundary.map((p) => Math.hypot(p.x - x, p.z - z)));
  const holeR = hole ? Math.max(...hole.map((p) => Math.hypot(p.x - x, p.z - z))) : 0;
  if (hole && holeR >= minR * .9) throw new RangeError('hole too close to the patch boundary');
  // r143：courtyard 的环带必须**均分整个环带厚度**（boundary→hole），而不是只铺 (minR−R) 那一截。
  // 旧式 R=holeR+(minR−holeR)·innerRatio 把 rings 条带挤进 45% 的厚度、其余 55% 再被「拉链 + 洞环四边格」
  // 切成两条 → radius 1.9 / hole .8 / rings 5 时每条带径向厚只有 0.05 而弦长 0.45（长宽比 0.12），
  // 细楔的**主因是过细分**（不是 r142 以为的「逐点径向投影」）。现在按
  //   s = (minR−holeR)/(rings+2)，R = holeR + 2s
  // 分：rings 条环带各厚 s，剩下 2s 正好给「拉链带 R→R0」与「洞环四边格 R0→洞边界」各一条 s。
  const span = hole ? minR - holeR : minR, ringSpacing = hole ? span / (rings + 2) : (minR - minR * innerRatio) / rings;
  const R = hole ? holeR + ringSpacing * 2 : minR * innerRatio, phase = phaseOf(boundary, x, z);
  // 目标环（N 个点，CCW）
  let target, block = null;
  if (template === 'block' || template === 'rhombus') {
    // block：正方格；rhombus：第二轴转 60°（菱形格）。格距≈原边界边长（与周围格子同尺度），
    // 四角落在半径 R 的圆上；外环先径向投影到 R1（必凸），再与格阵周长（M=2(a+b) ≤ N）角度拉链成四边格。
    const ca = Math.cos(angle), sa = Math.sin(angle), sh = template === 'rhombus' ? Math.PI / 3 : Math.PI / 2, e2 = [Math.cos(sh), Math.sin(sh)];
    const lens = boundary.map((p, i) => Math.hypot(boundary[(i + 1) % N].x - p.x, boundary[(i + 1) % N].z - p.z)).sort((p, q) => p - q), edge = lens[N >> 1];
    const halfOf = (a, b) => Math.max(Math.hypot(a + b * e2[0], b * e2[1]), Math.hypot(a - b * e2[0], b * e2[1])) / 2;
    let a = Math.max(2, Math.round(R / (halfOf(1, 1) * edge * .95))), b = a;
    while (2 * (a + b) > N && a > 1) { a--; b = a; }
    const k = R / halfOf(a, b), R1 = R + (minR - R) * .45;
    const P = (u, v) => { const lx = ((u - a / 2) + (v - b / 2) * e2[0]) * k, lz = (v - b / 2) * e2[1] * k; return { u, v, x: x + lx * ca - lz * sa, z: z + lx * sa + lz * ca }; };
    target = boundary.map((p) => { const t = angOf(p, x, z); return { x: x + Math.cos(t) * R1, z: z + Math.sin(t) * R1 }; });
    block = { a, b, P };
  } else if (hole) {
    // r143：courtyard 外环仍按**逐点径向投影**（每格 = 射线楔 ∩ 两条弦外侧 → 必凸）—— 不规则四边形边界上，
    // 换成严格等角目标会让第一圈带翻折（radius 2.7 / 3.1 直接抛 unsafe patch geometry），且长宽比只 0.595→0.620，
    // 故不采纳。细楔的真正来源是环带被过细分（见上面的 s=(minR−holeR)/(rings+2) 分配），不是这条投影。
    target = boundary.map((p) => { const t = angOf(p, x, z); return { x: x + Math.cos(t) * R, z: z + Math.sin(t) * R }; });
  } else {
    // radial：等角目标环（中心 N/2 扇要求严格等角，也天然等价于插入放射状的环）
    target = boundary.map((_, i) => { const t = phase + i * 2 * Math.PI / N; return { x: x + Math.cos(t) * R, z: z + Math.sin(t) * R }; });
  }
  let outer = boundary.map(clone);
  for (let r = 1; r <= rings; r++) {
    const t = r / rings, inner = boundary.map((p, i) => add(p.x * (1 - t) + target[i].x * t, p.z * (1 - t) + target[i].z * t));
    for (let i = 0; i < N; i++) polys.push([outer[i], outer[(i + 1) % N], inner[(i + 1) % N], inner[i]]);
    outer = inner;
  }
  if (template === 'radial') { const center = add(x, z); for (let i = 0; i < N; i += 2) polys.push([center, outer[i], outer[(i + 1) % N], outer[(i + 2) % N]]); }
  else if (block) {
    const { a, b, P } = block, lat = new Map();
    const at = (u, v) => { const k = u + ',' + v; if (!lat.has(k)) { const q = P(u, v); lat.set(k, add(q.x, q.z)); } return lat.get(k); };
    const per = []; for (let u = 0; u < a; u++) per.push(at(u, 0)); for (let v = 0; v < b; v++) per.push(at(a, v)); for (let u = a; u > 0; u--) per.push(at(u, b)); for (let v = b; v > 0; v--) per.push(at(0, v));
    if (signedArea(per) < 0) per.reverse();
    for (const q of zipperQuads(outer, per, x, z)) polys.push(q);
    for (let v = 0; v < b; v++) for (let u = 0; u < a; u++) polys.push([at(u, v), at(u + 1, v), at(u + 1, v + 1), at(u, v + 1)]);
    block.cells = a * b;
  } else {
    // 洞环：原洞边界顶点（原样共用）→ 正 K 边形（半径 R0），再与外环正 N 边形拉链
    const K = hole.length, R0 = holeR + (R - holeR) * .45;
    const hc = hole.map(clone), ring = hole.map((p) => { const t = angOf(p, x, z); return add(x + Math.cos(t) * R0, z + Math.sin(t) * R0); });
    for (let i = 0; i < K; i++) polys.push([ring[i], ring[(i + 1) % K], hc[(i + 1) % K], hc[i]]);
    for (const q of zipperQuads(outer, ring, x, z)) polys.push(q);
  }
  for (const p of polys) { if (signedArea(p) < 0) p.reverse(); if (signedArea(p) < 1e-8 || !isConvex(p)) throw new RangeError('unsafe patch geometry: choose another radius/centre'); }
  const result = finishGrid(polys, verts, { radius: grid.radius, hexSize: grid.hexSize, kind: grid.kind, triangles: polys.filter((p) => p.length === 3).length });
  const newOf = new Map(keptCells.map((c, i) => [c.id, i]));
  result.sourceCellOf = keptCells.map((c) => c.id).concat(Array(result.cells.length - outsideCount).fill(-1));
  result.patch = { template, x, z, sourceRadius: radius, holeRadius: holed ? holeRadius : 0, rings, innerRadius: R, ringSpacing: +ringSpacing.toFixed(4), minRingRadius: +minR.toFixed(4), holeRingRadius: +(holeR).toFixed(4), boundaryIds: boundary.map((p) => clone(p).id), holeBoundaryIds: hole ? hole.map((p) => clone(p).id) : [], holeCellIds: keptHole.map((id) => newOf.get(id)), lattice: block ? [block.a, block.b] : null, cellIds: result.cells.slice(outsideCount).map((c) => c.id), removedCells: removed.size, removedIds: [...removed] };
  return result;
}

/** 「换个半径/圆心再试」的确定性版本：依次试圆心微移 [0, ±0.35]、半径 ×[1, .94, 1.06, .88, 1.12, .82, 1.18]
 * 与环数 [rings, 1, 2, 3]，返回第一个通过凸性/无翻折校验的补丁（patch.tries 记录试了几次）；都不行则抛最后一个 RangeError。 */
export function fitTemplatePatch(grid, opts = {}) {
  const r0 = opts.radius ?? 3, h0 = opts.holeRadius ?? r0 * .4, x0 = opts.x ?? 0, z0 = opts.z ?? 0; let last = null, tries = 0;
  for (const [dx, dz] of [[0, 0], [.35, 0], [0, .35], [-.35, 0], [0, -.35]]) for (const f of [1, .94, 1.06, .88, 1.12, .82, 1.18]) for (const rings of [...new Set([opts.rings ?? 2, 1, 2, 3])]) {
    tries++;
    try { const g = insertTemplatePatch(grid, { ...opts, x: x0 + dx, z: z0 + dz, radius: r0 * f, holeRadius: h0 * f, rings }); g.patch.tries = tries; return g; }
    catch (e) { if (!(e instanceof RangeError) || /unknown patch template|invalid template|holeRadius < radius/.test(e.message)) throw e; last = e; }
  }
  throw last;
}
