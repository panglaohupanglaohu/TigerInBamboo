import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.tramSystem,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks;
  // Rejected navigation-span prototype, loaded only in this disposable test.
  // Production keeps its original bridge until a shore-to-shore route passes.
  const prototype=await(await fetch('/TigerMessenger/godot/data/crystal-navigation-span.json')).json();
  const span=new T.Group();span.name='crystal-lake-navigation-span';span.userData.navigationOpening=prototype.opening;t.scene.add(span);
  for(const item of prototype.meshes){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(item.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(item.normals,3));if(item.indices)g.setIndex(item.indices);const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:new T.Color(...item.color),side:T.DoubleSide}));mesh.name=item.name;mesh.applyMatrix4(new T.Matrix4().fromArray(item.matrix));span.add(mesh);}
  const openingDir=new T.Vector3(...prototype.opening.direction);
  for(const o of l.tramSystem.group.children){if(!o.isMesh)continue;o.geometry.computeBoundingBox();const size=o.geometry.boundingBox.getSize(new T.Vector3());if(Math.abs(size.x-.55)<.025&&Math.abs(size.z-.55)<.025&&o.position.clone().normalize().angleTo(openingDir)*160<12)o.visible=false;}
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const {createStaticMeshRaycast}=await import('/TigerMessenger/src/world/staticMeshRaycast.js');
  t.scene.updateMatrixWorld(true);
  const center=new T.Vector3(...span.userData.navigationOpening.direction),anchor=center.clone().multiplyScalar(l.citySeaLake.surfaceR),trackTangent=l.tramSystem.curve.getTangentAt(.293212890625).normalize();
  const forward=trackTangent.clone().cross(center).normalize();
  const meshes=[];const area=new T.Box3().setFromCenterAndSize(anchor,new T.Vector3(90,90,90));
  const boat=l.canalBoats.boats[0];
  t.scene.traverseVisible(o=>{if(!o.isMesh||o.userData.isOutline||o.userData.backlitHighlight||o.parent?.isMesh)return;let n=o;while(n){if(n===l.tramSystem.redTram||n===l.tramSystem.blueTram||n===boat||l.canalBoats.boats.includes(n)||/water|ocean|cloud|sky|city-sea-lake|bubble-pod|courier|messenger|flock|bird|reflection/i.test(n.name))return;n=n.parent;}const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m?.transparent&&m.opacity<.99))return;o.geometry.computeBoundingBox();if(o.isInstancedMesh)o.computeBoundingBox();const box=(o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld);if(box.intersectsBox(area))meshes.push({mesh:o,box});});
  const box=new T.Box3();for(const m of meshes)box.union(m.box);const groups=[{box,meshes}];
  const bed=createStaticMeshRaycast(t.scene.getObjectByName('planet-surface'));
  const tests=[];
  for(const frame of [60,75,90,105]){
   boat.userData.warshipV6.pose(frame,frame,0);boat.userData.warshipV6.render();const checker=createWarshipClearance(boat,groups);
   for(let step=-14;step<=14;step++){
    const up=anchor.clone().addScaledVector(forward,step).normalize(),position=up.clone().multiplyScalar(l.citySeaLake.surfaceR+.12),fwd=forward.clone().addScaledVector(up,-forward.dot(up)).normalize(),z=fwd.clone().cross(up).normalize(),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(fwd,up,z));
    const result=checker.clear(position,q,boat.scale);const hit=bed.firstHit(new T.Ray(up.clone().multiplyScalar(200),up.clone().negate()),200);
    tests.push({frame,step,...result,depth:hit?l.citySeaLake.surfaceR-hit.point.length():null});
   }
  }
  const exported=[];span.traverseVisible(o=>{if(!o.isMesh||o.userData.isOutline||o.parent?.isMesh)return;exported.push({name:o.name,positions:Array.from(o.geometry.attributes.position.array),normals:Array.from(o.geometry.attributes.normal.array),indices:o.geometry.index?Array.from(o.geometry.index.array):null,matrix:o.matrixWorld.toArray(),color:o.material.color.toArray()});});
  // Inspection pose only: this does not install an autonomous ship route.
  boat.position.copy(center).multiplyScalar(l.citySeaLake.surfaceR+.12);
  boat.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward,center,forward.clone().cross(center).normalize()));
  document.querySelector('#intro')?.remove();
  t.camera.position.copy(anchor).addScaledVector(center,80).addScaledVector(forward,-20).addScaledVector(trackTangent,6);
  t.camera.up.copy(center);t.camera.lookAt(anchor.clone().addScaledVector(center,14));t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
  return {opening:span.userData.navigationOpening,obstacleMeshes:meshes.length,tests,exported,source:'src/world/tramSystem.js',scope:'Four real rowing poses, 29 crossing positions, triangle intersections against nearby visible opaque meshes excluding named vehicles, water and effects; centerline planet depth only. Finite samples, not three-port sailing or exhaustive clearance.',passed:tests.every(x=>x.clear&&x.depth>=1.348)};
 });
 await page.screenshot({path:new URL('../../artifacts/pipeline/moebius-crystal-city-target/passage-inspection.png',import.meta.url).pathname});
 delete report.exported;
 report.errors=errors;report.passed&&=errors.length===0;
 await writeFile(new URL('../../artifacts/pipeline/moebius-crystal-city-target/passage-check.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,tests:report.tests.length,failures:report.tests.filter(x=>!x.clear||x.depth<1.348).slice(0,8),errors}));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
