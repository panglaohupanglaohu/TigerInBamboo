import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
globalThis.window??={addEventListener(){},location:{search:''}};
globalThis.document??={getElementById:()=>null};
const {installTargetCityRuntime}=await import('../../src/world/citadel/targetCityRuntime.js');
const {createCitadelNightInfiltration}=await import('../../src/world/citadelInfiltration.js');
const {createTargetCityPlayerSupport}=await import('../../src/world/citadel/targetCityPlayerSupport.js');

function fixture(){
 const scene=new T.Group(),castle=new T.Group();castle.name='castleContainer';scene.add(castle);
 const material=new T.MeshBasicMaterial(),terrain=new T.Mesh(new T.PlaneGeometry(240,240),material);terrain.rotation.x=-Math.PI/2;terrain.position.y=3;terrain.name='citadel-oskar-grid-mountain-surface';castle.add(terrain);
 const ocean=new T.Mesh(new T.PlaneGeometry(260,260),new T.MeshBasicMaterial());ocean.rotation.x=-Math.PI/2;ocean.name='planet-v8-curved-ocean';scene.add(ocean);
 const street=new T.Group();street.name='legacy-public-street';castle.add(street);
 const legacy=new T.Mesh(new T.BoxGeometry(8,4,1),material);legacy.name='legacy-route-blocking-building';legacy.position.set(72,5,72);street.add(legacy);
 const statue=new T.Group();statue.name='citadel-plaza-hero-statue';statue.position.set(-20,3,5);const statueMesh=new T.Mesh(new T.BoxGeometry(1,3,1),material);statue.add(statueMesh);street.add(statue);
 const inactive=new T.Mesh(new T.BoxGeometry(1,1,1),material);inactive.position.set(-30,0,0);inactive.visible=false;street.add(inactive);
 const plants=new T.Group();plants.name='citadel-study-mountain-planting';const leaf=new T.Mesh(new T.BoxGeometry(),material);leaf.position.set(-60,3,-60);plants.add(leaf);castle.add(plants);
 const cloud=new T.Group();cloud.name='citadel-ridge-flow-clouds';const puff=new T.Mesh(new T.BoxGeometry(),material);puff.position.set(-60,60,0);cloud.add(puff);castle.add(cloud);
 const grass=new T.Group();grass.name='citadel-study-groundcover';castle.add(grass);
 const horse=new T.Group(),squad=new T.Group();horse.name='original-horse';horse.scale.setScalar(.72);horse.add(squad);horse.userData.rangeLocal={lx:1,lz:2};horse.userData.placement={kind:'original'};scene.add(horse);
 const controller=createCitadelNightInfiltration({scene,horse,staticSquad:squad,siteUp:new T.Vector3(0,1,0),siteRight:new T.Vector3(1,0,0),horseGround:new T.Vector3(),stairRoute:[new T.Vector3(0,0,10)],waterfallRoute:[],topAssaultMode:true,captureTarget:new T.Vector3(0,0,10)});
 const hiddenCrew=new T.Group();hiddenCrew.name='dynamic-hidden-crew';hiddenCrew.visible=false;horse.add(hiddenCrew);
 const tram=new T.Group();tram.name='original-tram-system';scene.add(tram);const gate=new T.Group();gate.name='highland-gate';scene.add(gate);
 const range={trojanHorse:horse,nightInfiltration:controller};
 const control={throwStage:null,block:false,throwConstructor:false,updates:[],disposeCount:0,ownedDispose:0,cullingCalls:[],recollects:0,refreshThrows:0};
 const culling={recollect(){control.recollects++;this.roots=[...castle.children];if(control.refreshThrows-->0)throw new Error('recollect fail');},update(...args){control.cullingCalls.push({receiver:this,args});legacy.visible=true;inactive.visible=true;cloud.visible=true;return 71;}};
 const initial={children:[...castle.children],streetChildren:[...street.children],material:terrain.material,oceanMaterial:ocean.material,horsePosition:horse.position.clone(),statuePosition:statue.position.clone(),controllerUpdate:controller.update,cullingUpdate:culling.update};
 function createCandidate({onOwned}){
  const root=new T.Group();root.name='citadel-target-city-detail-candidate';const next=terrain.material.clone(),old=terrain.material,water=ocean.material,waterNext=water.clone();terrain.material=next;ocean.material=waterNext;grass.visible=false;
  let retired=false;const appearance={dispose(){if(retired)return;retired=true;control.ownedDispose++;terrain.material=old;ocean.material=water;next.dispose();waterNext.dispose();grass.visible=true;}};onOwned(appearance);
  if(control.throwConstructor){appearance.dispose();throw new Error('constructor fail after registered appearance');}
  if(control.block){const wall=new T.Mesh(new T.BoxGeometry(8,4,1),new T.MeshBasicMaterial());wall.name='new-route-blocker';wall.position.set(72,5,72);root.add(wall);}
  const report={sourceSurfaces:{terrain:[{name:terrain.name}]},newCityStairs:{surveyed:{start:[62,3,60],end:[62,3,64],selected:{treads:[{x:62,z:61,top:3},{x:62,z:63,top:3}]}}},newCity:{position:[62,3,59],yawDegrees:0,geometry:{entry:{position:[0,0,0]}}},benchTurf:{hiddenLegacy:[{uuid:grass.uuid}]}};
  let disposed=false,provider=null;
  const step=stage=>{if(control.throwStage===stage)throw new Error(stage+' failed');};
  return{root,report,replacedCloudRoots:[cloud],update(t){control.updates.push(t);if(control.throwStage==='update')throw new Error('update failed');},getPlayerSupport(){return provider??=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:[terrain]});},completeTerraceLinks(){step('terrace');},completeWaterfrontStairs(){step('waterfront');},clearForest(){step('forest');},dispose(){if(disposed)return;disposed=true;control.disposeCount++;provider?.dispose();appearance.dispose();root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});root.removeFromParent();root.clear();}};
 }
 const options={castle,sceneRoot:scene,citadelRange:range,terrainMeshes:[terrain],oceanMesh:ocean,legacyRoots:[tram,gate],distanceCulling:culling,worldToRange:p=>({x:p.x,z:p.z})};
 return{scene,castle,terrain,ocean,street,legacy,statue,statueMesh,inactive,leaf,cloud,grass,horse,hiddenCrew,controller,tram,gate,range,control,culling,initial,options,createCandidate};
}
function restored(f){assert.equal(f.legacy.visible,true);assert.equal(f.inactive.visible,false);assert.equal(f.cloud.visible,true);assert.equal(f.grass.visible,true);assert.equal(f.tram.visible,true);assert.equal(f.gate.visible,true);assert.equal(f.terrain.material,f.initial.material);assert.equal(f.ocean.material,f.initial.oceanMaterial);assert.deepEqual(f.castle.children,f.initial.children);assert.deepEqual(f.street.children,f.initial.streetChildren);assert.deepEqual(f.horse.position,f.initial.horsePosition);assert.deepEqual(f.statue.position,f.initial.statuePosition);assert.equal(f.culling.update,f.initial.cullingUpdate);assert.equal(f.castle.userData.targetCityRuntime,undefined);assert.equal(f.controller.update,f.initial.controllerUpdate);}

