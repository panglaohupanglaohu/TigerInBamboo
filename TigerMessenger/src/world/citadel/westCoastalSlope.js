import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
const originals=new WeakMap();
/** Ease only the far western, unoccupied perimeter into the final spherical sea.
 * Authored x>=-62 (old-city lots, bridge and new-city approaches) stays intact.
 */
export function shapeWestCoastalSlope(castle,radius){
 castle.updateWorldMatrix(true,true);
 const meshes=[castle.getObjectByName('citadel-oskar-grid-mountain-surface'),castle.getObjectByName('backlit-highlight-citadel-oskar-grid-mountain-surface')];
 const seen=new Set(),reports=[];
 for(const mesh of meshes){
  if(!mesh?.geometry||seen.has(mesh.geometry))continue;seen.add(mesh.geometry);
  const g=mesh.geometry,a=g.attributes.position,mask=g.attributes.shoreBoundaryBottom;
  if(!originals.has(g))originals.set(g,Float32Array.from(a.array));
  const source=originals.get(g),inv=mesh.matrixWorld.clone().invert();let changed=0,maxDrop=0;
  for(let i=0;i<a.count;i++){
   const x=source[i*3];if(x>=-62||mask?.getX(i)>.5)continue;
   const t=THREE.MathUtils.clamp((-62-x)/28,0,1),weight=t*t*(3-2*t);
   const p=new THREE.Vector3(source[i*3],source[i*3+1],source[i*3+2]).applyMatrix4(mesh.matrixWorld);
   const r=p.length(),sea=radius+officialOceanLevelAt(p),target=Math.min(r,sea-.4);
   const next=THREE.MathUtils.lerp(r,target,weight);maxDrop=Math.max(maxDrop,r-next);
   p.multiplyScalar(next/r).applyMatrix4(inv);a.setXYZ(i,p.x,p.y,p.z);changed++;
  }
  if(changed){a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
  reports.push({mesh:mesh.name,changed,maxDrop});
 }
 const report={authorBand:[-90,-62],protectedMinX:-62,coastDepth:.4,reports};
 if(meshes[0])meshes[0].userData.westCoastalSlope=report;
 return report;
}

/** Broad unoccupied western shore retreats below the railway; no tunnel cut. */
export function openWesternRailCoast(castle,radius){
 castle.updateWorldMatrix(true,true);const invCastle=castle.matrixWorld.clone().invert();
 for(const name of ['citadel-oskar-grid-mountain-surface','backlit-highlight-citadel-oskar-grid-mountain-surface']){
  const mesh=castle.getObjectByName(name);if(!mesh?.geometry)continue;
  const a=mesh.geometry.attributes.position,inv=mesh.matrixWorld.clone().invert();
  const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
  for(let i=0;i<a.count;i++){
   const world=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld),local=world.clone().applyMatrix4(invCastle);
   const weight=smooth((-82-local.x)/22)*smooth((85-local.z)/20);
   if(weight<=0)continue;
   const r=world.length(),sea=radius+officialOceanLevelAt(world)-1;
   world.setLength(r+(Math.min(r,sea)-r)*weight).applyMatrix4(inv);a.setXYZ(i,world.x,world.y,world.z);
  }
  a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 }
}
