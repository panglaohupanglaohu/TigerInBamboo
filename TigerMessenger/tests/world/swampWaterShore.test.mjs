import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampWaterShore} from '../../src/world/swampWaterShore.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?swampWaterShore=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
location.search='';
const water=inner.getObjectByName('swamp-underground-waterline'),volume=inner.getObjectByName('swamp-water-volume'),wall=inner.getObjectByName('swamp-sinkhole-wall');
const oldWater=new T.Mesh(water.geometry,water.material);oldWater.position.copy(water.position);inner.add(oldWater);
const oldVolume=new T.Mesh(volume.geometry,volume.material);oldVolume.position.copy(volume.position);inner.add(oldVolume);
const originals={water:water.geometry,volume:volume.geometry,material:water.material,volumeMaterial:volume.material,floor:inner.getObjectByName('swamp-lake-floor').geometry,actors:[inner.userData.tiger,...inner.userData.whales,...Object.values(inner.userData.shipyard).filter(o=>o?.isObject3D)].map(o=>[o,o.position.clone(),o.parent])};
const report=installSwampWaterShore(inner);assert.equal(report.ok,true,report.reason);wrapper.updateMatrixWorld(true);
const ray=new T.Raycaster(),up=()=>new T.Vector3(0,1,0).transformDirection(inner.matrixWorld);
function radial(mesh,y,a){ray.set(inner.localToWorld(new T.Vector3(0,y,0)),new T.Vector3(Math.cos(a),0,Math.sin(a)).transformDirection(inner.matrixWorld));ray.far=100;const hits=[];T.Mesh.prototype.raycast.call(mesh,ray,hits);hits.sort((a,b)=>a.distance-b.distance);return hits[0]?.point.clone().applyMatrix4(inner.matrixWorld.clone().invert());}
function wet(mesh,x,z){ray.set(inner.localToWorld(new T.Vector3(x,26,z)),up().negate());ray.far=3;return ray.intersectObject(mesh,false).length>0;}
function boundaryRadius(a){let lo=0,hi=34;for(let i=0;i<22;i++){const r=(lo+hi)/2;if(wet(water,Math.cos(a)*r,Math.sin(a)*r))lo=r;else hi=r;}return lo;}

test('real default V2 water obeys 1440 actual wall directions and retains original outlet',()=>{
 let wallSamples=0,gapSamples=0,maxError=0;
 for(let i=0;i<1440;i++){
  const a=(i+.13)*Math.PI/720,p=radial(wall,25,a),expected=p?Math.hypot(p.x,p.z):(()=>{let lo=0,hi=34;for(let j=0;j<22;j++){const r=(lo+hi)/2;if(wet(oldWater,Math.cos(a)*r,Math.sin(a)*r))lo=r;else hi=r;}return lo;})();
  const error=Math.abs(boundaryRadius(a)-expected);maxError=Math.max(maxError,error);assert.ok(error<1e-4,`${a}: ${error}`);if(p)wallSamples++;else gapSamples++;
 }
 assert.ok(wallSamples>1200&&gapSamples>80);console.log({wallSamples,gapSamples,maxError});
 for(const a of [0,1,2,3,4,5]){assert.equal(wet(water,30*Math.cos(a),30*Math.sin(a)),false);assert.equal(wet(water,20*Math.cos(a),20*Math.sin(a)),true);}
 assert.equal(wet(water,30*Math.cos(.32),30*Math.sin(.32)),true);assert.equal(wet(water,33.5*Math.cos(.32),33.5*Math.sin(.32)),false);
});

test('real volume sections never grow beyond old shell or rendered bank, including bottom edge',()=>{
 let maxOver=-Infinity;
 assert.deepEqual([report.volumeLevels[0],report.volumeLevels.at(-1)],[10,25]);
 for(const y of [10,10.4,12,15,20,25])for(let i=0;i<720;i++){
  // Raycaster's exact open bottom/top edge can miss; probe just inside it.
  // The extracted boundary heights themselves are asserted above.
  const probe=Math.max(10.00002,Math.min(24.99998,y));
  const a=(i+.19)*Math.PI/360,p=radial(volume,probe,a),old=radial(oldVolume,probe,a),bank=radial(wall,probe,a);
  assert.ok(p,`volume gap y${y} a${a}`);assert.ok(old);
  const r=Math.hypot(p.x,p.z);assert.ok(r<=Math.hypot(old.x,old.z)+1e-4);
  if(bank){const over=r-Math.hypot(bank.x,bank.z);maxOver=Math.max(maxOver,over);assert.ok(over<=1e-4,`volume out ${over} y${y} a${a}`);}
 }
 console.log({maxVolumeOverBank:maxOver,triangles:report.volumeTriangles});
});

