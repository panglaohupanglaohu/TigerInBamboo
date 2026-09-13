import * as THREE from 'three';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';
export const NEW_CITY_LIGHTING={version:3,frame:'new-city-authored-local',points:[
 {id:'main-gate',position:[60,23,21],color:0xffa348,intensity:220,radius:24,godotEnergy:80},
 {id:'plaza',position:[59,8,70],color:0xffb653,intensity:70,radius:18,godotEnergy:15},
 {id:'moon-fill',position:[30,60,42],color:0x629be8,intensity:6500,radius:160,godotEnergy:3.5}
],lanterns:[[54,4,76],[66,4,76],[54,4,63],[66,4,63],[54,10,32],[66,10,32],[54,16,13],[66,16,13]]};
export function buildNewCityLighting(){
 const root=new THREE.Group();root.name='citadel-new-city-lighting';
 const iron=new THREE.MeshStandardMaterial({color:0x44484a,roughness:.85,metalness:.25});
 const glow=new THREE.MeshStandardMaterial({name:'citadel-new-lantern-emission',color:0xe5ba71,emissive:0xffad64,emissiveIntensity:0,roughness:.7});
 NEW_CITY_LIGHTING.lanterns.forEach(([x,y,z],i)=>{
  const holder=new THREE.Group();holder.name='new-city-lantern-'+i;holder.position.set(x,y,z);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.11,2.6,6),iron);pole.position.y=1.3;holder.add(pole);
  const head=new THREE.Mesh(new THREE.OctahedronGeometry(.26),glow);head.position.y=2.8;head.name='new-city-lantern-head';holder.add(head);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.38,.23,4),iron);cap.position.y=3.08;holder.add(cap);root.add(holder);
 });
 const points=NEW_CITY_LIGHTING.points.map(spec=>{
  const light=new THREE.PointLight(spec.color,0,spec.radius,2);light.name='new-city-light-'+spec.id;
  light.position.fromArray(spec.position);light.castShadow=false;root.add(light);return light;
 });
 root.userData.update=(phase)=>{const weight=nightWeightAt(phase);glow.emissiveIntensity=weight*2;points.forEach((p,i)=>p.intensity=weight*NEW_CITY_LIGHTING.points[i].intensity);root.userData.nightWeight=weight;};
 root.userData.manifest=NEW_CITY_LIGHTING;
 root.userData.update(.5);
 return root;
}
