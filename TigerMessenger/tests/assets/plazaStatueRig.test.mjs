import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCitadelPlazaStatue} from '../../src/world/citadel/plazaStatue.js';
const world=o=>{o.updateWorldMatrix(true,false);return o.getWorldPosition(new T.Vector3());};
test('guardian joint chain moves downstream, retains pedestal and resets',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig;
 const pedestal=root.children.find(o=>o.isMesh),base=world(pedestal),tip=rig.getSpearTipWorld(),foot=world(rig.joints.leftLeg.foot);
 rig.setPose({mounted:1,raiseSpear:1});
 assert.ok(world(rig.joints.leftLeg.foot).distanceTo(foot)>.2);
 assert.ok(rig.getSpearTipWorld().y>tip.y+.5);
 assert.ok(world(pedestal).distanceTo(base)<1e-10);
 rig.reset();assert.ok(rig.getSpearTipWorld().distanceTo(tip)<1e-9);assert.ok(world(rig.joints.leftLeg.foot).distanceTo(foot)<1e-9);
 assert.throws(()=>rig.setPose('invalid'));assert.throws(()=>rig.setPose('mounted',NaN));
});
test('body detach preserves world and restoration returns exact base pose',()=>{
 const scene=new T.Group(),root=buildCitadelPlazaStatue(),mount=new T.Group();scene.add(root,mount);mount.position.set(6,4,3);
 const rig=root.userData.heroRig,before=world(rig.bodyRoot),baseChildren=root.children.length;
 rig.detachTo(mount);assert.equal(rig.bodyRoot.parent,mount);assert.ok(world(rig.bodyRoot).distanceTo(before)<1e-9);assert.equal(root.children.length,baseChildren-1);
 rig.setPose('mounted');rig.restoreToPedestal();assert.equal(rig.bodyRoot.parent,root);assert.ok(world(rig.bodyRoot).distanceTo(before)<1e-9);
});
test('all rigid links own meshes and repeated animation keeps finite geometry',()=>{
 const root=buildCitadelPlazaStatue(),rig=root.userData.heroRig;let joints=0;
 rig.bodyRoot.traverse(o=>{if(o.userData.heroJoint){joints++;assert.ok(o.children.some(c=>c.isMesh),o.name);}});assert.equal(joints,13);
 for(let i=0;i<40;i++){rig.setPose({mounted:i/39,raiseSpear:Math.sin(i)*.5+.5});root.updateMatrixWorld(true);root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.isMesh)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});}
 assert.equal(root.scale.x,1.2);assert.equal(root.userData.figureSeatedAt,2.875);
});
