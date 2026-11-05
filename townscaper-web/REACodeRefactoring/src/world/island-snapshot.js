/** 911913981731885056: "Saving island snapshots to 64² textures and then
 * crisping them back up with some shader magic". Actual shared geometry can
 * be captured once; the exact original channel encoding/shader is unknown.
 * 978211952504852480: fwidth gives the alpha threshold a screen-pixel AA width.
 */
import * as THREE from 'three';

export function createIslandSnapshot(renderer, {size=64}={}) {
  if(!Number.isInteger(size)||size<8||size>256)throw new RangeError('snapshot size must be 8..256');
  const target=new THREE.WebGLRenderTarget(size,size,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
  target.texture.generateMipmaps=false;
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,1000);
  let disposed=false;
  return {
    target, camera,
    capture(scene,{center=new THREE.Vector3(),half=8,height=40,hide=[]}={}) {
      if(disposed)throw new Error('snapshot disposed');
      if(![center.x,center.y,center.z,half,height].every(Number.isFinite)||half<=0||height<=0||half>1e5||height>900)throw new RangeError('invalid capture bounds');
      const state={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,xr:renderer.xr.enabled,background:scene.background};
      const hidden=[...new Set(hide.filter(Boolean))].map(o=>[o,o.visible]);
      try {
        for(const [o]of hidden)o.visible=false;
        scene.background=null;renderer.xr.enabled=false;renderer.autoClear=true;
        camera.left=-half;camera.right=half;camera.top=half;camera.bottom=-half;
        camera.position.set(center.x,center.y+height,center.z);camera.up.set(0,0,-1);camera.lookAt(center.x,center.y,center.z);camera.updateProjectionMatrix();
        renderer.setRenderTarget(target);renderer.setViewport(0,0,size,size);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
        const pixels=new Uint8Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
        return {texture:target.texture,pixels,size};
      } finally {
        renderer.setRenderTarget(state.target,state.face,state.mip);renderer.setViewport(state.viewport);renderer.setScissor(state.scissor);renderer.setScissorTest(state.scissorTest);renderer.setClearColor(state.clear,state.alpha);renderer.autoClear=state.autoClear;renderer.xr.enabled=state.xr;scene.background=state.background;
        for(const [o,visible]of hidden)o.visible=visible;
      }
    },
    dispose(){if(!disposed){target.dispose();disposed=true;}}
  };
}

/** Linear-filtered capture holds RGB over transparent black (premultiplied).
 * Unpremultiply before straight-alpha blending to avoid a dark coastal fringe.
 * The threshold changes the silhouette: not a recovery of lost 64² detail.
 */
export function snapshotMaterial(texture,{crisp=true}={}) {
  return new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
    uniforms:{map:{value:texture},crisp:{value:crisp?1:0}},
    vertexShader:'varying vec2 uvSnapshot;void main(){uvSnapshot=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D map;uniform float crisp;varying vec2 uvSnapshot;
void main(){vec4 p=texture2D(map,uvSnapshot);float w=max(fwidth(p.a)*.75,1./255.);float a=mix(p.a,smoothstep(.5-w,.5+w,p.a),crisp);vec3 rgb=p.a>1e-5?p.rgb/p.a:vec3(0.);gl_FragColor=vec4(rgb,a);
#include <colorspace_fragment>
}`});
}

/** A render-target texture belongs to its WebGL context. For another renderer,
 * explicitly upload the owned CPU readback; never reuse its GPU-only handle.
 */
export function snapshotTexture({pixels,size}) {
  if(!Number.isInteger(size)||size<8||size>256||Object.prototype.toString.call(pixels)!=='[object Uint8Array]'||pixels.length!==size*size*4)throw new RangeError('invalid snapshot readback');
  const texture=new THREE.DataTexture(new Uint8Array(pixels),size,size,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  return texture;
}
