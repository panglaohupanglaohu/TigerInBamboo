import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const revision=process.argv.find(a=>/^--revision=\d+$/.test(a))?.split('=')[1]||'9';
const placement=process.argv.includes('--placement');
const massing=process.argv.includes('--massing');
const plaza=process.argv.includes('--plaza');
const port=process.argv.includes("--port");
const tag=port?"placement-r04":plaza?'placement-r03':massing?'placement-r02':placement?'placement-r01':'r'+revision.padStart(2,'0');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage();
 await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelMasterTerrain='+revision+(placement?'&citadelWater=2&citadelFrontGate=1&citadelPlacement=1':'')+(massing?'&citadelMassing=2':'')+(plaza?'&citadelPlaza=3':'')+(port?'&citadelPort=4':''));
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status,null,{timeout:180000});
 const terrain=await p.evaluate(()=>window.__tm.scene.getObjectByName('castleContainer').userData.masterTerrainCandidate);
 if(terrain.status!=='ready')throw new Error('Terrain export rejected: '+terrain.message);
 const manifest=await p.evaluate(async ({placement,massing,plaza})=>{
  const {scene,THREE:T}=window.__tm,c=scene.getObjectByName('castleContainer'),target=new T.Scene();c.updateWorldMatrix(true,true);
  for(const name of ['citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal']){
   const o=c.getObjectByName(name),copy=new T.Mesh(o.geometry,o.material);copy.name=name;
   new T.Matrix4().multiplyMatrices(c.matrixWorld.clone().invert(),o.matrixWorld).decompose(copy.position,copy.quaternion,copy.scale);
   copy.userData={sourceBlender:o.userData.masterTerrainSource};target.add(copy);
  }
  if(placement){
   for(const name of ['old-city-staggered-parcels','citadel-front-harbor','citadel-new-city-backdrop-range',...(massing?['citadel-target-castle-silhouette']:[]),...(plaza?["citadel-middle-terraces",...Array.from({length:3},(_,i)=>"west-city-crown-retaining-wall-"+i),...Array.from({length:3},(_,i)=>"citadel-upper-rock-west-city-crown-retaining-wall-"+i+"-0"),"citadel-processional-stonework","citadel-processional-parapets-1","citadel-processional-parapets-2","west-city-court-entry-pad",...Array.from({length:24},(_,i)=>"west-city-court-stair-0-"+i),"citadel-new-main-gate","citadel-court-structure","west-city-court-upper-landing","west-city-court-upper-link",...Array.from({length:24},(_,i)=>"west-city-court-stair-1-"+i),'west-city-main-tower-entry-bridge','west-city-main-tower-entry-crossing','west-city-main-tower-entry-floor','west-city-plaza-deck','west-city-plaza-foundation','west-city-plaza-paving-ring','citadel-original-horse-terrace','citadel-plaza-edge-garden','citadel-plaza-retaining-wall','citadel-terrace-garden','citadel-mountain-cypress-groves','highland-mountain-slope-vegetation','highland-slope-shrub-vegetation','citadel-terrace-planting']:[])]){
    const original=c.getObjectByName(name),copy=original.clone(true);
    new T.Matrix4().multiplyMatrices(c.matrixWorld.clone().invert(),original.matrixWorld).decompose(copy.position,copy.quaternion,copy.scale);
    target.add(copy);
   }
  }
  const {exportWorldGLB}=await import('/TigerMessenger/tools/world/export_world_glb.js');const result=exportWorldGLB(target,T,{});window.__masterBytes=result.bytes;return result.manifest;
 },{placement,massing,plaza});
 if(plaza){
  const data=await p.evaluate(()=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');c.updateWorldMatrix(true,true);const local=a=>city.worldToLocal(c.localToWorld(new T.Vector3(...a))).toArray();return {frame:'highland-west-city authored local',horse:local(city.userData.horseReservation),points:city.userData.horsePlazaExit.map(local),layout:city.userData.plazaLayout};});
  await writeFile(new URL('../../godot/data/citadel-placement-r03-plaza.json',import.meta.url),JSON.stringify(data,null,2));
 }
 if(placement)await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/placement-r01-report.json',import.meta.url),JSON.stringify(await p.evaluate(()=>window.__tm.scene.getObjectByName('castleContainer').userData.oldCityParcelCandidate),null,2));
 if(port){
  const backdrop=await p.evaluate(()=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),root=c.getObjectByName('citadel-new-city-backdrop-range'),rows=[];c.updateWorldMatrix(true,true);root.traverse(o=>{if(!o.isInstancedMesh)return;const positions=[];for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);positions.push(c.worldToLocal(new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld)).toArray());}rows.push({name:o.name,count:o.count,positions});});return {frame:'castleContainer',forests:rows};});
  await writeFile(new URL('../../godot/data/citadel-backdrop-forests.json',import.meta.url),JSON.stringify(backdrop));
 }
 if(port){
  const ridges=await p.evaluate(()=>{
   const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');c.userData.highlandRidges.update(t.P.timeOfDay);c.updateWorldMatrix(true,true);
   const line=c.userData.highlandRidges.layer,a=line.geometry.attributes.position,m=new T.Matrix4().multiplyMatrices(c.matrixWorld.clone().invert(),line.matrixWorld),positions=[];
   for(let i=0;i<a.count;i++)positions.push(...new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(m).toArray());
   return {frame:'castleContainer',positions,day:'#d6aa58',night:'#cad6e7',source:'actual released mountain convex creases, fixed geometry'};
  });
  await writeFile(new URL('../../godot/data/citadel-fixed-ridges.json',import.meta.url),JSON.stringify(ridges));
 }
 if(port){
  await writeFile(new URL("../../godot/data/citadel-released-lighting.json",import.meta.url),JSON.stringify(await p.evaluate(()=>window.__tm.scene.getObjectByName("castleContainer").userData.releasedLighting),null,2));
  for(const [file,key]of [['common-frame-citadel-placement-r04-front-route.json','frontHarborRoute'],['common-frame-citadel-placement-r05-full-route.json','harborToKeepRoute']])
   await writeFile(new URL('../../godot/data/'+file,import.meta.url),JSON.stringify(await p.evaluate(key=>({frame:'castleContainer',source:'highland-west-city.'+key,points:window.__tm.scene.getObjectByName('highland-west-city').userData[key]}),key),null,2));
 }
 const chunks=[];for(let i=0;i<manifest.bytes;i+=1048576){const bytes=await p.evaluate(start=>{const a=window.__masterBytes.subarray(start,start+1048576);let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);},i);chunks.push(Buffer.from(bytes,'base64'));}
 await writeFile(new URL('../../godot/assets/art-pilots/citadel-master-terrain-'+tag+'.glb',import.meta.url),Buffer.concat(chunks));
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/'+tag+'-godot-export.json',import.meta.url),JSON.stringify(manifest,null,2));console.log(JSON.stringify({bytes:manifest.bytes}));
}finally{await b.close();}
