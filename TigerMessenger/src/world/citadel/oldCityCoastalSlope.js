import * as THREE from 'three';
import data from '../../../assets/models/optimized/citadel-old-city-slope/oldCityCoastalR03.js';
export function applyOldCityCoastalSlope(castle){
 if(!castle.getObjectByName('citadel-old-shore-approach'))return;
 for(const part of data.parts){
 const mesh=castle.getObjectByName(part.name);if(!mesh||mesh.userData.oldCityCoastalSlope)continue;
 const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
 let hash=2166136261;for(const v of source.attributes.position.array)hash=Math.imul(hash^Math.round(v*1e4),16777619)>>>0;
 if(source!==mesh.geometry)source.dispose();
 if(hash!==part.sourceDigest)throw new Error('Old-city coastal source changed; regenerate Blender slope');
 const geometry=new THREE.BufferGeometry();
 for(const [name,key]of [['position','positions'],['normal','normals'],['color','colors']])geometry.setAttribute(name,new THREE.Float32BufferAttribute(part[key],3));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 mesh.geometry.dispose();mesh.geometry=geometry;
 const highlight=castle.getObjectByName('backlit-highlight-'+part.name);
 if(highlight){highlight.geometry.dispose();highlight.geometry=geometry.clone();}
 mesh.userData.oldCityCoastalSlope={source:part.source,triangles:part.triangles,maxShift:part.maxShift};
 }
}
