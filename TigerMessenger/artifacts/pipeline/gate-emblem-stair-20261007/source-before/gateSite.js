import * as THREE from 'three';
import data from '../../assets/models/optimized/gate-of-sighs/gateSiteData.js';
export const GATE_SITE_ANCHOR=data.anchorU;
export const GATE_SITE_ORIGIN=Object.freeze([...data.origin]);
export const GATE_SITE_QUATERNION=data.quaternion;
/** Fixed to the actual sampled rail, independently of editor moves of the gate. */
export function installGateSite(group,seat){
 const root=new THREE.Group();root.name='gate-canyon-site-blender';root.position.fromArray(data.origin);root.quaternion.fromArray(data.quaternion);
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,flatShading:true});
 for(const part of data.parts){const geometry=new THREE.BufferGeometry();for(const [key,values] of Object.entries({position:part.positions,normal:part.normals,color:part.colors}))geometry.setAttribute(key,new THREE.Float32BufferAttribute(values,3));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.name=part.name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.gateWalkable=part.walkable;root.add(mesh);}
 root.userData.triangles=data.triangles;root.userData.approachRoute=data.approachRoute;group.add(root);seat.userData.siteRoot=root;return root;
}
export function sampleGateSiteGround(root){
 if(!root)return()=>null;const ray=new THREE.Raycaster(),local=new THREE.Vector3(),up=new THREE.Vector3(),down=new THREE.Vector3(),origin=new THREE.Vector3();ray.far=2.5;const walkable=root.children.filter(o=>o.userData.gateWalkable),bounds=new THREE.Box3();for(const mesh of walkable){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox);}bounds.expandByScalar(3);
 return position=>{root.updateWorldMatrix(true,false);local.copy(position);root.worldToLocal(local);if(!bounds.containsPoint(local))return null;root.updateWorldMatrix(false,true);up.copy(position).normalize();ray.set(origin.copy(position).addScaledVector(up,.4),down.copy(up).negate());for(const hit of ray.intersectObjects(walkable,false))if(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(up)>.5)return hit.point.length();return null;};
}
