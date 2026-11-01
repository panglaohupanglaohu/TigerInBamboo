import * as THREE from 'three';
import {createIrregularQuadGrid} from '../procgen/graph/irregularQuadGrid.js';
import {solveWfc} from '../procgen/wfc/solver.js';
import {BitSet} from '../procgen/core/bitSet.js';
// Twelve Apostles, target sheet 2026-10-13 - Oskar-advisor redo #2 (project method, not the author's code).
// 1. Grid: Townscaper-style irregular quad grid (hex of triangles -> random pairs merged into quads ->
//    split 1->4 -> shape+size relaxation), reused from src/procgen/graph/irregularQuadGrid.js.
// 2. WFC: every grid CORNER gets a column level 0..L (0 = open sea) with the project's solver
//    (src/procgen/wfc/solver.js: min-entropy, bitset propagation, bounded backtracking). A column is
//    solid from the sea floor up to its level, so every layer is carried by the one below (no
//    overhang floating). Adjacency: two land corners may differ by at most MAX_STEP levels, so
//    tall lobes must descend through shoulders/terraces/saddles; sea corners may meet any level
//    (sea cliffs). Composition seeds (main peak, spurs, tables, bay stacks) pin/bound the domains;
//    sea, rail clearance and town margin are pinned to 0.
// 3. Geometry: per quad and per layer, corner occupancy (level >= layer) is marched like Townscaper's
//    dual-grid corners: iso points sit on the shared quad edges, so outlines bend with the relaxed
//    grid (no axis-aligned boxes). Walls carry strata rows, edge-consistent in/out depth, a vertical
//    fold per segment, wet dark foot, grass drape; caps are flat turf; bushes root on real caps.
export const twelveApostlesTargetEnabled=()=>new URLSearchParams(globalThis.location?.search||'').get('apostlesTarget')!=='0';

const C=hex=>new THREE.Color(hex);
const PAL={
 rock:[C(0xe2dbc8),C(0xd6d3c6),C(0xc8cdcc),C(0xe6e0d0),C(0xcfd1cc),C(0xd9d4c3),C(0xc1c7c9)],
 shade:C(0x8f9ca6),wet:C(0x4f5961),deep:C(0x313b44),
 grass:C(0x9abb57),grassDrape:C(0x7f9a50),
 bush:[0x3c6a39,0x46773f,0x335d33,0x527f45],talus:[0xb9bcb8,0xa9aeac,0xc4c4bc]
};
export const LEVEL_Y=[0,6.5,12.5,19,26,34,42];
const MAX_STEP=2,BASE=-5;
// lateral d: + seaward, - landward; s: metres along the rail. lobes: [x(lat), z(along), rx, rz, topHeight m, rot]
// size: triangle edge of the hex grid (final quads are ~size/2).
// lobes: [x(lat), z(along), rx, rz, LEVEL index, rot]. size: hex triangle edge (final quads ~size/2).
export const APOSTLE_MASSES=[
 {id:'back-left',  s:-48,d:-36,size:6,lobes:[[2,4,20,16,2,.2],[-8,-8,13,10,3,.1],[-7,12,7,7,4,0],[10,-13,6,5,1,0]]},
 {id:'back-right', s:26, d:-42,size:6.4,lobes:[[4,6,24,20,2,.3],[-6,-2,17,14,3,.2],[-12,-10,11,9,4,0],[-15,-16,7,6,5,.1],[9,17,8,7,4,0]]},
 {id:'back-tower', s:60, d:-24,size:4.2,lobes:[[0,0,8.5,8,4,0],[3,-7,10,8,2,.4]]},
 {id:'front-left', s:-52,d:36, size:6,lobes:[[0,0,24,19,1,.15],[-8,-3,16,13,2,.1],[14,-13,6,5,1,0],[11,15,5,5.5,2,0],[-14,9,7,6,3,0]]},
 {id:'front-right',s:56, d:38, size:6,lobes:[[0,0,20,19,1,-.2],[-8,3,13,12,2,-.1],[-12,-7,6.5,6,3,0],[12,-12,5.5,6,1,0]]},
 {id:'bay-1',s:-14,d:26,size:2.6,spire:true,lobes:[[0,0,6.5,5.5,2,.3],[3.5,3,3,3,1,0]]},
 {id:'bay-2',s:12, d:22,size:2.4,spire:true,lobes:[[0,0,4.8,4.4,2,0]]},
 {id:'bay-3',s:6, d:38,size:2.4,spire:true,generated:{seed:31,rx:5,rz:4.4,h:1}},
 {id:'bay-4',s:-8,d:48,size:2.3,spire:true,generated:{seed:47,rx:3.9,rz:3.5,h:2}},
];