test('actual actor transaction installs in live scene, preserves dynamic visibility and exposes one loop/support handle',()=>{
 const f=fixture(),runtime=installTargetCityRuntime(f.options,{createCandidate:f.createCandidate});assert.equal(runtime.root.parent,f.castle);assert.equal(runtime.report.installed,true);assert.equal(runtime.report.navigation.installedIntoPlayer,false);assert.equal(runtime.report.tram.routeIntegrated,false);assert.equal(runtime.report.gpuValidated,false);assert.equal(runtime.report.landmarkIntegration.ok,true);assert.equal(f.horse.userData.rangeLocal.lx,72);assert.equal(f.statue.parent,f.castle);assert.equal(f.legacy.visible,false);assert.equal(f.leaf.visible,true);assert.equal(f.terrain.visible,true);assert.equal(f.statueMesh.visible,true);assert.equal(f.hiddenCrew.visible,false);assert.equal(f.tram.visible,false);
 f.hiddenCrew.visible=true;runtime.update(1.5);assert.equal(f.hiddenCrew.visible,true);assert.deepEqual(f.control.updates,[1.5]);assert.equal(f.culling.update(3,'frame'),71);assert.equal(f.control.cullingCalls[0].receiver,f.culling);assert.deepEqual(f.control.cullingCalls[0].args,[3,'frame']);assert.equal(f.legacy.visible,false);assert.equal(f.inactive.visible,false);assert.equal(f.cloud.visible,false);
 const provider=runtime.getPlayerSupport();assert.equal(provider,runtime.getPlayerSupport());assert.equal(provider.ground(new T.Vector3(0,3.1,0)),3);assert.equal(runtime.report.navigation.providerAvailable,true);assert.equal(runtime.report.navigation.installedIntoPlayer,false);
 assert.equal(installTargetCityRuntime(f.options,{createCandidate:()=>{throw new Error('must not rebuild');}}),runtime);
 assert.equal(runtime.dispose().ok,true);assert.equal(runtime.dispose().alreadyDisposed,true);assert.equal(f.control.disposeCount,1);assert.equal(f.control.ownedDispose,1);assert.equal(provider.report().disposed,true);restored(f);assert.equal(f.hiddenCrew.visible,true,'uninstall must not rewind ordinary live actor visibility');
});

