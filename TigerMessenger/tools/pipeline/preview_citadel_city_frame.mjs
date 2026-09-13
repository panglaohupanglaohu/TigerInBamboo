import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-city-frame/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');t.scene.updateMatrixWorld(true);
  const {createOceanHeightSampler}=await import('/TigerMessenger/src/world/citadel/oceanSurface.js');
  const radius=city.getObjectByName('citadel-new-city-backdrop-range').userData.oceanConformance.radius;
  const sea=createOceanHeightSampler(city,radius);
  const profiles=[71.5,63.5,55.5,51.5].map(z=>({centerZ:z,corners:[44.85,76].flatMap(x=>[z-12,z+12].map(zz=>({x,z:zz,sea:sea(x,zz),clearanceAtY4:4-sea(x,zz)})))}));
  const center=new T.Vector3(60,sea(60,71.5)+6,71.5),world=city.localToWorld(center.clone());
  const up=world.clone().normalize().transformDirection(city.matrixWorld.clone().invert());
  const side=new T.Vector3(1,0,0).addScaledVector(up,-up.x).normalize();const forward=new T.Vector3().crossVectors(side,up).normalize();
  const frame=new T.Matrix4().makeBasis(side,up,forward);frame.setPosition(center);
  const corners=[-15.15,16].flatMap(x=>[-12,12].map(z=>{const v=new T.Vector3(x,0,z).applyMatrix4(frame);return {point:v.toArray(),sea:sea(v.x,v.z),verticalClearance:v.y-sea(v.x,v.z)};}));
  const childRows=city.children.map(o=>({name:o.name,position:o.position.toArray(),isGroup:o.isGroup,sourceId:o.userData.sourceId}));
  return {radius,profiles,candidate:{type:'independent tangent plaza only; main castle untouched',center:center.toArray(),up:up.toArray(),frame:frame.toArray(),corners},childRows};
 });await writeFile(new URL('candidate-plan.json',out),JSON.stringify(report,null,2));
 await p.evaluate(()=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.camera.position.copy(c.localToWorld(new T.Vector3(0,34,170)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(-6,14,42)));t.camera.fov=52;t.camera.far=3000;t.camera.updateProjectionMatrix();});
 for(const phase of ['before','candidate']){
  if(phase==='candidate')await p.evaluate(frameArray=>{
   const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city'),frame=new T.Matrix4().fromArray(frameArray);
   const delta=frame.clone().multiply(new T.Matrix4().makeTranslation(-60,-4,-71.5));
   const kept=[],moved=[];
   const exclude=o=>/^(citadel-new-city-backdrop-range|citadel-target-hillside-houses|west-city-water-channel|citadel-front-harbor|citadel-harbor-watergate|west-city-harbor-(quay|pile|bollard|middle-landing|top-landing)|west-city-stair-harbor|west-city-bridge-(deck|landing|pier))/.test(o.name);
   for(const child of [...city.children]){
    if(exclude(child)){kept.push(child.name);continue;}
    child.applyMatrix4(delta);moved.push(child.name);
   }
   // Hinge only the crossing between unchanged old-city end and moved new end.
   const startNode=city.getObjectByName('west-city-bridge-landing-0'),endNode=city.getObjectByName('west-city-bridge-landing-1');
   const start=startNode.position.clone(),end=endNode.position.clone().applyMatrix4(delta);endNode.applyMatrix4(delta);
   const direction=end.clone().sub(start),axis=direction.clone().normalize();
   const normal=new T.Vector3(0,1,0).addScaledVector(axis,-axis.y).normalize(),side=new T.Vector3().crossVectors(axis,normal).normalize();
   const deck=city.getObjectByName('west-city-bridge-deck');deck.geometry=new T.BoxGeometry(direction.length()+.3,.3,3.5);deck.position.copy(start).lerp(end,.5).addScaledVector(normal,-.15);deck.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(axis,normal,side));
   for(const [i,t] of [.25,.7].entries()){const pier=city.getObjectByName('west-city-bridge-pier-'+t);if(pier)pier.position.copy(start).lerp(end,t).add(new T.Vector3(0,-4,0));}
   city.userData.surfaceCandidate={moved,kept,bridge:{start:start.toArray(),end:end.toArray(),length:direction.length()},routeIntegration:false};
   // Carry approved horse model with its terrace, without running the battle.
   const horse=t.scene.getObjectByName('citadel-trojan-horse');horse.updateWorldMatrix(true,false);
   const worldDelta=city.matrixWorld.clone().multiply(delta).multiply(city.matrixWorld.clone().invert());
   const localDelta=horse.parent.matrixWorld.clone().invert().multiply(worldDelta).multiply(horse.parent.matrixWorld);horse.applyMatrix4(localDelta);
   t.scene.updateMatrixWorld(true);
   const deformation=[];
   for(const name of ['citadel-oskar-grid-mountain-surface','backlit-highlight-citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal']){
    const mesh=t.scene.getObjectByName(name);if(!mesh)continue;mesh.geometry=mesh.geometry.clone();const a=mesh.geometry.attributes.position;let changed=0;
    for(let i=0;i<a.count;i++){
     const v=city.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(a,i)));
     const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
     const w=smooth((v.x-30)/14)*smooth((v.z+38)/18)*smooth((130-v.z)/18);
     if(w===0)continue;v.lerp(v.clone().applyMatrix4(delta),w);changed++;
     const q=mesh.worldToLocal(city.localToWorld(v));a.setXYZ(i,q.x,q.y,q.z);
    }a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();deformation.push({name,changed});
   }
   city.userData.surfaceCandidate.terrain=deformation;
   t.scene.updateMatrixWorld(true);
  },report.candidate.frame);
  await p.waitForTimeout(1000);const img=await p.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/png');});await writeFile(new URL('unified-'+phase+'.png',out),Buffer.from(img.split(',')[1],'base64'));
 }
 const evidence=await p.evaluate(()=>window.__tm.scene.getObjectByName('highland-west-city').userData.surfaceCandidate);await writeFile(new URL('interfaces.json',out),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await b.close();}
