import * as THREE from 'three';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';

// Read-only review measurements. Proxy footprints and local-up support rays are
// not collision certification, a pixel similarity score, or a walkability test.
export function auditCityMassing({castle,camera,group,report}) {
 if(!group||!report?.previewOnly)throw new Error('No disposable massing preview');
 castle.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
 const surface=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 if(!surface)throw new Error('Final candidate mountain surface unavailable');
 const index=buildMountainSurfaceIndex([surface]),inverse=castle.matrixWorld.clone().invert();
 const up=new THREE.Vector3(0,1,0).transformDirection(castle.matrixWorld),down=up.clone().negate();
 const tolerance=.4,rows=[];
 const point=(p,sx,sz)=>{const a=p.yaw||0,dx=sx*p.size[0]/2,dz=sz*p.size[2]/2;return [p.position[0]+Math.cos(a)*dx+Math.sin(a)*dz,p.position[2]-Math.sin(a)*dx+Math.cos(a)*dz];};
 const covers=(p,x,z)=>{const a=p.yaw||0,dx=x-p.position[0],dz=z-p.position[2];return Math.abs(Math.cos(a)*dx-Math.sin(a)*dz)<=p.size[0]/2+1e-6&&Math.abs(Math.sin(a)*dx+Math.cos(a)*dz)<=p.size[2]/2+1e-6;};
 for(const p of report.placements){
  const [x,base,z]=p.position,[w,,d]=p.size,samples=[];
  for(const sx of [-1,0,1])for(const sz of [-1,0,1]){
   const [px,pz]=point(p,sx,sz);
   const supporting=report.placements.find(q=>q.id!==p.id&&q.shape==='box'&&Math.abs(q.position[1]+q.size[1]-base)<.02&&covers(q,px,pz));
   const ray=new THREE.Ray(new THREE.Vector3(px,160,pz).applyMatrix4(castle.matrixWorld),down);
   const hit=index.sample(ray,0,600);
   const height=hit?hit.point.clone().applyMatrix4(inverse).y:null;
   const slope=hit?hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().dot(up):null;
   const terrainSupported=height!==null&&Math.abs(base-height)<=tolerance&&slope>=.9;
   samples.push({x:px,z:pz,height,baseDelta:height===null?null:base-height,slope,proxySupport:supporting?.id??null,terrainSupported,pass:!!supporting||terrainSupported});
  }
  rows.push({id:p.id,role:p.role,supportedSamples:samples.filter(s=>s.pass).length,totalSamples:samples.length,pass:samples.every(s=>s.pass),samples});
 }
 const bounds=prefix=>{
  const points=[];for(const p of report.placements.filter(p=>prefix.test(p.id))){
   const [x,y,z]=p.position,[w,h,d]=p.size;
   for(const sx of [-1,1])for(const sy of [0,1])for(const sz of [-1,1]){
    const [px,pz]=point(p,sx,sz);const v=new THREE.Vector3(px,y+sy*h,pz).applyMatrix4(castle.matrixWorld).project(camera);points.push([(v.x+1)/2,(1-v.y)/2,v.z]);
   }
  }
  if(!points.length)return null;
  const min=[Math.min(...points.map(v=>v[0])),Math.min(...points.map(v=>v[1]))],max=[Math.max(...points.map(v=>v[0])),Math.max(...points.map(v=>v[1]))];
  return {min,max,widthFraction:max[0]-min[0],heightFraction:max[1]-min[1],withinFrustum:points.every(v=>v[2]>=-1&&v[2]<=1&&v[0]>=0&&v[0]<=1&&v[1]>=0&&v[1]<=1)};
 };
 return {at:new Date().toISOString(),variant:report.variant,previewOnly:true,method:'9 footprint samples per proxy; final mountain BVH or touching proxy support; projected footprint-box bounds, not pixel silhouette/occlusion',tolerance,rows,failures:rows.filter(r=>!r.pass).map(r=>r.id),screenBounds:{old:bounds(/^massing-old-/),new:bounds(/^massing-new-/),plaza:bounds(/^massing-(statue|horse)-/)},camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,aspect:camera.aspect},limitations:['Sparse footprint samples cannot prove complete support area.','Proxy-supported upper masses rely on separate lower-proxy checks.','No physics, path, rail, WFC transaction or gameplay acceptance.']};
}
