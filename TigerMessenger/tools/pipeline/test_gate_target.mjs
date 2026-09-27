import * as T from 'three';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {installGateTarget,createGatePlayerGround} from '../../src/world/gateTarget.js';
import data from '../../assets/models/optimized/gate-of-sighs/gateTargetData.js';
const seat=new T.Group();seat.position.set(0,159.2,0);const root=installGateTarget(seat);seat.updateMatrixWorld(true);
assert.equal(installGateTarget(seat),root);assert.equal(root.children.filter(o=>o.isMesh).length,11);
const ground=createGatePlayerGround(seat),samples=[];
for(let i=0;i<30;i++){
 const y=-4+(i+1)*.24,z=-37+(i+.5)*.4;
 const p=seat.localToWorld(new T.Vector3(-23,y+.04,z));const hit=ground(p);
 samples.push({i,valid:Number.isFinite(hit),error:hit===null?null:Math.abs(hit-p.length())});
 assert.ok(Number.isFinite(hit),'step '+i+' must support feet');assert.ok(Math.abs(hit-p.length())<.12,'step '+i+' height');
}
const meeting=seat.localToWorld(new T.Vector3(...data.meetingAnchor));assert.ok(Math.abs(ground(meeting)-meeting.length())<.1);
const mesh=root.children.filter(o=>o.isMesh&&o.userData.gateSolid),ray=new T.Raycaster();let blocked=[];
// Conservative straight-car envelope through the original corridor. Actual curved rail follows in browser audit.
for(const x of [-1.8,0,1.8])for(const y of [1,2,3.8,5]){
 ray.set(seat.localToWorld(new T.Vector3(x,y,-20)),new T.Vector3(0,0,1));ray.far=40;
 const hits=ray.intersectObjects(mesh,false);if(hits.length)blocked.push({x,y,object:hits[0].object.name,distance:hits[0].distance});
}
assert.deepEqual(blocked,[],'original tram envelope blocked');
seat.position.set(30,158,20);seat.rotation.z=.14;seat.updateMatrixWorld(true);
const moved=seat.localToWorld(new T.Vector3(...data.meetingAnchor));assert.ok(ground(moved)!==null,'relocation ground stale');
const result={schema:'gate-target-focused-v1',parts:11,triangles:data.triangles,steps:samples,meeting:true,relocatedGround:true,straightRailEnvelope:true};
await writeFile(new URL('../../artifacts/pipeline/gate-of-sighs-build/focused-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