function rng(seed){let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const hash=(a,b,c=0)=>{let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,2147483647);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
const strHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};

// Constraint-generated stack sample: a base table plus 0-2 sub-blocks chosen by rule.
// rule: vertical combination = smaller block one level higher set inside the base (a step);
// horizontal combination = block one level lower pushed past the rim (a shoulder / ledge).
export function sampleApostleLobes({seed,rx,rz,h}){const r=rng(seed),L=[[0,0,rx,rz,h,r()*1.2]],n=Math.floor(r()*3);
 for(let k=0;k<n;k++){const a=r()*6.28;if(r()<.55){const f=.4+r()*.2;L.push([Math.cos(a)*rx*.35,Math.sin(a)*rz*.35,rx*f,rz*f,h+1,r()]);}
  else if(h>1){const f=.45+r()*.2;L.push([Math.cos(a)*rx*.95,Math.sin(a)*rz*.95,rx*f,rz*f,h-1,r()]);}}
 return L;}

// lobe membership: f<1 inside (superellipse with noisy rim); returns {cap level, core}
function makeLobeField(lobes,seed){
 const r=rng(seed),L=lobes.map(([cx,cz,rx,rz,h,rot=0])=>({cx,cz,rx,rz,lv:Math.min(LEVEL_Y.length-1,h),c:Math.cos(rot),s:Math.sin(rot),ph:[r()*6.28,r()*6.28,r()*6.28]}));
 const f=(l,x,z)=>{const dx=x-l.cx,dz=z-l.cz,u=dx*l.c+dz*l.s,v=-dx*l.s+dz*l.c,a=Math.atan2(v,u);
  const g=Math.pow(Math.abs(u)/l.rx,2.4)+Math.pow(Math.abs(v)/l.rz,2.4),thr=1+.14*Math.sin(3*a+l.ph[0])+.09*Math.sin(5*a+l.ph[1])+.05*Math.sin(9*a+l.ph[2]);return g/thr;};
 return{L,at(x,z){let cap=0,floor=0;for(const l of L){const g=f(l,x,z);if(g<1.0)cap=Math.max(cap,l.lv);if(g<.62)floor=Math.max(floor,l.lv);else if(g<.86)floor=Math.max(floor,Math.max(1,l.lv-1));}return{cap,floor:Math.min(floor,cap)};}};
}

// ---- WFC over grid corners with the project solver
function solveCornerLevels({nV,adj,domains,pins,seed,maxLevel,spire}){
 const NL=maxLevel+1;
 const variants=Array.from({length:NL},(_,l)=>({key:'L'+l,weight:l===0?1:Math.pow(spire?2:4,l)}));
 const compiled={variants,variantIndex:new Map(variants.map((v,i)=>[v.key,i]))};
 const compat=variants.map((_,a)=>{const b=new BitSet(NL,false);for(let c=0;c<NL;c++){if(a===0||c===0||Math.abs(a-c)<=(spire?3:MAX_STEP))b.set(c);}return b;});
 const ids=Array.from({length:nV},(_,i)=>'c'+i);
 const graph={kind:'apostle-corner-graph',cellCount:nV,cells:()=>ids.map((id,index)=>({id,index})),neighborsOf:i=>adj[i].map(to=>({to,direction:'X'})),indexOfId:id=>ids.indexOf(id)};
 const bans=[];for(let i=0;i<nV;i++)for(let l=0;l<NL;l++)if(l<domains[i][0]||l>domains[i][1])bans.push({cell:i,variant:l,reason:'composition'});
 const pinList=pins.filter(p=>p.level>=domains[p.cell][0]&&p.level<=domains[p.cell][1]).map(p=>({cell:p.cell,variant:p.level,source:p.source}));
 const attempts=[];
 for(let k=0;k<4;k++){
  const res=solveWfc({graph,compiled,table:{compatible:{X:compat}},compatibleFor:()=>compat,seed:seed+k*7919,pins:pinList,bans,maxBacktrack:64});
  attempts.push({seed:seed+k*7919,ok:res.ok,reason:res.reason,observations:res.stats?.observations,backtracks:res.stats?.backtracks});
  if(res.ok)return{levels:Array.from(res.assignment),attempts,solutionHash:res.solutionHash,pins:pinList.length,bans:bans.length};
 }
 // bounded fallback: composition ceilings, still support-safe; reported as not solved
 const st=spire?3:MAX_STEP,conflicts=[];for(let i=0;i<nV;i++)for(const j of adj[i])if(i<j){const[a0,a1]=domains[i],[b0,b1]=domains[j];if(a0>=1&&b0>=1&&(a0>b1+st||b0>a1+st))conflicts.push([i,j,domains[i],domains[j]]);}
 return{levels:domains.map(d=>d[0]),attempts,solutionHash:null,failed:true,pins:pinList.length,bans:bans.length,conflicts:conflicts.slice(0,6),pinsUsed:pinList};
}

