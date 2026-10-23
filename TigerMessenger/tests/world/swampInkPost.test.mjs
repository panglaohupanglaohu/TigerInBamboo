import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.location={search:''};
const {createSwampInkPost}=await import('../../src/world/swampInkPost.js');
const {installSwampOcclusionFade}=await import('../../src/world/swampOcclusionFade.js');

function fakeRenderer({webgl2=true}={}){
  const calls=[];let target=null;
  return {calls,capabilities:{isWebGL2:webgl2},getPixelRatio:()=>1,
    getDrawingBufferSize:v=>v.set(320,200),getRenderTarget:()=>target,setRenderTarget:t=>{target=t;calls.push(['target',t?'rt':null]);},
    render:(s,c)=>calls.push(['render',target?'rt':'screen',s.isScene&&s.children[0]?.material?.isShaderMaterial?'quad':'scene'])};
}
const camera=new THREE.PerspectiveCamera(60,1.6,.1,500),scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));

test('outside the swamp camera the frame is rendered directly, unchanged',()=>{
  const r=fakeRenderer(),post=createSwampInkPost({renderer:r,isActive:()=>false,enabled:true});
  post.render(scene,camera);
  assert.deepEqual(r.calls,[['render','screen','scene']]);assert.equal(post.report.active,false);
});

test('without WebGL2 (no multisampled depth target) it never takes over the render',()=>{
  const r=fakeRenderer({webgl2:false}),post=createSwampInkPost({renderer:r,isActive:()=>true,enabled:true});
  post.render(scene,camera);assert.deepEqual(r.calls,[['render','screen','scene']]);
});

test('in the swamp camera: scene goes to the offscreen target, the ink quad to the screen, fade marker only while offscreen',()=>{
  const r=fakeRenderer(),mark={value:0},seen=[];
  const realRender=r.render;r.render=(s,c)=>{seen.push(mark.value);realRender(s,c);};
  const post=createSwampInkPost({renderer:r,isActive:()=>true,enabled:true,fadeUniforms:{uSwFadeMark:mark}});
  post.render(scene,camera);
  assert.deepEqual(r.calls,[['target','rt'],['render','rt','scene'],['target',null],['render','screen','quad']]);
  assert.deepEqual(seen,[1,0]);assert.equal(mark.value,0);assert.equal(post.report.width,320);assert.equal(post.report.frames,1);
});

test('the pass is off unless enabled (default off since 2026-10-10)',()=>{
  const r=fakeRenderer(),post=createSwampInkPost({renderer:r,isActive:()=>true,enabled:false});
  post.render(scene,camera);assert.deepEqual(r.calls,[['render','screen','scene']]);
});

test('occlusion fade marks surviving dithered fragments with alpha 0 only for opaque materials and only while marked',()=>{
  const swamp=new THREE.Group(),inner=new THREE.Group();swamp.userData.inner=inner;swamp.add(inner);
  const opaque=new THREE.MeshStandardMaterial(),glass=new THREE.MeshStandardMaterial({transparent:true,opacity:.8});
  const a=new THREE.Mesh(new THREE.BoxGeometry(),opaque);a.name='leaf-a';const b=new THREE.Mesh(new THREE.BoxGeometry(),glass);b.name='leaf-b';inner.add(a,b);
  const fade=installSwampOcclusionFade({swamp,enabled:true});
  assert.ok(fade.uniforms.uSwFadeMark);
  const run=m=>{const sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sh,null);return sh;};
  assert.match(run(opaque).fragmentShader,/uSwFadeMark>\.5&&swFadeK>0\.\)gl_FragColor\.a=0\./);
  assert.doesNotMatch(run(glass).fragmentShader,/gl_FragColor\.a=0\./);
  assert.notEqual(opaque.customProgramCacheKey(),glass.customProgramCacheKey());
});

test('default (no ?swampInk=1) renders directly even in the swamp camera',()=>{
  const r=fakeRenderer(),post=createSwampInkPost({renderer:r,isActive:()=>true});
  post.render(scene,camera);assert.deepEqual(r.calls,[['render','screen','scene']]);assert.equal(post.report.enabled,false);
});
