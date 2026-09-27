import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {const p=await b.newPage({viewport:{width:1600,height:1000}});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('west-city-plaza-paving-ring'),null,{timeout:180000});
const images=await p.evaluate(async()=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('highland-west-city');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;c.updateWorldMatrix(true,true);const result={};
for(const [name,eye,look,fov]of [['target-angle',[108,42,140],[59,14,65],55],['target-angle-near',[96,31,117],[60,13,61],59]]) {t.camera.position.copy(c.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...look)));t.camera.fov=fov;t.camera.updateProjectionMatrix();
 // Give the real pooled lights time to catch up with both the night phase
 // and camera; two frames produced misleading unlit "night" evidence.
 let ready=false;
 for(let i=0;i<180;i++){
  await new Promise(r=>requestAnimationFrame(r));
  t.scene.traverse(o=>{if(o.userData.isLightPool&&o.userData.sourceLightName==='new-city-light-main-gate'&&o.intensity>0)ready=true;});
  if(ready&&i>30)break;
 }
 if(!ready)throw new Error('Citadel night light pool did not settle');
 t.renderer.render(t.scene,t.camera);result[name]=t.renderer.domElement.toDataURL('image/png');
 if(name==='target-angle'){
  const ray=new T.Raycaster();ray.layers.enableAll();const meshes=[];c.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
  window.__targetAudit={camera:{eye,look,fov},probes:[[.35,.85],[.30,.72],[.40,.78]].map(([x,y])=>{ray.setFromCamera(new T.Vector2(x*2-1,1-y*2),t.camera);const h=ray.intersectObjects(meshes,false)[0];return {screen:[x,y],name:h?.object.name,parent:h?.object.parent.name,point:h?c.worldToLocal(h.point.clone()).toArray():null};})};
 }
 }return result;});
for(const [name,data]of Object.entries(images))await writeFile(new URL('../../artifacts/pipeline/citadel-compact-ascent/'+name+'.png',import.meta.url),Buffer.from(data.split(',')[1],'base64'));
const report=await p.evaluate(()=>window.__targetAudit);await writeFile(new URL('../../artifacts/pipeline/citadel-compact-ascent/target-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
