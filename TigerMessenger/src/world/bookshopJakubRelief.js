import * as THREE from 'three';
import {townSurfacePoint,BOOKSHOP_SITE_OUTLINE,RAIL_CONNECTOR,RAIL_RAMPS} from './bookshopTownSite.js';

// Jakub relief pass (target image, night of 2026-10-11): the island reads as
// built on rock. Adds sea cliffs with green tufts and surf on the flanks, a
// terraced garden hill in free rear ground, and copper steam mains bridging the
// gaps between the factory courts. Additive only; robots, factories, rails and
// story objects are untouched, and every placement checks the occupancy grid.
const CZ=BOOKSHOP_SITE_OUTLINE.centerZ;
const hash=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
const polar=(r,t)=>[Math.sin(t)*r,CZ+Math.cos(t)*r];
const distTo=(P,x,z)=>{let b=1e9;for(let i=1;i<P.length;i++){const[ax,az]=P[i-1],[bx,bz]=P[i],dx=bx-ax,dz=bz-az,t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));b=Math.min(b,Math.hypot(x-ax-dx*t,z-az-dz*t));}return b;};
const angleGap=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

function rockGeometry(seed){
 const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=.78+.32*hash(Math.round(v.x*7)+seed,Math.round(v.y*7)*3+Math.round(v.z*5));v.multiplyScalar(n);if(v.y<-.2)v.y=-.2+(v.y+.2)*.3;p.setXYZ(i,v.x,v.y,v.z);}
 g.computeVertexNormals();return g;
}

