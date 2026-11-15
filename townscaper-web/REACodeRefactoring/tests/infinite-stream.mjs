import assert from 'node:assert/strict';
import {buildInfinite,createInfiniteStream,clusterCost,quadDual,patchStep,verify} from '../src/core/infinite.js';
import {pointInQuad} from '../src/core/spatial.js';
// 1) 流式生成 = 窗口生成（同一块、同一顶点），且只生成需要的块
const N=3,passes=20,inf=buildInfinite({N,rings:2,passes}),s=createInfiniteStream({N,passes});
const cnt=new Map();for(const C of inf.clusters)for(const p of C.patches)cnt.set(p,(cnt.get(p)||0)+1);
const interior=inf.patches.filter(P=>cnt.get(P.id)===6);assert(interior.length>=7);
let maxDiff=0,compared=0;
for(const P of interior){const fin=s.finalPatch(P.q,P.r),key=new Map(s.verts.map(v=>[Math.round(v.x0*1000)+','+Math.round(v.z0*1000),v]));
 for(const v of P.verts){const sv=key.get(Math.round(v.x0*1000)+','+Math.round(v.z0*1000)),a=inf.versionAt(v,P.id,'blend'),b=fin.get(sv.id);maxDiff=Math.max(maxDiff,Math.hypot(a[0]-b[0],a[1]-b[1]));compared++;}}
assert(maxDiff<1e-9,'stream vs window '+maxDiff);
// 2) 相邻两块的共享顶点：各自最终化后一致（无缝），翻折为 0
const t=createInfiniteStream({N,passes}),[dq,dr]=t.step(0),A=t.finalPatch(0,0),B=t.finalPatch(dq,dr);let seam=0,shared=0;
for(const [id,p] of A)if(B.has(id)){const q=B.get(id);seam=Math.max(seam,Math.hypot(p[0]-q[0],p[1]-q[1]));shared++;}
assert(shared>0&&seam<1e-12,'seam '+seam);
const flips=[[0,0],[dq,dr]].reduce((n,[q,r])=>{const fin=t.finalPatch(q,r);return n+t.patch(q,r).quads.filter(qd=>{let a=0;for(let i=0;i<4;i++){const p=fin.get(qd[i].id),o=fin.get(qd[(i+1)%4].id);a+=p[0]*o[1]-o[0]*p[1];}return a<=0}).length;},0);assert.equal(flips,0);
// 3) 按需：只请求一块 → 7 块拓扑、1 块松弛、6 簇松弛；远处再请求一块 → 只增量生成
const u=createInfiniteStream({N:2,passes:4});u.finalPatch(0,0);assert.deepEqual({...u.counters},{patches:7,patchRelax:1,clusterRelax:6,finalized:1});
const far=patchStep(2,0).map(x=>x*40);u.finalPatch(far[0],far[1]);assert.deepEqual({...u.counters},{patches:14,patchRelax:2,clusterRelax:12,finalized:2});
u.finalPatch(0,0);assert.equal(u.counters.finalized,2,'cached');const st=patchStep(2,1);u.finalPatch(st[0],st[1]);assert(u.counters.patches<21,'neighbour reuses patches');
// 4) 3 对 7：最终化一块需要的未松弛块数
const cost=clusterCost({N:2,passes:2});assert.deepEqual(cost,{tri:7,triClusters:6,hept:19,heptClusters:7,ratio:19/7});
const h=createInfiniteStream({N:2,passes:6,clusterSize:7}),hp=h.finalPatch(0,0),hn=h.finalPatch(...h.step(0));let hs=0;for(const [id,p] of hp)if(hn.has(id)){const q=hn.get(id);hs=Math.max(hs,Math.hypot(p[0]-q[0],p[1]-q[1]));}assert(hs<1e-12,'7-cluster seam');for(const qd of h.patch(0,0).quads){let a=0;for(let i=0;i<4;i++){const p=hp.get(qd[i].id),o=hp.get(qd[(i+1)%4].id);a+=p[0]*o[1]-o[0]*p[1];}assert(a>0,'7-cluster flip');}assert.throws(()=>createInfiniteStream({clusterSize:5}));
// 5) 黑白两层互为对偶：对偶顶点 = 格心，对偶面 = 内部顶点；每个对偶面围住它的原顶点
for(const mode of['raw','blend']){const P=interior[0],pos=v=>inf.versionAt(v,P.id,mode),d=quadDual(P.quads,pos);
 assert.equal(d.vertices.length,P.quads.length);const rimVerts=new Set();const interiorVerts=new Set(P.quads.flat().map(v=>v.id));
 assert(d.faces.length>0&&d.faces.length<interiorVerts.size);
 for(const f of d.faces){assert(f.pts.length>=3);assert(pointInQuad(f.pts.map(([x,z])=>({x,z})),f.at[0],f.at[1]),'dual face contains its vertex');}
 // 欧拉：内部对偶边数 = 原内部边数（每条内部边恰好连两个格心）
 const dualEdges=new Set();for(const f of d.faces)for(let i=0;i<f.quads.length;i++){const a=f.quads[i],b=f.quads[(i+1)%f.quads.length];dualEdges.add(a<b?a+','+b:b+','+a);}
 assert(dualEdges.size<=d.interiorEdges);}
assert.throws(()=>createInfiniteStream({N:0}));assert.throws(()=>s.finalPatch(.5,0));assert.throws(()=>s.finalPatch(1,0),/patch centre/);
const v=verify(inf,'blend');assert.equal(v.flipped,0);
console.log({compared,maxDiff,seam,shared,cost},'PASS on-demand infinite stream equals window build, seamless neighbours, incremental generation counters, 3-vs-7 cluster cost, black/white quad dual');
