import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');

test('lake-only longships keep 52 identities, actual wet/dry blades and continuous hand/elbow contacts',()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,sy=inner.userData.shipyard,ships=[sy.dock,sy.departure];
 const rows=ships.flatMap(b=>b.userData.crew.userData.rows),geometries=ships.flatMap(b=>{const out=[];b.traverse(o=>{if(o.geometry)out.push(o.geometry.uuid);});return out;});
 const v=new T.Vector3(),w=new T.Vector3(),prev=new T.Vector3();let maxGrip=0,maxElbow=0,maxWrist=0,minHeading=1,minRecoveryBottom=Infinity,maxPowerTop=-Infinity,wet=0,dry=0,span=0;const modes=new Set();
 const motionRefs=inner.userData.lotuses.map(b=>b.userData.paddleMotion);
 for(let frame=0;frame<=1560;frame++){
  const t=frame/30;root.userData.update(1/30,t,{});root.updateMatrixWorld(true);
  for(const boat of ships){
   const api=boat.userData.warshipV6;assert.equal(boat.scale.x,2);
   for(const [i,r] of boat.userData.swampRowing.records.entries()){
    r.blade.getWorldPosition(v);inner.worldToLocal(v);modes.add(r.stroke);
    for(const h of r.hands){w.copy(h.grip);r.oar.localToWorld(w);h.hand.getWorldPosition(v);maxGrip=Math.max(maxGrip,v.distanceTo(w));
     v.set(0,.055,0);h.forearm.localToWorld(v);maxWrist=Math.max(maxWrist,v.distanceTo(w));
     const left=h.hand.name.endsWith('L');v.set(0,-.15,0);api.nodes.get(`n${left?227:228}:i${i}`).localToWorld(v);w.set(0,-.055,0);h.forearm.localToWorld(w);maxElbow=Math.max(maxElbow,v.distanceTo(w));
    }
    // The original blade box spans +/- .16, .05, .015 in its local frame.
    let low=Infinity,high=-Infinity;for(const x of [-.16,.16])for(const y of [-.05,.05])for(const z of [-.015,.015]){v.set(x,y,z);r.blade.localToWorld(v);inner.worldToLocal(v);low=Math.min(low,v.y);high=Math.max(high,v.y);}
    if(r.targetY>25.38){minRecoveryBottom=Math.min(minRecoveryBottom,low);dry++;}
    if(r.targetY<24.82){maxPowerTop=Math.max(maxPowerTop,high);wet++;}
   }
  }
  const b=sy.departure,vx=b.position.x-prev.x,vz=b.position.z-prev.z,d=Math.hypot(vx,vz);span=Math.max(span,b.position.distanceTo(new T.Vector3(16*Math.cos(1.1),25.02,16*Math.sin(1.1))));
  if(frame&&d>.00001&&d<1)minHeading=Math.min(minHeading,(vx*Math.cos(b.rotation.y)-vz*Math.sin(b.rotation.y))/d);prev.copy(b.position);
  assert.deepEqual(inner.userData.lotuses.map(b=>b.userData.paddleMotion),motionRefs);for(let i=0;i<motionRefs.length;i++)assert.equal(inner.userData.lotuses[i].userData.paddleMotion,motionRefs[i]);
 }
 assert.equal(rows.length,52);assert.deepEqual(ships.flatMap(b=>b.userData.crew.userData.rows),rows);assert.ok(maxGrip<1e-5);assert.ok(maxWrist<1e-5);assert.ok(maxElbow<.02,`elbow gap ${maxElbow}`);assert.ok(minHeading>.998);assert.ok(minRecoveryBottom>25.04,`recovery bottom ${minRecoveryBottom}`);assert.ok(maxPowerTop<25.12,`power top ${maxPowerTop}`);assert.ok(wet>100&&dry>100);assert.ok(span>4);assert.ok(modes.has('rest')&&modes.has('power')&&modes.has('recovery'));
 assert.deepEqual(ships.flatMap(b=>{const out=[];b.traverse(o=>{if(o.geometry)out.push(o.geometry.uuid);});return out;}),geometries);
 console.log('longship-validation',JSON.stringify({seconds:52,frames:1561,rowers:rows.length,maxGrip,maxWrist,maxElbow,minHeading,minRecoveryBottom,maxPowerTop,wet,dry,span}));
});
