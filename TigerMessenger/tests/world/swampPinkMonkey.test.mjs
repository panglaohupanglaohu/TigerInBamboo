import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs';
import crypto from 'node:crypto';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {SWAMP_COMPONENT_BUILDERS,createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const monkey=SWAMP_COMPONENT_BUILDERS.longTailMonkey(()=>.375);
test('climber silhouette keeps slender body, muted mauve fur and long downward tail',()=>{
 const body=monkey.getObjectByName('swamp-monkey-anatomy'),p=body.geometry.attributes.position,c=body.geometry.attributes.color;
 const bodyBox=new T.Box3(),tailBox=new T.Box3(),colour=new T.Color(0x9b7c96);let pink=0;
 for(let i=0;i<p.count;i++){
  const v=new T.Vector3().fromBufferAttribute(p,i);if(v.y>=-.04)bodyBox.expandByPoint(v);if(v.y<-.1)tailBox.expandByPoint(v);
  if(Math.abs(c.getX(i)-colour.r)+Math.abs(c.getY(i)-colour.g)+Math.abs(c.getZ(i)-colour.b)<1e-5)pink++;
 }
 const size=bodyBox.getSize(new T.Vector3());assert.ok(size.x/size.y<.51,'connected shoulder width remains under half full body height');
 assert.ok(tailBox.min.y<-1.9);assert.ok(tailBox.max.z-tailBox.min.z<.4,'tail hangs below, not far horizontally behind');
 assert.ok(-tailBox.min.y>size.y*1.4);assert.ok(pink/p.count>.65);
 assert.equal(monkey.userData.coralActorVersion,2);assert.equal(monkey.userData.phase,.375*Math.PI*2);
 for(const side of ['L','R']){const arm=monkey.userData['arm'+side];assert.equal(arm.userData.baseRotX,-.3);assert.equal(arm.rotation.x,-.3);assert.equal(arm.parent,monkey);}
 console.log('pink monkey proportions',JSON.stringify({bodyWidth:size.x,bodyHeight:size.y,tailMinY:tailBox.min.y,tailDepth:tailBox.max.z-tailBox.min.z,pinkVertexFraction:pink/p.count}));
});

test('narrow arm fix preserves all three tail geometries, RNG consumption and exact existing pivots',()=>{
 const contracts=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/greg-lake-character-detail-20261008/monkey-arm-v3-before/contract.json',import.meta.url)));
 for(const before of contracts){
  let calls=0;const root=SWAMP_COMPONENT_BUILDERS.longTailMonkey(()=>{calls++;return .375;},before.options),tail=root.userData.monkeyTail,p=root.getObjectByName('swamp-monkey-anatomy').geometry.attributes.position.array.slice(tail.vertexStart*3,(tail.vertexStart+tail.vertexCount)*3);
  assert.equal(calls,before.calls);assert.equal(root.userData.phase,before.phase);assert.equal(crypto.createHash('sha256').update(new Uint8Array(p.buffer)).digest('hex'),before.tailHash);
  for(const [i,key] of ['armL','armR'].entries()){const arm=root.userData[key];assert.deepEqual(arm.position.toArray(),before.arms[i].p);assert.deepEqual(arm.quaternion.toArray(),before.arms[i].q);assert.deepEqual(arm.scale.toArray(),before.arms[i].scale);}
 }
});

test('shoulder-to-wrist tube is one closed component and stays connected to real shoulder through all actual actions',()=>{
 function armGeometry(root){for(const key of ['armL','armR']){
  const arm=root.userData[key],chain=arm.userData.monkeyArmChain,p=arm.geometry.attributes.position,adj=new Map(),edgeUse=new Map();
  const vertex=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
  for(let i=0;i<chain.tubeVertexCount;i+=3){const tri=[vertex(i),vertex(i+1),vertex(i+2)];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);const k=[a,b].sort().join('|');edgeUse.set(k,(edgeUse.get(k)||0)+1);}}
  const visited=new Set(),queue=[adj.keys().next().value];while(queue.length){const v=queue.pop();if(visited.has(v))continue;visited.add(v);for(const n of adj.get(v))queue.push(n);}assert.equal(visited.size,adj.size,'no detached upper arm or separate floating elbow');assert.ok([...edgeUse.values()].every(n=>n===2),'arm tube and both end caps are closed');
  const torsoStart=chain.shoulderBridge[0],q=(torsoStart[0]/.18)**2+((torsoStart[1]-.56)/.47)**2+((torsoStart[2]+.025)/.16)**2;assert.ok(q<1,'shoulder bridge begins inside actual torso ellipsoid');
  // Actual root ring vertices lie within the stationary shoulder joint sphere.
  const bridgeEnd=new T.Vector3(...chain.shoulderBridge[1]),jointWorld=root.localToWorld(bridgeEnd.clone());let rootVertices=0;
  for(let i=0;i<chain.tubeVertexCount;i++){const v=new T.Vector3().fromBufferAttribute(p,i);if(v.length()<.0501){const world=arm.localToWorld(v);assert.ok(world.distanceTo(jointWorld)<chain.jointRadius*root.getWorldScale(new T.Vector3()).x+1e-5);rootVertices++;}}
  assert.ok(rootVertices>=10);
 }}
 const wrap=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=wrap.userData.inner,actors=[...inner.children.filter(o=>o.name==='swamp-longtail-monkey'),...inner.userData.shipyard.workers];
 for(let frame=0;frame<=64;frame++){wrap.userData.update(1/60,frame/4,{});wrap.updateMatrixWorld(true);for(const actor of actors)armGeometry(actor);}
 assert.equal(actors.length,5);
 console.log('connected monkey arms',JSON.stringify({actors:actors.length,arms:10,actualActionSamples:65}));
});
test('formal lake still has three perch monkeys and two mast repair workers with working animation pivots',()=>{
 const wrap=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=wrap.userData.inner,ordinary=inner.children.filter(o=>o.name==='swamp-longtail-monkey'),workers=inner.userData.shipyard.workers;
 assert.equal(ordinary.length,3);assert.equal(workers.length,2);assert.equal(workers[0].parent,inner.userData.shipyard.dock);assert.equal(workers[1].parent,inner.userData.shipyard.mastPivot);
 assert.deepEqual(workers.map(o=>o.scale.x),[.5,.46]);
 const paths=ordinary.map(o=>o.userData.perches.map(p=>p.toArray())),timing=ordinary.map(o=>[o.userData.sitDur,o.userData.jumpDur,o.userData.arc]),phases=ordinary.map(o=>o.userData.phase);
 const rotations=[];
 for(const time of [0,2,5,9,14,20]){
  wrap.userData.update(.016,time,{});rotations.push(workers.map(o=>o.userData.armL.rotation.x));
  for(const o of [...ordinary,...workers]){assert.ok(o.position.toArray().every(Number.isFinite));assert.ok(Number.isFinite(o.userData.armR.rotation.x));assert.equal(o.userData.coralActorVersion,2);}
 }
 assert.deepEqual(ordinary.map(o=>o.userData.perches.map(p=>p.toArray())),paths);assert.deepEqual(ordinary.map(o=>[o.userData.sitDur,o.userData.jumpDur,o.userData.arc]),timing);
 assert.ok(new Set(rotations.map(a=>a[0].toFixed(4))).size>1,'repair worker still lifts arms with mast cycle');
 assert.equal(inner.userData.lotuses.length,5);assert.equal(inner.userData.lotuses.flatMap(o=>o.userData.passengers).length,10,'flower children untouched');
 console.log('formal monkey roles',JSON.stringify({ordinary:ordinary.length,repair:workers.length,perches:paths.map(p=>p.length),timing,phases}));
});