test('default legacy root scope never silently hides a global tram system and protected actor roots cannot be supplied',()=>{
 const f=fixture();assert.throws(()=>installTargetCityRuntime({...f.options,legacyRoots:[f.horse.children[0]]},{createCandidate:f.createCandidate}),/legacyRoots/);assert.throws(()=>installTargetCityRuntime({...f.options,legacyRoots:[f.castle]},{createCandidate:f.createCandidate}),/legacyRoots/);
 const runtime=installTargetCityRuntime({...f.options,legacyRoots:[]},{createCandidate:f.createCandidate});assert.equal(f.tram.visible,true);assert.equal(f.gate.visible,true);assert.equal(f.legacy.visible,false);assert.equal(runtime.dispose().ok,true);restored(f);
});

test('every post-construction stage and real route rejection rolls back scene/materials and releases candidate exactly once',()=>{
 for(const stage of['terrace','waterfront','forest','route','refresh']){const f=fixture();if(stage==='route')f.control.block=true;else if(stage==='refresh')f.control.refreshThrows=1;else f.control.throwStage=stage;
  let error;try{installTargetCityRuntime(f.options,{createCandidate:f.createCandidate});}catch(e){error=e;}assert.ok(error,stage);assert.equal(error.runtimeReport.installed,false);assert.equal(error.runtimeReport.status,'installation-failed');assert.equal(f.control.disposeCount,1);assert.equal(f.control.ownedDispose,1);restored(f);assert.equal(f.castle.getObjectByName('target-original-landmark-paving'),undefined);
  f.control.throwStage=null;f.control.block=false;f.control.refreshThrows=0;const retry=installTargetCityRuntime(f.options,{createCandidate:f.createCandidate});assert.equal(retry.report.installed,true);assert.equal(retry.dispose().ok,true);restored(f);
 }
});

test('factory-owned constructor rollback is not disposed twice, and missing actual inputs fail before construction',()=>{
 const f=fixture();f.control.throwConstructor=true;assert.throws(()=>installTargetCityRuntime(f.options,{createCandidate:f.createCandidate}),/constructor fail/);assert.equal(f.control.disposeCount,0);assert.equal(f.control.ownedDispose,1);restored(f);
 f.control.throwConstructor=false;for(const changed of[{terrainMeshes:[]},{oceanMesh:new T.Mesh()},{citadelRange:{}},{sceneRoot:new T.Group()}])assert.throws(()=>installTargetCityRuntime({...f.options,...changed},{createCandidate:()=>{throw new Error('should not construct');}}),/required/);
 const prior=f.controller.getPlacementState;f.controller.getPlacementState=()=>({safeToRelocate:false});assert.throws(()=>installTargetCityRuntime(f.options,{createCandidate:f.createCandidate}),/idle/);f.controller.getPlacementState=prior;restored(f);
});

