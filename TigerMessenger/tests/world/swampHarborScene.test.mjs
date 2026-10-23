import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampHarborScene,overviewCamera,HARBOR_OVERVIEW}=await import('../../src/world/swampHarborScene.js');
const {pruneTaggedOfficialOceanOccludeds}=await import('../../src/core/officialOceanOcclusionPruning.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');

const cam=overviewCamera();
const screen=v=>{const q=(v.isVector3?v.clone():new T.Vector3(...v)).project(cam);return {x:(q.x+1)/2,y:(1-q.y)/2,z:q.z};};
function segDist(p,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[2])*dz)/l));return Math.hypot(p.x-a[0]-t*dx,p.z-a[2]-t*dz);}

function formalPruned(){
 const scene=new T.Scene(),swamp=createMoebiusSwampPlacement({seed:7711,scale:.5});
 placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,-15.8);scene.add(swamp);
 const ocean=new T.Object3D();ocean.userData.officialOcean=true;scene.add(ocean);
 return {scene,swamp,pruned:pruneTaggedOfficialOceanOccludeds(scene,{radius:160})};
}
test('?swampHarborDeparture=original restores the full departure galley as well',()=>{
 const {scene,swamp}=formalPruned(),yard=swamp.userData.inner.userData.shipyard,h=installSwampHarborScene({swamp,departure:'original'});
 assert.deepEqual(h.report.restoredShips.sort(),['swamp-warship-depart','swamp-warship-repair']);assert.equal(yard.departure.parent,swamp.userData.inner);assert.equal(h.farBoat,null);
 assert.equal(pruneTaggedOfficialOceanOccludeds(scene,{radius:160}).hidden,0);
});
test('formal-page ocean pruning detached both warships; harbor pass re-attaches A, keeps B out of render but animated',()=>{
 const scene=new T.Scene(),swamp=createMoebiusSwampPlacement({seed:7711,scale:.5});
 placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,-15.8);scene.add(swamp);
 const ocean=new T.Object3D();ocean.userData.officialOcean=true;scene.add(ocean);
 const inner=swamp.userData.inner,yard=inner.userData.shipyard;
 const pruned=pruneTaggedOfficialOceanOccludeds(scene,{radius:160});
 assert.deepEqual(pruned.entries.map(e=>e.name).sort(),['swamp-warship-depart','swamp-warship-repair'],'reproduces the cause: both ships are below the shell radius');
 assert.equal(yard.dock.parent,null);
 const h=installSwampHarborScene({swamp});
 assert.deepEqual(h.report.restoredShips,['swamp-warship-repair']);
 assert.equal(yard.dock.parent,inner);assert.equal(yard.dock.visible,true);
 assert.equal(yard.departure.parent,null,'98k-triangle galley stays out of the render tree (read as an orange box mid-frame)');
 assert.equal(yard.departure.userData.officialOceanOccluded,false,'flag cleared so the shipyard animation block is not skipped');
 assert.equal(pruneTaggedOfficialOceanOccludeds(scene,{radius:160}).hidden,0,'a second prune pass must not detach them again');
 assert.equal(yard.mastPivot.parent,yard.dock,'repair rig still rides the ship');
 // moebiusSwamp's shipyard block skips all animation while either ship is flagged occluded.
 const z0=yard.mastPivot.rotation.z,p0=yard.departure.position.clone();
 for(let k=1;k<=200;k++){swamp.userData.update(.05,k*.05,{});h.update(k*.05);}
 assert.notEqual(yard.mastPivot.rotation.z,z0,'mast-change loop runs again');assert.ok(yard.departure.position.distanceTo(p0)>.5,'departure voyage runs again');
});

const before=createMoebiusSwampPlacement({seed:7711,scale:.5});
const after=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=after.userData.inner,yard=inner.userData.shipyard;
const harbor=installSwampHarborScene({swamp:after});inner.updateMatrixWorld(true);

