import assert from 'node:assert/strict';
import * as T from 'three';
import {createMoonLakeCompanionPine} from '../../../src/assets/moonLakePineCompanions.js';
const reports=[];
for(const role of ['lean','spread','windswept','arching']){
 const model=createMoonLakeCompanionPine({role});
 const r=model.report;assert.equal(r.version,3);assert.equal(r.meshes,4);assert.ok(r.leafPlateCount>=12);assert.ok(r.trunkBaseRadius>=.59);assert.ok(r.rootRadius>=1.25);
 const uniqueGeometry=new Set(),uniqueMaterial=new Set();let finite=0,positiveYTop=0,negativeYBottom=0;
 model.group.traverse(o=>{if(!o.isMesh)return;uniqueGeometry.add(o.geometry);uniqueMaterial.add(o.material);const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));finite++;if(o.material.vertexColors){if(n.getY(i)>.5)positiveYTop++;if(n.getY(i)<-.5)negativeYBottom++;}}});
 assert.ok(positiveYTop>0&&negativeYBottom>0);
 let geometryDisposals=0,materialDisposals=0;uniqueGeometry.forEach(g=>g.addEventListener('dispose',()=>geometryDisposals++));uniqueMaterial.forEach(m=>m.addEventListener('dispose',()=>materialDisposals++));
 const parent=new T.Group();parent.add(model.group);model.dispose();model.dispose();assert.equal(parent.children.length,0);assert.equal(geometryDisposals,uniqueGeometry.size);assert.equal(materialDisposals,uniqueMaterial.size);
 reports.push({...r,finiteVertices:finite,positiveYTop,negativeYBottom,disposeExactlyOnce:true});
}
assert.equal(new Set(reports.map(r=>JSON.stringify(r.trunk))).size,4);
console.log(JSON.stringify({ok:true,source:'actual four production factories; CPU geometry, no GPU claim',reports},null,2));
