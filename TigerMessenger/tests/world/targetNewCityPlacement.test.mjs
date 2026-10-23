import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetNewCityPlacement} from '../../src/world/citadel/targetNewCityPlacement.js';
import {createTargetNewCityMain,createTargetNewCityApproachSampler} from '../../src/world/citadel/targetNewCityMain.js';
import {createTargetCityPatrolSupport} from '../../src/world/citadel/targetCityPatrolSupport.js';
const frame=()=>new T.Matrix4().fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
test('new city is radial at the unchanged anchor and rigidly preserves architectural dimensions',()=>{
 const C=frame(),p=createTargetNewCityPlacement(C),world=C.clone().multiply(p.matrix),up=new T.Vector3(0,1,0).transformDirection(world),anchor=new T.Vector3(...p.report.origin).applyMatrix4(C);
 assert.ok(up.angleTo(anchor.clone().normalize())<1e-7);assert.deepEqual(p.transform([0,0,0]),[74,12,33]);
 for(const local of [[-23,0,-19],[23,0,8],[0,.3,14.75]]){const q=new T.Vector3(...p.transform(local));assert.ok(Math.abs(q.y-p.planeAt(q.x,q.z,local[1]))<1e-10);assert.ok(q.applyMatrix4(p.inverse).distanceTo(new T.Vector3(...local))<1e-10);}
 assert.ok(Math.abs(p.matrix.determinant()-1)<1e-10);
});
test('approach samples actual tilted entrance triangles, not the previous yaw-only location',()=>{
 const asset=createTargetNewCityMain({proportion:'expanded-1'}),p=createTargetNewCityPlacement(frame());p.matrix.decompose(asset.group.position,asset.group.quaternion,asset.group.scale);
 const sampler=createTargetNewCityApproachSampler({main:asset,placementMatrix:p.matrix,sampleTerrain:()=>({height:-20})});
 for(const local of [[0,.3,14.4],[-2,.3,14.4],[2,.3,14.4]]){const q=p.transform(local),hit=sampler.sampleSurface(q[0],q[2]);assert.equal(hit.mesh,'actual-main-approach-triangles');assert.ok(Math.abs(hit.height-q[1])<1e-5);}
 sampler.dispose();asset.dispose();
});
test('patrol support returns only nearby real walkable triangle intersections',()=>{
 const castle=new T.Group();castle.position.y=160;const floor=new T.Mesh(new T.PlaneGeometry(10,10),new T.MeshBasicMaterial({side:T.DoubleSide}));floor.rotation.x=-Math.PI/2;castle.add(floor);castle.updateMatrixWorld(true);
 const sample=createTargetCityPatrolSupport({castle,supports:[floor]});assert.ok(sample(new T.Vector3(0,160.2,0)).distanceTo(new T.Vector3(0,160,0))<1e-7);assert.equal(sample(new T.Vector3(0,162,0)),null);assert.equal(sample(new T.Vector3(20,160,0)),null);
 floor.geometry.dispose();floor.material.dispose();
});
test('surrounding houses leave a supported rear court with an open nave axis',()=>{
 const a=createTargetNewCityMain({proportion:'expanded-1',courtyardSurfaceHeightAt:()=>-.12});
 assert.equal(a.report.courtyard.homes.length,10);assert.equal(a.report.courtyard.rearCourt.built,true);assert.equal(a.report.courtyard.rearCourt.steps.length,4);
 const rear=a.report.footprints.filter(f=>f.courtyard&&f.polygon.some(p=>p[1]<-10));
 for(const f of rear){const xs=f.polygon.map(p=>p[0]);assert.ok(Math.max(...xs)<-3||Math.min(...xs)>3,'rear door and court centre stay clear: '+f.id);}
 assert.ok(a.group.getObjectByName('rear-court-stone-floor').userData.targetWalkable);assert.ok(a.group.getObjectByName('rear-court-access-step-0').userData.targetWalkable);a.dispose();
});
