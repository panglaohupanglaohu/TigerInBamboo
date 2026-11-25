import {baryPrep} from './spatial.js';
/**
 * infinite.js — 无限、确定、无缝的松弛四边形网格（Townscaper 的网格是"无限"的）。
 *
 * 依据：
 *   1151137783785771008 "an aperiodic infinite deterministic irregular relaxed quadrilateral grid"
 *     画面：拖动时六边形块一块块冒出来、松弛好，接缝看不出来。
 *   1151770831619534848 "relaxation clusters of 3 instead of 7 … Note also that the black and the white grid
 *     are *dual* to each other"   画面：一圈圈六边形块；一个圆形范围内的格子在松弛。
 *   1332410042784641026 "The grid is made of Patches. Adjacent triplets form Clusters. Clusters and Patches are
 *     relaxed independently. Each Vert is a triangular interpolation of its representation in the closest 2
 *     Clusters and the Patch wherein it sits."
 *   1302686201401442309 "A smoothing and inversion bug … inverted patches collapse into a mess, but are stretched
 *     out when interpolating"   → 这里每块 / 每簇各自松弛，外圈钉住，不会翻折；verify() 同时查两件事：
 *     翻折格数（有向面积 ≤ 0）+ 相对原始点阵的拉伸/收缩倍率（片中第二个症状是没翻折的邻格被拉长去补缺口）。
 *
 * 做法：
 *   块 = 三角点阵上的六边形（半径 N），中心在点阵 (q, r)，相邻块中心相差 (2N, -N) 等 6 个方向；
 *   每块用 hash(q, r) 当种子 → 合并 / 细分（core/grid.js quadPatchTopology），外圈点位置完全确定。
 *   簇 = 三个两两相邻的块（块中心三角形）；块、簇各自松弛（外圈钉住）。
 *   顶点最终位置 = 它在 [所在块, 最近的两个簇] 里的三个版本，按顶点在"块中心—簇中心—簇中心"三角形里的重心坐标插值。
 *   块边界上的点：两侧块的版本都 = 原位（钉住），最近的两个簇也相同 → 两侧算出来一模一样，无缝。
 */

import { quadPatchTopology, relaxPolygons, signedArea } from './grid.js';

const DIRS = (N) => [[2 * N, -N], [N, N], [-N, 2 * N], [-2 * N, N], [-N, -N], [N, -2 * N]];
const hash = (q, r) => ((Math.imul(q, 73856093) ^ Math.imul(r, 19349663)) >>> 0) % 100000 + 1;

/**
 * 生成以原点为中心、rings 圈的块，返回 { verts, quads, patches, clusters, versions }。
 * mode: 'raw' 不松弛 / 'patch' 只按块松弛（本地外圈钉住，边界无缝）/ 'cluster' 只按簇松弛 / 'blend' 块 + 两簇插值（最终）
 */
