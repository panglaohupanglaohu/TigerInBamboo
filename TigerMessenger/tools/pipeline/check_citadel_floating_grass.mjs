import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const out=new URL('../../artifacts/pipeline/citadel-floating-grass/',import.meta.url).pathname;
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']}),p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});await p.waitForTimeout(7500);
await p.evaluate(()=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.camera.position.copy(c.localToWorld(new T.Vector3(-15,95,210)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(4,10,25)));t.camera.fov=55;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);document.querySelectorAll('body > :not(canvas)').forEach(e=>{if(e.tagName!=='SCRIPT')e.style.visibility='hidden';});});
const frames=[];
for(const [name,time]of [['noon',.5]]){
 await p.evaluate(time=>{__tm.P.timeOfDay=time;__tm.dayNight.update(.001);},time);await p.waitForTimeout(500);
 const data=await p.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});writeFileSync(out+'final-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));
 const metrics=await p.evaluate(async()=>{const durations=[];let prev=performance.now();for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>9)durations.push(now-prev);prev=now;}durations.sort((a,b)=>a-b);return {medianMs:durations[Math.floor(durations.length*.5)],p95Ms:durations[Math.floor(durations.length*.95)],render:__tm.renderer.info.render};});frames.push({name,time,...metrics});
}
const planting=await p.evaluate(()=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),s=c.userData.mountainStudy,rocks=s.surfaces.map(n=>c.getObjectByName(n)),ray=new T.Raycaster(),materials=[],checks=[];ray.layers.enableAll();ray.far=200;c.updateWorldMatrix(true,true);
for(const plant of [...s.planting.trees,...s.planting.shrubs]){const q=new T.Vector3(...plant.world),up=q.clone().normalize();ray.set(up.clone().multiplyScalar(290),up.clone().negate());const hit=ray.intersectObjects(rocks,false)[0];checks.push({gap:hit?q.length()-hit.point.length():null,source:plant.source});}
c.getObjectByName('citadel-study-mountain-planting').traverse(o=>{if(o.isMesh)materials.push({name:o.name,color:o.material.color.getHexString(),protected:o.userData.ashleyPalette===1,instances:o.count});});const legacy=[];c.traverse(o=>{if(o.name==='highland-slope-grass-billboards')legacy.push({name:o.name,visible:o.visible,count:o.count});});return {legacy,retired:c.getObjectByName('citadel-study-mountain-planting').userData.planting.retired,checks,materials,trees:s.planting.trees.length,shrubs:s.planting.shrubs.length};});
writeFileSync(out+'final-check.json',JSON.stringify({time:new Date().toISOString(),frames,planting,errors},null,2));console.log(JSON.stringify({frames,trees:planting.trees,shrubs:planting.shrubs,materials:planting.materials,missingGround:planting.checks.filter(x=>x.gap===null).length,maxRootGap:Math.max(...planting.checks.map(x=>x.gap)),errors}));await b.close();
