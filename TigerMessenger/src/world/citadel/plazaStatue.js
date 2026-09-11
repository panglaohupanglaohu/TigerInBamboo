import * as THREE from 'three';
import data from '../../../assets/models/optimized/citadel-statue/citadelStatueData.js';
import {mergeStaticGroup} from '../geometryMerge.js';

// Same reviewed Blender geometry in Web and in the subsequent Godot city export.
export function buildCitadelPlazaStatue(){
  const root=new THREE.Group();root.name='citadel-plaza-hero-statue';
  root.userData.sourceId='citadel-soldier-statue-r03';
  root.userData.sourceBlender='assets/models/optimized/citadel-statue/citadel-soldier-statue-r03.blend';
  root.scale.setScalar(1.2);
  const materials=data.materials.map(m=>{
    const p=m.pbrMetallicRoughness;
    return new THREE.MeshStandardMaterial({name:m.name,color:new THREE.Color().setRGB(...p.baseColorFactor.slice(0,3)),roughness:p.roughnessFactor,metalness:p.metallicFactor,side:m.doubleSided?THREE.DoubleSide:THREE.FrontSide});
  });
  for(const part of data.parts){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.position,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normal,3));
    geometry.setIndex(part.index);
    const mesh=new THREE.Mesh(geometry,materials[part.material]);mesh.name=part.name;
    mesh.position.fromArray(part.translation);mesh.quaternion.fromArray(part.rotation);mesh.scale.fromArray(part.scale);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  mergeStaticGroup(root,{mergedTag:'citadel-statue'});
  return root;
}