// 第 56 批 C06（1302686201401442309 复现）：bugPatches = 这些块的格在松弛里绕向取反（模拟原片的平滑/翻折 bug：
// 翻折块塌成一团，插值时又被拉开，邻块被迫拉长去补缺口）。默认 [] → 与旧行为逐位一致。
export function buildInfinite({ N = 4, L = 1, rings = 2, passes = 60, origin = [0, 0], bugPatches = [], areaPull = 0.85 } = {}) {
  const dirs = DIRS(N);
  // 块中心（点阵坐标）。origin = 任意一个块中心（第 50 轮，迁自 REACode src/quadinf.js 的「按坐标寻址」）：
  // 每块只由自己的 (q,r) 决定（hash 种子、外圈钉住），所以从哪个原点开窗口，同一块、同一簇算出来都一样 → 窗口可以无限平移拼接。
  if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isInteger)) throw new RangeError('origin must be integer lattice [q, r]');
  const centers = [[origin[0], origin[1]]];
  const seen = new Set([origin[0] + ',' + origin[1]]);
  for (let ring = 0; ring < rings; ring++) {
    for (const [q, r] of centers.slice()) for (const [dq, dr] of dirs) {
      const k = (q + dq) + ',' + (r + dr);
      if (!seen.has(k)) { seen.add(k); centers.push([q + dq, r + dr]); }
    }
  }
  // 合并顶点：按坐标 key
  const verts = [], key = new Map();
  const vid = (x, z, pinned) => {
    const k = Math.round(x * 1000) + ',' + Math.round(z * 1000);
    let v = key.get(k);
    if (!v) { v = { id: verts.length, x, z, x0: x, z0: z, pinned: false, rim: pinned, patches: [] }; verts.push(v); key.set(k, v); }
    return v;
  };
  const patches = centers.map(([q, r], pi) => {
    const t = quadPatchTopology({ N, L, q0: q, r0: r, seed: hash(q, r) });
    const map = new Map();
    for (const v of t.verts) map.set(v.id, vid(v.x, v.z, v.pinned));
    const quads = t.quads.map((qd) => qd.map((v) => map.get(v.id)));
    const vs = new Set(quads.flat());
    for (const v of vs) v.patches.push(pi);
    return { id: pi, q, r, center: t.center, quads, verts: [...vs] };
  });
  // 簇：三个两两相邻的块
  const pIndex = new Map(centers.map(([q, r], i) => [q + ',' + r, i]));
  const clusters = [];
  for (const P of patches) for (let d = 0; d < 6; d++) {
    const a = pIndex.get((P.q + dirs[d][0]) + ',' + (P.r + dirs[d][1]));
    const b = pIndex.get((P.q + dirs[(d + 1) % 6][0]) + ',' + (P.r + dirs[(d + 1) % 6][1]));
    if (a === undefined || b === undefined) continue;
    const ids = [P.id, a, b].sort((x, y) => x - y);
    if (ids[0] !== P.id) continue;   // 每个簇只建一次（由序号最小的块建）
    const c = ids.map((i) => patches[i].center);
    clusters.push({ id: clusters.length, patches: ids, center: [(c[0][0] + c[1][0] + c[2][0]) / 3, (c[0][1] + c[1][1] + c[2][1]) / 3] });
  }
  const bugQuads = new Set(patches.filter((P) => bugPatches.includes(P.id)).flatMap((P) => P.quads));
  // 松弛一组格子：外边界（只属于一个格子组的边上的点）钉住，返回 Map(vertId → [x, z])
  const relaxGroup = (quads) => {
    const vs = [...new Set(quads.flat())];
    const local = new Map(vs.map((v, i) => [v.id, { id: i, x: v.x0, z: v.z0, pinned: false }]));
    const ecount = new Map();
    for (const qd of quads) for (let i = 0; i < 4; i++) {
      const a = qd[i].id, b = qd[(i + 1) % 4].id, k = a < b ? a + ',' + b : b + ',' + a;
      ecount.set(k, (ecount.get(k) || 0) + 1);
    }
    for (const [k, n] of ecount) if (n === 1) for (const id of k.split(',')) local.get(+id).pinned = true;
    const polys = quads.map((qd) => { const pg = qd.map((v) => local.get(v.id)); return bugQuads.has(qd) ? pg.reverse() : pg; });
    relaxPolygons(polys, [...local.values()], passes, bugQuads.size ? 0 : areaPull);
    const out = new Map();
    for (const v of vs) { const l = local.get(v.id); out.set(v.id, [l.x, l.z]); }
    return out;
  };
  const patchPos = patches.map((P) => relaxGroup(P.quads));
  const clusterPos = clusters.map((C) => relaxGroup(C.patches.flatMap((i) => patches[i].quads)));
  // 每个顶点：所在块（取第一个）+ 包含这个块的最近两个簇
  const quadsAll = patches.flatMap((P) => P.quads);
  const weights = new Map(),baryCache=new Map(),barycentricStats={prepared:0,queries:0,degenerate:0};
  const blendAt = (v, pi) => {
    const P = patches[pi];
    const pp = patchPos[P.id].get(v.id);
    const cands = clusters.filter((C) => C.patches.includes(P.id) && clusterPos[C.id].has(v.id))
      .map((C) => ({ C, d: Math.hypot(C.center[0] - v.x0, C.center[1] - v.z0) })).sort((a2, b2) => a2.d - b2.d);
    if (cands.length < 2) return { p: pp, w: [1, 0, 0] };
    const c1 = cands[0].C, c2 = cands[1].C;
    // 重心坐标（块中心、簇 1 中心、簇 2 中心）
    const cacheKey=P.id+':'+c1.id+':'+c2.id;
    if(!baryCache.has(cacheKey)){
      const asPoint=p=>({x:p[0],z:p[1]});
      let prepared=null;
      try{prepared=baryPrep(asPoint(P.center),asPoint(c1.center),asPoint(c2.center));}
      catch(e){if(!(e instanceof RangeError))throw e;barycentricStats.degenerate++;}
      baryCache.set(cacheKey,prepared);barycentricStats.prepared++;
    }
    const query=baryCache.get(cacheKey);barycentricStats.queries++;
    if(!query)return{p:pp,w:[1,0,0]}; // Collinear centres cannot define interpolation.
    let[wa,wb]=query(v.x0,v.z0);
    wa = Math.max(0, wa); wb = Math.max(0, wb);
    let wc = Math.max(0, 1 - wa - wb);
    const s2 = wa + wb + wc || 1; wa /= s2; wb /= s2; wc /= s2;
    const p1 = clusterPos[c1.id].get(v.id), p2 = clusterPos[c2.id].get(v.id);
    return { p: [pp[0] * wa + p1[0] * wb + p2[0] * wc, pp[1] * wa + p1[1] * wb + p2[1] * wc], w: [wa, wb, wc] };
  };
  const final = new Map();
  for (const v of verts) { const r = blendAt(v, v.patches[0]); final.set(v.id, r.p); weights.set(v.id, r.w); }
  const versions = {
    raw: (v) => [v.x0, v.z0],
    patch: (v) => patchPos[v.patches[0]].get(v.id),
    cluster: (v) => { const C = clusters.find((c) => c.patches.includes(v.patches[0]) && clusterPos[c.id].has(v.id)); return C ? clusterPos[C.id].get(v.id) : [v.x0, v.z0]; },
    blend: (v) => final.get(v.id),
  };
  // Expose each owning patch representation: a shared final vertex alone can hide seams.
  const versionAt = (v, pi, mode = 'blend') => {
    if (!patches[pi] || !v.patches.includes(pi)) throw new RangeError('vertex does not belong to patch');
    if (mode === 'raw') return [v.x0,v.z0];
    if (mode === 'patch') return patchPos[pi].get(v.id);
    if (mode === 'blend') return blendAt(v,pi).p;
    if (mode === 'cluster') { const C=clusters.find(c=>c.patches.includes(pi)&&clusterPos[c.id].has(v.id)); return C ? clusterPos[C.id].get(v.id) : [v.x0,v.z0]; }
    throw new RangeError('unknown infinite grid mode');
  };
  return { barycentricStats, verts, quads: quadsAll, patches, clusters, versions, weights, blendAt, versionAt, areaPull: bugQuads.size ? 0 : areaPull, passes, N, rings };
}

