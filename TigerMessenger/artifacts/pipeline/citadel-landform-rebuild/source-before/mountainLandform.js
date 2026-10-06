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
export function ridgeHeight(x,z){
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
export function shapeMountainLandform(castle,{rail=[],protectedBoxes=[]}={}){
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
  const desired=THREE.MathUtils.lerp(old,ridgeHeight(v.x,v.z),weight*.95);
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
