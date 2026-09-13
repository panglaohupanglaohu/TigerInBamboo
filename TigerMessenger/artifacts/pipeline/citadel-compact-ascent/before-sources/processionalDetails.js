import * as THREE from 'three';
import {WEST_CITY} from './westCityLayout.js';
import {mergeStaticGroup} from '../geometryMerge.js';

// Architecture around the existing walkable stair flights; never narrow their 7.2 m opening.
export function buildProcessionalDetails(){
 const root=new THREE.Group();root.name='citadel-processional-stonework';
 const stone=new THREE.MeshStandardMaterial({color:0xd8d5c6,roughness:.93});
 const trim=new THREE.MeshStandardMaterial({color:0xb8b6aa,roughness:.91});
 const blue=new THREE.MeshStandardMaterial({color:0x2059a6,roughness:.85,side:THREE.DoubleSide});
 const gold=new THREE.MeshStandardMaterial({color:0xcbb271,roughness:.7});
 function block(name,x,y,z,w,h,d,material=stone){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.name=name;
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
 }
 function banner(x,y,z,index){
  block('processional-banner-pole-'+index,x,y+2.7,z,.10,5.4,.10,gold);
  block('processional-banner-crossbar-'+index,x,y+4.95,z,1.55,.09,.09,gold);
  const s=new THREE.Shape();s.moveTo(-.65,0);s.lineTo(.65,0);s.lineTo(.65,-2.8);s.lineTo(0,-2.48);s.lineTo(-.65,-2.8);s.closePath();
  const flag=new THREE.Mesh(new THREE.ShapeGeometry(s),blue);flag.name='processional-blue-standard-'+index;
  flag.position.set(x,y+4.9,z+.08);root.add(flag);
  // Gold spear/trident motif, shared visual language with the approved gate reference.
  for(const dx of [-.23,0,.23])block('standard-mark-'+index+'-'+dx,x+dx,y+4.12,z+.10,.055,dx===0?.95:.5,.016,gold);
  block('standard-mark-join-'+index,x,y+3.9,z+.10,.50,.055,.016,gold);
 }
 for(let tier=1;tier<WEST_CITY.districts.length;tier++){
  const low=WEST_CITY.districts[tier-1],high=WEST_CITY.districts[tier];
  const start=low.z-2,end=high.z+2,n=11,run=(start-end)/n;
  for(const side of [-1,1]){
   for(let i=0;i<n;i++){
    const top=low.y+(high.y-low.y)*(i+1)/n;
    const z=start-(i+.5)*run;
    block('stair-parapet-'+tier+'-'+side+'-'+i,WEST_CITY.x+side*4.08,top+.42,z,.75,.84,run+.035);
    block('stair-coping-'+tier+'-'+side+'-'+i,WEST_CITY.x+side*4.08,top+.89,z,.91,.14,run+.045,trim);
   }
   for(const [j,z,y] of [[0,start,low.y],[1,end,high.y]]){
    block('stair-pier-'+tier+'-'+side+'-'+j,WEST_CITY.x+side*4.25,y+.82,z,1.02,1.64,1.02);
    block('stair-pier-cap-'+tier+'-'+side+'-'+j,WEST_CITY.x+side*4.25,y+1.72,z,1.17,.16,1.17,trim);
    banner(WEST_CITY.x+side*4.25,y+1.8,z,tier+'-'+side+'-'+j);
   }
  }
  // Terrace front parapets stop at the stair piers, leaving the central landing open.
  for(const side of [-1,1]){
   block('terrace-front-wall-'+tier+'-'+side,WEST_CITY.x+side*(high.halfWidth+4.75)/2,high.y+.52,high.z+9.12,high.halfWidth-4.75,1.04,.62);
   block('terrace-front-coping-'+tier+'-'+side,WEST_CITY.x+side*(high.halfWidth+4.75)/2,high.y+1.10,high.z+9.12,high.halfWidth-4.60,.13,.82,trim);
   for(let i=0;i<Math.floor((high.halfWidth-4.75)/1.64);i++)block('terrace-merlon-'+tier+'-'+side+'-'+i,WEST_CITY.x+side*(5.25+i*1.64),high.y+1.35,high.z+9.12,.8,.45,.78);
  }
 }
 mergeStaticGroup(root,{mergedTag:'processional-stonework'});
 for(const mesh of root.children)if(mesh.isMesh){
  if(mesh.material===stone)mesh.name='processional-solid-stone';
  if(mesh.material===trim)mesh.name='processional-solid-coping';
 }
 root.userData.sourceId='citadel-processional-stonework-v1';
 return root;
}
