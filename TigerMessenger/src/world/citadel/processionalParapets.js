import * as THREE from 'three';
import asset from '../../../assets/models/optimized/citadel-processional-parapets/processionalParapets.js';

export function buildProcessionalParapets(x,base,start,end,rise){
 const root=new THREE.Group();root.name='citadel-processional-parapets';
 root.position.set(x,base,end);
 root.scale.set(1,rise/asset.rise,(start-end)/asset.length);
 root.userData.sourceBlender=asset.source;
 root.userData.clearWidth=asset.clearWidth;
 const mats={wall:new THREE.MeshStandardMaterial({color:0xbeb5a2,roughness:.94}),coping:new THREE.MeshStandardMaterial({color:0xd9ceb8,roughness:.92})};
 for(const part of asset.parts){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));g.computeBoundingBox();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,mats[part.name]);m.name='processional-stair-'+part.name;
  m.castShadow=true;m.receiveShadow=true;m.userData.citadelSolidExterior=true;root.add(m);
 }
 return root;
}