function shallowSheet(pts,ext,bend){const n=Math.ceil(ext*2/2.2),st=ext*2/n,pos=[],col=[],idx=[],c0=new THREE.Color(0x46cbbf);
 for(let a=0;a<=n;a++)for(let b=0;b<=n;b++){const x=-ext+a*st,z=-ext+b*st;let d=Infinity;for(const p of pts)d=Math.min(d,Math.hypot(x-p[0],z-p[1]));
  const al=Math.max(0,Math.min(1,1-(d-1.2)/8));pos.push(x,.24-bend(x,z),z);col.push(c0.r,c0.g,c0.b,.5*al*al);}
 for(let a=0;a<n;a++)for(let b=0;b<n;b++){const i0=a*(n+1)+b;idx.push(i0,i0+1,i0+n+2,i0,i0+n+2,i0+n+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,4));g.setIndex(idx);return g;}
const inPoly=(x,z,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};

export function buildTwelveApostlesTarget({parent,radius=160,railCurves,railPoints,waterAt,protectedBoxes=[],plazaMargin=()=>Infinity,referencePoint,masses=APOSTLE_MASSES,clearance=10}){
 let nearest=null;for(const[name,curve]of Object.entries(railCurves||{})){if(!curve?.getPointAt)continue;const length=curve.getLength(),count=Math.ceil(length/2);for(let i=0;i<count;i++){const u=i/count,p=curve.getPointAt(u),dd=p.distanceToSquared(referencePoint);if(!nearest||dd<nearest.dd)nearest={name,curve,length,u,dd};}}
 if(!nearest)throw new Error('twelve apostles need the actual rail curves');
 const report={version:'apostles-oskar-wfc-7',railSource:nearest.name,masses:[],railUnchanged:true,triangles:0,levels:LEVEL_Y,maxStep:MAX_STEP},rocks=[];
 const _sz=new THREE.Vector3();protectedBoxes=protectedBoxes.filter(e=>e.box.getSize(_sz).length()<25);
 parent.updateWorldMatrix(true,false);const parentInv=parent.matrixWorld.clone().invert();
 const rockMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:false,roughness:.95,metalness:0,side:THREE.DoubleSide});
 const bushMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9});
 const talusMat=new THREE.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:.95});
 const foamMat=new THREE.MeshBasicMaterial({color:0xf2f7f5,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
 const shoalMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide});
 const bushGeo=new THREE.IcosahedronGeometry(1,1),talusGeo=new THREE.DodecahedronGeometry(1,0);
 for(const[mi,m]of masses.entries()){
  const seed=7300+mi*101;
  const u=THREE.MathUtils.euclideanModulo(nearest.u+m.s/nearest.length,1),p=nearest.curve.getPointAt(u),t=nearest.curve.getTangentAt(u).normalize(),up0=p.clone().normalize(),lat=new THREE.Vector3().crossVectors(up0,t).normalize();
  const dir=p.clone().addScaledVector(lat,m.d).normalize(),water=waterAt(dir);if(!water){report.masses.push({id:m.id,rejected:'no-water'});continue;}
  const Y=water.clone().normalize(),X=lat.clone().addScaledVector(Y,-lat.dot(Y)).normalize(),Z=new THREE.Vector3().crossVectors(X,Y);
  const frame=new THREE.Matrix4().makeBasis(X,Y,Z).setPosition(water),Rw=water.length();
  const bend=(x,z)=>(x*x+z*z)/(2*Rw);
  const toWorld=(x,y,z)=>new THREE.Vector3(x,y-bend(x,z),z).applyMatrix4(frame);
  const nearRail=railPoints.filter(q=>q.distanceTo(water)<120);
  const reach0=clearance+.7*m.size+1.2;const blocked=(x,z,h)=>{const reach=reach0+3.5*hash(Math.round(x*3),Math.round(z*3),seed+91);for(const y of[0,h*.5,h]){const w=toWorld(x,y,z);if(nearRail.some(q=>q.distanceToSquared(w)<reach*reach))return'rail';if(protectedBoxes.some(e=>e.box.distanceToPoint(w)<2.5))return'protected';if(plazaMargin(w.clone().normalize())<6)return'town';}return null;};
  const lobes=m.lobes||sampleApostleLobes(m.generated);const field=makeLobeField(lobes,seed);
  // ---- 1. irregular quad grid (hex -> tris -> quads -> 1:4 -> relax)
  const ext=Math.max(...lobes.map(([cx,cz,rx,rz])=>Math.hypot(cx,cz)+Math.max(rx,rz)*1.3))+m.size;
  const gridR=Math.max(2,Math.ceil(ext/m.size)),gridSeed=strHash(m.id)%100000;
  const grid=createIrregularQuadGrid({seed:gridSeed,radius:gridR,size:m.size,relaxIterations:30});
  const rot=hash(seed,1)*Math.PI,rc=Math.cos(rot),rs=Math.sin(rot);
  const vIndex=new Map(grid.vertexIds.map((id,i)=>[id,i]));
  const VP=grid.vertexIds.map(id=>{const[x,y]=grid.positions[id];return[x*rc-y*rs,x*rs+y*rc];});
  const faces=grid.faces.map(f=>f.map(id=>vIndex.get(id)));
  const nV=VP.length,adjS=Array.from({length:nV},()=>new Set());
  for(const f of faces)for(let i=0;i<4;i++){const a=f[i],b=f[(i+1)%4];adjS[a].add(b);adjS[b].add(a);}
  const adj=adjS.map(s=>[...s].sort((a,b)=>a-b));
  const boundary=new Set(grid.boundaryVertexIds.map(id=>vIndex.get(id)));
  // ---- 2. domains + composition seeds
  const maxLevel=LEVEL_Y.length-1,domains=[],drop={rail:0,protected:0,town:0},pins=[];
  const cap=new Array(nV),floor=new Array(nV),hard=new Array(nV);
  for(let i=0;i<nV;i++){const[x,z]=VP[i];const a=field.at(x,z);cap[i]=a.cap;floor[i]=a.floor;hard[i]=boundary.has(i)?0:maxLevel;
   if(!boundary.has(i)){let hm=maxLevel;while(hm>0&&blocked(x,z,LEVEL_Y[hm]))hm--;if(cap[i]>0&&hm<cap[i]){const why=blocked(x,z,LEVEL_Y[cap[i]]);drop[why]=(drop[why]||0)+1;}hard[i]=Math.min(hard[i],hm);}}
  const step=m.spire?3:MAX_STEP;
  for(let it=0;it<12;it++){let ch=false;for(let i=0;i<nV;i++){if(cap[i]<1)continue;for(const j of adj[i]){
    if(cap[j]>=1&&cap[j]<cap[i]-step){cap[j]=cap[i]-step;ch=true;}           // land neighbour may rise to carry a shoulder
    if(hard[i]>=1&&hard[j]>hard[i]+step&&cap[j]>=1){hard[j]=hard[i]+step;ch=true;}}} if(!ch)break;}
  for(let i=0;i<nV;i++){const c=Math.min(cap[i],hard[i]);domains.push([Math.min(floor[i],c),c]);}
  for(const[li,l]of field.L.entries()){let best=-1,bd=Infinity;for(let i=0;i<nV;i++){const d=Math.hypot(VP[i][0]-l.cx,VP[i][1]-l.cz);if(d<bd){bd=d;best=i;}}
   // a composition seed only where that lobe is the dominant one, and only if no neighbour floor contradicts it
   if(best>=0&&domains[best][1]===l.lv&&adj[best].every(j=>domains[j][0]<1||Math.abs(domains[j][0]-l.lv)<=(m.spire?3:MAX_STEP)))pins.push({cell:best,level:l.lv,source:'lobe-'+li});}
  const sol=solveCornerLevels({nV,adj,domains,pins,seed:seed*31+7,maxLevel,spire:!!m.spire});
  const lv=sol.levels;
  // ---- 2b. constrained contour smoothing. Each layer's occupancy (lv>=k) is smoothed on the corner graph
  // (linear operator, so layer k stays inside layer k-1: support is preserved). Single-corner spurs and
  // notches (< ~1.5 m) fall below / rise above the 0.5 iso value and merge away; iso points are then
  // interpolated from these values, so outlines run smoothly across quads instead of corner by corner.
  // Corners blocked by rail / town / protected volumes, and the grid rim, are clamped below the iso value.
  const SMOOTH_IT=2,SMOOTH_A=.5,occ=[];
  for(let k=0;k<=maxLevel;k++){let S=new Float32Array(nV);if(k===0){S.fill(1);occ.push(S);continue;}
   for(let i=0;i<nV;i++)S[i]=lv[i]>=k?1:0;
   for(let it=0;it<SMOOTH_IT;it++){const N=new Float32Array(nV);for(let i=0;i<nV;i++){let t=0;for(const j of adj[i])t+=S[j];N[i]=(1-SMOOTH_A)*S[i]+SMOOTH_A*t/Math.max(1,adj[i].length);}S=N;}
   for(let i=0;i<nV;i++)if(k>hard[i]||boundary.has(i))S[i]=Math.min(S[i],.49);
   occ.push(S);}
  const topL=new Int32Array(nV);let smoothChanged=0;for(let i=0;i<nV;i++){let t=0;for(let k=1;k<=maxLevel;k++)if(occ[k][i]>=.5)t=k;topL[i]=t;if(t!==lv[i])smoothChanged++;}
  if(!lv.some(l=>l>0)){report.masses.push({id:m.id,rejected:'no-land',wfc:sol.attempts});continue;}
  // ---- 3. marching geometry per quad per layer
  const P=[],Cc=[],Hn=[],bushes=[],talus=[],foamSegs=[],r=rng(seed+5);
  const push=(v,col)=>{P.push(v[0],v[1],v[2]);Cc.push(col.r,col.g,col.b);};
  const tri=(a,b,c,ca,cb,cc,h='cap')=>{push(a,ca);push(b,cb);push(c,cc);Hn.push(h);};
  const quad=(a,b,c,d,ca,cb=ca,cc=ca,cd=ca,h='cap')=>{tri(a,b,c,ca,cb,cc,h);tri(a,c,d,ca,cc,cd,h);};
  const strata=(y,ph)=>1+.05*Math.sin(y*1.35+ph)+.025*Math.sin(y*3.1+ph*2);
  const rockCol=(base,y,depth,ph)=>{const c=base.clone().lerp(PAL.shade,Math.min(.5,Math.max(0,depth)*.3)).multiplyScalar(strata(y,ph));
   if(y<2.4){const w=Math.min(1,(2.4-y)/2.2);c.lerp(y<-.4?PAL.deep:PAL.wet,w);}return c;};
  const ekey=(a,b)=>a<b?a*100003+b:b*100003+a;
  // iso point on edge (solid a, empty b) for layer k, pushed into the rock by depth d (edge-consistent)
  const isoT=(a,b,k)=>{const lo=Math.min(a,b),hi=Math.max(a,b),vl=occ[k][lo],vh=occ[k][hi];return Math.min(.92,Math.max(.08,(vl-.5)/(vl-vh)));}; // interpolated, param from the lower-index vertex
  const iso=(a,b,k,d)=>{const lo=Math.min(a,b),hi=Math.max(a,b);let tt=isoT(a,b,k);// tt measured from lo
   const A=VP[lo],B=VP[hi],len=Math.hypot(B[0]-A[0],B[1]-A[1]);
   let ts=lo===a?tt:1-tt;ts=Math.max(.06,ts-d/len);// ts measured from solid a
   const S=VP[a],E=VP[b];return[S[0]+(E[0]-S[0])*ts,S[1]+(E[1]-S[1])*ts];};
  const rowsFor=(k,sea)=>{const y0=sea?BASE:LEVEL_Y[k-1],y1=LEVEL_Y[k],drape=.35+hash(k,seed,3)*.3,ys=[y0];if(sea)ys.push(.9+hash(k,seed,4)*.8);
   let y=ys[ys.length-1];while(y+2.6<y1-drape){y+=2.2+hash(Math.round(y*10),k,seed)*1.8;if(y<y1-drape-.6)ys.push(y);}ys.push(y1-drape,y1);return ys;};
  const depthAt=(a,b,k,row,rows,sea)=>{if(row===rows-1)return 0;const base=.15+hash(ekey(a,b)%99991,k,seed+51)*.9;let d=base+(hash(ekey(a,b)%99991,k*13+row,seed+52)-.5)*.9;
   if(sea&&row===0)d+=.5;if(sea&&k===1&&row>0)d-=.35*(1-row/rows);return Math.max(-.3,d);};
  let solidCorners=[];for(let i=0;i<nV;i++)if(topL[i]>0)solidCorners.push(VP[i]);
  for(const f of faces){
   const fl=f.map(i=>topL[i]),top=Math.max(...fl);if(top===0)continue;
   const fh=hash(f[0],f[2],seed+9);
   for(let k=1;k<=top;k++){
    const s=fl.map(l=>l>=k);
    // marching polygon (depth 0) + wall segments between consecutive iso points
    const poly=[],walls=[];
    for(let i=0;i<4;i++){const a=f[i],b=f[(i+1)%4];if(s[i])poly.push({p:VP[a],corner:a});
     if(s[i]!==s[(i+1)%4]){const so=s[i]?a:b,em=s[i]?b:a;poly.push({p:iso(so,em,k,0),edge:[so,em],out:s[i]});}}
    for(let i=0;i<poly.length;i++){const A=poly[i],B=poly[(i+1)%poly.length];if(A.edge&&B.edge&&A.out&&!B.out)walls.push([A.edge,B.edge]);}
    // cap: flat turf at LEVEL_Y[k] (fan from centroid)
    const cx=poly.reduce((t,q)=>t+q.p[0],0)/poly.length,cz=poly.reduce((t,q)=>t+q.p[1],0)/poly.length,yk=LEVEL_Y[k];
    const capCol=PAL.grass.clone().multiplyScalar(.97+hash(f[1],k,seed+21)*.05);
    if(!fl.every(l=>l>k))for(let i=0;i<poly.length;i++){const A=poly[i].p,B=poly[(i+1)%poly.length].p;tri([cx,yk,cz],[A[0],yk,A[1]],[B[0],yk,B[1]],capCol,capCol,capCol);}
    // walls
    const sea=k===1;
    for(const[e1,e2]of walls){
     const rows=rowsFor(k,sea),nr=rows.length-1,ph=hash(e1[0],e2[0],seed)*6.28,base=PAL.rock[k%PAL.rock.length].clone().lerp(PAL.rock[Math.floor(hash(e1[0]+e2[1],k,seed+56)*PAL.rock.length)],.22);
     const L=r=>iso(e1[0],e1[1],k,depthAt(e1[0],e1[1],k,r,nr,sea)),R=r=>iso(e2[0],e2[1],k,depthAt(e2[0],e2[1],k,r,nr,sea));
     // vertical fold in the middle of the segment: pushed in (joint) or out (buttress)
     const p0=iso(e1[0],e1[1],k,0),p1=iso(e2[0],e2[1],k,0);let nx=p1[1]-p0[1],nz=-(p1[0]-p0[0]);const ln=Math.hypot(nx,nz)||1;nx/=ln;nz/=ln;
     {const sc=VP[e1[0]],mx=(p0[0]+p1[0])/2-sc[0],mz=(p0[1]+p1[1])/2-sc[1];if(nx*mx+nz*mz<0){nx=-nx;nz=-nz;}}
     const fold=(hash(e1[0]*7+e2[0],k,seed+57)-.45)*1.3*Math.min(1,ln/2);
     const M=(row)=>{const a=L(row),b=R(row),dd=row===nr-1?0:fold;return[(a[0]+b[0])/2+nx*dd,(a[1]+b[1])/2+nz*dd];};
     const shadeOf=(row)=>.94+hash(row,k,seed+58)*.08;
     // No turf bands on continuous cliff columns: grass belongs only to exposed terraces.
     const exposedRim=topL[e1[0]]===k || topL[e2[0]]===k;
     for(let row=0;row<nr;row++){const ya=rows[row],yb=rows[row+1];const drapeRow=row===nr-1&&exposedRim;
      const ca=(y=>drapeRow?PAL.grassDrape.clone():rockCol(base.clone().multiplyScalar(shadeOf(row)),y,depthAt(e1[0],e1[1],k,row,nr,sea),ph));
      // bottom of this row uses the row's own depth; rows are joined by ledges below
      const a0=L(row),b0=R(row),m0=M(row);
      const hw=[nx,0,nz];quad([a0[0],ya,a0[1]],[m0[0],ya,m0[1]],[m0[0],yb,m0[1]],[a0[0],yb,a0[1]],ca(ya),ca(ya),ca(yb),ca(yb),hw);
      quad([m0[0],ya,m0[1]],[b0[0],ya,b0[1]],[b0[0],yb,b0[1]],[m0[0],yb,m0[1]],ca(ya),ca(ya),ca(yb),ca(yb),hw);
      if(row+1<nr){const a1=L(row+1),b1=R(row+1),m1=M(row+1),cl=rockCol(base,yb,.6,ph).multiplyScalar(.85),hl=depthAt(e1[0],e1[1],k,row,nr,sea)<depthAt(e1[0],e1[1],k,row+1,nr,sea)?[0,1,0]:[0,-1,0];
       quad([a0[0],yb,a0[1]],[m0[0],yb,m0[1]],[m1[0],yb,m1[1]],[a1[0],yb,a1[1]],cl,cl,cl,cl,hl);quad([m0[0],yb,m0[1]],[b0[0],yb,b0[1]],[b1[0],yb,b1[1]],[m1[0],yb,m1[1]],cl,cl,cl,cl,hl);}}
     // vegetation along the turf rim (on this cap, inset toward rock) unless a higher layer covers it
     const mid=[(p0[0]+p1[0])/2-nx*(.7+r()*.5),(p0[1]+p1[1])/2-nz*(.7+r()*.5)];
     if(exposedRim&&hash(e1[0],e2[0],seed+61+k)<(m.spire?.08:.1)&&!(fl.some(l=>l>k)&&hash(f[0],k,seed+62)<.6))bushes.push([mid[0],yk,mid[1],p1[0]-p0[0],p1[1]-p0[1]]);
     // wall foot vegetation on the lower table
     if(!sea&&exposedRim&&hash(e2[0],e1[0],seed+64+k)<(m.spire?.06:.14)){const ft=[(p0[0]+p1[0])/2+nx*(.8+r()*.4),(p0[1]+p1[1])/2+nz*(.8+r()*.4)];bushes.push([ft[0],LEVEL_Y[k-1],ft[1],p1[0]-p0[0],p1[1]-p0[1]]);}
     if(sea){foamSegs.push({a:p0,b:p1,nx,nz});
      if(hash(e1[0]+3,e2[0],seed+71)<.2){const n=1+Math.floor(r()*3);for(let q=0;q<n;q++){const tt=r(),out=.6+r()*1.8,sz=.45+r()*.9,x=p0[0]+(p1[0]-p0[0])*tt+nx*out,z=p0[1]+(p1[1]-p0[1])*tt+nz*out;if(!blocked(x,z,1))talus.push([x,-.35+r()*.5,z,sz]);}}}
    }
    // occasional meadow clump on a top cap
    if(k===top&&fl.every(l=>l===k)&&fh<.04)bushes.push([cx,yk,cz,1,0]);
   }
  }
  for(let q=0;q<P.length;q+=3)P[q+1]-=bend(P[q],P[q+2]);
  const geo=new THREE.BufferGeometry();
  // normals + winding: with DoubleSide three.js flips the normal of back-facing fragments, so each triangle
  // is first wound to face its hint (caps up, walls outward, ledges up/down). Turf caps then get the smooth
  // curved-sea normal (no faceted patches); walls/ledges keep a flat face normal.
  {const Nn=new Float32Array(P.length),swap=(o,a,b)=>{for(let c=0;c<3;c++){let t=P[o+a*3+c];P[o+a*3+c]=P[o+b*3+c];P[o+b*3+c]=t;t=Cc[o+a*3+c];Cc[o+a*3+c]=Cc[o+b*3+c];Cc[o+b*3+c]=t;}};
   for(let t=0;t<Hn.length;t++){const o=t*9,cap=Hn[t]==='cap',h=cap?[0,1,0]:Hn[t];
    const ux=P[o+3]-P[o],uy=P[o+4]-P[o+1],uz=P[o+5]-P[o+2],vx=P[o+6]-P[o],vy=P[o+7]-P[o+1],vz=P[o+8]-P[o+2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const L=Math.hypot(nx,ny,nz)||1;nx/=L;ny/=L;nz/=L;
    if(nx*h[0]+ny*h[1]+nz*h[2]<0){swap(o,1,2);nx=-nx;ny=-ny;nz=-nz;}
    if(cap){for(let v=0;v<3;v++){const x=P[o+v*3],z=P[o+v*3+2],l=Math.hypot(x/Rw,1,z/Rw);Nn[o+v*3]=x/Rw/l;Nn[o+v*3+1]=1/l;Nn[o+v*3+2]=z/Rw/l;}}
    else for(let v=0;v<3;v++){Nn[o+v*3]=nx;Nn[o+v*3+1]=ny;Nn[o+v*3+2]=nz;}}
   geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));geo.setAttribute('normal',new THREE.BufferAttribute(Nn,3));}geo.computeBoundingBox();geo.computeBoundingSphere();
  const maxL=Math.max(...topL),maxH=LEVEL_Y[maxL];geo.userData.twelveApostles={id:m.id,height:maxH};
  const rock=new THREE.Mesh(geo,rockMat);rock.name='g30-far-mountain';rock.castShadow=rock.receiveShadow=true;
  rock.userData.apostleMass=m.id;rock.userData.seaStack={height:maxH,radius:geo.boundingSphere.radius,detailId:'apostle-'+m.id,seaAnchor:water.toArray(),worldUp:Y.toArray(),placement:'apostles-oskar-wfc',waterSupport:'rendered-ocean-triangle'};
  parent.add(rock);parentInv.clone().multiply(frame).decompose(rock.position,rock.quaternion,rock.scale);rock.updateWorldMatrix(true,false);
  let tris=P.length/9;
  const blobs=[];for(const[x,y,z,ex0,ez0]of bushes){const el=Math.hypot(ex0,ez0)||1,ex=ex0/el,ez=ez0/el,n=3+Math.floor(r()*4);for(let q=0;q<n;q++){const along=(r()-.5)*2.6,side=(r()-.5)*1,rad=.38+r()*.45;blobs.push([x+ex*along-ez*side,y,z+ez*along+ex*side,rad]);}}
  if(blobs.length){const inst=new THREE.InstancedMesh(bushGeo,bushMat,blobs.length);inst.name='apostle-bushes';const mm=new THREE.Matrix4(),qq=new THREE.Quaternion(),col=new THREE.Color();
   blobs.forEach(([x,y,z,s],k)=>{qq.setFromEuler(new THREE.Euler(0,r()*6.28,0));mm.compose(new THREE.Vector3(x,y-bend(x,z)+s*.55,z),qq,new THREE.Vector3(s,s*.85,s));inst.setMatrixAt(k,mm);inst.setColorAt(k,col.setHex(PAL.bush[k%PAL.bush.length]));});
   inst.instanceMatrix.needsUpdate=true;inst.castShadow=true;rock.add(inst);tris+=blobs.length*80;}
  if(talus.length){const inst=new THREE.InstancedMesh(talusGeo,talusMat,talus.length);inst.name='apostle-talus';const mm=new THREE.Matrix4(),qq=new THREE.Quaternion(),col=new THREE.Color();
   talus.forEach(([x,y,z,s],k)=>{qq.setFromEuler(new THREE.Euler(r()*3,r()*6.28,r()*3));mm.compose(new THREE.Vector3(x,y-bend(x,z),z),qq,new THREE.Vector3(s,s*.65,s*.85));inst.setMatrixAt(k,mm);inst.setColorAt(k,col.setHex(PAL.talus[k%PAL.talus.length]));});
   inst.instanceMatrix.needsUpdate=true;inst.castShadow=true;rock.add(inst);tris+=talus.length*36;}
  {const pts=[];for(const sg of foamSegs){const ex=sg.b[0]-sg.a[0],ez=sg.b[1]-sg.a[1],el=Math.hypot(ex,ez)||1,ux=ex/el*.35,uz=ez/el*.35,w=.9+hash(Math.round(sg.a[0]*10),Math.round(sg.a[1]*10),seed)*.6;
    const at=(x,z,o)=>{const X1=x+sg.nx*o,Z1=z+sg.nz*o;return[X1,.3-bend(X1,Z1),Z1];};
    const q0=at(sg.a[0]-ux,sg.a[1]-uz,-.5),q1=at(sg.b[0]+ux,sg.b[1]+uz,-.5),q2=at(sg.b[0]+ux,sg.b[1]+uz,w),q3=at(sg.a[0]-ux,sg.a[1]-uz,w);pts.push(...q0,...q1,...q2,...q0,...q2,...q3);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));const foam=new THREE.Mesh(g,foamMat);foam.name='apostle-foam';foam.renderOrder=2;rock.add(foam);}
  const shoal=new THREE.Mesh(shallowSheet(solidCorners,ext+6,bend),shoalMat);shoal.name='apostle-shallows';shoal.renderOrder=1;rock.add(shoal);
  let minRail=Infinity;for(let q=0;q<P.length;q+=27){const w=new THREE.Vector3(P[q],P[q+1],P[q+2]).applyMatrix4(frame);for(const rp of nearRail)minRail=Math.min(minRail,rp.distanceTo(w));}
  rocks.push(rock);report.triangles+=Math.round(tris);
  const hist=Array(maxLevel+1).fill(0);for(const l of lv)hist[l]++;
  report.masses.push({id:m.id,s:m.s,d:m.d,source:m.lobes?'hand-assembled':'constraint-generated',lobes:lobes.length,
   grid:{seed:gridSeed,hexRadius:gridR,triSize:m.size,vertices:nV,quads:faces.length,hash:grid.hash},
   smoothing:{iterations:SMOOTH_IT,alpha:SMOOTH_A,cornersChanged:smoothChanged},wfc:{solved:!sol.failed,conflicts:sol.conflicts,pinsUsed:sol.failed?sol.pinsUsed:undefined,attempts:sol.attempts,solutionHash:sol.solutionHash,pins:sol.pins,bans:sol.bans,levelHistogram:hist},
   height:maxH,minRail:+minRail.toFixed(2),dropped:drop,bushes:blobs.length,talus:talus.length,triangles:Math.round(tris)});
 }
 report.built=rocks.length;return{rocks,report};
}
