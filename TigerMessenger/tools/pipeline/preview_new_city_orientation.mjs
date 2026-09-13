import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-new-yaw30-study/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-harbor-stair-walls'),null,{timeout:180000});
 await page.evaluate(()=>{
  const t=window.__tm,T=t.THREE;let castle;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.scene.updateMatrixWorld(true);
  // Camera belongs to the fixed castle frame; it must not rotate with the city.
  t.camera.position.copy(castle.localToWorld(new T.Vector3(-40,42,141)));t.camera.up.set(0,1,0).transformDirection(castle.matrixWorld);
  t.camera.lookAt(castle.localToWorld(new T.Vector3(-18,19,16)));t.camera.fov=52;t.camera.updateProjectionMatrix();
 });
 await page.waitForTimeout(1500);await page.screenshot({path:new URL('before.png',out).pathname});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');let castle;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  const {NEW_CITY_YAW,rotateNewCityPoint}=await import('/TigerMessenger/src/world/citadel/newCityOrientation.js');
  const oldWorld=city.matrixWorld.clone(),inverseOld=oldWorld.clone().invert();
  const before=city.userData.walkRoute.map(p=>p.slice());
  city.rotation.y=NEW_CITY_YAW;city.position.fromArray(rotateNewCityPoint([0,0,0]));city.updateWorldMatrix(true,true);
  const transport=p=>castle.worldToLocal(new T.Vector3(...p).applyMatrix4(castle.matrixWorld).applyMatrix4(inverseOld).applyMatrix4(city.matrixWorld)).toArray();
  const moved=before.map(transport),oldBridge=new T.Vector3(...before[0]),newBridge=new T.Vector3(...moved[0]);
  const gate=city.getObjectByName('citadel-new-main-gate');
  return {candidateOnly:true,yawDegrees:NEW_CITY_YAW*180/Math.PI,pivot:transport(city.userData.plazaAnchor),keepGate:castle.worldToLocal(gate.getWorldPosition(new T.Vector3())).toArray(),bridgeEndpointBefore:oldBridge.toArray(),bridgeEndpointAfter:newBridge.toArray(),bridgeEndpointDrift:oldBridge.distanceTo(newBridge),inverseBridgeInNewAuthorFrame:rotateNewCityPoint(new T.Vector3(...before[0]).applyMatrix4(castle.matrixWorld).applyMatrix4(inverseOld).toArray(),true),scope:'Fixed-camera isolated-browser composition study. Terrain, original horse and battle paths not migrated; must not publish as integrated.'};
 });
 await page.waitForTimeout(1500);await page.screenshot({path:new URL('candidate.png',out).pathname});
 await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
