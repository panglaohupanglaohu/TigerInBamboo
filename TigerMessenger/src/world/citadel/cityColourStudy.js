import * as THREE from 'three';
import {preservesCitadelMaterial} from './materialOwnership.js';

// Approved Istanbul study: limestone, muted brick, lead roofing and small teal accents.
export const CITY_STUDY_PALETTE=Object.freeze({oldStone:'#b2a38b',newStone:'#c6baa1',roof:'#8b5145',lead:'#596875',wood:'#51463d',teal:'#367d80',recess:'#494744',bronze:'#8d8061'});
const skip=/soldier|trooper|horse|bird|crew|player|courier|torch|glow|lamp|waterfall|water|cloud|light|particle|projectile|foliage|leaf|tree|cypress|pine|shrub|grass|canopy|plant|flower|vegetation|rope|rail|tram|ship|boat|rock|cliff|ravine|backdrop|terrain|mountain-study|study-rock/i;
export function cityColourRole(o,m){
 if(preservesCitadelMaterial(o,m))return null;
 let district='old',owned=false;
 for(let a=o;a;a=a.parent){
  if(a.name==='highland-gate')return null;
  if(a.name==='highland-west-city'){district='new';owned=true;}
  if(/town-terrace-|highland-central-sacred-tower|holy-old-town|holy-old-palace|highland-town-foundation|citadel-front-harbor/.test(a.name))owned=true;
  if(skip.test(a.name))return null;
 }
 if(!owned||!m?.color||m.isShaderMaterial||m.transparent||o.userData.isOutline)return null;
 const sourceNames=o.userData.materialSourceNames||[],source=sourceNames.join(' '),own=o.name+' '+m.name,label=own+' '+source;
 if(skip.test(source))return null;
 if(m.emissive?.getHex()&&/window|pane|light|warm/.test(label))return null;
 if(/main-gate-blue-banner/.test(label))return {district,role:'teal'};
 if(/finial|banner-emblem|banner-hanger|brass|bronze|metal/.test(label))return {district,role:'bronze'};
 if(/holy-main-cathedral-dome|holy-dome-lantern-cap/.test(label))return {district,role:'lead'};
 if(/dome-drum|dome-base|dome-column|dome-cornice|dome-stone-rib/.test(label))return {district,role:'stone'};
 const roofNames=/roof|dome-cap|chhatri-dome|ivory-dome|old-town-roof-dome\b|tile/;
 // Stone roof slabs share a batched material with walls: a single roof source
 // must not turn the entire cathedral terracotta.
 if(roofNames.test(own)||(sourceNames.length&&sourceNames.every(n=>roofNames.test(n)))||m.userData.townscaperPattern==='roof')return {district,role:'roof'};
 const recessed=/window|niche|recess|dark|pane/;
 if((recessed.test(own)&&!/wfc/.test(own))||(sourceNames.length&&sourceNames.every(n=>recessed.test(n)&&!/wfc/.test(n))))return {district,role:'recess'};
 const wooden=/wood|door|shutter|timber|balcony-deck|fence/;
 if(wooden.test(own)||(sourceNames.length&&sourceNames.every(n=>wooden.test(n))))return {district,role:'wood'};
 if(/banner|flag|cloth/.test(label))return null;
 const h={};m.color.getHSL(h);if(h.l<.06)return null;
 return {district,role:'stone'};
}
function colourMaterial(original,{district,role}){
 const m=original.clone(),previous=original.onBeforeCompile,key=original.customProgramCacheKey?.()||'';
 const target=new THREE.Color(CITY_STUDY_PALETTE[role==='stone'?district+'Stone':role]);
 // Apply after texture/vertex colour and before weathering. Preserve local
 // brightness (mortar, painted facade detail) while replacing the old hue.
 const luma=Math.max(.06,original.color.r*.2126+original.color.g*.7152+original.color.b*.0722);
 m.onBeforeCompile=function(shader,renderer){
  previous?.call(this,shader,renderer);
  shader.uniforms.cityStudyTint={value:target};shader.uniforms.cityStudyLuma={value:luma};
  shader.fragmentShader='uniform vec3 cityStudyTint; uniform float cityStudyLuma;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float cityStudyValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   diffuseColor.rgb=cityStudyTint*clamp(cityStudyValue/cityStudyLuma,.10,1.35);`);
 };
 m.customProgramCacheKey=()=>key+'-istanbul-city-v1-'+district+'-'+role;
 if(role==='lead'){m.roughness=.70;m.metalness=.22;}else if(role==='bronze'){m.roughness=.76;m.metalness=.35;}else {m.roughness=role==='wood'?.91:.94;m.metalness=0;}
 if(role!=='recess'){m.emissive?.set(0);m.emissiveIntensity=0;}
 m.userData.cityColourStudy={district,role};m.needsUpdate=true;return m;
}
export function applyCityColourStudy(root){
 if(!root||new URLSearchParams(globalThis.location?.search||'').get('citadelColour')==='0')return null;
 const cache=new Map(),counts={old:{},new:{}};let meshes=0;
 root.traverse(o=>{
  if(!o.isMesh||o.userData.isOutline)return;
  const swap=m=>{if(preservesCitadelMaterial(o,m))return m;const c=m?.userData.cityColourStudy||cityColourRole(o,m);if(!c)return m;
   counts[c.district][c.role]=(counts[c.district][c.role]||0)+1;o.userData.cityColour=c;meshes++;
   if(m.userData.cityColourStudy)return m;
   const key=m.uuid+c.district+c.role;if(!cache.has(key))cache.set(key,colourMaterial(m,c));return cache.get(key);
  };
  o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);
 });
 return root.userData.cityColourStudy={version:1,palette:CITY_STUDY_PALETTE,counts,meshes,target:'citadel-city-colours/target.png'};
}
