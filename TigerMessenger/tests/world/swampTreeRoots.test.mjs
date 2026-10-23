import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const make=()=>{const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);return {scene,inner:scene.userData.inner};};
const localBox=(inner,o)=>{const b=new T.Box3().setFromObject(o);return b.applyMatrix4(new T.Matrix4().copy(inner.matrixWorld).invert());};
const {installSwampTreeRoots}=await import('../../src/world/swampTreeRoots.js');
test('giant tree roots fan out underwater from the trunk, stay under the boat lane, one draw',()=>{
  const {scene,inner}=make();const roots=installSwampTreeRoots({swamp:scene,enabled:true});const r=roots.report;
  assert.ok(r.roots>=8&&r.roots<=12,`roots ${r.roots}`);assert.ok(r.branches>=1,'a few forks');
  assert.equal(r.drawCalls,1);assert.ok(r.triangles<12000,`tris ${r.triangles}`);
  assert.ok(r.maxReach>=18&&r.maxReach<=27,`reach ${r.maxReach}`);
  assert.ok(r.maxY<24.5,'roots never reach the water surface / boats');assert.ok(r.minY>9,'roots lie on the lake floor');
  const mesh=inner.getObjectByName('swamp-tree-radial-roots');assert.ok(mesh);
  // 放射：根的顶点围绕树干分布在各个方向
  const p=mesh.geometry.attributes.position,[bx,,bz]=r.base,sectors=new Set();
  mesh.geometry.computeBoundingBox();assert.ok(mesh.geometry.boundingBox.max.y<24.5,'actual swept geometry remains below the water');
  let shallowReach=0;
  for(let i=0;i<p.count;i++)if(p.getY(i)>20.5)shallowReach=Math.max(shallowReach,Math.hypot(p.getX(i)-bx,p.getZ(i)-bz));
  assert.ok(shallowReach>8,`shallow root shoulders extend visibly from the trunk: ${shallowReach}`);
  for(let i=0;i<p.count;i+=7){const dx=p.getX(i)-bx,dz=p.getZ(i)-bz;if(Math.hypot(dx,dz)>8)sectors.add(Math.floor((Math.atan2(dz,dx)+Math.PI)/(Math.PI/4)));}
  assert.ok(sectors.size>=7,`roots spread around: ${sectors.size}/8 sectors`);
  // Target v4 underwater roots: dark blue-green sides and brighter upper ridges.
  const colours=mesh.geometry.attributes.color;let darkest=Infinity,brightest=0;
  for(let i=0;i<colours.count;i++){
    const red=colours.getX(i),green=colours.getY(i),blue=colours.getZ(i),lum=red*.2126+green*.7152+blue*.0722;
    assert.ok(green>red&&blue>red,'submerged root facets remain aquatic rather than pale trunk pink');
    darkest=Math.min(darkest,lum);brightest=Math.max(brightest,lum);
  }
  assert.ok(brightest-darkest>.20,'top and side planes have real pigment contrast');
  assert.ok(darkest<.10,'dark side silhouette remains under water');
  // 坑壁内：每个顶点的半径小于该高度坑壁外沿
  for(let i=0;i<p.count;i+=5){const rr=Math.hypot(p.getX(i),p.getZ(i));assert.ok(rr<12.5+(p.getY(i)-10)*.73+3,'inside the sinkhole');}
  assert.equal(installSwampTreeRoots({swamp:scene,enabled:false}).report.enabled,false);
});

test('root meadow has real bottom attachment, leaves clear swimming space, reinstall does not duplicate and dispose restores',()=>{
 const {scene,inner}=make(),roots=installSwampTreeRoots({swamp:scene,enabled:true});
 const meadow=inner.getObjectByName('swamp-tree-root-meadow');assert.ok(meadow);
 assert.ok(roots.report.meadow.sites.length>16&&roots.report.meadow.sites.length<=36);
 meadow.geometry.computeBoundingBox();assert.ok(meadow.geometry.boundingBox.max.y<22,'all plant blades beneath boats/swimmers');
 const shaderHook=inner.getObjectByName('swamp-underground-waterline').material.onBeforeCompile;
 assert.equal(installSwampTreeRoots({swamp:scene,enabled:true}),roots);
 assert.equal(inner.children.filter(o=>o.name==='swamp-tree-root-meadow').length,1);
 roots.dispose();assert.equal(inner.getObjectByName('swamp-tree-root-meadow'),undefined);assert.equal(inner.getObjectByName('swamp-tree-radial-roots'),undefined);
 assert.equal(inner.getObjectByName('swamp-underground-waterline').material.onBeforeCompile,shaderHook);
});
