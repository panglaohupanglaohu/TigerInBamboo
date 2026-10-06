import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ridgeHeight,shapeMountainLandform} from '../../src/world/citadel/mountainLandform.js';

test('eastern candidate preserves main summit and saddle, with bounded continuous target changes',()=>{
 let changed=0,maxDelta=0,maxNeighborDelta=0;
 for(let z=-75;z<=20;z+=.5)for(let x=-120;x<=90;x+=.5){
  const a=ridgeHeight(x,z),b=ridgeHeight(x,z,1),d=b-a;
  assert.ok(Number.isFinite(b));maxDelta=Math.max(maxDelta,Math.abs(d));if(Math.abs(d)>1e-6)changed++;
  if(x<=16||x>=68||z<=-55||z>=-4)assert.equal(b,a);
  const dx=ridgeHeight(x+.01,z,1)-ridgeHeight(x+.01,z);
  const dz=ridgeHeight(x,z+.01,1)-ridgeHeight(x,z+.01);
  maxNeighborDelta=Math.max(maxNeighborDelta,Math.abs(dx-d),Math.abs(dz-d));
 }
 assert.ok(changed>100);assert.ok(maxDelta<=4);assert.ok(maxNeighborDelta<.035);
 assert.equal(ridgeHeight(-73,-41,1),ridgeHeight(-73,-41));
 assert.equal(ridgeHeight(-5,-34,1),ridgeHeight(-5,-34));
 assert.ok(ridgeHeight(39,-37,1)<ridgeHeight(39,-37)-1);
});

for(const pass of [1,2,3,4,5,6])test(`candidate ${pass} geometry retains protected rail, structure and fixed shore vertices on a rotated chart`,()=>{
 const previous=globalThis.location;globalThis.location={search:'?citadelRidgePass='+pass};
 try{
  const castle=new THREE.Group();castle.rotation.set(.35,.4,-.2);
  const g=new THREE.PlaneGeometry(70,60,14,12);g.rotateX(-Math.PI/2);g.translate(35,20,-25);
  const mesh=new THREE.Mesh(g);mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);castle.updateMatrixWorld(true);
  const a=g.attributes.position,source=Float32Array.from(a.array),fixed=new Float32Array(a.count);
  for(let i=0;i<a.count;i++)if(a.getZ(i)>-5)fixed[i]=1;
  g.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute(fixed,1));
  const rail=[castle.localToWorld(new THREE.Vector3(55,20,-20))];
  const box=new THREE.Box3().setFromCenterAndSize(castle.localToWorld(new THREE.Vector3(28,20,-37)),new THREE.Vector3(4,4,4));
  const report=shapeMountainLandform(castle,{rail,protectedBoxes:[box]});
  assert.equal(report.candidatePass,pass);assert.ok(report.changed>0);assert.ok(report.protectedVertices>0);
  assert.deepEqual(g.attributes.position.array,source);
  const p=mesh.geometry.attributes.position,vertices=new Set();
  const key=v=>v.toArray().map(n=>n.toFixed(4)).join(',');
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);assert.ok(v.toArray().every(Number.isFinite));vertices.add(key(v));}
  for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i),w=castle.localToWorld(v.clone());if(fixed[i]||box.distanceToPoint(w)<=3||w.distanceTo(rail[0])<20)assert.ok(vertices.has(key(v)),`protected source ${i}`);}
  const result=Float32Array.from(p.array);shapeMountainLandform(castle,{rail,protectedBoxes:[box]});assert.deepEqual(mesh.geometry.attributes.position.array,result);
 }finally{globalThis.location=previous;}
});


