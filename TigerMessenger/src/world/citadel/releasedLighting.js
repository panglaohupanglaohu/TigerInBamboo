import * as THREE from 'three';
import {PLAZA_R03,PLAZA_LAYOUT} from './newPlazaLayout.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';
import {P} from '../../core/params.js';
export function alignReleasedLighting(castle,radius=160){
 if(!PLAZA_R03)return;
 const old=castle.getObjectByName('highland-light-volumes'),city=castle.getObjectByName('highland-west-city'),fresh=city?.getObjectByName('citadel-new-city-lighting'),terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 if(!old||!fresh||!terrain)return;
 castle.updateWorldMatrix(true,true);
 const up=new THREE.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=1000;
 const report={lamps:[],points:[],scope:'Final terrain lamp grounding; relocated city light anchors. Shadow and color refinement pending.'};
 for(const holder of old.children.filter(o=>o.userData.lampId)){
  const position=holder.getWorldPosition(new THREE.Vector3());ray.set(position.clone().addScaledVector(up,500),up.clone().negate());
  const hit=ray.intersectObject(terrain,false)[0],valid=!!hit&&hit.point.length()>radius+officialOceanLevelAt(hit.point)+.15;
  holder.visible=valid;
  if(valid)holder.position.copy(old.worldToLocal(hit.point.clone()));
  const shell=holder.getObjectByName('lamp-volume-shell');if(shell){shell.visible=false;shell.userData.retiredByLayout=true;}
  report.lamps.push({name:holder.name,visible:valid,castlePosition:castle.worldToLocal(holder.getWorldPosition(new THREE.Vector3())).toArray()});
 }
 // Frozen parcel edits may be rejected after a terrain rebuild. Preserve
 // the existing old-city anchors in that case, while still aligning the
 // independent new-city lights below.
 const parcels=castle.getObjectByName('old-city-staggered-parcels');
 const candidateSupports=castle.userData.oldCityParcelCandidate?.supports;
 const supports=parcels&&Array.isArray(candidateSupports)?candidateSupports:[];
 report.oldCityAnchors=supports.length?'parcel-supports':'preserved-existing';
 old.children.filter(o=>o.isPointLight).forEach((light,i)=>{
  const support=supports[[0,3,6][i]];if(!support)return;
  const p=new THREE.Vector3(...support.placed);p.y+=3;
  light.position.copy(old.worldToLocal(parcels.localToWorld(p)));
 });
 const newPoints=fresh.children.filter(o=>o.isPointLight);
 // Follow the actual rebuilt opening, rather than the pre-compaction stair
 // coordinate (ten metres in front of the present gate).
 const mainGate=city.getObjectByName('citadel-new-main-gate');
 if(mainGate){
  const opening=mainGate.userData.opening;
  const point=mainGate.localToWorld(new THREE.Vector3(0,opening.springHeight*.72,2.8));
  newPoints[0].position.copy(fresh.worldToLocal(point));
  newPoints[0].distance=14;
 }
 newPoints[1].position.set(PLAZA_LAYOUT.statueX-3.5,7.5,81);
 const gate=city.getObjectByName('citadel-front-harbor')?.userData.layout?.gate;
 if(gate)newPoints[2].position.set(gate[0],gate[1]+3.2,gate[2]+1);
 // Real light at existing lantern heads: reveal the intermediate landings
 // without adding lamps, or increasing the fixed eight-slot render pool.
 for(const index of [4,7]){
  const holder=fresh.getObjectByName('new-city-lantern-'+index);
  if(!holder)continue;
  const light=new THREE.PointLight(0xffb368,0,10,2);
  light.name='new-city-light-landing-'+index;
  light.position.copy(fresh.worldToLocal(holder.localToWorld(new THREE.Vector3(0,2.8,0))));
  fresh.add(light);newPoints.push(light);
 }
 // Warm reflected fill on the exposed upper fronts, separate from the
 // gateway practical. These remain candidates in the existing eight lights.
 for(const [name,position] of [['west',[45,35,26]],['east',[83,39,24]]]){
  const light=new THREE.PointLight(0xffd7ad,0,40,2);
  light.name='new-city-light-upper-'+name;light.position.set(...position);
  fresh.add(light);newPoints.push(light);
 }
 // Two cached architectural shadows. Moving characters are deliberately not
 // included in this static mask; actor shadows belong to the character pass.
 for(const name of ['citadel-target-castle-silhouette','citadel-new-main-gate','citadel-court-structure','citadel-plaza-hero-statue','west-city-plaza-deck','west-city-plaza-paving-ring','citadel-front-harbor']){
  castle.getObjectByName(name)?.traverse(o=>{if(o.isMesh){o.layers.enable(3);o.castShadow=true;o.receiveShadow=true;}});
 }
 for(const light of newPoints.slice(0,2)){
  light.userData.citadelShadowSlot=newPoints.indexOf(light);
  light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.near=.2;light.shadow.camera.far=light.distance;
  light.shadow.camera.layers.set(3);light.shadow.bias=-.00015;light.shadow.normalBias=.025;
  light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;
 }
 castle.userData.invalidateCitadelShadowMaps=()=>newPoints.slice(0,2).forEach(l=>l.shadow.needsUpdate=true);
 const profiles={old:[{intensity:105,godotEnergy:6,color:0xffa55d},{intensity:145,godotEnergy:8,color:0xffac65},{intensity:180,godotEnergy:10,color:0xffb56f}],new:[{intensity:190,godotEnergy:18,color:0xffab5c},{intensity:85,godotEnergy:8,color:0xffb873},{intensity:65,godotEnergy:25,color:0xffa55a},{intensity:45,godotEnergy:7,color:0xffb368},{intensity:45,godotEnergy:7,color:0xffb368},{intensity:240,godotEnergy:45,color:0xffd7ad},{intensity:200,godotEnergy:38,color:0xffd0a0}]};
 for(const [side,root]of [['old',old],['new',fresh]]){
  const lights=root.children.filter(o=>o.isPointLight),prior=side==='old'?root.update:root.userData.update;
  lights.forEach((light,i)=>{light.color.setHex(profiles[side][i].color);light.layers.enable(1);});
  const update=(...args)=>{prior(...args);const phase=side==='old'?(args[1]??P.timeOfDay):args[0],weight=nightWeightAt(phase);lights.forEach((light,i)=>light.intensity=profiles[side][i].intensity*weight);};
  root.userData.update=update;if(side==='old')root.update=update;
 }
 castle.updateWorldMatrix(true,true);
 for(const [side,root]of [['old',old],['new',fresh]])root.children.filter(o=>o.isPointLight).forEach((light,i)=>{
  const spec=profiles[side][i];
  report.points.push({side,index:i,name:light.name,castlePosition:castle.worldToLocal(light.getWorldPosition(new THREE.Vector3())).toArray(),color:light.color.getHex(),radius:light.distance,godotEnergy:spec.godotEnergy,shadow:light.castShadow,shadowMapSize:light.castShadow?512:0});
 });
 fresh.userData.update(P.timeOfDay);old.update(0,P.timeOfDay);
 castle.userData.releasedLighting=report;return report;
}
