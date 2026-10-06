import * as THREE from 'three';

// Keep the occupied terraces and coast fixed; soften only the bare high ridge
// into asymmetric shoulders. A continuous field keeps shared vertices welded.
export function shapeMountainSummits(castle,{rail=[],protectedBoxes=[]}={}){
 const mesh=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!mesh)return null;
 castle.updateWorldMatrix(true,true);
 const toCastle=castle.matrixWorld.clone().invert().multiply(mesh.matrixWorld),toMesh=toCastle.clone().invert();
 const geometry=mesh.geometry.clone(),a=geometry.attributes.position,v=new THREE.Vector3();let changed=0,maxMove=0;
 for(let i=0;i<a.count;i++){
  v.fromBufferAttribute(a,i).applyMatrix4(toCastle);if(v.y<=13||v.z>12||v.z< -53)continue;
  const world=v.clone().applyMatrix4(castle.matrixWorld);
  let margin=1;for(const box of protectedBoxes)margin=Math.min(margin,THREE.MathUtils.smoothstep(box.distanceToPoint(world),6,12));
  if(!margin||rail.some(p=>p.distanceToSquared(world)<400))continue;
  const weight=THREE.MathUtils.smoothstep(v.y,13,27)*margin;
  const dx=weight*(Math.sin(v.z*.19+v.x*.043)*2.3+Math.sin(v.y*.21)*.9);
  const dz=weight*Math.sin(v.x*.14-v.y*.08)*1.8;
  const dy=weight*(-1.9+Math.sin(v.x*.29+v.z*.12)*1.4+Math.sin(v.z*.41)*.65);
  v.add(new THREE.Vector3(dx,dy,dz));maxMove=Math.max(maxMove,Math.hypot(dx,dy,dz));changed++;
  v.applyMatrix4(toMesh);a.setXYZ(i,v.x,v.y,v.z);
 }
 a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 return {changed,maxMove,protectedMargin:6,railMargin:20};
}
