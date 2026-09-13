import * as THREE from 'three';
import {PLAZA_R03,PLAZA_LAYOUT} from './newPlazaLayout.js';
import {buildCitadelCypress} from './citadelGarden.js';
import {buildSlopeShrub} from '../highlandCitadelDesign.js';
import {mergeStaticGroup} from '../geometryMerge.js';
import {createOceanHeightSampler} from './oceanSurface.js';

// Approved cypress family, grouped on the final new-city rock shoulders.
export function buildTerracePlanting(castle,radius=160){
 if(!PLAZA_R03)return;
 const city=castle.getObjectByName('highland-west-city');
 if(!city||castle.getObjectByName('citadel-terrace-planting'))return;
 castle.updateWorldMatrix(true,true);
 const surfaces=['citadel-oskar-grid-mountain-surface','new-city-rock-shoulder'].map(n=>castle.getObjectByName(n)).filter(Boolean);
 const ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=200;
 const up=new THREE.Vector3(0,1,0).transformDirection(city.matrixWorld),sea=createOceanHeightSampler(city,radius);
 const sample=(x,z)=>{ray.set(city.localToWorld(new THREE.Vector3(x,100,z)),up.clone().negate());const hit=ray.intersectObjects(surfaces,true)[0];return hit?city.worldToLocal(hit.point.clone()).y:null;};
 const paths=[city.userData.walkRoute,city.userData.harborToKeepRoute,city.userData.horsePlazaExit].filter(Boolean).map(path=>path.map(p=>city.worldToLocal(castle.localToWorld(new THREE.Vector3(...p)))));
 const distance=(x,z)=>{let best=Infinity;for(const path of paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,d=dx*dx+dz*dz;if(d<1e-8)continue;const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/d,0,1);best=Math.min(best,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}return best;};
 const buildingBounds=[],inverseCity=city.matrixWorld.clone().invert();
 city.traverseVisible(mesh=>{
  if(!mesh.isMesh||!/wall|gate|tower|town|house|roof|dome|stair|solid|parapet/i.test(mesh.name))return;
  let parent=mesh;while(parent&&parent!==city){if(/plant|garden|shrub|forest/i.test(parent.name))return;parent=parent.parent;}
  mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseCity,mesh.matrixWorld));
  buildingBounds.push({name:mesh.name,box,mesh,matrix:new THREE.Matrix4().multiplyMatrices(inverseCity,mesh.matrixWorld)});
 });
 const intersectsMasonry=(b,box)=>{
  if(!b.box.intersectsBox(box))return false;
  const g=b.mesh.geometry,p=g.attributes.position,index=g.index,triangle=new THREE.Triangle();
  for(let i=0,n=index?index.count:p.count;i<n;i+=3){
   triangle.a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(b.matrix);
   triangle.b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(b.matrix);
   triangle.c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(b.matrix);
   if(box.intersectsTriangle(triangle))return true;
  }
  return false;
 };
 const plantBounds=plant=>{
  plant.updateMatrixWorld(true);const box=new THREE.Box3();
  plant.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));});
  return box;
 };
 const mats={shrubDeep:new THREE.MeshStandardMaterial({color:0x395c48,roughness:1,flatShading:true}),shrubMid:new THREE.MeshStandardMaterial({color:0x567653,roughness:1,flatShading:true}),shrubLight:new THREE.MeshStandardMaterial({color:0x73916a,roughness:1,flatShading:true})};
 const root=new THREE.Group();root.name='citadel-terrace-planting';city.add(root);
 const report={trees:[],shrubs:[],omitted:[],source:'original Blender citadel-cypress family',minimumRouteClearance:2.4};
 const seeds=[[43,72],[45,65],[43,57],[47,50],[47,43],[48,35],[73,43],[77,49],[82,55],[87,62],[89,70],[88,80],[41,79],[79,35],[44,27]];
 // Two discontinuous shoulder ribbons frame the approach without filling the
 // plaza or screening the gate. Small offsets prevent a plantation-grid look.
 for(let i=0;i<10;i++){
  seeds.push([38.5+1.3*Math.sin(i*1.7),28+i*4.8]);
  seeds.push([84.5+2.2*Math.sin(i*1.3),25+i*4.1]);
 }
 const occupied=[];
 // The older watergate at (42,60.5) has a separate approach, outside the main
 // front-harbor route. Reserve its view and walking corridor explicitly.
 const acceptable=(x,z,r)=>distance(x,z)>2.4+r&&Math.hypot(x-PLAZA_LAYOUT.statueX,z-76)>PLAZA_LAYOUT.ringRadius+r+.5&&!(x>77&&x<93&&z>64&&z<80)&&!(Math.abs(x-42)<4.8+r&&z>54-r&&z<68+r);
 for(const [i,[sx,sz]]of seeds.entries())for(const [j,[dx,dz,size]]of [[0,0,.68],[1.2,-1.6,.42],[-1.1,-2.9,.53]].entries()){
  const x=sx+dx,z=sz+dz,foot=.16*size;
  if(!acceptable(x,z,size)||occupied.some(p=>Math.hypot(p[0]-x,p[1]-z)<1.6)){report.omitted.push({x,z,reason:'clearance'});continue;}
  const feet=[[0,0],[foot,0],[-foot,0],[0,foot],[0,-foot]].map(([a,b])=>sample(x+a,z+b));
  if(feet.some(y=>y===null)||Math.max(...feet)-Math.min(...feet)>.65||Math.min(...feet)<sea(x,z)+.4){report.omitted.push({x,z,reason:'root-support'});continue;}
  const y=Math.min(...feet)-.04,tree=buildCitadelCypress(size,i*.71+j);tree.position.set(x,y,z);
  // Unparented plant matrices are authored city-local; compare the actual crown
  // envelope against masonry, including arch approaches that routes may omit.
  const crown=plantBounds(tree),obstruction=buildingBounds.find(b=>intersectsMasonry(b,crown));
  if(obstruction){report.omitted.push({x,z,reason:'building-crown-clearance',object:obstruction.name});continue;}
  root.add(tree);occupied.push([x,z]);
  report.trees.push({x,y,z,size,feet,routeDistance:distance(x,z),crown:{min:crown.min.toArray(),max:crown.max.toArray()}});
  for(let k=0;k<3;k++){
   const a=x+(k-1)*.6,b=z+.6+.2*Math.sin(i+k),h=sample(a,b);
   if(h===null||Math.abs(h-y)>.65||!acceptable(a,b,.45))continue;
   const shrub=buildSlopeShrub(mats,800+i*20+j*3+k,a,b,.42,{surfaceY:h-.04});
   const shrubBox=plantBounds(shrub);if(buildingBounds.some(o=>intersectsMasonry(o,shrubBox)))continue;
   root.add(shrub);report.shrubs.push({x:a,y:h-.04,z:b});
  }
 }
 // Low understorey can use shallow pockets where full trees cannot fit.
 // Keep the same exact masonry check and reserve the ring and watergate.
 for(const [i,[x,z]]of seeds.entries())for(let k=0;k<4;k++){
  const a=x+Math.cos(i*.8+k*1.7)*1.7,b=z+Math.sin(i*.8+k*1.7)*1.7;
  if(!acceptable(a,b,.65)||report.shrubs.some(p=>Math.hypot(p.x-a,p.z-b)<.9))continue;
  const feet=[[0,0],[.25,0],[-.25,0],[0,.25],[0,-.25]].map(([dx,dz])=>sample(a+dx,b+dz));
  if(feet.some(h=>h===null)||Math.max(...feet)-Math.min(...feet)>.45||Math.min(...feet)<sea(a,b)+.4)continue;
  const y=Math.min(...feet)-.04,shrub=buildSlopeShrub(mats,2000+i*4+k,a,b,.62,{surfaceY:y});
  const bounds=plantBounds(shrub);if(buildingBounds.some(o=>intersectsMasonry(o,bounds)))continue;
  root.add(shrub);report.shrubs.push({x:a,y,z:b,layer:'understorey',feet});
 }
 mergeStaticGroup(root,{mergedTag:'terrace-planting'});root.userData.planting=report;return report;
}
