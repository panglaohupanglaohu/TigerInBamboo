import * as THREE from 'three';
import data from '../../../assets/models/optimized/citadel-old-city-support/oldCitySupportR02.js';
export function buildOldCitySupport(castle){
 const parent=castle.getObjectByName('citadel-old-shore-approach');
 if(!parent||parent.getObjectByName('citadel-old-city-support-spur'))return null;
 castle.updateWorldMatrix(true,true);
 const foundation=castle.getObjectByName('highland-town-foundation-platform');
 const local=castle.matrixWorld.clone().invert().multiply(foundation.matrixWorld);
 const expected=new THREE.Matrix4().fromArray(data.castleMatrix).invert().multiply(new THREE.Matrix4().fromArray(data.foundationMatrix));
 if(castle.matrixWorld.elements.some((v,i)=>Math.abs(v-data.castleMatrix[i])>1e-4)||castle.userData.oldShoreApproach.route.length!==data.route.length||local.elements.some((v,i)=>Math.abs(v-expected.elements[i])>1e-4)||castle.userData.oldShoreApproach.route.some((p,i)=>p.some((v,j)=>Math.abs(v-data.route[i]?.[j])>1e-4)))throw new Error('Old city support requires Blender re-export after foundation or route changes');
 const geometry=new THREE.BufferGeometry();
 for(const [attribute,key] of [['position','positions'],['normal','normals'],['color','colors']])geometry.setAttribute(attribute,new THREE.Float32BufferAttribute(data[key],3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98}));
 mesh.name='citadel-old-city-support-spur';mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.citadelSolidExterior=true;
 mesh.userData.source='assets/models/optimized/citadel-old-city-support/old-city-support-r02.blend';parent.add(mesh);return mesh;
}
