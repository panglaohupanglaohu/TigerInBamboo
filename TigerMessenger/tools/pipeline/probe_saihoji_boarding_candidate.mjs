import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const prior=JSON.parse(await readFile('TigerMessenger/artifacts/pipeline/kun-roll-model/live-waves-report.json','utf8'));
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1000,height:700}});
 p.on('console',m=>{if(m.text().startsWith('EVAC'))console.log(m.text());});
 await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);localStorage.setItem('tm.rescue.campaign.v1',JSON.stringify({version:1,chapter:3}));});
 await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});await p.locator('#start-btn').click();
 const report=await p.evaluate(async prior=>{
  const {scene,THREE:T,messenger,sceneHandles,rescueCampaign:campaign}=window.__tm;
  const battle=messenger.landmarks.saihojiPhalanx,garden=sceneHandles.find(h=>h.id==='saihoji'),fleet=scene.getObjectByName('moebius-aircraft-squad');
  const wh=scene.getObjectByName('leviathanGroup');fleet.userData._patrolCenter=wh.position.clone().normalize().multiplyScalar(185);let time=0,captured=null;
  const tick=()=>{time+=.1;campaign.update(.1);garden.update(.1,time);if(!captured&&battle.root.userData.phase==='return'){captured=[];battle.root.traverse(a=>{if(a.userData.garrisonHome)captured.push({uid:a.userData.uid,position:a.position.toArray(),downed:!!a.userData.downed,dead:!!a.userData.dead});});return;}battle.update(.1,time);};
  for(let i=0;i<1800&&battle.root.userData.phase!=='fight';i++)tick();
  const trams=[];scene.traverse(o=>{if(o.name?.startsWith('heritage-tram-'))trams.push(o);});const tram=trams[0],saved=tram?.position.clone();
  if(tram){const hub=wh.position.clone().normalize(),side=new T.Vector3(0,1,0).cross(hub).normalize();tram.position.copy(tram.parent.worldToLocal(hub.multiplyScalar(160).addScaledVector(side,27)));tram.updateMatrix();tram.updateWorldMatrix(true,true);}
  for(let i=0;i<100;i++)tick();if(tram){tram.position.copy(saved);tram.updateMatrix();tram.updateWorldMatrix(true,true);}
  fleet.userData.squadArrowHits=600;for(let i=0;i<1800&&!captured;i++)tick();
  if(!captured)return {blocked:'no-pre-withdrawal-snapshot',phase:battle.root.userData.phase,time};
  scene.updateMatrixWorld(true);

  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createGarrisonEvacuationRoutes}=await import('/TigerMessenger/src/world/garrisonEvacuationRoutes.js');
  const {createFisherBoat}=await import('/TigerMessenger/src/assets/harbor.js');
  const {bindRomanShipCarryPose}=await import('/TigerMessenger/src/world/romanShipCarryPose.js');
  const {buildSaihojiBoardingRoute,createWarshipBoardingBodyCheck}=await import('/TigerMessenger/src/world/saihojiBoardingRoute.js');
  const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
  const {installSaihojiBoardingSeam}=await import('/TigerMessenger/src/world/saihojiBoardingSeam.js');
  const {installSaihojiHarborBed}=await import('/TigerMessenger/src/world/saihojiHarborBed.js');
  const bed=installSaihojiHarborBed(scene.getObjectByName('planet-surface'));
  scene.updateMatrixWorld(true);
  const nav=createWarshipWaterRoutes(scene,160),ground=createGarrisonEvacuationRoutes(scene);
  const whale=scene.getObjectByName('leviathanGroup'),hub=whale.position.clone().normalize();
  const land=hub.clone().addScaledVector(new T.Vector3(0,1,0).cross(hub).normalize(),.11).normalize();
  const boat=createFisherBoat();boat.scale.setScalar(1.7);const seam=installSaihojiBoardingSeam(boat);
  const contract=boat.userData.warshipV6?.boardingContract;
  const units=captured.map(u=>{const point=new T.Vector3(...u.position),hit=ground.sample(point);return {...u,radialHeight:point.length(),water:160+officialOceanLevelAt(point.clone().normalize()),drySupport:hit?.toArray()||null};});
  console.log('EVAC samples',units.filter(u=>u.drySupport).length,'/',units.length);
  const docks=[],used=[];let capture=null;
  const shoreSurfaces=[];scene.traverse(o=>{if(o.isMesh&&(o.name==='mossy-terrain'||o.name==='leviathan-crust-plate'||o.name==='leviathan-terrain-topography'||o.name.startsWith('leviathan-moss-bed')||o.parent?.name==='mossyGround'))shoreSurfaces.push(o);});
  for(let i=0;i<3;i++){
   boat.userData.warshipV6.setBoarding(0);boat.userData.warshipV6.setBoardingPitch(null);boat.userData.warshipV6.update(0,false);
   const start=performance.now(),dock=nav.dock(boat,land,used,{maxDistance:24,shoreStep:2});
   const result={index:i,valid:dock.valid,searchRadius:24,elapsedMs:performance.now()-start,reason:dock.reason,attempts:dock.attempts,rejected:dock.rejected,hullObstacles:dock.hullObstacles,entryObstacles:dock.entryObstacles,lastFailure:dock.lastFailure,position:dock.position?.toArray(),shorePoint:dock.shorePoint?.toArray(),shoreObject:dock.shoreObject,angle:dock.angle};
   if(dock.valid){used.push(dock);boat.position.copy(dock.position);boat.quaternion.copy(dock.quaternion);boat.userData.warshipV6.setBoarding(1);boat.userData.warshipV6.setBoardingPitch(dock.angle);boat.userData.warshipV6.update(0,false);boat.updateMatrixWorld(true);const br=buildSaihojiBoardingRoute({boat,dock,shoreSurfaces,extraSupport:[seam.mesh]});result.boarding={...br,points:br.points?.map(p=>p.toArray())};const actors=new Map();battle.root.traverse(a=>{if(!a.userData.garrisonHome||a.userData.dead||a.userData.downed)return;const e=a.userData.equipment,role=e?.gladius?'gladius':e?.bow?'longbow':e?.spear?'spear':null;if(role&&!actors.has(role))actors.set(role,a);});result.actorClearance=[];
    for(const [role,actor] of actors){for(const carried of [false,true]){const carry=carried?bindRomanShipCarryPose(actor):null;try{carry?.setEnabled(true);const body=createWarshipBoardingBodyCheck(boat,actor),bodyRoute=buildSaihojiBoardingRoute({boat,dock,shoreSurfaces,extraSupport:[seam.mesh],clearSegment:body.clear});result.actorClearance.push({...body.diagnostics(),role,carryPose:carried,valid:bodyRoute.valid,reason:bodyRoute.reason});}finally{carry?.setEnabled(false);}}}

    if(!capture){scene.add(boat);const {camera,renderer}=window.__tm;const up=dock.position.clone().normalize(),side=new T.Vector3(0,0,1).applyQuaternion(boat.quaternion);camera.position.copy(dock.shorePoint).addScaledVector(up,5).addScaledVector(side,8);camera.up.copy(up);camera.lookAt(dock.shorePoint);renderer.render(scene,camera);capture=renderer.domElement.toDataURL('image/png');scene.remove(boat);}
    result.routes=units.map(u=>{const r=ground.approach(new T.Vector3(...u.position),dock.shorePoint);return {uid:u.uid,valid:!!r.valid,reason:r.reason,length:r.length,startCorrection:r.startCorrection};});}
   docks.push(result);console.log('EVAC dock',i,JSON.stringify({valid:result.valid,boarding:result.boarding?.reason,actorClearance:result.actorClearance,routes:result.routes}));if(!dock.valid)break;
  }
  return {capture,preWithdrawalSnapshot:{time,phase:battle.root.userData.phase,actorPositionsUnmodified:true},physicalBoardingValidated:false,bed:bed.diagnostics, scope:'Isolated browser candidate with real cloned sea-bed geometry, not released. Actual 8931 authored scene. Actor coordinates captured at real whaleReturned before updateGarrison on that frame; no actor positions changed. Isolated chapter3 save, nearby fleet/600hits and tram car position are diagnostic injections; no natural combat claim. Search bounded to 24m and stops on first invalid berth. No deck/seat route claimed without valid shore berth.',priorSourceHash:prior.sourceHash,landDir:land.toArray(),contract,scale:1.7,units,docks,uniqueBerths:used.length,requiredBerths:3,stats:nav.stats};
 },prior);
 const out='TigerMessenger/artifacts/pipeline/saihoji-evacuation-boarding';await mkdir(out,{recursive:true});if(report.capture){await writeFile(out+'/candidate-dock-board.png',Buffer.from(report.capture.split(',')[1],'base64'));delete report.capture;}await writeFile(out+'/candidate-board-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({physicalBoardingValidated:report.physicalBoardingValidated,drySupportedUnits:report.units.filter(u=>u.drySupport).length,uniqueBerths:report.uniqueBerths,output:out}));
}finally{await b.close();}
