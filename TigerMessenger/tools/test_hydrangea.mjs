import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createBookshopHydrangeas, createLowPolyHydrangeaBush } from '../src/assets/hydrangea.js';

function snapshot(root) {
  root.position.set(12,24,-6); root.rotation.set(.2,.4,-.3); root.scale.setScalar(1.7);
  root.updateMatrixWorld(true);
  let meshes=0,triangles=0;
  const points=new Map(),v=new THREE.Vector3();
  root.traverse(o=>{
    if(!o.isMesh)return;
    meshes++;
    const p=o.geometry.attributes.position,indices=o.geometry.index;
    triangles+=(indices?.count??p.count)/3;
    if(o.userData.isOutline)return;
    for(let i=0;i<(indices?.count??p.count);i++){
      v.fromBufferAttribute(p,indices?indices.getX(i):i).applyMatrix4(o.matrixWorld);
      const color=o.material.color.getHexString();
      if(!points.has(color))points.set(color,[]);
      points.get(color).push(...v.toArray());
    }
  });
  return {meshes,triangles,points};
}
const before=snapshot(createBookshopHydrangeas({merge:false}));
const after=snapshot(createBookshopHydrangeas());
assert.equal(after.triangles,before.triangles);
assert.deepEqual([...after.points.keys()].sort(),[...before.points.keys()].sort());
let maxError=0;
for(const [color,points] of before.points){
  const next=after.points.get(color); assert.equal(points.length,next.length);
  for(let i=0;i<points.length;i++)maxError=Math.max(maxError,Math.abs(points[i]-next[i]));
}
assert(maxError<1e-5,`world-space vertex deviation ${maxError}`);
assert(after.meshes<=7);
const bush=createLowPolyHydrangeaBush();
assert.equal(bush.userData.assetType,'hydrangea');
assert(snapshot(bush).meshes<=7);
console.log('HYDRANGEA_OK',JSON.stringify({before:before.meshes,after:after.meshes,triangles:after.triangles,maxError}));
