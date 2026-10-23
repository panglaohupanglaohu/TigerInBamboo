import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {applySwampCoralWeathering} from '../../src/world/swampCoralWeathering.js';

test('weathering composes existing basic shader and anchors wall height to inner frame, without frame uniforms',()=>{
 const material=new T.MeshBasicMaterial(),frame=new T.Matrix4().makeTranslation(0,25,0);let old=0;
 material.onBeforeCompile=shader=>{old++;shader.uniforms.oldFeature={value:3};};
 applySwampCoralWeathering(material,{matrix:frame});
 const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};material.onBeforeCompile(shader);
 assert.equal(old,1);assert.equal(shader.uniforms.oldFeature.value,3);assert.equal(shader.uniforms.coralWeatherFrame.value,frame);
 assert.equal(new T.Vector3(2,15,5).applyMatrix4(frame).y,40,'original cylinder wall local15 maps to physical inner rim40');
 assert.match(shader.vertexShader,/coralWeatherP=\(coralWeatherFrame\*vec4\(position,1\.\)\)\.xyz/);
 assert.match(shader.fragmentShader,/outgoingLight=mix\(outgoingLight,cwUnweathered,0\.\)/);
 assert.match(shader.fragmentShader,/float cwNoise\(vec3 p\)/);
 assert.match(shader.fragmentShader,/cwNoise\(coralWeatherP\*vec3\(\.105,\.14,\.105\)\)/);
 assert.match(shader.fragmentShader,/outgoingLight\*=\.88\+\.20\*cwMottle/);
 assert.doesNotMatch(shader.fragmentShader,/uniform float (time|uTime)/);
 assert.deepEqual(material.userData.coralWeathering,{version:5,exterior:false,frame:'inner',animated:false,revision:'target-mineral-islands-1',extraDrawCalls:0});
});

test('exterior treatment retains authored thin coral soil while sharing the same geological field',()=>{
 const m=new T.MeshBasicMaterial();applySwampCoralWeathering(m,{exterior:true});
 const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};m.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/mix\(outgoingLight,cwUnweathered,smoothstep\(39\.5,39\.98,cwY\)\)/);
 assert.ok(m.customProgramCacheKey().endsWith('coral-weathered-cliff-5-target-mineral-1'));
});

test('target mineral islands compose sparse bedding in the same inner frame and the comparison flag restores v4',()=>{
 const m=new T.MeshBasicMaterial();applySwampCoralWeathering(m);
 const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};m.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/float cwMineralIsland=/);assert.match(shader.fragmentShader,/float cwSeep=/);
 assert.match(shader.fragmentShader,/fwidth\(cwBedding\)/);assert.match(shader.fragmentShader,/smoothstep\(\.05,\.16,cwBedAA\)/);
 assert.equal(Object.keys(shader.uniforms).length,1,'static surface marks require no extra per-frame uniform');
 const previous=globalThis.location;globalThis.location={search:'?gregTargetPatina=0'};
 try{
  const old=new T.MeshBasicMaterial();applySwampCoralWeathering(old);
  const s={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};old.onBeforeCompile(s);
  assert.equal(old.userData.coralWeathering.version,4);assert.doesNotMatch(s.fragmentShader,/float cwMineralIsland=/);
  assert.ok(old.customProgramCacheKey().endsWith('coral-weathered-cliff-4-0'));old.dispose();
 }finally{globalThis.location=previous;}
 m.dispose();
});

test('actual existing lake-wall shader and weathering have distinct local declarations',async()=>{
 const {applyGregLakeVisuals}=await import('../../src/world/swampGregVisuals.js');
 const inner=new T.Group(),wall=new T.Mesh(new T.CylinderGeometry(34,13,30,12,4),new T.MeshBasicMaterial());wall.name='swamp-sinkhole-wall';wall.position.y=25;inner.add(wall);inner.updateMatrixWorld(true);
 applyGregLakeVisuals(inner,{enabled:true});applySwampCoralWeathering(wall.material,{matrix:new T.Matrix4().makeTranslation(0,25,0)});
 const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};wall.material.onBeforeCompile(shader);
 assert.equal((shader.fragmentShader.match(/float crackPhase\s*=/g)||[]).length,1,'existing wall fissure declaration preserved');
 assert.equal((shader.fragmentShader.match(/float cwCrackPhase=/g)||[]).length,1,'weathering uses its own name');
 assert.match(shader.fragmentShader,/\{\s*vec3 cwUnweathered/,'weathering declarations also isolated in lexical scope');
});
