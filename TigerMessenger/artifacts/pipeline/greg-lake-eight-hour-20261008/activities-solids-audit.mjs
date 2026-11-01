import * as T from 'three';
const ctx=new Proxy({getImageData:()=>({data:new Uint8ClampedArray(16)}),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const el=()=>{const listeners={};return{style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>ctx};};globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:el,createElementNS:el};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;root.updateMatrixWorld(true);

import fs from 'node:fs';
import {createWarshipClearance} from '../../../src/world/warshipClearance.js';
await inner.userData.tiger.userData.swampTigerV2Ready;root.updateMatrixWorld(true);
const obstacles=[...inner.userData.gregSpatialPlan.walkMeshes,...inner.userData.tigerWalkSurfaces,inner.getObjectByName('swamp-sinkhole-wall'),inner.getObjectByName('greg-natural-cliff-rock')].filter(Boolean);
const groups=obstacles.map(mesh=>{mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);return {box,meshes:[{mesh,box}]};});
const actors=[...inner.userData.lotuses,inner.userData.shipyard.departure],results=[];let tests=0;const started=performance.now();

const times=[];
const full=process.argv[2]==='full';
const coarse=process.argv[3]?JSON.parse(process.argv[3]):[0,2,5,8.2,8.8,11,14,16,19,21,35,55,75,95,120,150,180];
for(let frame=0;frame<= (full?82:180)*30;frame++){
 const t=frame/30;root.userData.update(1/30,t,{});if(full?frame%6!==0:!coarse.some(x=>Math.abs(x-t)<.001))continue;times.push(t);root.updateMatrixWorld(true);
 for(const [i,actor]of actors.entries()){
  if(full&&t>(i<5?inner.userData.flowerBoyActivities.navigation.records[i].period:52))continue;
  if(!actor.visible)continue;const engine=createWarshipClearance(actor,groups),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();actor.matrixWorld.decompose(pos,q,scale);const check=engine.clear(pos,q,scale);tests++;if(!check.clear)results.push({t,actor:i<5?'flower-'+i:'departure',triangles:engine.triangleCount,...check});
 }
 if(!full||frame%300===0)console.log('sample',t,results.length);
}

const report={method:'actual visible indexed and nonindexed triangles incl instanced crew/oars tested against actual world-space wall/stair/walking-slab triangles by BVH edge/triangle crossing; surfaces only, not volumetric containment',tests,times,ms:performance.now()-started,results};fs.writeFileSync(new URL('activities-solids-'+(process.argv[2]||'before')+'.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({tests,contacts:results.length,ms:report.ms}));
