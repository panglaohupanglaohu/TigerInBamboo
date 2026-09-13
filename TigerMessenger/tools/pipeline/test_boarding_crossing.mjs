import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage();
 await page.goto('http://localhost:8931/TigerMessenger/artifacts/pipeline/human-courier-v1/index.html');
 await page.waitForFunction(()=>window.courierReview);
 const result=await page.evaluate(async()=>{
  const T=await import('/TigerMessenger/vendor/three.module.js');
  const {createBoatRide}=await import('/TigerMessenger/src/player/boatRide.js');
  const {createBoardingGate}=await import('/TigerMessenger/src/world/citadel/boardingGate.js');
  const scene=new T.Scene(),boat=new T.Group(),actor=new T.Group();boat.position.set(0,160,0);scene.add(boat,actor);
  const route=[new T.Vector3(3,160.8,0),new T.Vector3(2,160.9,0),new T.Vector3(1,160.9,0)];
  boat.userData.boardingRoute=route;const gate=createBoardingGate(()=>{});boat.userData.boardingGate=gate;
  const player={position:route[0].clone(),velocity:new T.Vector3(),forward:new T.Vector3(1,0,0),facing:new T.Vector3(1,0,0),riding:false};
  const ride=createBoatRide({scene,player,playerGroup:actor,getBoat:()=>boat,keys:{},cameraRig:{getDist:()=>5,setDist:()=>{}}});
  const press=()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}));
  let maxStep=0,occupied=false,hidden=false;
  const tick=()=>{const p=player.position.clone();ride.update(1/60);maxStep=Math.max(maxStep,p.distanceTo(player.position));occupied ||= gate.snapshot().occupants.includes('player');hidden ||= !actor.visible;};
  press();for(let i=0;i<360;i++)tick();
  const mounted=ride.isRiding(),deckError=player.position.distanceTo(route.at(-1)),canSail=gate.snapshot().canSail;
  press();for(let i=0;i<360;i++)tick();
  const shoreError=player.position.distanceTo(route[0]),exited=!ride.isRiding()&&!player.riding;
  press();for(let i=0;i<100;i++)tick();ride.forceExit();
  const cancelled=!ride.isRiding()&&!player.riding&&gate.snapshot().occupants.length===0&&!boat.userData.piloted;
  return {maxStep,occupied,hidden,mounted,deckError,canSail,shoreError,exited,cancelled};
 });
 const passed=result.maxStep<=.020001&&result.occupied&&!result.hidden&&result.mounted&&result.deckError<1e-7&&result.canSail&&result.shoreError<1e-7&&result.exited&&result.cancelled;
 const report={...result,passed,scope:'Real boatRide F interaction on a supplied three-point fixture; continuity, lifecycle, visibility and cancellation. Does not certify actual harbor geometry or character gait.'};
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/boarding-crossing.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));if(!passed)process.exitCode=1;
} finally {await browser.close();}
