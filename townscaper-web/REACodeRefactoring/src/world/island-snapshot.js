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

/* ---- REACode snapshot64.js CPU twin + metrics (911913981731885056) --------------------------
 * Truth = the shared World's land silhouette rasterised at n²; storage = m² box-downsample (what a
 * 64² capture keeps); display = bilinear upsample, optionally "crisped" exactly like
 * snapshotMaterial (smoothstep around 0.5 with a width of 0.75·fwidth, floor 1/255).
 * Metrics from the lab: IoU, edgeEnergy (NOT a crispness measure: monotone remaps keep total
 * variation), peakGradient, bandPixels (0.15<v<0.85) and rmse against the truth. */
export function worldSilhouette(world,index,{size=256,center=[0,0],half=8}={}){
 if(!Number.isInteger(size)||size<8||!(half>0)||typeof index?.cellAt!=='function')throw new RangeError('Invalid silhouette request');
 const m=new Float32Array(size*size);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=center[0]-half+(i+.5)/size*2*half,z=center[1]-half+(j+.5)/size*2*half,c=index.cellAt(x,z);m[j*size+i]=c&&world.isLand(c)?1:0;}
 return m;
}
export function snapshotAlpha(pixels,size){if(pixels?.length!==size*size*4)throw new RangeError('Invalid readback');return Float32Array.from({length:size*size},(_,i)=>pixels[i*4+3]/255);}
export function downsampleMask(mask,n,m){if(n%m)throw new RangeError('n must be a multiple of m');const k=n/m,out=new Float32Array(m*m);for(let y=0;y<m;y++)for(let x=0;x<m;x++){let s=0;for(let j=0;j<k;j++)for(let i=0;i<k;i++)s+=mask[(y*k+j)*n+x*k+i];out[y*m+x]=s/(k*k);}return out;}
export function upsampleBilinear(small,m,n){const out=new Float32Array(n*n),k=m/n;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const fx=(x+.5)*k-.5,fy=(y+.5)*k-.5,x0=Math.min(m-1,Math.max(0,Math.floor(fx))),y0=Math.min(m-1,Math.max(0,Math.floor(fy))),x1=Math.min(m-1,x0+1),y1=Math.min(m-1,y0+1),tx=Math.min(1,Math.max(0,fx-x0)),ty=Math.min(1,Math.max(0,fy-y0));out[y*n+x]=(small[y0*m+x0]*(1-tx)+small[y0*m+x1]*tx)*(1-ty)+(small[y1*m+x0]*(1-tx)+small[y1*m+x1]*tx)*ty;}return out;}
export function crispSnapshotCPU(small,m,n){
 const a=upsampleBilinear(small,m,n),out=new Float32Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,dx=Math.abs(a[y*n+Math.min(n-1,x+1)]-a[i]),dy=Math.abs(a[Math.min(n-1,y+1)*n+x]-a[i]),w=Math.max((dx+dy)*.75,1/255),t=Math.max(0,Math.min(1,(a[i]-(.5-w))/(2*w)));out[i]=t*t*(3-2*t);}
 return out;
}
export const snapshotMetrics={
 iou(a,b){let i=0,u=0;for(let k=0;k<a.length;k++){const x=a[k]>=.5,y=b[k]>=.5;i+=x&&y;u+=x||y;}return u?i/u:0;},
 edgeEnergy(img,n){let s=0;for(let y=1;y<n;y++)for(let x=1;x<n;x++){const i=y*n+x;s+=Math.abs(img[i]-img[i-1])+Math.abs(img[i]-img[i-n]);}return s/(n*n);},
 peakGradient(img,n){let m=0;for(let y=1;y<n;y++)for(let x=1;x<n;x++){const i=y*n+x;m=Math.max(m,Math.abs(img[i]-img[i-1]),Math.abs(img[i]-img[i-n]));}return m;},
 bandPixels(img,lo=.15,hi=.85){let c=0;for(const v of img)if(v>lo&&v<hi)c++;return c;},
 rmse(img,truth){let s=0;for(let i=0;i<img.length;i++)s+=(img[i]-truth[i])**2;return Math.sqrt(s/img.length);},
};
