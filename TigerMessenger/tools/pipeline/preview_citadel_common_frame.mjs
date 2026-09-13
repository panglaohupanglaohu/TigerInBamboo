import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-common-frame/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.route('**/frontHarborApproach.js',r=>r.fulfill({contentType:'application/javascript',body:'export function buildFrontHarborApproach(){}'}));await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=t.scene.getObjectByName('highland-west-city');t.scene.updateMatrixWorld(true);
  const {createOceanHeightSampler}=await import('/TigerMessenger/src/world/citadel/oceanSurface.js');
  const radius=city.getObjectByName('citadel-new-city-backdrop-range').userData.oceanConformance.radius;
  c.updateMatrix();const original=c.matrix.clone();const rows=[];
  for(const [px,pz] of [[-20,35],[-15,50],[-10,55]]){
   c.matrix.copy(original);c.matrix.decompose(c.position,c.quaternion,c.scale);t.scene.updateMatrixWorld(true);
   const sea=createOceanHeightSampler(c,radius),center=new T.Vector3(px,sea(px,pz),pz),up=c.localToWorld(center.clone()).normalize().transformDirection(c.matrixWorld.clone().invert());
   const side=new T.Vector3(1,0,0).addScaledVector(up,-up.x).normalize(),forward=new T.Vector3().crossVectors(side,up).normalize();
   const delta=new T.Matrix4().makeBasis(side,up,forward);delta.setPosition(center);delta.multiply(new T.Matrix4().makeTranslation(-px,0,-pz));
   c.matrix.copy(original).multiply(delta);c.matrix.decompose(c.position,c.quaternion,c.scale);t.scene.updateMatrixWorld(true);
   const newSea=createOceanHeightSampler(city,radius),corners=[44.85,76].flatMap(x=>[59.5,83.5].map(z=>({x,z,clearance:4-newSea(x,z)})));
   const oldSea=createOceanHeightSampler(c,radius);
   rows.push({pivot:[px,pz],delta:delta.toArray(),corners,oldCoreClearance:5-oldSea(-52,0),oldHarborClearance:7.7-oldSea(-72,32)});
  }
  c.matrix.copy(original);c.matrix.decompose(c.position,c.quaternion,c.scale);t.scene.updateMatrixWorld(true);
  return rows;
 });await writeFile(new URL('sampled-frames.json',out),JSON.stringify(report,null,2));
 await p.unroute('**/frontHarborApproach.js');
 const applied=await p.evaluate(async row=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=t.scene.getObjectByName('highland-west-city');
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;c.updateWorldMatrix(true,true);
  const before=c.matrixWorld.clone(),delta=new T.Matrix4().fromArray(row.delta),worldDelta=before.clone().multiply(delta).multiply(before.clone().invert());
  const external=[];
  for(const name of ['citadel-trojan-horse','old-harbor-scene']){
   const obj=t.scene.getObjectByName(name);if(!obj)continue;let parent=obj.parent,inside=false;while(parent){if(parent===c)inside=true;parent=parent.parent;}if(inside)continue;
   const local=obj.parent.matrixWorld.clone().invert().multiply(worldDelta).multiply(obj.parent.matrixWorld);obj.applyMatrix4(local);external.push(name);
  }
  c.updateMatrix();c.matrix.multiply(delta);c.matrix.decompose(c.position,c.quaternion,c.scale);t.scene.updateMatrixWorld(true);
  const radius=city.getObjectByName('citadel-new-city-backdrop-range').userData.oceanConformance.radius;
  const {shapeFrontCoastalSlope}=await import('/TigerMessenger/src/world/citadel/frontCoastalSlope.js');
  const {shapeWestCoastalSlope}=await import('/TigerMessenger/src/world/citadel/westCoastalSlope.js');
  const {alignCitadelPerimeterToOcean}=await import('/TigerMessenger/src/world/citadel/perimeterOceanAlignment.js');
  const {buildFrontHarborApproach}=await import('/TigerMessenger/src/world/citadel/frontHarborApproach.js?common-frame-candidate=1');
  const {alignCitadelHarborToOcean}=await import('/TigerMessenger/src/world/citadel/harborOceanAlignment.js');
  const {conformNewCityBackdropToOcean}=await import('/TigerMessenger/src/world/citadel/newCityBackdrop.js');
  const {groundCitadelCanopies}=await import('/TigerMessenger/src/world/citadel/canopyGrounding.js');
  shapeWestCoastalSlope(c,radius);shapeFrontCoastalSlope(c,radius);const perimeter=alignCitadelPerimeterToOcean(c,radius);
  for(const name of ['citadel-harbor-boarding-landing','citadel-harbor-architecture','citadel-harbor-reflections'])city.getObjectByName(name)?.removeFromParent();
  alignCitadelHarborToOcean(c,radius);buildFrontHarborApproach(c,radius);conformNewCityBackdropToOcean(city,radius);const planting=groundCitadelCanopies(c,radius);
  t.scene.updateMatrixWorld(true);
  t.camera.position.copy(c.localToWorld(new T.Vector3(0,34,170)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(-6,14,42)));t.camera.fov=52;t.camera.far=3000;t.camera.updateProjectionMatrix();
  const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();
  const walkables=[];city.traverseVisible(o=>{if(o.isMesh&&o.userData.westCityWalkable)walkables.push(o);});
  const checks={};
  for(const key of ['walkRoute','harborRoute','frontHarborRoute']){
   const route=city.userData[key],missing=[];let samples=0;
   for(let i=1;i<route.length;i++){const a=new T.Vector3(...route[i-1]),b=new T.Vector3(...route[i]),n=Math.ceil(a.distanceTo(b)/.12);for(let j=0;j<=n;j++){const v=c.localToWorld(a.clone().lerp(b,j/n));ray.set(v.clone().addScaledVector(up,.18),up.clone().negate());ray.far=.4;if(!ray.intersectObjects(walkables,false).length)missing.push({segment:i,point:c.worldToLocal(v).toArray()});samples++;}}
   checks[key]={samples,missing:missing.slice(0,15),missingCount:missing.length};
  }
  return {pivot:row.pivot,external,frontHarbor:city.userData.frontHarborApproach,harbor:city.userData.harborOceanAlignment,perimeter,planting,checks,production:false,fullActorCollision:false};
 },report[2]);
 await p.waitForTimeout(1200);const img=await p.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/png');});await writeFile(new URL('common-candidate.png',out),Buffer.from(img.split(',')[1],'base64'));await writeFile(new URL('interfaces.json',out),JSON.stringify(applied,null,2));console.log(JSON.stringify(applied));
}finally{await b.close();}
