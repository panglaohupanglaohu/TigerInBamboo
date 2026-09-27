import * as THREE from 'three';
import {SAIHOJI_HUB} from './saihoji.js';
import {latLonToDir,quatUprightOnSphere} from './sphereMath.js';
export const BOOKSHOP_GROUND_LIFT=.9;
export function bookshopTownPose(R=160){
 const garden=latLonToDir(SAIHOJI_HUB.lat,SAIHOJI_HUB.lon),up=latLonToDir(-35,115);
 const forward=new THREE.Vector3(0,1,0).addScaledVector(up,-up.y).normalize();
 return {position:up.clone().multiplyScalar(R+BOOKSHOP_GROUND_LIFT),quaternion:quatUprightOnSphere(up,forward),garden,up};
}
export function placeBookshopTown(bookshop,R=160){
 const p=bookshopTownPose(R),offset=new THREE.Vector3(27,0,57).applyQuaternion(p.quaternion).add(p.position).setLength(R+BOOKSHOP_GROUND_LIFT);
 const up=offset.clone().normalize(),forward=p.position.clone().sub(offset).normalize();
 bookshop.position.copy(offset);bookshop.quaternion.copy(quatUprightOnSphere(up,forward));bookshop.scale.setScalar(.30);
 bookshop.userData.townSite={name:'南海蒸汽工业基地 · 临海游客书店',lat:-35,lon:115,width:170,depth:145,spherical:true,role:'Fourth independent small tourist bookstore; original model preserved'};return p;
}
export function townSurfacePoint(root,x,z,R=160,lift=BOOKSHOP_GROUND_LIFT){root.updateWorldMatrix(true,false);return root.worldToLocal(root.localToWorld(new THREE.Vector3(x,0,z)).setLength(R+lift));}
export function seatTownObject(root,obj,x,z,yaw=0,R=160){
 const local=townSurfacePoint(root,x,z,R);obj.position.copy(local);root.updateWorldMatrix(true,false);
 const up=root.localToWorld(local.clone()).normalize(),forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).transformDirection(root.matrixWorld);
 obj.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(quatUprightOnSphere(up,forward)));
}
export function townSurfaceMesh(root,minX,maxX,minZ,maxZ,material,R=160,lift=BOOKSHOP_GROUND_LIFT,steps=24){
 const pos=[],idx=[];
 for(let z=0;z<=steps;z++)for(let x=0;x<=steps;x++)pos.push(...townSurfacePoint(root,minX+(maxX-minX)*x/steps,minZ+(maxZ-minZ)*z/steps,R,lift).toArray());
 for(let z=0;z<steps;z++)for(let x=0;x<steps;x++){const a=z*(steps+1)+x,b=a+1,c=a+steps+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.receiveShadow=true;root.add(m);return m;
}
export function buildBookshopTownGround({root,R=160,platforms}){
 const moss=new THREE.MeshStandardMaterial({color:0x798879,roughness:.95}),stone=new THREE.MeshStandardMaterial({color:0xb9b9a5,roughness:.9});
 // A low irregular shore follows the sphere; no vertical quay or pedestal.
 const pos=[],ids=[],nr=40,na=128;
 for(let j=0;j<=nr;j++)for(let i=0;i<=na;i++){
  const a=i*Math.PI*2/na,t=j/nr,coastRadius=90,x=Math.sin(a)*coastRadius*t,z=-16+Math.cos(a)*coastRadius*t;
  const lift=.9-Math.max(0,(t-.87)/.13)*.48;
  pos.push(...townSurfacePoint(root,x,z,R,lift).toArray());
 }
 for(let j=0;j<nr;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i,b=a+1,c=a+na+1,d=c+1;ids.push(a,c,b,b,c,d);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(ids);geo.computeVertexNormals();
 const ground=new THREE.Mesh(geo,moss);ground.name='bookshop-spherical-ground';ground.receiveShadow=true;root.add(ground);
 function collision(mesh,x,z,w,d,lift=.9){root.updateWorldMatrix(true,false);const q=root.getWorldQuaternion(new THREE.Quaternion()),center=root.localToWorld(townSurfacePoint(root,x,z,R,lift));platforms.push({mesh,center,normal:center.clone().normalize(),right:new THREE.Vector3(1,0,0).applyQuaternion(q),forward:new THREE.Vector3(0,0,1).applyQuaternion(q),half:new THREE.Vector3(w/2,.2,d/2),topHeight:R+lift,topHeightAt:()=>R+lift});}
 for(let x=-81;x<=81;x+=6)for(let z=-99;z<=69;z+=6){if(Math.hypot(x,z+16)+4.3<90*.9)collision(ground,x,z,6.15,6.15);}
 // Continuous public circle and tourist frontage have full walkable coverage.
 for(let x=-36;x<=36;x+=6)for(let z=-3;z<=69;z+=6)if(Math.hypot(x,z-32)+4.3<40)collision(ground,x,z,6.15,6.15);
 root.userData.site={name:'南海蒸汽工业基地',ground:'sphere-conforming, no raised terrace',size:[180,180],outline:{shape:'circle',center:[0,-16],radius:90},latitude:-35,longitude:115};return root.userData.site;
}
