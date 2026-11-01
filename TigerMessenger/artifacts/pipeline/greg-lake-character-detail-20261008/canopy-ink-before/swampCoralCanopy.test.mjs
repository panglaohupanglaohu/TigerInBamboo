import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampCoralCanopy} from '../../src/world/swampCoralCanopy.js';
import {applyGregLakeVisuals} from '../../src/world/swampGregVisuals.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?gregLakeCanopy=0&gregLakeVisuals=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
const originals=[];inner.traverse(o=>{if(['v2-central-crown-batch','v2-rim-foliage-lobes','v2-world-tree-leaflets','v2-rim-leaflets','v2-central-crown-ink','v2-rim-crown-ink'].includes(o.name))originals.push({o,visible:o.visible,matrix:o.instanceMatrix?.array.slice()});});
const anchors=[...inner.userData.towerTrees,inner.getObjectByName('world-tree-trunk'),inner.userData.tiger,inner.userData.shipyard.dock].map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));
const report=installSwampCoralCanopy(inner,{enabled:true});

test('real crown groups become fewer broad fan instances without extra draws or moved anchors',()=>{
  assert.equal(report.ok,true);assert.equal(report.version,4);assert.equal(report.shapeRevision,'rounded-fan-4');assert.equal(report.renderMeshes,10);assert.equal(report.instances,373);assert.equal(report.sharedGeometries,1);
  assert.ok(report.triangles<report.originalTriangles*.15);assert.ok(report.instances<500);
  assert.equal(new Set(report.meshes.map(m=>m.geometry)).size,1);assert.equal(new Set(report.meshes.map(m=>m.material)).size,1);
  assert.ok(report.meshes.every(m=>m.userData.gregVisualRole==='foliage'&&!m.isSprite));
  for(const {o,p,q}of anchors){assert.ok(o.position.equals(p));assert.ok(o.quaternion.equals(q));}
  for(const {o,matrix}of originals){assert.equal(o.visible,false);if(matrix)assert.deepEqual(o.instanceMatrix.array,matrix);}
  assert.equal(installSwampCoralCanopy(inner,{enabled:true}),report);
});

test('every fan vertex stays inside its original crown envelope and its stem meets the original branch anchor',()=>{
  const matrix=new T.Matrix4(),v=new T.Vector3();let checked=0;
  for(const record of report.records){
    const mesh=report.meshes.find(m=>m.parent===record.parent),box=new T.Box3(new T.Vector3(...record.bounds[0]),new T.Vector3(...record.bounds[1])).expandByScalar(1e-4);
    mesh.getMatrixAt(record.instance,matrix);assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(new T.Vector3(...record.anchor))<1e-5);
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);assert.ok(box.containsPoint(v),`crown ${record.group} vertex ${i}`);checked++;}
  }
  assert.ok(checked>20000);
});

test('shared fan has a closed domed top, drooping edge and coherent face color',()=>{
  const g=report.meshes[0].geometry,p=g.attributes.position,indices=g.index,edges=new Map();
  const add=(a,b)=>{const key=[a,b].sort((x,y)=>x-y).join(',');edges.set(key,(edges.get(key)||0)+1);};
  for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);add(a,b);add(b,c);add(c,a);}
  assert.ok([...edges.values()].every(n=>n===2),'every indexed edge must belong to exactly two faces');
  assert.ok(g.boundingBox.max.y>.35);assert.ok(g.boundingBox.min.y<-.20);assert.ok(g.boundingBox.max.x-g.boundingBox.min.x>1.8);
  const half=p.count/2;
  for(let i=0;i<half;i++){
    assert.equal(g.attributes.color.getX(i),1,'no alternating wedge shading');
    assert.ok(Math.abs(p.getY(i)-p.getY(i+half)-.012)<1e-6,'thin actual leaf body');
  }
  assert.equal(p.count,200,'32 angular samples round the scalloped edge without separate petals');
  let curvedUV=0;
  for(let i=1;i<67;i++){const a=Math.atan2(p.getX(i),p.getZ(i)),b=Math.atan2(g.attributes.uv.getX(i),g.attributes.uv.getY(i));if(Math.abs(a-b)>.005)curvedUV++;}
  assert.ok(curvedUV>20,'radial shader veins curve with the leaf, not straight spoke lines');
  assert.equal(g.attributes.uv.count,p.count);assert.ok([...g.attributes.uv.array].every(Number.isFinite));
});

test('placed crown surfaces retain a visible dome and tilt instead of horizontal discs',()=>{
  const matrix=new T.Matrix4(),point=new T.Vector3();let domed=0;
  for(const mesh of report.meshes)for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);const box=new T.Box3(),p=mesh.geometry.attributes.position;
    for(let j=0;j<p.count;j++)box.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(matrix));
    const size=box.getSize(new T.Vector3());if(size.y/Math.max(size.x,size.z)>.045)domed++;
    assert.ok(Math.abs(matrix.elements[1])+Math.abs(matrix.elements[9])>.001,'tilted leaf surface');
  }
  console.log('rounded fan geometry',JSON.stringify({trianglesPerFan:report.geometryTriangles,totalTriangles:report.triangles,originalTriangles:report.originalTriangles,drawCalls:report.renderMeshes,domed}));
  assert.ok(domed>report.instances*.95,`${domed}/${report.instances} visibly arched envelopes`);
});

test('local palette pass installs one shared vein material with near-view LOD and no added outline meshes',()=>{
  const before=report.meshes.map(m=>m.children.length);globalThis.location.search='';applyGregLakeVisuals(inner);
  assert.equal(new Set(report.meshes.map(m=>m.material)).size,1);
  for(let i=0;i<report.meshes.length;i++)assert.equal(report.meshes[i].children.length,before[i]);
  const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};
  report.meshes[0].material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/gregFanCoord = uv/);assert.match(shader.fragmentShader,/smoothstep\(12.0, 38.0, gregFanDepth\)/);
  assert.equal(shader.uniforms.gregFanInk.value.getHexString(),'514b64');assert.ok(report.meshes[0].instanceColor);
});

test('spherical placement preserves canopy and branch common-frame relationship',()=>{
  const before=report.meshes.map(m=>m.instanceMatrix.array.slice());
  placeMoebiusSwampOnSphere(wrapper,new T.Vector3(.3,.8,.5).normalize(),160,.5,-15.8);wrapper.updateMatrixWorld(true);
  report.meshes.forEach((mesh,i)=>assert.deepEqual(mesh.instanceMatrix.array,before[i]));
  for(const record of report.records){
    const mesh=report.meshes.find(m=>m.parent===record.parent),matrix=new T.Matrix4();mesh.getMatrixAt(record.instance,matrix);
    const stem=new T.Vector3().setFromMatrixPosition(matrix),expected=record.parent.localToWorld(new T.Vector3(...record.anchor));
    assert.ok(mesh.localToWorld(stem).distanceTo(expected)<1e-4);
  }
});

test('rollback restores original crown visibility and a disabled install is inert',()=>{
  const empty=new T.Group();assert.equal(installSwampCoralCanopy(empty,{enabled:false}),null);assert.equal(installSwampCoralCanopy(empty,{enabled:true}).ok,false);assert.equal(empty.children.length,0);
  report.dispose();report.dispose();assert.equal(inner.userData.gregCoralCanopy,undefined);
  for(const {o,visible}of originals)assert.equal(o.visible,visible);
  assert.equal(inner.getObjectByName('greg-coral-fan-crown'),undefined);
});
