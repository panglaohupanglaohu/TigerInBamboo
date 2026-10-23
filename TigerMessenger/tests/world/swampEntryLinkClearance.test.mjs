import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await inner.userData.gregSpatialPlan.ready;placeMoebiusSwampOnSphere(root,new THREE.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);root.updateMatrixWorld(true);
const batch=inner.getObjectByName('greg-bank-walking-slab-batch'),segment=batch.userData.segments.find(p=>p.name==='greg-bank-entry-link');
const frameInverse=inner.matrixWorld.clone().invert(),toInner=frameInverse.clone().multiply(batch.matrixWorld),slab=[];
for(let i=segment.firstTriangle*3;i<(segment.firstTriangle+segment.triangleCount)*3;i++)slab.push(new THREE.Vector3().fromBufferAttribute(batch.geometry.attributes.position,i).applyMatrix4(toInner));
const u=new THREE.Vector3().crossVectors(slab[1].clone().sub(slab[0]),slab[2].clone().sub(slab[0])).setY(0).normalize(),v=new THREE.Vector3(-u.z,0,u.x),project=p=>new THREE.Vector3(p.dot(u),p.y,p.dot(v)),box=new THREE.Box3().setFromPoints(slab.map(project));
const slabInnerBounds=new THREE.Box3().setFromPoints(slab),nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});
const visible=m=>{for(let n=m;n&&n!==tiger;n=n.parent)if(!n.visible)return false;return true;};
const head=[];nodes.get('n8').traverse(m=>{if(m.isMesh&&!m.userData.isOutline&&visible(m))head.push(m);});
const groups={head,torso:[nodes.get('n2')],neck:[nodes.get('n6')]};
function clip(poly,axis,value,greater){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*(greater?1:-1),db=(b[axis]-value)*(greater?1:-1);if(da>=-1e-8)out.push(a);if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);out.push(a.clone().lerp(b,t));}}return out;}
function inspect(meshes){let lo=Infinity,hi=-Infinity,overlapTriangles=0,clippedTriangles=0,lowest=null,highest=null;const bounds=new THREE.Box3(),meshHits={};
 for(const mesh of meshes){if(!visible(mesh))continue;const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,transform=frameInverse.clone().multiply(mesh.matrixWorld),points=[];for(let i=0;i<p.count;i++){const pt=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(transform);bounds.expandByPoint(pt);points.push(project(pt));}
  const localBox=new THREE.Box3().setFromPoints(points);if(localBox.max.x<box.min.x||localBox.min.x>box.max.x||localBox.max.z<box.min.z||localBox.min.z>box.max.z)continue;
  for(let i=0,n=idx?idx.count:p.count;i<n;i+=3){let poly=[0,1,2].map(j=>points[idx?idx.getX(i+j):i+j]);for(const[axis,value,greater]of [['x',box.min.x,true],['x',box.max.x,false],['z',box.min.z,true],['z',box.max.z,false]]){poly=clip(poly,axis,value,greater);if(poly.length<3)break;}if(poly.length<3)continue;clippedTriangles++;
   let a=Infinity,b=-Infinity;for(const point of poly){if(point.y<lo){lo=point.y;lowest=point;}if(point.y>hi){hi=point.y;highest=point;}a=Math.min(a,point.y);b=Math.max(b,point.y);}if(a<box.max.y-1e-6&&b>box.min.y+1e-6){overlapTriangles++;const name=mesh.name||mesh.userData.blenderSourceNode;meshHits[name]=(meshHits[name]||0)+1;}
  }
 }
 const signedClearance=lo===Infinity?null:lo>=box.max.y?lo-box.max.y:hi<=box.min.y?box.min.y-hi:-Math.min(hi-box.min.y,box.max.y-lo);
 const unproject=q=>q?u.clone().multiplyScalar(q.x).addScaledVector(v,q.z).setY(q.y).toArray():null;
 return {bbox:{min:bounds.min.toArray(),max:bounds.max.toArray()},overlapTriangles,meshHits,clippedTriangles,footprintY:lo===Infinity?null:[lo,hi],signedVerticalClearanceInner:signedClearance,signedVerticalClearanceWorld:signedClearance===null?null:signedClearance*.5,lowest:unproject(lowest),highest:unproject(highest)};
}