/** 块中心点阵的第 k 个方向偏移（相邻块中心之差），给 origin 用：任意块中心 = Σ dirs 的整数组合。 */
export const patchStep = (N, k) => DIRS(N)[((k % 6) + 6) % 6];

/**
 * 两个窗口的接缝（第 50 轮，quadinf.measure 的「重叠顶点坐标差」口径搬过来）：
 * 只比较两个窗口里「所在块 + 最近两簇」都完整存在的顶点（窗口最外一圈块缺簇，不算），返回最大 / 平均位置差与比较数。
 */
export function windowSeam(a, b, mode = 'blend') {
  const key = (v) => Math.round(v.x0 * 1000) + ',' + Math.round(v.z0 * 1000);
  // 完整块 = 被 6 个簇包住（四周 6 个邻块都在窗口里）；它的顶点「所在块 + 最近两簇」才在两个窗口里都齐全
  const interior = (inf) => { const cnt = new Map(); for (const C of inf.clusters) for (const p of C.patches) cnt.set(p, (cnt.get(p) || 0) + 1); return new Set(inf.patches.filter((P) => (cnt.get(P.id) || 0) >= 6).map((P) => P.id)); };
  const fa = interior(a), fb = interior(b), mb = new Map();
  for (const v of b.verts) if (v.patches.every((p) => fb.has(p))) mb.set(key(v), v);
  let n = 0, max = 0, sum = 0;
  for (const v of a.verts) {
    if (!v.patches.every((p) => fa.has(p))) continue;
    const w = mb.get(key(v)); if (!w) continue;
    const p = a.versions[mode](v), q = b.versions[mode](w), d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    n++; sum += d; max = Math.max(max, d);
  }
  return { compared: n, max, mean: n ? sum / n : 0 };
}

/** 检查：翻折的格子数（有向面积 ≤ 0）、块边界两侧是否同一个点（无缝）、
 * 以及 1302686201401442309 里的第二个症状——没翻折的邻格被拉长去补翻折块的缺口。
 * 拉伸一律相对本格的原始点阵面积/边长（mode 'raw' 的同一格），因为合并格本来就比
 * 邻格大，用块内中位数当基准会把合规的大格误判成拉伸。 */
