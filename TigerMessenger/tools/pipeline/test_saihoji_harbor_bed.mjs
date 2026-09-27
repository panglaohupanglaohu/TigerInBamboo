import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../../vendor/three.module.js';
const source = (await readFile(new URL('../../src/world/saihojiHarborBed.js',import.meta.url),'utf8'))
  .replace("'three'",JSON.stringify(new URL('../../vendor/three.module.js',import.meta.url).href));
const {installSaihojiHarborBed} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const landing=new THREE.Vector3(-.5195427402,.5237577109,-.6750949573).normalize();
function fixture(dry=false) {
  const geometry=new THREE.SphereGeometry(160,48,32),p=geometry.attributes.position;
  const colors=new Float32Array(p.count*3); let dryIndex=-1,best=Infinity;
  for(let i=0;i<p.count;i++) {
    const v=new THREE.Vector3().fromBufferAttribute(p,i),angle=v.angleTo(landing);
    if(angle<best){best=angle;dryIndex=i;}
    // A remote, already-deep canyon must remain exactly intact.
    if(v.x>100&&v.z>0)v.multiplyScalar(.94);
    p.setXYZ(i,v.x,v.y,v.z);
    colors.set([i/p.count,.25,.75],i*3);
  }
  if(dry){const v=new THREE.Vector3().fromBufferAttribute(p,dryIndex).normalize().multiplyScalar(162);p.setXYZ(dryIndex,v.x,v.y,v.z);}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.name='planet-surface';
  return {mesh,geometry,dryIndex};
}
function topology(geometry) {
  const p=geometry.attributes.position,idx=geometry.index,edges=new Map(),v=new THREE.Vector3();
  const keys=Array.from({length:p.count},(_,i)=>v.fromBufferAttribute(p,i).toArray().map(x=>Math.round(x*1e4)).join(','));
  let degenerate=0;
  for(let i=0;i<idx.count;i+=3){
    const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];
    const points=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j));
    const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
    if(normal.lengthSq()<1e-12){degenerate++;continue;}
    assert(normal.dot(points[0].clone().add(points[1]).add(points[2]))>0,'outward winding preserved');
    for(let k=0;k<3;k++){const a=keys[ids[k]],b=keys[ids[(k+1)%3]],key=a<b?a+'|'+b:b+'|'+a;edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.equal(degenerate,0);
  assert([...edges.values()].every(n=>n===2),'closed welded topology: no boundary or T junction');
}
const f=fixture(),originalPositions=f.geometry.attributes.position.array.slice(),originalIndex=f.geometry.index.array.slice();
const controller=installSaihojiHarborBed(f.mesh);
const g=f.mesh.geometry,d=controller.diagnostics;
assert.notEqual(g,f.geometry);assert.equal(f.mesh.children.length,0,'no second overlapping bed');
assert.deepEqual(f.geometry.attributes.position.array,originalPositions);assert.deepEqual(f.geometry.index.array,originalIndex);
assert(d.loweredVertices>0&&d.maxLocalEdge<=2.000001);
assert(d.unchangedOriginalTriangles>d.originalTriangles*.7,'most original triangles are not replaced');
assert(d.vertices<60000,'refinement remains local');
for(const attr of ['uv','color'])assert.deepEqual(g.attributes[attr].array.slice(0,f.geometry.attributes[attr].array.length),f.geometry.attributes[attr].array,'original '+attr+' retained exactly');
for(let i=0;i<f.geometry.attributes.position.count;i++) {
  const v=new THREE.Vector3().fromBufferAttribute(f.geometry.attributes.position,i);
  if(v.angleTo(landing)*160>64)assert.deepEqual(new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).toArray(),v.toArray());
}
const newTriangles=new Set();
for(let i=0;i<g.index.count;i+=3)newTriangles.add([g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)].join(','));
let remoteCount=0;
for(let i=0;i<originalIndex.length;i+=3){const ids=[...originalIndex.slice(i,i+3)];
  if(ids.every(j=>new THREE.Vector3().fromBufferAttribute(f.geometry.attributes.position,j).angleTo(landing)*160>90)){
    assert(newTriangles.has(ids.join(',')),'remote triangle indices stay unchanged');
    for(const j of ids)assert.deepEqual(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,j).toArray(),new THREE.Vector3().fromBufferAttribute(f.geometry.attributes.normal,j).toArray(),'remote normals unchanged');
    remoteCount++;
  }
}
assert(remoteCount>1000);topology(g);
f.mesh.updateMatrixWorld(true);
const right=new THREE.Vector3(0,1,0).cross(landing).normalize(),forward=landing.clone().cross(right).normalize();
const ray=new THREE.Raycaster();
for(let i=0;i<65;i++){
  const angle=i*2.399963,r=(i%9)*5,dir=landing.clone().multiplyScalar(160).addScaledVector(right,Math.cos(angle)*r).addScaledVector(forward,Math.sin(angle)*r).normalize();
  ray.set(dir.clone().multiplyScalar(170),dir.clone().negate());
  const hit=ray.intersectObject(f.mesh,false)[0];assert(hit);
  assert(hit.point.length()<=157.8001,'core is actually lowered in triangle raycasts');
  assert(160.5-hit.point.length()>1.5);
}
assert.equal(installSaihojiHarborBed(f.mesh),controller,'repeated installation is idempotent');
assert(g.boundingSphere&&g.boundingBox&&g.attributes.position.version>0&&g.index.version>0);
const replacement=installSaihojiHarborBed(f.mesh,{coreRadius:40,outerRadius:56});
assert.equal(controller.restore(),false,'stale handle cannot replace active candidate');
assert.equal(replacement.restore(),true);assert.equal(replacement.restore(),false);assert.equal(f.mesh.geometry,f.geometry);
assert(f.mesh.userData.terrainGeometryVersion>=3);
const dry=fixture(true),before=new THREE.Vector3().fromBufferAttribute(dry.geometry.attributes.position,dry.dryIndex);
const dryCandidate=installSaihojiHarborBed(dry.mesh);
assert.deepEqual(new THREE.Vector3().fromBufferAttribute(dry.mesh.geometry.attributes.position,dry.dryIndex).toArray(),before.toArray(),'dry protrusion never excavated');
assert(dryCandidate.diagnostics.dryVerticesPreserved>0);topology(dry.mesh.geometry);
for(const direction of [[-1,0,0],[0,1,0]]){
  const seam=fixture(); const candidate=installSaihojiHarborBed(seam.mesh,{landing:direction,coreRadius:12,outerRadius:20});
  topology(seam.mesh.geometry);assert(candidate.diagnostics.maxLocalEdge<=2.000001);candidate.restore();
}
const clean=fixture();assert.throws(()=>installSaihojiHarborBed(clean.mesh,{maxIterations:1}),/converge/);assert.equal(clean.mesh.geometry,clean.geometry,'failed candidate does not mutate mesh');
console.log(JSON.stringify({pass:true,diagnostics:d,dry:dryCandidate.diagnostics,checks:'closed topology, outward faces, local edges <=2m, UV/color preservation, unchanged remote triangles, real core depth raycasts, dry preservation, idempotent install/restore, transactional failure'},null,2));
