import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-plaza-frame/',import.meta.url);await mkdir(out,{recursive:true});
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
   const names=['west-city-plaza-deck','west-city-plaza-foundation','west-city-plaza-paving-ring','citadel-plaza-hero-statue','citadel-original-horse-terrace'];
   for(const name of names){const n=city.getObjectByName(name);n.applyMatrix4(delta);}
   for(const n of city.getObjectByName('citadel-new-city-lighting').children)if(n.position.z>60)n.applyMatrix4(delta);
   // Carry approved horse model with its terrace, without running the battle.
   const horse=t.scene.getObjectByName('citadel-trojan-horse');horse.updateWorldMatrix(true,false);
   const worldDelta=city.matrixWorld.clone().multiply(delta).multiply(city.matrixWorld.clone().invert());
   const localDelta=horse.parent.matrixWorld.clone().invert().multiply(worldDelta).multiply(horse.parent.matrixWorld);horse.applyMatrix4(localDelta);
   const plants=city.getObjectByName('citadel-terrace-garden');
   plants.traverse(o=>{if(!o.isMesh)return;o.geometry=o.geometry.clone();const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i);if(v.z>70){v.applyMatrix4(delta);a.setXYZ(i,v.x,v.y,v.z);}}a.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingSphere();});
   // Preview-only excavation: real terrain geometry stays visible, cut under the
   // candidate platform and eased across its shoulders. Existing access is NOT solved.
   const n=new T.Vector3(0,1,0).transformDirection(frame),center=new T.Vector3().setFromMatrixPosition(frame);
   t.scene.updateMatrixWorld(true);
   for(const name of ['citadel-oskar-grid-mountain-surface','backlit-highlight-citadel-oskar-grid-mountain-surface']){
    const mesh=t.scene.getObjectByName(name);if(!mesh)continue;mesh.geometry=mesh.geometry.clone();const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){
     const v=city.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(a,i)));
     if(v.z<58||v.z>96||v.x<39||v.x>95)continue;
     const y=(n.dot(center)-n.x*v.x-n.z*v.z)/n.y-.35;
     const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
     const w=smooth((v.z-58)/4)*smooth((96-v.z)/10)*smooth((v.x-39)/6)*smooth((95-v.x)/10);
     v.y=Math.min(v.y,v.y+(y-v.y)*w);const q=mesh.worldToLocal(city.localToWorld(v));a.setXYZ(i,q.x,q.y,q.z);
    }a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
   }
   t.scene.updateMatrixWorld(true);
  },report.candidate.frame);
  await p.waitForTimeout(1000);const img=await p.evaluate(()=>{const t=window.__tm;t.renderer.render(t.scene,t.camera);return t.renderer.domElement.toDataURL('image/png');});await writeFile(new URL('tangent-'+phase+'.png',out),Buffer.from(img.split(',')[1],'base64'));
 }
 console.log('Independent plaza tangent candidate captured; production unchanged; route reconnection not complete.');
}finally{await b.close();}
