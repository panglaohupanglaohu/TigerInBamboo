import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/artifacts/pipeline/kun-roll-model/');await p.waitForFunction(()=>!!window.rollReview,null,{timeout:120000});
const result=await p.evaluate(async()=>{const T=await import('three'),M=await import('/TigerMessenger/src/scenes/saihojiGarden.js');const scene=new T.Scene(),world=M.saihojiGardenScene.load({scene,planetRadius:160,options:{}}),hub=world.group.position.clone().normalize();
const fleet=new T.Group();fleet.name='moebius-aircraft-squad';fleet.position.copy(hub).multiplyScalar(190);scene.add(fleet);
const allies=new T.Group();allies.name='saihoji-phalanx-battle';allies.userData.saihojiAmbush={state:{stage:'concealed'}};allies.userData.phase='return';allies.userData.kunDeparture={cleared:false};allies.userData.whaleReturned=()=>{};scene.add(allies);
let time=0;function tick(n,dt=.1){for(let i=0;i<n;i++){time+=dt;world.update(dt,time)}}
tick(400);const rose=world.getStoryPhase()===1;fleet.userData.squadArrowHits=600;tick(400);const ended=world.getStoryPhase()===2;
// Deliberately keep the fleet nearby: no leave/rescan/leave patrol is supplied.
const pendingBeforePatrol=world.group.userData.victoryRoll.pending===true;
tick(140);const held=!world.group.userData.victoryRoll.active&&world.group.userData.victoryRoll.completed===0;
allies.userData.kunDeparture.cleared=true;tick(1);const started=world.group.userData.victoryRoll.active;tick(140);const once=world.group.userData.victoryRoll.completed===1&&!world.group.userData.victoryRoll.active;tick(140);const noRepeat=world.group.userData.victoryRoll.completed===1;
return {passed:rose&&ended&&pendingBeforePatrol&&held&&started&&once&&noRepeat,rose,ended,pendingBeforePatrol,startedDuringLocalReturn:started&&allies.userData.phase==='return',heldUntilDeparture:held,started,once,noRepeat,scope:'production scene with synthetic fleet/hit/campaign inputs; trigger integration, not natural full playthrough'};});
await writeFile('TigerMessenger/artifacts/pipeline/kun-roll-model/web-trigger-report.json',JSON.stringify(result,null,2));console.log(result);if(!result.passed)process.exitCode=1;
}finally{await b.close()}
