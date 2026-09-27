import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.tramSystem,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks,sea=l.citySeaLake,boat=l.canalBoats.boats[0];t.scene.updateMatrixWorld(true);
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const {createStaticMeshRaycast}=await import('/TigerMessenger/src/world/staticMeshRaycast.js');
  const bed=createStaticMeshRaycast(t.scene.getObjectByName('planet-surface'));
  const meshes=[];
  t.scene.traverseVisible(o=>{if(!o.isMesh||o.userData.isOutline||o.userData.backlitHighlight||o.parent?.isMesh)return;let n=o;while(n){if(n===l.tramSystem.redTram||n===l.tramSystem.blueTram||l.canalBoats.boats.includes(n)||/tram-pier-|crystal-passage-support|water|ocean|cloud|sky|city-sea-lake|bubble-pod|courier|messenger|flock|bird|reflection/i.test(n.name))return;n=n.parent;}if(o.parent===l.tramSystem.group){o.geometry.computeBoundingBox();const size=o.geometry.boundingBox.getSize(new T.Vector3());if(Math.abs(size.x-.55)<.025&&Math.abs(size.z-.55)<.025&&size.y>.5)return;}const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m?.transparent&&m.opacity<.99))return;o.geometry.computeBoundingBox();if(o.isInstancedMesh)o.computeBoundingBox();const box=(o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld);meshes.push({mesh:o,box});});
  const box=new T.Box3();for(const m of meshes)box.union(m.box);boat.userData.warshipV6.pose(75,75,0);boat.userData.warshipV6.render();
  const checker=createWarshipClearance(boat,[{box,meshes}]),rows=[];
  for(let k=0;k<=26;k++){
   const u=.245+k*.005,track=l.tramSystem.curve.getPointAt(u),center=track.clone().normalize();if(center.angleTo(sea.centerDir)>.48||track.length()<sea.surfaceR+10)continue;
   const anchor=center.clone().multiplyScalar(sea.surfaceR),forward=l.tramSystem.curve.getTangentAt(u).cross(center).normalize();const checks=[];
   for(const step of [-14,0,14]){const up=anchor.clone().addScaledVector(forward,step).normalize(),pos=up.clone().multiplyScalar(sea.surfaceR+.12),f=forward.clone().addScaledVector(up,-forward.dot(up)).normalize(),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f,up,f.clone().cross(up)));const bh=bed.firstHit(new T.Ray(up.clone().multiplyScalar(210),up.clone().negate()),210);const depth=bh?sea.surfaceR-bh.point.length():null;const result=depth!==null&&depth>=1.348?checker.clear(pos,q,boat.scale):{clear:false,mesh:'shallow-or-dry'};checks.push({step,depth,...result});if(!result.clear)break;}
   rows.push({u,direction:center.toArray(),checks,passed:checks.length===3&&checks.every(x=>x.clear)});
  }
  return {hypothesis:'Narrow tram piers omitted only in this search, requiring a supported navigation span before release. All other visible opaque nearby meshes tested. Three sample positions, one rowing pose; candidates need full verification.',obstacleMeshes:meshes.length,rows};
 });
 await writeFile(new URL('../../artifacts/pipeline/moebius-crystal-city-target/passage-search.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({candidates:report.rows.filter(x=>x.passed),failed:report.rows.filter(x=>!x.passed).map(x=>({u:x.u,blocker:x.checks.at(-1)?.mesh}))}));
}finally{await browser.close();}
