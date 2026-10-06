import {resolveMountainParams} from './mountainRelease.js';
import * as THREE from 'three';

// Authored ridge graph: shared endpoints are saddles, rather than isolated
// radial cones. Coordinates belong to the existing castle terrain chart.
export const RIDGE_GRAPH = [
 {kind:'main',a:[-91,-34,23],b:[-72,-39,37],width:16},
 {kind:'main',a:[-72,-39,37],b:[-49,-35,27],width:17},
 {kind:'main',a:[-49,-35,27],b:[-28,-29,26],width:16},
 {kind:'main',a:[-28,-29,26],b:[-8,-37,22],width:14},
 {kind:'spur',a:[-72,-39,37],b:[-82,-13,14],width:10},
 {kind:'spur',a:[-49,-35,27],b:[-53,-9,11],width:11},
 {kind:'spur',a:[-28,-29,26],b:[-17,-7,10],width:10},
 {kind:'main',a:[-8,-37,22],b:[12,-24,15],width:14},
 {kind:'main',a:[12,-24,15],b:[36,-27,20],width:15},
 {kind:'main',a:[36,-27,20],b:[57,-38,17],width:16},
 {kind:'spur',a:[36,-27,20],b:[44,-6,8],width:12},
];
const smooth=(x,a,b)=>THREE.MathUtils.smoothstep(x,a,b);
function legacyRidgeHeight(x,z){
 let height=-5;
 for(const {a,b,width} of RIDGE_GRAPH){
  const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  const distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
  const crest=THREE.MathUtils.lerp(a[2],b[2],smooth(t,0,1));
  // Broad shoulders give way to steeper lower faces; the crest never ends
  // in the point singularity of a cone.
  const h=-5+(crest+5)*Math.exp(-1.65*(distance/width)**2);
  height=Math.max(height,h);
 }
 // Shallow connected downslope grooves. This is an authored erosion proxy,
 // not a hydraulic simulation or a claim of running WFC/MCF.
 const g=Math.sin(x*.37+z*.13+Math.sin(z*.12)*1.6);
 const groove=Math.pow(Math.max(0,g),6)*1.25;
 const bedding=Math.sin(z*.48+x*.09)*.35;
 return height-groove+bedding;
}
export function landformWeight(x,y,z){
 return smooth(y,-32,-10)*smooth(z,-53,-30)*(1-smooth(z,-4,9))*smooth(x,-106,-91)*(1-smooth(x,61,77));
}
// Uniform subdivision keeps adjacent triangles' edges identical after the
// nonlinear deformation. Attributes including terrain semantics interpolate.
function subdivide(source){
 const specs=Object.entries(source.attributes).filter(([n])=>n!=='normal'),values=Object.fromEntries(specs.map(([n])=>[n,[]]));
 const count=source.index?.count??source.attributes.position.count;
 const bary=[[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5]];
 for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(k=>source.index?source.index.getX(i+k):i+k);
  for(const q of [0,3,5,3,1,4,5,4,2,3,4,5])for(const [n,a] of specs)for(let k=0;k<a.itemSize;k++)
   values[n].push(ids.reduce((s,id,j)=>s+a.array[id*a.itemSize+k]*bary[q][j],0));
 }
 const g=new THREE.BufferGeometry();for(const [n,a]of specs)g.setAttribute(n,new THREE.Float32BufferAttribute(values[n],a.itemSize));
 g.userData={...source.userData};return g;
}
function legacyShapeMountainLandform(castle,{rail=[],protectedBoxes=[]}={}){
 const mesh=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!mesh)return null;
 castle.updateWorldMatrix(true,true);
 const toCastle=castle.matrixWorld.clone().invert().multiply(mesh.matrixWorld),toMesh=toCastle.clone().invert();
 const sourceVertices=mesh.geometry.attributes.position.count;
 const geometry=subdivide(mesh.geometry),a=geometry.attributes.position,v=new THREE.Vector3();
 let changed=0,maxMove=0,protectedVertices=0;const relaxation=new Float32Array(a.count);const blocked=new THREE.Vector3();
 for(let i=0;i<a.count;i++){
  v.fromBufferAttribute(a,i).applyMatrix4(toCastle);
  if(geometry.attributes.shoreBoundaryBottom?.getX(i)>0)continue;
  const weight=landformWeight(v.x,v.y,v.z);if(!weight)continue;
  const old=v.y,w=v.clone().applyMatrix4(castle.matrixWorld);
  const desired=THREE.MathUtils.lerp(old,legacyRidgeHeight(v.x,v.z),weight*.95);
  blocked.set(v.x,desired,v.z).applyMatrix4(castle.matrixWorld);
  let protection=1;
  for(const box of protectedBoxes){protection=Math.min(protection,smooth(Math.min(box.distanceToPoint(w),box.distanceToPoint(blocked)),3,12));if(!protection)break;}
  if(rail.some(p=>Math.min(p.distanceToSquared(w),p.distanceToSquared(blocked))<400))protection=0;
  if(!protection){protectedVertices++;continue;}
  v.y=THREE.MathUtils.lerp(old,desired,protection);relaxation[i]=weight*protection;
  if(Math.abs(v.y-old)<1e-5)continue;
  changed++;maxMove=Math.max(maxMove,Math.abs(v.y-old));v.applyMatrix4(toMesh);a.setXYZ(i,v.x,v.y,v.z);
 }
 const smoothing=smoothRidgeSurface(geometry,relaxation,toCastle,toMesh);
 a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 return {version:1,method:'authored connected ridge graph with bounded groove relief',ridgeGraph:RIDGE_GRAPH,changed,maxMove,protectedVertices,railMargin:20,buildingMargin:3,sourceVertices,vertices:a.count,smoothing};
}

