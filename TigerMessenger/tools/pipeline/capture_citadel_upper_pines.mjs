import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const tag=process.argv.find(a=>/^--tag=[a-z0-9-]+$/.test(a))?.split('=')[1]??'upper-pines';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {const p=await b.newPage({viewport:{width:1600,height:1000}});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('west-city-plaza-paving-ring'),null,{timeout:180000});
const images=await p.evaluate(async(tag)=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('highland-west-city');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;c.updateWorldMatrix(true,true);const result={};
for(const [name,eye,look,fov]of [[tag+'-web',[100,30,68],[61,19,24],55]]) {t.camera.position.copy(c.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...look)));t.camera.fov=fov;t.camera.updateProjectionMatrix();
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
 }return result;},tag);
for(const [name,data]of Object.entries(images))await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/'+name+'.png',import.meta.url),Buffer.from(data.split(',')[1],'base64'));
const report={camera:{eye:[100,30,68],look:[61,19,24],fov:55},scope:'Current 8931 actual new-city upper scene, not a generated image'};await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/'+tag+'-camera.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