test('entry link attaches to actual graded tread and supports the player route after spherical placement',()=>{
 const plan=inner.userData.gregSpatialPlan,link=plan.entryLink;
 assert.equal(link.graded,true);assert.equal(link.stepIndex,1);assert.ok(Math.abs(link.point[1]-35.402)<.002);
 assert.equal(link.width,2);assert.deepEqual(plan.levels.map(l=>l.innerY),[34.8,30.8,26.8]);
 assert.equal(plan.slabParts,76);assert.equal(inner.userData.tigerWalkSurfaces.length,8);
 const point=new THREE.Vector3(...link.point),step=inner.userData.tigerWalkSurfaces[link.stepIndex],ray=new THREE.Raycaster();
 ray.set(inner.localToWorld(point.clone().setY(55)),new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld));
 const treadHit=ray.intersectObject(step,false)[0];assert.ok(treadHit);assert.ok(Math.abs(inner.worldToLocal(treadHit.point).y-point.y)<.002);
 // Original narrow tread centreline to side exit, then every bank level. Sweep a player-
 // sized footprint; the authored bridge itself is four inner / two world wide.
 const axis=new THREE.Vector3(Math.cos(.5),0,Math.sin(.5)),centre=axis.clone().multiplyScalar(point.dot(axis)).setY(point.y);
 const entry=[];for(let i=0;i<=20;i++)entry.push(centre.clone().lerp(point,i/20));
 const route=[...entry,...plan.route.map(p=>new THREE.Vector3(...p))],supports=[...inner.userData.tigerWalkSurfaces,...plan.walkMeshes];let samples=0;
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],forward=b.clone().sub(a).setY(0),side=new THREE.Vector3(-forward.z,0,forward.x).normalize(),n=Math.max(1,Math.ceil(a.distanceTo(b)/.2));
  for(let j=0;j<=n;j++)for(const offset of(i<=20?[0]:[-.45,0,.45])){
   const local=a.clone().lerp(b,j/n).addScaledVector(side,offset),world=inner.localToWorld(local),up=world.clone().normalize();
   ray.set(world.clone().addScaledVector(up,.2),up.clone().negate());ray.far=.4;
   const hit=ray.intersectObjects(supports,false).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)>.8);
   assert.ok(hit,`missing player support route ${i}/${j}/${offset}`);
   const ground=inner.userData.sampleGroundRadius(world.clone().addScaledVector(up,.1));assert.ok(ground!==null&&Math.abs(ground-world.length())<.14,`wrong sampled level ${i}/${j}/${offset}: ${ground-world.length()} link=${JSON.stringify(link)}`);samples++;
  }
 }
 assert.ok(samples>1200);
});

test('full placed root forceDrink cycle never intersects the entry-link volume with visible head neck or torso',()=>{
 const previous=Math.random;Math.random=()=>.5;tiger.userData.forceDrink=true;const modes=new Set();let samples=0,minGap=Infinity;
 try{for(let i=0;i<=600;i++){
  const t=i/30;root.userData.update(1/30,t,{});root.updateMatrixWorld(true);modes.add(tiger.userData._mode);
  for(const [part,meshes] of Object.entries(groups)){
   const result=inspect(meshes);assert.equal(result.overlapTriangles,0,`${part} intersects entry link at ${t} in ${tiger.userData._mode}`);
   if(result.signedVerticalClearanceWorld!==null)minGap=Math.min(minGap,result.signedVerticalClearanceWorld);samples++;
  }
 }}finally{Math.random=previous;}
 assert.ok(modes.has('descend')&&modes.has('drink')&&modes.has('ascend')&&modes.has('patrol'));
 assert.equal(samples,1803);assert.ok(minGap>0,'conservative sloping-slab enclosing prism remains clear');
});
