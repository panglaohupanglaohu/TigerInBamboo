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
 await page.waitForFunction(()=>{const a=__boardingCheckBoat.userData.boardingCameraAudit,b=a.best,c=a.candidates.find(c=>c.yaw===b.yaw&&c.height===b.height);return __tm.camera.position.distanceTo(new __tm.THREE.Vector3().fromArray(c.eye))<.03;},null,{timeout:15000});
 const mounted=await page.evaluate(()=>{
  const ray=new __tm.THREE.Raycaster();ray.layers.enableAll();ray.setFromCamera(new __tm.THREE.Vector2(),__tm.camera);ray.far=15;
  const hits=ray.intersectObject(__tm.scene,true).slice(0,8).map(h=>({name:h.object.name,parent:h.object.parent?.name,distance:h.distance,ancestors:(()=>{const a=[];for(let n=h.object;n;n=n.parent)a.push(n.name);return a;})()}));
  return {riding:__tm.player.riding,onFoot:__tm.player.boardingOnFoot,deckError:__tm.player.position.distanceTo(__boardingCheckBoat.userData.boardingRoute.at(-1)),camera:__boardingCheckBoat.userData.boardingCameraAudit,actualCamera:__tm.camera.position.toArray(),actualPlayer:__tm.player.position.toArray(),occlusion:__tm.cameraRig.getOcclusionDist(),hits};
 });
 await page.screenshot({path:new URL('../../artifacts/pipeline/citadel-master-terrain/boarding-live.png',import.meta.url).pathname});
 await page.keyboard.press('f');
 await page.waitForFunction(()=>!window.__tm.player.riding,null,{timeout:45000});
 const exited=await page.evaluate(()=>({occupants:__boardingCheckBoat.userData.boardingGate.snapshot().occupants.length,shoreError:__tm.player.position.distanceTo(__boardingCheckBoat.userData.boardingRoute[0]),cameraRestored:__tm.cameraRig.getFollowProfile()===null}));
 const report={setup,mounted,exited,errors,passed:mounted.deckError<.01&&mounted.onFoot&&exited.occupants===0&&exited.shoreError<.3&&exited.cameraRestored&&errors.length===0};
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/boarding-live.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
