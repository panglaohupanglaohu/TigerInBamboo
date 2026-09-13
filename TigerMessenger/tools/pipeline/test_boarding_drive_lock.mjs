import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();
 await page.goto('http://localhost:8931/TigerMessenger/artifacts/pipeline/human-courier-v1/index.html');
 await page.waitForFunction(()=>window.courierReview);
 const result=await page.evaluate(async()=>{
  const T=await import('/TigerMessenger/vendor/three.module.js');
  const {createBoatRide}=await import('/TigerMessenger/src/player/boatRide.js');
  const {createWarshipV6}=await import('/TigerMessenger/src/assets/warshipV6.js');
  const {createBoardingGate}=await import('/TigerMessenger/src/world/citadel/boardingGate.js');
  const scene=new T.Scene(),boat=createWarshipV6();boat.position.set(0,160,0);scene.add(boat);
  const player={position:boat.position.clone(),velocity:new T.Vector3(),forward:new T.Vector3(1,0,0),facing:new T.Vector3(1,0,0),riding:false};
  const keys={KeyW:true,KeyA:true};
  const ride=createBoatRide({scene,player,getBoat:()=>boat,keys,cameraRig:{getDist:()=>5,setDist:()=>{}}});
  const gate=createBoardingGate(()=>{});boat.userData.boardingGate=gate;
  gate.deploy({stopped:true});gate.tick(1.5);gate.enter('soldier-21');
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}));
  const start=boat.position.clone(),q=boat.quaternion.clone();
  for(let i=0;i<120;i++)ride.update(1/60);
  const lockedDrift=boat.position.distanceTo(start),lockedRotation=boat.quaternion.angleTo(q);
  const occupiedRetract=gate.retract();gate.leave('soldier-21');gate.retract();
  gate.tick(.75);ride.update(1/60);const midRetractionDrift=boat.position.distanceTo(start);
  gate.tick(.75);for(let i=0;i<60;i++)ride.update(1/60);
  const releasedMovement=boat.position.distanceTo(start);
  ride.forceExit();scene.remove(boat);
  return {mounted:!player.riding&&releasedMovement>0,lockedDrift,lockedRotation,occupiedRetract,midRetractionDrift,releasedMovement,scope:'Actual F mount and WASD update with original ship; isolated fixture, not full shore crossing.'};
 });
 const passed=result.lockedDrift<1e-8&&result.lockedRotation<1e-8&&!result.occupiedRetract&&result.midRetractionDrift<1e-8&&result.releasedMovement>1;
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/boarding-drive-lock.json',import.meta.url),JSON.stringify({...result,passed},null,2));
 console.log(JSON.stringify({...result,passed}));if(!passed)process.exitCode=1;
}finally{await browser.close();}
