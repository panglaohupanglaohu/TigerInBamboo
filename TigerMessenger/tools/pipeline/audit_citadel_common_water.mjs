import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-common-water-diagnosis/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelCommonFrame=1',{timeout:180000});await p.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=t.scene.getObjectByName('highland-west-city');
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.scene.updateMatrixWorld(true);
  const radius=city.getObjectByName('citadel-new-city-backdrop-range').userData.oceanConformance.radius;
  const {createOceanHeightSampler}=await import('/TigerMessenger/src/world/citadel/oceanSurface.js');const sea=createOceanHeightSampler(city,radius);
  const corners=[44.85,76].flatMap(x=>[59.5,83.5].map(z=>({x,z,clearance:4-sea(x,z)})));
  const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();const walkables=[];
  city.traverseVisible(o=>{if(o.isMesh&&o.userData.westCityWalkable)walkables.push(o);});const checks={};
  for(const key of ['walkRoute','harborRoute','frontHarborRoute']){
   const route=city.userData[key],missing=[];let samples=0;
   for(let i=1;i<route.length;i++){const a=new T.Vector3(...route[i-1]),b=new T.Vector3(...route[i]),n=Math.ceil(a.distanceTo(b)/.12);if(!n)continue;for(let j=0;j<=n;j++){const v=c.localToWorld(a.clone().lerp(b,j/n));ray.set(v.clone().addScaledVector(up,.18),up.clone().negate());ray.far=.4;if(!ray.intersectObjects(walkables,false).length)missing.push({segment:i,point:c.worldToLocal(v).toArray()});samples++;}}
   checks[key]={samples,missingCount:missing.length,missing:missing.slice(0,10)};
  }
  const horse=t.scene.getObjectByName('citadel-trojan-horse'),expected=c.localToWorld(new T.Vector3(...city.userData.horseReservation)),harbor=t.scene.getObjectByName('old-harbor-scene');
  t.camera.position.copy(c.localToWorld(new T.Vector3(0,34,170)));t.camera.up.copy(up);t.camera.lookAt(c.localToWorld(new T.Vector3(-6,14,42)));t.camera.fov=52;t.camera.far=3000;t.camera.updateProjectionMatrix();
  return {frame:c.userData.commonSurfaceFrame,corners,checks,frontHarbor:city.userData.frontHarborApproach,horseError:horse.getWorldPosition(new T.Vector3()).distanceTo(expected),horseUp:new T.Vector3(0,1,0).transformDirection(horse.matrixWorld).dot(up),oldHarborUp:new T.Vector3(0,1,0).transformDirection(harbor.matrixWorld).dot(up),scope:'Real build-time gated original game; support rays and actor anchor only. Full equipped traversal and battle not proven.'};
 });report.errors=errors;
 const picks=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,{officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
  const meshes=[];t.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.isOutline&&!o.userData.backlitHighlight)meshes.push(o);});
  t.camera.updateMatrixWorld(true);t.scene.updateMatrixWorld(true);
  const ray=new T.Raycaster();ray.layers.enableAll();
  const hits=[[290,880],[485,805],[1280,875],[1110,857],[725,892]].map(pixel=>{ray.setFromCamera(new T.Vector2(pixel[0]/720-1,1-pixel[1]/450),t.camera);return {pixel,hits:ray.intersectObjects(meshes,false).slice(0,6).map(h=>({name:h.object.name,parent:h.object.parent?.name,altitude:h.point.length()-160-officialOceanLevelAt(h.point),materialType:h.object.material.type,transparent:h.object.material.transparent,depthWrite:h.object.material.depthWrite}))};});
  const o=t.scene.getObjectByName('planet-v8-curved-ocean');return {hits,ocean:{material:o.material.type,opacity:o.material.opacity,transparent:o.material.transparent,depthWrite:o.material.depthWrite,uniforms:Object.fromEntries(Object.entries(o.material.uniforms??{}).filter(([k,v])=>typeof v.value==='number').map(([k,v])=>[k,v.value]))}};
 });
 for(const variant of ['baseline','without-planet','opaque','without-camp']){
  await p.evaluate(variant=>{const t=window.__tm,planet=t.scene.getObjectByName('planet-surface'),o=t.scene.getObjectByName('planet-v8-curved-ocean');planet.visible=variant!=='without-planet';t.scene.traverse(o=>{if(o.name==='camp-flat-patch')o.visible=variant!=='without-camp';});if(variant==='opaque'){o.material.opacity=1;o.material.transparent=false;for(const [key,value]of Object.entries(o.material.uniforms??{}))if(/opacity/i.test(key))value.value=1;o.material.needsUpdate=true;}},variant);
  const image=await p.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/png');});await writeFile(new URL(variant+'.png',out),Buffer.from(image.split(',')[1],'base64'));
 }
 await writeFile(new URL('report.json',out),JSON.stringify(picks,null,2));console.log(JSON.stringify(picks));
}finally{await browser.close();}
