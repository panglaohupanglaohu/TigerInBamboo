import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTargetOldCityWaterfall} from '../../src/world/citadel/targetOldCityWaterfall.js';

test('outboard channels retain the wall outlets while moving curtain and curved-sea impact beyond the railway', () => {
  let queries=0;
  const surface=(x,z)=>-18+.003*x*x+.002*z*z;
  const w=createTargetOldCityWaterfall({dropHeight:18,outboardReach:10,receivingSurfaceHeightAt:(x,z)=>{queries++;return surface(x,z);}});
  assert.equal(w.report.outletCenters[0][2],9*.053);
  assert.equal(w.report.curtainLipCenters[0][2],10+9*.053);
  assert.ok(w.group.getObjectByName('target-waterfall-outboard-feed-channels'));
  const before=queries;
  for(const seconds of [0,.2,3,7]) {
    w.update(seconds);
    const curtain=w.group.getObjectByName('target-waterfall-aqua-three-stream-curtain').geometry.attributes.position;
    for(let i=0;i<curtain.count;i++) assert.ok(curtain.getZ(i)>10.45,'water must not fall onto the landward track corridor');
    const ray=new THREE.Raycaster(new THREE.Vector3(0,-2,1),new THREE.Vector3(0,0,1),0,8);
    assert.equal(ray.intersectObject(w.group.getObjectByName('target-waterfall-stone-three-arch-outlets')).length,0,'no solid tunnel across the under-channel corridor');
    const foam=w.group.getObjectByName('target-waterfall-impact-white-foam'),m=new THREE.Matrix4();
    foam.getMatrixAt(0,m);assert.ok(m.elements[14]>10);assert.ok(Math.abs(m.elements[13]-surface(m.elements[12],m.elements[14])-.045)<3e-6);
  }
  assert.equal(queries,before);assert.equal(w.report.railClearanceVerified,false);w.dispose();
  for(const outboardReach of [-1,NaN,Infinity,31])assert.throws(()=>createTargetOldCityWaterfall({outboardReach}),RangeError);
});

test('three spillway arches have open geometric reveals and finite baked geometry', () => {
  const waterfall = createTargetOldCityWaterfall({dropHeight: 13, width: 9});
  const stone = waterfall.group.getObjectByName('target-waterfall-stone-three-arch-outlets');
  waterfall.group.updateMatrixWorld(true);
  for (const [x] of waterfall.report.outletCenters) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 0.45, 8), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(stone).length, 0, 'outlets must be real open arches');
  }
  const pier = new THREE.Raycaster(new THREE.Vector3(1.305, 0.45, 8), new THREE.Vector3(0, 0, -1));
  assert.ok(pier.intersectObject(stone).length > 0, 'solid pier remains between outlets');
  waterfall.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const attribute of Object.values(mesh.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
    if (mesh.instanceMatrix) for (const value of mesh.instanceMatrix.array) assert.ok(Number.isFinite(value));
  });
  assert.equal(waterfall.report.outletCount, 3);
  assert.ok(waterfall.report.drawCalls <= 7);
  waterfall.dispose();
});

test('all falling streams keep exact outlet and receiving-water endpoints while moving', () => {
  for (const dropHeight of [0.8, 16, 40]) {
    const waterfall = createTargetOldCityWaterfall({dropHeight});
    const curtain = waterfall.group.getObjectByName('target-waterfall-aqua-three-stream-curtain');
    const position = curtain.geometry.attributes.position, uv = curtain.geometry.attributes.uv;
    const start = position.array.slice();
    waterfall.update(1.25);
    assert.notDeepEqual(position.array, start, 'flow must animate actual geometry');
    for (let i = 0; i < position.count; i++) {
      if (uv.getY(i) === 0) assert.equal(position.getY(i), 0);
      if (uv.getY(i) === 1) assert.ok(Math.abs(position.getY(i) + dropHeight) < 1e-5);
    }
    assert.equal(waterfall.report.receivingSeaY, -dropHeight);
    assert.equal(waterfall.report.navigationVerified, false);
    waterfall.dispose();
  }
});

test('flow uniforms and expanding foam are deterministic and do not declare MRT outputs', () => {
  const waterfall = createTargetOldCityWaterfall({seed: 7});
  const curtain = waterfall.group.getObjectByName('target-waterfall-silver-flow-ribbons');
  const shader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  curtain.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /targetWaterTime/);
  assert.doesNotMatch(shader.fragmentShader, /gl_FragData|layout\s*\(\s*location/);
  const foam = waterfall.group.getObjectByName('target-waterfall-impact-white-foam');
  const initialFoam = foam.instanceMatrix.array.slice();
  waterfall.update(2);
  assert.equal(shader.uniforms.targetWaterTime.value, 2);
  assert.notDeepEqual(foam.instanceMatrix.array, initialFoam);
  waterfall.update(0);
  assert.deepEqual(foam.instanceMatrix.array, initialFoam);
  waterfall.dispose();
});

