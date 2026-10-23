import {mergeStaticGroup} from './geometryMerge.js';
import * as THREE from 'three';
import {townSurfacePoint,BOOKSHOP_SITE_OUTLINE,BOOKSHOP_RAISE,bookshopRaiseFlat} from './bookshopTownSite.js';
import {buildJakubRaisedHarbor,buildHardToFindTerrace,reserveHardToFind} from './bookshopJakubHarbor.js';
import {BOOKSHOP_TERRACE} from './bookshopTownSite.js';
import {createBookshopWorker} from '../assets/bookshopWorker.js';
import {buildJakubRelief} from './bookshopJakubRelief.js';

// Jakub pass (2026-10-11): additive dusk-coast dressing toward the user's
// bookshop target image. Lessons from the Frostpunk 2 study: warm point lights
// against a cool base, functional greenery framing the industrial ring, and
// small people/crates that give the quay its scale. Nothing existing is moved:
// robots, factories, rails, story actors and colliders stay as they were.
// Every placement is tested against an occupancy grid rasterized from the
// already-built scene, so trees and lamps never land on rails, roads or props.
// Disable with ?bookshopJakub=0.
export const JAKUB_PASS_VERSION='jakub-bookshop-v3';
const PLAZA_Z=32,ROADS=[-2.15,Math.PI,2.15];
const hash=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
const angleGap=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

function buildOccupancy(scene,root,R,skip){
 const MINX=-110,MINZ=-135,N=230,obj=new Uint8Array(N*N),path=new Uint8Array(N*N),low=new Uint8Array(N*N),G=R+.9;
 const inv=new THREE.Matrix4(),m=new THREE.Matrix4(),v=new THREE.Vector3(),sph=new THREE.Sphere();
 root.updateWorldMatrix(true,false);inv.copy(root.matrixWorld).invert();
 const centre=root.localToWorld(new THREE.Vector3(0,0,-26));
 const project=p=>{const dy=p.y+G,len=Math.hypot(p.x,dy,p.z);if(dy<G*.45)return null;const x=p.x*G/dy,z=p.z*G/dy;if(x<MINX-20||x>MINX+N+20||z<MINZ-20||z>MINZ+N+20)return null;return [x,z,len-G-bookshopRaiseFlat(x,z)];};
 const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const cell=(x,z)=>{const i=Math.floor(x-MINX),j=Math.floor(z-MINZ);return i<0||j<0||i>=N||j>=N?-1:j*N+i;};
 const tri=(a,b,c,grid)=>{
  const x0=Math.floor(Math.min(a[0],b[0],c[0])),x1=Math.ceil(Math.max(a[0],b[0],c[0])),z0=Math.floor(Math.min(a[1],b[1],c[1])),z1=Math.ceil(Math.max(a[1],b[1],c[1]));
  if(x1-x0>240||z1-z0>240)return;
  const area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
   let inside=true;
   if(Math.abs(area)>1e-6){const px=x+.5,pz=z+.5,w0=((b[0]-px)*(c[1]-pz)-(c[0]-px)*(b[1]-pz))/area,w1=((c[0]-px)*(a[1]-pz)-(a[0]-px)*(c[1]-pz))/area;inside=w0>-.6&&w1>-.6&&1-w0-w1>-.6;}
   if(inside){const k=cell(x,z);if(k>=0)grid[k]=1;}
  }
 };
 scene.traverse(o=>{
  if(!o.isMesh||!o.geometry?.attributes?.position)return;
  for(let p=o;p;p=p.parent)if(p===skip)return;
  if(o.name==='bookshop-spherical-ground'||!shown(o))return;
  o.geometry.boundingSphere||o.geometry.computeBoundingSphere();
  sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
  if(sph.radius>260||sph.center.distanceTo(centre)>sph.radius+125)return;
  const pos=o.geometry.attributes.position,idx=o.geometry.index,count=o.isInstancedMesh?o.count:1;
  if(pos.count>400000)return;
  for(let k=0;k<count;k++){
   m.copy(o.matrixWorld);if(o.isInstancedMesh){const im=new THREE.Matrix4();o.getMatrixAt(k,im);m.multiply(im);}
   m.premultiply(inv);
   const pts=new Array(pos.count);let minH=1e9,maxH=-1e9;
   for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);const q=project(v);pts[i]=q;if(q){minH=Math.min(minH,q[2]);maxH=Math.max(maxH,q[2]);}}
   if(maxH===-1e9)continue;
   if(maxH<-.2||minH>25)continue;
      const triCount=idx?idx.count/3:pos.count/3;
   for(let t=0;t<triCount;t++){
    const ia=idx?idx.getX(t*3):t*3,ib=idx?idx.getX(t*3+1):t*3+1,ic=idx?idx.getX(t*3+2):t*3+2;
    const a=pts[ia],b=pts[ib],c=pts[ic];if(!a||!b||!c)continue;
    const hi=Math.max(a[2],b[2],c[2]),lo=Math.min(a[2],b[2],c[2]);if(hi<-.2||lo>25)continue;
    tri(a,b,c,hi<.13?path:obj);if(lo<2.6&&hi>.13)tri(a,b,c,low);
   }
  }
 });
 const clear=(x,z,r,allowPath=false)=>{for(let dx=-Math.ceil(r);dx<=Math.ceil(r);dx++)for(let dz=-Math.ceil(r);dz<=Math.ceil(r);dz++){if(dx*dx+dz*dz>r*r+.5)continue;const k=cell(x+dx,z+dz);if(k<0)return false;if(obj[k])return false;if(!allowPath&&path[k])return false;}return true;};
 const claim=(x,z,r)=>{for(let dx=-Math.ceil(r);dx<=Math.ceil(r);dx++)for(let dz=-Math.ceil(r);dz<=Math.ceil(r);dz++){if(dx*dx+dz*dz>r*r)continue;const k=cell(x+dx,z+dz);if(k>=0)obj[k]=1;}};
 const clearLow=(x,z,r)=>{for(let dx=-Math.ceil(r);dx<=Math.ceil(r);dx++)for(let dz=-Math.ceil(r);dz<=Math.ceil(r);dz++){if(dx*dx+dz*dz>r*r+.5)continue;const k=cell(x+dx,z+dz);if(k<0||low[k])return false;}return true;};
 return {clear,claim,clearLow,obj,path,low,N,MINX,MINZ};
}

