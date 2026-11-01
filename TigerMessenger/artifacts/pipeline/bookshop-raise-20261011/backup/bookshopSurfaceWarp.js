import * as THREE from 'three';

// Deform static factory geometry onto the planet while transporting its authored
// normals with the deformation Jacobian. Recomputing non-indexed normals turns
// every smooth dome into flat triangles, so preserve those surface normals here.
export function warpFactoryToSphere(shop,district,R){
 district.updateWorldMatrix(true,true);
 const inverse=district.matrixWorld.clone().invert();
 const originWorld=district.getWorldPosition(new THREE.Vector3());
 const worldToDistrictRotation=new THREE.Matrix3().setFromMatrix4(inverse);
 const sphereCenter=originWorld.clone().negate().applyMatrix3(worldToDistrictRotation);
 const p=new THREE.Vector3(),n=new THREE.Vector3(),v=new THREE.Vector3(),u=new THREE.Vector3();
 const dx=new THREE.Vector3(),dz=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 shop.traverse(o=>{
  if(!o.isMesh||o.userData.dynamicTownWorker)return;
  const rel=inverse.clone().multiply(o.matrixWorld),back=rel.clone().invert();
  const normalToDistrict=new THREE.Matrix3().getNormalMatrix(rel),normalBack=new THREE.Matrix3().getNormalMatrix(back);
  o.geometry=o.geometry.clone();const pos=o.geometry.attributes.position,norm=o.geometry.attributes.normal;
  for(let i=0;i<pos.count;i++){
   p.fromBufferAttribute(pos,i).applyMatrix4(rel);const height=p.y;
   v.set(p.x,0,p.z).sub(sphereCenter);const len=v.length();u.copy(v).divideScalar(len);
   const radius=R+.92+height;
   dx.set(1,0,0).addScaledVector(u,-u.x).multiplyScalar(radius/len);
   dz.set(0,0,1).addScaledVector(u,-u.z).multiplyScalar(radius/len);
   if(norm){n.fromBufferAttribute(norm,i).applyMatrix3(normalToDistrict).normalize();a.crossVectors(u,dz).multiplyScalar(n.x);b.crossVectors(dz,dx).multiplyScalar(n.y);c.crossVectors(dx,u).multiplyScalar(n.z);n.copy(a).add(b).add(c).applyMatrix3(normalBack).normalize();norm.setXYZ(i,n.x,n.y,n.z);}
   p.copy(u).multiplyScalar(radius).add(sphereCenter).applyMatrix4(back);pos.setXYZ(i,p.x,p.y,p.z);
  }
  pos.needsUpdate=true;if(norm)norm.needsUpdate=true;o.geometry.computeBoundingSphere();o.geometry.computeBoundingBox();
 });
}

// Long structural spans need intermediate vertices before spherical deformation.
// Otherwise their end faces form a straight chord while the short truss braces
// follow the surface, leaving visibly detached braces above the runway.
export function subdivideFactorySpans(root,step=3){
 root.traverse(o=>{if(!o.isMesh||o.geometry.type!=='BoxGeometry')return;const p=o.geometry.parameters;if(Math.max(p.width,p.depth)<=step)return;const old=o.geometry;o.geometry=new THREE.BoxGeometry(p.width,p.height,p.depth,Math.ceil(p.width/step),1,Math.ceil(p.depth/step));old.dispose();});
}
