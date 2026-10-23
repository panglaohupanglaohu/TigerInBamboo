import * as THREE from 'three';

// Local internal fluorescence on the authored MeshBasicMaterial colour. No
// replacement skin colour, outline expansion, light object or bloom sprite.
export function applySwampInternalGlow(mesh,{center,radius,strength=.85,region}){
 const material=mesh.material;
 const glow={center:new THREE.Vector3(...center),radius:new THREE.Vector3(...radius),strength,color:new THREE.Color(0xf4a5ec),region};
 glow.strengthUniform={value:strength};
 glow.setStrength=value=>{glow.strength=Math.max(0,value);glow.strengthUniform.value=glow.strength;};
 material.userData.swampInternalGlow=glow;material.toneMapped=false;
 const emission=(region==='lizard-torso'||region==='bird-head')?`
 float glowCore=clamp(glowRegion*pow(glowFacing,1.5)*skinMask*localGlowStrength*2.0,0.0,.88);
 diffuseColor.rgb=mix(diffuseColor.rgb,localGlowColor,glowCore)+localGlowColor*glowCore*.10;
 `:'diffuseColor.rgb+=localGlowColor*localGlowStrength*glowRegion*(.20+.80*glowFacing)*skinMask;';
 material.onBeforeCompile=shader=>{
  shader.uniforms.localGlowCenter={value:glow.center};shader.uniforms.localGlowRadius={value:glow.radius};
  shader.uniforms.localGlowStrength=glow.strengthUniform;shader.uniforms.localGlowColor={value:glow.color};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 localGlowP;\nvarying vec3 localGlowN;\nvarying vec3 localGlowV;').replace('#include <begin_vertex>','#include <begin_vertex>\nlocalGlowP=position;\nlocalGlowN=normalize(normalMatrix*normal);\nlocalGlowV=-(modelViewMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 localGlowP;\nvarying vec3 localGlowN;\nvarying vec3 localGlowV;\nuniform vec3 localGlowCenter;\nuniform vec3 localGlowRadius;\nuniform vec3 localGlowColor;\nuniform float localGlowStrength;').replace('#include <color_fragment>',`#include <color_fragment>
 vec3 glowQ=(localGlowP-localGlowCenter)/localGlowRadius;
 float glowRegion=1.0-smoothstep(.82,1.28,length(glowQ));
 float glowFacing=pow(abs(dot(normalize(localGlowN),normalize(localGlowV))),1.6);
 float skinMask=smoothstep(.18,.38,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
 ${emission}`);
 };
 material.customProgramCacheKey=()=>`swamp-internal-fluorescence-3-${region}`;
 return glow;
}
