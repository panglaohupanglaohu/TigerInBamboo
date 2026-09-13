import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelMasterTerrain=6');
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const c=window.__tm.scene.getObjectByName('castleContainer'),before=c.userData.masterTerrainCandidate;
  const {rebuildCitadelTerrain}=await import('/TigerMessenger/src/world/odysseyCitadel.js');
  const old=c.userData.outerTerrainSystem;const next=rebuildCitadelTerrain(c,c.userData.contourSpec);
  return {before,after:c.userData.masterTerrainCandidate,rebuilt:next!==old,scope:'isolated browser rebuild with unchanged contour input; no saved game writes; verifies stale-state invalidation, not automatic reauthoring'};
 });
 assert.equal(report.rebuilt,true);assert.equal(report.after.status,'requires-regeneration');
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/rebuild-state.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,status:report.after.status}));
}finally{await b.close();}
