import * as THREE from 'three';
import {sharedLeafAtlas} from '../core/leaf-atlas.js';
import {SKIN_SIZE,PLANT_RECT} from '../core/town-skin.js';
import {TEXEL_SKIP_GLSL} from '../core/texel-skip.js';

/**
 * 1241046107125399552：植物读「全城那张 128² 图」的右下 32² 角。
 * 全场景共享单例：整个进程一份 DataTexture，所有 Vegetation 实例、
 * 共享灌木 / 树冠材质都绑同一个纹理对象（不是每个网格各建一份）。
 * TownSkinLayer 打开时把 surface.uniform 指到同一张 TownColor 纹理对象上
 * （world/town-skin-layer.js），建筑和植物真正共读一张图。
 */
let SHARED=null;
export function sharedLeafTexture(){
  if(!SHARED){
    const atlas=sharedLeafAtlas(),texture=new THREE.DataTexture(atlas.data,atlas.size,atlas.size,THREE.RGBAFormat);
    texture.minFilter=texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=false;texture.needsUpdate=true;
    SHARED={atlas,texture};
  }
  return SHARED;
}
export function makeLeafSurface(){
  const {atlas,texture}=sharedLeafTexture();
  // shared:true —— 纹理是场景级单例；dispose 只放开本 surface 的引用，不销毁共享纹理
  return {atlas,texture,shared:true,on:{value:1},uniform:{value:texture},dispose(){this.uniform.value=null}};
}
/**
 * 旧版叶状轮廓的三维噪声（对照路径，uLeafAtlasOn=0 时走这条）。
 * 单一来源：vegetation.js 彩色材质与 leaf-depth.js 深度材质共用，两处不会漂移。
 */
export const LEAF_NOISE_GLSL = /* glsl */ `
  float lhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float lnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(lhash(i), lhash(i + vec3(1,0,0)), f.x), mix(lhash(i + vec3(0,1,0)), lhash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(lhash(i + vec3(0,0,1)), lhash(i + vec3(1,0,1)), f.x), mix(lhash(i + vec3(0,1,1)), lhash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

// Spherical object coordinates remain attached when the camera or instance moves.
// The mapping and motif are local reconstructions; source supplies no formula.
// 角落常量由 core/town-skin.js 的 PLANT_RECT / SKIN_SIZE 生成，布局不会和全城图集漂移。
export const LEAF_SURFACE_GLSL=TEXEL_SKIP_GLSL+`
uniform sampler2D uLeafAtlas;
uniform float uLeafAtlasOn;
varying vec3 vLeafSphere;
float leafPattern(vec3 direction){
  vec3 n=normalize(direction);
  vec2 uv=vec2(.5+atan(n.z,n.x)/6.28318530718,.5+asin(clamp(n.y,-1.0,1.0))/3.14159265359);
  vec2 t=uv*${PLANT_RECT.w.toFixed(1)};
  // Wrapped longitude derivatives must not span the entire atlas at the seam.
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  dx.x=fract(dx.x+.5)-.5;dy.x=fract(dy.x+.5)-.5;
  vec2 fw=max((abs(dx)+abs(dy))*${PLANT_RECT.w.toFixed(1)},vec2(.00001));
  vec2 q=clamp(vec2(skipTexel(t.x,fw.x),skipTexel(t.y,fw.y)),vec2(.5),vec2(${(PLANT_RECT.w-.5).toFixed(1)}));
  float value=texture2D(uLeafAtlas,(vec2(${PLANT_RECT.x.toFixed(1)},${PLANT_RECT.y.toFixed(1)})+q)/${SKIN_SIZE.toFixed(1)}).r;
  // Conservative mean fade at unresolved scales; not a general atlas mip chain.
  return mix(value,.5,smoothstep(1.0,2.0,max(fw.x,fw.y)));
}
float leafCoverage(float facing,float pattern){
  float edge=abs(facing)-(.08+.35*pattern);
  float aa=max(fwidth(edge),.005);
  return smoothstep(-aa,aa,edge);
}
`;
