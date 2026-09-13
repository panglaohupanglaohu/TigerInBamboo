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
