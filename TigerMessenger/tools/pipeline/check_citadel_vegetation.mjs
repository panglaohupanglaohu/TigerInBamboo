import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const stage=process.argv[2]||'after',round='13';
const out=new URL('../../artifacts/pipeline/citadel-vegetation/',import.meta.url).pathname;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error'||e.text().includes('[citadel]'))warnings.push(e.text().slice(0,1000));});
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&timeOfDay=.5&citadelMountain='+round+'&citadelLandform='+(stage==='before'?'0':'1'));
await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});
await page.waitForTimeout(7000);
await page.evaluate(()=>{const t=__tm;t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.5;t.dayNight.update(.0001);document.querySelectorAll('body > :not(canvas)').forEach(e=>{if(e.tagName!=='SCRIPT')e.style.visibility='hidden';});});
const views=[['overview',[-15,95,210],[4,10,25],55],['old-mountain',[-88,58,112],[-25,23,-5],48],['bay-ridge',[9,28,104],[8,26,-15],47],['new-mountain',[172,77,122],[83,20,-4],50]];
for(const [name,position,target,fov] of views){
 await page.evaluate(({position,target,fov})=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');t.camera.position.copy(c.localToWorld(new T.Vector3(...position)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...target)));t.camera.fov=fov;t.camera.far=4000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);t.distanceCulling.recollect();t.distanceCulling.update(3);},{position,target,fov});
 await page.waitForTimeout(350);
 const shot=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});
 writeFileSync(out+stage+'-'+name+'.png',Buffer.from(shot.split(',')[1],'base64'));
}
// Separate rail-eye and unclouded geometry views for the final candidate.
if(stage!=='before'){
 for(const [name,u]of [['old-shore',.842],['bay',.872],['back-coast',.899]]){
  await page.evaluate(u=>{const t=__tm,T=t.THREE,curve=t.messenger.landmarks.tramSystem.curves.red,q=curve.getPointAt(u),up=q.clone().normalize(),f=curve.getTangentAt(u);t.camera.position.copy(q).addScaledVector(up,3.8);t.camera.up.copy(up);t.camera.lookAt(q.clone().addScaledVector(f,35).addScaledVector(up,4));t.camera.fov=65;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);},u);
  await page.waitForTimeout(250);const img=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});writeFileSync(out+stage+'-rail-'+name+'.png',Buffer.from(img.split(',')[1],'base64'));
 }
 await page.evaluate(()=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');t.scene.traverse(o=>{if(o.name==='citadel-ridge-flow-clouds')o.visible=false;});t.camera.position.copy(c.localToWorld(new T.Vector3(9,28,104)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(8,26,-15)));t.camera.fov=47;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);});
 const img=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});writeFileSync(out+stage+'-bare-ridge.png',Buffer.from(img.split(',')[1],'base64'));
}
const report=await page.evaluate(()=>{
 const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),inventory=[];let invalid=0;
 c.updateWorldMatrix(true,true);
 c.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position||o.userData.isOutline)return;
  if(/mountain|ravine|backdrop-ridge|rock-shoulder|cliff-seal/.test(o.name)){
   const p=o.geometry.attributes.position;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))invalid++;
   const box=new T.Box3().setFromObject(o);const b=new T.Box3();for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])b.expandByPoint(c.worldToLocal(new T.Vector3(x,y,z)));
   inventory.push({name:o.name,vertices:p.count,index:o.geometry.index?.count,visible:o.visible,bounds:[b.min.toArray(),b.max.toArray()],material:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,color:m.color?.getHexString(),emission:m.emissiveIntensity}))});
  }
 });
 return {study:c.userData.mountainStudy||null,invalid,inventory,render:t.renderer.info.render,memory:t.renderer.info.memory,bay:c.userData.bayLayout};
});
const clearance=await page.evaluate(async()=>{
 const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
 const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),sys=t.messenger.landmarks.tramSystem;
 c.updateWorldMatrix(true,true);const meshes=[],walk=[];c.traverse(o=>{if(o.isMesh&&o.geometry?.attributes.position&&!o.userData.isOutline){
  if(/^citadel-oskar-grid-mountain-surface|^highland-ravine-wall|^citadel-backdrop-ridge|^new-city-rock-shoulder|^citadel-coastal-cliff-seal|^citadel-study-rock-crags|^old-shore-blender-rock-support|^citadel-study-cypress|^citadel-study-understory/.test(o.name))meshes.push(o);
  if(o.userData.westCityWalkable||/bridge-deck|stair|town-terrace-.*floor|foundation|harbor-deck|highland-gate/.test(o.name))walk.push(o);
 }});
 const boxes=meshes.map(o=>({o,box:new T.Box3().setFromObject(o)})),ray=new T.Raycaster();ray.layers.enableAll();ray.far=2;
 const inv=c.matrixWorld.clone().invert(),hits=[];let tests=0,minSeaClearance=Infinity,wetTrackSamples=0;
 for(const [lane,curve]of Object.entries(sys.curves))for(let i=0;i<3600;i++){
  const q=curve.getPointAt(i/3600),local=q.clone().applyMatrix4(inv);if(local.x< -180||local.x>180||local.z< -100||local.z>180||local.y< -75)continue;
  if(local.y< -28&&Math.abs(local.x)<160&&Math.abs(local.z+5)<90){const clearance=q.length()-160-officialOceanLevelAt(q);minSeaClearance=Math.min(minSeaClearance,clearance);if(clearance<.35)wetTrackSamples++;}
  const up=q.clone().normalize(),f=curve.getTangentAt(i/3600).normalize(),side=new T.Vector3().crossVectors(up,f).normalize(),near=boxes.filter(m=>m.box.distanceToPoint(q)<15).map(m=>m.o);
  for(const lateral of[-2.6,0,2.6])for(const height of[.5,3,10]){
   ray.set(q.clone().addScaledVector(up,height).addScaledVector(side,lateral).addScaledVector(f,-1),f);tests++;
   const h=ray.intersectObjects(near,false);if(h.length)hits.push({lane,i,height,lateral,name:h[0].object.name,distance:h[0].distance});
  }
 }
 // Hash every existing walkable mesh in world space: ground/stairs must not
 // move when applying rock finishes and decorative fractured buttresses.
 let hash=2166136261,vertices=0;for(const o of walk){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);for(const n of v.toArray()){hash=Math.imul(hash^Math.round(n*1e4),16777619)>>>0;}vertices++;}}
 return {round:c.userData.mountainStudy?.round??0,tests,hits,minSeaClearance,wetTrackSamples,walk:{meshes:walk.length,vertices,hash},rocks:meshes.length};
});
const plantCheck=await page.evaluate(()=>{const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),s=c.userData.mountainStudy,rocks=s.surfaces.map(n=>c.getObjectByName(n)),ray=new T.Raycaster();ray.layers.enableAll();ray.far=200;const checks=[];for(const plant of [...s.planting.trees,...s.planting.shrubs]){const q=new T.Vector3(...plant.world),up=q.clone().normalize();ray.set(up.clone().multiplyScalar(290),up.clone().negate());const hit=ray.intersectObjects(rocks,false)[0];checks.push(hit?q.length()-hit.point.length():null);}return {count:checks.length,missing:checks.filter(x=>x===null).length,maxGap:Math.max(...checks.filter(x=>x!==null))};});
writeFileSync(out+stage+'.json',JSON.stringify({time:new Date().toISOString(),round,report,clearance,plantCheck,errors,warnings},null,2));
console.log(JSON.stringify({stage,clearance:{...clearance,hits:clearance.hits.slice(0,5),totalHits:clearance.hits.length},plantCheck,study:report.study,invalid:report.invalid,render:report.render,errors,warnings}));await browser.close();
