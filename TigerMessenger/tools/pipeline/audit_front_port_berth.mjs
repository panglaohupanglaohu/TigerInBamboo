import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-front-port-berth/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>window.__pausePortAudit&&cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.canalBoats?.boats?.length,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  window.__pausePortAudit=true;
  const tm=window.__tm,T=tm.THREE,city=tm.scene.getObjectByName('highland-west-city'),front=city.getObjectByName('citadel-front-harbor');
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const solver=createWarshipWaterRoutes(tm.scene,160),dockY=front.userData.frontHarborApproach.dockY;
  const ships=[tm.messenger.landmarks.boat,...tm.messenger.landmarks.canalBoats.boats].filter(Boolean);
  const inventory=ships.map(b=>{const p=b.getWorldPosition(new T.Vector3());b.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(b);return {name:b.name,uuid:b.uuid,kind:b.userData.kind,parent:b.parent?.name,scale:b.scale.toArray(),frontLocal:front.worldToLocal(p.clone()).toArray(),distanceToQuay:p.distanceTo(front.localToWorld(new T.Vector3(37.5,dockY,96))),worldBounds:box.getSize(new T.Vector3()).toArray(),patrol:!!b.userData.canalPatrol};});
  const samples=[];
  for(const x of [30,34,38,42,46])for(const z of [95,96,97,99,102,106,110]){
   const target=front.localToWorld(new T.Vector3(x,dockY,z)),s=solver.surface(target);
   samples.push({x,z,...s,depth:s?s.water-s.ground:null,quayAboveWater:s?target.length()-s.water:null});
  }
  const boat=ships.find(b=>b.userData.oceanPatrol);
  const started=performance.now();
  // Existing live-boat geometry is read by the solver; no ship is moved or cloned.
  const dock=solver.dock(boat,front.localToWorld(new T.Vector3(38,dockY,95.8)),[],{shoreName:'front-harbor-walkable',maxDistance:1,shoreStep:.5,approachOffsets:[3,6],headings:[new T.Vector3(1,0,0).transformDirection(front.matrixWorld),new T.Vector3(-1,0,0).transformDirection(front.matrixWorld)]});
  let playback={checked:0,failures:[]},candidate=null;
  const saved={position:boat.position.clone(),quaternion:boat.quaternion.clone()};
  if(dock.valid){
   const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
   const guard=createWarshipClearance(boat,solver.obstacles);
   for(let i=0;i<=100;i++){solver.place(boat,dock.approach,i/100);const hit=guard.clear(boat.position,boat.quaternion,boat.scale);playback.checked++;if(!hit.clear)playback.failures.push({progress:i/100,...hit});}
   candidate={shipName:boat.name,scale:boat.scale.toArray(),frontLocalPosition:front.worldToLocal(dock.position.clone()).toArray(),frontLocalQuaternion:front.getWorldQuaternion(new T.Quaternion()).invert().multiply(dock.quaternion).toArray(),boardingAngle:dock.angle,shoreLocal:front.worldToLocal(dock.shorePoint.clone()).toArray(),entryLocal:front.worldToLocal(solver.position(dock.entry)).toArray()};
  }
  boat.position.copy(saved.position);boat.quaternion.copy(saved.quaternion);
  tm.cameraRig.update=()=>{};tm.P.daySpeed=0;tm.P.timeOfDay=.85;
  tm.camera.position.copy(front.localToWorld(new T.Vector3(65,16,124)));tm.camera.up.set(0,1,0).transformDirection(front.matrixWorld);tm.camera.lookAt(front.localToWorld(new T.Vector3(35,1,91)));tm.camera.fov=48;tm.camera.updateProjectionMatrix();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));tm.renderer.render(tm.scene,tm.camera);
  const image=tm.renderer.domElement.toDataURL('image/png');let candidateImage=null,boarding=null;
  if(dock.valid){
   boat.position.copy(dock.position);boat.quaternion.copy(dock.quaternion);
   const api=boat.userData.warshipV6;api.setBoardingPitch(dock.angle);api.setBoarding(1);api.update(0,0);boat.updateMatrixWorld(true);
   const hinge=api.nodes.get('add:boarding-hinge'),length=api.boardingContract.length;
   const tip=hinge.localToWorld(new T.Vector3(0,0,length)),lanes=[];
   for(const x of [-.16,0,.16]){const edge=hinge.localToWorld(new T.Vector3(x,0,length)),s=solver.surface(edge);lanes.push({x,support:s?.object,error:s?edge.length()-s.ground:null});}
   boarding={rootPoint:api.boardingContract.rootPoint,actualTip:tip.toArray(),solverTip:dock.shorePoint.toArray(),tipError:tip.distanceTo(dock.shorePoint),actualPitch:hinge.rotation.x,lanes};
   tm.renderer.render(tm.scene,tm.camera);candidateImage=tm.renderer.domElement.toDataURL('image/png');
   api.setBoarding(0);api.setBoardingPitch(null);api.update(0,0);boat.position.copy(saved.position);boat.quaternion.copy(saved.quaternion);
  }
  return {inventory,samples,dockY,stats:solver.stats,berth:{...dock,elapsedMs:performance.now()-started},playback,candidate,boarding,image,candidateImage,scope:'Original live boat geometry at the front quay; bounded berth/approach search and actual deployed hinge only. Candidate screenshot temporarily poses the SAME original ship, then restores it. No production fleet relocation, unloading or Godot integration.'};
 });
 await writeFile(new URL('current-port.png',out),Buffer.from(report.image.split(',')[1],'base64'));delete report.image;
 if(report.candidateImage)await writeFile(new URL('candidate-port.png',out),Buffer.from(report.candidateImage.split(',')[1],'base64'));delete report.candidateImage;
 await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
 await writeFile(new URL('berth-candidate.json',out),JSON.stringify({frame:'citadel-front-harbor',status:'candidate-not-integrated',pose:report.candidate,boarding:report.boarding,scope:report.scope},null,2));
 assert.equal(report.berth.valid,true);
 assert.equal(report.playback.failures.length,0);
 assert.ok(report.boarding.tipError<1e-5,'Actual Blender board tip must agree with the solver');
 assert.ok(report.boarding.lanes.every(l=>l.support==='front-harbor-walkable'&&Math.abs(l.error)<.04),'Board tip lanes must meet the actual quay');
 console.log(JSON.stringify({boats:report.inventory.length,berthValid:report.berth.valid,playback:report.playback,candidate:report.candidate,boarding:report.boarding},null,2));
} finally {await browser.close();}
