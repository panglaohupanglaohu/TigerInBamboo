import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyGregLakeVisuals, gregInkClipOffset, GREG_LAKE_PALETTE} from '../../src/world/swampGregVisuals.js';

test('screen ink retains CSS width across depth, viewport aspect and DPR', () => {
  for (const wh of [[1280,720],[700,1300],[2560,1440]]) for (const dpr of [1,2]) for (const w of [1,8,100]) {
    const off=gregInkClipOffset([.2,.7],wh,.85,dpr,w);
    const physical=Math.hypot(off[0]/w*wh[0]/2,off[1]/w*wh[1]/2);
    assert.ok(Math.abs(physical/dpr-.85)<1e-10);
  }
  assert.deepEqual(gregInkClipOffset([0,0],[1280,720],.85,1,8),[0,0]);
});

test('local visual pass leaves actor identity, animation and collision geometry intact', () => {
  const root=new THREE.Group(), wall=new THREE.Mesh(new THREE.CylinderGeometry(34,13,30,16),new THREE.MeshBasicMaterial({color:0x123456}));
  wall.name='swamp-sinkhole-wall';root.add(wall);
  const actor=new THREE.Mesh(new THREE.BoxGeometry(),wall.material);actor.name='moebius-beluga-whale';root.add(actor);
  actor.userData.update=()=>{};const update=actor.userData.update, oldMaterial=actor.material;
  const geometry=wall.geometry, pos=geometry.attributes.position.array.slice();
  const path=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());path.userData.gregVisualRole='path';root.add(path);
  const report=applyGregLakeVisuals(root);
  assert.equal(report.changedMeshes,2);
  assert.equal(wall.geometry,geometry);assert.deepEqual(wall.geometry.attributes.position.array,pos);
  assert.equal(actor.material,oldMaterial);assert.equal(actor.userData.update,update);
  assert.equal(path.material.color.getHexString(),GREG_LAKE_PALETTE.path.slice(1));
  assert.equal(applyGregLakeVisuals(root),report);
});

test('instanced crown inks keep authored transforms and ignore raycasts', () => {
  const root=new THREE.Group();const crown=new THREE.InstancedMesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial(),3);
  crown.name='v2-central-crown-batch';root.add(crown);
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(3,4,5),new THREE.Quaternion(),new THREE.Vector3(2,1,3));
  for(let i=0;i<3;i++)crown.setMatrixAt(i,matrix);
  const before=crown.instanceMatrix.array.slice();const report=applyGregLakeVisuals(root);
  const ink=crown.getObjectByName('greg-lake-outline');assert.ok(ink);
  assert.equal(ink.instanceMatrix,crown.instanceMatrix);assert.deepEqual(crown.instanceMatrix.array,before);
  assert.equal(ink.count,3);assert.equal(report.outlineDraws,1);
  assert.equal(ink.raycast(),undefined);
  ink.onBeforeRender({getCurrentViewport:v=>v.set(0,0,2560,1440),getPixelRatio:()=>2});
  assert.deepEqual(ink.material.uniforms.viewport.value.toArray(),[2560,1440]);
  assert.equal(ink.material.uniforms.pixelWidth.value,1.7);
  assert.equal(root.children.length,1);
});

test('wall and bark hooks expand against the actual Three.js basic shader', () => {
  const root=new THREE.Group();
  for(const name of ['swamp-sinkhole-wall','world-tree-trunk']){const m=new THREE.Mesh(new THREE.CylinderGeometry(),new THREE.MeshBasicMaterial());m.name=name;root.add(m);}
  applyGregLakeVisuals(root);
  for(const mesh of root.children){
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
    mesh.material.onBeforeCompile(shader);
    assert.match(shader.vertexShader,/gregLocal = position/);
    assert.match(shader.fragmentShader,/float detailLOD/);
    assert.ok(shader.uniforms.gregInk.value.isColor);
    assert.equal((shader.vertexShader.match(/varying vec3 gregLocal;/g)||[]).length,1);
  }
});

test('comparison flag produces no lake mutation', () => {
  const old=globalThis.location;globalThis.location={search:'?gregLakeVisuals=0'};
  try{const root=new THREE.Group();assert.equal(applyGregLakeVisuals(root),null);assert.deepEqual(root.userData,{});}
  finally{globalThis.location=old;}
});

