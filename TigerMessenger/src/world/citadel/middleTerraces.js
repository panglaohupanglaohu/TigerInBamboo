import * as THREE from 'three';
import baked from '../../../assets/models/optimized/citadel-middle-terraces/middleTerracesR01.js';
import {mergeStaticGroup} from '../geometryMerge.js';
export function buildMiddleTerraces(district,parts,stone,paving){
 const root=new THREE.Group();root.name='citadel-middle-terraces';const footprints=[];const coping=stone.clone();coping.color.setHex(0xd9ceb8);
 parts.forEach(([dx,w,dz,d],part)=>{
  const x=60+dx,z=district.z+dz,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
  let points=part<2?[[x0+5.5,z0],[x1,z0],[x1,z1],[x0+3.2,z1],[x0,z1-3.2],[x0,z0+5.5]]:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  if(part===1)points=points.map(([px,pz])=>[2*x-px,pz]).reverse();
  footprints.push({part,points,floor:district.y});
  if(part<2)points.forEach((a,i)=>{const b=points[(i+1)%points.length],innerX=part===0?x1:x0;
   if(Math.abs(a[0]-innerX)<.01&&Math.abs(b[0]-innerX)<.01||Math.abs(a[1]-z0)<.01&&Math.abs(b[1]-z0)<.01)return;
   const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   for(const cap of [false,true]){const m=new THREE.Mesh(new THREE.BoxGeometry(length-.04,cap?.14:.85,cap?.50:.34),cap?coping:stone);m.name=cap?'middle-terrace-coping':'middle-terrace-guard';m.position.set((a[0]+b[0])/2,district.y+(cap?.92:.425),(a[1]+b[1])/2);m.rotation.y=-Math.atan2(dz,dx);m.castShadow=true;m.receiveShadow=true;root.add(m);}
  });
  const shape=new THREE.Shape(points.map(([px,pz])=>new THREE.Vector2(px,-pz)));
  for(const walk of [false,true]){
   const g=new THREE.ExtrudeGeometry(shape,{depth:walk?.2:4,bevelEnabled:false}),m=new THREE.Mesh(g,walk?paving:stone);
   m.rotation.x=-Math.PI/2;m.position.y=district.y-(walk?.2:4.1);m.name=walk?'middle-terrace-walk':'middle-terrace-base';m.castShadow=true;m.receiveShadow=true;root.add(m);
  }
 });
 mergeStaticGroup(root,{mergedTag:'middle-terraces',onSurface:m=>{const walk=m.material===paving;m.name=walk?'middle-terrace-walkable':'middle-terrace-solid';m.userData.westCityWalkable=walk;m.userData.isCitadelTerrain=walk;m.userData.citadelSolidExterior=!walk;}});
 if(baked){root.children.forEach((m,i)=>{const part=baked.parts[i],input=m.geometry.index?m.geometry.toNonIndexed():m.geometry;let digest=2166136261;for(const v of input.attributes.position.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;if(!part||digest!==part.sourceDigest)throw new Error('Middle terraces changed: regenerate Blender asset');if(input!==m.geometry)input.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));m.geometry.dispose();m.geometry=g;});root.userData.sourceBlender=baked.source;}
 root.userData.footprints=footprints;return root;
}
