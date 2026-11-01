import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createSwampAlgaeClumps} from '../../src/world/swampAlgaeClumps.js';
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function originalRecords(rnd){
 const clumps=[],blades=[];
 for(let i=0;i<26;i++){
  const a=rnd()*Math.PI*2,d=1.5+rnd()*11,n=3+((rnd()*4)|0);clumps.push([Math.cos(a)*d,10.2,Math.sin(a)*d]);
  for(let b=0;b<n;b++){const width=.12+rnd()*.1,height=1+rnd()*1.8,light=rnd()<.5,x=(rnd()-.5)*.6,lift=.5+rnd()*.9,z=(rnd()-.5)*.6,tilt=(rnd()-.5)*.4;blades.push({clump:i,index:b,width,height,light,x,lift,z,tilt});}
 }
 return {clumps,blades};
}
test('26 legacy clumps preserve random consumption, exact placements and all original blade parameters',()=>{
 const ra=rng(7711),rb=rng(7711),old=originalRecords(ra),inner=new T.Group(),floor=new T.Mesh(new T.CylinderGeometry(13.5,15,1.2,48),new T.MeshBasicMaterial());floor.position.y=9.8;inner.add(floor);
 const geometry=floor.geometry,walk=[floor];inner.userData.walkSurfaces=walk;
 const g=createSwampAlgaeClumps(rb,inner,floor,10);
 assert.equal(ra(),rb(),'all following fauna and story random values must stay identical');assert.equal(g.clumps.length,26);
 assert.deepEqual(g.clumps.map(c=>c.position.toArray()),old.clumps);
 assert.deepEqual(g.blades.map(({clump,index,width,height,light,x,lift,z,tilt})=>({clump,index,width,height,light,x,lift,z,tilt})),old.blades);
 assert.equal(floor.geometry,geometry);assert.equal(inner.userData.walkSurfaces,walk);assert.deepEqual(walk,[floor]);
 for(const r of g.blades){assert.deepEqual(r.node.position.toArray(),[r.x,r.lift,r.z]);assert.equal(r.node.rotation.z,r.tilt);assert.equal(r.group.visible,true);assert.equal(r.node.visible,true);}
});
test('two instanced curved leaf batches are surface rooted, finite and clear of lake bed volume after sphere transforms',()=>{
 const inner=new T.Group(),floor=new T.Mesh(new T.CylinderGeometry(13.5,15,1.2,48),new T.MeshBasicMaterial());floor.position.y=9.8;inner.add(floor);
 const g=createSwampAlgaeClumps(rng(7711),inner,floor,10);inner.position.set(18,83,-40);inner.rotation.set(.34,-1.3,.66);inner.scale.setScalar(.5);g.refreshAttachment();
 assert.equal(g.drawCalls,2);assert.ok(g.meshes.every(m=>m.isInstancedMesh));assert.equal(g.meshes.reduce((s,m)=>s+m.count,0),g.blades.length);
 const v=new T.Vector3();let maxY=-Infinity;
 for(const r of g.blades){const p=g.meshes[r.batch].geometry.attributes.position;assert.ok(Math.abs(r.base[1]-10.408)<1e-5);assert.ok(Math.abs(r.surface[1]-10.4)<1e-5);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(r.matrix);assert.ok(v.toArray().every(Number.isFinite));assert.ok(v.y>10.399,'no new leaf vertex inside real floor');maxY=Math.max(maxY,v.y);}
 }
 assert.ok(maxY<14,'rooted plants remain below water-creature swim corridors');
 const p=g.meshes[0].geometry.attributes.position;assert.ok(p.getX(15)!==p.getX(45),'leaves curve instead of following a cone edge');
 console.log('rooted algae geometry',JSON.stringify({clumps:g.clumps.length,blades:g.blades.length,drawCalls:g.drawCalls,triangles:g.triangles,maxY}));
});
test('real factory refreshes attachment after V2 lake-floor replacement without changing water or walkable identity',async()=>{
 const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const e=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:e,createElementNS:e};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
 const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
 const inner=createMoebiusSwampPlacement({seed:7711,scale:.5}).userData.inner,g=inner.userData.rootedAlgae,floor=inner.getObjectByName('swamp-lake-floor');
 assert.equal(g.clumps.length,26);assert.equal(g.root.parent,inner);assert.ok(!g.root.userData.gregWalkable);assert.ok(g.meshes.every(m=>!m.userData.gregWalkable));
 floor.geometry.computeBoundingBox();const surface=floor.geometry.boundingBox.max.y+floor.position.y;
 for(const r of g.blades)assert.ok(Math.abs(r.surface[1]-surface)<1e-5);
 assert.ok(inner.getObjectByName('world-tree-trunk'));assert.ok(inner.getObjectByName('v2-floor-root'));
 console.log('actual factory algae',JSON.stringify({clumps:26,blades:g.blades.length,oldMeshDraws:g.blades.length*2,newMeshDraws:g.drawCalls,triangles:g.triangles,bedY:surface}));
});
