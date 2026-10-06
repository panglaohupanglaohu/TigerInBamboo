import assert from 'node:assert/strict';
import * as T from '../../vendor/three.module.js';
import {filterTailShrubs} from '../../src/world/citadel/mountainTurfTail.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
const castle=new T.Group();castle.position.y=175;
const geo=new T.PlaneGeometry(4,4);geo.rotateX(-Math.PI/2);geo.translate(-18,0,-3);
const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));castle.add(mesh);castle.updateMatrixWorld(true);
const index=buildMountainSurfaceIndex([mesh]),inverse=castle.matrixWorld.clone().invert();
const row=(id,x,y,z)=>({id,world:castle.localToWorld(new T.Vector3(x,y,z)).toArray(),footSpread:.1,matrix:new T.Matrix4().makeTranslation(x,y,z).toArray()});
const rows=[row('supported',-18,-.035,-3),row('removed-tail',-25,-.035,-3),row('upper-unmodified',-18,12,-3),row('far-unmodified',45,0,-22)];
const snapshot=JSON.stringify(rows);const result=filterTailShrubs(rows,inverse,(...args)=>index.sample(...args));
assert.deepEqual(result.kept.map(r=>r.id),['supported','upper-unmodified','far-unmodified']);assert.equal(JSON.stringify(rows),snapshot);assert.deepEqual(result.stats,{checked:2,removed:1,retainedOutside:2});
// All prototype parts consume the single filtered placements array; instance identity stays aligned.
for(const offset of [0,.2,.8]){const part=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),result.kept.length);result.kept.forEach((r,i)=>part.setMatrixAt(i,new T.Matrix4().fromArray(r.matrix).multiply(new T.Matrix4().makeTranslation(0,offset,0))));assert.equal(part.count,3);for(let i=0;i<3;i++){const m=new T.Matrix4();part.getMatrixAt(i,m);assert.ok(Math.abs(m.elements[13]-(result.kept[i].matrix[13]+offset))<1e-5);}}
console.log(JSON.stringify({pass:true,...result.stats,sourceUnchanged:true,allPartsAligned:true}));