// Oriented local bounds avoid world AABBs swallowing bare peaks when the
// entire island is rotated on the spherical world. Keep every real mesh fixed.
export function landformProtection(castle){
 const bounds=[],tmp=new THREE.Vector3();
 castle.traverse(o=>{if(!o.isMesh||!o.geometry||o.userData.isOutline)return;
  if(!(o.userData.westCityWalkable||/bridge-deck|stair|town-terrace-.*floor|foundation|harbor-deck/.test(o.name)))return;
  o.geometry.computeBoundingBox();
  const add=matrix=>{const inverse=matrix.clone().invert(),box=o.geometry.boundingBox.clone(),scale=new THREE.Vector3().setFromMatrixScale(matrix),minScale=Math.min(scale.x,scale.y,scale.z);
   bounds.push({distanceToPoint:p=>box.distanceToPoint(tmp.copy(p).applyMatrix4(inverse))*minScale});};
  if(o.isInstancedMesh){for(let i=0;i<o.count;i++){const m=new THREE.Matrix4();o.getMatrixAt(i,m);add(o.matrixWorld.clone().multiply(m));}}else add(o.matrixWorld);
 });
 return bounds;
}

// Weld equivalent triangle vertices before relaxation so shared boundaries
// cannot split. Only height changes; protected vertices have zero mobility.
function smoothRidgeSurface(geometry,mobility,toCastle,toMesh){
 const a=geometry.attributes.position,lookup=new Map(),nodes=[],ids=[],v=new THREE.Vector3();
 for(let i=0;i<a.count;i++){
  v.fromBufferAttribute(a,i);const key=v.toArray().map(n=>Math.round(n*1e4)).join(',');let id=lookup.get(key);
  if(id===undefined){id=nodes.length;lookup.set(key,id);nodes.push({p:v.clone().applyMatrix4(toCastle),mobility:mobility[i],adj:new Set()});}
  nodes[id].mobility=Math.min(nodes[id].mobility,mobility[i]);ids.push(id);
 }
 for(let i=0;i<ids.length;i+=3)for(let k=0;k<3;k++){const n=nodes[ids[i+k]];n.adj.add(ids[i+(k+1)%3]);n.adj.add(ids[i+(k+2)%3]);}
 let maxStep=0;
 for(let pass=0;pass<2;pass++){
  const next=nodes.map(n=>{if(!n.mobility||!n.adj.size)return n.p.y;let avg=0;for(const id of n.adj)avg+=nodes[id].p.y;avg/=n.adj.size;const dy=THREE.MathUtils.clamp((avg-n.p.y)*.22*n.mobility,-.45,.45);maxStep=Math.max(maxStep,Math.abs(dy));return n.p.y+dy;});
  nodes.forEach((n,i)=>n.p.y=next[i]);
 }
 for(let i=0;i<a.count;i++){if(!mobility[i])continue;v.copy(nodes[ids[i]].p).applyMatrix4(toMesh);a.setXYZ(i,v.x,v.y,v.z);}
 return {passes:2,maxStep,weldedVertices:nodes.length};
}

