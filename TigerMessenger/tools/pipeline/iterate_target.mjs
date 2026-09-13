import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const label=process.argv[2]||'target-before';
const out=new URL('../../artifacts/citadel-target-iteration/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:810}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});
 await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1&timeOfDay=.85',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__tm?.messenger,null,{timeout:120000});
 const report=await page.evaluate(()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;
  t.camera.position.copy(city.localToWorld(new T.Vector3(7,32,110)));
  t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);
  t.camera.lookAt(city.localToWorld(new T.Vector3(35,22,18)));t.camera.fov=55;t.camera.far=500;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);
  const ray=new T.Raycaster();ray.layers.enableAll();ray.setFromCamera(new T.Vector2(0,.72),t.camera);
  const hits=ray.intersectObject(t.scene,true).slice(0,8).map(h=>({name:h.object.name,d:h.distance,material:h.object.material?.name}));
  const blueBlocks=[];
  for(const [px,py] of [[790,628],[712,605],[842,640],[459,725]]){
   ray.setFromCamera(new T.Vector2(px/1440*2-1,1-py/810*2),t.camera);
   const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
   blueBlocks.push({pixel:[px,py],hits:ray.intersectObject(t.scene,true).filter(h=>visible(h.object)).slice(0,4).map(h=>({name:h.object.name,parent:h.object.parent?.name,material:h.object.material?.name,color:h.object.material?.color?.getHexString(),local:city.worldToLocal(h.point.clone()).toArray()}))});
  }
  const trees=[];t.messenger.landmarks.odysseyCitadel.traverse(o=>{if(/tree|canopy/i.test(o.name)&&!o.isMesh)trees.push({name:o.name,position:o.position.toArray(),scale:o.scale.toArray()});});
  const range=t.messenger.landmarks.citadelRange;
  const inf=range?.nightInfiltration;
  if(inf)for(let i=0;i<900;i++)inf.update(.1,i*.1,.85,{});
  let battle=null;t.scene.traverse(o=>{if(o.userData.debugSiege)battle=o;});
  // Use the ordinary live night scene for the visual comparison. The separate
  // target-v4-siege capture records the existing debug siege limitations.
  const terrain=t.messenger.landmarks.odysseyCitadel.getObjectByName('citadel-oskar-grid-mountain-surface');
  terrain.geometry.computeBoundingBox();const b=terrain.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().copy(city.matrixWorld).invert().multiply(terrain.matrixWorld));
  const hill=city.getObjectByName('citadel-target-hillside-houses');
  const rangeBounds={};for(const name of ['sacredTarnTree','tarnCompanionPine','vegetation','snowMountains']){const o=range[name];if(o?.isObject3D)rangeBounds[name]={name:o.name,position:o.position.toArray(),scale:o.scale.toArray()};}
  return {hits,blueBlocks,trees,hillside:hill?.userData.lots,diagnostics:hill?.userData.placementDiagnostics,terrainBounds:[b.min.toArray(),b.max.toArray()],rangeBounds,inf:inf?.getState()};
 });
 await page.waitForTimeout(1800);
 await page.screenshot({path:out+label+'-game.png'});
 // Same live scene, HUD hidden for image-to-image composition comparison only.
 await page.addStyleTag({content:'body > :not(canvas) { visibility:hidden!important; } canvas {visibility:visible!important;}'});
 await page.evaluate(()=>document.querySelectorAll('canvas').forEach(c=>{if(c!==window.__tm.renderer.domElement)c.style.setProperty('visibility','hidden','important');}));
 await page.screenshot({path:out+label+'-clean.png'});
 report.errors=errors;
 report.render=await page.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return {...t.renderer.info.render};});
 await writeFile(out+label+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
