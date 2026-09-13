import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const label=process.argv[2]||'baseline';
const out=new URL('../../artifacts/citadel-reference-pass/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const report={label,errors:[],shots:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 page.on('pageerror',e=>{report.errors.push(e.message);console.error('GAME_ERROR',e.message);});
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text().slice(0,700));});
 await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1&timeOfDay=0.85',{timeout:180000});
 await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 await page.evaluate(()=>{window.__tm.cameraRig.update=()=>{};window.__tm.P.daySpeed=0;window.__tm.P.timeOfDay=.85;});
 report.coast=await page.evaluate(async()=>{
  const tm=window.__tm,T=tm.THREE,castle=tm.messenger.landmarks.odysseyCitadel,city=castle.getObjectByName('highland-west-city');
  const ocean=tm.scene.getObjectByName('planet-v8-curved-ocean');
  const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
  const errors=[];let maxHeightError=0,samples=0;
  if(city.userData.oceanSurfaceHeight)for(let x=20;x<=80;x+=5)for(let z=0;z<=100;z+=5){const y=city.userData.oceanSurfaceHeight(x,z);const p=city.localToWorld(new T.Vector3(x,y,z));maxHeightError=Math.max(maxHeightError,Math.abs(p.length()-160-officialOceanLevelAt(p)));samples++;}
  const retired=['west-city-water-channel','highland-waterfront-water'].map(name=>{const o=castle.getObjectByName(name);return {name,visible:o?.visible,retired:o?.userData.retiredWaterCap};});
  if(retired.some(o=>o.visible))errors.push('Duplicate visible water cap');
  const surfaces=[],obstacles=[];city.updateWorldMatrix(true,true);castle.updateWorldMatrix(true,true);
  city.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.isOutline||o.material?.transparent)return;obstacles.push(o);if(o.userData.westCityWalkable)surfaces.push(o);});
  const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(terrain)obstacles.push(terrain,...terrain.children.filter(n=>n.isMesh));
  const up=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();
  const missing=[],blocked=[];let routeSamples=0;
  for(const route of [city.userData.walkRoute,city.userData.harborRoute,city.userData.boardingRoute].filter(Boolean))for(let j=1;j<route.length;j++){
   const a=new T.Vector3(...route[j-1]),b=new T.Vector3(...route[j]),n=Math.max(1,Math.ceil(a.distanceTo(b)/.2));
   for(let i=0;i<=n;i++){
    const p=a.clone().lerp(b,i/n),foot=castle.localToWorld(p.clone());ray.set(foot.clone().addScaledVector(up,.18),up.clone().negate());ray.far=.4;
    if(!ray.intersectObjects(surfaces,false).length&&missing.length<10)missing.push(p.toArray());
    for(const h of [.4,1.4]){const start=foot.clone().addScaledVector(up,h),dir=castle.localToWorld(b.clone()).addScaledVector(up,h).sub(start),len=Math.min(.12,dir.length());if(len<.001)continue;ray.set(start,dir.normalize());ray.far=len;const hit=ray.intersectObjects(obstacles,false)[0];if(hit&&blocked.length<10)blocked.push({p:p.toArray(),mesh:hit.object.name});}
    routeSamples++;
   }
  }
  return {errors,retired,samples,maxHeightError,refinement:ocean.userData.citadelOceanCoast,cliffs:castle.userData.coastalCliffSeal,route:{samples:routeSamples,missing,blocked},port:city.userData.harborOceanAlignment};
 });
 if(label.startsWith('baseline')){
  const portal=await page.evaluate(()=>{const gate=window.__tm.scene.getObjectByName('citadel-new-main-gate');return gate.children.filter(n=>['main-gate-wall','main-gate-carved-surround'].includes(n.name)).map(n=>({name:n.name,position:n.position.toArray(),positions:Array.from(n.geometry.attributes.position.array),indices:n.geometry.index?Array.from(n.geometry.index.array):null,color:n.material.color.toArray()}));});
  await writeFile(out+'portal-original.json',JSON.stringify(portal));
 }
 for(const v of [
  {id:'overview',eye:[12,42,141],target:[34,19,16],fov:52},
  {id:'harbor',eye:[18,15,102],target:[46,11,37],fov:55},
  {id:'gate',eye:[60,23,57],target:[60,27,9],fov:56},
  {id:'old-coast',eye:[-25,7,80],target:[-2,5,26],fov:57},
  {id:'east-coast',eye:[112,5,100],target:[70,4,64],fov:60},
 ]){
  await page.evaluate(v=>{const tm=window.__tm,T=tm.THREE,w=tm.scene.getObjectByName('highland-west-city');w.updateWorldMatrix(true,true);const cam=tm.camera;cam.position.copy(w.localToWorld(new T.Vector3(...v.eye)));cam.up.set(0,1,0).transformDirection(w.matrixWorld);cam.lookAt(w.localToWorld(new T.Vector3(...v.target)));cam.fov=v.fov;cam.near=.3;cam.far=3000;cam.updateProjectionMatrix();cam.updateMatrixWorld(true);},v);
  await page.waitForTimeout(1800);
  await page.screenshot({path:out+label+'-'+v.id+'.png'});
  report.shots.push(await page.evaluate(v=>{const t=window.__tm,w=t.scene.getObjectByName('highland-west-city');t.renderer.render(t.scene,t.camera);return {...v,phase:t.P?.timeOfDay,fog:t.scene.fog?.density,render:{...t.renderer.info.render},memory:{...t.renderer.info.memory},lights:w.getObjectByName('citadel-new-city-lighting')?.userData.nightWeight,oldYaw:t.messenger.landmarks.odysseyCitadel?.userData?.oldCityYaw};},v));
 }
 report.dayNight=await page.evaluate(()=>{const t=window.__tm,w=t.scene.getObjectByName('highland-west-city'),r=w.getObjectByName('citadel-harbor-reflections');r.userData.update(.5);const day=r.children[0].visible;r.userData.update(.85);const night=r.children[0].visible;return {dayHidden:!day,nightVisible:night,portalBlender:!!w.getObjectByName('citadel-new-main-gate').userData.blenderSource};});
 report.importedHouses=await page.evaluate(async()=>{
  const tm=window.__tm,T=tm.THREE,city=tm.scene.getObjectByName('highland-west-city');
  const {createCitadelPlayerWalls,createCitadelCameraOccluders}=await import('/TigerMessenger/src/world/citadel/playerWalls.js');
  const walls=createCitadelPlayerWalls(city),occluders=createCitadelCameraOccluders(city),rows=[];
  for(const name of ['west-city-harbor','west-city-middle']){
   const group=city.getObjectByName(name);if(!group?.userData.importedHouseCount)continue;
   let blocked=0,occluded=0;
   for(const [x,y,z,w,d] of group.userData.lots){
    const a=city.localToWorld(new T.Vector3(x,y+.05,z+d/2+1));
    const b=city.localToWorld(new T.Vector3(x,y+.05,z+d/2-.3));
    const velocity=b.clone().sub(a).normalize();if(walls(a,b,velocity))blocked++;
    if(occluders(a,3).some(m=>m.userData.citadelSolidExterior))occluded++;
   }
   const windows=[];group.traverse(o=>{if(o.isMesh&&o.material.name.includes('win_'))windows.push(o.material);});
   group.userData.update(.5);const day=windows.map(m=>m.emissiveIntensity);
   group.userData.update(.85);const night=windows.map(m=>m.emissiveIntensity);
   rows.push({name,count:group.userData.importedHouseCount,blocked,occluded,day,night,source:group.userData.blenderSource});
  }
  return rows;
 });
 await page.evaluate(()=>{window.__tm.P.timeOfDay=.5;const t=window.__tm,w=t.scene.getObjectByName('highland-west-city');t.camera.position.copy(w.localToWorld(new t.THREE.Vector3(12,42,141)));t.camera.up.set(0,1,0).transformDirection(w.matrixWorld);t.camera.lookAt(w.localToWorld(new t.THREE.Vector3(34,19,16)));t.camera.fov=52;t.camera.updateProjectionMatrix();});
 await page.waitForTimeout(1600);await page.screenshot({path:out+label+'-day-overview.png'});
 report.passed=report.errors.length===0&&report.coast.errors.length===0&&report.coast.maxHeightError<.001&&!report.coast.route.missing.length&&!report.coast.route.blocked.length&&report.dayNight.dayHidden&&report.dayNight.nightVisible;
 report.passed &&= report.importedHouses.every(r=>r.blocked===r.count&&r.occluded===r.count&&r.day.every((v,i)=>v<r.night[i]));
 await writeFile(out+label+'-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