// Rebuild the skyline as a broad parent massif with tapering side ridges.
// Heights are authored in the existing castle chart; no city transforms change.
export const MASSIF_GRAPH = [
 {a:[-94,-37,25],b:[-73,-41,41],width:25},
 {a:[-73,-41,41],b:[-50,-36,24],width:26},
 {a:[-50,-36,24],b:[-29,-32,32],width:23},
 {a:[-29,-32,32],b:[-5,-34,13],width:23},
 {a:[-5,-34,13],b:[20,-33,15],width:22},
 {a:[20,-33,15],b:[39,-37,23],width:25},
 {a:[39,-37,23],b:[63,-42,12],width:24},
 {a:[-73,-41,37],b:[-88,-10,10],width:16},
 {a:[-49,-35,21],b:[-55,-4,7],width:16},
 {a:[-29,-32,27],b:[-20,-4,7],width:15},
 {a:[39,-37,20],b:[47,-8,5],width:17},
];
// Candidate r1 is deliberately local. Its first release remains opt-in until
// the same-camera main-scene checks pass; the original massif stays available.
export const EAST_SHOULDER_GRAPH = [
 ...MASSIF_GRAPH.slice(0,5),
 {a:[20,-33,15],b:[32,-38,21],width:24},
 {a:[32,-38,21],b:[45,-35,19],width:22},
 {a:[45,-35,19],b:[63,-42,12],width:22},
 ...MASSIF_GRAPH.slice(7,10),
 {a:[35,-36,19],b:[42,-24,13],width:13},
 {a:[42,-24,13],b:[48,-9,5],width:10},
];
function massifHeight(x,z,graph){
 let result=-5;
 for(const {a,b,width} of graph){
  const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/width;
  const crest=THREE.MathUtils.lerp(a[2],b[2],t*t*(3-2*t));
  // Flatter rock shoulders at the crest, then a continuous steeper flank.
  const profile=Math.exp(-1.45*Math.pow(d,2.8));
  result=Math.max(result,-5+(crest+5)*profile);
 }
 const drainage=Math.pow(Math.max(0,Math.sin(x*.18+z*.08+Math.sin(z*.07))),5)*.7;
 // Runtime-probed forward peaks are subordinate shoulders, not skyline spires.
 for(const [cx,cz,rx,rz,top] of [[-27,-25,17,14,18],[-3,-19,19,15,9],[44,-13,20,17,8]]){
  const d=Math.hypot((x-cx)/rx,(z-cz)/rz),w=1-smooth(d,.18,1);
  result=THREE.MathUtils.lerp(result,Math.min(result,top+2*d*d),w);
 }
 return result-drainage;
}
// Target-led broad benches. Peaks and saddles are authored first; this is
// explicit terrain shaping, not a claim that WFC invents the silhouette.
export const TARGET_MASSIF_GRAPH=[
 {a:[-99,-30,26],b:[-73,-39,37],width:29},
 {a:[-73,-39,37],b:[-49,-32,25],width:28},
 {a:[-49,-32,25],b:[-29,-31,30],width:25},
 {a:[-29,-31,30],b:[-3,-32,14],width:23},
 {a:[-3,-32,14],b:[29,-32,23],width:23},
 {a:[29,-32,23],b:[57,-36,27],width:25},
 {a:[-94,-28,25],b:[-109,6,20],width:25},
 {a:[-52,-28,23],b:[-58,-3,10],width:19},
 {a:[30,-31,21],b:[45,-8,11],width:18},
];
function targetTerraceHeight(x,z){
 let height=-5;
 const knots=[[0,1],[.30,.985],[.47,.70],[.70,.66],[.84,.32],[1.05,.27],[1.30,0]];
 for(const {a,b,width}of TARGET_MASSIF_GRAPH){
  const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/width;
  let f=0;for(let i=1;i<knots.length;i++)if(d<=knots[i][0]){const lo=knots[i-1],hi=knots[i];f=THREE.MathUtils.lerp(lo[1],hi[1],smooth(d,lo[0],hi[0]));break;}
  const crest=THREE.MathUtils.lerp(a[2],b[2],smooth(t,0,1));height=Math.max(height,-5+(crest+5)*f);
 }
 return height+.12*Math.sin(x*.15+z*.1);
}
export function ridgeHeight(x,z,pass=0){
 if(pass===7)return targetTerraceHeight(x,z);
 const base=massifHeight(x,z,MASSIF_GRAPH);
 if(pass===3){
  let height=ridgeHeight(x,z,2);
  // Two small authored rock benches, not floating turf shelves. The left
  // position was probed in the actual bridge-side slope; both are deformed
  // through the same protected-vertex and swept-clearance path below.
  for(const [cx,cz,rx,rz,top]of[[-18,-14,9,7,10.5],[45,-22,8,8,12]]){
   const distance=Math.hypot((x-cx)/rx,(z-cz)/rz),blend=1-smooth(distance,.55,1);
   const drain=top+.04*(z-cz);
   height+=THREE.MathUtils.clamp(drain-height,-5,5)*blend;
  }
  return height;
 }
 if(pass!==1&&pass!==2)return base;
 const weight=smooth(x,16,25)*(1-smooth(x,58,68))*smooth(z,-55,-45)*(1-smooth(z,-12,-4));
 if(!weight)return base;
 const candidate=massifHeight(x,z,EAST_SHOULDER_GRAPH);
 const shoulder=base+THREE.MathUtils.clamp(candidate-base,-4,4)*weight;
 if(pass!==2)return shoulder;
 // A subordinate forward shoulder, attached below the probed summit. It
 // widens the middle slope instead of filling the inter-city V-shaped saddle.
 // This is an authored height-field candidate, not a WFC or erosion solver.
 const ax=40,az=-31,bx=49,bz=-14,dx=bx-ax,dz=bz-az;
 const along=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
 const distance=Math.hypot(x-ax-dx*along,z-az-dz*along);
 const width=THREE.MathUtils.lerp(10,7,along),crest=THREE.MathUtils.lerp(18,9,along);
 const target=-5+(crest+5)*Math.exp(-1.45*Math.pow(distance/width,2.8));
 const mask=smooth(x,29,36)*(1-smooth(x,55,63))*smooth(z,-37,-30)*(1-smooth(z,-12,-5));
 return shoulder+Math.min(3.5,Math.max(0,target-shoulder))*mask;
}
const originalLandforms=new WeakMap(),landformTraces=new WeakMap();
export const getMountainLandformTrace=mesh=>landformTraces.get(mesh)||null;
export function shapeMountainLandform(castle,{rail=[],protectedBoxes=[]}={}){
 if(resolveMountainParams(globalThis.location?.search||'').params.get('citadelLandform')==='0')return legacyShapeMountainLandform(castle,{rail,protectedBoxes});
 const requested=Number(resolveMountainParams(globalThis.location?.search||'').params.get('citadelRidgePass'));
 const pass=requested===1||requested===2||requested===3||requested===4||requested===5||requested===6||requested===7?requested:0;
 const mesh=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!mesh)return null;
 castle.updateWorldMatrix(true,true);
 if(!originalLandforms.has(mesh))originalLandforms.set(mesh,mesh.geometry);
 const source=originalLandforms.get(mesh),geometry=subdivide(source),a=geometry.attributes.position;
 const toCastle=castle.matrixWorld.clone().invert().multiply(mesh.matrixWorld),toMesh=toCastle.clone().invert();
 const world=new THREE.Vector3(),local=new THREE.Vector3(),lookup=new Map(),nodes=[],ids=[];
 let changed=0,protectedVertices=0,maxMove=0,blockedBox=0,blockedRail=0,partial=0;
 const clearance=(x,y,z)=>{
  world.set(x,y,z).applyMatrix4(castle.matrixWorld);let box=Infinity,r2=Infinity;
  for(const b of protectedBoxes)box=Math.min(box,b.distanceToPoint(world));
  for(const r of rail)r2=Math.min(r2,r.distanceToSquared(world));
  return {gap:Math.min(box-3,Math.sqrt(r2)-20),box:box<=3,rail:r2<=400};
 };
 const worldScale=new THREE.Vector3(0,1,0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(castle.matrixWorld)).length();
 // Distance functions are 1-Lipschitz in world space: these steps cannot jump
 // over a protected solid even when both desired endpoints lie outside it.
 const safeY=(n,from,to)=>{
  let y=from;
  for(let pass=0;pass<32;pass++){
   const remaining=to-y;if(Math.abs(remaining)<1e-5)return to;
   const gap=clearance(n.p.x,y,n.p.z).gap;
   if(gap<=.025)return y;
   const step=Math.min(Math.abs(remaining),gap*.8/worldScale);
   y+=Math.sign(remaining)*step;
  }
  return y;
 };
 for(let i=0;i<a.count;i++){
  local.fromBufferAttribute(a,i).applyMatrix4(toCastle);
  const key=local.toArray().map(v=>Math.round(v*1e4)).join(',');let id=lookup.get(key);
  if(id===undefined){id=nodes.length;lookup.set(key,id);nodes.push({p:local.clone(),original:local.y,y:local.y,fixed:false,adj:new Set()});}
  const n=nodes[id];if(geometry.attributes.shoreBoundaryBottom?.getX(i)>0)n.fixed=true;ids.push(id);
 }
 for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){nodes[ids[i+j]].adj.add(ids[i+(j+1)%3]);nodes[ids[i+j]].adj.add(ids[i+(j+2)%3]);}
 for(const n of nodes){
  if(n.fixed)continue;
  const p=n.p,weight=smooth(p.y,-32,-10)*smooth(p.z,-67,-46)*(1-smooth(p.z,-3,11))*smooth(p.x,-112,-96)*(1-smooth(p.x,62,80));
  n.mobility=weight;if(!weight){n.fixed=true;continue;}
  const c=clearance(p.x,p.y,p.z);
  if(c.gap<=0){n.fixed=true;protectedVertices++;if(c.box)blockedBox++;if(c.rail)blockedRail++;continue;}
  const target=THREE.MathUtils.lerp(p.y,ridgeHeight(p.x,p.z,pass===7?7:pass>=4?3:pass),weight*smooth(c.gap,0,6));
  n.y=safeY(n,p.y,target);if(Math.abs(n.y-target)>.03)partial++;
 }
 let smoothMaxStep=0;
 for(let pass=0;pass<3;pass++){
  const next=nodes.map(n=>{
   if(n.fixed||!n.adj.size)return n.y;
   let sum=0,weights=0;
   for(const j of n.adj){const b=nodes[j],d=Math.hypot(n.p.x-b.p.x,n.p.z-b.p.z);if(d<1e-5)continue;const w=1/d;sum+=b.y*w;weights+=w;}
   if(!weights)return n.y;
   const delta=THREE.MathUtils.clamp((sum/weights-n.y)*.35*n.mobility,-1.2,1.2),result=safeY(n,n.y,n.y+delta);
   smoothMaxStep=Math.max(smoothMaxStep,Math.abs(result-n.y));return result;
  });nodes.forEach((n,i)=>n.y=next[i]);
 }
 let targetMacro=null;
 if(pass===7){const baseline=nodes.map(n=>n.original),delta=nodes.map(n=>n.fixed?0:n.y-n.original);targetMacro=guardLocalDeformation(nodes,ids,baseline,delta,{method:'target-authored connected broad benches and saddles with protected swept deformation',graph:TARGET_MASSIF_GRAPH});}
 const lowerShoulder=pass===4?applyLowerShoulder(nodes,ids,safeY):null;
 const summitCut=pass===5?applySummitCut(nodes,ids,safeY):pass===6?applyVisibleSummitCut(nodes,ids,safeY):null;
 for(let i=0;i<a.count;i++){
  const n=nodes[ids[i]],delta=Math.abs(n.y-n.original);if(delta>1e-5)changed++;maxMove=Math.max(maxMove,delta);
  if(n.fixed)continue;local.copy(n.p);local.y=n.y;local.applyMatrix4(toMesh);a.setXYZ(i,local.x,local.y,local.z);
 }

 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 if(new URLSearchParams(globalThis.location?.search||'').get('citadelRockTrace')==='1')landformTraces.set(mesh,{source,shaped:geometry,toCastle:toCastle.clone(),pass,mapping:'uniform four child triangles per source face in emitted order'});else landformTraces.delete(mesh);
 return {targetMacro,version:pass===7?10:pass===6?9:pass===5?8:pass===4?7:pass===3?6:pass===2?5:pass?4:3,candidatePass:pass,method:pass?'local eccentric eastern crest and descending spur; bounded target delta, protected deformation':'broad massif with runtime-probed subordinate shoulders and safe partial deformation',ridgeGraph:pass?EAST_SHOULDER_GRAPH:MASSIF_GRAPH,lowerShoulder,summitCut,benches:pass>=3?[{center:[-18,-14],radii:[9,7],height:10.5},{center:[45,-22],radii:[8,8],height:12}]:null,forwardShoulder:pass>=2?{a:[40,-31,18],b:[49,-14,9],width:[10,7],maxTargetLift:3.5}:null,changed,protectedVertices,blockedBox,blockedRail,partial,maxMove,railMargin:20,buildingMargin:3,sourceVertices:source.attributes.position.count,vertices:a.count,smoothing:{passes:3,maxStep:smoothMaxStep,weldedVertices:nodes.length,protected:true}};
}


