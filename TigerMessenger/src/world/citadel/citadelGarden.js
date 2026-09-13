import * as THREE from 'three';
import data from '../../../assets/models/optimized/citadel-cypress/citadelCypressData.js';
import {buildSlopeShrub} from '../highlandCitadelDesign.js';
import {mergeStaticGroup} from '../geometryMerge.js';
export function buildCitadelGarden(){
 const root=new THREE.Group();root.name='citadel-terrace-garden';
 const trees=[[48,4,80,.86],[72,4,80,.98],[46.3,4,58,.78],[73.7,4,58,.88],[44.5,10,33,.92],[75.5,10,33,1],[40,16,12,1.12],[80,16,12,.96]];
 trees.forEach(([x,y,z,size],i)=>{const tree=buildCitadelCypress(size,i*.91);tree.position.set(x,y,z);root.add(tree);});
 const shrubs={shrubs:[]};
 const shrubMat={shrubDeep:new THREE.MeshStandardMaterial({color:0x7fa89b,roughness:1,flatShading:true}),shrubMid:new THREE.MeshStandardMaterial({color:0x94b5a5,roughness:1,flatShading:true}),shrubLight:new THREE.MeshStandardMaterial({color:0x6b9488,roughness:1,flatShading:true})};
 const beds=[[48,4,80],[72,4,80],[46.3,4,58],[73.7,4,58],[44.5,10,33],[75.5,10,33],[40,16,12],[80,16,12]];
 beds.forEach(([x,y,z],i)=>{for(let j=0;j<3;j++){const dx=(j-1)*.65,dz=.75+Math.sin(i+j)*.15;root.add(buildSlopeShrub(shrubMat,i*3+j,x+dx,z+dz,.45,{surfaceY:y+.01}));shrubs.shrubs.push([x+dx,y+.01,z+dz]);}});
 root.userData.planting={trees:trees.map(t=>t.slice(0,3)),shrubs:shrubs.shrubs,source:data.source};
 mergeStaticGroup(root,{mergedTag:'citadel-garden'});
 return root;
}

let cypressParts=null,cypressMaterials=null;
export function buildCitadelCypress(size=1,yaw=0){
 if(!cypressParts){
 cypressMaterials=data.materials.map(m=>{const p=m.pbrMetallicRoughness;return new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(...p.baseColorFactor.slice(0,3)),roughness:.93});});
 cypressParts=data.parts.map(p=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(p.normal,3));g.setIndex(p.index);return {part:p,geometry:g};});

 }
 const tree=new THREE.Group();tree.name='approved-citadel-cypress';tree.scale.setScalar(size);tree.rotation.y=yaw;
 for(const {part:p,geometry} of cypressParts){const mesh=new THREE.Mesh(geometry,cypressMaterials[p.material]);mesh.position.fromArray(p.translation);mesh.quaternion.fromArray(p.rotation);mesh.scale.fromArray(p.scale);mesh.castShadow=true;mesh.receiveShadow=true;tree.add(mesh);}
 return tree;
}
