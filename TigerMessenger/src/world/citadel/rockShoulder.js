import * as THREE from 'three';
import baked from '../../../assets/models/optimized/citadel-rock-shoulder/rockShoulderR02.js';

// Blender outer rock terraces, below the established plaza and outside its routes.
export function buildNewCityRockShoulder(castle) {
 if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('citadelRockShoulder')==='0')return;
 const city=castle.getObjectByName('highland-west-city');
 if(!city||city.getObjectByName('new-city-rock-shoulder'))return;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(baked.positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(baked.normals,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(baked.colors,3));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='new-city-rock-shoulder';
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.citadelSolidExterior=true;
 mesh.userData.sourceBlender=baked.source;city.add(mesh);return mesh;
}