test('reject invalid dimensions and dispose all owned resources once without changing host', () => {
  for (const bad of [0, -1, Infinity, NaN]) {
    assert.throws(() => createTargetOldCityWaterfall({dropHeight: bad}), RangeError);
    assert.throws(() => createTargetOldCityWaterfall({width: bad}), RangeError);
  }
  const waterfall = createTargetOldCityWaterfall(), host = new THREE.Group(), neighbor = new THREE.Group();
  host.add(neighbor, waterfall.group);
  let geometryDisposals = 0, materialDisposals = 0;
  waterfall.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    mesh.material.addEventListener('dispose', () => materialDisposals++);
  });
  waterfall.dispose(); waterfall.dispose(); waterfall.update(3);
  assert.equal(geometryDisposals, 6); assert.equal(materialDisposals, 6);
  assert.deepEqual(host.children, [neighbor]); assert.equal(waterfall.group.children.length, 0);
});

test('curved receiving sea seats actual animated ripple vertices and foam without per-frame queries',()=>{
 let calls=0;const R=80,surface=(x,z)=>-16+Math.sqrt(R*R-(x+8)**2-(z+5)**2)-Math.sqrt(R*R-89);
 const w=createTargetOldCityWaterfall({receivingSurfaceHeightAt:(x,z)=>{calls++;return surface(x,z);}});
 const initialCalls=calls;assert.ok(initialCalls>100&&initialCalls<1000);assert.equal(w.report.receivingSurface.sampledPass,true);
 const ripple=w.group.getObjectByName('target-waterfall-expanding-impact-ripples'),foam=w.group.getObjectByName('target-waterfall-impact-white-foam');
 assert.equal(ripple.isInstancedMesh,undefined);assert.equal(ripple.geometry.attributes.position.count,294);
 const matrix=new THREE.Matrix4();let maximumError=0;
 for(const t of [0,.2,1,2,3,4,5,6,7,9.17,20,-3]){
  w.update(t);assert.equal(calls,initialCalls,'animation must never query source sea');assert.equal(ripple.visible,true);
  const p=ripple.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const ring=Math.floor(i/98),expected=surface(p.getX(i),p.getZ(i))+.016+ring*.007;
   maximumError=Math.max(maximumError,Math.abs(p.getY(i)-expected));
  }
  for(let i=0;i<foam.count;i++){foam.getMatrixAt(i,matrix);const e=matrix.elements;assert.ok(Math.abs(e[13]-surface(e[12],e[14])-.045)<2e-6);}
  for(const mesh of w.group.children.filter(m=>m.geometry?.userData.basePositions)){
   const p=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;
   for(let i=0;i<p.count;i++)if(uv.getY(i)===0)assert.equal(p.getY(i),0,'outlet sill must not move');
  }
 }
 assert.ok(maximumError<=w.report.receivingSurface.tolerance+1e-5);
 assert.equal(w.report.receivingSurface.perFrameCallbackCalls,0);assert.equal(w.report.surfaceSeatingVerified,false);w.dispose();
});

test('surface cache refines under measured curvature and does not claim missing sea as seated',()=>{
 const curved=createTargetOldCityWaterfall({receivingSurfaceHeightAt:(x,z)=>-16+.18*x*x+.12*z*z,receivingSurfaceGridStep:1,receivingSurfaceTolerance:.01});
 assert.ok(curved.report.receivingSurface.refinementPasses>0);assert.ok(curved.report.receivingSurface.maximumSampledInterpolationError<=.01);curved.dispose();
 const missing=createTargetOldCityWaterfall({receivingSurfaceHeightAt:(x)=>x>0?null:-16});
 assert.equal(missing.report.receivingSurface.sampledPass,false);assert.ok(missing.report.receivingSurface.missingSamples>0);
 missing.update(2);assert.equal(missing.group.getObjectByName('target-waterfall-expanding-impact-ripples').visible,false);
 const foam=missing.group.getObjectByName('target-waterfall-impact-white-foam'),m=new THREE.Matrix4();let hidden=0;
 for(let i=0;i<foam.count;i++){foam.getMatrixAt(i,m);if(m.elements[0]===0&&m.elements[5]===0&&m.elements[10]===0)hidden++;}
 assert.ok(hidden>0);missing.dispose();
 assert.throws(()=>createTargetOldCityWaterfall({receivingSurfaceHeightAt:()=>NaN}),/finite local Y/);
 assert.throws(()=>createTargetOldCityWaterfall({receivingSurfaceGridStep:0}),/positive/);
});

test('curved ripple branch keeps six owned draws and disposes each resource once',()=>{
 const w=createTargetOldCityWaterfall({receivingSurfaceHeightAt:(x,z)=>-16-.002*(x*x+z*z)});let gd=0,md=0;
 w.group.traverse(m=>{if(m.isMesh){m.geometry.addEventListener('dispose',()=>gd++);m.material.addEventListener('dispose',()=>md++);}});
 assert.equal(w.report.drawCalls,6);w.dispose();w.dispose();assert.equal(gd,6);assert.equal(md,6);
});