test('forward shoulder is local, bounded, lower than the summit and continuous',()=>{
 let raised=0;
 for(let z=-60;z<=10;z+=.25)for(let x=-110;x<=80;x+=.25){
  const before=ridgeHeight(x,z,1),after=ridgeHeight(x,z,2),delta=after-before;
  assert.ok(delta>=-1e-10&&delta<=3.5+1e-10);
  if(x<=29||x>=63||z<=-37||z>=-5)assert.equal(after,before);
  if(delta>.1)raised++;
  const next=ridgeHeight(x+.01,z,2)-ridgeHeight(x+.01,z,1);
  assert.ok(Math.abs(next-delta)<.04);
 }
 assert.ok(raised>100);
 for(const x of [42,44,46])assert.ok(ridgeHeight(x,-22,2)>ridgeHeight(x,-22,1)+1);
 assert.ok(ridgeHeight(44,-22,2)<ridgeHeight(40,-34,2)-3);
 assert.equal(ridgeHeight(-5,-34,2),ridgeHeight(-5,-34));
});


test('authored meadow benches flatten real target height locally without filling the main saddle',()=>{
 for(const [cx,cz,rx,rz] of [[-18,-14,9,7],[45,-22,8,8]]){
  for(let dz=-rz;dz<=rz;dz+=.5)for(let dx=-rx;dx<=rx;dx+=.5){
   const x=cx+dx,z=cz+dz,d=ridgeHeight(x,z,3)-ridgeHeight(x,z,2);
   assert.ok(Math.abs(d)<=5+1e-10);
   if(Math.hypot(dx/rx,dz/rz)>=1)assert.equal(d,0);
  }
 }
 assert.ok(Math.abs(ridgeHeight(45,-22,3)-12)<1e-9);
 assert.ok(Math.abs(ridgeHeight(-18,-14,3)-10.5)<1e-9);
 for(const [x,z] of [[-73,-41],[-5,-34],[0,-20],[65,-15]])assert.equal(ridgeHeight(x,z,3),ridgeHeight(x,z,2));
});

// Pass 4 uses final pass-3 nodes rather than moving every same-XZ layer to a
// common target. The guard is also tested against a thin vertical wall.
test('lower shoulder preserves lower sheets, fixed nodes and incident face orientation',async()=>{
 const {applyLowerShoulder}=await import('../../src/world/citadel/mountainLandform.js');
 const nodes=[[-10,9,-15],[-8,9,-15],[-10,9,-13],[-8,9,-13],[-10,8.8,-15],[-8,8.8,-15],[-30,9,-14]].map(([x,y,z])=>({p:new THREE.Vector3(x,y,z),y,fixed:false}));
 nodes[3].fixed=true;
 const ids=[0,1,2,1,3,2,0,4,1,1,4,5],before=nodes.map(n=>n.y);
 const normal=(i,ys)=>{const [a,b,c]=ids.slice(i,i+3).map(id=>new THREE.Vector3(nodes[id].p.x,ys[id],nodes[id].p.z));return b.sub(a).cross(c.sub(a));};
 const report=applyLowerShoulder(nodes,ids);
 assert.ok(report.changed>0);assert.ok(report.guardReductions>0);assert.equal(report.invalidFaces,0);
 assert.equal(nodes[3].y,before[3]);assert.equal(nodes[4].y,before[4]);assert.equal(nodes[5].y,before[5]);assert.equal(nodes[6].y,before[6]);
 for(let i=0;i<ids.length;i+=3){const a=normal(i,before),b=normal(i,nodes.map(n=>n.y));assert.ok(b.length()>=a.length()*.35-1e-10);assert.ok(a.dot(b)>=a.length()*b.length()*.25-1e-10);}
 assert.ok(report.maxDelta<=2.6);
});

