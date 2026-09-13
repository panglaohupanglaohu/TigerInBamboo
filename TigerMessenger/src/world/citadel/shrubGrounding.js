import * as THREE from 'three';
import {mergeStaticGroup} from '../geometryMerge.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
export function groundCitadelShrubs(castle,radius=160){
 const grove=castle.getObjectByName('highland-slope-shrub-vegetation'),terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 if(!grove?.userData.needsFinalGrounding||!terrain)return;
 castle.updateWorldMatrix(true,true);
 const up=new THREE.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=1000;
 const report={placed:[],omitted:[],source:terrain.name};
 for(const shrub of grove.children.filter(o=>o.userData.role==='slope-shrub')){
  const root=shrub.getWorldPosition(new THREE.Vector3()),hits=[];
  for(const [x,z]of [[0,0],[.25,0],[-.25,0],[0,.25],[0,-.25]]){
   const p=root.clone().add(new THREE.Vector3(x,0,z).transformDirection(castle.matrixWorld).multiplyScalar(Math.hypot(x,z)));
   ray.set(p.addScaledVector(up,500),up.clone().negate());const hit=ray.intersectObject(terrain,false)[0];
   if(hit&&hit.point.length()>radius+officialOceanLevelAt(hit.point)+.15)hits.push(grove.worldToLocal(hit.point.clone()));
  }
  const shadow=grove.children.find(o=>o.userData.host===shrub.name);
  if(hits.length!==5||Math.max(...hits.map(p=>p.y))-Math.min(...hits.map(p=>p.y))>.8){shrub.visible=false;if(shadow)shadow.visible=false;report.omitted.push(shrub.name);continue;}
  const oldY=shrub.position.y,y=Math.min(...hits.map(p=>p.y))-.04;
  shrub.position.y=y;if(shadow)shadow.position.y=y+.05;
  report.placed.push({name:shrub.name,x:shrub.position.x,z:shrub.position.z,oldY,y,footprintDelta:Math.max(...hits.map(p=>p.y))-Math.min(...hits.map(p=>p.y))});
 }
 // Omitted decorations must not be flattened back into visible merged geometry.
 for(const child of [...grove.children])if(!child.visible)child.removeFromParent();
 mergeStaticGroup(grove,{mergedTag:'highland-slope-shrub-vegetation'});
 grove.userData.needsFinalGrounding=false;grove.userData.groundPlacement=report;return report;
}