function seatMatrix(root,x,z,yaw,scale,R,lift=.9,out=new THREE.Matrix4()){
 const p=townSurfacePoint(root,x,z,R,lift),up=new THREE.Vector3(p.x,p.y+R+.9,p.z).normalize();
 const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
 return out.compose(p,q,new THREE.Vector3(scale,scale,scale));
}

export function installBookshopJakubPass({scene,root,R=160,colliders=null,platforms=null,bookshop=null,enabled=true}){
 if(!root||!enabled)return null;if(root.userData.jakubPass)return root.userData.jakubPass;
 const t0=performance.now(),g=new THREE.Group();g.name='bookshop-jakub-pass';root.add(g);
 scene.updateMatrixWorld(true);
 const occ=buildOccupancy(scene,root,R,g),stats={trees:0,bushes:0,lamps:0,crates:0,workers:0,rocks:0,planters:0};
 // Hard To Find deck + ramp corridor are claimed first, so later props keep off them.
 if(BOOKSHOP_RAISE)stats.htfReserved=reserveHardToFind({root,R,bookshop,occ,terrace:BOOKSHOP_TERRACE});
 const point=(r,a)=>[Math.sin(a)*r,PLAZA_Z+Math.cos(a)*r];
 const nearRoad=(a,w)=>ROADS.some(r=>angleGap(a,r)<w);

 // ---- materials ---------------------------------------------------------
 const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.9,...o});
 const M={
  trunk:mat(0x5b4434),crown:mat(0xffffff,{flatShading:true,vertexColors:false}),
  planter:mat(0xb7a585),planterRim:mat(0x8f7d62),soil:mat(0x4e3d2e),
  iron:mat(0x24302f,{metalness:.55,roughness:.55}),
  lantern:new THREE.MeshStandardMaterial({color:0xffd9a0,emissive:0xffa64a,emissiveIntensity:1.6,roughness:.4}),
  crate:mat(0x8a6a48),band:mat(0x3b3a34,{metalness:.5}),rock:mat(0x8b8478,{flatShading:true}),
 };
 const crownColors=[0x56743a,0x67853f,0x47662f,0x7a9448,0x5d7d44].map(c=>new THREE.Color(c));
 const bloomColors=[0xf3efe2,0xf6e7ea,0xe9e2c8].map(c=>new THREE.Color(c));

 // ---- instanced builders ---------------------------------------------------
 const trees=[],bushes=[],lamps=[],crates=[],rocks=[],planters=[];
 const addTree=(x,z,s,{planter=false,collide=false}={})=>{trees.push({x,z,s,yaw:hash(x,z)*6.28});if(planter){planters.push({x,z,s:1});stats.planters++;}if(collide&&colliders)colliders.push({position:root.localToWorld(townSurfacePoint(root,x,z,R,1.4)),radius:.45,kind:'bookshop-jakub-tree'});stats.trees++;};

 // 1) Plaza planters: a ring of trees and blossom shrubs on the plaza edge.
 for(let i=0;i<30;i++){
  const a=i*Math.PI*2/30+.06;if(nearRoad(a,.22))continue;
  const [x,z]=point(25.9,a);if(!occ.clear(x,z,1.0,true))continue;
  occ.claim(x,z,1.2);
  if(i%3===1){bushes.push({x,z,s:1.0,bloom:true});planters.push({x,z,s:1});stats.bushes++;stats.planters++;}
  else addTree(x,z,1.3+hash(x,z)*.25,{planter:true,collide:true});
 }
 // 2) Lamps: inner plaza ring, factory approach roads, harbor quay.
 const lamp=(x,z,yaw=0,allowPath=true)=>{if(!occ.clear(x,z,.5,allowPath))return false;occ.claim(x,z,.7);lamps.push({x,z,yaw});stats.lamps++;return true;};
 for(let i=0;i<30;i++){const a=(i+.5)*Math.PI*2/30+.06;if(nearRoad(a,.12))continue;lamp(...point(26.4,a),a);}
 for(const a of ROADS)for(let r=41;r<=57;r+=4)for(const side of[-1,1]){const[x,z]=point(r,a);for(const off of[3.4,2.8,4.2,5])if(lamp(x+Math.cos(a)*side*off,z-Math.sin(a)*side*off,a))break;}
 for(let x=-64;x<=-40;x+=4)for(const z of[19.6,24.4])lamp(x,z,0);

 // 3) Harbor wharf: crate stacks and workers in free quay space.
 for(let i=0;i<90&&stats.crates<34;i++){
  const x=-66+hash(i,1)*30,z=12+hash(i,2)*22;if(!occ.clear(x,z,.9,true))continue;
  occ.claim(x,z,.9);const h=1+Math.floor(hash(i,3)*3);
  for(let k=0;k<h;k++)crates.push({x,z,y:k*.86,s:.85-k*.06,yaw:hash(i,k)*.6});stats.crates++;
 }
 const workers=[];
 for(let i=0;i<60&&workers.length<12;i++){
  const x=-64+hash(i,7)*26,z=13+hash(i,8)*20;if(!occ.clear(x,z,.6,true))continue;occ.claim(x,z,.8);
  const w=createBookshopWorker({coat:[0x56626a,0x746b5d,0x5b4d40,0x3f5560][i%4],apron:i%3===0,carrying:i%2===0});
  w.matrixAutoUpdate=false;seatMatrix(root,x,z,hash(i,9)*6.28,1,R,.9,w.matrix);g.add(w);workers.push(w);stats.workers++;
 }

 // 3b) Terraced garden hills claim free rear ground before the loose trees.
 if(BOOKSHOP_RAISE)Object.assign(stats,buildJakubRelief({root,R,g,occ,colliders,stage:'hill'}));

 // 4) Wooded rear slopes: clustered trees on the free ground behind the courts.
 for(let x=-96;x<=96;x+=3.1)for(let z=-124;z<=40;z+=3.1){
  const jx=x+(hash(x,z)-.5)*2.2,jz=z+(hash(z,x)-.5)*2.2,d=Math.hypot(jx,jz+26);
  if(d<52||d>92)continue;
  const rearness=THREE.MathUtils.smoothstep(-(jz-10),-10,40);if(rearness<=0)continue;
  if(jx<-38&&jz>0)continue; // keep the side harbor open
  const cluster=.5+.5*Math.sin(jx*.09+1.3)*Math.cos(jz*.11-.4);
  if(hash(jx*.7,jz*1.3)>cluster*rearness+.18)continue;
  if(!occ.clear(jx,jz,1.6))continue;occ.claim(jx,jz,1.5);
  if(hash(jz,jx)<.18){bushes.push({x:jx,z:jz,s:1.2,bloom:hash(jx,1)<.5});stats.bushes++;}
  else addTree(jx,jz,1.6+hash(jx,jz)*1.0);
 }

 // 5) Coastal rocks on the flanks (front promenade stays open to the sea).
 for(let i=0;i<220;i++){
  const a=i*Math.PI*2/220,ex=Math.sin(a),ez=Math.cos(a);
  const x=ex*101,z=-26+ez*101;
  if(z>40&&Math.abs(x)<52)continue;if(x<-35&&z>-5&&z<70)continue;
  if(hash(i,4)<.35)continue;if(!occ.clear(x,z,1.2,true)||!occ.clear(ex*96,-26+ez*96,.6,true))continue;
  rocks.push({x:x+(hash(i,5)-.5)*3,z:z+(hash(i,6)-.5)*3,s:1.4+hash(i,7)*2.4});stats.rocks++;
 }

 // ---- geometry ----------------------------------------------------------
 const mtx=new THREE.Matrix4(),local=new THREE.Matrix4();
 const inst=(geo,material,list,fn,name)=>{if(!list.length)return null;const im=new THREE.InstancedMesh(geo,material,list.length);im.name=name;im.castShadow=true;im.receiveShadow=true;list.forEach((e,i)=>{fn(e,i,mtx);im.setMatrixAt(i,mtx);});im.instanceMatrix.needsUpdate=true;g.add(im);return im;};
 const lift=(x,z,y,s,yaw=0)=>{seatMatrix(root,x,z,yaw,1,R,.9,mtx);return mtx.multiply(local.compose(new THREE.Vector3(0,y,0),new THREE.Quaternion(),new THREE.Vector3(s,s,s)));};
 // trees: trunk + three crown blobs
 inst(new THREE.CylinderGeometry(.12,.2,2.2,6).translate(0,1.1,0),M.trunk,trees,(e,i,m)=>{seatMatrix(root,e.x,e.z,e.yaw,e.s,R,.9,m);},'jakub-tree-trunks');
 const crown=new THREE.IcosahedronGeometry(1,1),blobs=[];
 for(const e of trees)for(let k=0;k<3;k++){const a=e.yaw+k*2.1,r=k?.55:0;blobs.push({x:e.x,z:e.z,yaw:e.yaw,s:e.s,ox:Math.cos(a)*r,oy:2.5+(k?-.25:.35),oz:Math.sin(a)*r,r:(k?.85:1.15)*(.9+hash(e.x+k,e.z)*.3),c:crownColors[Math.floor(hash(e.z+k,e.x)*crownColors.length)]});}
 const crowns=inst(crown,M.crown,blobs,(e,i,m)=>{seatMatrix(root,e.x,e.z,e.yaw,e.s,R,.9,m);m.multiply(local.compose(new THREE.Vector3(e.ox,e.oy,e.oz),new THREE.Quaternion(),new THREE.Vector3(e.r,e.r*.82,e.r)));},'jakub-tree-crowns');
 if(crowns){blobs.forEach((e,i)=>crowns.setColorAt(i,e.c));crowns.instanceColor.needsUpdate=true;}
 const bush=inst(new THREE.IcosahedronGeometry(.75,1),M.crown,bushes,(e,i,m)=>lift(e.x,e.z,(e.s>1.1?.5:1.0),e.s),'jakub-bushes');
 if(bush){bushes.forEach((e,i)=>bush.setColorAt(i,e.bloom?bloomColors[i%3]:crownColors[i%5]));bush.instanceColor.needsUpdate=true;}
 inst(new THREE.CylinderGeometry(1.05,.95,.62,8).translate(0,.31,0),M.planter,planters,(e,i,m)=>lift(e.x,e.z,0,1),'jakub-planters');
 inst(new THREE.TorusGeometry(1.02,.08,6,16).rotateX(Math.PI/2).translate(0,.62,0),M.planterRim,planters,(e,i,m)=>lift(e.x,e.z,0,1),'jakub-planter-rims');
 // lamps: post, arm, lantern, glow
 inst(new THREE.CylinderGeometry(.06,.09,3.1,6).translate(0,1.55,0),M.iron,lamps,(e,i,m)=>seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m),'jakub-lamp-posts');
 inst(new THREE.BoxGeometry(.32,.42,.32).translate(0,3.3,0),M.lantern,lamps,(e,i,m)=>seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m),'jakub-lamp-lanterns');
 inst(new THREE.ConeGeometry(.3,.26,4).rotateY(Math.PI/4).translate(0,3.64,0),M.iron,lamps,(e,i,m)=>seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m),'jakub-lamp-caps');
 const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,214,150,1)');gr.addColorStop(.35,'rgba(255,170,80,.45)');gr.addColorStop(1,'rgba(255,140,60,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
 const glowMat=new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.55});
 for(const e of lamps){const s=new THREE.Sprite(glowMat);s.position.copy(townSurfacePoint(root,e.x,e.z,R,.9+3.3));s.scale.setScalar(1.7);s.name='jakub-lamp-glow';g.add(s);}
 // crates
 inst(new THREE.BoxGeometry(1,1,1).translate(0,.5,0),M.crate,crates,(e,i,m)=>{seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m);m.multiply(local.compose(new THREE.Vector3(0,e.y,0),new THREE.Quaternion(),new THREE.Vector3(e.s,e.s,e.s)));},'jakub-crates');
 inst(new THREE.BoxGeometry(1.04,.07,1.04).translate(0,.5,0),M.band,crates,(e,i,m)=>{seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m);m.multiply(local.compose(new THREE.Vector3(0,e.y,0),new THREE.Quaternion(),new THREE.Vector3(e.s,e.s,e.s)));},'jakub-crate-bands');
 // rocks
 inst(new THREE.DodecahedronGeometry(1,0),M.rock,rocks,(e,i,m)=>{seatMatrix(root,e.x,e.z,hash(e.x,e.z)*6,1,R,.2,m);m.multiply(local.compose(new THREE.Vector3(0,0,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(e.z,1),hash(e.x,2),0)),new THREE.Vector3(e.s,e.s*.8,e.s*1.1)));},'jakub-coast-rocks');


 // 6) Harbor arcade (v2): an open stone portico on the plaza's wharf side, read
 // as the target's lit arcade behind the quay. Piers only collide, so every
 // arch stays a walkable passage between plaza and wharf.
 const arcade=[],arcadeEnabled=new URLSearchParams(globalThis.location?.search||'').get('jakubArcade')==='1',arcStart=-1.98,arcEnd=-1.12,arcR=42.6,bayW=3.3;
 if(arcadeEnabled){const step=bayW/arcR,slots=[];for(let a=arcStart;a<=-.62;a+=step){const[x,z]=point(arcR,a);slots.push({x,z,yaw:a,ok:!nearRoad(a,.09)&&occ.clear(x,z,1.6,true)});}
  // keep only continuous runs of four or more bays: fragments read as debris
  for(let i=0;i<slots.length;){if(!slots[i].ok){i++;continue;}let j=i;while(j<slots.length&&slots[j].ok)j++;if(j-i>=4)for(let k=i;k<j;k++){occ.claim(slots[k].x,slots[k].z,1.9);arcade.push(slots[k]);}i=j;}}
 stats.arches=arcade.length;
 if(arcade.length){
  const W=bayW,H=4.4,D=2.4,spring=2.5,r=.95;
  const face=new THREE.Shape();face.moveTo(-W/2,0);face.lineTo(W/2,0);face.lineTo(W/2,H);face.lineTo(-W/2,H);face.closePath();
  const hole=new THREE.Path();hole.moveTo(-r,0);hole.lineTo(-r,spring);hole.absarc(0,spring,r,Math.PI,0,true);hole.lineTo(r,0);hole.closePath();face.holes.push(hole);
  const bayGeo=new THREE.ExtrudeGeometry(face,{depth:D,bevelEnabled:false,curveSegments:10}).translate(0,0,-D/2);
  const arcStone=mat(0xbba985),arcTrim=mat(0x8f7c60),arcDark=mat(0x3d342b);
  const bay=(e,m,y=0,sx=1,sy=1,sz=1,ox=0,oz=0)=>{seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m);return m.multiply(local.compose(new THREE.Vector3(ox,y,oz),new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz)));};
  inst(bayGeo,arcStone,arcade,(e,i,m)=>bay(e,m),'jakub-arcade-bays');
  inst(new THREE.BoxGeometry(W+.12,.32,D+.5).translate(0,.16,0),arcTrim,arcade,(e,i,m)=>bay(e,m,H),'jakub-arcade-cornice');
  inst(new THREE.BoxGeometry(W+.06,.9,.16).translate(0,.45,0),arcStone,arcade,(e,i,m)=>bay(e,m,H+.32,1,1,1,0,D/2+.1),'jakub-arcade-parapet');
  inst(new THREE.BoxGeometry(.5,.34,D+.3).translate(0,.17,0),arcTrim,arcade,(e,i,m)=>bay(e,m,0,1,1,1,W/2,0),'jakub-arcade-plinths');
  inst(new THREE.BoxGeometry(2*r+.04,.05,D+.02),arcDark,arcade,(e,i,m)=>bay(e,m,.03),'jakub-arcade-floor');
  // hanging lanterns in each arch
  inst(new THREE.CylinderGeometry(.015,.015,.7,4).translate(0,-.35,0),M.iron,arcade,(e,i,m)=>bay(e,m,spring+r),'jakub-arcade-lantern-chain');
  inst(new THREE.BoxGeometry(.3,.4,.3).translate(0,-.9,0),M.lantern,arcade,(e,i,m)=>bay(e,m,spring+r),'jakub-arcade-lanterns');
  for(const e of arcade){const s=new THREE.Sprite(glowMat);seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,mtx);s.position.setFromMatrixPosition(mtx.multiply(local.makeTranslation(0,spring+r-.9,0)));s.scale.setScalar(2.2);s.name='jakub-arcade-glow';g.add(s);
   if(colliders)for(const side of[-1,1]){seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,mtx);const pp=new THREE.Vector3().setFromMatrixPosition(mtx.multiply(local.makeTranslation(side*(W/2-.15),1.4,0)));for(const dz of[-.8,0,.8]){seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,mtx);const q=new THREE.Vector3().setFromMatrixPosition(mtx.multiply(local.makeTranslation(side*(W/2-.2),1.4,dz)));colliders.push({position:root.localToWorld(q),radius:.42,kind:'bookshop-jakub-tree'});}}
  }
 }

 // 7) Stone embankment skirt along the coast, so the town reads as a built
 // seawall rather than a flat disc on the water. Skips berths and piers.
 const wall=[];if(!BOOKSHOP_RAISE)
 for(let i=0;i<180;i++){const a=i*Math.PI/90,ex=Math.sin(a),ez=Math.cos(a),x=ex*100.15,z=-26+ez*100.15;if(!occ.clear(ex*99,-26+ez*99,.6,true)||!occ.clear(ex*101.5,-26+ez*101.5,.6,true))continue;wall.push({x,z,yaw:a,b:i%4===0});}
 stats.seawall=wall.length;
 const seaStone=mat(0xa29277),seaCap=mat(0xcbbb98);
 inst(new THREE.BoxGeometry(3.75,3.3,.7).translate(0,-1.6,0),seaStone,wall,(e,i,m)=>seatMatrix(root,e.x,e.z,e.yaw+Math.PI/2-Math.PI/2,1,R,.9,m),'jakub-seawall');
 inst(new THREE.BoxGeometry(3.8,.2,1.0).translate(0,.06,0),seaCap,wall,(e,i,m)=>seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m),'jakub-seawall-cap');
 const butt=wall.filter(e=>e.b);
 inst(new THREE.BoxGeometry(.9,3.1,1.1).translate(0,-1.55,.75),seaStone,butt,(e,i,m)=>seatMatrix(root,e.x,e.z,e.yaw,1,R,.9,m),'jakub-seawall-buttress');

 // 8) Raised town (?bookshopRaise=1): arched viaduct seawall, lower wharf, stairs and the DUKE steamer.
 if(BOOKSHOP_RAISE)Object.assign(stats,buildJakubRaisedHarbor({root,R,g,occ,colliders,platforms,glowMat,lanternMat:M.lantern,ironMat:M.iron,crateMat:M.crate}));
 if(BOOKSHOP_RAISE)Object.assign(stats,buildJakubRelief({root,R,g,occ,colliders,glowMat,lanternMat:M.lantern,ironMat:M.iron,stage:'rest'}));
 if(BOOKSHOP_RAISE){
  // perf 2026-10-15: the terrace/ramp build ~900 separate meshes (balusters, posts, rails...). Build them in
  // their own subgroup and merge it per material (~7 draws instead of ~900, shadows included).
  const htfG=new THREE.Group();htfG.name='hard-to-find-terrace';g.add(htfG);
  Object.assign(stats,buildHardToFindTerrace({root,R,g:htfG,bookshop,terrace:BOOKSHOP_TERRACE,occ,platforms,colliders}));
  if(new URLSearchParams(globalThis.location?.search||'').get('htfMerge')!=='0'){const before=htfG.children.length;mergeStaticGroup(htfG,{mergedTag:'htf-terrace'});stats.htfMerged=[before,htfG.children.length];}
 }

 // 5) Warmer stone: lift the cool grey ground and plaza toward sunlit sandstone.
 const tints=[];
 const ground=root.getObjectByName('bookshop-spherical-ground');
 if(ground?.material?.color){tints.push([ground.material,ground.material.color.getHex()]);ground.material.color.set(0xa99c83);}
 const plaza=root.getObjectByName('bookshop-base-circular-plaza'),seen=new Set();
 plaza?.traverse(o=>{const m=o.material;if(!o.isMesh||!m?.color||seen.has(m))return;seen.add(m);const hex=m.color.getHex();if(hex===0xb5b2a3){tints.push([m,hex]);m.color.set(0xd2c3a2);}else if(hex===0xd2cbb6){tints.push([m,hex]);m.color.set(0xe2d2b0);}});

 const api={group:g,stats,version:JAKUB_PASS_VERSION,ms:Math.round(performance.now()-t0),occupancy:occ,
  update:(dt,t)=>stats.updateSteam?.(dt,t),
  remove(){stats.disposeSteam?.();g.removeFromParent();for(const[m,hex]of tints)m.color.setHex(hex);if(colliders)for(let i=colliders.length-1;i>=0;i--)if(colliders[i].kind==='bookshop-jakub-tree')colliders.splice(i,1);if(platforms)for(let i=platforms.length-1;i>=0;i--)if(platforms[i].kind==='bookshop-jakub-wharf')platforms.splice(i,1);delete root.userData.jakubPass;}};
 root.userData.jakubPass=api;return api;
}
