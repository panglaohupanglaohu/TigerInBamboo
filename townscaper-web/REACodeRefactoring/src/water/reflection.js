import * as THREE from 'three';
import { CLOUD_SHADOW_GLSL } from '../light/cloud-shadow.js';
/** Local flat-colour approximation of the reference, reusing the WorldMesh.
 * No scene copy, render-to-texture or claim of the source reflection algorithm.
 * cloud = cloudShadow.uniforms（同一批 uniform 对象）：倒影里的小镇同样压在云影下，
 * 取样点用**未镜像**的世界坐标（mesh.scale.y=-1，所以 world.y 再取反一次才是原几何高度）。
 */
export function makeReflectionMaterial({time,water,night,cloud=null}) {
  const m = new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,
    uniforms:{uTime:time,uWater:water,uNight:night,uColorMix:{value:.5},uOpacity:{value:.82},uFade:{value:.9},uDistortion:{value:.018},uSurfaceY:{value:0}},
    vertexShader:`
      uniform float uTime;uniform float uDistortion;uniform float uSurfaceY;
      attribute float aGlow;varying vec3 vCol;varying float vDepth;varying float vGlow;varying vec3 vCldW;
      void main(){
        vec4 w=modelMatrix*vec4(position,1.0);vDepth=uSurfaceY-w.y;
        float depth=max(vDepth,0.0);
        vCldW=vec3(w.x,-w.y,w.z);
        w.x+=sin(w.y*9.0+uTime*1.3+w.z*.7)*uDistortion*depth;
        w.z+=cos(w.y*7.0-uTime*1.1+w.x*.5)*uDistortion*(2.0/3.0)*depth;
        vCol=color;vGlow=aGlow;gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader:`
      uniform vec3 uWater;uniform float uNight;uniform float uColorMix;uniform float uOpacity;uniform float uFade;
      varying vec3 vCol;varying float vDepth;varying float vGlow;varying vec3 vCldW;
      ${cloud ? CLOUD_SHADOW_GLSL : ''}
      void main(){
        if(vDepth<0.0)discard;
        vec3 mid=mix(uWater,vCol,uColorMix);
        mid+=vec3(1.0,.7,.3)*vGlow*uNight*.6;
        ${cloud ? 'mid*=cloudShadowTone(vCldW);' : ''}
        float fade=exp(-max(vDepth,0.0)*uFade);
        gl_FragColor=vec4(mid,uOpacity*fade);
        #include <colorspace_fragment>
      }`});
  if (cloud) {
    Object.assign(m.uniforms, cloud);
    m.needsUpdate = true;
  }
  return m;
}
export function setReflectionStyle(material,{colorMix=.5,opacity=.82,fade=.9,distortion=.018}={}){
  if(![colorMix,opacity,fade,distortion].every(Number.isFinite)||colorMix<0||colorMix>1||opacity<0||opacity>1||fade<0||fade>10||distortion<0||distortion>.2)throw new RangeError('reflection style');
  const u=material.uniforms;u.uColorMix.value=colorMix;u.uOpacity.value=opacity;u.uFade.value=fade;u.uDistortion.value=distortion;
}
