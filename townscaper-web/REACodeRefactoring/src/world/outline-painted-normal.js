/** Optional normal-buffer source using the shared painted normal map (1481661852887265288).
 * World-planar dominant-axis projection matches paintMeshNormals; silhouettes stay geometric.
 * The source clip for thin contrast lines is 1482011744843223042. These are distinct sources.
 */
import * as THREE from 'three';
export function paintedNormalMaterial(uniforms){
 const material=new THREE.MeshNormalMaterial();
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOutlinePaintWorld;').replace('#include <project_vertex>',`\nvec4 outlinePosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\noutlinePosition=instanceMatrix*outlinePosition;\n#endif\nvOutlinePaintWorld=(modelMatrix*outlinePosition).xyz;\n#include <project_vertex>`);
  shader.fragmentShader=('varying vec3 vOutlinePaintWorld;\nuniform sampler2D uOutlinePaintMap;\nuniform float uOutlinePaintScale;\nuniform float uOutlinePaintStrength;\n'+shader.fragmentShader).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 sourceN=normalize(normal*mat3(viewMatrix));
vec3 absN=abs(sourceN);vec2 plane=absN.y>=absN.x&&absN.y>=absN.z?vOutlinePaintWorld.xz:absN.x>=absN.z?vOutlinePaintWorld.zy:vOutlinePaintWorld.xy;
vec3 sampleN=normalize(texture2D(uOutlinePaintMap,plane/uOutlinePaintScale).xyz*2.0-1.0);
vec3 ref=abs(sourceN.x)<.99?vec3(1.,0.,0.):vec3(0.,0.,1.);
vec3 tangent=normalize(ref-sourceN*dot(ref,sourceN)),bitangent=cross(tangent,sourceN);
vec3 painted=normalize(tangent*sampleN.x+bitangent*sampleN.y+sourceN*sampleN.z);
normal=normalize(mat3(viewMatrix)*normalize(mix(sourceN,painted,uOutlinePaintStrength)));
`);
 };
 material.customProgramCacheKey=()=> 'outline-painted-normal-v1';return material;
}
