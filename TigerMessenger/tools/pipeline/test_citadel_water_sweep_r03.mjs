import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:1500,height:1000}});p.on('pageerror',e=>console.error(e.message));
 await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>window.__pauseWaterSweep&&cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelMasterTerrain=9&citadelWater=2&citadelFrontGate=1');
 await p.waitForFunction(()=>window.__tm?.messenger?.landmarks?.canalBoats?.boats?.length&&window.__tm.scene.getObjectByName('planet-surface')?.userData.citadelFrontHarborSeabed,null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const tm=window.__tm,T=tm.THREE,city=tm.scene.getObjectByName('highland-west-city');tm.scene.updateMatrixWorld(true);
  const {CITADEL_HARBOR_WATER_PLAN:plan}=await import('/TigerMessenger/src/world/citadel/harborWaterPlan.js');
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const {orientWarship}=await import('/TigerMessenger/src/world/warshipNavigation.js');
  const solver=createWarshipWaterRoutes(tm.scene,160),boat=tm.messenger.landmarks.canalBoats.boats.find(b=>b.userData.oceanPatrol);
  if(!boat)throw new Error('Original ocean warship missing');
  const bed=tm.scene.getObjectByName('planet-surface');bed.geometry.computeBoundingBox();
  const box=bed.geometry.boundingBox.clone().applyMatrix4(bed.matrixWorld);
  const groups=[...solver.obstacles,{root:bed,box,meshes:[{mesh:bed,box}]}];
  const checker=createWarshipClearance(boat,groups),frame=new T.Group(),poses=[],failures=[];
  function test(stage,x,z,hx,hz){
   const d=city.localToWorld(new T.Vector3(x,0,z)).normalize(),position=solver.position(d);
   const heading=new T.Vector3(hx,0,hz).transformDirection(city.matrixWorld);
   if(!position){failures.push({stage,x,z,reason:'no-water'});return;}
   orientWarship(frame,d,heading);const hit=checker.clear(position,frame.quaternion,boat.scale);
   const item={stage,x,z,position:position.toArray(),quaternion:frame.quaternion.toArray(),clear:hit.clear};poses.push(item);
   if(!hit.clear)failures.push({...item,hit});
  }
  for(let j=1;j<plan.approach.length;j++){
   const [ax,az]=plan.approach[j-1],[bx,bz]=plan.approach[j],n=Math.ceil(Math.hypot(bx-ax,bz-az)/.75);
   for(let i=0;i<=n;i++)test('approach',ax+(bx-ax)*i/n,az+(bz-az)*i/n,bx-ax,bz-az);
  }
  // Full rotation at the turning area's centre; separately follow its boundary.
  for(let i=0;i<72;i++){
   const a=i*Math.PI/36,[x,z]=plan.turning.center;
   test('turn-in-place',x,z,Math.cos(a),Math.sin(a));
   test('turning-circle',x+plan.turning.radius*Math.cos(a),z+plan.turning.radius*Math.sin(a),-Math.sin(a),Math.cos(a));
  }
  for(let z=119;z>=plan.holdingBerth.center[1];z-=.5)test('quay-approach',plan.holdingBerth.center[0],z,...plan.holdingBerth.heading);
  for(let i=0;i<72;i++)test('berth-alignment',54,119,Math.cos(i*Math.PI/36),Math.sin(i*Math.PI/36));
  return {ship:boat.name,triangles:checker.triangleCount,scale:boat.scale.toArray(),poses,failures,passed:failures.length===0,scope:'Original visible vessel geometry at current pose, triangle-edge crossing against authored obstacles AND actual seabed; .75m approach samples and 5-degree turn samples. Not continuous collision proof, boarding, rowing animation sweep or cargo unloading.'};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-water-plan/r03-sweep.json',import.meta.url),JSON.stringify(report,null,2));
 const pose=report.poses.filter(p=>p.stage==='quay-approach'&&p.clear).at(-1);
 if(pose){
  const png=await p.evaluate(async pose=>{const tm=window.__tm,T=tm.THREE,city=tm.scene.getObjectByName('highland-west-city'),boat=tm.messenger.landmarks.canalBoats.boats.find(b=>b.userData.oceanPatrol);window.__pauseWaterSweep=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));boat.position.fromArray(pose.position);boat.quaternion.fromArray(pose.quaternion);boat.updateMatrixWorld(true);tm.cameraRig.update=()=>{};tm.camera.position.copy(city.localToWorld(new T.Vector3(105,30,160)));tm.camera.up.set(0,1,0).transformDirection(city.matrixWorld);tm.camera.lookAt(city.localToWorld(new T.Vector3(50,-2,113)));tm.camera.fov=55;tm.camera.updateProjectionMatrix();tm.renderer.render(tm.scene,tm.camera);return tm.renderer.domElement.toDataURL('image/png');},pose);
  await writeFile(new URL('../../artifacts/pipeline/citadel-water-plan/r03-holding-berth.png',import.meta.url),Buffer.from(png.split(',')[1],'base64'));
 }
 console.log(JSON.stringify({ship:report.ship,triangles:report.triangles,poses:report.poses.length,failures:report.failures.length,firstFailures:report.failures.slice(0,3)}));
}finally{await browser.close();}
