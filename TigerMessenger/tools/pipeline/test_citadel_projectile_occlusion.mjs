import assert from 'node:assert/strict';
import * as T from '../../vendor/three.module.js';
import {createCitadelProjectileOcclusion} from '../../src/world/citadel/projectileOcclusion.js';
const scene=new T.Scene(),castle=new T.Group();castle.name='castleContainer';scene.add(castle);
const wall=new T.Mesh(new T.BoxGeometry(.5,12,8),new T.MeshBasicMaterial());wall.name='defensive-wall';wall.layers.set(3);castle.add(wall);
const query=createCitadelProjectileOcclusion(T,scene),a=new T.Vector3(-5,1,0),b=new T.Vector3(5,1,0),up=new T.Vector3(0,1,0);
assert.equal(query.arc(a,b,up,0)?.object,wall,'lighting layer wall blocks the actual arc');
assert.equal(query.segment(new T.Vector3(),b,0)?.object,wall,'inside-to-outside hits backface');
castle.visible=false;query.invalidate();assert(query.arc(a,b,up,0),'region culling does not remove collision');
const retired=new T.Group();castle.add(retired);retired.add(wall);retired.visible=false;query.invalidate();assert.equal(query.arc(a,b,up,0),null,'hidden replaced geometry is ignored');
retired.visible=true;wall.scale.y=.1;query.invalidate();assert.equal(query.arc(a,b,up,0),null,'arched shot clears low parapet');
wall.scale.y=1;query.invalidate();assert(query.segment(a,b,0),'large-dt segment cannot tunnel through wall');
wall.position.z=30;assert(query.segment(a,b,1),'cache stable during static batch');assert.equal(query.segment(a,b,3),null,'rebuild refreshes geometry');
console.log('PASS: lit layers, backfaces, hidden replacements, arc clearance, swept segment, refresh');

// Differential check against Three.js for a curved dense mesh in a rotated,
// non-uniformly scaled planet-local frame, including inside-outside rays.
const s2=new T.Scene(),c2=new T.Group();c2.name='castleContainer';s2.add(c2);
c2.position.set(120,-30,82);c2.rotation.set(.6,.9,-.4);c2.scale.set(1.3,.8,1.1);
const rock=new T.Mesh(new T.SphereGeometry(4,32,20),new T.MeshBasicMaterial({side:T.DoubleSide}));c2.add(rock);s2.updateMatrixWorld(true);
const fast=createCitadelProjectileOcclusion(T,s2),slow=new T.Raycaster();
for(let i=0;i<100;i++){
 const from=c2.localToWorld(new T.Vector3(Math.sin(i*1.3)*9,Math.cos(i*.7)*6,Math.sin(i*.37)*8));
 const to=c2.localToWorld(new T.Vector3(Math.cos(i*.91)*8,Math.sin(i*.29)*4,Math.cos(i*.77)*7));
 slow.set(from,to.clone().sub(from).normalize());slow.near=.001;slow.far=from.distanceTo(to);
 const reference=slow.intersectObject(rock,false)[0],actual=fast.segment(from,to,0);
 assert.equal(!!actual,!!reference,'BVH hit agrees with engine raycast');
 if(actual)assert(Math.abs(actual.distance-reference.distance)<1e-6,'BVH preserves nearest world hit');
}
console.log('PASS: 100 BVH/raycast differential checks in transformed spherical-world coordinates');
