import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.canalBoats?.boats?.some(b=>['ready','failed'].includes(b.userData.boardingInstallation)),null,{timeout:180000});
 const setup=await page.evaluate(()=>{
  const t=window.__tm,b=t.messenger.landmarks.canalBoats.boats.find(b=>b.userData.boardingInstallation);
  if(b.userData.boardingInstallation!=='ready')return {error:b.userData.boardingError};
  t.player.position.copy(b.userData.boardingRoute[0]);t.player.velocity.set(0,0,0);
  window.__boardingCheckBoat=b;
  return {status:b.userData.boardingInstallation,points:b.userData.boardingRoute.length};
 });
 if(setup.error)throw Error(setup.error);
 await page.keyboard.press('f');
 await page.waitForFunction(()=>window.__tm.player.riding&&window.__boardingCheckBoat.userData.boardingGate.snapshot().canSail,null,{timeout:45000});
 const mounted=await page.evaluate(()=>({riding:__tm.player.riding,onFoot:__tm.player.boardingOnFoot,deckError:__tm.player.position.distanceTo(__boardingCheckBoat.userData.boardingRoute.at(-1))}));
 await page.screenshot({path:new URL('../../artifacts/pipeline/citadel-master-terrain/boarding-live.png',import.meta.url).pathname});
 await page.keyboard.press('f');
 await page.waitForFunction(()=>!window.__tm.player.riding,null,{timeout:45000});
 const exited=await page.evaluate(()=>({occupants:__boardingCheckBoat.userData.boardingGate.snapshot().occupants.length,shoreError:__tm.player.position.distanceTo(__boardingCheckBoat.userData.boardingRoute[0])}));
 const report={setup,mounted,exited,errors,passed:mounted.deckError<.01&&mounted.onFoot&&exited.occupants===0&&exited.shoreError<.3&&errors.length===0};
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/boarding-live.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
