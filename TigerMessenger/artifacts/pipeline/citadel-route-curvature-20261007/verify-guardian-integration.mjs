import fs from 'node:fs';
import * as T from '../../../vendor/three.module.js';
globalThis.location={search:''};globalThis.document={getElementById:()=>null,createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};globalThis.window={addEventListener(){},removeEventListener(){}};
const root=new URL('../../../',import.meta.url).pathname;
const {eastCliffFinalSurfaceFixture}=await import(root+'tools/pipeline/east_cliff_final_surface_fixture.mjs');
const {installEastCliffStartupTerrain}=await import(root+'src/world/citadel/targetEastCliffStartupTerrain.js');
const {buildChristchurchTramSystem}=await import(root+'src/world/tramSystem.js');
const {createTargetCityProductionOptions}=await import(root+'src/world/citadel/targetCityProductionOptions.js');
const {createTargetCityDetailCandidate}=await import(root+'src/world/citadel/targetCityDetailCandidate.js');
const {createCitadelNightInfiltration}=await import(root+'src/world/citadelInfiltration.js');
const {integrateTargetCityLandmarks}=await import(root+'src/world/citadel/targetCityLandmarkIntegration.js');
const {buildCitadelPlazaStatue}=await import(root+'src/world/citadel/plazaStatue.js');
const {createCitadelTrojanHorse}=await import(root+'src/assets/citadelTrojanHorse.js');
const f=eastCliffFinalSurfaceFixture(),artifact=JSON.parse(fs.readFileSync(root+'artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-geometry.json')),candidateInput=JSON.parse(fs.readFileSync(root+'artifacts/pipeline/citadel-east-shore-route-20261006/remesh-expanded-shift-audit.json')).candidateInput;const installed=installEastCliffStartupTerrain({enabled:true,castle:f.castle,artifact});console.error('final terrain ready');const tram=buildChristchurchTramSystem(f.scene,160,{citadelEastGlobalCrossing:{enabled:true,candidateInput,terrainArtifact:artifact}});console.error('tram ready');const statue=buildCitadelPlazaStatue();f.castle.add(statue);const horse=createCitadelTrojanHorse({scale:.72}),squad=new T.Group();horse.scale.setScalar(.72);horse.add(squad);f.scene.add(horse);const controller=createCitadelNightInfiltration({scene:f.scene,horse,staticSquad:squad,siteUp:new T.Vector3(0,1,0),siteRight:new T.Vector3(1,0,0),horseGround:new T.Vector3(),stairRoute:[new T.Vector3(0,0,10)],waterfallRoute:[],topAssaultMode:true,captureTarget:new T.Vector3(0,0,10)});
const c=createTargetCityDetailCandidate({castle:f.castle,sceneRoot:f.scene,terrainMeshes:[f.terrain],oceanMesh:f.ocean,fitSunShadow:false,...createTargetCityProductionOptions({tramSystem:tram})});console.error('city ready');f.castle.add(c.root);c.completeTerraceLinks();c.clearForest();f.scene.updateMatrixWorld(true);
const result=integrateTargetCityLandmarks({castle:f.castle,sceneRoot:f.scene,range:{trojanHorse:horse,nightInfiltration:controller},detailCandidate:c,terrainMeshes:[f.terrain],worldToRange:p=>({x:p.x,z:p.z})});
console.log(JSON.stringify({ok:result.ok,reason:result.reason,failures:result.report.failures}));if(result.ok){
 c.completeCloudClearance?.({actors:[statue,horse]});
 const {createCitadelPlazaGuardian}=await import(root+'src/world/citadel/citadelPlazaGuardian.js');
 const fleet=new T.Group(),enemy=new T.Group();f.scene.add(fleet);fleet.add(enemy);fleet.userData.members=[enemy];enemy.userData.kind='moebius-aircraft';enemy.userData.formationIndex=0;
 const center=statue.getWorldPosition(new T.Vector3()).add(horse.getWorldPosition(new T.Vector3())).multiplyScalar(.5);enemy.position.copy(center).addScaledVector(center.clone().normalize(),16);
 const guardian=createCitadelPlazaGuardian({scene:f.scene,castle:f.castle,statue,horse,nightInfiltration:controller,getFleet:()=>fleet,thunder:()=>{}});
 for(let i=0;i<600;i++){controller.update(.05,i*.05,.5);guardian.update(.05);}
 const evidence={report:guardian.report,night:controller.getState(),health:enemy.userData.robotHullHealth};fs.writeFileSync(root+'artifacts/pipeline/citadel-guardian-20261007/production-integration-cpu.json',JSON.stringify(evidence,null,2));console.log('guardian',JSON.stringify(guardian.report));guardian.dispose();
 if(guardian.report.awakenings<1||guardian.report.strikes<2)throw new Error('Actual plaza guardian did not mount and strike');
 result.rollback();}c.dispose();tram.dispose();f.dispose();
