import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {buildCitadelPlazaStatue} from '../../src/world/citadel/plazaStatue.js';
const V=a=>new T.Vector3(...a);
const world=o=>{o.updateWorldMatrix(true,true);return o.getWorldPosition(new T.Vector3());};
const names=o=>o.children.filter(c=>c.isMesh).flatMap(c=>c.userData.materialSourceNames||[c.name]);
function dispose(root){root.userData.guardianAppearance?.dispose();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());}
function hitAt(root,owner,point,axis){const figure=root.userData.heroRig.bodyRoot;root.updateMatrixWorld(true);const origin=figure.localToWorld(V(point)),direction=V(axis).transformDirection(figure.matrixWorld);return new T.Raycaster(origin,direction,0,4).intersectObjects(owner.children.filter(c=>c.isMesh),false)[0];}

test('pointed pauldrons have closed front/back volume and layered trailing plates',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig;
 for(const [side,sign] of [['left',-1],['right',1]]){const shoulder=rig.joints[side+'Arm'].shoulder,rendered=names(shoulder);assert.ok(rendered.includes('vaulted-pointed-pauldron'));assert.ok(!rendered.includes('continuous-carved-pauldron'));for(let i=0;i<2;i++){assert.ok(rendered.includes('layered-pauldron-blade-'+i));assert.ok(rendered.includes('rear-pauldron-lame-'+i));}
  const front=hitAt(root,shoulder,[sign*.84,4.51,2],[0,0,-1]),back=hitAt(root,shoulder,[sign*.84,4.51,-2],[0,0,1]);assert.ok(front&&back);assert.ok(front.point.distanceTo(back.point)>.5*.63*1.2,'pauldron is solid rather than a front card');assert.ok(hitAt(root,shoulder,[sign*1.11,4.09,2],[0,0,-1]),'swept outer tip missing');
 }dispose(root);
});

test('closed thigh and calf armour taper toward joints, with real front and rear overlaps',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig;root.updateMatrixWorld(true);
 function width(owner,A,B,t){const center=world(A).lerp(world(B),t),axis=new T.Vector3(1,0,0).transformDirection(rig.bodyRoot.matrixWorld),meshes=owner.children.filter(c=>c.isMesh),hits=[-1,1].map(sign=>new T.Raycaster(center.clone().addScaledVector(axis,sign),axis.clone().multiplyScalar(-sign),0,2).intersectObjects(meshes,false)[0]);assert.ok(hits.every(Boolean));return hits[0].point.distanceTo(hits[1].point);}
 for(const side of ['left','right']){const leg=rig.joints[side+'Leg'];assert.ok(width(leg.hip,leg.hip,leg.knee,.22)>width(leg.hip,leg.hip,leg.knee,.86)*1.2);assert.ok(width(leg.knee,leg.knee,leg.foot,.28)>width(leg.knee,leg.knee,leg.foot,.87)*1.2);assert.ok(names(leg.hip).includes('thigh-rear-shell'));assert.ok(names(leg.knee).includes('rear-calf-overlap'));assert.ok(names(leg.knee).includes('pointed-knee-cap'));}
 dispose(root);
});

test('stance has one weight-bearing leg and a back-outward foot, both soles seated',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig,l=rig.joints.leftLeg,r=rig.joints.rightLeg;root.updateMatrixWorld(true);const inverse=rig.bodyRoot.matrixWorld.clone().invert(),local=o=>world(o).applyMatrix4(inverse);
 assert.ok(Math.abs(local(l.hip).x-local(l.foot).x)<.05);assert.ok(local(r.foot).x-local(r.hip).x>.25);assert.ok(local(l.foot).z-local(r.foot).z>.45);
 for(const leg of[l,r]){const box=new T.Box3();for(const mesh of leg.foot.children.filter(c=>c.isMesh)){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));}assert.ok(Math.abs(box.min.y-.45)<1e-5);}
 dispose(root);
});

