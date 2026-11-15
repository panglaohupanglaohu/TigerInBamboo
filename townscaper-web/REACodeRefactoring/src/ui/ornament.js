import * as THREE from 'three';
import {MIRROR_UV_GLSL} from '../core/mirror-uv.js';
import {bakeOrnamentField,bakeSquiggleField,SQUIGGLE_D0,SQUIGGLE_DR,SQUIGGLE_WOBBLE_GLSL} from '../core/ornament-field.js';

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

/** r55 · 1105131621391495176 "Squiggly distance fields, now with animation!" — REACode
 * squigglefield.js on the GPU: capsule quadrant SDF baked once (bucketed), folded four ways by
 * abs(), wobble + phase added per pixel so the edge crawls along its normal while the shape and
 * the amount of ink stay put; paper/ink/emboss rim + a diagonal sweep highlight as in REACode
 * shade(). border/center cutoffs and reveal keep the same meaning as createOrnament(). */
export function createSquiggleOrnament({w=256,h=128}={}){
  const baked=bakeSquiggleField(undefined,{w,h}),texture=new THREE.DataTexture(baked.rgba,w,h,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  const uniforms={field:{value:texture},extent:{value:new THREE.Vector2(baked.extent.w,baked.extent.h)},panel:{value:new THREE.Vector2(640,320)},
    border:{value:.018},center:{value:.036},reveal:{value:1},amp:{value:.005},freq:{value:19},phase:{value:0},sweep:{value:-1}};
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms,
    vertexShader:'varying vec2 ornamentUV;void main(){ornamentUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`${SQUIGGLE_WOBBLE_GLSL}
uniform sampler2D field;uniform vec2 extent;uniform vec2 panel;uniform float border;uniform float center;uniform float reveal;uniform float amp;uniform float freq;uniform float phase;uniform float sweep;varying vec2 ornamentUV;
void main(){
  float scale=min(panel.x/(2.*extent.x),panel.y/(2.*extent.y));      // px per world unit, aspect kept
  vec2 world=(ornamentUV-.5)*panel/scale;vec2 p=abs(world);          // four-way fold
  float far=${(SQUIGGLE_D0+SQUIGGLE_DR).toFixed(4)};
  float d=far;
  if(p.x<=extent.x&&p.y<=extent.y)d=texture2D(field,p/extent).r*${SQUIGGLE_DR.toFixed(4)}+${SQUIGGLE_D0.toFixed(4)};
  if(d<far-1e-4)d-=squiggleWobble(p,amp,freq,phase);
  // cutoffs (world units, same sliders as the mirrored-UV ornament): thicken/thin the ink;
  // plaque interior (|p|<plaque) uses center, the rest border. reveal grows the ink in.
  float inPlaque=step(p.x,.28)*step(p.y,.07);
  float grow=(mix(border,center,inPlaque)-.018)*.4;
  float px=1./scale;
  float dd=d-grow+(1.-reveal)*.06;
  float cov=clamp(.5-dd/px,0.,1.);
  vec3 paper=vec3(.70,.72,.715)*(.985+.015*sin((gl_FragCoord.x*1.7+gl_FragCoord.y*2.3)*.9));
  vec3 ink=vec3(.022,.030,.036);
  vec3 col=mix(paper,ink,cov);
  float rim=cov<=0.&&dd<.010?(1.-dd/.010)*.35:0.;
  col=mix(col,vec3(.92,.94,.935),rim);
  if(sweep>=0.){float s=(world.x*.9+world.y*.35)-sweep;float band=exp(-(s*s)/.0016);col=mix(col,vec3(1.,1.,.99),band*(cov>0.?.42:.10));}
  float frame=step(max(abs(world.x)/extent.x,abs(world.y)/extent.y),1.);
  gl_FragColor=vec4(col,max(cov,frame*.92)*smoothstep(0.,.08,reveal));
#include <colorspace_fragment>
}`});
  let disposed=false;
  return{baked,texture,material,uniforms,
    set({width=uniforms.panel.value.x,height=uniforms.panel.value.y,border=uniforms.border.value,center=uniforms.center.value,reveal=uniforms.reveal.value,amp=uniforms.amp.value,phase=uniforms.phase.value,sweep=uniforms.sweep.value}={}){
      if(disposed)throw new Error('ornament disposed');
      if(![width,height,border,center,reveal,amp,phase,sweep].every(Number.isFinite)||width<32||height<32||width>2048||height>2048||border<0||border>.2||center<0||center>.2||reveal<0||reveal>1||amp<0||amp>.05)throw new RangeError('invalid squiggle controls');
      uniforms.panel.value.set(width,height);uniforms.border.value=border;uniforms.center.value=center;uniforms.reveal.value=reveal;uniforms.amp.value=amp;uniforms.phase.value=phase;uniforms.sweep.value=sweep;
    },
    dispose(){if(!disposed){texture.dispose();material.dispose();disposed=true}}
  };
}
