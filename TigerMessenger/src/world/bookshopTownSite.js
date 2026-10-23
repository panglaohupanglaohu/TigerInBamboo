import {finishFactoryMaterial} from '../assets/factoryMaterials.js';
import * as THREE from 'three';
import {SAIHOJI_HUB} from './saihoji.js';
import {latLonToDir,quatUprightOnSphere} from './sphereMath.js';
export const BOOKSHOP_GROUND_LIFT=.9;
export const BOOKSHOP_SITE_OUTLINE=Object.freeze({centerZ:-26,radius:100,roadRadius:95});
export function bookshopTownPose(R=160){
 const garden=latLonToDir(SAIHOJI_HUB.lat,SAIHOJI_HUB.lon),up=latLonToDir(-35,115);
 const forward=new THREE.Vector3(0,1,0).addScaledVector(up,-up.y).normalize();
 return {position:up.clone().multiplyScalar(R+BOOKSHOP_GROUND_LIFT),quaternion:quatUprightOnSphere(up,forward),garden,up};
}
export function placeBookshopTown(bookshop,R=160){
 const p=bookshopTownPose(R),offset=new THREE.Vector3(...(BOOKSHOP_TERRACE?[45.15,0,56.95]:[43,0,53])).applyQuaternion(p.quaternion).add(p.position);offset.setLength(R+BOOKSHOP_GROUND_LIFT+bookshopRaiseAtWorld(offset,R)+BOOKSHOP_TERRACE);
 const up=offset.clone().normalize(),forward=p.position.clone().sub(offset).normalize();
 bookshop.position.copy(offset);bookshop.quaternion.copy(quatUprightOnSphere(up,forward));bookshop.scale.setScalar(1.05);
 bookshop.userData.townSite={name:'南海蒸汽工业基地 · 临海游客书店',lat:-35,lon:115,width:200,depth:200,spherical:true,role:'Fourth independent small tourist bookstore; original model preserved'};return p;
}
// Raised town, default on since 2026-10-11 (?bookshopRaise=0 restores the old grade): the whole site stands BOOKSHOP_RAISE
// metres above its old grade on a stone seawall; anything beyond the coast
// (berths, ships) keeps the old sea-level grade. Rails fade out more slowly so
// bridges leaving the island ramp down instead of stepping.
export const BOOKSHOP_RAISE=(()=>{try{return new URLSearchParams(globalThis.location?.search||'').get('bookshopRaise')==='0'?0:5;}catch{return 0;}})();
export const BOOKSHOP_TERRACE=BOOKSHOP_RAISE?5.5:0; // Hard To Find deck on an open arcade, trains pass beneath
const raiseSmooth=(x,a,b)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
export const bookshopSiteRadius=(x,z)=>Math.hypot(x,z-BOOKSHOP_SITE_OUTLINE.centerZ);
// The shared world railway enters and leaves the island at its front-right
// corner, and the citadel crossing checks its exit deck to 0.05 mm about 119 m
// from the site centre. So the island track ramps inside two surveyed
// corridors (sampled from the authored source curve, site-flat metres):
// arrival climbs west along the front strip, the exit descends north along the
// east seawall and is back on the old grade before the checked deck.
const RAIL_ARRIVAL=[[95.5,60.1],[85.1,61.2],[75.1,62.2],[65.4,63],[56.1,63.8],[47,64.5],[38.1,65.1],[29.4,65.7]]; // 0 -> full
const RAIL_EXIT=[[86.1,-14.2],[91,-8.2],[95.4,-1.8],[98,5.5],[98.4,13.1],[98,20.8],[98.4,28.6],[99.6,36.6],[100.5,44.7]]; // full -> 0
export const RAIL_CONNECTOR=[[-39,64.1],[-44.8,63.5],[-50.8,62.7],[-56.7,61.8],[-62.8,60.7],[-68.9,59.4],[-75,57.8],[-81.1,55.8],[-87.1,53.5],[-92.9,50.5],[-98.3,46.9],[-102.8,42.3],[-106.1,36.8],[-108,30.7],[-108.4,24.3],[-107.2,18],[-104.8,11.9],[-101.5,6.3],[-97.8,1]]; // freight loop bridge over the front-left sea: stays at town level
export const RAIL_RAMPS={arrival:RAIL_ARRIVAL,exit:RAIL_EXIT};
const polyCache=new Map();
function nearPolyline(P,x,z){let lens=polyCache.get(P);if(!lens){lens=[0];for(let i=1;i<P.length;i++)lens.push(lens[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));polyCache.set(P,lens);}
 let best=1e9,bs=0;for(let i=1;i<P.length;i++){const[ax,az]=P[i-1],[bx,bz]=P[i],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz,t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/l2)),d=Math.hypot(x-ax-dx*t,z-az-dz*t);if(d<best){best=d;bs=(lens[i-1]+Math.sqrt(l2)*t)/lens[lens.length-1];}}return{d:best,s:bs};}
