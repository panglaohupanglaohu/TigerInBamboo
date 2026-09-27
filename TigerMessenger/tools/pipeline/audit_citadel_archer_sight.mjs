import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});const errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,battle=t.messenger.landmarks.saihojiPhalanx; battle.root.userData.debugSiege();t.scene.updateMatrixWorld(true);
  const {createCitadelProjectileOcclusion}=await import('/TigerMessenger/src/world/citadel/projectileOcclusion.js');const query=createCitadelProjectileOcclusion(T,t.scene);
  const blue=[];battle.root.traverse(o=>{if(o.userData.siegeEntryRoute)blue.push(o);});
  const guards=battle.root.getObjectByName('citadel-red-garrison').children.filter(o=>o.userData.phalanxRole==='longbow');
  const city=t.scene.getObjectByName('highland-west-city');
  const {updateLongbowShot}=await import('/TigerMessenger/src/assets/harbor.js');
  const rows=guards.map(s=>{
   let released=false;for(let frame=0;frame<600&&!released;frame++)released=updateLongbowShot(s,1/60,()=>.5);
   s.updateWorldMatrix(true,true);
   const origin=(s.userData.equipment?.nockedArrow||s).getWorldPosition(new T.Vector3()),up=new T.Vector3(0,1,0).applyQuaternion(s.getWorldQuaternion(new T.Quaternion()));
   const targets=blue[0].userData.siegeEntryRoute;
   const samples=[0,.25,.5,.75,1].map(f=>{const i=Math.round((targets.length-1)*f),target=targets[i],hit=query.arc(origin,target,up,0);return {index:i,clear:!hit,blocker:hit?.object.name,distance:hit?.distance,target:city.worldToLocal(target.clone()).toArray()};});
   return {uid:s.userData.uid,released,origin:city.worldToLocal(origin.clone()).toArray(),samples};
  });
  t.camera.position.copy(city.localToWorld(new T.Vector3(66,40.5,23)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new T.Vector3(60,37.6,15.8)));t.camera.fov=52;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
  return {image:t.renderer.domElement.toDataURL('image/png'),rows,scope:'Actual four original upper archers advanced with original bow cycle to release, nominal existing arrow arc to five points along an actual blue approach route. Does not certify complete animated bow clearance.'};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/archer-embrasures.png',import.meta.url),Buffer.from(report.image.split(',')[1],'base64'));delete report.image;
 report.errors=errors;report.passed=!errors.length&&report.rows.length===4&&report.rows.every(r=>r.released&&r.samples[0].clear);if(!report.passed)process.exitCode=1;await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/archer-sight-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
