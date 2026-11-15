import assert from 'node:assert/strict';
import {Atlas,shelfPack} from '../src/core/atlas.js';
let s=5;const rnd=()=>((s=(Math.imul(s,1664525)+1013904223)|0)>>>0)/4294967296;
const overlap=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
// 1) 递归"手臂"：每节都是真实分配、互不重叠；碎板子上手指更多（1765115069837221962）
const clean=new Atlas(128,128),A=clean.recursiveFill({seed:3,size:24,minSize:3});
assert(A.arm.length>5);for(let i=0;i<A.arm.length;i++){const r=A.arm[i];assert(clean.isRotated===undefined||!clean.isRotated(r));for(let j=0;j<i;j++)assert(!overlap(r,A.arm[j]));assert(clean.canPlace(r.x,r.y,1,1)===false);}
assert.equal(clean.rects().length,A.arm.length);
let fragFingers=0,cleanFingers=0,fragTree=0,cleanTree=0;
for(let seed=1;seed<=12;seed++){
 const c=new Atlas(128,128),cr=c.recursiveFill({seed,size:24});cleanFingers+=cr.avgFingers;cleanTree+=cr.avgTreeFingers;
 const f=new Atlas(128,128);s=seed*97;const keys=[];for(let i=0;i<220;i++){const k='f'+i;if(f.place(k,2+Math.floor(rnd()*9),2+Math.floor(rnd()*9),{rng:rnd}))keys.push(k);}for(let i=0;i<keys.length;i+=2)f.remove(keys[i]);
 const before=f.rects().map(r=>JSON.stringify(r)).sort();const r=f.recursiveFill({seed,size:24});fragFingers+=r.avgFingers;fragTree+=r.avgTreeFingers;
 const after=new Set(f.rects().map(r=>JSON.stringify(r)));for(const b of before)assert(after.has(b),'live slots never move');
}
assert(fragTree>cleanTree*1.5,'fragmented board: committing parse touches more leaves');
// 2) 旋转：横条放不下、竖着能放；记录 isRotated，释放后可再用
const t=new Atlas(10,40);assert.equal(t.place('bar',30,8),null);const bar=t.place('bar',30,8,{rotate:true,rng:()=>0});assert(bar&&bar.w===8&&bar.h===30&&t.isRotated(bar));assert(!t.isRotated(t.place('sq',2,2,{rotate:true})));assert(t.remove('bar'));assert(t.place('bar2',8,30));assert.throws(()=>t.place('x',1,1,{rotate:'yes'}));
// 3) 货架基线 vs 暴力撒点：同一批尺寸，撒点放进去的不少于货架
let shelfFill=0,binFill=0;for(let seed=1;seed<=8;seed++){s=seed;const sizes=Array.from({length:120},()=>[4+Math.floor(rnd()*28),4+Math.floor(rnd()*28)]);const sh=shelfPack(160,160,sizes);for(let i=0;i<sh.rects.length;i++)for(let j=0;j<i;j++)assert(!overlap(sh.rects[i],sh.rects[j]));const b=new Atlas(160,160);let used=0;sizes.forEach(([w,h],i)=>{if(b.place('k'+i,w,h,{attempts:200,rng:rnd}))used+=w*h;});shelfFill+=sh.fill;binFill+=used/(160*160);}
assert(binFill>shelfFill,'brute-force candidates beat shelf baseline');
assert.throws(()=>shelfPack(10,10,[[1.5,2]]));assert.throws(()=>clean.recursiveFill({size:2.5}));
console.log({arm:A.arm.length,cleanFingers:+(cleanFingers/12).toFixed(2),fragFingers:+(fragFingers/12).toFixed(2),cleanTree:+(cleanTree/12).toFixed(2),fragTree:+(fragTree/12).toFixed(2),shelfFill:+(shelfFill/8).toFixed(3),binFill:+(binFill/8).toFixed(3)},'PASS recursive arm/fingers on shared Atlas, stable live slots, 90° rotate fallback, shelf baseline');