test('pass4 final geometry differs from pass3 only inside the bounded lower shoulder',()=>{
 const previous=globalThis.location;
 try{
  const castle=new THREE.Group();castle.rotation.set(.2,.4,-.1);
  const source=new THREE.PlaneGeometry(28,20,28,20);source.rotateX(-Math.PI/2);source.translate(-12,12,-14);
  const fixed=new Float32Array(source.attributes.position.count);
  for(let i=0;i<fixed.length;i++)if(Math.abs(source.attributes.position.getX(i)+9)<.01)fixed[i]=1;
  source.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute(fixed,1));
  const mesh=new THREE.Mesh(source);mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);
  globalThis.location={search:'?citadelRidgePass=3'};shapeMountainLandform(castle);
  const before=mesh.geometry.attributes.position.array.slice();
  globalThis.location={search:'?citadelRidgePass=4'};const report=shapeMountainLandform(castle);
  const after=mesh.geometry.attributes.position.array;let changes=0;
  for(let i=0;i<before.length;i+=3){
   const [x,y,z]=before.slice(i,i+3);assert.equal(after[i],x);assert.equal(after[i+2],z);
   const d=after[i+1]-y;assert.ok(Math.abs(d)<=2.60001);
   if(Math.abs(d)>1e-5){changes++;assert.ok(x>-12&&x<-6&&z>-16&&z<-12);}
   if(Math.abs(x+9)<.01)assert.equal(d,0);
  }
  assert.ok(changes>0);assert.equal(report.lowerShoulder.invalidFaces,0);
  const v=(array,i)=>new THREE.Vector3().fromArray(array,i);
  for(let i=0;i<before.length;i+=9){const a=v(before,i),old=v(before,i+3).sub(a).cross(v(before,i+6).sub(a));const b=v(after,i),now=v(after,i+3).sub(b).cross(v(after,i+6).sub(b));if(old.length()>1e-8){assert.ok(now.length()>=old.length()*.3499);assert.ok(now.dot(old)>=now.length()*old.length()*.2499);}}
  const result=after.slice();shapeMountainLandform(castle);assert.deepEqual(mesh.geometry.attributes.position.array,result);
 }finally{globalThis.location=previous;}
});


test('lower shoulder honors swept safeY restriction before topology checks',async()=>{
 const {applyLowerShoulder}=await import('../../src/world/citadel/mountainLandform.js');
 const nodes=[[-10,9,-15],[-8,9,-15],[-10,9,-13]].map(([x,y,z])=>({p:new THREE.Vector3(x,y,z),y,fixed:false}));
 let calls=0;const report=applyLowerShoulder(nodes,[0,1,2],(n,from,to)=>{calls++;return Math.max(to,8.75);});
 assert.equal(calls,3);assert.ok(report.changed>0);for(const n of nodes)assert.ok(n.y>=8.75);assert.ok(report.maxDelta<=.25);
});

test('summit candidate is a bounded subtraction from complete pass3 and retains west crest',()=>{
 const previous=globalThis.location;
 try{
  const castle=new THREE.Group();castle.rotation.set(.2,-.3,.1);
  const g=new THREE.PlaneGeometry(30,26,30,26);g.rotateX(-Math.PI/2);g.translate(-70,40,-40);
  const fixed=new Float32Array(g.attributes.position.count);
  for(let i=0;i<fixed.length;i++)if(Math.abs(g.attributes.position.getX(i)+68)<.01)fixed[i]=1;
  g.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute(fixed,1));
  const mesh=new THREE.Mesh(g);mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);
  globalThis.location={search:'?citadelRidgePass=3'};shapeMountainLandform(castle);const before=mesh.geometry.attributes.position.array.slice();
  globalThis.location={search:'?citadelRidgePass=5'};const report=shapeMountainLandform(castle);const after=mesh.geometry.attributes.position.array;let changed=0;
  for(let i=0;i<before.length;i+=3){const [x,y,z]=before.slice(i,i+3),d=after[i+1]-y;assert.equal(after[i],x);assert.equal(after[i+2],z);assert.ok(d<=0&&d>=-3.00001);
   if(x<=-70||x>=-65||z<=-44||z>=-35||y<=35||Math.abs(x+68)<.01)assert.equal(d,0);
   if(d<-1e-5)changed++;
  }
  assert.ok(changed>0);assert.equal(report.lowerShoulder,null);assert.equal(report.summitCut.invalidFaces,0);
  const v=(a,i)=>new THREE.Vector3().fromArray(a,i);
  for(let i=0;i<before.length;i+=9){const p=v(before,i),a=v(before,i+3).sub(p).cross(v(before,i+6).sub(p));const q=v(after,i),b=v(after,i+3).sub(q).cross(v(after,i+6).sub(q));if(a.length()>1e-8){assert.ok(b.length()>=a.length()*.3499);assert.ok(a.dot(b)>=a.length()*b.length()*.2499);}}
  const result=after.slice();shapeMountainLandform(castle);assert.deepEqual(mesh.geometry.attributes.position.array,result);
 }finally{globalThis.location=previous;}
});

