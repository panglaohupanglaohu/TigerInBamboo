import * as THREE from 'three';
import {PLAZA_R03,PLAZA_LAYOUT} from './newPlazaLayout.js';
import {buildCitadelCypress} from './citadelGarden.js';
import {createOptimizedSaihojiPine,getOptimizedSaihojiPineBounds} from '../../assets/saihojiPineOptimized.js';
import {buildCitadelLeafyShrub as buildSlopeShrub} from './leafyShrub.js';
import {mergeStaticGroup} from '../geometryMerge.js';
import {createOceanHeightSampler} from './oceanSurface.js';
import {createNewCityGuardPosts} from './newCityGuardPosts.js';

// Original cypress and Blender pine families on verified new-city supports.
export function buildTerracePlanting(castle,radius=160){
 if(!PLAZA_R03)return;
 const city=castle.getObjectByName('highland-west-city');
 if(!city||castle.getObjectByName('citadel-terrace-planting'))return;
 castle.updateWorldMatrix(true,true);
 const surfaces=['citadel-oskar-grid-mountain-surface','new-city-rock-shoulder'].map(n=>castle.getObjectByName(n)).filter(Boolean);
 city.traverseVisible(mesh=>{if(mesh.isMesh&&(mesh.userData.westCityWalkable||mesh.name.startsWith('citadel-upper-rock-'))&&!mesh.userData.isOutline&&!surfaces.includes(mesh))surfaces.push(mesh);});
 const ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=200;
 const up=new THREE.Vector3(0,1,0).transformDirection(city.matrixWorld),sea=createOceanHeightSampler(city,radius);
 const sample=(x,z)=>{ray.set(city.localToWorld(new THREE.Vector3(x,100,z)),up.clone().negate());const hit=ray.intersectObjects(surfaces,true)[0];return hit?city.worldToLocal(hit.point.clone()).y:null;};
 const paths=[city.userData.walkRoute,city.userData.harborToKeepRoute,city.userData.horsePlazaExit].filter(Boolean).map(path=>path.map(p=>city.worldToLocal(castle.localToWorld(new THREE.Vector3(...p)))));
 const distance=(x,z)=>{let best=Infinity;for(const path of paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,d=dx*dx+dz*dz;if(d<1e-8)continue;const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/d,0,1);best=Math.min(best,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}return best;};
 const buildingBounds=[],inverseCity=city.matrixWorld.clone().invert();
 city.traverseVisible(mesh=>{
  if(!mesh.isMesh||(!mesh.userData.citadelSolidExterior&&!/wall|gate|tower|town|house|roof|dome|stair|solid|parapet/i.test(mesh.name)))return;
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
 const guardLayout=createNewCityGuardPosts(castle);
 const guardPoints=guardLayout?[...guardLayout.groups.flatMap(g=>g.points),...guardLayout.archers].map(p=>city.worldToLocal(p.clone())):[];
 const report={trees:[],shrubs:[],broadPines:[],pineCandidates:[],omitted:[],source:'original Blender citadel-cypress family',minimumRouteClearance:2.4};
 const seeds=[[43,72],[45,65],[43,57],[47,50],[47,43],[48,35],[73,43],[77,49],[82,55],[87,62],[89,70],[88,80],[41,79],[79,35],[44,27]];
 // Two discontinuous shoulder ribbons frame the approach without filling the
 // plaza or screening the gate. Small offsets prevent a plantation-grid look.
 for(let i=0;i<10;i++){
  seeds.push([38.5+1.3*Math.sin(i*1.7),28+i*4.8]);
  seeds.push([84.5+2.2*Math.sin(i*1.3),25+i*4.1]);
 }
 // Small clusters beside the stepped terraces, using their actual floor
 // rather than the mountain hidden below their retaining foundations.
 for(const z of [26,33,40,47,54])for(const x of [45,49,72,77])seeds.push([x+.4*Math.sin(z),z]);
 // Front harbor pockets inherit the final stepped slabs, not a guessed
 // mountain height. The same route, crown and support rejection applies.
 const harbor=city.getObjectByName('citadel-front-harbor');
 for(const terrace of harbor?.userData.eastTerraces??[])seeds.push([59,terrace.z-.3]);
 seeds.push([44.5,100],[44.5,95.5]);
 const occupied=[];
 // The older watergate at (42,60.5) has a separate approach, outside the main
 // front-harbor route. Reserve its view and walking corridor explicitly.
 const acceptable=(x,z,r)=>distance(x,z)>2.4+r&&guardPoints.every(p=>Math.hypot(x-p.x,z-p.z)>1.1+r)&&Math.hypot(x-PLAZA_LAYOUT.statueX,z-76)>PLAZA_LAYOUT.ringRadius+r+.5&&!(x>77&&x<93&&z>64&&z<80)&&!(Math.abs(x-42)<4.8+r&&z>54-r&&z<68+r);
 const covered=(x,y,z)=>{
  ray.set(city.localToWorld(new THREE.Vector3(x,y+.15,z)),up);ray.far=100;
  const hit=ray.intersectObjects(buildingBounds.map(b=>b.mesh),false)[0];ray.far=200;
  return !!hit;
 };
 for(const [i,[sx,sz]]of seeds.entries())for(const [j,[dx,dz,size]]of [[0,0,.68],[1.2,-1.6,.42],[-1.1,-2.9,.53]].entries()){
  const x=sx+dx,z=sz+dz,foot=.16*size;
  if(!acceptable(x,z,size)||occupied.some(p=>Math.hypot(p[0]-x,p[1]-z)<1.6)){report.omitted.push({x,z,reason:'clearance'});continue;}
  const feet=[[0,0],[foot,0],[-foot,0],[0,foot],[0,-foot]].map(([a,b])=>sample(x+a,z+b));
  if(feet.some(y=>y===null)||Math.max(...feet)-Math.min(...feet)>.65||Math.min(...feet)<sea(x,z)+.4){report.omitted.push({x,z,reason:'root-support'});continue;}
  const y=Math.min(...feet)-.04,tree=buildCitadelCypress(size,i*.71+j);tree.position.set(x,y,z);
  if(covered(x,y,z)){report.omitted.push({x,z,reason:'covered-by-building'});continue;}
  // Unparented plant matrices are authored city-local; compare the actual crown
  // envelope against masonry, including arch approaches that routes may omit.
  const crown=plantBounds(tree),obstruction=buildingBounds.find(b=>intersectsMasonry(b,crown));
  if(obstruction){report.omitted.push({x,z,reason:'building-crown-clearance',object:obstruction.name});continue;}
  root.add(tree);occupied.push([x,z]);
  report.trees.push({x,y,z,size,feet,routeDistance:distance(x,z),crown:{min:crown.min.toArray(),max:crown.max.toArray()}});
  for(let k=0;k<3;k++){
   const a=x+(k-1)*.6,b=z+.6+.2*Math.sin(i+k),h=sample(a,b);
   if(h===null||Math.abs(h-y)>.65||!acceptable(a,b,.45)||covered(a,h,b))continue;
   const shrub=buildSlopeShrub(mats,800+i*20+j*3+k,a,b,.42,{surfaceY:h-.04});
   const shrubBox=plantBounds(shrub);if(buildingBounds.some(o=>intersectsMasonry(o,shrubBox)))continue;
   root.add(shrub);report.shrubs.push({x:a,y:h-.04,z:b});
  }
 }
 // Low understorey can use shallow pockets where full trees cannot fit.
 // Keep the same exact masonry check and reserve the ring and watergate.
 for(const [i,[x,z]]of seeds.entries())for(let k=0;k<7;k++){
  const a=x+Math.cos(i*.8+k*1.7)*1.7,b=z+Math.sin(i*.8+k*1.7)*1.7;
  if(!acceptable(a,b,1.05)||report.shrubs.some(p=>Math.hypot(p.x-a,p.z-b)<.9))continue;
  const feet=[[0,0],[.45,0],[-.45,0],[0,.45],[0,-.45]].map(([dx,dz])=>sample(a+dx,b+dz));
  if(feet.some(h=>h===null)||Math.max(...feet)-Math.min(...feet)>.45||Math.min(...feet)<sea(a,b)+.4)continue;
  const y=Math.min(...feet)-.04,shrub=buildSlopeShrub(mats,2000+i*4+k,a,b,1.05,{surfaceY:y});
  if(covered(a,y,b))continue;
  const bounds=plantBounds(shrub);if(buildingBounds.some(o=>intersectsMasonry(o,bounds)))continue;
  root.add(shrub);report.shrubs.push({x:a,y,z:b,layer:'understorey',feet});
 }
 // Broad crowns on the outer upper shoulders echo the approved target.
 // Reuse the actual Blender pine geometry, with its aged two-tone trunk;
 // keep the source factory and the Saihoji instances untouched.
 const pineSeed=1229,pineBounds=getOptimizedSaihojiPineBounds(pineSeed);
 for(const [group,size,anchors]of [
  ['west-upper',1.5,[[39.7,26.4]]],
  ['east-upper',1.4,[[77.97648438045935,52.4]]]
 ]){
  for(const [x,z]of anchors){
   const margin=pineBounds.crownRadius*size;
   const candidate={group,x,z,size};report.pineCandidates.push(candidate);
   if(!acceptable(x,z,margin)){candidate.reason='route-or-plaza';continue;}
   const foot=.3*size,feet=[[0,0],[foot,0],[-foot,0],[0,foot],[0,-foot]].map(([a,b])=>sample(x+a,z+b));
   if(feet.some(y=>y===null)||Math.max(...feet)-Math.min(...feet)>.65||Math.min(...feet)<sea(x,z)+.4){candidate.reason='root-support';candidate.feet=feet;continue;}
   const y=Math.min(...feet)-.06,tree=createOptimizedSaihojiPine(pineSeed);
   tree.scale.setScalar(size);tree.rotation.y=group==='west-upper'?.4:-.6;tree.position.set(x,y,z);
   const crown=plantBounds(tree);
   // Pine roots extend below the authored origin. Contact with a terrace
   // floor is expected; check above-ground trunk and crown against masonry.
   const clearanceBox=crown.clone();clearanceBox.min.y=Math.max(clearanceBox.min.y,y+.15);
   if(covered(x,y,z)||buildingBounds.some(b=>intersectsMasonry(b,clearanceBox))){candidate.reason='masonry';continue;}
   if(report.broadPines.some(p=>crown.intersectsBox(new THREE.Box3(new THREE.Vector3(...p.crown.min),new THREE.Vector3(...p.crown.max))))){candidate.reason='pine-crown';continue;}
   candidate.reason='placed';
   // Replace overlapping small cypresses instead of stacking crowns.
   const removed=[];
   report.trees=report.trees.filter(t=>{
    if(!crown.intersectsBox(new THREE.Box3(new THREE.Vector3(...t.crown.min),new THREE.Vector3(...t.crown.max))))return true;
    const original=root.children.find(o=>o.name==='approved-citadel-cypress'&&Math.abs(o.position.x-t.x)<.001&&Math.abs(o.position.z-t.z)<.001);
    if(original){root.remove(original);removed.push({x:t.x,z:t.z});}return false;
   });
   root.add(tree);report.broadPines.push({group,replacedCypresses:removed,x,y,z,size,feet,routeDistance:distance(x,z),crownRadius:margin,crown:{min:crown.min.toArray(),max:crown.max.toArray()},source:tree.userData.pineOptimization});break;
  }
 }
 mergeStaticGroup(root,{mergedTag:'terrace-planting'});root.userData.planting=report;return report;
}