test('repair-only coil preserves long tail arc and stays above its footplane throughout lifting',()=>{
 const hanging=SWAMP_COMPONENT_BUILDERS.longTailMonkey(()=>.375),deck=SWAMP_COMPONENT_BUILDERS.longTailMonkey(()=>.375,{tailPose:'deck'});
 assert.equal(hanging.userData.monkeyTail.pose,'hanging');assert.equal(deck.userData.monkeyTail.pose,'deck');
 assert.ok(Math.abs(hanging.userData.monkeyTail.arcLength-deck.userData.monkeyTail.arcLength)<1e-5,'coil does not shorten or remove tail');
 function tailPoints(root){const {vertexStart,vertexCount}=root.userData.monkeyTail,p=root.getObjectByName('swamp-monkey-anatomy').geometry.attributes.position;return Array.from({length:vertexCount},(_,i)=>new T.Vector3().fromBufferAttribute(p,vertexStart+i));}
 const pts=tailPoints(deck);assert.ok(Math.min(...pts.map(p=>p.y))>.18);
 for(const lean of [0,-.045,-.09,-.135,-.18])for(const p of pts)assert.ok(p.clone().applyEuler(new T.Euler(lean,0,0)).y>0,'tail stays above horizontal deck under existing forward lean');
 const wrap=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=wrap.userData.inner;
 assert.ok(inner.children.filter(o=>o.name==='swamp-longtail-monkey').every(o=>o.userData.monkeyTail.pose==='hanging'));
 assert.ok(inner.userData.shipyard.workers.every(o=>o.userData.monkeyTail.pose==='deck'));
 console.log('repair tail coil',JSON.stringify({arcLength:deck.userData.monkeyTail.arcLength,hangingLength:hanging.userData.monkeyTail.arcLength,minY:Math.min(...pts.map(p=>p.y)),minimumLeanY:Math.min(...pts.map(p=>p.clone().applyEuler(new T.Euler(-.18,0,0)).y))}));
});

