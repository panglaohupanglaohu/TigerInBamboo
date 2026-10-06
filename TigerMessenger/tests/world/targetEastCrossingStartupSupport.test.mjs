import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
globalThis.document={getElementById:()=>null,createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};globalThis.window={addEventListener(){}};globalThis.location={search:''};
const {createTargetEastCrossingStartupSupport:create}=await import('../../src/world/citadel/targetEastCrossingStartupSupport.js');
const {eastCliffFinalSurfaceFixture}=await import('../../tools/pipeline/east_cliff_final_surface_fixture.mjs');
const {installEastCliffStartupTerrain}=await import('../../src/world/citadel/targetEastCliffStartupTerrain.js');
const {buildChristchurchTramSystem}=await import('../../src/world/tramSystem.js');
const {createTargetCityDetailCandidate}=await import('../../src/world/citadel/targetCityDetailCandidate.js');
const {createCurvedWaterMaterial}=await import('../../src/render/water/curvedWaterMaterial.js');
const {buildHills,carveHillsForTrack}=await import('../../src/world/hills.js');
const ROOT=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,ROOT))),base='artifacts/pipeline/citadel-east-shore-route-20261006/',artifact=read(base+'remesh-final-surface-geometry.json'),candidateInput=read(base+'remesh-expanded-shift-audit.json').candidateInput;
function fixture(){
 const f=eastCliffFinalSurfaceFixture(),original=f.terrain.geometry;assert.equal(f.epoch.after.position,2638422502);
 const installed=installEastCliffStartupTerrain({enabled:true,castle:f.castle,artifact});f.castle.userData.mountainStudy={exactRemesh:installed.report};
 const tram=buildChristchurchTramSystem(f.scene,160,{citadelEastGlobalCrossing:{enabled:true,candidateInput,terrainArtifact:artifact}}),hills=buildHills(f.scene,160);carveHillsForTrack(hills.mesh,Object.values(tram.crossingBundle.startupPreview.curves),160);
 f.ocean.material.dispose();f.ocean.material=createCurvedWaterMaterial(T);const oceanMaterial=f.ocean.material;
 const candidate=createTargetCityDetailCandidate({castle:f.castle,sceneRoot:f.scene,terrainMeshes:[f.terrain],oceanMesh:f.ocean,fitSunShadow:false,includeFrontRail:false,cliffTransitRelease:tram.citadelTransitRelease,cliffTransitStructureOptions:tram.crossingBundle.structureOptions});f.castle.add(candidate.root);
 // Real candidate geometry/samplers, wrapped in the runtime's public binding
 // contract. This fixture does not simulate original actor relocation/main.
 const runtime={root:candidate.root,report:{installed:true,cityDetail:candidate.report},getSurfaceSamplers:()=>candidate.getSurfaceSamplers()};f.castle.userData.targetCityRuntime=runtime;f.scene.updateMatrixWorld(true);
 return{f,tram,candidate,runtime,installed,options:{enabled:true,scene:f.scene,castle:f.castle,tramSystem:tram,runtime,planet:f.scene.getObjectByName('planet-surface'),hills,ocean:f.ocean,radius:160},dispose(){tram.dispose();delete f.castle.userData.targetCityRuntime;candidate.dispose();delete f.castle.userData.mountainStudy;installed.rollback();for(const m of[hills.mesh,hills.skirt]){m.geometry.dispose();m.material.dispose();}oceanMaterial.dispose();f.dispose();}};
}
test('off never inspects scene dependencies',()=>{const h=create({get scene(){throw Error('read');}});assert.equal(h.report.enabled,false);assert.equal(h.commit(),false);h.dispose();});
test('strict real final install and actual meshes feed support transaction with rollback/finalize cleanup',()=>{const f=fixture();let h;try{h=create(f.options);assert.equal(h.report.status,'prepared');assert.equal(h.report.source.uuid,f.f.terrain.uuid);assert.equal(h.report.source.strictSourceEpoch.position,2638422502);assert.equal(h.report.wave.worldMaximum,.067);assert.deepEqual(h.report.wave.actualWorldScale,[1,1,1]);assert.equal(h.report.samples.missingGround,0);assert.equal(h.report.samples.missingSea,0);assert.ok(h.report.samples.ground>1000);assert.equal(h.report.support.sourceDeck.pass,true);assert.equal(f.tram.group.visible,false);h.commit();assert.equal(f.tram.crossingState.active,true);h.rollback();assert.equal(f.tram.crossingState.active,false);assert.equal(h.report.temporaryGeometryDisposed,true);assert.equal(h.report.indicesReleased,true);h.dispose();h=create(f.options);h.commit();h.finalize();assert.equal(h.report.indicesReleased,true);h.dispose();assert.equal(f.tram.crossingState.active,true);assert.throws(()=>h.rollback(),/FINALIZED/);
 fs.mkdirSync(new URL('artifacts/pipeline/citadel-global-crossing-startup-20261006/',ROOT),{recursive:true});fs.writeFileSync(new URL('artifacts/pipeline/citadel-global-crossing-startup-20261006/startup-adapter-cpu.json',ROOT),JSON.stringify({report:h.report,actualFinalFixture:true,runtimeContractFixture:true,mainStartupVerified:false,gpuVerified:false},null,2));
 }finally{h?.dispose();f.dispose();}});
test('source identity, strict report, city terrain binding and ocean transform/wave failures reject',()=>{const f=fixture();try{
 const report=f.installed.report;report.installed=false;assert.throws(()=>create(f.options),/STRICT_INSTALL/);report.installed=true;
 const row=f.runtime.report.cityDetail.sourceSurfaces.terrain[0],id=row.geometry;row.geometry='stale';assert.throws(()=>create(f.options),/TERRAIN_BINDING_STALE/);row.geometry=id;
 f.f.ocean.scale.set(1,2,1);assert.throws(()=>create(f.options),/NONRADIAL/);f.f.ocean.scale.set(1,1,1);
 f.f.ocean.material.uniforms.uWaterKind.value=1;assert.throws(()=>create(f.options),/WAVE_CONTRACT/);f.f.ocean.material.uniforms.uWaterKind.value=0;
 const p=f.f.terrain.geometry.attributes.position,old=p.array[0];p.array[0]+=.1;assert.throws(()=>create(f.options),/FINAL_GEOMETRY_MISMATCH/);p.array[0]=old;
 assert.equal(f.tram.crossingState.active,false);
 }finally{f.dispose();}});
test('unversioned terrain mutation after prepare and city replacement after commit automatically rollback before publish/finalize',()=>{const f=fixture();let h;try{h=create(f.options);const p=f.f.terrain.geometry.attributes.position,old=p.array[0];p.array[0]+=.1;assert.throws(()=>h.commit(),/SURFACE_EPOCH_CHANGED/);assert.equal(f.tram.crossingState.active,false);assert.equal(h.report.indicesReleased,true);p.array[0]=old;h=create(f.options);h.commit();const group=f.candidate.root.getObjectByName('citadel-target-cliff-transit-structure');group.removeFromParent();assert.throws(()=>h.finalize(),/RUNTIME_CHANGED/);assert.equal(f.tram.crossingState.active,false);assert.equal(h.report.temporaryGeometryDisposed,true);f.candidate.root.add(group);}finally{h?.dispose();f.dispose();}});
