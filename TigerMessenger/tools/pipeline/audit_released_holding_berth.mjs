import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const base=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
const market=process.argv.includes('--market'),cargo=market||process.argv.includes('--cargo'),tag=market?'surroundings-r03':cargo?'surroundings-r02':'surroundings-r01';
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready'&&window.__tm?.messenger?.landmarks?.canalBoats?.boats?.length,null,{timeout:180000});
 const report=await page.evaluate(async(cargo)=>{
  const t=window.__tm,T=t.THREE,boat=t.messenger.landmarks.canalBoats.boats.find(b=>b.userData.oceanPatrol),city=t.scene.getObjectByName('highland-west-city'),castle=t.scene.getObjectByName('castleContainer');
  if(!boat.userData.harborHoldingBerth)throw Error('Released holding berth not loaded');
  const start=boat.position.clone();
  // Exercise the real patrol updater for one minute, including oar rest updates.
  for(let i=0;i<600;i++)t.messenger.landmarks.canalBoats.update(.1);
  const drift=boat.position.distanceTo(start);t.scene.updateMatrixWorld(true);
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const solver=createWarshipWaterRoutes(t.scene,160),bed=t.scene.getObjectByName('planet-surface');bed.geometry.computeBoundingBox();
  const box=bed.geometry.boundingBox.clone().applyMatrix4(bed.matrixWorld);
  const checker=createWarshipClearance(boat,[...solver.obstacles,{root:bed,box,meshes:[{mesh:bed,box}]}]);
  const clearance=checker.clear(boat.position,boat.quaternion,boat.scale);
  const cargoRoot=city.getObjectByName('citadel-front-harbor-cargo'),cargoEvidence=[];
  if(cargo){
   if(!cargoRoot||cargoRoot.children.length!==14)throw Error('Expected 14 original cargo units');
   const inverse=city.matrixWorld.clone().invert();
   for(const crate of cargoRoot.children){
    const bounds=new T.Box3();crate.traverse(m=>{if(m.isMesh){m.geometry.computeBoundingBox();bounds.union(m.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld)));}});
    const clearGate=bounds.max.x<50.5||bounds.min.x>57.5;
    const clearLane=bounds.max.z<109;
    if(!clearGate||!clearLane||bounds.min.z<107.75)throw Error('Cargo crosses wall or reserved route: '+crate.name);
    cargoEvidence.push({name:crate.name,min:bounds.min.toArray(),max:bounds.max.toArray(),clearGate,clearLane});
   }
  }
  const local=new T.Matrix4().multiplyMatrices(castle.matrixWorld.clone().invert(),boat.matrixWorld),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();local.decompose(pos,q,scale);
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;
  t.camera.position.copy(city.localToWorld(new T.Vector3(...(cargo?[77,7,134]:[98,25,151]))));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);t.camera.lookAt(city.localToWorld(new T.Vector3(...(cargo?[54,-3,106]:[54,0,102]))));t.camera.fov=55;t.camera.updateProjectionMatrix();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));t.renderer.render(t.scene,t.camera);
  return {ship:boat.name,originalSlotIdentity:t.messenger.landmarks.canalBoats.boats[0]===boat,drift,clearance,cargoEvidence,triangles:checker.triangleCount,water:solver.surface(boat.position),native:{frame:'castleContainer',position:pos.toArray(),quaternion:q.toArray(),scale:scale.toArray(),sourceSlot:boat.name,boardingConnected:false},scope:'Actual original boat after 60 seconds of real patrol updates, current resting mesh versus current authored obstacles and seabed. Not continuous docking, boarding or cargo unloading.',image:t.renderer.domElement.toDataURL('image/png')};
 },cargo);
 await writeFile(new URL(tag+'-web.png',base),Buffer.from(report.image.split(',')[1],'base64'));delete report.image;
 report.errors=errors;
 await writeFile(new URL(tag+'-berth.json',base),JSON.stringify(report,null,2));
 if(report.drift>1e-6||!report.clearance.clear||errors.length)throw Error(JSON.stringify(report));
 await writeFile(new URL('../../godot/data/citadel-released-holding-berth.json',import.meta.url),JSON.stringify(report.native,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
