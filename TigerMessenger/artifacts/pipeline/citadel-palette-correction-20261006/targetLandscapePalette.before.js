import {targetCityParams} from './targetCityRelease.js';
import * as THREE from 'three';

// Project-authored target palette. Colours only: mountain vertices, routes,
// building orientation and landmark ownership are deliberately untouched.
export const CITADEL_TARGET_PALETTE=Object.freeze({rock:'#d4d0c4',rockShade:'#8798ad',chalk:'#eee2c9',moss:'#91ad78',grassShade:'#93b277',grass:'#c1cf83',crown:'#528f88',crownLight:'#74aa95',crownShade:'#376f71',cypress:'#315f58'});
export function applyTargetLandscapePalette(castle,{enabled=targetCityParams().get('citadelTargetAtmosphere')==='1'}={}){
 if(!enabled||!castle)return null;
 if(castle.userData.targetLandscapePalette)return castle.userData.targetLandscapePalette;
 const p=CITADEL_TARGET_PALETTE,counts={rock:0,grass:0,trees:0},cache=new Map();
 const rockNames=new Set(castle.userData.mountainStudy?.surfaces||[]);
 const inside=(o,re)=>{for(let a=o;a&&a!==castle;a=a.parent)if(re.test(a.name))return true;return false;};
 castle.traverse(o=>{
  if(!o.isMesh||o.userData.isOutline)return;
  const rock=rockNames.has(o.name)||inside(o,/^citadel-study-(fractured-buttresses|rock-crags)$/);
  const grass=o.name==='citadel-study-groundcover';
  const tree=inside(o,/^citadel-mountain-canopy-candidate$/);
  if(!rock&&!grass&&!tree)return;
  if(grass&&o.geometry.attributes.color){
   // The turf material stays white: avoid applying a second coloured multiplier.
   const a=o.geometry.attributes.color,lo=new THREE.Color(p.grassShade),hi=new THREE.Color(p.grass),color=new THREE.Color();
   let min=Infinity,max=-Infinity;for(let i=0;i<a.count;i++){const l=.2126*a.getX(i)+.7152*a.getY(i)+.0722*a.getZ(i);min=Math.min(min,l);max=Math.max(max,l);}
   for(let i=0;i<a.count;i++){const l=.2126*a.getX(i)+.7152*a.getY(i)+.0722*a.getZ(i);color.copy(lo).lerp(hi,.35+.65*(max>min?(l-min)/(max-min):.5));a.setXYZ(i,color.r,color.g,color.b);}a.needsUpdate=true;
  }
  const map=m=>{
   if(!m)return m;const key=m.uuid+':'+(rock?'rock':grass?'grass':'tree');if(cache.has(key))return cache.get(key);
   const n=m.clone(),oldCompile=m.onBeforeCompile,oldKey=m.customProgramCacheKey;
   if(rock){n.onBeforeCompile=function(shader,renderer){oldCompile?.call(this,shader,renderer);for(const[k,v]of Object.entries({mtBase:p.rock,mtShade:p.rockShade,mtChalk:p.chalk,mtVerdure:p.moss}))if(shader.uniforms[k])shader.uniforms[k].value=new THREE.Color(v);};n.customProgramCacheKey=()=>oldKey.call(m)+'|target-landscape-palette-1';}
   if(grass)n.color.set(0xffffff);
   if(tree){const name=m.name;n.color.set(/cypress/.test(name)?p.cypress:/deep/.test(name)?p.crownShade:/sage/.test(name)?p.crownLight:/bark/.test(name)?'#77694f':p.crown);}
   n.userData={...n.userData,targetLandscapePalette:1,preserveCitadelMaterial:true};cache.set(key,n);return n;
  };
  o.material=Array.isArray(o.material)?o.material.map(map):map(o.material);counts[rock?'rock':grass?'grass':'trees']++;
 });
 return castle.userData.targetLandscapePalette={revision:1,counts,palette:p,geometryPositionsChanged:false,landmarksChanged:false};
}
