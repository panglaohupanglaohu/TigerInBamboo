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
 const parcels=castle.getObjectByName('old-city-staggered-parcels'),supports=castle.userData.oldCityParcelCandidate.supports;
 old.children.filter(o=>o.isPointLight).forEach((light,i)=>{
  const support=supports[[0,3,6][i]];if(!support)return;
  const p=new THREE.Vector3(...support.placed);p.y+=3;
  light.position.copy(old.worldToLocal(parcels.localToWorld(p)));
 });
 const newPoints=fresh.children.filter(o=>o.isPointLight);
 newPoints[1].position.set(PLAZA_LAYOUT.statueX,9,80);
 const gate=city.getObjectByName('citadel-front-harbor')?.userData.layout?.gate;
 if(gate)newPoints[2].position.set(gate[0],gate[1]+3.2,gate[2]+1);
 // Two cached architectural shadows. Moving characters are deliberately not
 // included in this static mask; actor shadows belong to the character pass.
 for(const name of ['citadel-target-castle-silhouette','citadel-plaza-hero-statue','west-city-plaza-deck','west-city-plaza-paving-ring','citadel-front-harbor']){
  castle.getObjectByName(name)?.traverse(o=>{if(o.isMesh){o.layers.enable(3);o.castShadow=true;o.receiveShadow=true;}});
 }
 for(const light of newPoints.slice(0,2)){
  light.userData.citadelShadowSlot=newPoints.indexOf(light);
  light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.near=.2;light.shadow.camera.far=light.distance;
  light.shadow.camera.layers.set(3);light.shadow.bias=-.00015;light.shadow.normalBias=.025;
  light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;
 }
 castle.userData.invalidateCitadelShadowMaps=()=>newPoints.slice(0,2).forEach(l=>l.shadow.needsUpdate=true);
 const profiles={old:[{intensity:105,godotEnergy:6,color:0xffa55d},{intensity:145,godotEnergy:8,color:0xffac65},{intensity:180,godotEnergy:10,color:0xffb56f}],new:[{intensity:300,godotEnergy:95,color:0xffab5c},{intensity:85,godotEnergy:20,color:0xffb873},{intensity:65,godotEnergy:25,color:0xffa55a}]};
 for(const [side,root]of [['old',old],['new',fresh]]){
  const lights=root.children.filter(o=>o.isPointLight),prior=side==='old'?root.update:root.userData.update;
  lights.forEach((light,i)=>{light.color.setHex(profiles[side][i].color);light.layers.enable(1);});
  const update=(...args)=>{prior(...args);const phase=side==='old'?(args[1]??P.timeOfDay):args[0],weight=nightWeightAt(phase);lights.forEach((light,i)=>light.intensity=profiles[side][i].intensity*weight);};
  root.userData.update=update;if(side==='old')root.update=update;
 }
 castle.updateWorldMatrix(true,true);
 for(const [side,root]of [['old',old],['new',fresh]])root.children.filter(o=>o.isPointLight).forEach((light,i)=>{
  const spec=profiles[side][i];
  report.points.push({side,index:i,castlePosition:castle.worldToLocal(light.getWorldPosition(new THREE.Vector3())).toArray(),color:light.color.getHex(),radius:light.distance,godotEnergy:spec.godotEnergy,shadow:light.castShadow,shadowMapSize:light.castShadow?512:0});
 });
 fresh.userData.update(P.timeOfDay);old.update(0,P.timeOfDay);
 castle.userData.releasedLighting=report;return report;
}
