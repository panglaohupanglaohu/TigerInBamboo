import * as T from 'three';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {buildHighlandCitadelContinuousTerrain} from '../../src/world/highlandCitadelDesign.js';
import {sampleBaySurfacePatch} from '../../src/world/citadel/baySurfaceSampling.js';
import {bayWeight,bayRotation} from '../../src/world/citadel/bayLayoutMath.js';
const folder=new URL('../../artifacts/pipeline/citadel-five-hour-20261005/',import.meta.url);
const source=buildHighlandCitadelContinuousTerrain().children[0].geometry;
const start=performance.now(),{geometry:g,audit}=sampleBaySurfacePatch(source),buildMs=performance.now()-start;
assert.equal(audit.applied,true);
for(const [name,a]of Object.entries(source.attributes))assert.deepEqual(Array.from(g.attributes[name].array.slice(0,a.array.length)),Array.from(a.array),name);
const second=sampleBaySurfacePatch(source);assert.deepEqual(second.geometry.index.array,g.index.array);assert.deepEqual(second.geometry.attributes.position.array,g.attributes.position.array);
const bad=source.clone();bad.attributes.position.setX(bad.index.getX(4536*3),999);assert.equal(sampleBaySurfacePatch(bad).audit.applied,false);
const edges=geo=>{const m=new Map(),i=geo.index;for(let f=0;f<i.count;f+=3)for(let j=0;j<3;j++){const a=i.getX(f+j),b=i.getX(f+(j+1)%3),k=a<b?`${a},${b}`:`${b},${a}`;m.set(k,(m.get(k)||0)+1);}return m;};
const oldEdges=edges(source),newEdges=edges(g);const boundary=m=>[...m].filter(([k,n])=>n===1).map(([k])=>k).sort();assert.deepEqual(boundary(newEdges),boundary(oldEdges),'no new cracks or changed boundary edges');assert.equal([...newEdges.values()].filter(n=>n>2).length,[...oldEdges.values()].filter(n=>n>2).length);
// Refinement must partition each raw parent with its original winding and area.
for(const record of audit.affected){
 const vp=(geo,i)=>new T.Vector3().fromBufferAttribute(geo.attributes.position,i);
 const ov=[0,1,2].map(j=>vp(source,source.index.getX(record.sourceFace*3+j)));
 const normal=ov[1].clone().sub(ov[0]).cross(ov[2].clone().sub(ov[0]));let summedArea=0;
 for(let f=record.start;f<record.end;f++){
  const v=[0,1,2].map(j=>vp(g,g.index.getX(f*3+j))),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
  assert.ok(n.dot(normal)>0,'new raw triangle retains parent winding');summedArea+=n.length();
 }
 assert.ok(Math.abs(summedArea-normal.length())<1e-4,'raw parent area preserved');
}
const trace=JSON.parse(readFileSync(new URL('r15-overview-day-cloud-plants-rock-trace.json',folder))),frame=new T.Matrix4().fromArray(trace.castleMatrix),inv=frame.clone().invert();
const map=v=>{v=v.clone();v.x-=52;const w=bayWeight(v.x,v.z);v.applyMatrix4(frame).applyQuaternion(bayRotation(frame,160,w)).applyMatrix4(inv);if(w>0&&w<1){v.applyMatrix4(frame);v.setLength(Math.min(v.length(),157+90*Math.abs(2*w-1)**3));v.applyMatrix4(inv);}return v;};
const mapped=geo=>Array.from({length:geo.attributes.position.count},(_,i)=>map(new T.Vector3().fromBufferAttribute(geo.attributes.position,i)));
const oldP=mapped(source),newP=mapped(g);for(let i=0;i<oldP.length;i++)assert.deepEqual(newP[i].toArray(),oldP[i].toArray());
const selected=new Set(audit.sourceFaces),affected=new Set(audit.affected.map(a=>a.sourceFace));
const tris=(geo,ps,which)=>{const result=[];for(let f=0;f<geo.index.count/3;f++)if(which(f))result.push([0,1,2].map(j=>ps[geo.index.getX(f*3+j)]));return result;};
const multi=ts=>{let multiple=0,hits=0;for(let x=-1;x<=3;x+=.25)for(let z=-18;z<=-13;z+=.25){const ray=new T.Ray(new T.Vector3(x,100,z),new T.Vector3(0,-1,0)),hit=new T.Vector3(),ys=[];for(const [a,b,c]of ts)if(ray.intersectTriangle(a,b,c,false,hit)&&!ys.some(y=>Math.abs(y-hit.y)<1e-5))ys.push(hit.y);if(ys.length)hits++;if(ys.length>1)multiple++;}return {probes:357,multiple,hits};};
const ranges=audit.affected.filter(a=>selected.has(a.sourceFace));
const oldThree=multi(tris(source,oldP,f=>selected.has(f))),newThree=multi(tris(g,newP,f=>ranges.some(a=>f>=a.start&&f<a.end)));
const oldPatch=multi(tris(source,oldP,f=>affected.has(f))),newPatch=multi(tris(g,newP,f=>audit.affected.some(a=>f>=a.start&&f<a.end)));
assert.equal(oldThree.multiple,98);assert.equal(newThree.multiple,0);assert.equal(newThree.hits,105);assert.equal(newPatch.hits,oldPatch.hits);assert.ok(newPatch.multiple<oldPatch.multiple);
const result={passed:true,buildMs,audit,oldThree,newThree,oldPatch,newPatch,oldVerticesMappedExactly:true,allOriginalAttributesExact:true,unchangedBoundaryEdges:true,limitation:'357 local vertical probes are not a proof of global injectivity; transition fan can retain residual nonlinear folds.'};
writeFileSync(new URL('r16-bay-sampling-tests.json',folder),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
