import {PLAZA_SHIFT,PLAZA_OFFSET_ENABLED,PLAZA_R03} from './newPlazaLayout.js';
import newBaked from '../../../assets/models/optimized/citadel-plaza-retaining/plazaRetainingR02.js';
import wideBaked from '../../../assets/models/optimized/citadel-plaza-retaining/plazaRetainingR03.js';
import * as THREE from 'three';
import oldBaked from '../../../assets/models/optimized/citadel-plaza-retaining/plazaRetainingR01.js';
import {createOceanHeightSampler} from './oceanSurface.js';
import {mergeStaticGroup} from '../geometryMerge.js';
// Survey the final deformed cliff. The wall grows from that rock to the plaza rim.
export function buildPlazaRetainingWall(castle,radius=160){
 const baked=PLAZA_R03?wideBaked:PLAZA_OFFSET_ENABLED?newBaked:oldBaked;
 const city=castle.getObjectByName('highland-west-city');if(!city||city.getObjectByName('citadel-plaza-retaining-wall'))return;
 castle.updateWorldMatrix(true,true);const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),up=new THREE.Vector3(0,1,0).transformDirection(city.matrixWorld),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=400;
 const sea=createOceanHeightSampler(city,radius),samples=[];
 const rock=(x,z)=>{ray.set(city.localToWorld(new THREE.Vector3(x,100,z)),up.clone().negate());const hit=ray.intersectObject(terrain,false)[0];const y=hit?city.worldToLocal(hit.point.clone()).y:null;samples.push({x,z,y});return y;};
 const root=new THREE.Group();root.name='citadel-plaza-retaining-wall';city.add(root);
 const stone=new THREE.MeshStandardMaterial({color:0xc7c2b4,roughness:.96,flatShading:true}),trim=new THREE.MeshStandardMaterial({color:0xe0d7c5,roughness:.94});
 const positions=[];
 function hexa(points){for(const tri of [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])for(const i of [tri[0],tri[2],tri[1]])positions.push(...points[i]);}
 const piers=[];
 for(const x of [46,53.5,63+PLAZA_SHIFT*.4,72+PLAZA_SHIFT*.7,80+PLAZA_SHIFT]){
  const feet=[[-.95,87.85],[.95,87.85],[-.95,90.1],[.95,90.1]].map(([dx,z])=>rock(x+dx,z));
  if(feet.some(y=>y===null))continue;
  const bottom=Math.min(...feet)-.3,top=3.86;
  if(bottom>=top-.4)continue;
  hexa([[x-.95,bottom,87.85],[x+.95,bottom,87.85],[x+.95,bottom,90.1],[x-.95,bottom,90.1],[x-.62,top,87.85],[x+.62,top,87.85],[x+.62,top,88.95],[x-.62,top,88.95]]);
  piers.push({x,top,bottom,feet,sea:sea(x,90.1)});
 }
 // Curtain courses descend onto the rock, with slight mortar reveals.
 const bays=[];const bayCount=PLAZA_SHIFT?27:23,span=35.42+PLAZA_SHIFT;for(let j=0;j<bayCount;j++){
  const x=45.2+(j+.5)*(span/bayCount),half=span/(bayCount*2);
  const a=rock(x-half,88.5),b=rock(x+half,88.5);if(a===null||b===null)continue;
  const bottom=Math.min(a,b)-.2,top=3.82;
  if(bottom>=top)continue;
  hexa([[x-half,bottom,87.95],[x+half,bottom,87.95],[x+half,bottom,88.58],[x-half,bottom,88.58],[x-half,top,87.95],[x+half,top,87.95],[x+half,top,88.58],[x-half,top,88.58]]);
  bays.push({x,bottom,top,width:half*2});
 }
 if(PLAZA_SHIFT){
  for(let j=0;j<18;j++){
   const z=60.3+(j+.5)*28.2/18,half=28.2/36,x=80.65+PLAZA_SHIFT;
   const a=rock(x,z-half),b=rock(x,z+half);if(a===null||b===null)throw new Error('Expanded plaza east wall has no rock support');
   const bottom=Math.min(a,b)-.3,top=3.82;if(bottom>=top)continue;
   hexa([[x-.32,bottom,z-half],[x+.32,bottom,z-half],[x+.32,bottom,z+half],[x-.32,bottom,z+half],[x-.32,top,z-half],[x+.32,top,z-half],[x+.32,top,z+half],[x-.32,top,z+half]]);
   bays.push({x,z,bottom,top,width:half*2,easternReturn:true});
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();const m=new THREE.Mesh(g,stone);m.name='plaza-retaining-stone';m.castShadow=true;m.receiveShadow=true;m.userData.citadelSolidExterior=true;root.add(m);
 for(const top of [3.65,1.8]){const b=new THREE.Mesh(new THREE.BoxGeometry(35.5+PLAZA_SHIFT,.16,.74),trim);b.name='plaza-retaining-stringcourse';b.position.set(62.91+PLAZA_SHIFT/2,top,88.3);b.castShadow=true;b.receiveShadow=true;b.userData.citadelSolidExterior=true;root.add(b);}
 mergeStaticGroup(root,{mergedTag:'plaza-retaining',onSurface:m=>{m.name='plaza-retaining-solid';m.userData.citadelSolidExterior=true;}});
 if(baked){root.children.forEach((m,i)=>{const part=baked.parts[i],input=m.geometry.index?m.geometry.toNonIndexed():m.geometry;let digest=2166136261;for(const v of input.attributes.position.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;if(!part||digest!==part.sourceDigest)throw new Error('Retaining wall terrain changed: regenerate Blender asset');if(input!==m.geometry)input.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));m.geometry.dispose();m.geometry=g;});root.userData.sourceBlender=baked.source;}
 root.userData.support={piers,bays,samples,top:3.86,source:'final Web cliff raycast',insidePlaza:false};return root;
}
