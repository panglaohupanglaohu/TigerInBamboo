import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampCoralCanopy,applySwampCanopyInk} from '../../src/world/swampCoralCanopy.js';
import {applyGregLakeVisuals} from '../../src/world/swampGregVisuals.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?gregLakeCanopy=0&gregLakeVisuals=0&gregCanopyClearance=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
const originals=[];inner.traverse(o=>{if(['v2-central-crown-batch','v2-rim-foliage-lobes','v2-world-tree-leaflets','v2-rim-leaflets','v2-central-crown-ink','v2-rim-crown-ink'].includes(o.name))originals.push({o,visible:o.visible,matrix:o.instanceMatrix?.array.slice()});});
const anchors=[...inner.userData.towerTrees,inner.getObjectByName('world-tree-trunk'),inner.userData.tiger,inner.userData.shipyard.dock].map(o=>({o,p:o.position.clone(),q:o.quaternion.clone()}));
const report=installSwampCoralCanopy(inner,{enabled:true});

test('real crown groups become fewer broad fan instances without extra draws or moved anchors',()=>{
  assert.equal(report.ok,true);assert.equal(report.version,8);assert.equal(report.shapeRevision,'compact-soft-central-clusters-8');assert.equal(report.renderMeshes,10);assert.equal(report.instances,753);assert.equal(report.sharedGeometries,2);
  assert.ok(report.triangles<report.originalTriangles*.30);assert.ok(report.instances<800);
  assert.equal(new Set(report.meshes.map(m=>m.geometry)).size,2);assert.equal(new Set(report.meshes.map(m=>m.material)).size,1);
  assert.ok(report.meshes.every(m=>m.userData.gregVisualRole==='foliage'&&!m.isSprite));
  for(const {o,p,q}of anchors){assert.ok(o.position.equals(p));assert.ok(o.quaternion.equals(q));}
  for(const {o,matrix}of originals){assert.equal(o.visible,false);if(matrix)assert.deepEqual(o.instanceMatrix.array,matrix);}
  assert.equal(installSwampCoralCanopy(inner,{enabled:true}),report);
});

test('every fan vertex stays inside its declared crown envelope and its stem meets the original branch anchor',()=>{
  const matrix=new T.Matrix4(),v=new T.Vector3();let checked=0;
  for(const record of report.records){
    const mesh=report.meshes.find(m=>m.parent===record.parent),box=new T.Box3(new T.Vector3(...record.bounds[0]),new T.Vector3(...record.bounds[1])).expandByScalar(1e-4);
    mesh.getMatrixAt(record.instance,matrix);assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(new T.Vector3(...record.anchor))<1e-5);
    const p=mesh.geometry.attributes.position;
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);assert.ok(box.containsPoint(v),`crown ${record.group} vertex ${i}`);checked++;}
  }
  assert.ok(checked>20000);
});

test('compact central shelter crown stays branch-sized with curved height above the protected walking level',()=>{
 const central=report.records.filter(r=>r.expandedCentral);assert.equal(central.length,21);
 const matrix=new T.Matrix4(),point=new T.Vector3();let minY=Infinity,farFromAnchor=0;
 for(const r of central){
  const mesh=report.meshes.find(m=>m.parent===r.parent);mesh.getMatrixAt(r.instance,matrix);
  assert.ok(Math.abs((r.bounds[1][0]-r.bounds[0][0])/(r.originalBounds[1][0]-r.originalBounds[0][0])-1.25)<1e-6);
  const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);minY=Math.min(minY,point.y);farFromAnchor=Math.max(farFromAnchor,Math.hypot(point.x-r.anchor[0],point.z-r.anchor[2]));}
 }
 assert.ok(minY>47);assert.ok(farFromAnchor>6&&farFromAnchor<13,'central leaves no longer reach across more than half the local basin');
 console.log('central shelter crown',JSON.stringify({leaves:central.length,minY,farFromAnchor}));
});