export function verify(inf, mode = 'blend', {stretchLimit = 2} = {}) {
  if (!Object.hasOwn(inf.versions,mode)) throw new RangeError('unknown infinite grid mode');
  if (!(Number.isFinite(stretchLimit) && stretchLimit > 1)) throw new RangeError('stretchLimit must be > 1');
  let flipped=0,invalid=0,seam=0,border=0,comparisons=0;
  let maxStretch=1,minShrink=1,maxEdgeStretch=1,minEdgeShrink=1,stretched=0,shrunk=0,worst=null;
  const edgesOf = (pts) => pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]));
  for(const P of inf.patches) for(const q of P.quads){
    const pts=q.map(v=>inf.versionAt(v,P.id,mode));
    if(!pts.every(p=>p?.length===2&&p.every(Number.isFinite))){invalid++;continue;}
    const area=signedArea(pts.map(([x,z])=>({x,z})));
    if(area<=0)flipped++;
    const raw=q.map(v=>inf.versionAt(v,P.id,'raw'));
    if(!raw.every(p=>p?.length===2&&p.every(Number.isFinite))){invalid++;continue;}
    const rawArea=Math.abs(signedArea(raw.map(([x,z])=>({x,z}))));
    if(!(rawArea>0)){invalid++;continue;}
    const ratio=area/rawArea;
    if(ratio>maxStretch){maxStretch=ratio;worst={patch:P.id,cell:q.map(v=>v.id),ratio};}
    minShrink=Math.min(minShrink,ratio);
    if(ratio>=stretchLimit)stretched++; else if(ratio<=1/stretchLimit)shrunk++;
    const e=Math.max(...edgesOf(pts)),er=Math.max(...edgesOf(raw));
    if(er>0){maxEdgeStretch=Math.max(maxEdgeStretch,e/er);minEdgeShrink=Math.min(minEdgeShrink,Math.min(...edgesOf(pts))/Math.min(...edgesOf(raw)));}
  }
  for(const v of inf.verts)if(v.patches.length>1){border++;
    for(let i=0;i<v.patches.length;i++)for(let j=i+1;j<v.patches.length;j++){
      const a=inf.versionAt(v,v.patches[i],mode),b=inf.versionAt(v,v.patches[j],mode);comparisons++;
      const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(Number.isFinite(d))seam=Math.max(seam,d);else invalid++;
    }
  }
  return{quads:inf.quads.length,areaPull:inf.areaPull??null,flipped,invalid,border,seam,comparisons,
    maxStretch,minShrink,maxEdgeStretch,minEdgeShrink,stretched,shrunk,stretchLimit,worst};
}

/** Relax one group of quads exactly like buildInfinite's relaxGroup (outer edges pinned). */
function relaxQuads(quads,passes,areaPull=0){
  const vs=[...new Set(quads.flat())],local=new Map(vs.map((v,i)=>[v.id,{id:i,x:v.x0,z:v.z0,pinned:false}])),ecount=new Map();
  for(const qd of quads)for(let i=0;i<4;i++){const a=qd[i].id,b=qd[(i+1)%4].id,k=a<b?a+','+b:b+','+a;ecount.set(k,(ecount.get(k)||0)+1);}
  for(const [k,n] of ecount)if(n===1)for(const id of k.split(','))local.get(+id).pinned=true;
  relaxPolygons(quads.map(qd=>qd.map(v=>local.get(v.id))),[...local.values()],passes,areaPull);
  const out=new Map();for(const v of vs){const l=local.get(v.id);out.set(v.id,[l.x,l.z]);}return out;
}

/**
 * 按需流式生成（1151770831619534848 "generate fewer unrelaxed patches before I can start relaxing"）。
 * 不预先开窗口：请求某块的最终坐标时才生成它需要的块拓扑、块松弛和 6 个三块簇的松弛，全部按 (q,r) 缓存。
 * 每块仍只由自己的 hash(q,r) 决定，所以结果与 buildInfinite 窗口内的同一块一致（测试对账）。
 * counters 记录真实生成量：最终化一块要 7 块拓扑（自己 + 6 邻）—— 这就是"3 块一簇"的代价。
 */
