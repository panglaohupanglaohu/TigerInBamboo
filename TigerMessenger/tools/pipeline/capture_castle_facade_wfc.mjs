import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-facade-wfc/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&timeOfDay=0.85',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-target-castle-silhouette'),null,{timeout:180000});
 const report=await page.evaluate(()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city'),root=city.getObjectByName('citadel-target-castle-silhouette');
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.scene.updateMatrixWorld(true);
  t.camera.position.copy(city.localToWorld(new T.Vector3(100,46,85)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);
  t.camera.lookAt(city.localToWorld(new T.Vector3(60,32,0)));t.camera.fov=43;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);
  // Compare ray into first arched window with adjacent solid wall, same tower.
  const ray=new T.Raycaster(),cast=(x,y)=>{const origin=city.localToWorld(new T.Vector3(x,y,16)),dir=new T.Vector3(0,0,-1).transformDirection(city.matrixWorld);ray.layers.enableAll();ray.set(origin,dir);return ray.intersectObject(root,true).slice(0,3).map(h=>({z:city.worldToLocal(h.point.clone()).z,material:h.object.material?.name}));};
  return {...root.userData.facadeWfc,openingHits:cast(49.1,21.3),wallHits:cast(50.1,21.3),visible:root.visible,archivedCrown:!city.getObjectByName('west-city-crown').visible};
 });
 assert.equal(report.towers.length,7);assert(report.visible);assert(Math.abs(report.openingHits[0].z-13.82)<.001);assert(Math.abs(report.wallHits[0].z-14.21)<.001);
 await page.waitForTimeout(1600);
 const canvas=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/png');});
 await writeFile(new URL('web-night.png',out),Buffer.from(canvas.split(',')[1],'base64'));await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
