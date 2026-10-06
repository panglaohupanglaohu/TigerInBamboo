import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const stage=process.argv[2]||'r00',round=process.argv[3]||'0';
const out=new URL('../../artifacts/pipeline/citadel-city-colours/',import.meta.url).pathname;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error'||e.text().includes('[citadel]'))warnings.push(e.text().slice(0,1000));});
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&timeOfDay=.5&citadelColour='+round);
await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});
await page.waitForTimeout(7000);
await page.evaluate(()=>{const t=__tm;t.cameraRig.update=()=>{};t.P.weather=0;t.P.daySpeed=0;t.P.timeOfDay=.5;t.dayNight.update(.0001);document.querySelectorAll('body > :not(canvas)').forEach(e=>{if(e.tagName!=='SCRIPT')e.style.visibility='hidden';});});
const views=[['overview',[-15,95,210],[4,10,25],55],['old-mountain',[-88,58,112],[-25,23,-5],48],['new-facade',[101,56,114],[70,18,50],43],['new-mountain',[172,77,122],[83,20,-4],50]];
for(const [name,position,target,fov] of views){
 await page.evaluate(({position,target,fov})=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');t.camera.position.copy(c.localToWorld(new T.Vector3(...position)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...target)));t.camera.fov=fov;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling.recollect();t.distanceCulling.update(3);},{position,target,fov});
 await page.waitForTimeout(350);
 const shot=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});
 writeFileSync(out+stage+'-'+name+'.png',Buffer.from(shot.split(',')[1],'base64'));
}
const report=await page.evaluate(()=>{
 const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),inventory=[];let invalid=0;
 c.updateWorldMatrix(true,true);
 c.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position||o.userData.isOutline)return;
  if(true){
   const p=o.geometry.attributes.position;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))invalid++;
   const box=new T.Box3().setFromObject(o);const b=new T.Box3();for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])b.expandByPoint(c.worldToLocal(new T.Vector3(x,y,z)));
   inventory.push({name:o.name,parents:[o.parent?.name,o.parent?.parent?.name],sources:o.userData.materialSourceNames,colourRole:o.userData.cityColour,vertices:p.count,index:o.geometry.index?.count,visible:o.visible,bounds:[b.min.toArray(),b.max.toArray()],material:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,color:m.color?.getHexString(),emission:m.emissiveIntensity}))});
  }
 });
 return {study:c.userData.cityColourStudy||null,invalid,inventory,render:t.renderer.info.render,memory:t.renderer.info.memory,bay:c.userData.bayLayout};
});
writeFileSync(out+stage+'.json',JSON.stringify({time:new Date().toISOString(),round,report,errors,warnings},null,2));
console.log(JSON.stringify({stage,study:report.study,invalid:report.invalid,render:report.render,errors,warnings}));await browser.close();
