import {citadelRevision} from "./layoutRelease.js";
import * as THREE from 'three';
import {buildCitadelCypress} from './citadelGarden.js';
import {buildSlopeShrub} from '../highlandCitadelDesign.js';
import {createOceanHeightSampler} from './oceanSurface.js';
import {mergeStaticGroup} from '../geometryMerge.js';
// Original Blender cypress family, grounded on the actual final cliff outside the plaza.
export function buildRetainingPlanting(castle,radius=160){
 const city=castle.getObjectByName('highland-west-city');if(!city||city.getObjectByName('citadel-retaining-planting'))return;
 castle.updateWorldMatrix(true,true);const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),up=new THREE.Vector3(0,1,0).transformDirection(city.matrixWorld),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=200;
 const sea=createOceanHeightSampler(city,radius),root=new THREE.Group();root.name='citadel-retaining-planting';city.add(root);
 const shoulder=city.getObjectByName('new-city-rock-shoulder');
 const sample=(x,z)=>{ray.set(city.localToWorld(new THREE.Vector3(x,50,z)),up.clone().negate());const hit=ray.intersectObjects(shoulder?[terrain,shoulder]:[terrain],false)[0];return hit?city.worldToLocal(hit.point.clone()).y:null;};
 const mats={shrubDeep:new THREE.MeshStandardMaterial({color:0x395c48,roughness:1,flatShading:true}),shrubMid:new THREE.MeshStandardMaterial({color:0x567653,roughness:1,flatShading:true}),shrubLight:new THREE.MeshStandardMaterial({color:0x73916a,roughness:1,flatShading:true})};
 const planted=[],skipped=[];
 const candidates=[[50.5,90.6,.75],[52,91.7,.42],[55.8,91.2,.60],[63.9,90.8,.82],[65.2,91.8,.49],[70,90.8,.45],[75.2,91.1,.78]];
 if(shoulder)candidates.push([88.6,65.5,.55],[88.9,72,.65],[89.2,78,.48],[88.6,84,.72]);
 for(const [i,[x,z,size]]of candidates.entries()){
  if(typeof location!=='undefined'&&citadelRevision('citadelFrontGate')==='1'&&x>=49&&x<=68&&z>=88){skipped.push({x,z,reason:'integrated-front-gate corridor'});continue;}
  const feet=[[0,0],[-.18,0],[.18,0],[0,-.18],[0,.18]].map(([dx,dz])=>sample(x+dx,z+dz));
  if(feet.some(y=>y===null)||Math.max(...feet)-Math.min(...feet)>.7||Math.min(...feet)<sea(x,z)+.4){skipped.push({x,z,feet});continue;}
  const y=Math.min(...feet)-.07,tree=buildCitadelCypress(size,.71*i);tree.position.set(x,y,z);root.add(tree);planted.push({kind:'original-blender-cypress',x,y,z,size,feet});
  for(let j=0;j<3;j++){
   const sx=x+(j-1)*.62,sz=z+.25+Math.sin(i+j)*.18,sy=sample(sx,sz);if(sy===null||sy<sea(sx,sz)+.25)continue;
   root.add(buildSlopeShrub(mats,500+i*7+j,sx,sz,.40,{surfaceY:sy-.07}));planted.push({kind:'rock-shrub',x:sx,y:sy-.07,z:sz,size:.40});
  }
 }
 root.userData.planting={source:'existing Blender citadel-cypress family; no replacement trees',terrain:terrain.name,planted,skipped,plazaEdge:88.5,minimumZ:90.6};
 mergeStaticGroup(root,{mergedTag:'retaining-planting',onSurface:m=>{m.name='retaining-cliff-planting';}});return root;
}