test('central three-leaf groups keep genuine angular light gaps and non-coplanar domes',()=>{
 const records=report.records.filter(r=>r.expandedCentral),geometry=report.meshes.find(m=>m.userData.canopySource==='v2-central-crown-batch').geometry,ray=new T.Raycaster(),stats=[];
 const material=new T.MeshBasicMaterial({side:T.DoubleSide});
 for(let group=0;group<7;group++){
  const list=records.filter(r=>r.group===group),anchor=new T.Vector3(...list[0].anchor),proxies=[],reaches=[],centres=[];
  for(const r of list){const mesh=report.meshes.find(m=>m.parent===r.parent),matrix=new T.Matrix4();mesh.getMatrixAt(r.instance,matrix);const proxy=new T.Mesh(geometry,material);proxy.matrixAutoUpdate=false;proxy.matrix.copy(matrix);proxy.updateMatrixWorld(true);proxies.push(proxy);let reach=0;const box=new T.Box3(),v=new T.Vector3();for(let i=0;i<geometry.attributes.position.count;i++){v.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(matrix);reach=Math.max(reach,Math.hypot(v.x-anchor.x,v.z-anchor.z));box.expandByPoint(v);}reaches.push(reach);centres.push(box.getCenter(new T.Vector3()).y);}
  const radius=Math.max(...reaches)*.55;let openings=0;
  for(let k=0;k<360;k++){const a=k*Math.PI/180;ray.set(anchor.clone().add(new T.Vector3(Math.cos(a)*radius,30,Math.sin(a)*radius)),new T.Vector3(0,-1,0));ray.far=60;if(!ray.intersectObjects(proxies,false).length)openings++;}
  const fraction=openings/360;stats.push({group,fraction,radius,heightVariation:Math.max(...centres)-Math.min(...centres)});
  assert.ok(fraction>.08&&fraction<.60,`group${group} must have light gaps and substantial shelter, actual${fraction}`);
  assert.ok(Math.max(...centres)-Math.min(...centres)>.20,'separate tilted leaf crowns cannot form one coplanar lid');
 }
 material.dispose();console.log('central actual angular light gaps',JSON.stringify(stats));
});

test('central blades use six shallow radial curves with a thin closed body, not three folded panels',()=>{
 const geometry=report.meshes.find(m=>m.userData.canopySource==='v2-central-crown-batch').geometry,p=geometry.attributes.position,half=p.count/2;
 assert.equal(report.centralRadialSegments,6);assert.deepEqual(report.centralEnvelopeScale,[1.25,1.5]);
 assert.equal(p.count,398);assert.ok(geometry.boundingBox.max.y<.18);assert.ok(geometry.boundingBox.min.y>-.10);
 for(let i=0;i<half;i++)assert.ok(Math.abs(p.getY(i)-p.getY(i+half)-.006)<1e-6);
 const edges=new Map(),idx=geometry.index;
 for(let i=0;i<idx.count;i+=3)for(const [a,b]of [[idx.getX(i),idx.getX(i+1)],[idx.getX(i+1),idx.getX(i+2)],[idx.getX(i+2),idx.getX(i)]]){
  const key=[a,b].sort((x,y)=>x-y).join(',');edges.set(key,(edges.get(key)||0)+1);
 }
 assert.ok([...edges.values()].every(n=>n===2),'thin central leaf remains a fully closed surface');
});

test('shared fan has a closed domed top, drooping edge and coherent face color',()=>{
  const g=report.meshes.find(m=>m.userData.canopySource==='v2-rim-foliage-lobes').geometry,p=g.attributes.position,indices=g.index,edges=new Map();
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

test('local palette pass installs shared screen-width veins without changing geometry, attachment or matrices',()=>{
  const before=report.meshes.map(m=>({children:m.children.length,matrix:m.instanceMatrix.array.slice(),position:m.geometry.attributes.position.array.slice(),uv:m.geometry.attributes.uv.array.slice(),index:m.geometry.index.array.slice()}));globalThis.location.search='';applyGregLakeVisuals(inner);
  assert.equal(new Set(report.meshes.map(m=>m.material)).size,1);
  for(let i=0;i<report.meshes.length;i++){
    const m=report.meshes[i],b=before[i];assert.equal(m.children.length,b.children);assert.deepEqual(m.instanceMatrix.array,b.matrix);assert.deepEqual(m.geometry.attributes.position.array,b.position);assert.deepEqual(m.geometry.attributes.uv.array,b.uv);assert.deepEqual(m.geometry.index.array,b.index);
  }
  const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};
  report.meshes[0].material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/gregFanCoord = uv/);assert.match(shader.fragmentShader,/projectedFade/);assert.doesNotMatch(shader.fragmentShader,/gregFanDepth/);
  assert.equal(shader.uniforms.gregFanInk.value.getHexString(),'626478');assert.ok(report.meshes[0].instanceColor);
  const mat=report.meshes[0].material;assert.equal(mat.userData.gregCanopyInk.veins,5);assert.equal(mat.userData.gregCanopyInk.extraDrawCalls,0);assert.equal(mat.customProgramCacheKey(),'greg-lake-fan-veins-v7-target-sage');
  assert.equal(shader.uniforms.gregFanUnder.value.getHexString(),'96b29d');
  const fixture=new T.MeshBasicMaterial();applySwampCanopyInk(fixture);const other={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};fixture.onBeforeCompile(other);assert.equal(other.fragmentShader,shader.fragmentShader);assert.equal(other.vertexShader,shader.vertexShader);
});

