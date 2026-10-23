import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
// CPU geometry tests still await the real anatomy + target integration. The
// image shim completes texture readiness; it is not a rendered-image assertion.
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
async function fixture(){const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,tiger=inner.userData.tiger;await tiger.userData.swampTigerV2Ready;const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});return {root,inner,tiger,nodes};}
function sampler(f){const ray=new THREE.Raycaster(),surfaces=[...f.inner.userData.tigerWalkSurfaces,...f.inner.userData.gregCoralRim.walkMeshes];return point=>{const origin=f.inner.localToWorld(new THREE.Vector3(point.x,55,point.z)),direction=new THREE.Vector3(0,-1,0).transformDirection(f.inner.matrixWorld);ray.set(origin,direction);const hit=ray.intersectObjects(surfaces,false)[0];return hit?f.inner.worldToLocal(hit.point).y:null;};}
function localPoint(f,mesh,point){return f.inner.worldToLocal(mesh.localToWorld(point.clone()));}


test('highest entrance decorations clear the complete tiger patrol corridor without removing identities',async()=>{
 const f=await fixture(),{root,inner}=f;root.updateMatrixWorld(true);
 const inverse=inner.matrixWorld.clone().invert(),v=new THREE.Vector3(),matrix=new THREE.Matrix4();
 const lamps=inner.getObjectByName('v2-entry-lamps'),cheeks=inner.getObjectByName('v2-entry-stone-cheeks'),fronds=inner.getObjectByName('v2-entry-fronds');
 assert.equal(lamps.children.length,3);assert.equal(cheeks.children.length,16);assert.equal(fronds.count,96);
 const clear=(geometry,transform,label)=>{
  const p=geometry.attributes.position;let checked=0;
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i).applyMatrix4(transform);
   if(v.y<39.75)continue;
   const r=Math.hypot(v.x,v.z);
   // A conservative 3-unit wide full-body corridor, wider than paw tracks.
   assert.ok(r<35.9||r>38.9,`${label} crosses patrol body at r=${r}, y=${v.y}`);checked++;
  }
  return checked;
 };
 let checked=0;
 for(const group of [lamps,cheeks])group.traverse(mesh=>{if(mesh.isMesh)checked+=clear(mesh.geometry,inverse.clone().multiply(mesh.matrixWorld),mesh.name||group.name);});
 for(let i=0;i<fronds.count;i++){fronds.getMatrixAt(i,matrix);checked+=clear(fronds.geometry,inverse.clone().multiply(fronds.matrixWorld).multiply(matrix),`frond ${i}`);}
 assert.ok(checked>1000);
 // Confirm that the tested corridor encloses the actual imported tiger body,
 // including its head and tail, while facing along the circular patrol.
 f.tiger.position.set(Math.cos(.5)*37.4,40,Math.sin(.5)*37.4);f.tiger.rotation.set(0,-.5,0);root.updateMatrixWorld(true);
 let bodyVertices=0,bodyMaxRadius=0;
 f.tiger.traverse(mesh=>{
  if(!mesh.isMesh)return;let node=mesh;while(node&&node!==f.tiger){if(!node.visible)return;node=node.parent;}
  const p=mesh.geometry.attributes.position,transform=inverse.clone().multiply(mesh.matrixWorld);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(transform);const radius=Math.hypot(v.x,v.z);bodyMaxRadius=Math.max(bodyMaxRadius,radius);assert.ok(Math.abs(radius-37.4)<1.5,'whole tiger fits inside clearance corridor');bodyVertices++;}
 });
 assert.ok(bodyVertices>1000);
 const topLamp=lamps.children[0];assert.equal(topLamp.userData.entryPatrolClearance,'outer-rim-lamp');assert.equal(topLamp.position.y,40);
 assert.ok(Math.hypot(topLamp.position.x,topLamp.position.z)>39.9);
 // The stem is a cylinder of maximum radius .12. Convex triangles cannot
 // extend radially beyond their furthest vertex, so this is a conservative
 // separation proof for complete rendered faces, not only sample points.
 const poleMinRadius=Math.hypot(topLamp.position.x,topLamp.position.z)-.12;
 assert.ok(poleMinRadius-bodyMaxRadius>1.8,'actual body faces and lamp stem have positive physical separation');
 for(const block of cheeks.children.slice(0,2)){
  block.geometry.computeBoundingBox();const top=new THREE.Vector3(0,block.geometry.boundingBox.max.y,0).applyMatrix4(inverse.clone().multiply(block.matrixWorld));
  assert.ok(top.y<39.75,'top retaining cheeks end beneath the lowest landing paw');
 }
 // The actual annular surface and eight stair identities are untouched.
 assert.equal(inner.userData.tigerWalkSurfaces.length,8);assert.equal(inner.userData.gregCoralRim.walkMeshes.length,1);
});
