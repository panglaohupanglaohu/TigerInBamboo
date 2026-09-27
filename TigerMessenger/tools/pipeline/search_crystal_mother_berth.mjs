import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.moebius?.grand,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,l=t.messenger.landmarks,sea=l.citySeaLake,grand=l.moebius.grand,boat=l.canalBoats.boats[0];t.scene.updateMatrixWorld(true);
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const {createStaticMeshRaycast}=await import('/TigerMessenger/src/world/staticMeshRaycast.js');
  const waterQueries=[t.scene.getObjectByName('planet-v8-curved-ocean'),sea.group.children[0]].map(o=>({name:o.name||'city-lake',query:createStaticMeshRaycast(o)}));
  const meshes=[];
  t.scene.traverseVisible(o=>{if(!o.isMesh||o.userData.isOutline||o.userData.backlitHighlight||o.parent?.isMesh)return;let n=o;while(n){if(n===l.tramSystem.redTram||n===l.tramSystem.blueTram||l.canalBoats.boats.includes(n)||/water|ocean|cloud|sky|city-sea-lake|bubble-pod|courier|messenger|flock|bird|reflection/i.test(n.name))return;n=n.parent;}const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m?.transparent&&m.opacity<.99))return;o.geometry.computeBoundingBox();if(o.isInstancedMesh)o.computeBoundingBox();const box=(o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld);meshes.push({mesh:o,box,query:!o.isInstancedMesh&&o.geometry.attributes.position.count>3000?createStaticMeshRaycast(o):null});});
  const allBox=new T.Box3();for(const m of meshes)allBox.union(m.box);
  boat.userData.warshipV6.pose(75,75,0);boat.userData.warshipV6.render();const checker=createWarshipClearance(boat,[{box:allBox,meshes}]);
  const ray=new T.Raycaster();ray.layers.enableAll();ray.far=250;
  function sample(dir){ray.set(dir.clone().multiplyScalar(250),dir.clone().negate());let water=-Infinity,waterSource=null,ground=-Infinity,groundSource=null;
   for(const item of waterQueries){const hit=item.query.firstHit(ray.ray,250);if(hit&&hit.point.length()>water){water=hit.point.length();waterSource=item.name;}}
   for(const item of meshes){if(!ray.ray.intersectsBox(item.box))continue;const hit=item.query?item.query.firstHit(ray.ray,250):ray.intersectObject(item.mesh,false)[0];if(hit&&hit.point.length()>ground){ground=hit.point.length();groundSource=item.mesh.name||item.mesh.parent?.name;}}
   return {direction:dir.toArray(),water:Number.isFinite(water)?water:null,ground:Number.isFinite(ground)?ground:null,waterSource,groundSource,depth:water-ground};}
  const up=grand.dir.clone(),east=new T.Vector3(0,1,0).cross(up).normalize(),north=up.clone().cross(east).normalize(),rows=[],candidates=[];
  for(let radius=8;radius<=80;radius+=8)for(let j=0;j<24;j++){
   const a=j*Math.PI*2/24,tangent=east.clone().multiplyScalar(Math.cos(a)).addScaledVector(north,Math.sin(a)),dir=up.clone().multiplyScalar(Math.cos(radius/160)).addScaledVector(tangent,Math.sin(radius/160)).normalize(),s=sample(dir);
   const row={radius,bearing:j,...s};rows.push(row);if(!s.water||!s.ground||s.depth<1.5)continue;
   let shoreDir,shore,shoreDistance;
   for(const distance of [8,16,24]){const trial=dir.clone().multiplyScalar(s.water).addScaledVector(up.clone().addScaledVector(dir,-up.dot(dir)).normalize(),distance).normalize(),value=sample(trial);if(value.ground&&value.water&&value.ground>=value.water+.2&&value.ground<=value.water+6){shoreDir=trial;shore=value;shoreDistance=distance;break;}}
   if(!shore)continue;
   const toShore=shoreDir.clone().addScaledVector(dir,-shoreDir.dot(dir)).normalize(),fwd=toShore.clone().cross(dir).normalize(),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(fwd,dir,fwd.clone().cross(dir))),pos=dir.clone().multiplyScalar(s.water+.12),collision=checker.clear(pos,q,boat.scale);
   const waterFootprint=[];for(const dx of [-6,0,6])for(const dz of [-4,0,4]){const d=pos.clone().addScaledVector(fwd,dx).addScaledVector(toShore,dz).normalize();let r=-Infinity;const waterRay=new T.Ray(d.clone().multiplyScalar(250),d.clone().negate());for(const w of waterQueries){const hit=w.query.firstHit(waterRay,250);if(hit)r=Math.max(r,hit.point.length());}waterFootprint.push(r);}
   const waterVariation=Math.max(...waterFootprint)-Math.min(...waterFootprint);
   candidates.push({...row,shore,shoreDistance,waterVariation,boatQuaternion:q.toArray(),collision,towerHeightAboveShore:grand.root-shore.ground});
  }
  const detailed=[];
  for(const candidate of candidates.filter(c=>c.collision.clear&&c.waterVariation<.15).sort((a,b)=>a.radius-b.radius).slice(0,3)){
   const direction=new T.Vector3(...candidate.direction),q=new T.Quaternion(...candidate.boatQuaternion),fwd=new T.Vector3(1,0,0).applyQuaternion(q),start=direction.clone().multiplyScalar(candidate.water),movement=[];
   for(const frame of [60,75,90,105]){boat.userData.warshipV6.pose(frame,frame,0);boat.userData.warshipV6.render();const full=createWarshipClearance(boat,[{box:allBox,meshes}]);
    for(let distance=-16;distance<=16;distance+=2){const dir=start.clone().addScaledVector(fwd,distance).normalize(),s=sample(dir),forward=fwd.clone().addScaledVector(dir,-fwd.dot(dir)).normalize(),quat=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(forward,dir,forward.clone().cross(dir)));const result=full.clear(dir.clone().multiplyScalar((s.water??candidate.water)+.12),quat,boat.scale);movement.push({frame,distance,depth:s.depth,water:s.water,waterSource:s.waterSource,...result});}
   }
   const shore=new T.Vector3(...candidate.shore.direction).multiplyScalar(candidate.shore.ground+.25),towardShore=shore.clone().normalize().addScaledVector(grand.dir,-shore.clone().normalize().dot(grand.dir)).normalize(),towerEnd=grand.dir.clone().multiplyScalar(grand.root).addScaledVector(towardShore,grand.r+3).normalize().multiplyScalar(grand.root+.25),walk=[];
   for(let i=0;i<=24;i++){const desired=shore.clone().lerp(towerEnd,i/24),s=sample(desired.clone().normalize());walk.push({t:i/24,position:desired.toArray(),plannedRadius:desired.length(),...s,obstruction:s.ground!==null?s.ground-desired.length():null});}
   const approaches=[];
   const toward=new T.Vector3(...candidate.shore.direction).addScaledVector(direction,-new T.Vector3(...candidate.shore.direction).dot(direction)).normalize();
   // +Z is the existing boarding side: aim that side toward the shore.
   const arrivalForward=direction.clone().cross(toward).normalize();
   for(let offshore=0;offshore<12;offshore++)for(const along of [-1,1]){
    const angle=offshore*Math.PI/6,endForward=arrivalForward.clone().multiplyScalar(along),p0=start.clone().addScaledVector(arrivalForward,Math.cos(angle)*24).addScaledVector(toward,Math.sin(angle)*24),p1=p0.clone().lerp(start,.35),p2=start.clone().addScaledVector(endForward,-8),curve=new T.CubicBezierCurve3(p0,p1,p2,start),checks=[];
    boat.userData.warshipV6.pose(75,75,0);boat.userData.warshipV6.render();const swept=createWarshipClearance(boat,[{box:allBox,meshes}]);
    for(let i=0;i<=24;i++){const u=i/24,dir=curve.getPoint(u).normalize(),s=sample(dir),forward=curve.getTangent(u).addScaledVector(dir,-curve.getTangent(u).dot(dir)).normalize(),quat=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(forward,dir,forward.clone().cross(dir))),position=dir.clone().multiplyScalar((s.water??candidate.water)+.12),collision=s.depth>=1.5&&Math.abs(s.water-candidate.water)<.15?swept.clear(position,quat,boat.scale):{clear:false,mesh:'water-depth-or-gradient'};checks.push({u,...collision,depth:s.depth,position:position.toArray(),quaternion:quat.toArray()});if(!collision.clear)break;}
    const fullPoseChecks=[];
    if(checks.length===25&&checks.every(x=>x.clear))for(const frame of [60,90,105]){boat.userData.warshipV6.pose(frame,frame,0);boat.userData.warshipV6.render();const full=createWarshipClearance(boat,[{box:allBox,meshes}]);for(const check of checks){const result=full.clear(new T.Vector3(...check.position),new T.Quaternion(...check.quaternion),boat.scale);fullPoseChecks.push({frame,u:check.u,...result});}}
    let minTurnRadius=Infinity;for(let i=1;i<checks.length-1;i++){const a=new T.Vector3(...checks[i-1].position),b=new T.Vector3(...checks[i].position),c=new T.Vector3(...checks[i+1].position),ab=b.clone().sub(a),ac=c.clone().sub(a),cross=ab.clone().cross(ac).length();if(cross>1e-8)minTurnRadius=Math.min(minTurnRadius,ab.length()*b.distanceTo(c)*ac.length()/(2*cross));}
    approaches.push({startBearingIndex:offshore,headingSign:along,offshore,along,controlPoints:[p0,p1,p2,start].map(p=>p.toArray()),passed:checks.length===25&&checks.every(x=>x.clear)&&fullPoseChecks.every(x=>x.clear),minTurnRadius,checks,fullPoseChecks});
   }
   detailed.push({radius:candidate.radius,bearing:candidate.bearing,movement,walk,approaches,boatMovementPass:movement.every(x=>x.clear&&x.depth>=1.5&&Math.abs(x.water-candidate.water)<.15),simpleWalkwayPass:walk.every(x=>x.obstruction!==null&&x.obstruction<.3)});
  }
  return {source:'production 8931 isolated scene, no saves',mother:{name:grand.group.name,dir:grand.dir.toArray(),root:grand.root,height:grand.h,radius:grand.r},otherHalls:l.moebius.crystals.map(c=>({name:c.group.name,dir:c.dir.toArray(),root:c.root})),samples:rows,candidates,detailed,obstacleMeshes:meshes.length};
 });
 report.errors=errors;await writeFile(new URL('../../artifacts/pipeline/moebius-crystal-city-target/mother-berth-search.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({mother:report.mother,samples:report.samples.length,staticCandidates:report.candidates.length,detailed:report.detailed.map(d=>({radius:d.radius,bearing:d.bearing,boatMovementPass:d.boatMovementPass,simpleWalkwayPass:d.simpleWalkwayPass,approaches:d.approaches.map(a=>({offshore:a.offshore,along:a.along,passed:a.passed,failure:a.passed?null:a.checks.at(-1)}))})),errors}));
}finally{await browser.close();}
