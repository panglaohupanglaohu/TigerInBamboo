import * as THREE from 'three';
import {MIRROR_UV_GLSL} from '../core/mirror-uv.js';
import {bakeOrnamentField} from '../core/ornament-field.js';

/** 1104771432440049664 / 1105131621391495176. One immutable GPU field;
 * resizing, independent cutoffs and local cutoff-reveal animate only uniforms.
 * Mirroring is abs(UV), not time-varying noise. No original-art/9-slice claim.
 */
export function createOrnament({size=128}={}) {
  const baked=bakeOrnamentField(size),texture=new THREE.DataTexture(baked.rgba,size,size,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  const uniforms={orientation:{value:0},metric:{value:0},tileSize:{value:128},field:{value:texture},panel:{value:new THREE.Vector2(640,320)},border:{value:.018},center:{value:.036},reveal:{value:1},texel:{value:1/size}};
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,extensions:{derivatives:true},uniforms,
    vertexShader:'varying vec2 ornamentUV;void main(){ornamentUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`${MIRROR_UV_GLSL}
uniform float orientation;uniform float metric;uniform float tileSize;uniform sampler2D field;uniform vec2 panel;uniform float border;uniform float center;uniform float reveal;uniform float texel;varying vec2 ornamentUV;
void main(){
  vec2 q=abs(ornamentUV*2.-1.);
  vec2 sampleUV=orientMirrorUV(mix(q,foldMirrorUV((ornamentUV-.5)*panel/tileSize),metric),orientation);
  float d=texture2D(field,sampleUV).r*.25;
  float edge=min((1.-q.x)*panel.x*.5,(1.-q.y)*panel.y*.5);
  float cutoff=mix(border,center,step(32.,edge))*reveal;
  // Derivatives across mirrored raster quads can differ near a fold. Evaluate
  // the gradient in canonical texture coordinates, then apply screen UV width.
  vec2 dq=fwidth(sampleUV);
  float gx=(texture2D(field,clamp(sampleUV+vec2(texel,0.),0.,1.)).r
           -texture2D(field,clamp(sampleUV-vec2(texel,0.),0.,1.)).r)*.25/(2.*texel);
  float gy=(texture2D(field,clamp(sampleUV+vec2(0.,texel),0.,1.)).r
           -texture2D(field,clamp(sampleUV-vec2(0.,texel),0.,1.)).r)*.25/(2.*texel);
  float aa=max(abs(gx)*dq.x+abs(gy)*dq.y,.25/255.);
  float alpha=(1.-smoothstep(cutoff-aa,cutoff+aa,d))*smoothstep(0.,.08,reveal);
  gl_FragColor=vec4(vec3(.91,.86,.73),alpha);
#include <colorspace_fragment>
}`});
  let disposed=false;
  return{baked,texture,material,uniforms,
    set({width=uniforms.panel.value.x,height=uniforms.panel.value.y,border=uniforms.border.value,center=uniforms.center.value,reveal=uniforms.reveal.value,orientation=uniforms.orientation.value,metric=uniforms.metric.value,tileSize=uniforms.tileSize.value}={}){
      if(!Number.isInteger(orientation)||orientation<0||orientation>7||![0,1].includes(metric)||!Number.isFinite(tileSize)||tileSize<16||tileSize>1024)throw new RangeError('invalid mirror controls');
      if(disposed)throw new Error('ornament disposed');
      if(![width,height,border,center,reveal].every(Number.isFinite)||width<32||height<32||width>2048||height>2048||border<0||border>.2||center<0||center>.2||reveal<0||reveal>1)throw new RangeError('invalid ornament controls');
      uniforms.orientation.value=orientation;uniforms.metric.value=metric;uniforms.tileSize.value=tileSize;
      uniforms.panel.value.set(width,height);uniforms.border.value=border;uniforms.center.value=center;uniforms.reveal.value=reveal;
    },
    dispose(){if(!disposed){texture.dispose();material.dispose();disposed=true}}
  };
}