test('active horse action rejects uninstall atomically; retry when idle restores actor and original visual scene',()=>{
 const f=fixture(),runtime=installTargetCityRuntime(f.options,{createCandidate:f.createCandidate}),prior=f.controller.getPlacementState;f.controller.getPlacementState=()=>({safeToRelocate:false});
 const result=runtime.dispose();assert.equal(result.ok,false);assert.equal(result.reason,'landmark-active');assert.equal(runtime.root.parent,f.castle);assert.equal(f.legacy.visible,false);assert.equal(f.control.disposeCount,0);assert.equal(f.horse.userData.rangeLocal.lx,72);assert.equal(runtime.report.installed,true);runtime.update(3);
 f.controller.getPlacementState=prior;assert.equal(runtime.dispose().ok,true);restored(f);
});

test('update errors remain errors, elapsed contract is explicit, and a harness candidate cannot be double-installed',()=>{
 const f=fixture(),foreign=new T.Group();foreign.name='citadel-target-city-detail-candidate';f.castle.add(foreign);assert.throws(()=>installTargetCityRuntime(f.options,{createCandidate:f.createCandidate}),/existing candidate/);foreign.removeFromParent();
 const runtime=installTargetCityRuntime(f.options,{createCandidate:f.createCandidate});for(const seconds of[NaN,Infinity,-1])assert.throws(()=>runtime.update(seconds),/elapsed/);f.control.throwStage='update';f.legacy.visible=true;assert.throws(()=>runtime.update(1),/update failed/);assert.equal(runtime.report.lastUpdateError,'update failed');assert.equal(f.legacy.visible,false);assert.equal(runtime.dispose().ok,true);restored(f);assert.throws(()=>runtime.getPlayerSupport(),/disposed/);
});

test('default real candidate factory rejects an unsupported live ocean shader without a partial scene or borrowed-resource disposal',()=>{
 const f=fixture(),old=f.ocean.material;old.dispose();f.ocean.material=new T.ShaderMaterial({vertexShader:'void main(){gl_Position=vec4(0.);}',fragmentShader:'void main(){gl_FragColor=vec4(1.);}'});f.initial.oceanMaterial=f.ocean.material;
 let terrainReleased=0,oceanReleased=0;f.terrain.geometry.addEventListener('dispose',()=>terrainReleased++);f.ocean.material.addEventListener('dispose',()=>oceanReleased++);
 assert.throws(()=>installTargetCityRuntime(f.options),/unsupported ocean fragment output/);restored(f);assert.equal(terrainReleased,0);assert.equal(oceanReleased,0);assert.equal(f.castle.getObjectByName('citadel-target-city-detail-candidate'),undefined);
});

test('static candidate rail report follows actual candidate presence; preserved global tram is not called a static candidate',()=>{
 for(const present of[false,true]){const f=fixture();const createCandidate=options=>{const result=f.createCandidate(options);result.report.frontRail=present?{version:'test-static-rail',tramConnected:false}:null;return result;};const runtime=installTargetCityRuntime({...f.options,legacyRoots:[],candidateOptions:{includeFrontRail:present}},{createCandidate});assert.equal(runtime.report.tram.candidateRailPresent,present);assert.equal(runtime.report.tram.railIsStatic,present);assert.equal(runtime.report.tram.routeIntegrated,false);assert.equal(runtime.report.tram.controlsChanged,false);assert.equal(f.tram.visible,true);runtime.dispose();}
});