test('target foliage comparison restores the prior bright underside shader without changing its mesh',()=>{
 const previous=globalThis.location.search;globalThis.location.search='?gregTargetFoliage=0';
 try{
  const m=new T.MeshBasicMaterial();applySwampCanopyInk(m);
  const s={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};m.onBeforeCompile(s);
  assert.equal(s.uniforms.gregFanUnder.value.getHexString(),'b9e07a');
  assert.equal(m.customProgramCacheKey(),'greg-lake-fan-veins-v5-moebius-green');
  assert.match(s.fragmentShader,/mix\(diffuseColor.rgb, gregFanUnder, .45\)/);
  m.dispose();
 }finally{globalThis.location.search=previous;}
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
  const originalRim=report.meshes.filter(m=>m.userData.canopySource!=='v2-central-crown-batch').map(m=>({matrix:m.instanceMatrix.array.slice(),position:m.geometry.attributes.position.array.slice()}));
  const centralStats=r=>{
   let reach=0,minY=Infinity,maxY=-Infinity;const matrix=new T.Matrix4(),v=new T.Vector3();
   for(const record of r.records.filter(record=>record.expandedCentral)){
    const mesh=r.meshes.find(m=>m.parent===record.parent);mesh.getMatrixAt(record.instance,matrix);
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){v.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix);reach=Math.max(reach,Math.hypot(v.x-record.anchor[0],v.z-record.anchor[2]));minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
   }return {reach,minY,maxY};
  };
  const after=centralStats(report);
  const empty=new T.Group();assert.equal(installSwampCoralCanopy(empty,{enabled:false}),null);assert.equal(installSwampCoralCanopy(empty,{enabled:true}).ok,false);assert.equal(empty.children.length,0);
  report.dispose();report.dispose();assert.equal(inner.userData.gregCoralCanopy,undefined);
  const previous=globalThis.location.search;globalThis.location.search='?gregTargetCanopy=0&gregCanopyClearance=0';
  try{
   const legacy=installSwampCoralCanopy(inner,{enabled:true}),before=centralStats(legacy);
   assert.equal(legacy.version,7);assert.deepEqual(legacy.centralEnvelopeScale,[2.2,3.5]);assert.equal(legacy.centralRadialSegments,3);
   assert.ok(after.reach/before.reach<.60,'central maximum lateral reach reduced by over forty percent');
   assert.ok(after.minY>before.minY+4,'central lower edges remain higher above the lake');
   legacy.meshes.filter(m=>m.userData.canopySource!=='v2-central-crown-batch').forEach((m,i)=>{
    assert.deepEqual(m.instanceMatrix.array,originalRim[i].matrix);assert.deepEqual(m.geometry.attributes.position.array,originalRim[i].position);
   });
   console.log('compact central crown versus actual legacy',JSON.stringify({before,after,lateralRatio:after.reach/before.reach,rimUnchanged:true}));
   legacy.dispose();
  }finally{globalThis.location.search=previous;}
  for(const {o,visible}of originals)assert.equal(o.visible,visible);
  assert.equal(inner.getObjectByName('greg-coral-fan-crown'),undefined);
});
