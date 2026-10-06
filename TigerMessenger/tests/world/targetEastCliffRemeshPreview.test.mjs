import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import*as T from'three';import{createEastCliffRemeshPreview}from'../../src/world/citadel/targetEastCliffRemeshPreview.js';
test('preview shares material, never hides original, and only disposes own geometry',()=>{const artifact=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-east-shore-route-20261006/remesh-expanded-geometry.json',import.meta.url))),castle=new T.Group();delete artifact.sourceHash;castle.matrixAutoUpdate=false;castle.matrix.fromArray(artifact.castleMatrix);const source=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());source.name='citadel-oskar-grid-mountain-surface';castle.add(source);castle.updateMatrixWorld(true);let materialDisposed=0;source.material.addEventListener('dispose',()=>materialDisposed++);const c=createEastCliffRemeshPreview({enabled:true,castle,sourceMesh:source,artifact});assert.equal(c.mesh.parent,null);assert.equal(source.visible,true);assert.equal(c.mesh.material,source.material);assert.deepEqual(c.mesh.position.toArray(),artifact.origin);assert.equal(c.mesh.geometry.attributes.color.count,c.mesh.geometry.attributes.position.count);castle.add(c.mesh);c.dispose();assert.equal(c.mesh.parent,null);assert.equal(materialDisposed,0);source.geometry.dispose();source.material.dispose();});
test('stale indexed epoch refuses a refined nonindexed mesh with measured hash, counts, bounds and chart',()=>{
 const castle=new T.Group(),source=new T.Mesh(new T.BoxGeometry(2,4,6).toNonIndexed(),new T.MeshStandardMaterial());
 source.name='citadel-oskar-grid-mountain-surface';source.position.set(3,5,7);castle.add(source);castle.updateMatrixWorld(true);
 source.geometry.userData.rockRefinement={sourceTriangles:12,outputTriangles:12};
 const before=source.geometry.attributes.position.array.slice(),artifact={castleMatrix:castle.matrixWorld.toArray(),origin:[0,0,0],geometry:{},sourceHash:{position:1,index:2,vertices:24}};
 assert.throws(()=>createEastCliffRemeshPreview({enabled:true,castle,sourceMesh:source,artifact}),e=>{
  assert.equal(e.code,'EAST_CLIFF_SOURCE_EPOCH_MISMATCH');const m=e.diagnostics.measured;
  assert.equal(m.vertices,36);assert.equal(m.index,null);assert.equal(m.indexed,false);assert.equal(m.positionType,'Float32Array');
  assert.deepEqual(m.localBounds,{min:[-1,-2,-3],max:[1,2,3]});assert.deepEqual(m.castleBounds,{min:[2,3,4],max:[4,7,10]});
  assert.equal(m.refinement.sourceTriangles,12);assert.match(e.message,/"expected"/);assert.match(e.message,/"measured"/);return true;
 });
 assert.deepEqual(source.geometry.attributes.position.array,before);assert.equal(source.visible,true);assert.equal(castle.children.length,1);
 source.geometry.dispose();source.material.dispose();
});
