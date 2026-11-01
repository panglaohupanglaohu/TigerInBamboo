import {createBookshopSteamClouds} from './bookshopSteamClouds.js';
import * as THREE from 'three';
import {bookshopTownPose,seatTownObject,townSurfacePoint} from './bookshopTownSite.js';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {warpFactoryToSphere,subdivideFactorySpans} from './bookshopSurfaceWarp.js';
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
   const x=-14+i*7,length=8+(i%2)*1.3,end=-39.7,start=end+length;
   box(5.3,.65,length,x,.325,(start+end)/2,M.stone);
   for(const side of[-1,1]){
    beam([x+side*2.5,.70,end+.2],[x+side*2.5,.70,start-.8],.065,M.brass);
    for(let z=end+.7;z<start-1;z+=1.5)box(.09,.7,.09,x+side*2.45,1.0,z,M.iron);
   }
   // Cover only the receiving doorway; the winching strip stays open overhead.
   box(5.6,.18,2.4,x,7.2,start+1.8,M.slate);
   for(const side of[-1,1])for(const z of[start+.7,start+2.9])box(.16,7.2,.16,x+side*2.45,3.6,z,M.iron);
   for(let j=0;j<3;j++)crate(x+(j%2)*1.1-.6,.65,start-1-j*1.45,.85);
   sign('UNLOADING '+(i+1),2.4,.52,x,3.35,start+.1);
   for(let k=0;k<8;k++)box(.30,.08,.22,x-1.6+k*.44,.7,end+.1,k%2?M.iron:M.brass);
   // Broad stair back into the workshop service yard.
   for(let k=0;k<3;k++)box(2.8,.22*(3-k),.48,x,.11*(3-k),start+.24+k*.48,M.stone);
   for(let z=end+.7;z<start;z+=1.4){const center=d.localToWorld(townSurfacePoint(d,x,z,R,1.57));const q=d.getWorldQuaternion(new THREE.Quaternion());platforms.push({mesh:yard,center,normal:center.clone().normalize(),right:new THREE.Vector3(1,0,0).applyQuaternion(q),forward:new THREE.Vector3(0,0,1).applyQuaternion(q),half:new THREE.Vector3(2.5,.2,.8),topHeight:R+1.57,kind:'factory-loading-platform'});}
  }
  // Longitudinal runways cover all nine full-size robot flatcars.
  for(const x of[-38,38])for(const z of[-31,-53]){box(1.3,1.2,1.3,x,-.35,z,M.stone);box(.7,.24,.7,x,.34,z,M.trim);box(.35,15,.35,x,7.5,z,M.iron);for(let y=.4;y<14;y+=2)beam([x-.5,y,z],[x+.5,y+2,z],.07,M.brass);}
  for(const z of[-31,-53]){box(78,.5,.45,0,15,z,M.iron);for(let x=-38;x<38;x+=4)beam([x,15,z],[x+4,16,z],.07,M.brass);box(78,.18,.35,0,16,z,M.iron);for(let x=-38;x<38;x+=4)beam([x,16,z],[Math.min(38,x+4),15,z],.08,M.iron);}
  subdivideFactorySpans(yard);mergeStaticGroup(yard);warpFactoryToSphere(yard,d,R);d.userData.loadingYard={platforms:5,railLocalZ:-44,role:'rear rail receiving docks'};
 }
}

export function factoryFreightEntry(R=160){
 const pose=bookshopTownPose(R),root=new THREE.Group();root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);root.updateWorldMatrix(true,false);
 const controls=[[30,65.7],[16,65.7],[6,65.7]];
 for(let i=0;i<=48;i++){const a=-i*Math.PI*2/48;controls.push([Math.sin(a)*33.7,32+Math.cos(a)*33.7]);}
 const points=controls.map(([x,z])=>root.localToWorld(townSurfacePoint(root,x,z,R,1.12)));
 const first=factoryFreightStops(R)[0].points,finish=first[0],tangent=first[1].clone().sub(finish).normalize();
 const start=points[points.length-1],handle=root.localToWorld(townSurfacePoint(root,-92,65.7,R,1.12));
 const connector=new THREE.CubicBezierCurve3(start,handle,finish.clone().addScaledVector(tangent,-42),finish);
 for(let i=1;i<20;i++)points.push(connector.getPoint(i/20).setLength(R+1.12));
 return points;
}
export function installFactorySteam(districts,R){return createBookshopSteamClouds(districts,R);}

export function freightTrainingDepot(R=160){
 const pose=bookshopTownPose(R),root=new THREE.Group();root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);root.updateWorldMatrix(true,false);
 return {name:'frontline',center:root.localToWorld(townSurfacePoint(root,35,-51,R,1.12))};
}

export function factoryFreightExit(R=160){
 const pose=bookshopTownPose(R),root=new THREE.Group();root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);root.updateWorldMatrix(true,false);
 return [[98,24],[100,55],[83,85],[57,102]].map(([x,z])=>root.localToWorld(townSurfacePoint(root,x,z,R,1.12)));
}