export function createInfiniteStream({N=4,L=1,passes=60,clusterSize=3,areaPull=0.85}={}){
  if(clusterSize!==3&&clusterSize!==7)throw new RangeError('clusterSize must be 3 or 7');
  if(!Number.isInteger(N)||N<1||N>16||!Number.isFinite(L)||L<=0||!Number.isInteger(passes)||passes<0)throw new RangeError('invalid infinite stream options');
  const dirs=DIRS(N),verts=[],vkey=new Map(),topo=new Map(),patchRelax=new Map(),clusterRelax=new Map(),finals=new Map();
  const counters={patches:0,patchRelax:0,clusterRelax:0,finalized:0};
  const vid=(x,z)=>{const k=Math.round(x*1000)+','+Math.round(z*1000);let v=vkey.get(k);if(!v){v={id:verts.length,x0:x,z0:z};verts.push(v);vkey.set(k,v);}return v;};
  const check=(q,r)=>{if(!Number.isInteger(q)||!Number.isInteger(r))throw new RangeError('integer patch lattice coordinates required');const a=(q-r)/(3*N),b=a+r/N;if(!Number.isInteger(a)||!Number.isInteger(b))throw new RangeError('not a patch centre (use combinations of step(k))');};
  const patch=(q,r)=>{check(q,r);const k=q+','+r;let P=topo.get(k);if(!P){const t=quadPatchTopology({N,L,q0:q,r0:r,seed:hash(q,r)}),map=new Map(t.verts.map(v=>[v.id,vid(v.x,v.z)]));P={q,r,center:t.center,quads:t.quads.map(qd=>qd.map(v=>map.get(v.id)))};topo.set(k,P);counters.patches++;}return P;};
  const relaxedPatch=(q,r)=>{const k=q+','+r;let m=patchRelax.get(k);if(!m){m=relaxQuads(patch(q,r).quads,passes,areaPull);patchRelax.set(k,m);counters.patchRelax++;}return m;};
  const cluster=ids=>{const sorted=[...ids].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),k=sorted.map(p=>p.join(',')).join('|');let C=clusterRelax.get(k);
    if(!C){const ps=sorted.map(([q,r])=>patch(q,r)),c=ps.map(P=>P.center);C={key:k,center:[c.reduce((s,p)=>s+p[0],0)/c.length,c.reduce((s,p)=>s+p[1],0)/c.length],pos:relaxQuads(ps.flatMap(P=>P.quads),passes,areaPull)};clusterRelax.set(k,C);counters.clusterRelax++;}return C;};
  /** Final (blended) positions for every vertex of patch (q,r): Map(vertexId → [x,z]). */
  const finalPatch=(q,r)=>{const k=q+','+r;if(finals.has(k))return finals.get(k);
    const P=patch(q,r),pp=relaxedPatch(q,r),clusters=clusterSize===3?dirs.map((d,i)=>cluster([[q,r],[q+d[0],r+d[1]],[q+dirs[(i+1)%6][0],r+dirs[(i+1)%6][1]]])):[[0,0],...dirs].map(([dq,dr])=>{const h=[q+dq,r+dr];return cluster([h,...dirs.map(([eq,er])=>[h[0]+eq,h[1]+er])]);});
    const prep=new Map(),out=new Map();
    for(const v of new Set(P.quads.flat())){
      const cands=clusters.map(C=>({C,d:Math.hypot(C.center[0]-v.x0,C.center[1]-v.z0)})).sort((a,b)=>a.d-b.d||(a.C.key<b.C.key?-1:1)),c1=cands[0].C,c2=cands[1].C,pk=c1.key+'#'+c2.key;
      if(clusterSize===7){
        // 7-block analogue: no patch term (its centre would coincide with its own hub); blend the three
        // nearest hub clusters. Depends only on base position + global keys, so both sides of a seam agree.
        const c3=cands[2].C,k3=pk+'#'+c3.key;if(!prep.has(k3)){let f=null;try{f=baryPrep({x:c1.center[0],z:c1.center[1]},{x:c2.center[0],z:c2.center[1]},{x:c3.center[0],z:c3.center[1]});}catch(e){if(!(e instanceof RangeError))throw e;}prep.set(k3,f);}
        const f=prep.get(k3);let w=f?f(v.x0,v.z0).map(x=>Math.max(0,x)):[1,0,0];const s=w[0]+w[1]+w[2]||1;w=w.map(x=>x/s);
        const ps=[c1,c2,c3].map(C=>C.pos.get(v.id));out.set(v.id,[ps.reduce((a,p,i)=>a+p[0]*w[i],0),ps.reduce((a,p,i)=>a+p[1]*w[i],0)]);continue;
      }
      if(!prep.has(pk)){let f=null;try{f=baryPrep({x:P.center[0],z:P.center[1]},{x:c1.center[0],z:c1.center[1]},{x:c2.center[0],z:c2.center[1]});}catch(e){if(!(e instanceof RangeError))throw e;}prep.set(pk,f);}
      const f=prep.get(pk),p0=pp.get(v.id);if(!f){out.set(v.id,p0);continue;}
      let[wa,wb]=f(v.x0,v.z0);wa=Math.max(0,wa);wb=Math.max(0,wb);let wc=Math.max(0,1-wa-wb);const s=wa+wb+wc||1;wa/=s;wb/=s;wc/=s;
      const p1=c1.pos.get(v.id),p2=c2.pos.get(v.id);out.set(v.id,[p0[0]*wa+p1[0]*wb+p2[0]*wc,p0[1]*wa+p1[1]*wb+p2[1]*wc]);
    }
    finals.set(k,out);counters.finalized++;return out;};
  // 第 56 批 C06：真流式要能丢掉远处缓存（结果只由 (q,r) 决定，丢掉再要会重算出同一份）。keep(q,r) 为假的块全部丢弃。
  const evict=keep=>{let n=0;const kq=k=>k.split(',').map(Number);for(const m of [topo,patchRelax,finals])for(const k of [...m.keys()])if(!keep(...kq(k))){m.delete(k);if(m===topo)n++;}
    for(const k of [...clusterRelax.keys()])if(!k.split('|').some(p=>keep(...kq(p))))clusterRelax.delete(k);counters.evicted=(counters.evicted||0)+n;return n;};
  const cached=()=>({patches:topo.size,patchRelax:patchRelax.size,clusters:clusterRelax.size,finals:finals.size});
  return{N,L,passes,counters,verts,patch,finalPatch,evict,cached,step:k=>dirs[((k%6)+6)%6]};
}

