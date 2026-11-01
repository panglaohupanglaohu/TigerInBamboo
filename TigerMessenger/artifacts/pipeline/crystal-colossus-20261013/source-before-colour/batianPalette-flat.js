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
  shader.fragmentShader='varying vec3 batianLocal;\nuniform vec3 batian_charcoal,batian_violet,batian_sand,batian_turquoise;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ba=abs(batianLocal.x);float bz=batianLocal.z;float by=batianLocal.y;
   vec3 pigment=batian_charcoal;
   if(by<1.0 || (bz<12.0 && ba>20.0))pigment=batian_violet;
   if(by>1.0){
    float fork=(35.0-bz)*.32+1.4;
    float vein=(35.0-bz)*.48+1.2;
    if(abs(ba-fork)<1.25 || (ba<.95 && bz<22.0))pigment=batian_sand;
    else if(abs(ba-vein)<1.1 || (ba<2.5 && bz< -16.0) || (bz<16.0 && bz>6.0 && ba>24.0))pigment=batian_turquoise;
   }
   diffuseColor.rgb=pigment;`);
 };
 material.customProgramCacheKey=()=> 'batian-mineral-colour-planes-v2';
}
