import * as THREE from 'three';
import {cragGeometry} from './mountainRockGeometry.js';
import {mergeStaticGroup} from '../geometryMerge.js';

export function addMountainCrags(castle,surfaces,material,{radius=160,rail=[],protectedBoxes=[]}={}){
 const root=new THREE.Group();root.name='citadel-study-fractured-buttresses';root.userData.skipColliders=true;root.userData.decorativeOnly=true;castle.add(root);
 castle.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),inverseRotation=root.getWorldQuaternion(new THREE.Quaternion()).invert();
 const anchors=[],random=n=>{const x=Math.sin(n*12.9898+77.8)*43758.5453;return x-Math.floor(x);};
 let tested=0,skipped=0;
 for(const surface of surfaces){
  const a=surface.geometry.attributes.position,idx=surface.geometry.index,count=idx?.count??a.count;
  for(let i=0;i<count&&anchors.length<220;i+=3){
   if(random(i+surface.name.length*11)>.12)continue;
   const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(a,idx?idx.getX(i+j):i+j).applyMatrix4(surface.matrixWorld));
   const [p0,p1,p2]=points,normal=p1.clone().sub(p0).cross(p2.clone().sub(p0));const area=normal.length()/2;if(area<3||area>180)continue;
   normal.normalize();const center=p0.clone().add(p1).add(p2).multiplyScalar(1/3),up=center.clone().normalize();
   // The historic heightfield is double-sided with downward triangle winding.
   // Place dressing on the visible outward surface, independent of that winding.
   if(normal.dot(up)<0)normal.negate();const slope=normal.dot(up);
   if(slope<.04||slope>.72||center.length()<radius+5)continue;
   tested++;
   const halfWidth=.85+random(i+7)*1.0,halfHeight=1.35+random(i+21)*2.0,depth=.55+random(i+36)*.60;
   const clearance=halfHeight+2;
   if(rail.some(p=>p.distanceToSquared(center)<196)||protectedBoxes.some(b=>b.distanceToPoint(center)<clearance)||anchors.some(p=>new THREE.Vector3(...p.world).distanceToSquared(center)<16)){skipped++;continue;}
   const axisY=up.clone().addScaledVector(normal,-slope).normalize(),axisX=axisY.clone().cross(normal).normalize();
   const worldQuaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(axisX,axisY,normal));
   const mesh=new THREE.Mesh(cragGeometry(i+surface.name.length),material);mesh.name='mountain-fractured-buttress';
   mesh.position.copy(center).addScaledVector(normal,-depth*.42).applyMatrix4(inverse);
   mesh.quaternion.copy(inverseRotation).multiply(worldQuaternion);mesh.scale.set(halfWidth,halfHeight,depth);
   mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.skipColliders=true;mesh.userData.skipInkOutline=true;root.add(mesh);
   anchors.push({world:center.toArray(),source:surface.name,size:[halfWidth,halfHeight,depth],slope});
  }
 }
 mergeStaticGroup(root,{mergedTag:'study-rock-crags',onSurface:m=>{m.name='citadel-study-rock-crags';m.userData.skipColliders=true;m.userData.skipInkOutline=true;}});
 root.userData.placement={tested,skipped,count:anchors.length,anchors};return root;
}
