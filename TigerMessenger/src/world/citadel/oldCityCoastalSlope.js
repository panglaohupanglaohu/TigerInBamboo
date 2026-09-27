import * as THREE from 'three';
import data from '../../../assets/models/optimized/citadel-old-city-slope/oldCityCoastalR03.js';
export function applyOldCityCoastalSlope(castle){
 if(!castle.getObjectByName('citadel-old-shore-approach'))return;
 for(const part of data.parts){
 const mesh=castle.getObjectByName(part.name);if(!mesh||mesh.userData.oldCityCoastalSlope)continue;
 const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
 let hash=2166136261;for(const v of source.attributes.position.array)hash=Math.imul(hash^Math.round(v*1e4),16777619)>>>0;
 if(source!==mesh.geometry)source.dispose();
 if(hash!==part.sourceDigest){
  // 2026-09-18 主人报告启动炸掉：海岸塑形改动旧城网格后，烘焙坡面指纹失配。
  // 校验失败不再 throw 炸掉整个启动——告警并跳过该部件（保留当前网格形态），
  // 需要恢复烘焙坡面时重跑 Blender 烘焙步骤即可。
  console.warn('Old-city coastal source changed; continuing with slope update', { hash, expected: part.sourceDigest });
  mesh.userData.oldCityCoastalSlope = { stale: true, source: part.source };
  continue;
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,key]of [['position','positions'],['normal','normals'],['color','colors']])geometry.setAttribute(name,new THREE.Float32BufferAttribute(part[key],3));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 mesh.geometry.dispose();mesh.geometry=geometry;
 const highlight=castle.getObjectByName('backlit-highlight-'+part.name);
 if(highlight){highlight.geometry.dispose();highlight.geometry=geometry.clone();}
 mesh.userData.oldCityCoastalSlope={source:part.source,triangles:part.triangles,maxShift:part.maxShift};
 }
}
