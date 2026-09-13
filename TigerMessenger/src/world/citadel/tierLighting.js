import * as THREE from 'three';
import {P} from '../../core/params.js';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';
export const OLD_CITY_TIER_LIGHTS=[
 {id:'old-shore-court',position:[-8,8,19],color:0xff9b50,intensity:240,radius:20,godotEnergy:40},
 {id:'old-middle-court',position:[12,18,-7],color:0xffac60,intensity:320,radius:22,godotEnergy:55},
 {id:'old-upper-court',position:[-8,26,-20],color:0xffbd75,intensity:420,radius:26,godotEnergy:70}
];
export function applyCitadelTierLighting(castle){
 if(!castle.userData.oldShoreApproach||castle.userData.tierLighting)return null;
 const oldRoot=castle.getObjectByName('highland-light-volumes'),newRoot=castle.getObjectByName('citadel-new-city-lighting'),city=castle.getObjectByName('highland-west-city');
 if(!oldRoot||!newRoot||!city)return null;
 const oldExisting=[];oldRoot.traverse(o=>{if(o.isPointLight)oldExisting.push(o);});
 const oldPoints=OLD_CITY_TIER_LIGHTS.map((spec,i)=>{const light=oldExisting[i]||new THREE.PointLight();oldRoot.add(light);light.name='old-city-tier-'+spec.id;light.position.fromArray(spec.position);light.color.setHex(spec.color);light.distance=spec.radius;light.decay=2;light.castShadow=false;return light;});
 for(const light of oldExisting.slice(oldPoints.length))light.removeFromParent();
 const dockY=city.userData.frontHarborApproach.dockY;
 const newSpecs=[
 {id:'main-gate',position:[60,23,21],color:0xffac58,intensity:350,radius:30,godotEnergy:140},
 {id:'plaza',position:[59,8,70],color:0xffb965,intensity:320,radius:24,godotEnergy:25},
 {id:'shore-gate',position:[34,dockY+3.2,93],color:0xffa04c,intensity:260,radius:20,godotEnergy:45}
 ];
 const newPoints=newRoot.children.filter(o=>o.isPointLight);
 if(newPoints.length!==3)throw new Error('Expected three authored new-city lights');
 newPoints.forEach((light,i)=>{const spec=newSpecs[i];light.position.fromArray(spec.position);light.color.setHex(spec.color);light.distance=spec.radius;});
 const oldUpdate=oldRoot.update,newUpdate=newRoot.userData.update;
 oldRoot.update=oldRoot.userData.update=(time,phase=P.timeOfDay)=>{oldUpdate(time,phase);const weight=nightWeightAt(phase);oldPoints.forEach((light,i)=>light.intensity=OLD_CITY_TIER_LIGHTS[i].intensity*weight);};
 newRoot.userData.update=phase=>{newUpdate(phase);const weight=nightWeightAt(phase);newPoints.forEach((light,i)=>light.intensity=newSpecs[i].intensity*weight);};
 const report={version:1,old:OLD_CITY_TIER_LIGHTS,new:newSpecs,oldBefore:oldExisting.length,newBefore:3,oldAfter:3,newAfter:3,scope:'candidate; separate old hillside courts and new gate/plaza/quay; six unshadowed points'};
 castle.userData.tierLighting=report;oldRoot.update(0);newRoot.userData.update(P.timeOfDay);return report;
}