/** 3 块一簇 vs 7 块一簇：最终化一块之前必须先生成多少块未松弛拓扑。
 * 两种都由流式生成器实测：tri = 6 个三块簇；hept = 以本块和 6 个邻块为中心的 7 块簇、取最近三簇插值，要两圈 19 块。 */
export function clusterCost({N=2,passes=4}={}){
  const tri=createInfiniteStream({N,passes,clusterSize:3}),hept=createInfiniteStream({N,passes,clusterSize:7});tri.finalPatch(0,0);hept.finalPatch(0,0);
  return{tri:tri.counters.patches,triClusters:tri.counters.clusterRelax,hept:hept.counters.patches,heptClusters:hept.counters.clusterRelax,ratio:hept.counters.patches/tri.counters.patches};
}

/** 1151770831619534848 "the black and the white grid are *dual* to each other":
 * dual of a quad set — one dual vertex per quad (its centroid), one dual face per interior primal
 * vertex (incident quad centroids in angular order). pos(v) supplies the primal positions (any mode).
 */
export function quadDual(quads,pos){
  const inc=new Map(),edgeUse=new Map(),cent=new Map();
  quads.forEach((qd,i)=>{const P=qd.map(pos);cent.set(i,[P.reduce((s,p)=>s+p[0],0)/4,P.reduce((s,p)=>s+p[1],0)/4]);
    for(let k=0;k<4;k++){const v=qd[k],w=qd[(k+1)%4],key=v.id<w.id?v.id+','+w.id:w.id+','+v.id;edgeUse.set(key,(edgeUse.get(key)||0)+1);if(!inc.has(v.id))inc.set(v.id,{v,quads:[]});inc.get(v.id).quads.push(i);}});
  const rim=new Set();for(const [k,n] of edgeUse)if(n===1)for(const id of k.split(','))rim.add(+id);
  const faces=[];for(const {v,quads:qs} of inc.values()){if(rim.has(v.id))continue;const [x,z]=pos(v);
    const ring=qs.map(i=>({i,a:Math.atan2(cent.get(i)[1]-z,cent.get(i)[0]-x)})).sort((a,b)=>a.a-b.a);faces.push({vertex:v.id,at:[x,z],quads:ring.map(r=>r.i),pts:ring.map(r=>cent.get(r.i))});}
  return{vertices:[...cent.values()],faces,primalEdges:edgeUse.size,interiorEdges:[...edgeUse.values()].filter(n=>n===2).length};
}