test('visibility hot path performs zero UUID searches after binding, including post-culling and thrown updates',t=>{
 const f=fixture();for(let i=0;i<256;i++)f.leaf.parent.add(new T.Group());
 const crag=new T.Group();crag.name='citadel-study-fractured-buttresses';f.castle.add(crag);
 const createCandidate=options=>{const candidate=f.createCandidate(options);candidate.report.rockAppearance={suppressedDecorations:[{uuid:crag.uuid},{uuid:f.grass.uuid}]};return candidate;};
 const runtime=installTargetCityRuntime(f.options,{createCandidate});
 assert.deepEqual(runtime.report.visibility.suppressionBindings,{resolved:2,unresolved:0});
 const methods=[];let nodeSearches=0,traversals=0;
 f.castle.traverse(o=>methods.push([o,o.getObjectByProperty,o.traverse]));
 for(const[o,search,traverse]of methods){o.getObjectByProperty=function(...args){nodeSearches++;return search.apply(this,args);};o.traverse=function(...args){traversals++;return traverse.apply(this,args);};}
 try{
  // Count the previous implementation on the same graph; this is work evidence,
  // not a synthetic FPS estimate or proof of the dominant production bottleneck.
  for(let i=0;i<200;i++)for(const row of [...runtime.report.cityDetail.benchTurf.hiddenLegacy,...runtime.report.cityDetail.rockAppearance.suppressedDecorations])f.castle.getObjectByProperty('uuid',row.uuid);
  const baseline=nodeSearches;assert.ok(baseline>100000);nodeSearches=0;traversals=0;
  for(let frame=0;frame<100;frame++){
   f.grass.visible=true;crag.visible=true;f.hiddenCrew.visible=frame%2===0;
   runtime.update(frame);f.culling.update(frame);
   assert.equal(f.grass.visible,false);assert.equal(crag.visible,false);assert.equal(f.legacy.visible,false);assert.equal(f.cloud.visible,false);assert.equal(f.hiddenCrew.visible,frame%2===0);
  }
  f.control.throwStage='update';f.grass.visible=true;crag.visible=true;assert.throws(()=>runtime.update(101),/update failed/);assert.equal(f.grass.visible,false);assert.equal(crag.visible,false);
  assert.equal(nodeSearches,0);assert.equal(traversals,0);
  t.diagnostic(JSON.stringify({enforcementCalls:200,baselineRecursiveSearchVisits:baseline,cachedRecursiveSearchVisits:nodeSearches,cachedTraversals:traversals}));
 }finally{for(const[o,search,traverse]of methods){o.getObjectByProperty=search;o.traverse=traverse;}runtime.dispose();crag.removeFromParent();}
 restored(f);
});

test('refresh rebinds replaced identities and changed/missing report UUIDs after recollection',()=>{
 const f=fixture(),runtime=installTargetCityRuntime(f.options,{createCandidate:f.createCandidate});
 const replacement=new T.Group();replacement.uuid=f.grass.uuid;replacement.name=f.grass.name;f.grass.removeFromParent();f.castle.add(replacement);
 const late=new T.Group(),retarget=new T.Group();f.leaf.parent.add(retarget);
 runtime.report.cityDetail.rockAppearance={suppressedDecorations:[{uuid:late.uuid},{uuid:replacement.uuid}]};
 runtime.refresh();assert.equal(replacement.visible,false);assert.deepEqual(runtime.report.visibility.suppressionBindings,{resolved:1,unresolved:1});
 f.grass.visible=true;runtime.update(1);assert.equal(f.grass.visible,true,'detached old reference must no longer be enforced');
 // An object attached by recollect is part of the freshly bound live tree.
 const recollect=f.culling.recollect;f.culling.recollect=function(){recollect.call(this);f.leaf.parent.add(late);};
 runtime.report.cityDetail.benchTurf.hiddenLegacy=[{uuid:retarget.uuid}];runtime.report.cityDetail.rockAppearance.suppressedDecorations=[{uuid:late.uuid}];
 runtime.refresh();replacement.visible=true;runtime.enforceVisibility();
 assert.equal(replacement.visible,true,'removed UUID must cease enforcement');assert.equal(retarget.visible,false);assert.equal(late.visible,false);assert.deepEqual(runtime.report.visibility.suppressionBindings,{resolved:2,unresolved:0});
 f.hiddenCrew.visible=true;runtime.refresh();assert.equal(f.hiddenCrew.visible,true);assert.equal(f.statueMesh.visible,true);
 f.culling.recollect=recollect;replacement.removeFromParent();late.removeFromParent();retarget.removeFromParent();f.castle.add(f.grass);
 assert.equal(runtime.dispose().ok,true);restored(f);
 runtime.refresh();replacement.visible=true;runtime.enforceVisibility();assert.equal(replacement.visible,true,'disposed cache is inert');
});
