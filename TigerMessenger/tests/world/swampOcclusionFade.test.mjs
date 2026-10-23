import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampOcclusionFade,swampOcclusionApertureDistance} from '../../src/world/swampOcclusionFade.js';
globalThis.location={search:''};
const fixture=()=>{
 const swamp=new T.Group(),leaf=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());leaf.name='greg-understory-fan';swamp.add(leaf);
 const actor=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());actor.name='moebius-monkey';swamp.add(actor);
 return {swamp,leaf,actor};
};
const shader=()=>({uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader});
test('clean view aperture clears its centre and near lens, retains off-axis leaves and plants behind the player',()=>{
 const a=new T.Vector3(0,0,0),b=new T.Vector3(0,0,-5),distance=p=>swampOcclusionApertureDistance(new T.Vector3(...p),a,b);
 assert.ok(distance([0,0,-2])<0);assert.ok(distance([.8,0,-2])<0);
 assert.ok(distance([1.4,0,-2])>0,'side foliage frames the view rather than fading across the screen');
 assert.ok(distance([0,0,-5.2])>0,'foliage beyond the player remains');
 assert.ok(distance([0,0,2.5])>0,'distant foliage behind the camera remains');assert.ok(distance([.2,0,0])<0,'the lens cannot sit inside an opaque leaf');
 assert.ok(distance([1.5,.2,-.6])<0,'off-axis leaves within the near lens protection make way');
 assert.ok(distance([2.3,0,0])>0,'2.2world near protection does not erase the whole foreground');
 assert.ok(swampOcclusionApertureDistance(new T.Vector3(1.5,.2,-.6),a,b,1.15,1,.42)>0,'small near-radius comparison retains the formerly blocking leaf');
 assert.equal(swampOcclusionApertureDistance(a,a,b,1.15,0),Infinity);
 const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),1.3),shift=new T.Vector3(60,140,-23),point=new T.Vector3(.8,0,-2);
 const before=swampOcclusionApertureDistance(point,a,b),after=swampOcclusionApertureDistance(point.clone().applyQuaternion(turn).add(shift),a.clone().applyQuaternion(turn).add(shift),b.clone().applyQuaternion(turn).add(shift));assert.ok(Math.abs(before-after)<1e-12,'aperture is world-space, independent of spherical placement');
});
test('opening and release ease in real seconds independently of frame rate with exact lens position',()=>{
 const camera={position:new T.Vector3(0,0,5)},player={position:new T.Vector3(0,0,0)};
 const run=(fps,on,initial=0)=>{const {swamp}=fixture(),fade=installSwampOcclusionFade({swamp,now:()=>0});fade.uniforms.uSwFadeOn.value=initial;for(let i=0;i<fps;i++)fade.update(camera,player,on,1/fps);return fade;};
 const a=run(15,true),b=run(120,true);assert.ok(Math.abs(a.report.weight-b.report.weight)<1e-12);assert.ok(a.report.weight>.99&&a.report.weight<1);
 const first=installSwampOcclusionFade({swamp:fixture().swamp,now:()=>0});first.update(camera,player,true,1/60);assert.ok(first.report.weight>0&&first.report.weight<.2);
 camera.position.x=3;first.update(camera,player,true,1/60);assert.deepEqual(first.uniforms.uSwFadeA.value.toArray(),camera.position.toArray());
 const exit=run(60,false,1);assert.ok(exit.report.weight<.011&&exit.report.weight>0);for(let i=0;i<120;i++)exit.update(camera,player,false,1/60);assert.equal(exit.report.weight,0);assert.equal(exit.report.active,false);
});
test('shader inserts a clean local opening without Bayer pixels, material transparency or geometry changes',()=>{
 const {swamp,leaf,actor}=fixture(),before=leaf.geometry.attributes.position.array.slice(),originalActorKey=actor.material.customProgramCacheKey(),actorHook=actor.material.onBeforeCompile;
 let calls=0;leaf.material.onBeforeCompile=s=>{calls++;s.uniforms.original={value:1};};
 const fade=installSwampOcclusionFade({swamp}),s=shader();leaf.material.onBeforeCompile(s);
 assert.equal(fade.report.version,4);assert.equal(fade.report.nearRadius,2.2);assert.equal(fade.uniforms.uSwFadeNear.value,2.2);assert.equal(fade.report.mode,'clean-aperture');assert.equal(fade.report.meshes,1);assert.equal(calls,1);assert.equal(s.uniforms.original.value,1);
 assert.match(s.fragmentShader,/if\(swDistance<0\.\)discard/);assert.match(s.fragmentShader,/fwidth\(swDistance\)/);assert.doesNotMatch(s.fragmentShader,/gl_FragCoord|Bayer|ivec2|\.72\*k/);
 assert.equal(leaf.material.transparent,false);assert.equal(leaf.material.depthWrite,true);assert.deepEqual(leaf.geometry.attributes.position.array,before);
 assert.equal(actor.material.onBeforeCompile,actorHook);assert.equal(actor.material.customProgramCacheKey(),originalActorKey);
 const key=leaf.material.customProgramCacheKey();fade.patch(leaf.material);assert.equal(leaf.material.customProgramCacheKey(),key);const s2=shader();leaf.material.onBeforeCompile(s2);assert.equal((s2.vertexShader.match(/varying vec3 vSwFadeW;/g)||[]).length,1);
});
test('ink shell shares the exact aperture and instanced surfaces calculate world points after instance transform',async()=>{
 const {createGregLakeInkMaterial}=await import('../../src/world/swampGregVisuals.js');
 const {swamp,leaf}=fixture(),ink=new T.Mesh(leaf.geometry,createGregLakeInkMaterial());ink.userData.isOutline=true;leaf.add(ink);
 const fade=installSwampOcclusionFade({swamp});assert.match(ink.material.fragmentShader,/if\(swDistance<0\.\)discard/);assert.equal(ink.material.uniforms.uSwFadeOn,fade.uniforms.uSwFadeOn);
 const s=shader();leaf.material.onBeforeCompile(s);assert.match(s.vertexShader,/swp=instanceMatrix\*swp/);
 assert.match(s.vertexShader,/vSwFadeW=\(modelMatrix\*swp\)\.xyz/);
});
test('legacy and disabled comparison flags preserve the previous behavior',()=>{
 globalThis.location.search='?swampCamFadeLegacy=1';try{
  const {swamp,leaf}=fixture(),fade=installSwampOcclusionFade({swamp}),s=shader();leaf.material.onBeforeCompile(s);assert.equal(fade.report.version,2);assert.equal(fade.uniforms.uSwFadeR.value,.9);assert.match(s.fragmentShader,/ivec2 p=ivec2\(mod\(gl_FragCoord.xy,4\.\)\)/);
  fade.update({position:new T.Vector3()},{position:new T.Vector3()},true);assert.equal(fade.uniforms.uSwFadeOn.value,1);fade.update({position:new T.Vector3()},{position:new T.Vector3()},false);assert.equal(fade.uniforms.uSwFadeOn.value,0);
 }finally{globalThis.location.search='';}
 globalThis.location.search='?swampCamFadeNear=0';try{
  const {swamp,leaf}=fixture(),fade=installSwampOcclusionFade({swamp}),s=shader();leaf.material.onBeforeCompile(s);
  assert.equal(fade.report.version,3);assert.equal(fade.uniforms.uSwFadeNear.value,.42);assert.ok(leaf.material.customProgramCacheKey().endsWith('aperture-v3'));assert.doesNotMatch(s.fragmentShader,/ivec2/);
 }finally{globalThis.location.search='';}
 const {swamp,leaf}=fixture(),hook=leaf.material.onBeforeCompile;globalThis.location.search='?swampCamFade=0';try{const fade=installSwampOcclusionFade({swamp});assert.equal(fade.report.enabled,false);assert.equal(leaf.material.onBeforeCompile,hook);assert.equal(fade.uniforms,undefined);}finally{globalThis.location.search='';}
});
