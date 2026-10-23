import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createSwampAlgaeClumps,createSwampLegacyWaterGrassGeometry} from '../../src/world/swampAlgaeClumps.js';
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
 for(const mesh of g.meshes){
  const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,centres=new Map(),widths=new Map();
  for(let i=0;i<p.count;i++){
   const t=uv.getX(i),s=uv.getY(i);if(Math.abs(s-.5)<1e-6)centres.set(t,new T.Vector3().fromBufferAttribute(p,i));
   const bounds=widths.get(t)||[Infinity,-Infinity];bounds[0]=Math.min(bounds[0],p.getX(i));bounds[1]=Math.max(bounds[1],p.getX(i));widths.set(t,bounds);
  }
  const tip=centres.get(1),points=[...centres.values()],highest=Math.max(...points.map(v=>v.y));
  assert.ok(Math.abs(tip.x)>.45,'leaf tip bends sideways visibly');
  assert.ok(highest-tip.y>.015,'tip turns downward after the arch');
  assert.ok(Math.max(...[...widths.values()].map(([a,b])=>b-a))>.45,'broad blade, not needle');
  const late=[...widths.entries()].filter(([t])=>t>.88&&t<1)[0][1];assert.ok(late[1]-late[0]>.15,'rounded shoulder remains wide close to the soft tip');
 }
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
 const oldLayer=inner.getObjectByName('v2-underwater-grass');assert.ok(oldLayer?.isMesh);assert.equal(oldLayer.geometry.userData.blades,90);assert.equal(oldLayer.geometry.userData.clumps,30);assert.equal(oldLayer.material.vertexColors,true);assert.equal(oldLayer.material.fog,false);assert.equal(oldLayer.material.side,T.DoubleSide);
 assert.ok(!oldLayer.userData.gregWalkable);assert.ok(oldLayer.geometry.userData.records.every(r=>r.surface&&Math.abs(r.surface[1]-surface)<1e-5));
 console.log('separate legacy layer',JSON.stringify({clumps:30,blades:90,drawCalls:1,triangles:oldLayer.geometry.userData.triangles}));
});

test('separate 30-by-3 legacy layer keeps bases and palette while short petioles meet actual floor',()=>{
 const inner=new T.Group(),floor=new T.Mesh(new T.CylinderGeometry(13.5,15,1.2,48),new T.MeshBasicMaterial());floor.position.y=9.8;inner.add(floor);
 inner.position.set(-41,65,18);inner.rotation.set(.74,.6,-.35);inner.scale.setScalar(.5);
 const geometry=createSwampLegacyWaterGrassGeometry(inner,floor),report=geometry.userData,p=geometry.attributes.position,c=geometry.attributes.color;
 assert.equal(report.records.length,90);assert.equal(report.drawCalls,1);
 const dark=new T.Color(0x254c59),light=new T.Color(0x5b978a);
 let maxY=-Infinity;
 for(const r of report.records){
  const angle=r.clump*2.399,radius=6+(r.clump%6);assert.deepEqual(r.base,[Math.cos(angle)*radius,10.5,Math.sin(angle)*radius]);assert.equal(r.angle,angle+r.index*2.1);assert.equal(r.height,2+(r.clump%4)*.6);assert.ok(Math.abs(r.surface[1]-10.4)<1e-5);
  let minY=Infinity;for(let i=r.vertexStart;i<r.vertexStart+r.vertexCount;i++){minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));assert.ok(p.getY(i)>10.399);}
  assert.ok(minY<10.405,'thin petiole connects original Y10.5 base to bed instead of floating');
 }
 for(let i=0;i<c.count;i++)for(const [axis,a,b] of [['X',dark.r,light.r],['Y',dark.g,light.g],['Z',dark.b,light.b]])assert.ok(c['get'+axis](i)>=a-1e-6&&c['get'+axis](i)<=b+1e-6);
 assert.ok(maxY<14);assert.ok([...p.array].every(Number.isFinite));
 console.log('legacy layer clearance',JSON.stringify({maxY,triangles:report.triangles}));
});
