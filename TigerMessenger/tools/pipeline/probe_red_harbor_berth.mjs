import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage();
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-front-harbor'),null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createFisherBoat}=await import('/TigerMessenger/src/assets/harbor.js');
  const {findDockConnector}=await import('/TigerMessenger/src/world/warshipDockConnector.js');
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');
  const solver=createWarshipWaterRoutes(t.scene,160),boat=createFisherBoat();boat.scale.setScalar(1.7);
  city.updateWorldMatrix(true,true);
  const target=city.localToWorld(new T.Vector3(63,-5.5,108)).normalize();
  const start=performance.now();
  const occupied=[];t.scene.traverseVisible(o=>{if(o.userData.warshipV6)occupied.push({name:o.name,position:o.getWorldPosition(new T.Vector3())});});
  const dock=solver.dock(boat,target,occupied,{maxDistance:4,shoreStep:1,shoreName:'integrated-quay-strip',approachOffsets:[3,5,7,9,11,13]});
  let connector=null;
  if(dock.valid){const hull=createWarshipClearance(boat,solver.obstacles);connector=findDockConnector([dock.entry],dock.position,new T.Vector3(1,0,0).applyQuaternion(dock.quaternion),solver.position,solver.clear,hull,boat.scale,160);}
  let ocean=null;
  if(connector?.valid){
   const junction=t.scene.getObjectByName('canal-junction-box');
   const origin=(junction.userData.up?.clone()??junction.getWorldPosition(new T.Vector3())).normalize();
   const start=solver.berth(origin,[],{maxDistance:64});
   const route=start?solver.route(start,connector.entry,{maxVisits:2000}):null;
   ocean={valid:!!route,origin:origin.toArray(),originSurface:solver.surface(origin),startOffsetMetres:start?start.angleTo(origin)*160:null,start:start?.toArray(),failure:route?null:solver.route.lastFailure,points:route?.points.map(p=>solver.position(p).toArray()),length:route?.length,visits:route?.visits};
  }
  return {valid:dock.valid,connector,ocean,occupied:occupied.map(o=>({name:o.name,position:o.position.toArray()})),elapsedMs:performance.now()-start,stats:solver.stats,attempts:dock.attempts,rejected:dock.rejected,reason:dock.reason,lastFailure:dock.lastFailure,entryObstacles:dock.entryObstacles,hullObstacles:dock.hullObstacles,firstHullPose:dock.firstHullPose,firstEntryPose:dock.firstEntryPose,pose:dock.valid?{position:dock.position.toArray(),quaternion:dock.quaternion.toArray(),shorePoint:dock.shorePoint.toArray(),angle:dock.angle,entry:dock.entry.toArray(),approach:dock.approach}:null,scope:'Bounded actual 1.7-scale reinforcement hull/shore probe near the new east quay. Does not certify animated boarding, occupied berth admission or full sea route.'};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/red-berth-probe.json',import.meta.url),JSON.stringify(report,null,2));
 if(report.valid&&report.connector?.valid&&report.ocean?.valid){const shared={version:2,frame:'Three world',enabled:false,source:'tools/pipeline/probe_red_harbor_berth.mjs',boatScale:1.7,ocean:report.ocean,connector:report.connector,berth:report.pose,scope:'Candidate only; complete current-geometry ship-pose validation required.'};for(const path of ['assets/navigation/citadel-red-arrival-candidate.json','godot/data/citadel-red-arrival-candidate.json'])await writeFile(new URL('../../'+path,import.meta.url),JSON.stringify(shared));}
 console.log(JSON.stringify({valid:report.valid,connector:report.connector?{valid:report.connector.valid,checks:report.connector.checks,length:report.connector.length}:null,ocean:report.ocean?{valid:report.ocean.valid,length:report.ocean.length,visits:report.ocean.visits,failure:report.ocean.failure}:null,elapsedMs:report.elapsedMs}));
} finally {await browser.close();}
