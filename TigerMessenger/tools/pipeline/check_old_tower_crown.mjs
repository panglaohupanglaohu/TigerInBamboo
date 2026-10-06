import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const stage=process.argv[2]||'after',round='13';
const out=new URL('../../artifacts/pipeline/old-tower-crown/',import.meta.url).pathname;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],warnings=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error'||e.text().includes('[citadel]'))warnings.push(e.text().slice(0,1000));});
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&timeOfDay=.5&citadelMountain='+round+'&citadelLandform='+'1');
await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});
await page.waitForTimeout(7000);
await page.evaluate(()=>{const t=__tm;t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.5;t.dayNight.update(.0001);document.querySelectorAll('body > :not(canvas)').forEach(e=>{if(e.tagName!=='SCRIPT')e.style.visibility='hidden';});});
const tower=await page.evaluate(()=>{const t=__tm,T=t.THREE,o=t.scene.getObjectByName('highland-central-sacred-tower');o.updateWorldMatrix(true,true);const target=o.localToWorld(new T.Vector3(0,33,0)),eye=o.localToWorld(new T.Vector3(12,37,18));t.camera.position.copy(eye);t.camera.up.set(0,1,0).transformDirection(o.matrixWorld);t.camera.lookAt(target);t.camera.fov=38;t.camera.updateProjectionMatrix();t.distanceCulling.recollect();t.distanceCulling.update(3);return o.name;});
await page.waitForTimeout(400);
const shot=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});writeFileSync(out+stage+'.png',Buffer.from(shot.split(',')[1],'base64'));for(const [name,eye,target,fov] of [['rear',[-14,36,-17],[0,33,0],38],['skyline',[38,42,65],[0,24,0],42]]){
 await page.evaluate(({eye,target,fov})=>{const t=__tm,T=t.THREE,o=t.scene.getObjectByName('highland-central-sacred-tower');t.camera.position.copy(o.localToWorld(new T.Vector3(...eye)));t.camera.lookAt(o.localToWorld(new T.Vector3(...target)));t.camera.fov=fov;t.camera.updateProjectionMatrix();t.distanceCulling.update(3);},{eye,target,fov});
 const png=await page.evaluate(()=>{__tm.renderer.render(__tm.scene,__tm.camera);return __tm.renderer.domElement.toDataURL('image/png');});writeFileSync(out+stage+'-'+name+'.png',Buffer.from(png.split(',')[1],'base64'));
}
writeFileSync(out+stage+'.json',JSON.stringify({tower,errors,warnings},null,2));await browser.close();process.exit(0);
