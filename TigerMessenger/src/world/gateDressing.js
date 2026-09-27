import * as THREE from 'three';
import data from '../../assets/models/optimized/gate-of-sighs/gateDressingData.js';
/** Blender-authored surface wear follows the gate; landscape follows the sampled rail site. */
export function installGateDressing(seat){
 if(seat.userData.gateDressing)return seat.userData.gateDressing;
 const meshes=[];
 for(const part of data.parts){
  const geometry=new THREE.BufferGeometry();
  for(const [key,values] of Object.entries({position:part.positions,normal:part.normals,color:part.colors}))geometry.setAttribute(key,new THREE.Float32BufferAttribute(values,3));
  geometry.computeBoundingSphere();
  const wear=part.kind==='wear';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,flatShading:true,polygonOffset:wear,polygonOffsetFactor:wear?-1:0,polygonOffsetUnits:wear?-1:0});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=part.name;mesh.castShadow=!wear;mesh.receiveShadow=true;
  (wear?seat:(seat.userData.siteRoot||seat)).add(mesh);meshes.push(mesh);
 }
 seat.userData.gateDressing=meshes;return meshes;
}