test('wall waterline is converted to mesh-local height, including transformed parents',()=>{
  const root=new THREE.Group();root.position.set(7,13,-4);root.rotation.z=.3;root.scale.setScalar(.5);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(34,13,30,16),new THREE.MeshBasicMaterial());
  wall.name='swamp-sinkhole-wall';wall.position.y=25;root.add(wall);
  const water=new THREE.Mesh(new THREE.CircleGeometry(),new THREE.MeshBasicMaterial());
  water.name='swamp-underground-waterline';water.position.y=25;root.add(water);
  applyGregLakeVisuals(root);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
  wall.material.onBeforeCompile(shader);
  const threshold=shader.uniforms.gregWaterline.value;
  assert.ok(Math.abs(threshold)<1e-6);
  const ys=wall.geometry.attributes.position;let above=0,below=0;
  for(let i=0;i<ys.count;i++){above+=ys.getY(i)>=threshold;below+=ys.getY(i)<threshold;}
  assert.ok(above>0&&below>0,'both actual wall zones must be reachable');
  assert.match(shader.fragmentShader,/step\(gregWaterline, gregLocal.y\)/);
  assert.match(shader.fragmentShader,/fwidth\(crackPhase\)/);
  assert.match(shader.fragmentShader,/crackBreak/);
});

test('environment palette retains authored face contrast without mutating shared colour buffers',()=>{
 const root=new THREE.Group(),geo=new THREE.BoxGeometry();const values=new Float32Array(geo.attributes.position.count*3);
 for(let i=0;i<geo.attributes.position.count;i++)values.set(i%2?[.08,.4,.12]:[.04,.2,.06],i*3);
 geo.setAttribute('color',new THREE.BufferAttribute(values,3));const old=values.slice();
 const fern=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));fern.name='v2-bank-ferns';root.add(fern);
 const report=applyGregLakeVisuals(root);assert.equal(report.planeValueMeshes,1);assert.equal(fern.material.vertexColors,true);assert.equal(fern.material.side,THREE.DoubleSide);
 assert.notEqual(fern.geometry,geo);assert.deepEqual(geo.attributes.color.array,old);
 const p=fern.geometry.attributes.color;assert.ok(p.getX(0)<p.getX(1));assert.equal(p.getX(0),p.getY(0));assert.equal(p.getX(1),p.getZ(1));
 assert.deepEqual(fern.geometry.attributes.position.array,geo.attributes.position.array);
});

test('approved coral, violet and ivory planes remain semantic colors in shader uniforms', () => {
  const root=new THREE.Group();
  for(const role of ['stone','path','wall']){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
    mesh.userData.gregVisualRole=role;root.add(mesh);
  }
  const report=applyGregLakeVisuals(root);assert.equal(report.version,3);
  // User's latest target asks for brighter coral stone; ivory paths and violet walls stay distinct.
  const expected=[['e2977f','ab707b'],['e7dcc4','7c7f91'],['7c7f91','62697e']];
  root.children.forEach((mesh,i)=>{
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
    mesh.material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.gregFace.value.getHexString(),expected[i][0]);
    assert.equal(shader.uniforms.gregShade.value.getHexString(),expected[i][1]);
    assert.equal(shader.uniforms.gregInk.value.getHexString(),'4a4960');
    assert.match(shader.fragmentShader,/mix\(gregShade, gregFace/);
  });
});

test('neutral leaf buffers stay shared and water retains its animation material and geometry', () => {
  const root=new THREE.Group(),geo=new THREE.BoxGeometry();
  const values=new Float32Array(geo.attributes.position.count*3).fill(.87);
  geo.setAttribute('color',new THREE.BufferAttribute(values,3));
  const leaf=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true}));
  leaf.userData.swampTreePart='palm-leaf';root.add(leaf);
  const waterMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:.32,depthWrite:false});
  const hook=()=>{};waterMaterial.onBeforeCompile=hook;
  const waterGeo=new THREE.CircleGeometry(),water=new THREE.Mesh(waterGeo,waterMaterial);
  water.name='swamp-underground-waterline';water.userData.update=()=>{};const update=water.userData.update;root.add(water);
  applyGregLakeVisuals(root);
  assert.equal(leaf.geometry,geo);assert.equal(leaf.geometry.attributes.color.array,values);
  assert.equal(water.material,waterMaterial);assert.equal(water.geometry,waterGeo);
  assert.equal(water.material.onBeforeCompile,hook);assert.equal(water.userData.update,update);
  assert.equal(water.material.opacity,.32);assert.equal(water.material.depthWrite,false);
  assert.equal(water.material.color.getHexString(),'41b8b9');
});