// Candidate 4 is a post-pass-3 local shoulder, NOT another global heightfield
// solve. Preserve lower sheets and bound each move against all incident faces.
export function applyLowerShoulder(nodes,ids,safeY=(n,from,to)=>to){
 const clamp=THREE.MathUtils.clamp,baseline=nodes.map(n=>n.y),top=new Map();
 const key=n=>`${Math.round(n.p.x*1e4)},${Math.round(n.p.z*1e4)}`;
 nodes.forEach(n=>top.set(key(n),Math.max(top.get(key(n))??-Infinity,n.y)));
 const delta=nodes.map((n,i)=>{
  if(n.fixed||n.y<top.get(key(n))-.05)return 0;
  const w=smooth(n.p.x,-12,-11)*(1-smooth(n.p.x,-7,-6))*smooth(n.p.z,-16,-15)*(1-smooth(n.p.z,-13,-12));
  if(!w)return 0;
  // Small drainage fall prevents an absolutely horizontal artificial slab.
  const target=7.2+.035*(n.p.z+14);
  return safeY(n,n.y,n.y+clamp(target-n.y,-2.6,2.6)*w)-baseline[i];
 });
 return guardLocalDeformation(nodes,ids,baseline,delta,{method:'bounded post-pass3 upper-sheet shoulder with incident-face orientation guard',core:[-11,-7,-15,-13],outer:[-12,-6,-16,-12],height:7.2,maxAllowedDelta:2.6,westExpansion:false});
}

