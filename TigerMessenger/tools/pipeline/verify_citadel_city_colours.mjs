import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const out=new URL('../../artifacts/pipeline/citadel-city-colours/',import.meta.url).pathname;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelColour=0');await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});await page.waitForTimeout(7500);
await page.evaluate(()=>{const t=__tm;t.cameraRig.update=()=>{};t.P.weather=0;t.P.daySpeed=0;t.P.timeOfDay=.5;t.dayNight.update(.001);document.querySelectorAll('body > :not(canvas)').forEach(e=>{if(e.tagName!=='SCRIPT')e.style.visibility='hidden';});});
const views=[['overview',[-15,95,210],[4,10,25],55],['old',[-88,58,112],[-25,23,-5],48],['new',[101,56,114],[70,18,50],43]];
async function capture(stage){for(const[name,position,target,fov]of views){await page.evaluate(({position,target,fov})=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');t.camera.position.copy(c.localToWorld(new T.Vector3(...position)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...target)));t.camera.fov=fov;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);},{position,target,fov});await page.waitForTimeout(400);const data=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png')});writeFileSync(out+stage+'-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));}}
await capture('before-final');
const checks=await page.evaluate(async()=>{
const {applyCityColourStudy}=await import('/TigerMessenger/src/world/citadel/cityColourStudy.js'),t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');c.updateWorldMatrix(true,true);
const state=[];t.scene.traverse(o=>{if(o.isMesh)state.push({o,geometry:o.geometry,material:o.material,matrix:o.matrix.clone()});});
const hash=()=>{let n=2166136261,count=0;for(const {o}of state){if(!o.userData.westCityWalkable)continue;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);for(const x of v.toArray())n=Math.imul(n^Math.round(x*1e4),16777619)>>>0;count++;}}return {hash:n,vertices:count};};
const before=hash();history.replaceState(null,'','?autostart=1&citadelColour=1');applyCityColourStudy(c);
let geometryChanges=0,transformChanges=0,outsideChanges=0,changed=0;
for(const row of state){const o=row.o;if(o.geometry!==row.geometry)geometryChanges++;if(!o.matrix.equals(row.matrix))transformChanges++;if(o.material!==row.material){changed++;let inCity=false;for(let a=o;a;a=a.parent)if(a===c)inCity=true;if(!inCity)outsideChanges++;}}
const materials=state.map(({o})=>o.material);applyCityColourStudy(c);const repeatedChanges=state.filter(({o},i)=>o.material!==materials[i]&&!Array.isArray(o.material)).length;
return {before,after:hash(),geometryChanges,transformChanges,outsideChanges,changed,repeatedChanges,study:c.userData.cityColourStudy};});
await capture('after-final');
for(const[name,time]of [['dusk',.72],['night',.9]]){await page.evaluate(time=>{__tm.P.timeOfDay=time;__tm.dayNight.update(.001)},time);await capture(name);}
writeFileSync(out+'verification.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));await browser.close();
