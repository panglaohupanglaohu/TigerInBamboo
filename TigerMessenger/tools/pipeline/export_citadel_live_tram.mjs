// HISTORICAL CAPTURE ONLY: do not rerun in this CUA-only session.
// Retained to document the shell/headless acquisition already performed.
// Read-only live original global tram export. Never invokes update(), relocates
// actors or edits terrain. Separate headless game instance, no user's camera.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const output=new URL('../../artifacts/pipeline/citadel-live-tram-clearance-20261006/',import.meta.url);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__tm?.targetCityRuntime?.report.installed&&window.__tm?.messenger?.landmarks?.tramSystem,null,{timeout:240000});
 const data=await page.evaluate(()=>{
  const tm=window.__tm,T=tm.THREE,castle=tm.scene.getObjectByName('castleContainer'),sys=tm.messenger.landmarks.tramSystem;castle.updateWorldMatrix(true,true);sys.group.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert();
  function body(vehicle){const inverse=vehicle.matrixWorld.clone().invert(),box=new T.Box3(),v=new T.Vector3();let vertices=0;vehicle.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.isOutline||!mesh.geometry?.attributes.position)return;const position=mesh.geometry.attributes.position,matrix=inverse.clone().multiply(mesh.matrixWorld);for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(matrix);box.expandByPoint(v);vertices++;}});return{name:vehicle.name,min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new T.Vector3()).toArray(),vertices,axis:'vehicle-local +X longitudinal, +Y up, Z width',currentPose:true};}
  const bodyBounds={};for(const [lane,vehicle]of[['red',sys.redTram],['blue',sys.blueTram]])bodyBounds[lane]=[vehicle,...vehicle.userData.freightWagons].map(body);
  const lanes={};for(const[lane,curve]of Object.entries(sys.curves)){const length=curve.getLength(),count=Math.ceil(length),samples=[];for(let i=0;i<count;i++){const u=i/count,world=curve.getPointAt(u),tangent=curve.getTangentAt(u).normalize(),local=world.clone().applyMatrix4(inverse);samples.push({i,u,arcLength:i*length/count,world:world.toArray(),tangent:tangent.toArray(),local:local.toArray(),localTangent:tangent.clone().transformDirection(inverse).toArray()});}lanes[lane]={length,arcStep:length/count,closed:true,samples};}
  const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),g=terrain.geometry;
  return{at:new Date().toISOString(),url:location.href,source:'actual __tm.messenger.landmarks.tramSystem.curves; candidate frontRail excluded',castleMatrix:castle.matrixWorld.toArray(),tramGroupMatrix:sys.group.matrixWorld.toArray(),bodyBounds,vehiclePlacement:{bodyLift:.12,forwardAxis:'local +X; build basis(right,up,curveTangent*direction), rotateY(-PI/2)',directions:{red:1,blue:-1},freightPitch:7},lanes,terrain:{name:terrain.name,matrixWorld:terrain.matrixWorld.toArray(),positions:Array.from(g.attributes.position.array),index:g.index?Array.from(g.index.array):null,userData:JSON.parse(JSON.stringify(g.userData)),meshUserData:JSON.parse(JSON.stringify(terrain.userData))},runtime:{oldCity:tm.targetCityRuntime.report.cityDetail.oldCity.geometry.version,terrain:tm.targetCityRuntime.report.cityDetail.terrainContract,frontRail:tm.targetCityRuntime.report.cityDetail.frontRail},limitations:['Body bounds use actual current locomotive/wagon subtree vertices; future robot/cargo configurations and all moving running-gear extrema are not proven.','About 1m arc-length samples are discrete, not continuous swept triangle clearance.']};
 });
 data.errors=errors;const terrain=data.terrain;delete data.terrain;
 await writeFile(new URL('global-tram-samples.json',output),JSON.stringify(data,null,2));await writeFile(new URL('actual-final-terrain.json',output),JSON.stringify(terrain));
 console.log(JSON.stringify({output:output.pathname,errors,lanes:Object.fromEntries(Object.entries(data.lanes).map(([k,v])=>[k,{length:v.length,samples:v.samples.length,arcStep:v.arcStep}])),castleMatrix:data.castleMatrix,body:data.bodyBounds.red.map(b=>({name:b.name,min:b.min,max:b.max}))}));
}finally{await browser.close();}
