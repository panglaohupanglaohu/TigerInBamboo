import * as THREE from 'three';
import {createBookshopWorker} from '../assets/bookshopWorker.js';
import {townSurfacePoint,townSurfaceMesh,seatTownObject,BOOKSHOP_SITE_OUTLINE} from './bookshopTownSite.js';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {mergeStaticGroup} from './geometryMerge.js';
export const BASE_REVISION=20;
export const BASE_PASSES=[
 'Large complete circular plaza follows spherical ground',
 'Concentric stone courses articulate the full circle',
 'Central eight-point compass and directional markers',
 'Continuous broad annular waterfront promenade',
 'Full circular perimeter kerb; no straight seaward chord',
 'Low curved shoreline masonry meets the sea',
 'Curved iron railings preserve open ocean views',
 'Waterfront lamps follow the complete seaward arc',
 'Public benches and reading seats',
 'Broad radial approaches to three large compounds',
 'Separate cargo dock approach outside the public circle',
 'Two shore access stairways',
 'Factory delivery gates and loading approach markers',
 'Continuous freight rails outside the pedestrian ring',
 'Four-bookshop wayfinding and tourist-shop sign',
 'Dockside spare-parts crates and trolleys',
 'Limited waterfront planters around reading areas',
 'People establish public versus industrial scale',
 'Curved-quay bollards, mooring ropes and life rings',
 'Final perimeter-joint and uninterrupted-circle correction',
];
export function buildBookshopBasePlaza({root,R=160,revision=BASE_REVISION}){
 const g=new THREE.Group();g.name='bookshop-base-circular-plaza';root.add(g);const K=factoryKit(g),{M,mesh,box,cyl,beam,pipe,torus,sign,crate}=K;
 const surf=(x,z,h=.98)=>townSurfacePoint(g,x,z,R,h);
 const point=(r,a)=>[Math.sin(a)*r,32+Math.cos(a)*r];
 function ringSurface(ri,ro,mat,h=.97){const pos=[],idx=[],n=192,nr=Math.max(2,Math.ceil((ro-ri)*2));for(let j=0;j<=nr;j++)for(let i=0;i<=n;i++){const a=i*Math.PI*2/n,r=ri+(ro-ri)*j/nr;pos.push(...surf(...point(r,a),h).toArray());}for(let j=0;j<nr;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();for(let i=0;i<geo.attributes.normal.count;i++){const n=geo.attributes.normal;if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.1){const p=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,i).add(new THREE.Vector3(0,R+.9,0)).normalize();n.setXYZ(i,p.x,p.y,p.z);}}mesh(geo,mat);}
 function curve(r,h,material,width=.035,start=0,end=Math.PI*2){const pts=[];for(let i=0;i<=160;i++)pts.push(surf(...point(r,start+(end-start)*i/160),h));mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),160,width,4,false),material);}
 const touristClear=(x,z)=>Math.hypot(x-28,z-63)>4.4;
 function seated(x,z,heading,build){const p=new THREE.Group();g.add(p);seatTownObject(g,p,x,z,heading,R);build(p);return p;}
 if(revision>=1)ringSurface(0,32,M.stone);
 if(revision>=2)for(const [a,b]of[[7.9,8.1],[15.9,16.2],[23.9,24.2],[30.5,31]])ringSurface(a,b,M.trim,1.0);
 if(revision>=3){for(let i=0;i<8;i++){const a=i*Math.PI/4,p=[[0,32],point(i%2?6:9,a),point(1.5,a+Math.PI/2)];const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p.flatMap(([x,z])=>surf(x,z,1.03).toArray()),3));geo.computeVertexNormals();mesh(geo,i%2?M.brass:M.slate);}curve(10.3,1.04,M.brass);}
 if(revision>=4){ringSurface(32,36.8,M.trim);ringSurface(36.8,39.5,M.stone);curve(34.5,1.01,M.brass);}
 if(revision>=5){curve(39.55,1.08,M.trim,.13);curve(39.9,.74,M.stone,.18);}
 if(revision>=6){for(let i=0;i<100;i++){const a=-Math.PI/2+(i+.5)*Math.PI/100,[x,z]=point(39.8,a);seated(x,z,a,p=>box(1.28,.6,.48,0,-.12,0,M.stone,p));}}
 if(revision>=7){for(let i=0;i<=48;i++){const a=-Math.PI/2+i*Math.PI/48,[x,z]=point(39.15,a);if(!touristClear(x,z))continue;seated(x,z,a,p=>{cyl(.055,1.0,0,.5,0,M.iron,p);cyl(.11,.12,0,1.04,0,M.brass,p);});}for(const h of[1.45,1.85]){curve(39.15,h,M.iron,.03,-Math.PI/2,.63);curve(39.15,h,M.iron,.03,.85,Math.PI/2);}}
 if(revision>=8){for(let i=0;i<=16;i++){const a=-Math.PI/2+i*Math.PI/16,[x,z]=point(37.5,a);if(!touristClear(x,z))continue;seated(x,z,a,p=>{cyl(.07,2.9,0,1.45,0,M.iron,p);cyl(.21,.16,0,.13,0,M.iron,p);box(.31,.44,.31,0,2.75,0,M.amber,p);mesh(new THREE.ConeGeometry(.3,.28,4),M.iron,0,3.08,0,p);});}}
 if(revision>=9){for(let i=0;i<8;i++){const a=-1.4+i*.4,[x,z]=point(35.7,a);seated(x,z,a+Math.PI,p=>{for(const zz of[-.25,0,.25])box(1.8,.07,.15,0,.48,zz,M.wood,p);for(const x of[-.75,.75]){box(.09,.47,.55,x,.24,0,M.iron,p);beam([x,.4,.3],[x,1.1,.4],.035,M.iron,p);}for(const y of[.76,1.0])box(1.8,.13,.06,0,y,.38,M.wood,p);});}}
 if(revision>=10){for(const angle of[-2.15,Math.PI,2.15]){const verts=[],ids=[];for(let j=0;j<=24;j++){const r=39+j*.4;for(const side of[-1,1]){const [x,z]=point(r,angle);verts.push(...surf(x+Math.cos(angle)*side*3,z-Math.sin(angle)*side*3,1).toArray());}if(j){const n=j*2;ids.push(n-2,n-1,n,n-1,n+1,n);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(ids);geo.computeVertexNormals();mesh(geo,M.stone);}}
 if(revision>=11)townSurfaceMesh(g,-65,-39,19,25,M.stone,R,1,24);
 if(revision>=12){for(const angle of[-1.05,1.05]){const [x,z]=point(40,angle);seated(x,z,angle,p=>{for(let i=0;i<5;i++)box(1.8,.13,.42,0,-.1-i*.15,i*.4,M.trim,p);});}}
 if(revision>=13){for(const a of[-2.15,Math.PI,2.15]){const[x,z]=point(43.5,a);seated(x,z,a,p=>{for(const x of[-4,4]){box(.55,1.9,.6,x,.95,0,M.stone,p);mesh(new THREE.SphereGeometry(.15,12,8),M.brass,x,2.1,0,p);}sign('厂区货运',2.0,.45,2.7,1.4,.34,p);});}}
 if(revision>=14){for(const r of[33,34.4])curve(r,1.06,M.iron,.05);for(let i=0;i<240;i++){const a=i*Math.PI/120,[x,z]=point(33.7,a);seated(x,z,a,p=>box(1.8,.055,.15,0,.13,0,M.wood,p));}}
 if(revision>=15){seated(25,57,Math.PI,p=>{cyl(.065,2.5,0,1.25,0,M.iron,p);sign('HARD TO FIND',2.1,.42,0,2,.05,p);sign('临海书店',1.6,.36,0,1.5,.05,p);});seated(-12,34,0,p=>{cyl(.07,2.4,0,1.2,0,M.iron,p);for(const [i,n]of['蝗虫书店','蚂蚁书店','甲壳虫书店'].entries())sign(n,1.8,.35,0,2.15-i*.42,.1,p);});}
 if(revision>=16){for(let i=0;i<14;i++){const x=-55+(i%3)*1.3,z=26+Math.floor(i/3)*1.3;seated(x,z,0,p=>crate(0,0,0,.9,p));}}
 if(revision>=17){for(const a of[-1.35,-.6,.35,1.2]){const[x,z]=point(35.5,a);seated(x,z,a,p=>{cyl(.42,.55,0,.275,0,M.copper,p);for(let i=0;i<4;i++)mesh(new THREE.IcosahedronGeometry(.26,0),M.slate,Math.cos(i)*.22,.7,Math.sin(i)*.22,p);});}}
 if(revision>=18){for(let i=0;i<19;i++){const a=-1.5+i*.17,[x,z]=point(35.0+(i%3)*.7,a);seated(x,z,a,p=>{const person=createBookshopWorker({coat:i%2?0x56626a:0x746b5d,carrying:i%5===0});p.add(person);});}}
 if(revision>=19){for(let i=0;i<15;i++){const a=-1.5+i*.21,[x,z]=point(39.5,a);seated(x,z,a,p=>{cyl(.16,.5,0,.25,0,M.iron,p);cyl(.24,.09,0,.53,0,M.brass,p);if(i%3===0){const t=torus(.3,.07,0,.65,.18,M.copper,p);t.rotation.y=.15;}});}const pts=[];for(let i=0;i<=30;i++)pts.push([-62-i*.18,1.4-Math.sin(i*Math.PI/30)*.4,36+i*.05]);pipe(pts,.035,M.wood);}
 if(revision>=20){const shore=[];for(let j=0;j<=192;j++){const a=j*Math.PI/96;shore.push(surf(Math.sin(a)*BOOKSHOP_SITE_OUTLINE.radius,BOOKSHOP_SITE_OUTLINE.centerZ+Math.cos(a)*BOOKSHOP_SITE_OUTLINE.radius,.5));}mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shore),192,.13,4,false),M.stone);for(let i=0;i<144;i++){const a=i*Math.PI/72;const pts=[surf(...point(32,a),1.015),surf(...point(39.3,a),1.015)];g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x85847b})));}curve(32,1.02,M.brass,.025);}
 mergeStaticGroup(g);g.userData.revision=revision;g.userData.passes=BASE_PASSES.slice(0,revision);g.userData.circle={center:[0,32],plazaRadius:32,promenadeRadius:39.5,shoreRadius:40,seawardArc:'continuous semicircle; no chord'};return g;
}
