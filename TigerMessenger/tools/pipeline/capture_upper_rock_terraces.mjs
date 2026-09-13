import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {const p=await b.newPage({viewport:{width:1600,height:1000}});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelUpperRock=1');
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('west-city-plaza-paving-ring'),null,{timeout:180000});
const images=await p.evaluate(async()=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('highland-west-city');t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;c.updateWorldMatrix(true,true);const result={};
for(const [name,eye,look,fov]of [['target-angle',[108,42,140],[59,14,65],55],['target-angle-near',[96,31,117],[60,13,61],59]]) {t.camera.position.copy(c.localToWorld(new T.Vector3(...eye)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(...look)));t.camera.fov=fov;t.camera.updateProjectionMatrix();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));t.renderer.render(t.scene,t.camera);result[name]=t.renderer.domElement.toDataURL('image/png');}return result;});
for(const [name,data]of Object.entries(images))await writeFile(new URL('../../artifacts/pipeline/citadel-upper-rock-terraces/'+name+'.png',import.meta.url),Buffer.from(data.split(',')[1],'base64'));
}finally{await b.close();}