test('both repair tails stay above actual ship deck through the complete mast cycle and true parent transforms',()=>{
 const wrap=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=wrap.userData.inner,ship=inner.userData.shipyard.dock,workers=inner.userData.shipyard.workers,render=ship.getObjectByName('blender-v6-render');
 const staticMeshes=render.children.filter(m=>!m.isInstancedMesh),ray=new T.Raycaster(),v=new T.Vector3(),inverse=new T.Matrix4(),relative=new T.Matrix4();
 const minimumFootGaps=[Infinity,Infinity],minimumDeckGaps=[Infinity,Infinity];
 for(let frame=0;frame<=64;frame++){
  wrap.userData.update(1/60,frame/4,{});wrap.updateMatrixWorld(true);inverse.copy(ship.matrixWorld).invert();
  for(const [index,worker] of workers.entries()){
   const foot=worker.getWorldPosition(new T.Vector3()).applyMatrix4(inverse),body=worker.getObjectByName('swamp-monkey-anatomy'),p=body.geometry.attributes.position,{vertexStart,vertexCount}=worker.userData.monkeyTail;
   relative.multiplyMatrices(inverse,body.matrixWorld);let minY=Infinity;const lowest=new T.Vector3();
   for(let i=vertexStart;i<vertexStart+vertexCount;i++){v.fromBufferAttribute(p,i).applyMatrix4(relative);if(v.y<minY){minY=v.y;lowest.copy(v);}}
   ray.set(ship.localToWorld(new T.Vector3(lowest.x,4,lowest.z)),new T.Vector3(0,-1,0).transformDirection(ship.matrixWorld));ray.far=20;
   const hits=ray.intersectObjects(staticMeshes,false).map(h=>({y:h.point.clone().applyMatrix4(inverse).y,up:h.face.normal.y})).filter(h=>h.up>.9&&h.y>.6&&h.y<.72);
   minimumFootGaps[index]=Math.min(minimumFootGaps[index],minY-foot.y);
   if(hits.length){const deckY=Math.max(...hits.map(h=>h.y));minimumDeckGaps[index]=Math.min(minimumDeckGaps[index],minY-deckY);assert.ok(minY>deckY+.01,`worker ${index} frame ${frame} tail=${minY} deck=${deckY}`);}
   assert.ok(minY>foot.y,`worker ${index} crosses actual horizontal footplane at frame ${frame}`);
  }
 }
 assert.ok(minimumDeckGaps.every(Number.isFinite));assert.equal(workers[1].userData.monkeyTail.raisedCoil,true);
 console.log('actual ship-space tail clearance',JSON.stringify({samples:65,minimumFootGaps,minimumDeckGaps,tailPose:workers.map(w=>w.userData.monkeyTail.pose)}));
});