export function applySummitCut(nodes,ids,safeY=(n,from,to)=>to){
 const baseline=nodes.map(n=>n.y);
 const delta=nodes.map(n=>{
  if(n.fixed)return 0;
  const w=smooth(n.p.x,-70,-69)*(1-smooth(n.p.x,-67,-65))*smooth(n.p.z,-44,-42)*(1-smooth(n.p.z,-37,-35))*smooth(n.y,35,38);
  const amount=THREE.MathUtils.lerp(1.5,2.5,smooth(n.p.x,-69,-67));
  return w?safeY(n,n.y,n.y-Math.min(3,amount)*w)-n.y:0;
 });
 return guardLocalDeformation(nodes,ids,baseline,delta,{method:'post-pass3 asymmetric east summit subtraction, retains natural crest relief',core:[-69,-67,-42,-37],outer:[-70,-65,-44,-35],minOriginalHeight:35,maxAllowedDelta:3});
}

// Actual r11 old-mountain geometric skyline points, independently checked
// against original Raycaster. This changes the observed rear rim, not just
// the interior cap attempted by pass5. Always starts from full pass3.
export function applyVisibleSummitCut(nodes,ids,safeY=(n,from,to)=>to){
 const baseline=nodes.map(n=>n.y);
 const delta=nodes.map(n=>{
  if(n.fixed)return 0;
  const w=smooth(n.p.x,-73,-68.5)*(1-smooth(n.p.x,-64,-61))*smooth(n.p.z,-48,-45)*(1-smooth(n.p.z,-36,-33))*smooth(n.y,32,37);
  return w?safeY(n,n.y,n.y-3.2*w)-n.y:0;
 });
 return guardLocalDeformation(nodes,ids,baseline,delta,{method:'actual-silhouette-guided post-pass3 eastward descending crest subtraction',outer:[-73,-61,-48,-33],maxAllowedDelta:3.5,requestedMaximum:3.2,minOriginalHeight:32,preservedWestX:-73,basisPass:3,evidence:'r11-old-mountain-day-noCloud-plants.json silhouetteProfile; CPU geometric skyline, original ray error0',actualSilhouette:[[-74.94,40.24,-39.13],[-73.60,40.56,-39.81],[-72.19,40.79,-40.89],[-70.77,40.76,-42.15],[-69.30,40.25,-43.82],[-66.75,39.08,-43.87]]});
}