export function buildJakubRelief({root,R=160,g,occ,colliders=null,glowMat=null,lanternMat=null,ironMat=null,stage='all'}){
 lanternMat??=new THREE.MeshStandardMaterial({color:0xffd9a0,emissive:0xffa64a,emissiveIntensity:1.6,roughness:.4});ironMat??=new THREE.MeshStandardMaterial({color:0x24302f,metalness:.55,roughness:.55});
 const stats=stage==='hill'?{hillTiers:0}:{cliffs:0,steamMains:0};
 const G=R+.9,Y=new THREE.Vector3(0,1,0),one=new THREE.Vector3(1,1,1);
 const frame=(p,yaw)=>{const up=new THREE.Vector3(p.x,p.y+G,p.z).normalize();return new THREE.Quaternion().setFromUnitVectors(Y,up).multiply(new THREE.Quaternion().setFromAxisAngle(Y,yaw));};
 const seatTown=(x,z,yaw,lift=.9)=>{const p=townSurfacePoint(root,x,z,R,lift);return new THREE.Matrix4().compose(p,frame(p,yaw),one);};
 const seatAbs=(x,z,yaw,lift)=>{root.updateWorldMatrix(true,false);const p=root.worldToLocal(root.localToWorld(new THREE.Vector3(x,0,z)).setLength(R+lift));return new THREE.Matrix4().compose(p,frame(p,yaw),one);};
 const off=(m,x,y,z,sx=1,sy=1,sz=1,q=new THREE.Quaternion())=>m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy,sz)));
 const at=(m,x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(m);
 const inst=(geo,mat,ms,name,colors=null)=>{if(!ms.length)return null;const im=new THREE.InstancedMesh(geo,mat,ms.length);ms.forEach((m,i)=>im.setMatrixAt(i,m));if(colors){colors.forEach((c,i)=>im.setColorAt(i,c));im.instanceColor.needsUpdate=true;}im.instanceMatrix.needsUpdate=true;im.castShadow=im.receiveShadow=true;im.name=name;g.add(im);return im;};
 if(!glowMat){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,214,150,1)');gr.addColorStop(.35,'rgba(255,170,80,.45)');gr.addColorStop(1,'rgba(255,140,60,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;glowMat=new THREE.SpriteMaterial({map:t,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.55});}
 const glow=(p,s)=>{const sp=new THREE.Sprite(glowMat);sp.position.copy(p);sp.scale.setScalar(s);sp.name='jakub-relief-glow';g.add(sp);};
 const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.92,...o});
 const greens=[0x4f6e2e,0x5d7d44,0x67853f,0x47662f,0x7a9448].map(c=>new THREE.Color(c));

 // ---- terraced garden hill in free rear ground (call before rear trees claim it)
 if(stage==='all'||stage==='hill'){
  const picks=[];
  for(let z=-120;z<=-55;z+=4)for(let x=-90;x<=90;x+=4){if(Math.hypot(x,z-CZ)>86)continue;if(picks.some(p=>Math.hypot(p[0]-x,p[1]-z)<34))continue;if(occ.clear(x,z,12.5,false))picks.push([x,z]);if(picks.length>=3)break;}
  const wall=mat(0xa89677),grass=mat(0x6f8f45),path=mat(0xcdbd98),tierM=[],capM=[],trunkM=[],crownM=[],crownC=[],lampM=[];
  for(const[x,z]of picks){
   occ.claim(x,z,13);const base=seatTown(x,z,hash(x,z)*6.28);
   const tiers=[[12,2.2],[8.6,2.2],[5.2,2.0]];let y=0;
   for(const[r,h]of tiers){tierM.push(off(base,0,y+h/2,0,r,h,r));capM.push(off(base,0,y+h+.02,0,r-.25,1,r-.25));
    const n=Math.round(r*1.1);for(let k=0;k<n;k++){const a=k*2*Math.PI/n+hash(r,k),rr=r-1.3-hash(k,r)*.8,px=Math.cos(a)*rr,pz=Math.sin(a)*rr,s=1.1+hash(px,pz)*.7;
      trunkM.push(off(base,px,y+h,pz,s,s,s));for(let b=0;b<3;b++){const ba=a+b*2.1,br=b?.55*s:0;crownM.push(off(base,px+Math.cos(ba)*br,y+h+2.5*s+(b?-.25:.35)*s,pz+Math.sin(ba)*br,1.1*s,.9*s,1.1*s));crownC.push(greens[(k+b)%5]);}}
    for(let k=0;k<4;k++){const a=k*Math.PI/2+.4;lampM.push(off(base,Math.cos(a)*(r-.4),y+h,Math.sin(a)*(r-.4)));glow(at(base,Math.cos(a)*(r-.4),y+h+3.3,Math.sin(a)*(r-.4)),1.7);}
    y+=h;stats.hillTiers++;}
   if(colliders)for(let k=0;k<52;k++){const a=k*2*Math.PI/52;colliders.push({position:root.localToWorld(at(base,Math.cos(a)*11.6,1,Math.sin(a)*11.6)),radius:.9,kind:'bookshop-jakub-tree'});}
  }
  inst(new THREE.CylinderGeometry(1,1.04,1,16),wall,tierM,'jakub-hill-tier');
  inst(new THREE.CylinderGeometry(1,1,.12,16),grass,capM,'jakub-hill-lawn');
  inst(new THREE.CylinderGeometry(.12,.2,2.2,6).translate(0,1.1,0),mat(0x5b4434),trunkM,'jakub-hill-trunks');
  inst(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true}),crownM,'jakub-hill-crowns',crownC);
  inst(new THREE.CylinderGeometry(.06,.09,3.1,6).translate(0,1.55,0),ironMat,lampM,'jakub-hill-lamp-posts');
  inst(new THREE.BoxGeometry(.32,.42,.32).translate(0,3.3,0),lanternMat,lampM,'jakub-hill-lamps');
  stats.hills=picks.length;
  if(stage==='hill')return stats;
 }

 // ---- sea cliffs with green tufts and surf on the flanks
 {const rockVariants=[rockGeometry(1),rockGeometry(7),rockGeometry(13)],rockMats=[mat(0x8c8174,{flatShading:true}),mat(0x7a7064,{flatShading:true}),mat(0x9a8f80,{flatShading:true})];
  const rocks=[[],[],[]],tufts=[],tuftC=[],foam=[];
  for(let i=0;i<150;i++){
   const t=i*2*Math.PI/150+(hash(i,3)-.5)*.02,[ex,ez]=polar(101,t);
   if(ez>40&&Math.abs(ex)<46)continue;                       // keep the front sea view
   if(t>-1.0&&t<-.2)continue;                                  // lower wharf and the DUKE
   if(angleGap(t,-1.38)<.26)continue;                          // grand freighter berth
   if([RAIL_CONNECTOR,RAIL_RAMPS.arrival,RAIL_RAMPS.exit].some(P=>distTo(P,ex,ez)<13))continue;
   if(hash(i,9)<.42)continue;
   const rr=102.2+hash(i,4)*3.2,[x,z]=polar(rr,t);if(!occ.clearLow(x,z,2.2))continue;
   const h=4.5+hash(i,5)*6.5,w=2.6+hash(i,6)*2.6,m=seatAbs(x,z,hash(i,7)*6.28,-.6),v=i%3;
   rocks[v].push(off(m,0,0,0,w,h,w*(.8+hash(i,8)*.5)));
   if(hash(i,10)<.75){const k=1+Math.floor(hash(i,11)*3);for(let j=0;j<k;j++){const s=1.2+hash(i,j)*1.4;tufts.push(off(m,(hash(j,i)-.5)*w,h*.86,(hash(i+j,2)-.5)*w*.6,s,s*.7,s));tuftC.push(greens[(i+j)%5]);}}
   foam.push(seatAbs(x,z,0,.53).multiply(new THREE.Matrix4().makeScale(w*1.35,1,w*1.35)));stats.cliffs++;
  }
  rocks.forEach((ms,v)=>inst(rockVariants[v],rockMats[v],ms,'jakub-sea-cliffs'));
  inst(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true}),tufts,'jakub-cliff-tufts',tuftC);
  inst(new THREE.RingGeometry(.75,1.15,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xf4f7f2,transparent:true,opacity:.72,depthWrite:false}),foam,'jakub-cliff-surf');
 }

 // ---- copper steam mains between the factory courts
 {const P=[0,32],flanges=[],posts=[],wheels=[];
  for(const[from,to]of[[-2.39,-2.90],[2.39,2.90]]){
   // rear arc between two neighbouring courts, r 60 from the plaza centre, 7.5 m above the town grade
   const r=60,n=24,pts=[];
   for(let k=0;k<=n;k++){const a=from+(to-from)*k/n,x=P[0]+Math.sin(a)*r,z=P[1]+Math.cos(a)*r;pts.push(townSurfacePoint(root,x,z,R,.9+7.5));
    if(k%4===0&&occ.clear(x,z,1.1,true)){const m=seatTown(x,z,a);posts.push(m);wheels.push(off(m,0,6.2,.45));occ.claim(x,z,1.2);}}
   for(const[dr,rad]of[[0,.42],[1.05,.28]]){const shifted=new THREE.CatmullRomCurve3(pts.map((p,i)=>{const a=from+(to-from)*i/n;return p.clone().add(new THREE.Vector3(Math.sin(a),0,Math.cos(a)).multiplyScalar(dr));}));
    const tube=new THREE.Mesh(new THREE.TubeGeometry(shifted,80,rad,10,false),mat(0xa86a3e,{metalness:.55,roughness:.45}));tube.name='jakub-steam-main';tube.castShadow=true;g.add(tube);
    for(let k=1;k<12;k++){const p=shifted.getPointAt(k/12),tan=shifted.getTangentAt(k/12);flanges.push(new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromUnitVectors(Y,tan),new THREE.Vector3(rad+.12,.16,rad+.12)));}}
  stats.steamMains++;
  }
  inst(new THREE.CylinderGeometry(1,1,1,12),mat(0xc29a5b,{metalness:.6,roughness:.4}),flanges,'jakub-steam-flanges');
  inst(new THREE.BoxGeometry(.5,7.5,.5).translate(0,3.75,0),ironMat,posts,'jakub-steam-posts');
  inst(new THREE.BoxGeometry(2.2,.3,.6).translate(0,7.2,.5),ironMat,posts,'jakub-steam-saddles');
  inst(new THREE.TorusGeometry(.38,.06,6,16),mat(0xb43b2a,{metalness:.4}),wheels,'jakub-steam-valves');
 }
 return stats;
}
