import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
/** Final-world sea closure for the original perimeter skirt. Its old analytic
 * local sphere is invalid after relocating the city. Never alter top terrain.
 */
export function alignCitadelPerimeterToOcean(castle,radius){
 castle.updateWorldMatrix(true,true);
 const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 if(!terrain)return null;
 const geometries=new Set();const reports=[];
 for(const mesh of [terrain,castle.getObjectByName('backlit-highlight-citadel-oskar-grid-mountain-surface')]){
  if(!mesh?.geometry||geometries.has(mesh.geometry))continue;geometries.add(mesh.geometry);
  const a=mesh.geometry.attributes.position,mask=mesh.geometry.attributes.shoreBoundaryBottom;
  if(!mask)throw new Error('Citadel perimeter bottom mask missing');
  const inv=mesh.matrixWorld.clone().invert(),v=new THREE.Vector3();let changed=0,count=0,maxBefore=-Infinity,maxAfter=-Infinity;
  for(let i=0;i<a.count;i++){
   if(mask.getX(i)<.5)continue;count++;
   v.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);
   const sea=radius+officialOceanLevelAt(v),r=v.length();maxBefore=Math.max(maxBefore,r-sea);
   const next=Math.min(r,sea-2);
   if(r>next+1e-6){v.multiplyScalar(next/r);const local=v.clone().applyMatrix4(inv);a.setXYZ(i,local.x,local.y,local.z);changed++;}
   maxAfter=Math.max(maxAfter,next-sea);
  }
  if(changed){a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}
  reports.push({mesh:mesh.name,count,changed,maxBefore,maxAfter});
 }
 const report={source:'officialOceanLevelAt(final world direction)',depth:2,topologyUnchanged:true,reports};
 terrain.userData.perimeterOceanAlignment=report;return report;
}
