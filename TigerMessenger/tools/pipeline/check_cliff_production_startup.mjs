// Full production tram constructor + the final terrain/city factories, CPU only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import * as T from 'three';
const require=createRequire(import.meta.url),{createCanvas}=require(process.env.CITADEL_CANVAS_MODULE||'@napi-rs/canvas');
globalThis.document={getElementById:()=>null,createElement:()=>createCanvas(256,128)};
globalThis.window={addEventListener(){},removeEventListener(){}};window.top=window;
globalThis.location={search:''};
const {targetCliffTransitEnabled}=await import('../../src/world/citadel/targetCityRelease.js');
const {buildChristchurchTramSystem}=await import('../../src/world/tramSystem.js');
const {actualCliffTransitFixture}=await import('../../tests/world/targetCliffTransitStructure.fixture.mjs');
const {createTargetCityDetailCandidate}=await import('../../src/world/citadel/targetCityDetailCandidate.js');
const {applyTargetTerrainCandidate}=await import('../../src/world/citadel/targetTerrainCandidate.js');
const f=actualCliffTransitFixture(),start=performance.now(),tram=buildChristchurchTramSystem(f.scene,160,{citadelCliffTransit:targetCliffTransitEnabled()});
// Rebuild with the release actually selected by production, not the fixture's
// historical inner-bay route. Geometry, terrain cuts and cars share this one.
const oldTerrain=f.terrain.geometry;
applyTargetTerrainCandidate(f.castle,{curves:tram.curves,coastalCliffCuts:tram.citadelTransitRelease.coastalCliffCuts,cliffTransitRelease:tram.citadelTransitRelease});
if(oldTerrain!==f.terrain.geometry)oldTerrain.dispose();
const c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:tram.citadelTransitRelease,fitSunShadow:false});f.castle.add(c.root);
const failures=[],poses=[];
for(const lane of['red','blue'])for(let i=0;i<=20;i++){
 const [a,b]=tram.railSplice.lanes[lane].report.replacementInterval,u=a+(b-a)*i/20;
 tram.seekFreight(lane,u);
 const service=tram.freightServices.find(s=>s.tram.userData.variant===lane);
 for(const car of[service.tram,...service.wagons])if(![...car.position.toArray(),...car.quaternion.toArray()].every(Number.isFinite))failures.push({lane,u,car:car.name});
 poses.push({lane,u,head:service.tram.position.toArray()});
}
const interval=tram.group.userData.citadelRailStartup.openCitadelCoastInterval,culverts=[];
tram.group.traverse(o=>{if(o.userData.sourceProgressInterval){const [a,b]=o.userData.sourceProgressInterval;culverts.push({name:o.name,interval:[a,b]});if(a<=interval[1]&&b>=interval[0])failures.push({type:'covered-cliff-rail',name:o.name});}});
const sourceFiles=['src/world/tramSystem.js','src/scenes/messenger/loadTraffic.js','src/world/citadel/targetTerrainCandidate.js','src/world/citadel/targetOldShoreApronField.js','src/world/citadel/targetCliffTransitStructure.js','src/world/citadel/targetCityDetailCandidate.js','src/assets/robotArticulation.js'];
const hashes=Object.fromEntries(sourceFiles.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const result={method:'Actual production constructor and final factory meshes in Node; no browser/GPU/gameplay acceptance',at:new Date().toISOString(),defaultEnabled:targetCliffTransitEnabled(),elapsedMs:performance.now()-start,hashes,failures,poses,culverts,openCoastInterval:interval,terrain:f.terrain.userData.targetTerrainReport,structure:c.report.cliffTransit,waterfall:c.report.waterfall,score:null,gpuVerified:false};
const destination=tram.citadelTransitRelease.version.startsWith('user-marked')?'integrated-production-marked-cpu.json':'integrated-production-cpu.json';
fs.writeFileSync('artifacts/pipeline/citadel-rail-cliffs-20261006/'+destination,JSON.stringify(result,null,2));console.log(JSON.stringify({failures,defaultEnabled:result.defaultEnabled,release:tram.citadelTransitRelease.version,poses:poses.length,culverts:culverts.length,structureIssues:c.report.cliffTransit.issues,apron:result.terrain.oldShoreApron,elapsedMs:result.elapsedMs}));c.dispose();f.dispose();
if(failures.length||c.report.cliffTransit.issues.length)process.exitCode=1;