test('target composition: ship, pier and both workers sit in the lower-left of the overview frame',()=>{
 const s=screen(yard.dock.position);assert.ok(s.x<.45&&s.y>.5,`ship ${s.x},${s.y}`);
 for(const seg of harbor.report.pier.segments)for(const v of [seg.from,seg.to]){const p=screen(v);assert.ok(p.x<.5&&p.y>.48,`${seg.name} ${p.x},${p.y}`);}
 for(const w of yard.workers){const p=screen(inner.worldToLocal(w.getWorldPosition(new T.Vector3())));assert.ok(p.x<.45&&p.y>.5);}
 assert.equal(harbor.report.pier.side,1,'pier on the camera-facing side of the repair ship');
 const far=screen(harbor.farBoat.boat.position);assert.ok(far.y<.5&&far.x>.6&&far.x<.85,`far longboat on the far right shore ${far.x},${far.y}`);
 // enlarged workers: ~1.6x, projected body height near the target's ~45px at 1600x1000
 assert.deepEqual(yard.workers.map(w=>+w.scale.x.toFixed(3)),[.8,.736]);
 const px=w=>{const b=new T.Box3().setFromObject(w.getObjectByName('swamp-monkey-anatomy'));let lo=1,hi=0;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const s=screen(w.parent?inner.worldToLocal(new T.Vector3(x,y,z)):new T.Vector3(x,y,z));lo=Math.min(lo,s.y);hi=Math.max(hi,s.y);}return (hi-lo)*1000;};
 const base=before.userData.inner.userData.shipyard.workers;before.updateMatrixWorld(true);after.updateMatrixWorld(true);
 yard.workers.forEach((w,i)=>{const r=px(w)/px(base[i]);assert.ok(r>1.45&&r<1.75,`worker ${i} ${r}x`);});
 assert.ok(harbor.report.pier.minShoreGap>0,'pier stays in the water, clear of the basin wall');
});

test('spare sail is furled while the mast lies on deck and set once the monkeys raise it',()=>{
 const {sail,holder}=harbor.sail;let lowest=Infinity,highest=0,raisedSamples=0;
 assert.equal(holder.parent,yard.mastPivot);
 const p=sail.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(p.getZ(i)>=.04,'cloth stays on the side away from the tripod legs');assert.ok(p.getX(i)<=-.1,'cloth stays aft of the mast, away from the top worker');}
 for(let k=0;k<=320;k++){const t=k*.05;after.userData.update(.05,t,{});harbor.update(t);const lift=1-yard.mastPivot.rotation.z/(Math.PI/2);
  if(lift<.05)lowest=Math.min(lowest,holder.scale.x);if(lift>.97){highest=Math.max(highest,holder.scale.x);raisedSamples++;}}
 assert.ok(lowest<.1,`furled ${lowest}`);assert.ok(highest>.95,`set ${highest}`);assert.ok(raisedSamples>50);
});

test('harbor pass leaves ship, repair actors, departure and escort choreography exactly as before',()=>{
 // Fresh pair: the earlier sail test already advanced `after`, and oar phase accumulates per dt.
 const fresh=createMoebiusSwampPlacement({seed:7711,scale:.5}),h=installSwampHarborScene({swamp:fresh});
 const a=fresh.userData.inner.userData.shipyard,b=before.userData.inner.userData.shipyard;
 for(let k=0;k<=520;k++){
  const t=k*.05;before.userData.update(.05,t,{});fresh.userData.update(.05,t,{});h.update(t);
  for(const key of ['dock','departure','escort','waterLizard','mastPivot','barge']){assert.deepEqual(a[key].position.toArray(),b[key].position.toArray(),`${key}@${t}`);assert.deepEqual(a[key].quaternion.toArray(),b[key].quaternion.toArray());}
 }
});