function siteRaise(x,z){return BOOKSHOP_RAISE*(1-raiseSmooth(bookshopSiteRadius(x,z),99.3,100.3));}
export function bookshopRailRaiseFlat(x,z){
 if(!BOOKSHOP_RAISE)return 0;
 const a=nearPolyline(RAIL_ARRIVAL,x,z);if(a.d<7)return BOOKSHOP_RAISE*a.s;
 const e=nearPolyline(RAIL_EXIT,x,z);if(e.d<7)return BOOKSHOP_RAISE*(1-e.s);
 if(nearPolyline(RAIL_CONNECTOR,x,z).d<7)return BOOKSHOP_RAISE;
 return siteRaise(x,z);
}
export function bookshopRaiseFlat(x,z){
 if(!BOOKSHOP_RAISE)return 0;
 let h=siteRaise(x,z);if(h<=0)return 0;
 for(const[P,up]of[[RAIL_ARRIVAL,true],[RAIL_EXIT,false]]){const n=nearPolyline(P,x,z);if(n.d>=9)continue;const rail=BOOKSHOP_RAISE*(up?n.s:1-n.s),w=1-raiseSmooth(n.d,6,9);h=h+(Math.min(h,rail)-h)*w;}
 return h;
}
let raisePose=null;
export function bookshopSiteFlat(world,R=160){if(!raisePose||raisePose.R!==R){const p=bookshopTownPose(R);raisePose={R,inv:p.quaternion.clone().invert()};}const l=world.clone().normalize().applyQuaternion(raisePose.inv);if(l.y<=.05)return null;const G=R+BOOKSHOP_GROUND_LIFT;return [l.x/l.y*G,l.z/l.y*G];}
export function bookshopRaiseAtWorld(world,R=160){if(!BOOKSHOP_RAISE)return 0;const f=bookshopSiteFlat(world,R);return f?bookshopRaiseFlat(f[0],f[1]):0;}
export function bookshopRailRaiseAtWorld(world,R=160){if(!BOOKSHOP_RAISE)return 0;const f=bookshopSiteFlat(world,R);return f?bookshopRailRaiseFlat(f[0],f[1]):0;}
export function townSurfacePoint(root,x,z,R=160,lift=BOOKSHOP_GROUND_LIFT){root.updateWorldMatrix(true,false);const w=root.localToWorld(new THREE.Vector3(x,0,z));return root.worldToLocal(w.setLength(R+lift+bookshopRaiseAtWorld(w,R)));}
// Rail control points stay on the original grade: the shared world loop keeps
// its arc-length parametrisation (citadel splices are authored in progress u),
// and the raised island is applied afterwards by liftBookshopRailCurve.
export function townRailPoint(root,x,z,R=160,lift=1.12){root.updateWorldMatrix(true,false);const m=root.matrixWorld.clone(),o=new THREE.Vector3().setFromMatrixPosition(m),h=bookshopRaiseAtWorld(o,R);if(h&&o.length()>R+BOOKSHOP_GROUND_LIFT+h*.5)m.setPosition(o.setLength(o.length()-h));return root.worldToLocal(new THREE.Vector3(x,0,z).applyMatrix4(m).setLength(R+lift));}
export function liftBookshopRailCurve(base,R=160){
 // Lift in place (object identity is checked by the citadel crossing startup).
 // Arc-length tables are always measured on the unlifted shape, so progress u
 // and every station derived from it stay exactly as authored.
 if(!BOOKSHOP_RAISE||!base||base.__bookshopLifted)return base;
 const rawPoint=base.getPoint,rawPointAt=base.getPointAt,rawLengths=base.getLengths;
 let depth=0;
 const wrap=f=>function(a,o=new THREE.Vector3()){depth++;let p;try{p=f.call(this,a,o);}finally{depth--;}if(depth===0){const h=bookshopRailRaiseAtWorld(p,R);if(h>0)p.setLength(p.length()+h);}return p;};
 base.getPoint=wrap(rawPoint);base.getPointAt=wrap(rawPointAt);
 if(typeof rawLengths==='function')base.getLengths=function(div){const a=this.getPoint,b=this.getPointAt;this.getPoint=rawPoint;this.getPointAt=rawPointAt;try{return rawLengths.call(this,div);}finally{this.getPoint=a;this.getPointAt=b;}};
 base.__bookshopLifted=true;return base;
}
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
 const moss=finishFactoryMaterial(new THREE.MeshStandardMaterial({color:0x97978b,roughness:.95}),'stone'),stone=new THREE.MeshStandardMaterial({color:0xb9b9a5,roughness:.9});
 // A continuous circular shore follows the sphere, only 0.4 above sea level.
 const pos=[],ids=[],nr=40,na=128;
 for(let j=0;j<=nr;j++)for(let i=0;i<=na;i++){
  const a=i*Math.PI*2/na,t=j/nr,coastRadius=BOOKSHOP_SITE_OUTLINE.radius,x=Math.sin(a)*coastRadius*t,z=BOOKSHOP_SITE_OUTLINE.centerZ+Math.cos(a)*coastRadius*t;
  const lift=.9;
  pos.push(...townSurfacePoint(root,x,z,R,lift).toArray());
 }
 for(let j=0;j<nr;j++)for(let i=0;i<na;i++){const a=j*(na+1)+i,b=a+1,c=a+na+1,d=c+1;ids.push(a,c,b,b,c,d);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(ids);geo.computeVertexNormals();for(let i=0;i<geo.attributes.normal.count;i++){const n=geo.attributes.normal;if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.1){const p=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,i).add(new THREE.Vector3(0,R+BOOKSHOP_GROUND_LIFT,0)).normalize();n.setXYZ(i,p.x,p.y,p.z);}}
 const ground=new THREE.Mesh(geo,moss);ground.name='bookshop-spherical-ground';ground.receiveShadow=true;root.add(ground);
 function collision(mesh,x,z,w,d,lift=.9){root.updateWorldMatrix(true,false);const q=root.getWorldQuaternion(new THREE.Quaternion()),center=root.localToWorld(townSurfacePoint(root,x,z,R,lift));platforms.push({mesh,center,normal:center.clone().normalize(),right:new THREE.Vector3(1,0,0).applyQuaternion(q),forward:new THREE.Vector3(0,0,1).applyQuaternion(q),half:new THREE.Vector3(w/2,.2,d/2),topHeight:R+lift+bookshopRaiseFlat(x,z),topHeightAt:pos=>R+lift+bookshopRaiseAtWorld(pos,R)});}
 for(let x=-99;x<=99;x+=6)for(let z=-121;z<=71;z+=6){if(Math.hypot(x,z-BOOKSHOP_SITE_OUTLINE.centerZ)+4.3<BOOKSHOP_SITE_OUTLINE.radius-.25)collision(ground,x,z,6.3,6.3);}
 for(let i=0;i<160;i++){const a=i*Math.PI/80;collision(ground,Math.sin(a)*(BOOKSHOP_SITE_OUTLINE.radius-3.2),BOOKSHOP_SITE_OUTLINE.centerZ+Math.cos(a)*(BOOKSHOP_SITE_OUTLINE.radius-3.2),4.3,4.3);}
 // Continuous public circle and tourist frontage have full walkable coverage.
 for(let x=-36;x<=36;x+=6)for(let z=-3;z<=69;z+=6)if(Math.hypot(x,z-32)+4.3<40)collision(ground,x,z,6.15,6.15);
 root.userData.site={name:'南海蒸汽工业基地',ground:'sphere-conforming, no raised terrace',size:[200,200],outline:{shape:'circle',center:[0,BOOKSHOP_SITE_OUTLINE.centerZ],radius:BOOKSHOP_SITE_OUTLINE.radius},latitude:-35,longitude:115};return root.userData.site;
}
