import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const output=new URL('../../artifacts/pipeline/roman-family-world/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];try{
const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8765/TigerMessenger/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__tm,null,{timeout:90000});
await page.evaluate(()=>{
 const {scene,camera,THREE:T}=__tm,actor=scene.getObjectByName('tie-soldier');if(!actor)throw Error('No real tie soldier');
 actor.updateWorldMatrix(true,true);const center=new T.Box3().setFromObject(actor).getCenter(new T.Vector3()),up=actor.getWorldPosition(new T.Vector3()).normalize(),offset=new T.Vector3(.2,.45,1).transformDirection(actor.matrixWorld).multiplyScalar(3.2);
 // Independent test context: freeze the viewer camera after the normal game update.
 const original=camera.updateMatrixWorld.bind(camera);camera.updateMatrixWorld=function(...args){camera.position.copy(center).add(offset);camera.up.copy(up);camera.lookAt(center);return original(...args)};
 camera.near=.02;camera.updateProjectionMatrix();document.querySelector('#intro')?.remove();document.querySelector('#hud')?.remove();
});
await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
await page.screenshot({path:new URL('tie-soldier-world.png',output).pathname});
// Fresh test context only: exercise the existing full-world siege diagnostic. No user tab/storage touched.
await page.evaluate(()=>{const battle=__tm.scene.getObjectByName('saihoji-phalanx-battle');if(!battle?.userData.debugSiege)throw Error('Missing original battle debug hook');battle.userData.debugSiege()});
const report=await page.evaluate(()=>{
 const counts={};__tm.scene.traverse(n=>{if(!n.userData.parts||!n.userData.equipment)return;const key=n.userData.phalanxRole||n.name,r=counts[key]||(counts[key]={count:0,adapted:0,visible:0});r.count++;r.adapted+=+!!n.userData.romanEquipment?.active;let visible=true;for(let p=n;p;p=p.parent)if(!p.visible)visible=false;r.visible+=+visible});return {counts};
});

report.errors=errors;report.scope='Fresh full original Web world, existing debugSiege spawns armies; camera-only screenshot; skips story/transport, no complete playthrough';report.passed=!errors.length&&['spear','longbow','gladius','tie-soldier'].every(k=>report.counts[k]?.count>0&&report.counts[k].count===report.counts[k].adapted);
await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close()}
