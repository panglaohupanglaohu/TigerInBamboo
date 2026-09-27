import * as THREE from 'three';
import {getCityFrame, dirToCityLocal} from './crystalCityLayout.js';

// Accepted 2026-09-27: exactly the 30-degree, top-view counterclockwise trial.
// Apply after authored finishes, before gameplay caches and ocean pruning.
export function relocateCrystalCore({scene,pack,swamp,port}) {
 const city=pack.moebius;
 if(!swamp || city.corePlacement)return;
 const q=new THREE.Quaternion().setFromAxisAngle(getCityFrame().center,-Math.PI/6);
 const rotation=new THREE.Matrix4().makeRotationFromQuaternion(q);
 const roots=[...city.crystals.slice(0,3).map(r=>r.group),swamp];
 const clouds=scene.getObjectByName('crystal-sunset-clouds');
 if(clouds)roots.push(clouds);
 for(const o of city.v7Shores?.children||[])
  if(!o.name||/swamp|garden-connector/.test(o.name)||/^v7-bank-rock-[012]$/.test(o.name))roots.push(o);
 scene.updateMatrixWorld(true);
 const snapshots=roots.map(o=>({o,m:o.matrixWorld.clone()}));
 for(const {o,m} of snapshots){
  o.parent.matrixWorld.clone().invert().multiply(rotation).multiply(m).decompose(o.position,o.quaternion,o.scale);
  o.updateMatrix();
 }
 for(const r of city.crystals.slice(0,3)){
  r.dir.applyQuaternion(q);Object.assign(r,dirToCityLocal(r.dir));
 }
 city.v7Shores?.userData.rotateCoreSite?.(q);
 city.birdFlocks?.rotateCoreHomes?.(q);
 port?.rotateWorld(q);
 // Only the original three tower pods; the bookshop pod stays with its shop.
 for(const pod of pack.bubblePods.children.slice(0,3)){
  const orbit=pod.userData.orbit;
  if(orbit)for(const key of ['center','up','right','front'])orbit[key].applyQuaternion(q);
  pod.userData.anchorDirection?.applyQuaternion(q);
 }
 for(const key of ['grandDir','grandTopTarget'])pack[key]?.applyQuaternion(q);
 for(const key of ['centerDir','home','wind'])pack.hallFlock?.[key]?.applyQuaternion(q);
 for(const flock of [pack.hallFlock,pack.flock])
  flock?.obstacles?.slice(0,3).forEach(o=>o.dir.applyQuaternion(q));
 scene.updateMatrixWorld(true);
 const lake=scene.getObjectByName('crystal-v10-lake');
 const local=dirToCityLocal(swamp.position.clone().normalize());
 if(lake?.material.uniforms){
  lake.material.uniforms.swamp.value.set(local.lx*140,local.lz*140);
  city.crystals.slice(0,3).forEach((r,i)=>lake.material.uniforms.towers.value[i].set(r.lx*140,r.lz*140,r.h));
 }
 scene.userData.moebiusV10SkyUp?.applyQuaternion(q);
 // Keep planted islets out of the relocated open bowl.
 const islets=scene.getObjectByName('crystal-v10-planted-islets');
 for(const island of [...(islets?.children||[])])
  if(island.position.clone().normalize().angleTo(swamp.position.clone().normalize())*140<24)islets.remove(island);
 city.corePlacement={degrees:30,scope:'mother, two satellites, swamp, shores, port and navigation',swamp:dirToCityLocal(swamp.position.clone().normalize())};
}
