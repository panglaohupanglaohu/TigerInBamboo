import * as THREE from 'three';
import {bookshopTownPose,seatTownObject,townSurfacePoint} from './bookshopTownSite.js';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {warpFactoryToSphere} from './bookshopSurfaceWarp.js';
import {mergeStaticGroup} from './geometryMerge.js';

// Same spherical court transforms used by the actual factories and railway.
export function factoryFreightStops(R=160){
 const base=new THREE.Group(),pose=bookshopTownPose(R);base.position.copy(pose.position);base.quaternion.copy(pose.quaternion);
 return [-2.15,Math.PI,2.15].map((a,i)=>{
  const d=new THREE.Group();base.add(d);const x=Math.sin(a)*48,z=32+Math.cos(a)*48;
  seatTownObject(base,d,x,z,Math.atan2(-x,32-z),R);d.updateWorldMatrix(true,false);
  const point=(x,z)=>d.localToWorld(townSurfacePoint(d,x,z,R,1.12));
  return {name:['locust','ant','beetle'][i],points:[point(-24,-44),point(-12,-44),point(0,-44),point(12,-44),point(24,-44)],center:point(0,-44)};
 });
}
export function buildFactoryLoadingYards({districts,R,platforms}){
 for(const d of districts){
  const yard=new THREE.Group();yard.name=d.name+'-rear-loading-fingers';d.add(yard);
  const{M,box,beam,crate,sign}=factoryKit(yard);
  // Five distinct projecting platforms, with deep gaps, never an annular slab.
  for(let i=0;i<5;i++){
   const x=-13+i*6.6,length=8+(i%2)*1.3,end=-41.6,start=end+length;
   box(3.7,.65,length,x,.325,(start+end)/2,M.stone);
   for(const side of[-1,1]){
    beam([x+side*1.72,.70,end+.2],[x+side*1.72,.70,start-.8],.065,M.brass);
    for(let z=end+.7;z<start-1;z+=1.5)box(.09,.7,.09,x+side*1.7,1.0,z,M.iron);
   }
   box(4,.18,5.6,x,3.8,start-2,M.slate);
   for(const side of[-1,1])for(const z of[start-.2,start-4.6])box(.12,3.8,.12,x+side*1.65,1.9,z,M.iron);
   for(let j=0;j<3;j++)crate(x+(j%2)*1.1-.6,.65,start-1-j*1.45,.85);
   sign('卸货 '+(i+1),2.4,.52,x,3.35,start+.1);
   for(let k=0;k<8;k++)box(.30,.08,.22,x-1.6+k*.44,.7,end+.1,k%2?M.iron:M.brass);
   // Broad stair back into the workshop service yard.
   for(let k=0;k<3;k++)box(2.8,.22*(3-k),.48,x,.11*(3-k),start+.24+k*.48,M.stone);
   for(let z=end+.7;z<start;z+=1.4){const center=d.localToWorld(townSurfacePoint(d,x,z,R,1.57));const q=d.getWorldQuaternion(new THREE.Quaternion());platforms.push({mesh:yard,center,normal:center.clone().normalize(),right:new THREE.Vector3(1,0,0).applyQuaternion(q),forward:new THREE.Vector3(0,0,1).applyQuaternion(q),half:new THREE.Vector3(1.8,.2,.8),topHeight:R+1.57,kind:'factory-loading-platform'});}
  }
  // Rail-side travelling gantry, clear above the double freight line.
  for(const x of[-18,18])for(const z of[-40,-48])box(.25,6.5,.25,x,3.25,z,M.iron);
  for(const z of[-40,-48]){box(38,.38,.35,0,6.4,z,M.iron);for(let x=-18;x<18;x+=3)beam([x,6.35,z],[x+3,7.1,z],.07,M.brass);box(38,.15,.3,0,7.1,z,M.iron);}
  box(.6,.3,9,0,6.5,-44,M.brass);beam([0,6.3,-44],[0,3.9,-44],.04,M.iron);
  mergeStaticGroup(yard);warpFactoryToSphere(yard,d,R);d.userData.loadingYard={platforms:5,railLocalZ:-44,role:'rear rail receiving docks'};
 }
}

export function factoryFreightEntry(R=160){
 const pose=bookshopTownPose(R),root=new THREE.Group();root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);root.updateWorldMatrix(true,false);
 const points=[];for(let i=0;i<=24;i++){const a=i*Math.PI*1.5/24;points.push(root.localToWorld(townSurfacePoint(root,Math.sin(a)*33.7,32+Math.cos(a)*33.7,R,1.12)));}
 return points;
}
export function installFactorySteam(districts,R){
 const particles=[],geometry=new THREE.IcosahedronGeometry(1,1);
 for(const d of districts)for(let source=0;source<8;source++){
  const g=new THREE.Group();g.name='factory-steam-source-'+source;d.add(g);seatTownObject(d,g,-10+(source%4)*7,-14-Math.floor(source/4)*16,0,R);
  const height=source<4?9:11;
  for(let i=0;i<5;i++){const m=new THREE.MeshBasicMaterial({color:source%3?0xe7e3d7:0xc2cad0,transparent:true,opacity:.2,depthWrite:false});const puff=new THREE.Mesh(geometry,m);g.add(puff);particles.push({puff,source,i,height});}
 }
 return t=>{for(const{puff,source,i,height}of particles){const a=(t*.11+i/5+source*.137)%1;puff.position.set(a*a*4+Math.sin(source+a*4)*.4,height+a*7,Math.sin(source*3+a)*a);puff.scale.set(1+a*2.6,.7+a*1.5,1+a*2);puff.material.opacity=Math.sin(a*Math.PI)*.20;}};
}