test('18-degree spear stays through the palm and its actual tip follows all poses',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig,tip=rig.anchors.spearTip,grip=rig.anchors.spearGrip,hand=rig.joints.rightArm.hand;root.updateMatrixWorld(true);
 const up=V([0,1,0]).transformDirection(rig.bodyRoot.matrixWorld),direction=world(tip).sub(world(grip)).normalize();assert.ok(Math.abs(direction.angleTo(up)*180/Math.PI-18)<1e-8);assert.equal(grip.parent,hand);assert.equal(tip.parent,grip);
 const samples=[];for(let i=0;i<=12;i++){rig.setPose({mounted:i/12,raiseSpear:i/12});assert.ok(world(grip).distanceTo(world(hand))<1e-8);assert.ok(rig.getSpearTipWorld().distanceTo(world(tip))<1e-8);const origin=grip.localToWorld(V([0,.001,.3])),dir=V([0,0,-1]).transformDirection(grip.matrixWorld),shaft=new T.Raycaster(origin,dir,0,.6).intersectObject(grip,true).find(h=>h.object.userData.materialSourceNames?.includes('spear-shaft'));assert.ok(shaft,'palm axis does not pass through shaft');samples.push({amount:i/12,hand:world(hand).toArray(),grip:world(grip).toArray(),tip:world(tip).toArray()});}
 rig.reset();const bounds=new T.Box3().setFromObject(root);if(process.env.GUARDIAN_ARMOUR_REPORT)fs.writeFileSync(process.env.GUARDIAN_ARMOUR_REPORT,JSON.stringify({source:root.userData.sourceId,poseContract:root.userData.poseContract,gripSamples:samples,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},gpuVerified:false},null,2));dispose(root);
});

test('battle material switch affects only figure and restores exact idle references without orphan metal',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig,api=root.userData.guardianAppearance,bindings=new Map(),pedestal=new Map();rig.bodyRoot.traverse(o=>{if(o.isMesh)bindings.set(o,o.material);});root.children.filter(o=>o.isMesh).forEach(o=>pedestal.set(o,o.material));assert.equal(api.awake,false);assert.ok(bindings.size>30);
 for(let cycle=0;cycle<3;cycle++){assert.equal(api.setAwake(true),true);assert.equal(api.setAwake(true),false);assert.equal(api.awake,true);const metals=new Set();for(const[o,old]of bindings){assert.notEqual(o.material,old);assert.equal(o.material.metalness,1);assert.ok(o.material.envMap?.isDataTexture);metals.add(o.material);}for(const[o,material]of pedestal)assert.equal(o.material,material);assert.equal(metals.size,3);let released=0;metals.forEach(m=>m.addEventListener('dispose',()=>released++));assert.equal(api.setAwake(false),true);assert.equal(api.awake,false);for(const[o,material]of bindings)assert.equal(o.material,material);assert.equal(released,3);assert.equal(api.setAwake(false),false);}
 assert.throws(()=>api.setAwake('yes'),/boolean/);dispose(root);
});

test('mounted spear is held outside full-size horse torso instead of across the chest',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig;rig.setPose({mounted:1,raiseSpear:1});root.updateMatrixWorld(true);
 const palm=rig.bodyRoot.worldToLocal(world(rig.anchors.spearGrip));assert.ok(palm.x>1.60,'old shoulder rotation pulled palm across torso');
 const origin=world(rig.anchors.spearGrip),tip=world(rig.anchors.spearTip),up=new T.Vector3(0,1,0).transformDirection(rig.bodyRoot.matrixWorld);assert.ok(Math.abs(tip.sub(origin).normalize().angleTo(up)*180/Math.PI-18)<1e-7);
 rig.restoreToPedestal();assert.ok(world(rig.anchors.spearGrip).distanceTo(world(rig.joints.rightArm.hand))<1e-8);dispose(root);
});