test('pier keeps clear of the repair ship oars, the departing ship, its escort and every lotus boat',()=>{
 const deck=inner.getObjectByName('swamp-harbor-pier-deck'),piles=inner.getObjectByName('swamp-harbor-pier-piles');
 const boxes=[deck,piles].map(m=>new T.Box3().setFromObject(m));
 const quays=harbor.report.pier.segments.filter(s=>s.name==='cliff-work-quay');
 assert.equal(quays.length,8);assert.ok(quays.every(s=>s.width>=4),'2m work quay at .5 scale');
 assert.ok(harbor.pier.footings.length>0,'actual terrain footings');
 for(const f of harbor.pier.footings){assert.ok(f.top[1]>f.foot[1]);assert.equal(f.embedded,.2);}
 assert.deepEqual(harbor.monkeyRepair.report.identities,{mastWorkers:2,longTail:3,chili:3});
 // repair ship: every rendered vertex (hull, oars, crew) stays off the finger walk
 inner.updateMatrixWorld(true);const inv=inner.matrixWorld.clone().invert();let shipGap=Infinity;
 yard.dock.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;let vis=true;for(let p=o;p&&p!==yard.dock;p=p.parent)if(!p.visible)vis=false;if(!vis)return;const m=inv.clone().multiply(o.matrixWorld),p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);if(v.y<27.2)shipGap=Math.min(shipGap,...quays.map(q=>segDist(v,q.from,q.to)-q.width/2));}});
 assert.ok(shipGap>.15,`repair ship reaches the finger pier (${shipGap})`);
 const nav=inner.userData.flowerBoyActivities.navigation;let lotusGap=Infinity;
 for(let k=0;k<=600;k++){
  const t=k*.2;after.userData.update(.2,t,{});harbor.update(t);after.updateMatrixWorld(true);
  if(k%5===0)for(const actor of [yard.departure,yard.escort]){if(!actor.visible)continue;actor.updateWorldMatrix(true,true);let gap=Infinity;actor.traverse(o=>{if(!o.isMesh||o.userData.isOutline||!o.geometry?.attributes.position)return;let vis=true;for(let a=o;a&&a!==actor;a=a.parent)if(!a.visible)vis=false;if(!vis)return;const m=inv.clone().multiply(o.matrixWorld),p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i+=6){v.fromBufferAttribute(p,i).applyMatrix4(m);if(v.y>27.2||v.y<20)continue;for(const q of harbor.pier.segments)gap=Math.min(gap,segDist(v,q.from,q.to)-q.width/2);}});assert.ok(gap>0,`${actor.name} visible lower hull/oar vertex meets quay at ${t}: ${gap}`);}
  nav.records.forEach((r,i)=>{const p=r.boat.position;for(const s of harbor.report.pier.segments)lotusGap=Math.min(lotusGap,segDist(p,s.from,s.to)-s.width/2-r.radius);});
 }
 assert.ok(lotusGap>0,`lotus boat sweeps over the pier (${lotusGap})`);
});

test('rim leaves fill gaps only: off the walking ribbon, out of the overview centre, through living-path clearance',()=>{
 const {leaves}=harbor;assert.ok(leaves.ok);assert.ok(leaves.count>=15&&leaves.count<=60,`restrained count ${leaves.count}`);
 const constraints=createSwampLivingPathConstraints(inner),C=HARBOR_OVERVIEW.centre;
 assert.ok(harbor.foreground.count>=8,`foreground clumps ${harbor.foreground.count}`);
 for(const mesh of [...leaves.meshes,...harbor.foreground.meshes].filter(m=>m.isInstancedMesh)){
  assert.ok(mesh.isInstancedMesh);assert.equal(mesh.userData.gregVisualRole,'foliage');
  const p=mesh.geometry.attributes.position,m=new T.Matrix4(),v=new T.Vector3();
  for(let k=0;k<mesh.count;k++){mesh.getMatrixAt(k,m);let minY=Infinity,maxY=-Infinity;const o=new T.Vector3().setFromMatrixPosition(m);let rad=0;
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);const r=Math.hypot(v.x,v.z);assert.ok(!(r>35.4&&r<39.4),'leaf over the rim walking ribbon');
    const s=screen(v);assert.ok(!(s.z<1&&s.x>C.x0&&s.x<C.x1&&s.y>C.y0&&s.y<C.y1),'leaf inside overview centre');minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);rad=Math.max(rad,Math.hypot(v.x-o.x,v.z-o.z));}
   assert.ok(constraints.inspectPlant({position:[o.x,minY-.015,o.z],radius:rad+.02,height:maxY-minY+.03}).allowed);
   if(mesh.name.includes('foreground'))assert.ok(minY>=65,'giant crown above normal shore camera');
   const a=(Math.atan2(o.z,o.x)+Math.PI*2)%(Math.PI*2);assert.ok(!(a>.12&&a<.9),'entrance stair kept open');
  }
 }
});

test('?swampHarbor=0 is a no-op and installation is idempotent',()=>{
 const s=createMoebiusSwampPlacement({seed:7711,scale:.5}),n=s.userData.inner.children.length;
 const off=installSwampHarborScene({swamp:s,enabled:false});assert.equal(off.report.enabled,false);assert.equal(s.userData.inner.children.length,n);
 assert.equal(installSwampHarborScene({swamp:after}),harbor);
});

