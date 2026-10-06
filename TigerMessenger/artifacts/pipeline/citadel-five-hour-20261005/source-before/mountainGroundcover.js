import * as THREE from 'three';
import {mountainHabitat} from './mountainHabitat.js';
import {addMountainGrass} from './mountainGrass.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// Cover existing upward rock triangles; never invent an independent ground plane.
export function addMountainGroundcover(root,surfaces,{radius,rail,protectedBoxes}){
 const positions=[],colors=[],accepted=[],up=new THREE.Vector3(),normal=new THREE.Vector3(),tri=new THREE.Triangle(),center=new THREE.Vector3();
 const inv=root.matrixWorld.clone().invert(),local=new THREE.Vector3(),dark=new THREE.Color('#536b42'),light=new THREE.Color('#95a872');
 let area=0;
 for(const mesh of surfaces){
  const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
  for(let i=0;i<(idx?idx.count:p.count);i+=3){
   [tri.a,tri.b,tri.c].forEach((v,j)=>v.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
   tri.getMidpoint(center);tri.getNormal(normal);up.copy(center).normalize();local.copy(center).applyMatrix4(inv);
   // Authored open mountain sheets contain reversed winding; radial orientation
   // is canonical for these known terrain surfaces, not for arbitrary meshes.
   const signed=normal.dot(up),slope=/citadel-oskar-grid-mountain-surface|citadel-backdrop-ridge|new-city-rock-shoulder/.test(mesh.name)?Math.abs(signed):signed,alt=center.length()-radius-officialOceanLevelAt(center);
   if(slope<.66||alt<2||local.y>37||tri.getArea()<.015)continue;
   const patch=mountainHabitat(local.x,local.z);
   if(patch<-.9)continue;
   const reach=Math.max(center.distanceTo(tri.a),center.distanceTo(tri.b),center.distanceTo(tri.c));
   if(rail.some(q=>q.distanceToSquared(center)<(12+reach)**2)||protectedBoxes.some(b=>b.distanceToPoint(center)<2+reach))continue;
   if(signed<0){const swap=tri.b.clone();tri.b.copy(tri.c);tri.c.copy(swap);}
   const tint=dark.clone().lerp(light,THREE.MathUtils.clamp((slope-.70)*1.7+.12*Math.sin(local.x*.12),0,.75));
   for(const v of [tri.a,tri.b,tri.c]){const q=v.clone().addScaledVector(v.clone().normalize(),.055).applyMatrix4(inv);positions.push(q.x,q.y,q.z);colors.push(tint.r,tint.g,tint.b);}
   accepted.push(tri.clone());area+=tri.getArea();
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.name='citadel-study-groundcover';mesh.userData.skipColliders=true;mesh.userData.skipInkOutline=true;mesh.userData.ashleyPalette=1;mesh.userData.holyOldTownDone=true;root.add(mesh);
 const grass=addMountainGrass(root,accepted);
 return {grass,triangles:positions.length/9,area,method:'supported rock triangles, slope and patch field with expanded path exclusions'};
}