test('preserves real story objects, animation, materials, floor and removes old circular attachments',()=>{
 assert.equal(water.material,originals.material);assert.equal(volume.material,originals.volumeMaterial);assert.equal(inner.getObjectByName('swamp-lake-floor').geometry,originals.floor);
 for(const[o,p,parent]of originals.actors){assert.ok(o.position.equals(p));assert.equal(o.parent,parent);}
 assert.equal(water.position.y,25);assert.equal(inner.position.y,-40);assert.equal(wrapper.scale.x,.5);
 assert.equal(water.children.filter(o=>o.visible).length,1);assert.equal(water.children.find(o=>o.visible).name,'swamp-real-wet-shore');
 assert.equal(water.geometry.attributes.normal.getY(0),1);
 const line=water.getObjectByName('swamp-real-wet-shore');assert.equal(line.isLineLoop,undefined);
});

test('installation is transform invariant and disposal restores exact original resources',()=>{
 const boundary=report.waterBoundary;assert.equal(installSwampWaterShore(wrapper),report);report.dispose();assert.equal(water.geometry,originals.water);assert.equal(volume.geometry,originals.volume);
 wrapper.position.set(12,-48,3);wrapper.quaternion.setFromAxisAngle(new T.Vector3(1,2,3).normalize(),.71);wrapper.scale.setScalar(.73);wrapper.updateMatrixWorld(true);
 const again=installSwampWaterShore(wrapper);assert.equal(again.ok,true,again.reason);assert.equal(again.waterBoundary.length,boundary.length);
 again.waterBoundary.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(v-boundary[i][k])<1e-5)));
 assert.equal(wet(water,30*Math.cos(.32),30*Math.sin(.32)),true);again.dispose();wrapper.position.set(0,0,0);wrapper.quaternion.identity();wrapper.scale.setScalar(.5);wrapper.updateMatrixWorld(true);assert.equal(installSwampWaterShore(inner).ok,true);
});

test('missing or disconnected wall fails transactionally without modifying water',()=>{
 const isolated=new T.Group();assert.equal(installSwampWaterShore(isolated).ok,false);
 inner.userData.swampWaterShore.dispose();const saved=wall.geometry;wall.geometry=new T.BufferGeometry();wall.geometry.setAttribute('position',new T.Float32BufferAttribute([],3));
 const bad=installSwampWaterShore(inner);assert.equal(bad.ok,false);assert.equal(water.geometry,originals.water);assert.equal(volume.geometry,originals.volume);
 const points=Array.from(saved.attributes.position.array),other=points.map((v,i)=>i%3===0?v+100:v);wall.geometry=new T.BufferGeometry();wall.geometry.setAttribute('position',new T.Float32BufferAttribute([...points,...other],3));
 const disconnected=installSwampWaterShore(inner);assert.equal(disconnected.ok,false);assert.match(disconnected.reason,/disconnected|multiple shoreline openings/);assert.equal(water.geometry,originals.water);
 wall.geometry=saved;assert.equal(installSwampWaterShore(inner).ok,true);
});

test('water mesh local yaw is respected and nonhorizontal water fails closed',()=>{
 location.search='?swampWaterShore=0';const w=createMoebiusSwampPlacement({scale:.5,seed:7711});location.search='';
 const s=w.userData.inner,a=s.getObjectByName('swamp-underground-waterline'),old=a.geometry;
 a.rotation.y=.37;const installed=installSwampWaterShore(s);assert.equal(installed.ok,true,installed.reason);w.updateMatrixWorld(true);
 const p=a.geometry.attributes.position,inverse=s.matrixWorld.clone().invert();
 for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i))<1e-5);const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(a.matrixWorld).applyMatrix4(inverse);assert.ok(Math.abs(v.y-25)<1e-5);}
 installed.dispose();installed.dispose();assert.equal(a.geometry,old);a.rotation.x=.1;
 const tilted=installSwampWaterShore(s);assert.equal(tilted.ok,false);assert.match(tilted.reason,/planar/);assert.equal(a.geometry,old);
});

