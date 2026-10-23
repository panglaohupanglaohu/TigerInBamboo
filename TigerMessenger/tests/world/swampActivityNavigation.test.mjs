import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
test('formal activities have real forward rowing, safe complete routes, attached stems and live repair contacts',()=>{
 const scene=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=scene.userData.inner,a=inner.userData.flowerBoyActivities,boats=inner.userData.lotuses,nav=a.navigation,sy=inner.userData.shipyard;
 assert.equal(nav.records.length,5);assert.ok(nav.records.every(r=>r.valid));
 const positions=boats.map(()=>[]),states=boats.map(()=>new Set()),strokes=new Set(),repairPhases=new Set();let minObstacle=Infinity,minBoatGap=Infinity,minEdge=Infinity,minDirection=Infinity,minSignedRowAdvance=Infinity,maxStemError=0,maxRopeError=0,minToolAxis=Infinity,minDepartureGap=Infinity,minWhaleGap=Infinity,powerSamples=0,recoverySamples=0;
 const v=new T.Vector3(),q=new T.Vector3(),forward=new T.Vector3(),delta=new T.Vector3(),matrix=new T.Matrix4();
 const whale=inner.userData.whale,body=whale.getObjectByName('swamp-beluga-continuous-body'),fins=whale.getObjectByName('swamp-beluga-rounded-fins');
 const owned=[...boats,a.feeder,a.shore,body,fins,a.repair.rope,a.repair.tool,...sy.workers];const collect=()=>owned.flatMap(root=>{const ids=[];root.traverse(o=>{if(o.geometry)ids.push(o.geometry.uuid);});return ids;});const beforeBody=body.geometry.attributes.position.array.slice(),geometryIDs=collect();let maxTailChange=0,minWhaleDirection=1;
 for(let frame=0;frame<=1800;frame++){
  const time=frame/10;scene.userData.update(.1,time,{});scene.updateMatrixWorld(true);
  for(const [i,b]of boats.entries()){
   const r=nav.records[i],p=b.position;states[i].add(r.state);positions[i].push(p.clone());
   minEdge=Math.min(minEdge,33-Math.hypot(p.x,p.z)-r.radius);
   minDepartureGap=Math.min(minDepartureGap,Math.hypot(p.x-sy.departure.position.x,p.z-sy.departure.position.z)-r.radius-7.5);
   for(const w of inner.userData.whales)minWhaleGap=Math.min(minWhaleGap,Math.hypot(p.x-w.position.x,p.z-w.position.z)-r.radius-4.65*w.scale.x);
   for(const o of nav.obstacles)minObstacle=Math.min(minObstacle,Math.hypot(p.x-o.x,p.z-o.z)-o.r-r.radius);
   for(let j=0;j<i;j++)minBoatGap=Math.min(minBoatGap,Math.hypot(p.x-boats[j].position.x,p.z-boats[j].position.z)-r.radius-nav.records[j].radius);
   if(frame){delta.subVectors(p,positions[i][frame-1]);delta.y=0;if(delta.length()>.0001&&r.state==='rowing'){forward.set(Math.cos(b.rotation.y),0,-Math.sin(b.rotation.y));minSignedRowAdvance=Math.min(minSignedRowAdvance,delta.dot(forward)*b.userData.paddleMotion.direction);minDirection=Math.min(minDirection,Math.abs(delta.normalize().dot(forward)));}}
   if(b.userData.flowerStem){const stem=b.userData.flowerStem,L=stem.userData.flowerStemLength;v.set(0,L/2,0);stem.localToWorld(v);inner.worldToLocal(v);maxStemError=Math.max(maxStemError,v.distanceTo(p));v.set(0,-L/2,0);stem.localToWorld(v);inner.worldToLocal(v);maxStemError=Math.max(maxStemError,v.distanceTo(stem.userData.flowerStemAnchor));}
   for(const paddle of b.userData.paddles){strokes.add(paddle.userData.stroke);v.set(0,1.02,0);paddle.localToWorld(v);inner.worldToLocal(v);if(paddle.userData.stroke==='power'){powerSamples++;assert.ok(v.y<24.90&&v.y>24.70);}if(paddle.userData.stroke==='recovery'){recoverySamples++;assert.ok(v.y>25.40&&v.y<25.60);}}
  }
  const p=body.geometry.attributes.position;for(let i=0;i<p.count;i++){if(beforeBody[i*3+2]<-3.5)maxTailChange=Math.max(maxTailChange,Math.abs(p.getY(i)-beforeBody[i*3+1]));else if(beforeBody[i*3+2]>=-1.5)assert.equal(p.getY(i),beforeBody[i*3+1]);}
  for(const mesh of [body,fins])for(const o of mesh.children.filter(c=>c.userData.isOutline))assert.equal(o.geometry,mesh.geometry,'deformed skin and outline share geometry');
  const sw=whale.userData.swim,angle=sw.phase+time*sw.speed;v.set(-Math.sin(angle)*sw.rx,0,Math.cos(angle)*sw.rz).normalize();forward.set(0,0,1).applyQuaternion(whale.quaternion);forward.y=0;minWhaleDirection=Math.min(minWhaleDirection,v.dot(forward.normalize()));
  const work=a.repair;repairPhases.add(work.phase);const rope=work.rope.geometry.attributes.position;
  for(const [index,key,sign]of [[0,'armL',1],[4,'armR',-1]]){v.set(sign*.064,-.5,.094);sy.workers[0].userData[key].localToWorld(v);sy.dock.worldToLocal(v);q.fromBufferAttribute(rope,index);maxRopeError=Math.max(maxRopeError,v.distanceTo(q));}
  if(work.tool.visible)minToolAxis=Math.min(minToolAxis,work.toolAxisDistance);
 }
 const spans=positions.map(ps=>Math.hypot(Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)),Math.max(...ps.map(p=>p.z))-Math.min(...ps.map(p=>p.z))));assert.ok(spans.every(s=>s>1.3),'every vessel truly translates');assert.ok(states.every(s=>s.has('moored')&&s.has('rowing')));
 assert.ok(minDepartureGap>.3,`departure ${minDepartureGap}`);assert.ok(minObstacle>.3,`obstacle clearance ${minObstacle}`);assert.ok(minBoatGap>.3);assert.ok(minEdge>.3);assert.ok(minSignedRowAdvance>-.001,`row propulsion opposes travel ${minSignedRowAdvance}`);assert.ok(maxStemError<1e-6);assert.ok(maxRopeError<1e-6);assert.ok(minToolAxis<.12,`mallet never reaches mast ${minToolAxis}`);
 assert.ok(maxTailChange>.15);assert.ok(minWhaleDirection>.9999);assert.ok(powerSamples>500&&recoverySamples>500);assert.deepEqual([...repairPhases].sort(),['haul-rope','inspect','secure-and-check']);
 assert.deepEqual(collect(),geometryIDs,'owned activity actors allocate no geometry during updates; unrelated scene effects excluded');
 console.log('activities-navigation',JSON.stringify({seconds:180,samples:1801,spans,minObstacle,minBoatGap,minEdge,minDirection,minSignedRowAdvance,maxStemError,maxRopeError,minToolAxis,minDepartureGap,minWhaleGap,maxTailChange,minWhaleDirection,powerSamples,recoverySamples,repairPhases:[...repairPhases]}));
});
