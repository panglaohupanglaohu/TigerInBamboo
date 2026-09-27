import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const prior=JSON.parse(await readFile('TigerMessenger/artifacts/pipeline/kun-roll-model/live-waves-report.json','utf8'));
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1000,height:700}});
 p.on('console',m=>{if(m.text().startsWith('EVAC'))console.log(m.text());});
 await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 const report=await p.evaluate(async prior=>{
  const {scene,THREE:T}=window.__tm;
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createGarrisonEvacuationRoutes}=await import('/TigerMessenger/src/world/garrisonEvacuationRoutes.js');
  const {createFisherBoat}=await import('/TigerMessenger/src/assets/harbor.js');
  const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
  const nav=createWarshipWaterRoutes(scene,160),ground=createGarrisonEvacuationRoutes(scene);
  const whale=scene.getObjectByName('leviathanGroup'),hub=whale.position.clone().normalize();
  const land=hub.clone().addScaledVector(new T.Vector3(0,1,0).cross(hub).normalize(),.11).normalize();
  const boat=createFisherBoat();boat.scale.setScalar(1.7);
  const contract=boat.userData.warshipV6?.boardingContract;
  const units=prior.tramRetreat.units.map(u=>{const point=new T.Vector3(...u.retreat.position),hit=ground.sample(point);return {uid:u.uid,position:point.toArray(),radialHeight:point.length(),water:160+officialOceanLevelAt(point.clone().normalize()),drySupport:hit?.toArray()||null,priorBlocked:u.retreat.blocked,priorFinished:u.retreat.finished};});
  console.log('EVAC samples',units.filter(u=>u.drySupport).length,'/',units.length);
  const docks=[],used=[];
  for(let i=0;i<3;i++){
   const start=performance.now(),dock=nav.dock(boat,land,used,{maxDistance:24,shoreStep:2});
   const result={index:i,valid:dock.valid,searchRadius:24,elapsedMs:performance.now()-start,reason:dock.reason,attempts:dock.attempts,rejected:dock.rejected,hullObstacles:dock.hullObstacles,entryObstacles:dock.entryObstacles,lastFailure:dock.lastFailure,position:dock.position?.toArray(),shorePoint:dock.shorePoint?.toArray(),shoreObject:dock.shoreObject,angle:dock.angle};
   if(dock.valid){used.push(dock);result.routes=units.map(u=>{const r=ground.approach(new T.Vector3(...u.position),dock.shorePoint);return {uid:u.uid,valid:!!r.valid,reason:r.reason,length:r.length,startCorrection:r.startCorrection};});}
   docks.push(result);console.log('EVAC dock',i,JSON.stringify(result));if(!dock.valid)break;
  }
  return {physicalBoardingValidated:false,scope:'Read-only actual 8931 authored scene. Actor coordinates are prior diagnostic 240-second snapshot inputs; actors are not moved, saves are not changed, no natural boarding claim. Search bounded to 24m and stops on first invalid berth. No deck/seat route claimed without valid shore berth.',priorSourceHash:prior.sourceHash,landDir:land.toArray(),contract,scale:1.7,units,docks,uniqueBerths:used.length,requiredBerths:3,stats:nav.stats};
 },prior);
 const out='TigerMessenger/artifacts/pipeline/saihoji-evacuation-boarding';await mkdir(out,{recursive:true});await writeFile(out+'/physical-route-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({physicalBoardingValidated:report.physicalBoardingValidated,drySupportedUnits:report.units.filter(u=>u.drySupport).length,uniqueBerths:report.uniqueBerths,output:out}));
}finally{await b.close();}
