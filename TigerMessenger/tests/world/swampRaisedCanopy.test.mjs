import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installSwampCoralCanopy} from '../../src/world/swampCoralCanopy.js';
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const el=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>ctx});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};
globalThis.location={search:'?gregLakeCanopy=0&gregLakeVisuals=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
test('default real factory lifts leaf vertices above normal camera without moving story anchors',()=>{
 const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
 const protectedNodes=[inner.getObjectByName('world-tree-trunk'),inner.userData.tiger,inner.userData.shipyard.dock,...inner.userData.towerTrees];
 const anchors=protectedNodes.map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));
 const report=installSwampCoralCanopy(inner,{enabled:true});assert.equal(report.version,9);assert.equal(report.clearance.enabled,true);
 const matrix=new THREE.Matrix4(),point=new THREE.Vector3();inner.updateWorldMatrix(true,true);let min=Infinity;
 const innerInverse=inner.matrixWorld.clone().invert();
 for(const r of report.records){
  const mesh=report.meshes.find(m=>m.parent===r.parent),frame=innerInverse.clone().multiply(mesh.parent.matrixWorld);mesh.getMatrixAt(r.instance,matrix);
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)min=Math.min(min,point.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix).applyMatrix4(frame).y);
  assert.ok(r.liftInner>=0);assert.ok(r.minInnerY>=64-1e-6);
 }
 assert.ok(min>=64-1e-4);assert.ok(report.clearance.liftedGroups>0);assert.ok(report.petioleMeshes.length<=10);
 for(const {o,p,q}of anchors){assert.ok(o.position.equals(p));assert.ok(o.quaternion.equals(q));}
 const before=report.meshes.map(m=>m.instanceMatrix.array.slice());
 placeMoebiusSwampOnSphere(wrapper,new THREE.Vector3(.3,.8,.5).normalize(),160,.5,-15.8);wrapper.updateMatrixWorld(true);
 report.meshes.forEach((m,i)=>assert.deepEqual(m.instanceMatrix.array,before[i]));
 console.log('raised canopy actual factory',JSON.stringify({minimumInnerY:min,clearanceWorldAtHalfScale:(min-40)*.5,liftedGroups:report.clearance.liftedGroups,petioleDraws:report.petioleMeshes.length,maxLiftInner:Math.max(...report.records.map(r=>r.liftInner))}));
 report.dispose();assert.equal(inner.getObjectByName('greg-raised-canopy-petioles'),undefined);
});
