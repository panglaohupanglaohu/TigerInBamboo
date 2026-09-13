import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
const candidate=JSON.parse(await readFile(new URL('surroundings-r04-boarding-survey.json',out),'utf8')).landingCandidate;
const wide=process.argv.includes('--wide');
const motion=process.argv.includes('--motion');
candidate.testMotion=motion;
if(wide)candidate.widthAdjustment=JSON.parse(await readFile(new URL('../../assets/models/optimized/citadel-boarding-r04/wide-transforms.json',import.meta.url),'utf8'));
const tag=wide?'wide-':'', dataTag=wide?'-wide':'';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>window.__pauseStepReview&&cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready'&&window.__tm?.messenger?.landmarks?.canalBoats?.boats?.length,null,{timeout:180000});
 const result=await page.evaluate(async c=>{
  window.__pauseStepReview=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city'),boat=t.messenger.landmarks.canalBoats.boats[0],api=boat.userData.warshipV6;
  boat.position.fromArray(c.position);boat.quaternion.fromArray(c.quaternion);api.setBoardingPitch(c.degrees*Math.PI/180);api.setBoarding(1);api.update(0,0);
  api.nodes.get('add:boarding-hinge').rotateZ(c.roll);
  for(const change of c.widthAdjustment?.changes??[]){const node=api.nodes.get(change.id);if(!node)throw new Error('Missing original boarding node '+change.id);new T.Matrix4().fromArray(change.matrix).decompose(node.position,node.quaternion,node.scale);}
  if(c.widthAdjustment)api.refreshStaticGeometry(Object.fromEntries(c.widthAdjustment.changes.filter(n=>n.geometry).map(n=>[n.id,n.geometry])));
  api.render();
  const material=new T.MeshStandardMaterial({color:0x785438,roughness:.9});
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(c.vertices.flat(),3));geometry.setIndex(c.indices);geometry.computeVertexNormals();
  const shoe=new T.Mesh(geometry,material);shoe.name='citadel-boarding-bearing-candidate';city.add(shoe);
  const step=new T.Mesh(new T.BoxGeometry(.9,.02,.54),material);step.name='citadel-boarding-step-candidate';step.position.set(49.53,c.vertices[0][1]+.01,109.85);city.add(step);
  t.scene.updateMatrixWorld(true);
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const solver=createWarshipWaterRoutes(t.scene,160),bed=t.scene.getObjectByName('planet-surface');bed.geometry.computeBoundingBox();const box=bed.geometry.boundingBox.clone().applyMatrix4(bed.matrixWorld);
  const obstacles=[...solver.obstacles,{root:bed,box,meshes:[{mesh:bed,box}]}];
  const checker=createWarshipClearance(boat,obstacles),clearance=checker.clear(boat.position,boat.quaternion,boat.scale);
  const motionChecks=[];
  if(c.testMotion){
   const {installBoardingCandidate}=await import('/TigerMessenger/src/world/citadel/boardingCandidate.js');
   const identityBefore=api.crewStatus();const controller=installBoardingCandidate(boat,c);
   for(const direction of ['deploy','retract'])for(let i=0;i<=30;i++){
    const progress=direction==='deploy'?i/30:1-i/30;controller.setProgress(progress);boat.updateMatrixWorld(true);
    const check=createWarshipClearance(boat,obstacles).clear(boat.position,boat.quaternion,boat.scale);
    api.nodes.get('add:boarding-hinge').updateMatrix();
    motionChecks.push({direction,progress,hingeMatrix:api.nodes.get('add:boarding-hinge').matrix.toArray(),...check});
   }
   if(JSON.stringify(identityBefore)!==JSON.stringify(api.crewStatus()))throw Error('Boarding motion changed crew identities');
   controller.setProgress(1);
  }
  const surfaces=[shoe,step];city.traverse(n=>{if(n.name==='integrated-quay-strip')surfaces.push(n);});boat.traverse(n=>{if(n.isMesh){if(n.isInstancedMesh)n.computeBoundingSphere();surfaces.push(n);}});
  const up=new T.Vector3(0,1,0).transformDirection(city.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();
  const samples=[],misses=[];
  // Three lanes across the actual board-to-step transition, including the seam.
  for(const x of [49.38,49.53,49.68])for(let z=110.35;z>=109.45;z-=.01){
   const start=city.localToWorld(new T.Vector3(x,c.vertices[0][1]+.55,z));ray.set(start,up.clone().negate());ray.far=.7;
   const hit=ray.intersectObjects(surfaces,false)[0];
   if(!hit){misses.push({x,z});continue;}
   const point=city.worldToLocal(hit.point.clone());samples.push({x,z,y:point.y,object:hit.object.name});
  }
  let maxDrop=0;for(let i=1;i<samples.length;i++)if(samples[i].x===samples[i-1].x)maxDrop=Math.max(maxDrop,Math.abs(samples[i].y-samples[i-1].y));
  const localPose=new T.Matrix4().multiplyMatrices(city.matrixWorld.clone().invert(),boat.matrixWorld),pos=new T.Vector3(),quat=new T.Quaternion(),scale=new T.Vector3();localPose.decompose(pos,quat,scale);
  const line=samples.filter(s=>s.x===49.53),route=[];
  for(let i=0;i<line.length;i++)if(i===0||i===line.length-1||i%15===0||line[i].object!==line[i-1]?.object||line[i].object!==line[i+1]?.object)route.push([line[i].x,line[i].y,line[i].z]);
  const {buildBoardingRoute}=await import('/TigerMessenger/src/world/citadel/boardingRoute.js');
  const boardingRoute=buildBoardingRoute(boat,city,{native:{route}},surfaces).map(p=>p.toArray());
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.camera.position.copy(city.localToWorld(new T.Vector3(55,-1,119)));t.camera.up.copy(up);t.camera.lookAt(city.localToWorld(new T.Vector3(49.6,-5,110.3)));t.camera.fov=45;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
  return {clearance,motionChecks,misses,maxDrop,samples,boardingRoute,native:{position:pos.toArray(),quaternion:quat.toArray(),scale:scale.toArray(),route,frame:'highland-west-city'},step:{center:step.position.toArray(),size:[.9,.02,.54],frame:'highland-west-city'},scope:'Static floor seams; optional sampled engine motion checks external harbor collision and unchanged crew state. Not continuous sweep or production lifecycle.',image:t.renderer.domElement.toDataURL('image/png')};
 },candidate);
 await writeFile(new URL(`surroundings-r04-${tag}step-candidate.png`,out),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
 await writeFile(new URL(`surroundings-r04-${tag}step-review.json`,out),JSON.stringify(result,null,2));
 if(motion)await writeFile(new URL('surroundings-r04-web-motion.json',out),JSON.stringify({checks:result.motionChecks,passed:result.motionChecks.every(c=>c.clear),scope:'31 poses each direction against actual harbor and seabed, original crew state unchanged; not continuous collision proof.'},null,2));
 console.log(JSON.stringify({clearance:result.clearance,misses:result.misses.length,maxDrop:result.maxDrop,samples:result.samples.length}));
 if(!result.clearance.clear||result.misses.length||result.maxDrop>.18||result.motionChecks.some(c=>!c.clear))process.exitCode=1;
 else await writeFile(new URL(`../../godot/data/citadel-boarding-r04${dataTag}-candidate.json`,import.meta.url),JSON.stringify({landing:candidate,...result},null,2));
}finally{await browser.close();}
