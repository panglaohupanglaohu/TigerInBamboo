/** One low-resolution cube-height lookup per vertex. The local height darkening
 * model is an interpretation, not the original author's unpublished lighting.
 */
import * as THREE from 'three';
import {bakeCubeHeight} from '../core/cube-height.js';
export function createCubeHeightLookup(sample,options={}){
 const baked=bakeCubeHeight(sample,options),images=baked.faces.map(data=>new THREE.DataTexture(data,baked.size,baked.size));
 const texture=new THREE.CubeTexture(images);texture.type=THREE.UnsignedByteType;texture.format=THREE.RGBAFormat;
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const uniforms={uCubeHeight:{value:texture},uCubeHeightMin:{value:baked.minHeight},uCubeHeightSpan:{value:baked.maxHeight-baked.minHeight},uCubeHeightStrength:{value:0}},attached=new Map();
 let shader=null,disposed=false;
 function detach(material){const original=attached.get(material);if(!original)return;material.onBeforeCompile=original.compile;material.customProgramCacheKey=original.key;material.needsUpdate=true;attached.delete(material)}
 return {texture,uniforms,baked,get shader(){return shader},attach(material){
  if(disposed)throw Error('Disposed cube lookup');if(attached.has(material))return;
  const original={compile:material.onBeforeCompile,key:material.customProgramCacheKey};attached.set(material,original);
  material.onBeforeCompile=function(next,renderer){original.compile.call(this,next,renderer);Object.assign(next.uniforms,uniforms);
   next.vertexShader=next.vertexShader.replace('#include <common>',`#include <common>\nuniform samplerCube uCubeHeight;uniform float uCubeHeightMin;uniform float uCubeHeightSpan;uniform float uCubeHeightStrength;varying float vCubeHeightShade;\n#if __VERSION__ >= 300\n#define REA_SAMPLE_CUBE texture\n#else\n#define REA_SAMPLE_CUBE textureCube\n#endif`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>\nfloat localSky=uCubeHeightMin+REA_SAMPLE_CUBE(uCubeHeight,normalize(position)).r*uCubeHeightSpan;\nvCubeHeightShade=1.0-uCubeHeightStrength*0.55*clamp((localSky-length(position))/max(uCubeHeightSpan,0.0001),0.0,1.0);`);
   next.fragmentShader=next.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCubeHeightShade;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=vCubeHeightShade;');shader=next;
  };
  material.customProgramCacheKey=function(){return original.key.call(this)+'|cube-height-v1'};material.needsUpdate=true;
 },detach,dispose(){for(const material of [...attached.keys()])detach(material);texture.dispose();for(const image of images)image.dispose();disposed=true}};
}