test('production V2 factory installs the water shore by default before Greg layers',()=>{
 location.search='';const w=createMoebiusSwampPlacement({scale:.5,seed:7711}),s=w.userData.inner;
 assert.equal(s.userData.swampWaterShore?.ok,true);assert.equal(s.userData.swampWaterShore.waterY,25);
 assert.ok(s.userData.gregSpatialPlan&&s.userData.gregLakeVisuals);assert.equal(s.userData.tigerWalkSurfaces.length,8);
 assert.equal(s.getObjectByName('swamp-real-wet-shore').parent,s.getObjectByName('swamp-underground-waterline'));
});

test('actual visible boat/oar and whale geometry keeps its pre-existing wet basin/outlet over full cycles',()=>{
 const polygon=inner.userData.swampWaterShore.waterBoundary;
 const inPolygon=(p,points)=>{
  let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j];if(((a[2]>p.z)!==(b[2]>p.z))&&p.x<(b[0]-a[0])*(p.z-a[2])/(b[2]-a[2])+a[0])inside=!inside;
  }return inside;
 };
 const raw=oldWater.geometry.attributes.position,oldPolygon=[];
 for(let i=1;i<raw.count-1;i++)oldPolygon.push([raw.getX(i),25,raw.getZ(i)]);
 const stats={samples:0,vertices:0,retainedWet:0,preExistingOutsideBasin:0,preExistingOutsideOldWater:0},cache=new Map(),tmp=new T.Vector3();
 const actors=[inner.userData.shipyard.departure,inner.userData.shipyard.escort,...inner.userData.whales];
 const inverse=new T.Matrix4();
 // 26s boat cycle and > one period of both adult (.11 rad/s) and pup (.13).
 for(let i=0;i<=1200;i++){
  inner.update(.05,i*.05,{});inner.updateWorldMatrix(true,true);inverse.copy(inner.matrixWorld).invert();stats.samples++;
  for(const actor of actors){
   if(!actor.visible||i>520&&(actor===actors[0]||actor===actors[1]))continue;
   actor.traverseVisible(mesh=>{
    if(!mesh.isMesh||mesh.userData.isOutline||!mesh.geometry?.attributes.position)return;
    let vertices=cache.get(mesh.geometry);
    if(!vertices){const p=mesh.geometry.attributes.position,map=new Map();for(let j=0;j<p.count;j++){const v=new T.Vector3().fromBufferAttribute(p,j);map.set(v.toArray().join(','),v);}vertices=[...map.values()];cache.set(mesh.geometry,vertices);}
    const transforms=[];
    if(mesh.isInstancedMesh){for(let n=0;n<mesh.count;n++){const m=new T.Matrix4();mesh.getMatrixAt(n,m);transforms.push(inverse.clone().multiply(mesh.matrixWorld).multiply(m));}}
    else transforms.push(inverse.clone().multiply(mesh.matrixWorld));
    for(const matrix of transforms)for(const v of vertices){
     tmp.copy(v).applyMatrix4(matrix);stats.vertices++;
     // The audit projects real rendered vertices, including oars and full whales.
     if(inPolygon(tmp,polygon)){stats.retainedWet++;continue;}
     if(!inPolygon(tmp,oldPolygon)){stats.preExistingOutsideOldWater++;continue;}
     const a=Math.atan2(tmp.z,tmp.x),bank=radial(wall,25,a);
     assert.ok(bank&&Math.hypot(tmp.x,tmp.z)>=Math.hypot(bank.x,bank.z)-1e-4,`lost authored wet footprint ${actor.name} t${i*.05}: ${tmp.toArray()}`);
     stats.preExistingOutsideBasin++;
    }
   });
  }
 }
 assert.ok(stats.vertices>100000&&stats.retainedWet>100000);console.log('STORY_SWEEP',stats);
});
