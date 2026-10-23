import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
test('same whale-feeder genuinely strokes, kicks and resurfaces every 7.2 seconds in full placement update',()=>{
 const scene=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=scene.userData.inner,a=inner.userData.flowerBoyActivities,boy=a.feeder,f=boy.userData.flowerBoy,s=boy.userData.flowerSwim;
 const roster=inner.userData.lotuses.flatMap(b=>b.userData.passengers),head=f.head,oldArm=f.arm;
 assert.equal(s.limbs.length,4);assert.equal(s.group.children.length,5);assert.equal(roster.length,10);assert.equal(inner.userData.lotuses[0].userData.feeder,boy);
 let draws=0;s.group.traverse(o=>{if(o.isMesh)draws++;});assert.equal(draws,9);
 const extrema=s.limbs.map(()=>({upper:[Infinity,-Infinity],lower:[Infinity,-Infinity]})),breathing=[0,0,0],submerged=[0,0,0];let mouthMin=Infinity,mouthMax=-Infinity,noseMin=Infinity,noseMax=-Infinity,minWhaleMouth=Infinity;
 const handPositions=[],phaseSet=new Set(),v=new T.Vector3(),whaleMouth=new T.Vector3(),headPos=new T.Vector3();const whale=inner.userData.whale;
 const geometryIds=[];s.group.traverse(o=>{if(o.geometry)geometryIds.push(o.geometry.uuid);});
 for(let i=0;i<648;i++){
  const time=i/30;scene.userData.update(1/30,time,{});scene.updateMatrixWorld(true);
  s.mouth.getWorldPosition(v);inner.worldToLocal(v);assert.ok(Math.abs(v.y-s.targetMouthY)<1e-6,'real face height follows waterline');
  mouthMin=Math.min(mouthMin,v.y);mouthMax=Math.max(mouthMax,v.y);s.nose.getWorldPosition(v);inner.worldToLocal(v);noseMin=Math.min(noseMin,v.y);noseMax=Math.max(noseMax,v.y);
  if(s.mouthY>25.08&&s.noseY>25.04)breathing[Math.floor(time/7.2)]++;
  if(s.mouthY<24.85&&s.noseY<24.9)submerged[Math.floor(time/7.2)]++;
  phaseSet.add(s.phase);
  s.limbs.forEach((l,j)=>{for(const key of ['upper','lower']){extrema[j][key][0]=Math.min(extrema[j][key][0],l[key].rotation.x);extrema[j][key][1]=Math.max(extrema[j][key][1],l[key].rotation.x);}});
  assert.ok(Math.abs(s.limbs[2].upper.rotation.x+s.limbs[3].upper.rotation.x)<1e-12,'legs kick in opposite phases');
  if(s.feeding===0)assert.ok(Math.abs(s.limbs[0].upper.rotation.x+s.limbs[1].upper.rotation.x+.9)<1e-12,'arms alternate when not reaching to feed');
  if(i<8){s.rightHand.getWorldPosition(v);s.group.worldToLocal(v);handPositions.push(v.toArray());}
  whaleMouth.set(0,-.18,3.66);whale.localToWorld(whaleMouth);inner.worldToLocal(whaleMouth);head.getWorldPosition(headPos);inner.worldToLocal(headPos);minWhaleMouth=Math.min(minWhaleMouth,headPos.distanceTo(whaleMouth));
  assert.equal(f.head,head);assert.equal(f.arm,oldArm);assert.equal(inner.userData.lotuses[0].userData.passengers[1],boy);assert.equal(boy.parent,inner);
  const ids=[];s.group.traverse(o=>{if(o.geometry)ids.push(o.geometry.uuid);});assert.deepEqual(ids,geometryIds);
 }
 extrema.forEach((e,i)=>{assert.ok(e.upper[1]-e.upper[0]>(i<2?2:.5));assert.ok(e.lower[1]-e.lower[0]>.45);});
 assert.notDeepEqual(handPositions[0],handPositions[7]);
 // 2026-10-10: head out of the water most of the cycle, under only around feeding the whale
 for(let i=0;i<3;i++){assert.ok(breathing[i]>=120,`head out ${i}: ${breathing[i]/30}s`);assert.ok(submerged[i]>=30&&submerged[i]<=75,`under ${i}: ${submerged[i]/30}s`);}
 assert.ok(minWhaleMouth>.50,`head too near whale mouth ${minWhaleMouth}`);assert.ok(mouthMin<24.65&&mouthMax>25.1);assert.ok(noseMin<24.85&&noseMax>25.04);
 assert.deepEqual([...phaseSet].sort(),['feeding','submerged-swim','surface-swim'].sort());
 assert.equal(inner.userData.lotuses.reduce((n,b)=>n+b.userData.paddles.length,0),10);
 console.log('feeder-swimming',JSON.stringify({samples:648,draws,breathingSeconds:breathing.map(n=>n/30),submergedSeconds:submerged.map(n=>n/30),mouthMin,mouthMax,noseMin,noseMax,minWhaleMouth,extrema}));
});
