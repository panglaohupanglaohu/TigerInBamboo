import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-water-plan/',import.meta.url);
const waterRevision=process.argv.includes('--water=2')?'2':'1';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelMasterTerrain=9'+(waterRevision==='2'?'&citadelWater=2':''));
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.canalBoats?.boats?.length&&window.__tm.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const tm=window.__tm,T=tm.THREE,city=tm.scene.getObjectByName('highland-west-city');city.updateWorldMatrix(true,true);
  const {CITADEL_HARBOR_WATER_PLAN:plan}=await import('/TigerMessenger/src/world/citadel/harborWaterPlan.js');
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const solver=createWarshipWaterRoutes(tm.scene,160),samples=[];
  const sample=(x,z)=>{const s=solver.surface(city.localToWorld(new T.Vector3(x,0,z)));const floor=s?Math.max(s.ground,s.seabed):-Infinity;
   return {x,z,water:s?.water??null,ground:Number.isFinite(s?.ground)?s.ground:null,seabed:Number.isFinite(s?.seabed)?s.seabed:null,object:s?.object??null,depth:s&&Number.isFinite(floor)?s.water-floor:null};};
  for(let z=plan.basin.zMin;z<=plan.basin.zMax;z+=3)for(let x=plan.basin.xMin;x<=plan.basin.xMax;x+=3)samples.push(sample(x,z));
  const lane=[];
  for(let j=1;j<plan.approach.length;j++){
   const [ax,az]=plan.approach[j-1],[bx,bz]=plan.approach[j],length=Math.hypot(bx-ax,bz-az),n=Math.ceil(length);
   for(let i=0;i<=n;i++)for(const side of [-plan.turnClearanceRadius,0,plan.turnClearanceRadius])lane.push(sample(ax+(bx-ax)*i/n-(bz-az)/length*side,az+(bz-az)*i/n+(bx-ax)/length*side));
  }
  const bedEdit=tm.scene.getObjectByName('planet-surface').userData.citadelFrontHarborSeabed;
  const requiredDepth=bedEdit?plan.designDepth:plan.minimumDepth;
  const failures=lane.filter(s=>s.depth===null||s.depth<requiredDepth);
  const boats=[tm.messenger.landmarks.boat,...tm.messenger.landmarks.canalBoats.boats].filter(Boolean);
  const boat=boats.find(b=>b.userData.oceanPatrol);
  let vessel=null;
  if(boat){
   boat.updateWorldMatrix(true,true);const inverse=boat.matrixWorld.clone().invert(),bounds=new T.Box3(),v=new T.Vector3();
   boat.traverseVisible(o=>{if(!o.isMesh||!o.geometry?.attributes.position||o.layers.mask===0)return;const transform=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)bounds.expandByPoint(v.fromBufferAttribute(a,i).applyMatrix4(transform));});
   vessel={name:boat.name,scale:boat.scale.toArray(),localBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},lowerEnvelopeBelowRoot:-bounds.min.y*boat.scale.y,scope:'Whole current vessel geometry including oars and occupants; conservative envelope, not hydrodynamic draft'};
  }
  return {plan,samples,lane,failures,vessel,bedEdit,requiredDepth,stats:solver.stats,scope:'Actual rendered sea and highest authored obstacle or planet seabed; three parallel lane samples, not swept hull or full turning-circle clearance. Gate and ships not moved.'};
 });
 await writeFile(new URL('r0'+waterRevision+'-survey.json',out),JSON.stringify(report,null,2));
 if(waterRevision==='2'){
  const bed=await page.evaluate(()=>{const o=window.__tm.scene.getObjectByName('planet-surface'),g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;const result={source:'8931 R09 terrain / water R02 actual planet-surface',positions:Array.from(g.attributes.position.array),normals:Array.from(g.attributes.normal.array),colors:Array.from(g.attributes.color.array),matrix:o.matrixWorld.toArray()};if(g!==o.geometry)g.dispose();return result;});
  await writeFile(new URL('../../godot/data/citadel-front-seabed-r02.json',import.meta.url),JSON.stringify(bed));
 }
 await writeFile(new URL('../../godot/data/citadel-harbor-water-plan.json',import.meta.url),JSON.stringify({...report.plan,measurement:{samples:report.samples.length,laneSamples:report.lane.length,failures:report.failures.length},integrated:false},null,2));
 console.log(JSON.stringify({samples:report.samples.length,laneSamples:report.lane.length,failures:report.failures.length,firstFailure:report.failures[0]}));
}finally{await browser.close();}
