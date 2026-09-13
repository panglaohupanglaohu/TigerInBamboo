import foundations from '../../../assets/models/optimized/citadel-compact-foundations/compactFoundationsR02.js';
import * as THREE from 'three';
export const COMPACT_CITY_ENABLED=typeof location==="undefined" || new URLSearchParams(location.search).get('citadelCompact')!=='0';
export const CITY_ADVANCE=COMPACT_CITY_ENABLED?[0,6,12]:[0,0,0];
// One monotone mapping for the original mountain, in the new city's authored
// frame. The foreground coast stays unchanged; the stair corridor is recut
// below its new treads. Buildings keep their original dimensions.
export function compactNewCityTerrain(castle){
 if(!COMPACT_CITY_ENABLED)return;
 const city=castle.getObjectByName('highland-west-city');if(!city)return;
 castle.updateWorldMatrix(true,true);const report=[];
 for(const name of ['citadel-oskar-grid-mountain-surface','backlit-highlight-citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal']){
  const mesh=castle.getObjectByName(name);if(!mesh||mesh.userData.compactAscent)continue;
  const forward=new THREE.Matrix4().multiplyMatrices(city.matrixWorld.clone().invert(),mesh.matrixWorld),back=forward.clone().invert();
  const source=mesh.geometry,geometry=source.clone(),a=geometry.attributes.position;let changed=0,maxShift=0;
  for(let i=0;i<a.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(forward);
   const mask=Math.max(0,Math.min(1,(p.x-28)/10,(98-p.x)/14));
   const dz=Math.max(0,Math.min(12,(50-p.z)*.3))*mask;
   const oldY=p.y;p.z+=dz;
   // Re-cut the walking corridor against the new stair grades. Merely moving
   // the old slope forward leaves its former landing profile above the first tread.
   if(Math.abs(p.x-60)<=6 && p.z>=20 && p.z<=51){
    const floor=p.z>=48?4:p.z>=38?4+(48-p.z)*.6:p.z>=34?10:p.z>=24?10+(34-p.z)*.6:16;
    p.y=Math.min(p.y,floor-.35);
   }
   if(dz<.000001&&Math.abs(p.y-oldY)<.000001)continue;
   p.applyMatrix4(back);a.setXYZ(i,p.x,p.y,p.z);changed++;maxShift=Math.max(maxShift,dz);
  }
  a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;source.dispose();
  mesh.userData.compactAscent={changed,maxShift,source:'new-city staged ascent; same original mountain, monotone longitudinal compression'};report.push({name,...mesh.userData.compactAscent});
 }
 city.userData.compactMountain=report;
 const seen=new Map(),foundationReport=[];
 city.traverseVisible(mesh=>{
  if(!mesh.isMesh||!(mesh.name.startsWith('west-city-crown-retaining-wall')||mesh.name==='middle-terrace-solid'))return;
  const ordinal=seen.get(mesh.name)||0;seen.set(mesh.name,ordinal+1);
  const part=foundations.parts.find(p=>p.name===mesh.name&&p.ordinal===ordinal);if(!part||mesh.userData.compactFoundation)return;
  const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;let digest=2166136261;
  for(const v of source.attributes.position.array)digest=Math.imul(digest^Math.round(v*1e4),16777619)>>>0;
  if(source!==mesh.geometry)source.dispose();
  if(digest!==part.sourceDigest)throw new Error('Compact foundation changed: regenerate Blender asset');
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  mesh.geometry.dispose();mesh.geometry=geometry;mesh.userData.compactFoundation={source:foundations.source,changedVertices:part.changedVertices};foundationReport.push({name:mesh.name,...mesh.userData.compactFoundation});
 });
 city.userData.compactFoundations=foundationReport;
}
