import {PLAZA_SHIFT,PLAZA_OFFSET_ENABLED,PLAZA_R03,PLAZA_LAYOUT} from './newPlazaLayout.js';
import newBaked from '../../../assets/models/optimized/citadel-plaza-edge/plazaEdgeR02.js';
import wideBaked from '../../../assets/models/optimized/citadel-plaza-edge/plazaEdgeR03.js';
import * as THREE from 'three';
import oldBaked from '../../../assets/models/optimized/citadel-plaza-edge/plazaEdgeR01.js';
import {buildCitadelCypress} from './citadelGarden.js';
import {buildSlopeShrub} from '../highlandCitadelDesign.js';
import {mergeStaticGroup} from '../geometryMerge.js';
// Author-space perimeter; the open western landing at z=82 stays unobstructed.
export function buildPlazaEdgeGarden(){
 const baked=PLAZA_R03?wideBaked:PLAZA_OFFSET_ENABLED?newBaked:oldBaked;
 const edge=x=>x+Math.max(0,(x-53.5)/(80.62-53.5))*PLAZA_SHIFT;
 const root=new THREE.Group();root.name='citadel-plaza-edge-garden';
 const wall=new THREE.Group(),plants=new THREE.Group();root.add(wall,plants);
 const stone=new THREE.MeshStandardMaterial({color:0xc7c1b1,roughness:.96}),cap=new THREE.MeshStandardMaterial({color:0xe1d8c5,roughness:.94}),soil=new THREE.MeshStandardMaterial({color:0x474b35,roughness:1});
 const shrubMat={shrubDeep:new THREE.MeshStandardMaterial({color:0x395c48,roughness:1,flatShading:true}),shrubMid:new THREE.MeshStandardMaterial({color:0x567653,roughness:1,flatShading:true}),shrubLight:new THREE.MeshStandardMaterial({color:0x73916a,roughness:1,flatShading:true})};
 function box(name,x,y,z,w,h,d,mat=stone,parent=wall){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function course(a,b){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=Math.ceil(len/1.6);for(let row=0;row<3;row++)for(let j=0;j<n;j++){const t=(j+.5)/n;const m=box('plaza-parapet-ashlar',a[0]+dx*t,4.155+row*.31,a[1]+dz*t,len/n-.025,.295,.55);m.rotation.y=-Math.atan2(dz,dx);}const m=box('plaza-parapet-coping',(a[0]+b[0])/2,4.99,(a[1]+b[1])/2,len+.12,.16,.72,cap);m.rotation.y=-Math.atan2(dz,dx);}
 const lines=[[[45.2,88.12],[80.62,88.12]],[[45.2,84.3],[45.2,88.12]],[[80.62,79.6],[80.62,88.12]]];lines.forEach(line=>line.forEach(p=>p[0]=edge(p[0])));lines.forEach(([a,b])=>course(a,b));
 for(const [sourceX,z]of [[45.2,88.12],[53.5,88.12],[63,88.12],[72,88.12],[80.62,88.12],[45.2,84.3],[80.62,79.6]]){const x=edge(sourceX);box('plaza-parapet-pier',x,4.64,z,.92,1.28,.92);box('plaza-pier-cap',x,5.32,z,1.04,.16,1.04,cap);}
 const beds=[[49,86.7,4.5],[57,86.7,4.5],[66,86.7,4.5],[76,86.7,5.4]];
 beds.forEach(b=>b[0]=edge(b[0]));
 beds.forEach(([x,z,w],i)=>{
  box('plaza-planter-soil',x,4.22,z,w-.3,.3,1.2,soil,plants);
  for(const side of [-1,1])box('plaza-planter-rim',x,4.27,z+side*.76,w,.54,.24,cap);
  for(const side of [-1,1])box('plaza-planter-end',x+side*(w/2-.12),4.27,z,.24,.54,1.3,cap);
  for(let j=0;j<5;j++)plants.add(buildSlopeShrub(shrubMat,100+i*7+j,x+(j-2)*w/6,z+Math.sin(j+i)*.2,.52,{surfaceY:4.36}));
 });
 const trees=[[48.5,86.7,.70],[66.5,86.7,.60],[77,86.7,.78]];
 trees.forEach(t=>t[0]=edge(t[0]));
 trees.forEach(([x,z,size],i)=>{const t=buildCitadelCypress(size,.7*i);t.position.set(x,4.35,z);plants.add(t);});
 mergeStaticGroup(wall,{mergedTag:'plaza-parapet',onSurface:m=>{m.name='plaza-edge-solid';m.userData.citadelSolidExterior=true;}});
 if(baked){wall.children.forEach((m,i)=>{const part=baked.parts[i];if(!part)throw new Error('Missing Blender plaza edge');const input=m.geometry.index?m.geometry.toNonIndexed():m.geometry;let digest=2166136261;for(const v of input.attributes.position.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;if(digest!==part.sourceDigest)throw new Error('Plaza edge changed: regenerate Blender asset');if(input!==m.geometry)input.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));m.geometry.dispose();m.geometry=g;});root.userData.sourceBlender=baked.source;}
 mergeStaticGroup(plants,{mergedTag:'plaza-edge-planting',onSurface:m=>{m.name='plaza-edge-planting';}});
 root.userData.layout={lines,beds,trees,entrance:{x:45.2,z:82,clearWidth:3.5},plazaFloor:4,ringCenter:[PLAZA_LAYOUT.statueX,76],ringRadius:PLAZA_LAYOUT.ringRadius};
 return root;
}
