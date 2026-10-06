import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../vendor/three.module.js';
import {createMountainCanopyCandidate,canopyClearOfConstraints} from '../../src/world/citadel/mountainCanopyCandidate.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
import {preservesCitadelMaterial} from '../../src/world/citadel/materialOwnership.js';
const output=new URL('../../artifacts/pipeline/citadel-four-hour-20261005/',import.meta.url);fs.mkdirSync(output,{recursive:true});
const castle=new T.Group(),q=new T.Quaternion().setFromEuler(new T.Euler(.23,-.48,.18));castle.quaternion.copy(q);castle.position.copy(new T.Vector3(0,175,0).applyQuaternion(q));
const g=new T.PlaneGeometry(130,110,32,28);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i)*.035)*.5+Math.sin(p.getZ(i)*.04)*.3);g.computeVertexNormals();
const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name='test-final-undulating-surface';castle.add(mesh);castle.updateMatrixWorld(true);const before=Array.from(p.array),count=castle.children.length;
assert.equal(createMountainCanopyCandidate(castle).group,null);assert.equal(castle.children.length,count);assert.throws(()=>createMountainCanopyCandidate(castle,{enabled:true}),/final surfaceIndex/);
const index=buildMountainSurfaceIndex([mesh]),protectedBoxes=[new T.Box3(new T.Vector3(-12,-2,-14),new T.Vector3(-2,8,-4)).applyMatrix4(castle.matrixWorld)],rail=[];for(let x=-60;x<=60;x+=2)rail.push(castle.localToWorld(new T.Vector3(x,0,16)));
const opts={enabled:true,surfaceIndex:index,bounds:{x:[-55,55],z:[-45,45]},protectedBoxes,rail,waterHeight:()=>0,maxTrees:650};
const start=performance.now(),result=createMountainCanopyCandidate(castle,opts),buildMs=performance.now()-start;assert.equal(castle.children.length,count,'builder must return detached group');castle.add(result.group);castle.updateMatrixWorld(true);
assert.ok(result.report.accepted>20);assert.ok(result.report.cypress<result.report.broadleaf*.2);assert.ok(result.report.drawCalls<=5);assert.deepEqual(Array.from(p.array),before);
const ray=new T.Raycaster();ray.layers.enableAll();ray.far=330;let minGap=Infinity,maxGap=-Infinity,roots=0;
const trunk=result.group.getObjectByName('citadel-canopy-root-trunks'),v=trunk.geometry.attributes.position;
for(let i=0;i<trunk.count;i++){const m=new T.Matrix4();trunk.getMatrixAt(i,m);m.premultiply(trunk.matrixWorld);for(let j=0;j<v.count;j++){if(Math.abs(v.getY(j))>1e-6)continue;const w=new T.Vector3().fromBufferAttribute(v,j).applyMatrix4(m),up=w.clone().normalize();ray.set(up.clone().multiplyScalar(320),up.clone().negate());const h=ray.intersectObject(mesh,false)[0];assert.ok(h,'actual trunk base must hit original Three mesh');const gap=w.length()-h.point.length();minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);roots++;}}
assert.ok(maxGap<=.002,`floating root ${maxGap}`);assert.ok(minGap>=-.3,`excess buried root ${minGap}`);
for(const row of result.report.placements){const b=new T.Box3(new T.Vector3(...row.bounds.min),new T.Vector3(...row.bounds.max));assert.ok(canopyClearOfConstraints(b,protectedBoxes,rail,1,5));}
// A rail segment crossing between sparse endpoints must reject, too.
assert.equal(canopyClearOfConstraints(new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1)),[],[new T.Vector3(-10,0,0),new T.Vector3(10,0,0)],0,0),false);
for(const o of result.group.children)assert.ok(preservesCitadelMaterial(o,o.material));
const repeat=createMountainCanopyCandidate(castle,opts);assert.deepEqual(repeat.report.placements,result.report.placements);repeat.dispose();
const summary={pass:true,fixture:'rotated sphere-local castle; final undulating mesh; independent original Three.Raycaster every actual trunk bottom vertex',buildMs,accepted:result.report.accepted,broadleaf:result.report.broadleaf,cypress:result.report.cypress,triangles:result.report.triangles,drawCalls:result.report.drawCalls,roots,minGap,maxGap,protectedBoxes:protectedBoxes.length,railSamples:rail.length,sourceUnchanged:true,defaultDisabled:true,deterministic:true,materialOwnership:true,rejected:result.report.rejected};
fs.writeFileSync(new URL('canopy-candidate-test.json',output),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));result.dispose();assert.equal(castle.children.length,count);
