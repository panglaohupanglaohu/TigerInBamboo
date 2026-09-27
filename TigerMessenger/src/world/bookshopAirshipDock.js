import * as THREE from 'three';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {seatTownObject,townSurfacePoint} from './bookshopTownSite.js';
import {mergeStaticGroup} from './geometryMerge.js';

export function buildBookshopAirshipDock({root,R,colliders}){
 const mast=new THREE.Group();mast.name='bookshop-airship-mooring-mast';root.add(mast);seatTownObject(root,mast,-42,-51,.25,R);
 const {M,mesh,box,cyl,beam,pipe,torus,sign}=factoryKit(mast);
 for(const x of[-1.4,1.4])for(const z of[-1.4,1.4]){box(.24,17,.24,x,8.5,z,M.iron);box(.7,.3,.7,x,.15,z,M.stone);}
 for(let y=.5;y<16;y+=2.0)for(const side of[-1,1]){beam([-1.4,y,side*1.4],[1.4,y+2,side*1.4],.07,M.brass);beam([side*1.4,y,-1.4],[side*1.4,y+2,1.4],.07,M.brass);}
 for(const y of[5,10,16.7]){box(3.5,.18,3.5,0,y,0,M.iron);for(const s of[-1,1])beam([-1.7,y+.8,s*1.7],[1.7,y+.8,s*1.7],.04,M.brass);}
 for(let y=.3;y<16.7;y+=.32)beam([-.30,y,1.5],[.30,y,1.5],.025,M.iron);
 for(const x of[-.30,.30])beam([x,0,1.5],[x,16.7,1.5],.04,M.brass);
 sign('AIR FREIGHT · MOORING TOWER',3.2,.55,0,3.1,1.6);
 // An anchored cargo airship supplies the skyline; it is not a playable vehicle.
 const vessel=new THREE.Group();vessel.name='bookshop-moored-cargo-airship';vessel.position.set(0,23,-6);mast.add(vessel);
 const K=factoryKit(vessel),A=K.M;
 K.mesh(new THREE.SphereGeometry(1,40,24),A.slate,0,0,0).scale.set(3.0,3.3,12.5);
 for(let i=-5;i<=5;i++){const z=i*2.1,r=Math.sqrt(1-z*z/(12.5*12.5)),ring=K.torus(3*r,.036,0,0,z,A.brass);ring.scale.y=1.1;}
 for(let k=0;k<12;k++){const a=k*Math.PI/6,points=[];for(let j=0;j<=32;j++){const t=-Math.PI/2+j*Math.PI/32;points.push([Math.cos(a)*3*Math.cos(t),Math.sin(a)*3.3*Math.cos(t),Math.sin(t)*12.5]);}K.pipe(points,.025,A.iron);}
 for(const z of[-6,0,6]){K.beam([-.9,-2.9,z],[-.65,-4.4,z*.6],.05,A.iron);K.beam([.9,-2.9,z],[.65,-4.4,z*.6],.05,A.iron);}
 K.box(1.75,1.25,7.5,0,-4.3,-.3,A.iron);K.box(1.95,.12,7.8,0,-3.62,-.3,A.brass);
 for(const s of[-1,1])for(let z=-2.8;z<3;z+=1.1){K.box(.04,.48,.70,s*.90,-4.1,z,A.amber);K.box(.07,.04,.78,s*.93,-4.1,z,A.brass);}
 for(const s of[-1,1]){const nacelle=K.cyl(.44,2.9,s*3.1,-1.8,-3,A.copper);nacelle.rotation.x=Math.PI/2;K.beam([s*1.8,-2.4,-2.4],[s*3.1,-1.8,-2.4],.09,A.iron);const hub=new THREE.Group();hub.position.set(s*3.1,-1.8,-4.65);vessel.add(hub);K.cyl(.12,.28,0,0,0,A.iron,hub).rotation.x=Math.PI/2;for(let j=0;j<3;j++){const blade=K.box(.13,1.25,.045,Math.sin(j*Math.PI*2/3)*.48,Math.cos(j*Math.PI*2/3)*.48,0,A.wood,hub);blade.rotation.z=-j*Math.PI*2/3;}hub.name='airship-propeller';}
 for(const s of[-1,1]){const fin=K.box(3.6,.09,4.2,s*2.0,0,-9.5,A.slate);fin.rotation.y=-s*.25;}K.box(.10,4.4,3.5,0,1.5,-9.2,A.slate);
 for(const x of[-.8,.8])K.beam([x,-4.9,0],[x,-6,0],.025,A.iron);K.crate(0,-7.1,0,1.5);
 mergeStaticGroup(vessel); // Moored: the propellers are intentionally stationary.
 const envelope=vessel.position.clone();
 beam([0,17,0],[0,17,1.5],.1,M.iron);pipe([[0,17,1.5],[.4,18.5,4],[0,23,6.5]],.035,M.wood);
 mergeStaticGroup(mast,{skip:o=>{for(let p=o;p;p=p.parent)if(p===vessel)return true;return false;}});
 colliders.push({position:root.localToWorld(townSurfacePoint(root,-42,-51,R)),radius:2.0,kind:'bookshop-mooring-tower'});
 return t=>{vessel.position.y=envelope.y+Math.sin(t*.18)*.12;vessel.rotation.z=Math.sin(t*.13)*.006;};
}