function guardLocalDeformation(nodes,ids,baseline,delta,audit){
 const faces=[],u=new THREE.Vector3(),v=new THREE.Vector3();
 const normal=(face,ds)=>{
  const [a,b,c]=face.map(id=>nodes[id]);
  u.set(b.p.x-a.p.x,baseline[face[1]]+ds[face[1]]-baseline[face[0]]-ds[face[0]],b.p.z-a.p.z);
  v.set(c.p.x-a.p.x,baseline[face[2]]+ds[face[2]]-baseline[face[0]]-ds[face[0]],c.p.z-a.p.z);
  return u.clone().cross(v);
 };
 const zeros=new Float64Array(nodes.length);
 for(let i=0;i<ids.length;i+=3){const face=ids.slice(i,i+3);if(!face.some(id=>delta[id]))continue;
  const before=normal(face,zeros);faces.push({face,before,area:before.length()});}
 const bad=({face,before,area})=>{
  const after=normal(face,delta),length=after.length();
  // Never worsen a pre-existing nearly degenerate face. Retain at least 35%
  // area and positive orientation with a substantial angular safety margin.
  return area<1e-9?face.some(id=>delta[id]):length<area*.35||after.dot(before)<length*area*.25;
 };
 let guardReductions=0,guardPasses=0;
 for(;guardPasses<18;guardPasses++){
  const blocked=new Set();for(const f of faces)if(bad(f))for(const id of f.face)if(delta[id])blocked.add(id);
  if(!blocked.size)break;
  for(const id of blocked){delta[id]*=.5;guardReductions++;}
 }
 // Local hard rollback closure handles exceptionally thin existing sheets;
 // changing one face's vertex can otherwise invalidate its neighboring face.
 let rolledBack=0;
 for(let pass=0;pass<nodes.length;pass++){
  const blocked=new Set();for(const f of faces)if(bad(f))for(const id of f.face)if(delta[id])blocked.add(id);
  if(!blocked.size)break;
  for(const id of blocked){delta[id]=0;rolledBack++;}
 }
 let changed=0,maxDelta=0;
 nodes.forEach((n,i)=>{n.y=baseline[i]+delta[i];if(Math.abs(delta[i])>1e-5)changed++;maxDelta=Math.max(maxDelta,Math.abs(delta[i]));});
 return {...audit,changed,maxDelta,guardReductions,guardPasses,rolledBack,checkedFaces:faces.length,invalidFaces:faces.filter(bad).length};
}
