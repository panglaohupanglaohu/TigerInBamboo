import * as THREE from 'three';
import data from '../../../assets/models/optimized/citadel-front-coast/frontCoastOpenWater.js';

// Saved Blender shore geometry, applied before surface/collision preparation.
// Preserve the original objects, materials, NPCs and story references.
export function applyFrontHarborCoast(scene,castle){
 const city=castle.getObjectByName('highland-west-city');if(!city)return;
 scene.updateMatrixWorld(true);
 const counts={},found=new Map();
 scene.traverse(o=>{if(!o.isMesh)return;const ordinal=counts[o.name]??0;counts[o.name]=ordinal+1;found.set(o.name+':'+ordinal,o);});
 const work=[],skipped=[];
 for(const part of data.parts){
  const mesh=found.get(part.name+':'+part.ordinal),a=mesh?.geometry?.attributes.position;
  // 2026-09-17 主人反馈：烘焙盘把书店镇台地整个换成 open-water 盆（hills 中心 -2.2），
  // 书店（按 groundLiftAt=6 落位）与走廊松树全部悬空。前港烘焙只针对圣城子树内的
  // 海岸网格；世界地形（hills/裙边/海床/营地色块）由代码生成，不在替换范围。
  let inCastle=false;if(mesh)for(let n=mesh;n;n=n.parent)if(n===castle){inCastle=true;break;}
  if(!inCastle){skipped.push(part.name+':'+part.ordinal);continue;}
  if(!a||a.count*3!==part.sourcePositions.length||part.sourcePositions.some((v,i)=>Math.abs(a.array[i]-v)>.002)||part.matrix.some((v,i)=>Math.abs(mesh.matrixWorld.elements[i]-v)>.002)){
   castle.userData.frontHarborCoast={status:'error',part:part.name,reason:'Original coast source or placement changed'};return;
  }
  work.push({mesh,part});
 }
 if(data.cityMatrix.some((v,i)=>Math.abs(city.matrixWorld.elements[i]-v)>.002)){
  castle.userData.frontHarborCoast={status:'error',reason:'New city placement changed'};return;
 }
 for(const {mesh,part} of work){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));
  if(part.indices)geometry.setIndex(part.indices);
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));
  if(part.colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(part.colors,3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const previous=mesh.geometry;mesh.geometry=geometry;
  mesh.userData.frontHarborCoast={source:data.source,ordinal:part.ordinal};previous.dispose();
 }
 castle.userData.frontHarborCoast={status:'ready',source:data.source,geometrySignature:data.geometrySignature??null,parts:work.length,skippedParts:skipped,basin:data.basin};
}
