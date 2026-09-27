// World-sized courses survive batching and sphere-conforming geometry.
// These are material details, not thousands of extra masonry meshes.
export function finishFactoryMaterial(material,kind){
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
   varying vec3 vFactoryPosition; varying vec3 vFactoryNormal;`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
   vFactoryPosition=position; vFactoryNormal=normal;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vFactoryPosition; varying vec3 vFactoryNormal;
   float fHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
   float fNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(fHash(i),fHash(i+vec3(1,0,0)),f.x),mix(fHash(i+vec3(0,1,0)),fHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(fHash(i+vec3(0,0,1)),fHash(i+vec3(1,0,1)),f.x),mix(fHash(i+vec3(0,1,1)),fHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec3 p=vFactoryPosition,n=abs(normalize(vFactoryNormal));
    float grain=fNoise(p*37.);
    diffuseColor.rgb*=.92+.12*grain;
    ${kind==='stone'?`
    vec2 q=n.y>.8?p.xz:vec2(n.z>n.x?p.x:p.z,p.y);
    q/=vec2(.86,.38); q.x+=mod(floor(q.y),2.)*.5;
    vec2 edge=min(fract(q),1.-fract(q));
    float joint=1.-smoothstep(.016,.037,min(edge.x,edge.y));
    float block=fHash(vec3(floor(q),0.));
    diffuseColor.rgb*=.90+.19*block;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.55,joint*.48);
    `:kind==='slate'?`
    vec2 q=p.xz*vec2(2.,2.7);q.x+=mod(floor(q.y),2.)*.5;
    vec2 edge=min(fract(q),1.-fract(q));
    diffuseColor.rgb*=.84+.25*fHash(vec3(floor(q),0.));
    diffuseColor.rgb*=1.-(1.-smoothstep(.015,.04,min(edge.x,edge.y)))*.22;
    `:`
    float stain=smoothstep(.55,.82,fNoise(p*2.3));
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.67,.59),stain*.45);
    `}
   `);
 };
 material.customProgramCacheKey=()=>`factory-finish-v1-${kind}`;
 return material;
}
