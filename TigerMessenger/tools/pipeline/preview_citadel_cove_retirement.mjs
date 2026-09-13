import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-cove-retirement/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const results=[],current=process.argv.includes('--current');
 for(const candidate of (current?[false]:[false,true])){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  if(candidate)await page.route('**/world/highlandCitadelDesign.js*',async r=>{
   const response=await r.fetch();const text=await response.text();
   await r.fulfill({response,body:text.replace('if (isHighlandHarborCove(x, z)) return false;','/* Old harbor has moved; retire its unused peninsula. */')});
  });
  await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&timeOfDay=0.85',{timeout:180000});
  await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
  const report=await page.evaluate(()=>{
   const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');
   let castle;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
   t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.scene.updateMatrixWorld(true);
   t.camera.position.copy(castle.localToWorld(new T.Vector3(-40,42,141)));
   t.camera.up.set(0,1,0).transformDirection(castle.matrixWorld);
   t.camera.lookAt(castle.localToWorld(new T.Vector3(-18,19,16)));t.camera.fov=52;t.camera.far=3000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);
   const terrain=t.scene.getObjectByName('citadel-oskar-grid-mountain-surface'),ray=new T.Raycaster();ray.layers.enableAll();
   const meshes=[];t.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.isOutline&&!o.userData.backlitHighlight)meshes.push(o);});
   const picks=[[572,647],[580,847]].map(pixel=>{
    ray.setFromCamera(new T.Vector2(pixel[0]/720-1,1-pixel[1]/450),t.camera);
    return {pixel,hits:ray.intersectObjects(meshes,false).slice(0,5).map(h=>({name:h.object.name,sourceLocal:terrain.worldToLocal(h.point.clone()).toArray(),castleLocal:castle.worldToLocal(h.point.clone()).toArray()}))};
   });
   const harbor=t.scene.getObjectByName('old-harbor-scene');
   const coastThings=[];t.scene.traverse(o=>{if(!o.isMesh||!o.visible||o===terrain||o.userData.backlitHighlight||o.userData.isOutline)return;const p=terrain.worldToLocal(o.getWorldPosition(new T.Vector3()));if(p.x>10&&p.x<25&&p.z>23&&p.z<46)coastThings.push({name:o.name,parent:o.parent?.name,sourceLocal:p.toArray()});});
   return {picks,coastThings,harbor:harbor.userData.compositionPlacement,terrainTriangles:terrain.geometry.index.count/3};
  });
  await page.waitForTimeout(1600);await page.screenshot({path:new URL(current?'current.png':candidate?'candidate.png':'before.png',out).pathname});
  results.push({candidate,...report});await page.close();
 }
 await writeFile(new URL(current?'current-report.json':'report.json',out),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(r=>({candidate:r.candidate,picks:r.picks,harbor:r.harbor,terrainTriangles:r.terrainTriangles}))));
}finally{await browser.close();}
