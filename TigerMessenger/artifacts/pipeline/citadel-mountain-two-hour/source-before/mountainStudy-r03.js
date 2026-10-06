import * as THREE from 'three';

// Approved target: citadel-current-diagram/citadel-istanbul-study-v3.png.
// This finish is scoped to rock surfaces; building, navigation and rail meshes
// keep their authored materials and geometry. Round 0 is the comparison view.
const ROCK_NAMES=/^(citadel-oskar-grid-mountain-surface|highland-ravine-wall-west|citadel-backdrop-ridge-.*|new-city-rock-shoulder|citadel-coastal-cliff-seal|old-shore-blender-rock-support)$/;
export function mountainStudyRound(){
 const value=typeof location==='undefined'?null:new URLSearchParams(location.search).get('citadelMountain');
 return value===null?3:Math.max(0,Math.min(3,Number(value)||0));
}
let geologyMap;
function rockMask(){
 if(geologyMap)return geologyMap;
 const n=256,data=new Uint8Array(n*n*4),hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
 const noise=(x,y)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),s),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),s),t);};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=(y*n+x)*4;
  data[i]=255*(noise(x/32,y/32)*.55+noise(x/11,y/11)*.30+noise(x/3,y/3)*.15);
  data[i+1]=255*noise(x/17,y/47);
  data[i+2]=255*(noise(x/3,y/3)*.75+hash(x,y)*.25);
  data[i+3]=255;
 }
 geologyMap=new THREE.DataTexture(data,n,n);geologyMap.wrapS=geologyMap.wrapT=THREE.RepeatWrapping;
 geologyMap.minFilter=THREE.LinearMipmapLinearFilter;geologyMap.magFilter=THREE.LinearFilter;
 geologyMap.generateMipmaps=true;geologyMap.anisotropy=4;geologyMap.needsUpdate=true;
 geologyMap.name='citadel-natural-rock-noise';return geologyMap;
}
function rockMaterial(original,inverse,radius,round){
 const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.97,metalness:0,side:original.side,flatShading:true});
 m.name='citadel-blue-grey-geology';
 const base=new THREE.Color('#747f87'),shade=new THREE.Color('#465662'),chalk=new THREE.Color('#a2a8a9');
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{mtInverse:{value:inverse},mtRadius:{value:radius},mtMap:{value:rockMask()},mtBase:{value:base},mtShade:{value:shade},mtChalk:{value:chalk}});
  shader.vertexShader='varying vec3 vMt; varying vec3 vMtWorld; uniform mat4 mtInverse;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 mtWorld=modelMatrix*vec4(transformed,1.0);
   vMt=(mtInverse*mtWorld).xyz; vMtWorld=mtWorld.xyz;`);
  shader.fragmentShader=`varying vec3 vMt; varying vec3 vMtWorld; uniform float mtRadius;
   uniform sampler2D mtMap; uniform vec3 mtBase; uniform vec3 mtShade; uniform vec3 mtChalk;
   vec3 mtSample(vec3 p,vec3 w){return texture2D(mtMap,p.yz).rgb*w.x+texture2D(mtMap,p.xz).rgb*w.y+texture2D(mtMap,p.xy).rgb*w.z;}
   float mtRelief;\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 mtN=normalize(cross(dFdx(vMt),dFdy(vMt)));
   vec3 mtW=pow(abs(mtN),vec3(4.0));mtW/=max(.001,mtW.x+mtW.y+mtW.z);
   vec3 mtMacro=mtSample(vMt*.027,mtW),mtGrain=mtSample(vMt*.21,mtW);
   float mtAltitude=length(vMtWorld)-mtRadius;
   float mtWet=1.0-smoothstep(.0,3.5,mtAltitude);
   float mtWash=smoothstep(.25,.78,mtMacro.r);
   vec3 mtColor=mix(mtShade,mtBase,.45+.55*mtWash);
   mtColor=mix(mtColor,mtChalk,smoothstep(.57,.86,mtMacro.g)*.35);
   float mtBand=sin((mtAltitude+vMt.x*.11+mtMacro.r*2.1)*3.1);
   float mtAA=max(.025,fwidth(mtBand)*1.2);
   float mtSeam=1.0-smoothstep(-.98-mtAA,-.83+mtAA,mtBand);
   float mtJointPhase=vMt.x*.45+vMt.z*.34+mtMacro.g*1.8;
   float mtJoint=1.0-smoothstep(.012,.055+fwidth(mtJointPhase),abs(fract(mtJointPhase)-.5));
   float mtDetail=${round>=2?'1.0':'0.0'};
   mtColor*=1.0-mtDetail*(mtSeam*.16+mtJoint*.19);
   mtColor*=1.0+mtDetail*(mtGrain.b-.5)*.16;
   mtColor=mix(mtColor,mtColor*vec3(.48,.59,.61),mtWet*.65);
   diffuseColor.rgb=mtColor;
   mtRelief=mtDetail*(mtGrain.r*.13-mtSeam*.035-mtJoint*.055);`);
  if(round>=3)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   vec3 mtDx=dFdx(-vViewPosition),mtDy=dFdy(-vViewPosition);
   vec3 mtR1=cross(mtDy,normal),mtR2=cross(normal,mtDx);
   float mtDet=dot(mtDx,mtR1);
   vec3 mtGrad=sign(mtDet)*(dFdx(mtRelief)*mtR1+dFdy(mtRelief)*mtR2);
   normal=normalize(abs(mtDet)*normal-mtGrad*.38);`);
 };
 m.customProgramCacheKey=()=>`citadel-mountain-study-${round}-v1`;
 return m;
}
export function applyCitadelMountainStudy(castle,radius=160){
 const round=mountainStudyRound();if(!round||!castle||castle.userData.mountainStudy)return null;
 castle.updateWorldMatrix(true,true);const inverse=castle.matrixWorld.clone().invert(),surfaces=[];
 castle.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&ROCK_NAMES.test(o.name)&&!Array.isArray(o.material))surfaces.push(o);});
 for(const mesh of surfaces){mesh.userData.mountainStudyOriginalMaterial=mesh.material.uuid;mesh.material=rockMaterial(mesh.material,inverse,radius,round);}
 return castle.userData.mountainStudy={round,version:1,target:'citadel-mountain-two-hour/approved-target.png',surfaces:surfaces.map(m=>m.name),geometryChanged:false,shader:'world-anchored blue-grey rock, mineral wash, strata and joint relief'};
}
