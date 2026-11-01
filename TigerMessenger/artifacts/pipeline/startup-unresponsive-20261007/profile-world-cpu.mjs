// CPU construction profile only. No browser, WebGL or page automation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas, Image} from '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
process.chdir(root);
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.location={search:'',href:'http://localhost:8931/TigerMessenger/',pathname:'/TigerMessenger/'};
const element=()=>({style:{},dataset:{},appendChild(){},remove(){},addEventListener(){},removeEventListener(){},setAttribute(){},classList:{add(){},remove(){},toggle(){}},getContext:()=>null});
const makeCanvas=()=>{const c=createCanvas(256,256);c.cloneNode=()=>makeCanvas();return c;};
const makeImage=()=>{const image=new Image();image.addEventListener=(event,fn)=>{image['on'+event]=fn;};image.removeEventListener=()=>{};return image;};
globalThis.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],body:element(),createElement:tag=>tag==='canvas'?makeCanvas():tag==='img'?makeImage():element(),createElementNS:(_,tag)=>tag==='img'?makeImage():element()};
globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:720,devicePixelRatio:1};
window.top=window;
globalThis.Image=Image;
const realFetch=globalThis.fetch;
globalThis.fetch=async input=>{const raw=typeof input==='string'?input:input.url||String(input);if(/^https?:/.test(raw))throw new Error('CPU profile refuses network '+raw);const name=raw.startsWith('file:')?fileURLToPath(raw):path.resolve(root,raw);return new Response(fs.readFileSync(name));};
const T=await import(root+'vendor/three.module.js');
const {messengerIslandScene}=await import(root+'src/scenes/messengerIsland.js');
const {createPlanet}=await import(root+'src/world/planet.js');
const {runStartupSteps}=await import(root+'src/core/startupTasks.js');
const scene=new T.Scene(),planet=createPlanet(scene);
const terrainArtifact=JSON.parse(fs.readFileSync(root+'artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-geometry.json'));
const candidateInput=JSON.parse(fs.readFileSync(root+'artifacts/pipeline/citadel-east-shore-route-20261006/remesh-expanded-shift-audit.json')).candidateInput;
const stages=[];let last=performance.now(),label='setup';
function record(){stages.push({label,ms:performance.now()-last,rssMB:Math.round(process.memoryUsage().rss/1048576)});console.error(JSON.stringify(stages.at(-1)));}
try{
 const handle=await runStartupSteps(messengerIslandScene.loadSteps({scene,planet,planetRadius:160,options:{citadelEastGlobalCrossing:{enabled:true,terrainArtifact,candidateInput}}}),async next=>{record();label=next;await new Promise(r=>setTimeout(r,16));last=performance.now();});
 record();label='正在装配正式城市';last=performance.now();
 const {installTargetCityRuntimeSteps}=await import(root+'src/world/citadel/targetCityRuntime.js');
 const {createTargetCityProductionOptions}=await import(root+'src/world/citadel/targetCityProductionOptions.js');
 const {createTargetEastCrossingStartupSupport}=await import(root+'src/world/citadel/targetEastCrossingStartupSupport.js');
 const castle=scene.getObjectByName('castleContainer'),tram=handle.landmarks.tramSystem;
 const runtime=await runStartupSteps(installTargetCityRuntimeSteps({castle,sceneRoot:scene,citadelRange:handle.landmarks.citadelRange,candidateOptions:createTargetCityProductionOptions({tramSystem:tram})}),async next=>{record();label=next;await new Promise(r=>setTimeout(r,16));last=performance.now();});
 record();await new Promise(r=>setTimeout(r,16));label='正在校验铁路与城市';last=performance.now();
 const support=createTargetEastCrossingStartupSupport({enabled:true,scene,castle,tramSystem:tram,runtime,planet,hills:handle.hills,ocean:scene.getObjectByName('planet-v8-curved-ocean'),radius:160});support.commit();support.finalize();record();
 fs.writeFileSync(new URL('city-production-cpu.json',import.meta.url),JSON.stringify({oldCity:runtime.report.cityDetail.oldCity,landmarks:runtime.report.landmarkIntegration,support:support.report.installed},null,2));
 label='正在安置守军与步行路线';last=performance.now();
 const guardSupport=handle.landmarks.saihojiPhalanx?.refreshNewCitySupport?.({root:runtime.root});record();
 const garrisonReport=guardSupport?.report??guardSupport??null;
 fs.writeFileSync(new URL('garrison-production-cpu.json',import.meta.url),JSON.stringify(garrisonReport,null,2));
 assert.equal(garrisonReport?.ready,true,'production city must admit the original garrison');
 assert.equal(garrisonReport.posts,28,'all 28 original guards need supported posts');
 assert.ok(garrisonReport.routePoints>1,'production city must have a continuous walking route');
 assert.ok(garrisonReport.connectedStairNodes>0,'plaza route must actually connect to stairs');
 assert.ok(garrisonReport.routeHeightGain>1,'production route must ascend the city');
 const lake=scene.getObjectByName('moebius-swamp-zone');
 const spatial=lake?.userData.gregSpatialPlan;
 fs.writeFileSync(new URL('scene-integration-audit.json',import.meta.url),JSON.stringify({
  scope:'Actual CPU production construction; no WebGL acceptance',
  seaStacks:scene.userData.seaStackConnectedLandscape,
  cloudSurfaces:(scene.userData.seaStackCloudSurfaces||[]).map(o=>o.name),
  lake:lake?{visual:lake.userData.gregLakeVisuals,spatial:spatial?{version:spatial.version,scope:spatial.scope,levels:spatial.levels,routePoints:spatial.route?.length,walkMeshes:spatial.walkMeshes?.length}:null,
   ecology:lake.userData.gregEcology?{counts:lake.userData.gregEcology.counts,renderMeshes:lake.userData.gregEcology.renderMeshes,rejected:lake.userData.gregEcology.rejected}:null,
   living:lake.userData.gregLivingPaths,
   habitation:lake.userData.gregHabitation?{ready:lake.userData.gregHabitation.ready,position:lake.userData.gregHabitation.site?.position,renderMeshes:lake.userData.gregHabitation.renderMeshes}:null,
  }:null,
 },null,2));
 // Local production geometry export for the ship-side terrain investigation.
 scene.updateMatrixWorld(true);const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),freighter=scene.getObjectByName('bookshop-steam-parts-freighter'),hull=freighter.getObjectByName('freighter-solid-deep-hull');
 const output=root+'artifacts/pipeline/ship-source-identification-20261007/';
 const meshData=o=>({name:o.name,matrixWorld:o.matrixWorld.toArray(),geometry:o.geometry.toJSON()});
 fs.writeFileSync(output+'integrated-production-geometry.json',JSON.stringify({castleMatrix:castle.matrixWorld.toArray(),terrain:meshData(terrain),ship:{name:freighter.name,matrixWorld:freighter.matrixWorld.toArray()},hull:meshData(hull),westRetreat:castle.userData.mountainStudy.westHeadlandRetreat}));
 const lanes={};for(const [name,curve]of Object.entries(tram.curves)){const count=Math.ceil(curve.getLength());lanes[name]=Array.from({length:count+1},(_,i)=>({u:i/count,point:curve.getPointAt(i/count).toArray(),tangent:curve.getTangentAt(i/count).toArray()}));}
 fs.writeFileSync(output+'integrated-production-rails.json',JSON.stringify(lanes));
 fs.writeFileSync(new URL('world-cpu-profile.json',import.meta.url),JSON.stringify({kind:'CPU construction with native canvas; no WebGL; default empty save',ok:true,id:handle.id,landmarks:runtime.report.landmarkIntegration.ok,support:support.report.installed,stages},null,2));
}catch(error){record();fs.writeFileSync(new URL('world-cpu-profile.json',import.meta.url),JSON.stringify({ok:false,error:String(error.stack),stages},null,2));console.error(error);process.exitCode=1;}
setTimeout(()=>process.exit(process.exitCode||0),100);
