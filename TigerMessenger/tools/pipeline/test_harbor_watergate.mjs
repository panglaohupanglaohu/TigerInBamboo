import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-harbor-watergate/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-harbor-watergate'),null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,gate=t.scene.getObjectByName('citadel-harbor-watergate');t.scene.updateMatrixWorld(true);
  const ray=new T.Raycaster();ray.layers.enableAll();let blocked=0,tests=0,wallHits=0;const solids=[gate];t.scene.traverse(o=>{if(o.isMesh&&(o.name.startsWith("west-city-stair-harbor-")||o.userData.citadelSolidExterior))solids.push(o);});
  for(const x of [-1.6,-.8,0,.8,1.6])for(const y of [1,1.8,2.6,3.3]){
   const a=gate.localToWorld(new T.Vector3(x,y,-1.2)),b=gate.localToWorld(new T.Vector3(x,y,1.2)),d=b.clone().sub(a);ray.set(a,d.clone().normalize());ray.far=d.length();
   if(ray.intersectObjects(solids,true).length)blocked++;tests++;
  }
  for(const x of [-3.4,3.4]){const a=gate.localToWorld(new T.Vector3(x,1,-2)),b=gate.localToWorld(new T.Vector3(x,1,2));ray.set(a,b.clone().sub(a).normalize());ray.far=4;if(ray.intersectObject(gate,true).length)wallHits++;}
  const city=t.scene.getObjectByName('highland-west-city'),landing=city.getObjectByName('west-city-harbor-middle-landing');
  const {harborStairHeight}=await import("/TigerMessenger/src/world/citadel/harborStairProfile.js");let guardHits=0;for(const z of [64,70,75])for(const side of [-1,1]){const y=harborStairHeight(city.userData.harborOceanAlignment.dockY,z)+.5,a=city.localToWorld(new T.Vector3(42,y,z)),b=city.localToWorld(new T.Vector3(42+side*2.7,y,z));ray.set(a,b.clone().sub(a).normalize());ray.far=a.distanceTo(b);if(ray.intersectObjects(solids,true).length)guardHits++;}t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;
  t.camera.position.copy(gate.localToWorld(new T.Vector3(-10,10,-17)));t.camera.up.set(0,1,0).transformDirection(gate.matrixWorld);
  t.camera.lookAt(gate.localToWorld(new T.Vector3(0,3.5,7)));t.camera.fov=55;t.camera.far=2000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);const visible=[];t.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.isOutline&&!o.userData.backlitHighlight)visible.push(o);});ray.setFromCamera(new T.Vector2(600/720-1,1-490/450),t.camera);ray.far=3000;const visualPick=ray.intersectObjects(visible,false).slice(0,3).map(h=>({name:h.object.name,parent:h.object.parent?.name,cityPoint:city.worldToLocal(h.point.clone()).toArray()}));
  return {tests,blocked,wallHits,guardHits,visualPick,opening:gate.userData.opening,landing:{position:landing.position.toArray(),size:landing.geometry.parameters},routePoints:city.userData.harborRoute.length};
 });
 await page.waitForTimeout(1600);await page.screenshot({path:new URL('web-quay-view.png',out).pathname});
 report.errors=errors;report.passed=report.blocked===0&&report.wallHits===2&&report.guardHits===6&&!errors.length;
 await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)throw Error('Watergate clearance failed');
}finally{await browser.close();}
