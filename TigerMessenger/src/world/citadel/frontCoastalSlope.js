import * as THREE from 'three';
import {createOceanHeightSampler} from './oceanSurface.js';
const originals=new WeakMap();
// Preserve the plaza (front edge z=83.5), horse terrace and harbor route.
// Compress only the unoccupied seaward apron into the actual spherical sea.
export function shapeFrontCoastalSlope(castle,radius){
 const city=castle.getObjectByName('highland-west-city');if(!city)return;
 castle.updateWorldMatrix(true,true);
 const sea=createOceanHeightSampler(city,radius),seen=new Set(),reports=[];
 for(const name of ['citadel-oskar-grid-mountain-surface','backlit-highlight-citadel-oskar-grid-mountain-surface']){
  const mesh=castle.getObjectByName(name);if(!mesh?.geometry||seen.has(mesh.geometry))continue;
  const g=mesh.geometry;seen.add(g);const a=g.attributes.position,mask=g.attributes.shoreBoundaryBottom;
  if(!originals.has(g))originals.set(g,Float32Array.from(a.array));
  const source=originals.get(g),toCity=city.matrixWorld.clone().invert().multiply(mesh.matrixWorld),fromCity=toCity.clone().invert();
  let changed=0,maxDrop=0;
  for(let i=0;i<a.count;i++){
   if(mask?.getX(i)>.5)continue;
   const p=new THREE.Vector3().fromArray(source,i*3).applyMatrix4(toCity);
   if(p.z<=84||p.z>116||p.x<=40||p.x>=94)continue;
   const side=THREE.MathUtils.smoothstep(p.x,40,48)*(1-THREE.MathUtils.smoothstep(p.x,84,94));
   const t=THREE.MathUtils.smoothstep(p.z,84,100),water=sea(p.x,p.z);
   const cap=THREE.MathUtils.lerp(3.78,water-.4,t);
   const next=THREE.MathUtils.lerp(p.y,Math.min(p.y,cap),side);
   if(p.y-next<.00001)continue;
   maxDrop=Math.max(maxDrop,p.y-next);p.y=next;p.applyMatrix4(fromCity);a.setXYZ(i,p.x,p.y,p.z);changed++;
  }
  if(changed){a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
  reports.push({mesh:name,changed,maxDrop});
 }
 const report={authorZ:[84,116],shoreAtZ:100,protectedThroughZ:84,authorX:[40,94],reports};
 castle.getObjectByName('citadel-oskar-grid-mountain-surface').userData.frontCoastalSlope=report;return report;
}
