import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sourceHash=createHash('sha256').update(await readFile('TigerMessenger/src/world/saihojiPhalanx.js')).digest('hex');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const p=await b.newPage({viewport:{width:1280,height:800}});
 await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);localStorage.setItem('tm.rescue.campaign.v1',JSON.stringify({version:1,chapter:3}));});
 await p.goto('http://localhost:8931/TigerMessenger/');await p.waitForFunction(()=>!!window.__tm?.rescueCampaign,null,{timeout:180000});await p.locator('#start-btn').click();
 const report=await p.evaluate(async()=>{
  const {THREE:T,scene,messenger,sceneHandles,rescueCampaign:campaign,renderer,camera}=window.__tm;
  const battle=messenger.landmarks.saihojiPhalanx,garden=sceneHandles.find(h=>h.id==='saihoji'),whale=scene.getObjectByName('leviathanGroup'),fleet=scene.getObjectByName('moebius-aircraft-squad');
  const hub=whale.position.clone().normalize();fleet.userData._patrolCenter=hub.clone().multiplyScalar(185);let time=0;
  const tick=()=>{time+=.1;campaign.update(.1);garden.update(.1,time);battle.update(.1,time);};
  for(let n=0;n<1800&&battle.root.userData.phase!=='fight';n++)tick();
  const reachedFight=battle.root.userData.phase==='fight',waveCount=battle.root.userData.campaignStatus.shipCount;
  const audio=await import('/TigerMessenger/src/audio/sfx.js');audio.setInfiltrationBgm(false);
  // Exercise the real tram drop path, then move the car away (diagnostic placement).
  const trams=[];scene.traverse(o=>{if(o.name?.startsWith('heritage-tram-'))trams.push(o);});
  const tram=trams[0],saved=tram?.position.clone();
  if(tram){const side=new T.Vector3().crossVectors(new T.Vector3(0,1,0),hub).normalize();const stop=hub.clone().multiplyScalar(160).addScaledVector(side,27);tram.position.copy(tram.parent.worldToLocal(stop));tram.updateMatrix();tram.updateWorldMatrix(true,true);}
  for(let i=0;i<100;i++)tick();
  const tramDebug={drop:battle.root.userData.tramDropStatus,world:tram?.getWorldPosition(new T.Vector3()).toArray(),hub:hub.toArray(),stage:battle.root.userData.saihojiAmbush.state.stage,phase:battle.root.userData.phase};
  if(tram){tram.position.copy(saved);tram.updateMatrix();tram.updateWorldMatrix(true,true);}
  const garrison=[];battle.root.traverse(o=>{if(o.userData.garrisonHome)garrison.push(o);});
  const island=scene.getObjectByName('leviathan-island');island.updateWorldMatrix(true,true);
  const patient=garrison[0],escort=garrison[1];
  fleet.userData.squadArrowHits=600;
  for(let i=0;i<800&&garden.whaleLift01()>.0301;i++)tick();
  island.updateWorldMatrix(true,true);
  if(patient&&escort){patient.position.copy(island.localToWorld(new T.Vector3(0,.5,0))).normalize();patient.position.multiplyScalar(battle.root.userData.groundHeightAt(patient.position));escort.position.copy(patient.position).add(new T.Vector3(.35,0,0));patient.userData.downed=true;}
  const patientUid=patient?.userData.uid,patientQuaternion=patient?.quaternion.toArray();
  fleet.userData.squadArrowHits=600;
  let started=null,completed=null,blockedWithAshore=false,capture=null,maxPatientStep=0,maxStepFrame=null,previousPatient=patient?.position.clone(),blockedWithOccupant=false;
  for(let n=0;n<2400;n++){
   tick();const s=whale.userData.victoryRoll,d=battle.root.userData.kunDeparture;
   if(patient){const distance=patient.position.distanceTo(previousPatient);if(distance>maxPatientStep){maxPatientStep=distance;maxStepFrame={time,phase:battle.root.userData.phase,groundPulse:fleet.userData.groundPulse?{radius:fleet.userData.groundPulse.radius,center:fleet.userData.groundPulse.center.toArray()}:null,before:previousPatient.toArray(),after:patient.position.toArray(),retreat:{...patient.userData.garrisonRetreat}};}previousPatient.copy(patient.position);}
   if(s.pending&&!s.active&&d?.onIsland>0)blockedWithOccupant=true;
   if(s.pending&&!s.active&&d?.ashore>0)blockedWithAshore=true;
   if(s.active&&!started)started={time,phase:battle.root.userData.phase,departure:JSON.parse(JSON.stringify(d))};
   if(started&&!capture&&time-started.time>5){scene.updateMatrixWorld(true);const up=hub,east=new T.Vector3().crossVectors(up,new T.Vector3(0,1,0)).normalize();camera.position.copy(whale.position).addScaledVector(up,23).addScaledVector(east,28);camera.up.copy(up);camera.lookAt(whale.position);renderer.render(scene,camera);capture=renderer.domElement.toDataURL('image/png');}
   if(s.completed&&!completed)completed={time,count:s.completed};
   if(completed&&garrison.every(a=>a.userData.dead||a.userData.garrisonRetreat?.finished))break;
  }
  return {passed:Boolean(reachedFight&&waveCount===2&&blockedWithAshore&&started?.departure.cleared&&started.departure.boatsClear&&started.departure.onIsland===0&&completed?.count===1&&garrison.length>0&&patient.userData.downed&&patient.userData.uid===patientUid&&maxPatientStep<.5&&JSON.stringify(patient.quaternion.toArray())===JSON.stringify(patientQuaternion)),tramRetreat:{count:garrison.length,finished:garrison.filter(a=>a.userData.garrisonRetreat?.finished).length,tramDebug,tramNames:trams.map(t=>t.name),drums:audio.isInfiltrationMissionActive(),patientUid,preserved:patient?.userData.downed&&patient?.userData.uid===patientUid,posePreserved:JSON.stringify(patient?.quaternion.toArray())===JSON.stringify(patientQuaternion),maxPatientStep,maxStepFrame,blockedWithOccupant,retreat:patient?.userData.garrisonRetreat,units:garrison.map(s=>({uid:s.userData.uid,retreat:s.userData.garrisonRetreat?{finished:s.userData.garrisonRetreat.finished,blocked:s.userData.garrisonRetreat.blocked,supportStep:s.userData.garrisonRetreat.supportStep,routeFailure:s.userData.garrisonRetreat.routeFailure,routeEvidence:s.userData.garrisonRetreat.routeEvidence,position:s.position.toArray(),destination:s.userData.garrisonRetreat.dryDestination}:null}))},reachedFight,waveCount,blockedWithAshore,started,completed,last:{phase:battle.root.userData.phase,departure:battle.root.userData.kunDeparture,roll:whale.userData.victoryRoll},capture,scope:'Tram car, injured actor and escort positions are diagnostic injections, injured flag injected. Actual 8931 game scene and original two waves + actual embark ownership. Restored chapter3 save, held RAF, manually stepped production garden/battle, fixed nearby fleet and injected 600 hit counter. No phase/embark/clearance writes. Not a natural full combat playthrough.'};
 });
 if(report.capture){await writeFile('TigerMessenger/artifacts/pipeline/kun-roll-model/live-waves-roll.png',Buffer.from(report.capture.split(',')[1],'base64'));delete report.capture;}
 report.rollSafetyPassed=report.passed;report.allReturnedToDryGround=report.tramRetreat.units.every(u=>u.retreat?.finished&&u.retreat?.destination);report.passed=Boolean(report.rollSafetyPassed&&report.allReturnedToDryGround);
 report.sourceHash=sourceHash;report.variant='default-incremental-safe-withdrawal';
 await writeFile('TigerMessenger/artifacts/pipeline/kun-roll-model/live-waves-report.json',JSON.stringify(report,null,2));console.log(report);if(!report.rollSafetyPassed)process.exitCode=1;
}finally{await b.close();}