test('enlarged repair monkeys keep feet on their perches and the live hoist rope / mallet contacts',()=>{
 const sw=createMoebiusSwampPlacement({seed:7711,scale:.5}),inn=sw.userData.inner,y=inn.userData.shipyard,feet=y.workers.map(w=>w.position.clone());
 const h=installSwampHarborScene({swamp:sw});const work=inn.userData.shipyard.workActivity;let maxRope=0,minTool=Infinity;const v=new T.Vector3();
 assert.ok(y.workers[0].position.equals(feet[0]),'deck worker keeps its foot point');
 for(let k=0;k<=400;k++){const t=k*.05;sw.userData.update(.05,t,{});h.update(t);sw.updateMatrixWorld(true);
  const rope=work.rope.geometry.attributes.position;for(const [i,key,sg] of [[0,'armL',1],[4,'armR',-1]]){v.set(sg*.064,-.5,.094);y.workers[0].userData[key].localToWorld(v);y.dock.worldToLocal(v);maxRope=Math.max(maxRope,v.distanceTo(new T.Vector3().fromBufferAttribute(rope,i)));}
  if(work.tool.visible)minTool=Math.min(minTool,work.toolAxisDistance);
  for(const w of y.workers){const body=w.getObjectByName('swamp-monkey-anatomy'),p=body.geometry.attributes.position,{vertexStart,vertexCount}=w.userData.monkeyTail,inv=w.matrixWorld.clone().invert().multiply(body.matrixWorld);let minY=Infinity;for(let i=vertexStart;i<vertexStart+vertexCount;i+=3)minY=Math.min(minY,v.fromBufferAttribute(p,i).applyMatrix4(inv).y);assert.ok(minY>0,'tail above foot plane');}
 }
 assert.ok(maxRope<1e-6,`rope ${maxRope}`);assert.ok(minTool<.12,`mallet ${minTool}`);
 // the mast-top worker must not swallow the mast (radius .07): body centre slid out with its larger half-width
 assert.ok(y.workers[1].position.x>.18);
});

test('far-shore longboat stays clear of lotus boats, whales, the world tree and the bank walkway',async()=>{
 const sw=createMoebiusSwampPlacement({seed:7711,scale:.5}),inn=sw.userData.inner,h=installSwampHarborScene({swamp:sw}),nav=inn.userData.flowerBoyActivities.navigation;
 const boat=h.farBoat.boat;inn.updateMatrixWorld(true);const inv=inn.matrixWorld.clone().invert();
 const slab=inn.getObjectByName('greg-bank-walking-slab-batch'),sp=slab.geometry.attributes.position,sm=inv.clone().multiply(slab.matrixWorld),slabPts=[];
 for(let i=0;i<sp.count;i++){const q=new T.Vector3().fromBufferAttribute(sp,i).applyMatrix4(sm);if(q.y<27.5)slabPts.push(q);}
 const trunk=new T.Box3().setFromObject(inn.getObjectByName('world-tree-trunk')).applyMatrix4(inv);
 let lotusGap=Infinity,whaleGap=Infinity,slabGap=Infinity,trunkGap=Infinity,moved=0;const start=boat.position.clone();
 for(let k=0;k<=650;k++){const t=k*.2;sw.userData.update(.2,t,{});h.update(t);
  const dir=new T.Vector3(Math.cos(boat.rotation.y),0,-Math.sin(boat.rotation.y)),a=boat.position.clone().addScaledVector(dir,-2.25),b=boat.position.clone().addScaledVector(dir,2.25),reach=.55+.75; // half beam + oar blades
  const seg=p=>segDist(p,a.toArray(),b.toArray());
  for(const r of nav.records)lotusGap=Math.min(lotusGap,seg(r.boat.position)-reach-r.radius);
  for(const w of inn.userData.whales)whaleGap=Math.min(whaleGap,seg(w.position)-reach-4.65*w.scale.x);
  if(k%25===0){for(const q of slabPts)slabGap=Math.min(slabGap,seg(q)-reach);trunkGap=Math.min(trunkGap,Math.hypot(Math.max(trunk.min.x-boat.position.x,0,boat.position.x-trunk.max.x),Math.max(trunk.min.z-boat.position.z,0,boat.position.z-trunk.max.z))-2.3);}
  moved=Math.max(moved,boat.position.distanceTo(start));
 }
 const {createSwampCliffSampler}=await import('../../src/world/swampNaturalCliff.js');const wallAt=createSwampCliffSampler(inn);
 for(let d=-2.6;d<=2.6;d+=.4){const p=h.farBoat.centre.clone().add(new T.Vector3(-Math.sin(h.report.farBoat.angle),0,Math.cos(h.report.farBoat.angle)).multiplyScalar(d)),a=Math.atan2(p.z,p.x),w=wallAt(a,25.3);assert.ok(Math.hypot(w.x,w.z)-Math.hypot(p.x,p.z)>.55+.75,'oars clear of the basin wall');}
 assert.ok(lotusGap>0,`lotus ${lotusGap}`);assert.ok(whaleGap>0,`whale ${whaleGap}`);assert.ok(slabGap>0,`walkway ${slabGap}`);assert.ok(trunkGap>0,`trunk ${trunkGap}`);assert.ok(moved>.25,'it rows');
});
