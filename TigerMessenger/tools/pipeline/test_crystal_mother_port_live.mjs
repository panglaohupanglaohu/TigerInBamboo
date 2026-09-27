import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1&tour=crystal-mother-port',{waitUntil:'domcontentloaded',timeout:180000});
await page.waitForFunction(()=>window.__tm?.boatRide,null,{timeout:180000});
const state=()=>page.evaluate(()=>{const t=window.__tm,p=t.messenger.landmarks.crystalMotherPort;return {riding:t.boatRide.isRiding(),quayGap:t.player.position.distanceTo(p.boardingRoute[0]),progress:p.boat.userData.portNavigation.progress,playerR:t.player.position.length(),camera:p.root.worldToLocal(t.camera.position.clone()).toArray(),profile:t.cameraRig.getFollowProfile(),occlusion:t.cameraRig.getOcclusionDist(),audit:p.boat.userData.boardingCameraAudit?.best};});
await page.waitForTimeout(1500);const start=await state();await page.keyboard.press('f');await page.waitForTimeout(12000);const aboard=await state();
await page.screenshot({path:new URL('../../artifacts/pipeline/moebius-crystal-city-target/mother-port-live.png',import.meta.url).pathname});
const report={start,aboard,errors,passed:start.quayGap<1.6&&aboard.riding&&errors.length===0};await writeFile(new URL('../../artifacts/pipeline/moebius-crystal-city-target/mother-port-live-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
