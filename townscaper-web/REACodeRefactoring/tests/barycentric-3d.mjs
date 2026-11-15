import assert from 'node:assert/strict';
import {baryPrep,baryPrep3,baryCramer3,baryPoint,baryInside,baryColor} from '../src/core/spatial.js';
import {buildInfinite} from '../src/core/infinite.js';
let s=11;const rnd=()=>((s=(Math.imul(s,1664525)+1013904223)|0)>>>0)/4294967296;
// 1) 任意朝向平面：随机三角形 + 平面内的点，权重和 Cramer 一致、反算回原点
let maxErr=0,maxBack=0,n=0;
for(let k=0;k<20000;k++){
 const a={x:rnd()*10,y:rnd()*10,z:rnd()*10},b={x:rnd()*10,y:rnd()*10,z:rnd()*10},c={x:rnd()*10,y:rnd()*10,z:rnd()*10};
 let q;try{q=baryPrep3(a,b,c)}catch(e){assert(e instanceof RangeError);continue}
 const w0=[rnd(),rnd(),rnd()],sum=w0[0]+w0[1]+w0[2];w0.forEach((v,i)=>w0[i]=v/sum*1.4-.15);const p=baryPoint(a,b,c,[w0[0],w0[1],1-w0[0]-w0[1]]);
 const w=q(p.x,p.y,p.z),r=baryCramer3(a,b,c,p),back=baryPoint(a,b,c,w);
 maxErr=Math.max(maxErr,...w.map((v,i)=>Math.abs(v-r[i])));maxBack=Math.max(maxBack,Math.hypot(back.x-p.x,back.y-p.y,back.z-p.z));
 assert(Math.abs(w[0]+w[1]+w[2]-1)<1e-12);assert(Math.abs(q.distance(p.x,p.y,p.z))<1e-9);n++;
}
assert(n>19000&&maxErr<1e-8&&maxBack<1e-9,JSON.stringify({maxErr,maxBack}));
// 2) 平面外的点 = 投影点的权重 + 有符号离面距离
const A={x:0,y:0,z:0},B={x:2,y:1,z:0},C={x:0,y:1,z:2},q=baryPrep3(A,B,C),P=baryPoint(A,B,C,[.2,.3,.5]),N=q.normal,off={x:P.x+N[0]*3,y:P.y+N[1]*3,z:P.z+N[2]*3};
q(off.x,off.y,off.z).forEach((v,i)=>assert(Math.abs(v-[.2,.3,.5][i])<1e-12));assert(Math.abs(q.distance(off.x,off.y,off.z)-3)<1e-12);
// 3) 极瘦三角形（高/底 = 1e-9，斜放在三维里）：叉积式比 Cramer 稳
const rot=p=>({x:.6*p.x-.8*p.z+3,y:p.y+.7*p.x,z:.8*p.x+.6*p.z-2});
const ta=rot({x:0,y:0,z:0}),tb=rot({x:1000,y:0,z:0}),tc=rot({x:500,y:1e-6,z:0}),tq=baryPrep3(ta,tb,tc);
let thin=0,cramer=0;for(const w of[[.3,.3,.4],[.1,.8,.1],[.45,.1,.45],[1/3,1/3,1/3]]){const p=baryPoint(ta,tb,tc,w),g=tq(p.x,p.y,p.z),r=baryCramer3(ta,tb,tc,p);thin=Math.max(thin,...g.map((v,i)=>Math.abs(v-w[i])));cramer=Math.max(cramer,...r.map((v,i)=>Math.abs(v-w[i])));}
assert(thin<1e-3,'thin '+thin);
// 4) 退化：'throw' 抛 RangeError；'flag' 退到最长边，一维坐标和为 1、不出 NaN
assert.throws(()=>baryPrep3(A,B,{x:4,y:2,z:0}),RangeError);
const d=baryPrep3(A,B,{x:4,y:2,z:0},{degenerate:'flag'});assert.equal(d.degenerate,true);const dw=d(2,1,0);assert.deepEqual(dw.map(v=>+v.toFixed(12)),[.5,0,.5]);
const same=baryPrep3(A,A,A,{degenerate:'flag'});assert.deepEqual(same(5,5,5),[1,0,0]);
assert.throws(()=>baryPrep3(A,B,C,{degenerate:'maybe'}));assert.throws(()=>q(NaN,0,0));
// 5) 与二维 baryPrep（无限网格两簇插值用的那个）在 XZ 平面上逐点一致
const inf=buildInfinite({N:2,rings:1,passes:8});let agree=0;
for(const C0 of inf.clusters){const [pa,pb,pc]=C0.patches.map(i=>inf.patches[i].center).map(([x,z])=>({x,z}));const q2=baryPrep(pa,pb,pc),q3=baryPrep3(pa,pb,pc);for(const v of inf.verts.slice(0,40)){const u=q2(v.x0,v.z0),w=q3(v.x0,0,v.z0);u.forEach((x,i)=>assert(Math.abs(x-w[i])<1e-12));agree++;}}
// 6) gizmo 辅助：内部判定、三色
assert(baryInside([.2,.3,.5])&&!baryInside([-.1,.6,.5]));assert.deepEqual(baryColor([1.2,-.1,.4]),{r:1,g:0,b:.4});
console.log({random:n,maxErr,maxBack,thin,cramerThin:cramer,agree},'PASS 3D arbitrary-plane barycentric, projection distance, thin triangles, flagged degenerates, 2D agreement');