test('summit subtraction respects safeY and original high-cap cutoff',async()=>{
 const {applySummitCut}=await import('../../src/world/citadel/mountainLandform.js');
 const nodes=[[-69,40,-41],[-67,40,-41],[-69,40,-38],[-68,34,-40],[-74,41,-40]].map(([x,y,z])=>({p:new THREE.Vector3(x,y,z),y,fixed:false}));
 const audit=applySummitCut(nodes,[0,1,2],(n,from,to)=>Math.max(to,from-.2));
 assert.ok(audit.changed>0);assert.ok(audit.maxDelta<=.2000001);assert.equal(nodes[3].y,34);assert.equal(nodes[4].y,41);
});

test('actual-silhouette candidate leaves west crest, cuts observed rear rim and stays bounded',async()=>{
 const {applyVisibleSummitCut}=await import('../../src/world/citadel/mountainLandform.js');
 const points=[[-74.94,40.24,-39.13],[-73.6,40.56,-39.81],[-72.19,40.79,-40.89],[-70.77,40.76,-42.15],[-69.3,40.25,-43.82],[-66.75,39.08,-43.87],[-59,30,-41],[-68,31,-40]];
 const nodes=points.map(([x,y,z])=>({p:new THREE.Vector3(x,y,z),y,fixed:false}));
 // Pure sampled profile checks. Actual triangle orientation tested below.
 const audit=applyVisibleSummitCut(nodes,[]);
 assert.equal(nodes[0].y,points[0][1]);assert.equal(nodes[1].y,points[1][1]);assert.equal(nodes[6].y,30);assert.equal(nodes[7].y,31);
 for(let i=2;i<=5;i++){assert.ok(nodes[i].y<points[i][1]);assert.ok(nodes[i].y<nodes[i-1].y);assert.ok(points[i][1]-nodes[i].y<=3.2+1e-10);}
 assert.ok(points[4][1]-nodes[4].y>2);assert.equal(audit.basisPass,3);
});

test('pass6 full final geometry has local downward-only change and preserved face orientation',()=>{
 const previous=globalThis.location;
 try{
  const castle=new THREE.Group(),g=new THREE.PlaneGeometry(30,26,30,26);g.rotateX(-Math.PI/2);g.translate(-70,40,-40);
  const mesh=new THREE.Mesh(g);mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);
  globalThis.location={search:'?citadelRidgePass=3'};shapeMountainLandform(castle);const before=mesh.geometry.attributes.position.array.slice();
  globalThis.location={search:'?citadelRidgePass=6'};const report=shapeMountainLandform(castle);const after=mesh.geometry.attributes.position.array;let changed=0;
  for(let i=0;i<before.length;i+=3){const [x,y,z]=before.slice(i,i+3),d=after[i+1]-y;assert.equal(after[i],x);assert.equal(after[i+2],z);assert.ok(d<=0&&d>=-3.20001);if(x<=-73||x>=-61||z<=-48||z>=-33||y<=32)assert.equal(d,0);if(d<-1e-5)changed++;}
  assert.ok(changed>0);assert.equal(report.lowerShoulder,null);assert.equal(report.summitCut.invalidFaces,0);
  const v=(a,i)=>new THREE.Vector3().fromArray(a,i);
  for(let i=0;i<before.length;i+=9){const p=v(before,i),a=v(before,i+3).sub(p).cross(v(before,i+6).sub(p));const q=v(after,i),b=v(after,i+3).sub(q).cross(v(after,i+6).sub(q));if(a.length()>1e-8){assert.ok(b.length()>=a.length()*.3499);assert.ok(a.dot(b)>=a.length()*b.length()*.2499);}}
  const result=after.slice();shapeMountainLandform(castle);assert.deepEqual(mesh.geometry.attributes.position.array,result);
 }finally{globalThis.location=previous;}
});
