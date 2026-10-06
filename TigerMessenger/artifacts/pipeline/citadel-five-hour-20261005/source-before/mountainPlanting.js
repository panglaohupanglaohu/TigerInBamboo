import * as THREE from 'three';
import {mountainHabitat} from './mountainHabitat.js';
import {addMountainGroundcover} from './mountainGroundcover.js';
import {buildCitadelCypress} from './citadelGarden.js';
import {buildCitadelLeafyShrub} from './leafyShrub.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// Plants are sampled against the final relocated/fractured mountain. The
// legacy merged grove and analytic-height grass cannot be individually
// regrounded after bay deformation. Retire them with their obsolete terrain;
// replacement planting below raycasts only the final rendered surfaces.
export function plantStudyMountains(castle,surfaces,{radius=160,rail=[],protectedBoxes=[],preservePalette=false,spacing=4.5}={}){
 const retired=[];
 for(const name of['citadel-mountain-cypress-groves','highland-mountain-slope-vegetation','highland-slope-shrub-vegetation','highland-slope-grass-billboards']){
  const old=castle.getObjectByName(name);if(old){old.visible=false;retired.push(name);}
 }
 const root=new THREE.Group();root.name='citadel-study-mountain-planting';root.userData.skipColliders=true;castle.add(root);castle.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),inverseQ=root.getWorldQuaternion(new THREE.Quaternion()).invert(),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=200;
 const boxes=surfaces.map(o=>({o,box:new THREE.Box3().setFromObject(o)}));
 let seed=98231;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 spacing=Math.min(spacing,1.9);
 const trees=[],shrubs=[],rejected={wet:0,steep:0,path:0,foot:0,crowded:0};
 function sample(direction){
  const origin=direction.clone().multiplyScalar(radius+130);ray.set(origin,direction.clone().negate());
  const near=boxes.filter(b=>ray.ray.intersectsBox(b.box)).map(b=>b.o);
  const hit=ray.intersectObjects(near,false)[0];if(!hit||hit.point.length()<radius+officialOceanLevelAt(hit.point)+1)return null;
  const up=hit.point.clone().normalize(),normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  return {point:hit.point,up,slope:Math.abs(normal.dot(up)),source:hit.object.name};
 }
 for(let z=-65;z<98;z+=spacing)for(let x=-112;x<128;x+=spacing){
  const px=x+(random()-.5)*3,pz=z+(random()-.5)*3;
  if(mountainHabitat(px,pz)<-.55||random()>.88)continue;
  const direction=castle.localToWorld(new THREE.Vector3(px,0,pz)).normalize(),hit=sample(direction);
  if(!hit){rejected.wet++;continue;}if(hit.slope<.63){rejected.steep++;continue;}
  const size=.68+random()*.52,isTree=random()>.46,margin=isTree?2.8:1.5;
  if(rail.some(p=>p.distanceToSquared(hit.point)<144)||protectedBoxes.some(b=>b.distanceToPoint(hit.point)<margin)){rejected.path++;continue;}
  if([...trees,...shrubs].some(p=>new THREE.Vector3(...p.world).distanceToSquared(hit.point)<(isTree?5.5:2.1))){rejected.crowded++;continue;}
  const axisX=new THREE.Vector3(1,0,0).cross(hit.up).normalize(),axisZ=hit.up.clone().cross(axisX),feet=[];
  for(const [dx,dz]of [[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]]){
   const foot=sample(hit.point.clone().addScaledVector(axisX,dx).addScaledVector(axisZ,dz).normalize());if(foot)feet.push(foot.point.length());
  }
  if(feet.length!==5||Math.max(...feet)-Math.min(...feet)>.7){rejected.foot++;continue;}
  const placed=hit.point.clone().setLength(Math.min(...feet)-.035);
  const matrix=new THREE.Matrix4().compose(placed.clone().applyMatrix4(inverse),inverseQ.clone().multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),hit.up)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),random()*Math.PI*2)),new THREE.Vector3(size,size,size));
  const row={world:placed.toArray(),source:hit.source,size,footSpread:Math.max(...feet)-Math.min(...feet),slope:hit.slope,matrix:matrix.toArray()};
  (isTree?trees:shrubs).push(row);
 }
 const materialCache=new Map();
 const makeInstances=(prototype,placements,label)=>{
  prototype.updateMatrixWorld(true);prototype.traverse(part=>{
   if(!part.isMesh)return;
   const original=part.material;let material=materialCache.get(original);
   if(!material){material=original.clone();material.emissive?.set(0);material.emissiveIntensity=0;material.roughness=.95;
    const h={};material.color.getHSL(h);material.color.set(h.h>.14&&h.h<.5?(h.l>.15?'#546b48':'#304c3d'):'#5c5143');materialCache.set(original,material);}
   const mesh=new THREE.InstancedMesh(part.geometry,material,placements.length);mesh.name='citadel-study-'+label;
   placements.forEach((p,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().fromArray(p.matrix).multiply(part.matrixWorld)));
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.skipColliders=true;mesh.userData.skipInkOutline=true;
   // Late old-town sweeps must not replace the approved living foliage palette.
   if(preservePalette){mesh.userData.ashleyPalette=1;mesh.userData.holyOldTownDone=true;}
   root.add(mesh);
  });
 };
 makeInstances(buildCitadelCypress(1),trees,'cypress');
 const shrubMats={shrubDeep:new THREE.MeshStandardMaterial({color:0x34553e}),shrubMid:new THREE.MeshStandardMaterial({color:0x526747}),shrubLight:new THREE.MeshStandardMaterial({color:0x718058})};
 makeInstances(buildCitadelLeafyShrub(shrubMats,19,0,0,.7),shrubs,'understory');
 const groundcover=addMountainGroundcover(root,surfaces,{radius,rail,protectedBoxes});
 root.userData.planting={groundcover,trees:trees.map(({matrix,...r})=>r),shrubs:shrubs.map(({matrix,...r})=>r),retired,rejected};return root;
}
