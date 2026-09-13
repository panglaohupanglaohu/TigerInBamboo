import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelMasterTerrain=9&citadelWater=2&citadelFrontGate=1&citadelPlacement=1&citadelMassing=2&citadelPlaza=3&citadelPort=4');
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.oldCityParcelCandidate,null,{timeout:180000});
 const result=await page.evaluate(async()=>{
  const t=window.__tm,c=t.scene.getObjectByName('castleContainer');
  const {rebuildCitadelTown}=await import('/TigerMessenger/src/world/odysseyCitadel.js');
  const snapshot=()=>{const d=c.userData.oldCityParcelCandidate;return {roots:c.getObjectsByProperty('name','old-city-staggered-parcels').length,cells:d.newCells,rebuilds:d.rebuilds,solutions:d.reports.map(r=>r.wfc.hash),visibleLegacy:c.getObjectsByProperty('type','Group').filter(o=>/^town-terrace-\d+-level-\d+$/.test(o.name)&&o.visible).length};};
  const before=snapshot(),spec=structuredClone(c.userData.townSpec);
  rebuildCitadelTown(c,spec,{animate:false});
  c.updateMatrixWorld(true);t.renderer.render(t.scene,t.camera);
  const after=snapshot(),root=c.getObjectByName('old-city-staggered-parcels');
  const {lookupMergedCell}=await import('/TigerMessenger/src/ui/citadelSceneEdit.js');
  let selected=null,mappedFaces=0;
  root.traverse(o=>{for(const entry of o.userData.faceToCell??[]){mappedFaces+=entry.triCount;if(!selected)selected={mesh:o,entry};}});
  if(!selected)throw Error('No pickable migrated source cells');
  const cell=lookupMergedCell({object:selected.mesh,faceIndex:selected.entry.triStart});
  const originalChar=spec.terraces[cell.terraceIndex].levels[cell.iy][cell.iz][cell.ix];
  if(originalChar!==cell.char)throw Error('Picked cell differs from original source');
  const edited=structuredClone(spec),rows=edited.terraces[cell.terraceIndex].levels[cell.iy];
  rows[cell.iz]=rows[cell.iz].slice(0,cell.ix)+'.'+rows[cell.iz].slice(cell.ix+1);
  rebuildCitadelTown(c,edited,{animate:false});
  const deleted=snapshot(),ownership=structuredClone(c.userData.oldCityParcelOwnership);
  delete c.userData.oldCityParcelOwnership;
  rebuildCitadelTown(c,edited,{animate:false});
  const freshMapping=snapshot(),mappingStable=JSON.stringify(ownership)===JSON.stringify(c.userData.oldCityParcelOwnership);
  rebuildCitadelTown(c,spec,{animate:false});
  return {before,after,mappedFaces,pickedCell:cell,deleted,freshMapping,mappingStable,restored:snapshot(),scope:'Real merged-face source lookup, full rebuild, delete one mapped original cell and restore; fresh ownership reconstruction from edited source checked; actual pointer gesture and disk-save UI not covered.'};
 });
 assert.equal(result.after.roots,1);assert.equal(result.after.visibleLegacy,0);assert.equal(result.after.cells,result.before.cells);assert.equal(result.after.rebuilds,result.before.rebuilds+1);assert.deepEqual(result.after.solutions,result.before.solutions);
 assert.equal(result.deleted.cells,result.before.cells-1);assert.equal(result.restored.cells,result.before.cells);assert.equal(result.restored.roots,1);
 assert.equal(result.mappingStable,true);assert.equal(result.freshMapping.cells,result.deleted.cells);
 result.passed=true;
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/placement-r05-parcel-rebuild.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
