import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const dir=new URL('../../artifacts/pipeline/moebius-crystal-city-target/',import.meta.url);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(time=>{if(!window.__crystalTestFrozen)cb(time)});});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&tour=crystal-mother-port',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.crystalMotherPort,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  window.__crystalTestFrozen=true;const t=window.__tm,T=t.THREE,p=t.messenger.landmarks.crystalMotherPort,b=p.boat;
  t.camera.position.copy(p.root.localToWorld(new T.Vector3(-16,18,18)));t.distanceCulling?.update(3);
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  t.scene.updateMatrixWorld(true);const box=new T.Box3(),meshes=[],checks=[];
  t.scene.traverseVisible(o=>{if(!o.isMesh||o.userData.isOutline||o.userData.backlitHighlight||o.parent?.isMesh)return;for(let n=o;n;n=n.parent){if(n===b||t.messenger.landmarks.canalBoats.boats.includes(n)||/water|ocean|cloud|sky|city-sea-lake|bubble-pod|courier|messenger|flock|bird|reflection/i.test(n.name))return;}const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m?.transparent&&m.opacity<.99))return;const mb=new T.Box3().setFromObject(o);meshes.push({mesh:o,box:mb});box.union(mb);});
  for(const frame of [60,75,90,105]){b.userData.warshipV6.pose(frame,frame,0);b.userData.warshipV6.render();const c=createWarshipClearance(b,[{box,meshes}]);for(const pose of p.source.poses)checks.push({frame,shipTriangles:c.triangleCount,...c.clear(new T.Vector3(...pose.position),new T.Quaternion(...pose.quaternion),b.scale)});}
  b.position.fromArray(p.source.berthPosition);b.quaternion.fromArray(p.source.berthQuaternion);b.userData.warshipV6.setBoarding(1);b.userData.warshipV6.update(0,false);t.scene.updateMatrixWorld(true);
  const support=[],ray=new T.Raycaster();const supportMeshes=[...p.surfaces];b.traverse(o=>{if(o.isMesh)supportMeshes.push(o)});
  for(let i=1;i<p.boardingRoute.length;i++)for(let j=0;j<=12;j++){const v=p.boardingRoute[i-1].clone().lerp(p.boardingRoute[i],j/12),up=v.clone().normalize();ray.set(v.clone().addScaledVector(up,.4),up.clone().negate());ray.far=.8;const hits=ray.intersectObjects(supportMeshes,false);support.push({segment:i,u:j/12,clear:!!hits.length,gap:hits[0]?.distance-.4,mesh:hits[0]?.object.name});}
  const {resolveCollisions}=await import('/TigerMessenger/src/world/collision.js');
  const foot=p.root.localToWorld(new T.Vector3(3.57,p.low,6.1)),vel=new T.Vector3(),actor={onGround:true};const liftChecks=[];
  p.update(0);for(let k=0;k<=1560;k++){const time=k/60;p.update(time);resolveCollisions(foot,vel,1/60,p.records,actor,()=>{},null,()=>126);if(k%60===0)liftChecks.push({time,local:p.root.worldToLocal(foot.clone()).toArray(),lift:p.lift.position.y,onGround:actor.onGround});}
  p.update(26);
  const key=(code,type='keydown')=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
  t.player.riding=false;t.player.position.copy(p.boardingRoute[0]);t.player.velocity.set(0,0,0);key('KeyF');
  for(let i=0;i<600;i++)t.boatRide.update(1/60);
  const boarding={riding:t.boatRide.isRiding(),deckGap:t.player.position.distanceTo(p.boardingRoute.at(-1))};
  key('KeyS');for(let i=0;i<240;i++)t.boatRide.update(1/60);key('KeyS','keyup');const outward=b.userData.portNavigation.progress;
  key('KeyF');const awayKeptAboard=t.boatRide.isRiding();
  key('KeyW');for(let i=0;i<300;i++)t.boatRide.update(1/60);key('KeyW','keyup');const returned=b.userData.portNavigation.atBerth();
  key('KeyF');for(let i=0;i<600;i++)t.boatRide.update(1/60);const dismount={riding:t.boatRide.isRiding(),quayGap:t.player.position.distanceTo(p.boardingRoute[0])};

  const walkStart=p.root.localToWorld(new T.Vector3(3.57,p.high,5)),walkEnd=p.landing.clone(),walkObstacles=[];
  const walkDir=walkEnd.clone().sub(walkStart).normalize(),walkUp=p.root.localToWorld(new T.Vector3(0,1,0)).sub(p.root.position).normalize(),walkSide=walkUp.clone().cross(walkDir).normalize();
  for(const height of [.2,.8,1.5])for(const side of [-.3,0,.3]){ray.set(walkStart.clone().addScaledVector(walkUp,height).addScaledVector(walkSide,side),walkDir);ray.far=walkStart.distanceTo(walkEnd);for(const item of meshes){if(!ray.ray.intersectsBox(item.box))continue;const hit=ray.intersectObject(item.mesh,false)[0];if(hit)walkObstacles.push({height,side,mesh:item.mesh.name,at:hit.point.toArray()});}}
  p.update(26);p.root.updateMatrixWorld(true);
  const exported=p.surfaces.map(mesh=>{const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);return {name:mesh.name,positions:Array.from(g.attributes.position.array),normals:Array.from(g.attributes.normal.array),indices:Array.from(g.index.array),color:mesh.material.color.toArray(),dynamic:mesh.parent===p.lift,collision:p.records.some(r=>r.mesh===mesh)};});
  const exportData={parts:exported,low:p.low,high:p.high,up:new T.Vector3(0,1,0).applyQuaternion(p.root.quaternion).toArray(),boatPosition:p.source.berthPosition,boatQuaternion:p.source.berthQuaternion,boatScale:1.84};
  const center=p.root.localToWorld(new T.Vector3(2,4,3)),up=center.clone().normalize();
  t.camera.position.copy(p.root.localToWorld(new T.Vector3(-16,18,18)));t.camera.up.copy(up);t.camera.lookAt(center);t.camera.updateProjectionMatrix();t.distanceCulling?.update(3);document.querySelector('#intro')?.remove();t.renderer.render(t.scene,t.camera);
  return {exportData,walkObstacles,boarding,outward,awayKeptAboard,returned,dismount,obstacles:meshes.length,image:t.renderer.domElement.toDataURL(),liftChecks,low:p.low,high:p.high,landing:p.root.worldToLocal(p.landing.clone()).toArray(),surfaces:p.surfaces.length,checks,failures:checks.filter(c=>!c.clear),support,supportFailures:support.filter(s=>!s.clear),errors:[]};
 });
 await writeFile(new URL('../../godot/data/crystal-mother-port.json',import.meta.url),JSON.stringify(report.exportData));delete report.exportData;report.errors=errors;await writeFile(new URL('mother-port-preview.png',dir),Buffer.from(report.image.split(',')[1],'base64'));delete report.image;await writeFile(new URL('mother-port-check.json',dir),JSON.stringify(report,null,2));report.passed=report.checks.every(c=>c.clear&&c.shipTriangles>80000)&&!report.supportFailures.length&&!report.walkObstacles.length&&report.boarding.riding&&report.boarding.deckGap<.05&&report.outward<.9&&report.awayKeptAboard&&report.returned&&!report.dismount.riding&&report.dismount.quayGap<.05&&!errors.length;await writeFile(new URL('mother-port-check.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.failures.length,walkObstacles:report.walkObstacles,boarding:report.boarding,outward:report.outward,dismount:report.dismount}));if(!report.passed)process.exitCode=1;
} finally {await browser.close();}
