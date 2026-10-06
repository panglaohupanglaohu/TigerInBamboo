import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const threeUrl=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,next){if(s==='three')return {url:${JSON.stringify(threeUrl)},shortCircuit:true};return next(s,c);}`),import.meta.url);
const THREE=await import('three');
const {refineRockFaces}=await import('../../src/world/citadel/mountainRockGeometry.js');
const {rockSurfaceOptions}=await import('../../src/world/citadel/mountainRockNormals.js');
const hash=a=>a?createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex'):null;
for(const [query,want]of [['',.65],['?citadelRockRelief=',.65],['?citadelRockRelief=bad',.65],['?citadelRockRelief=Infinity',.65],['?citadelRockRelief=0',0],['?citadelRockRelief=0.22',.22],['?citadelRockRelief=.65',.65],['?citadelRockRelief=4',.65],['?citadelRockRelief=-2',0]])assert.equal(rockSurfaceOptions('?citadelMountainRelease=0&'+new URLSearchParams(query)).relief,want,query);
const source=new THREE.BufferGeometry();source.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,12,0,0,0,2,12,12,3,12],3));source.setIndex([0,2,1,1,2,3]);source.setAttribute('procgenSemantic',new THREE.Float32BufferAttribute([1,1,2,2],1));source.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));source.setAttribute('shoreBoundaryBottom',new THREE.Float32BufferAttribute([0,0,0,0],1));source.computeVertexNormals();const sourceHash=hash(source.attributes.position.array);
const base=refineRockFaces(source,{amplitude:0}),legacy=refineRockFaces(source),explicit=refineRockFaces(source,{amplitude:.65}),normalOptions={};
assert.equal(hash(legacy.attributes.position.array),hash(explicit.attributes.position.array),'undefined amplitude must exactly preserve .65');assert.equal(hash(legacy.attributes.normal.array),hash(explicit.attributes.normal.array));
const candidates=[0,.22,.65].map(amplitude=>({amplitude,g:refineRockFaces(source,{amplitude,surfaceNormals:normalOptions})}));
const sourceTriangles=[];for(let t=0;t<source.index.count;t+=3){const tri=new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(source.attributes.position,source.index.getX(t+j))));const edge=Math.max(tri.a.distanceTo(tri.b),tri.a.distanceTo(tri.c),tri.b.distanceTo(tri.c)),n=edge>4?Math.min(6,Math.max(3,Math.ceil(edge/4))):1;sourceTriangles.push({tri,count:n*n*3});}
const results=[];
for(const {amplitude,g}of candidates){
 assert.equal(g.attributes.position.count,base.attributes.position.count);assert.equal(hash(g.index?.array),hash(base.index?.array),'topology changed');
 for(const name of ['uv','procgenSemantic','shoreBoundaryBottom'])assert.equal(hash(g.attributes[name].array),hash(base.attributes[name].array),`${name} changed`);
 let boundary=0,interior=0,maxDisplacement=0,maxScaledError=0,vertex=0;
 for(const {tri,count}of sourceTriangles){const normal=tri.getNormal(new THREE.Vector3());
  for(let k=0;k<count;k++,vertex++){
   const p0=new THREE.Vector3().fromBufferAttribute(base.attributes.position,vertex),p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,vertex),delta=p.clone().sub(p0),bary=tri.getBarycoord(p0,new THREE.Vector3()),d=delta.length();
   maxDisplacement=Math.max(maxDisplacement,d);assert(d<=amplitude+3e-6,'interior offset exceeds amplitude');
   const tangent=delta.clone().addScaledVector(normal,-delta.dot(normal));assert(tangent.length()<3e-6,'displacement not along original face normal');
   if(Math.min(bary.x,bary.y,bary.z)<1e-6){boundary++;assert.deepEqual(p.toArray(),p0.toArray(),'original source edge moved');}else interior++;
   const legacyDelta=new THREE.Vector3().fromBufferAttribute(explicit.attributes.position,vertex).sub(p0),error=delta.distanceTo(legacyDelta.multiplyScalar(amplitude/.65));maxScaledError=Math.max(maxScaledError,error);assert(error<3e-6,'amplitude does not scale actual relief');
  }
 }
 assert(boundary>0&&interior>0);if(amplitude>0)assert(maxDisplacement>.05,'candidate failed to create internal relief');else assert.equal(maxDisplacement,0);
 assert.equal(g.userData.rockSurfaceNormals.creaseAngleDeg,42);assert.equal(g.userData.rockSurfaceNormals.semanticEdges,candidates[0].g.userData.rockSurfaceNormals.semanticEdges,'normal hard rules changed');
 results.push({amplitude,vertices:g.attributes.position.count,sourceBoundarySamples:boundary,interiorSamples:interior,maxDisplacement,maxScaledError,positionHash:hash(g.attributes.position.array)});
}
assert.equal(sourceHash,hash(source.attributes.position.array),'source changed');
console.log(JSON.stringify({passed:true,undefinedExactlyMatches065:true,sourceUnchanged:true,results,visualImprovementVerified:false},null,2));
