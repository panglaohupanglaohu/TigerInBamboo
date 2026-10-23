import * as THREE from 'three';
export const BATIAN_PALETTE=Object.freeze({charcoal:0x343e50,violet:0x55506c,sand:0xc7b69b,turquoise:0x81b8b2,coral:0xe88370,shadow:0x263451});
// Symmetric large mineral planes, not randomly scattered differently coloured tiles.
export function batianFacetColour(x,y,z){
  const a=Math.abs(x);
  if(y<-.2)return BATIAN_PALETTE.violet;
  const fork=(35-z)*.32+1.4;
  if(Math.abs(a-fork)<1.25 || (a<.95&&z<22))return BATIAN_PALETTE.sand;
  const vein=(35-z)*.48+1.2;
  if(Math.abs(a-vein)<1.1 || (a<2.5&&z< -16) || (z<16&&z>6&&a>24))return BATIAN_PALETTE.turquoise;
  if(y<1 || (z<12&&a>20))return BATIAN_PALETTE.violet;
  return BATIAN_PALETTE.charcoal;
}
export function colourBatianGeometry(source){
 const g=source.index?source.toNonIndexed():source.clone(),p=g.attributes.position;
 const out=[],norm=[],colour=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),co=new THREE.Color();
 function face(a,b,c,depth){
  const longest=Math.max(a.distanceTo(b),a.distanceTo(c),b.distanceTo(c));
  if(depth<4&&longest>7){const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);face(a,ab,ca,depth+1);face(ab,b,bc,depth+1);face(ca,bc,c,depth+1);face(ab,bc,ca,depth+1);return;}
  normal.subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();const centre=a.clone().add(b).add(c).multiplyScalar(1/3);co.setHex(batianFacetColour(centre.x,centre.y,centre.z));
  for(const v of [a,b,c]){out.push(v.x,v.y,v.z);norm.push(normal.x,normal.y,normal.z);colour.push(co.r,co.g,co.b);}
 }
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);face(a,b,c,0);}g.dispose();
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(out,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));result.setAttribute('color',new THREE.Float32BufferAttribute(colour,3));result.computeBoundingBox();result.computeBoundingSphere();return result;
}
export function installBatianColourPlanes(material){
 material.onBeforeCompile=shader=>{
  for(const [key,value] of Object.entries(BATIAN_PALETTE))shader.uniforms['batian_'+key]={value:new THREE.Color(value)};
  shader.vertexShader='varying vec3 batianLocal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n batianLocal=position;');
  shader.fragmentShader=`varying vec3 batianLocal;
 uniform vec3 batian_charcoal,batian_violet,batian_sand,batian_turquoise;
 vec2 batianHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
 vec3 batianMineral(vec2 uv){vec2 cell=floor(uv),f=fract(uv);float d1=10.0,d2=10.0,id=0.0;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 off=vec2(float(i),float(j)),seed=batianHash(cell+off),v=off+.18+seed*.64-f;float d=dot(v,v);if(d<d1){d2=d1;d1=d;id=seed.x;}else d2=min(d2,d);}
  return vec3(d2-d1,id,d1);}
 `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ba=abs(batianLocal.x);float bz=batianLocal.z;float by=batianLocal.y;
   vec3 pigment=batian_charcoal;
   if(by<1.0 || (bz<12.0 && ba>20.0))pigment=batian_violet;
   if(abs(by)>.2){
    float fork=(35.0-bz)*.32+1.4;
    float vein=(35.0-bz)*.48+1.2;
    if(abs(ba-fork)<1.25 || (ba<.95 && bz<22.0))pigment=mix(batian_sand,batian_violet,by<0.0?.34:0.0);
    else if(abs(ba-vein)<1.1 || (ba<2.5 && bz< -16.0) || (bz<16.0 && bz>6.0 && ba>24.0))pigment=batian_turquoise;
   }
   vec3 mineral=batianMineral(batianLocal.xz*.5+vec2(batianLocal.y*.17));
   float seam=1.0-smoothstep(.015,.055,mineral.x);
   float subVein=1.0-smoothstep(.004,.018,batianMineral(batianLocal.xz*1.8).x);
   pigment*=.91+mineral.y*.18;
   pigment=mix(pigment,vec3(.014,.022,.035),seam*.42+subVein*.08);
   diffuseColor.rgb=pigment;
   diffuseColor.a=opacity*(.97+.03*mineral.y);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=clamp(roughnessFactor+(mineral.y-.5)*.12,.12,.5);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance+=batian_turquoise*(.012+.024*seam)*(.25+.75*mineral.y);');
 };
 material.customProgramCacheKey=()=> 'batian-crystal-mineral-v3';
}
