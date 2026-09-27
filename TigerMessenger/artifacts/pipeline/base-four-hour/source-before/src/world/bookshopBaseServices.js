import * as THREE from 'three';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {createBookshopWorker} from '../assets/bookshopWorker.js';
import {townSurfacePoint,seatTownObject,townSurfaceMesh,BOOKSHOP_SITE_OUTLINE} from './bookshopTownSite.js';
import {mergeStaticGroup} from './geometryMerge.js';

export function buildBookshopBaseServices({root,R,colliders}){
 const g=new THREE.Group();g.name='bookshop-base-services';root.add(g);const K=factoryKit(g),{M,mesh,box,cyl,beam,roof,sign,crate}=K;
 const surf=(x,z,h=.94)=>townSurfacePoint(g,x,z,R,h);
 const at=(x,z,yaw,build)=>{const p=new THREE.Group();g.add(p);seatTownObject(g,p,x,z,yaw,R);build(p);return p;};
 // Rear service ring leaves all three public forecourts open and reaches the dock.
 const pos=[],idx=[],N=192;
 for(let i=0;i<=N;i++){const a=i*Math.PI*2/N;for(const radius of[BOOKSHOP_SITE_OUTLINE.roadRadius-1.5,BOOKSHOP_SITE_OUTLINE.roadRadius+1.5])pos.push(...surf(Math.sin(a)*radius,BOOKSHOP_SITE_OUTLINE.centerZ+Math.cos(a)*radius,.94).toArray());if(i){const j=i*2;idx.push(j-2,j-1,j,j-1,j+1,j);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();mesh(geo,M.slate);
 // Thin seawall extends down into the water; the land is never raised into a podium.
 const coast=[],ci=[];
 for(let i=0;i<=256;i++){const a=i*Math.PI/128,x=Math.sin(a)*BOOKSHOP_SITE_OUTLINE.radius,z=BOOKSHOP_SITE_OUTLINE.centerZ+Math.cos(a)*BOOKSHOP_SITE_OUTLINE.radius;for(const h of[.91,.25])coast.push(...surf(x,z,h).toArray());if(i){const j=i*2;ci.push(j-2,j-1,j,j-1,j+1,j);}}
 const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(coast,3));cg.setIndex(ci);cg.computeVertexNormals();mesh(cg,M.stone);
 for(let i=0;i<80;i++){const a=i*Math.PI/40,x=Math.sin(a)*(BOOKSHOP_SITE_OUTLINE.radius-1.1),z=BOOKSHOP_SITE_OUTLINE.centerZ+Math.cos(a)*(BOOKSHOP_SITE_OUTLINE.radius-1.1);if(Math.hypot(x+58,z-43)<17)continue;at(x,z,a,p=>{cyl(.12,.52,0,.26,0,M.iron,p);cyl(.20,.10,0,.54,0,M.brass,p);});}
 // Two spare-part warehouses, explicitly separate from the four bookshops.
 for(const side of[-1,1]){
  const x=side*23,z=-76;
  townSurfaceMesh(g,x-8.8,x+8.8,z-5.5,z+7,M.stone,R,.96,12);
  at(x,z,0,p=>{
   box(16,4.8,.20,0,2.4,-4.5,M.stone,p);
   for(const s of[-1,1])box(.2,4.8,9,s*8,2.4,0,M.stone,p);
   roof(0,4.8,0,16.7,9.6,2,p);
   for(const xx of[-8,-2.7,2.7,8]){box(.22,4.8,.32,xx,2.4,4.5,M.iron,p);box(.40,.18,.5,xx,.1,4.5,M.trim,p);}
   box(16,.35,.25,0,4.65,4.5,M.iron,p);sign(side<0?'备件仓库 · A':'原料仓库 · B',9,.7,0,4.15,4.66,p);
   for(let row=0;row<3;row++)for(let j=0;j<7;j++)crate(-6+j*2,0,-3+row*2,1.1,p);
   for(const xx of[-6,-2,2,6]){cyl(.12,4.4,xx,2.2,-3.8,M.iron,p);box(.3,.45,.3,xx,3.8,4.75,M.amber,p);}
   const person=createBookshopWorker({apron:true,carrying:true});person.position.set(1,0,5.2);p.add(person);
  });
  for(let xx=x-8;xx<=x+8;xx+=1.2)colliders.push({position:g.localToWorld(surf(xx,z-4.5)),radius:.65,kind:'bookshop-warehouse-wall'});
  for(const sideX of[-8,8])for(let zz=z-4.5;zz<=z+4.5;zz+=1.0)colliders.push({position:g.localToWorld(surf(x+sideX,zz)),radius:.55,kind:'bookshop-warehouse-wall'});
  for(const xx of[-8,-2.7,2.7,8])colliders.push({position:g.localToWorld(surf(x+xx,z+4.5)),radius:.25,kind:'bookshop-warehouse-pier'});
 }
 // Public compass labels use transparent ground decals, not standing signboards.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 for(const [i,label]of['N','E','S','W'].entries()){
  const c=canvas.cloneNode(),ctx=c.getContext('2d');ctx.fillStyle='#bba577';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 170px serif';ctx.fillText(label,128,128);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const a=i*Math.PI/2,x=Math.sin(a)*12.3,z=32-Math.cos(a)*12.3;
  const p=at(x,z,0,()=>{}),decal=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));decal.rotation.x=-Math.PI/2;decal.position.y=.15;p.add(decal);
 }
 mergeStaticGroup(g);g.userData.role='Perimeter road, low seawall and two spare-part warehouses';return g;
}
