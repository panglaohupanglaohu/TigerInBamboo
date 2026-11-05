import * as THREE from 'three';
import {buildLeafAtlas} from '../core/leaf-atlas.js';
import {TEXEL_SKIP_GLSL} from '../core/texel-skip.js';
export function makeLeafSurface(){
  const atlas=buildLeafAtlas(),texture=new THREE.DataTexture(atlas.data,atlas.size,atlas.size,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.needsUpdate=true;
  return {atlas,texture,on:{value:1},uniform:{value:texture},dispose(){texture.dispose()}};
}
// Spherical object coordinates remain attached when the camera or instance moves.
// The mapping and motif are local reconstructions; source supplies no formula.
export const LEAF_SURFACE_GLSL=TEXEL_SKIP_GLSL+`
uniform sampler2D uLeafAtlas;
uniform float uLeafAtlasOn;
varying vec3 vLeafSphere;
float leafPattern(vec3 direction){
  vec3 n=normalize(direction);
  vec2 uv=vec2(.5+atan(n.z,n.x)/6.28318530718,.5+asin(clamp(n.y,-1.0,1.0))/3.14159265359);
  vec2 t=uv*32.0;
  // Wrapped longitude derivatives must not span the entire atlas at the seam.
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  dx.x=fract(dx.x+.5)-.5;dy.x=fract(dy.x+.5)-.5;
  vec2 fw=max((abs(dx)+abs(dy))*32.0,vec2(.00001));
  vec2 q=clamp(vec2(skipTexel(t.x,fw.x),skipTexel(t.y,fw.y)),vec2(.5),vec2(31.5));
  float value=texture2D(uLeafAtlas,(vec2(96.0)+q)/128.0).r;
  // Conservative mean fade at unresolved scales; not a general atlas mip chain.
  return mix(value,.5,smoothstep(1.0,2.0,max(fw.x,fw.y)));
}
float leafCoverage(float facing,float pattern){
  float edge=abs(facing)-(.08+.35*pattern);
  float aa=max(fwidth(edge),.005);
  return smoothstep(-aa,aa,edge);
}
`;
