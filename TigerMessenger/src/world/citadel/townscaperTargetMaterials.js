import {targetCityParams} from './targetCityRelease.js';
import * as THREE from 'three';
import {cityColourRole} from './cityColourStudy.js';
import {preservesCitadelMaterial} from './materialOwnership.js';
const walls=['#edcf83','#75b9d2','#68c2bd','#db9295','#efe0b2'];
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};

// Material-only first architecture pass. Real positions, merged cell ownership,
// WFC edit metadata, statue, horse and all collision geometry stay intact.
export function applyTownscaperTargetMaterials(root){
 if(targetCityParams().get('citadelTargetArchitecture')!=='1'||!root)return null;
 root.updateWorldMatrix(true,true);const cache=new Map(),counts={},originals=[],entries=[];
 root.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;
  const replace=source=>{
   if(!source||preservesCitadelMaterial(o,source))return source;
   const role=cityColourRole(o,source);if(!role)return source;
   const names=[o.name,source.name,...(o.userData.materialSourceNames||[])].join(' ');
   const structure=/foundation|plaza|paving|stair|bridge|rampart|terrace.*floor|(?:^|[-_ ])arch(?:[-_ ]|$)|column|coping|cornice|drum|(?:^|[-_ ])base(?:[-_ ]|$)|platform/i.test(names);
   let colour=role.role==='roof'?'#e98a51':role.role==='lead'?'#3977a2':role.role==='wood'?'#80583d':role.role==='recess'?'#3c6575':role.role==='bronze'?'#b99351':role.role==='teal'?'#478dab':'#e7d9b7';
   if(role.role==='stone'&&!structure){const group=o.parent?.name||o.name;colour=walls[hash(group+o.name)%walls.length];}
   if(/window.*(frame|trim|surround)|white.*window/.test(names))colour='#f7f2df';
   const key=colour+':'+source.side;
   if(!cache.has(key)){const m=new THREE.MeshStandardMaterial({name:'citadel-townscaper-plaster-'+colour.slice(1),color:colour,roughness:.91,metalness:role.role==='lead'?.06:0,side:source.side});m.userData.citadelTargetArchitecture={revision:1,role:role.role};cache.set(key,m);}
   counts[colour]=(counts[colour]||0)+1;entries.push({name:o.name,source:source.name,role:role.role,structure,colour});return cache.get(key);
  };
  const original=o.material,next=Array.isArray(original)?original.map(replace):replace(original);if(next!==original){originals.push([o,original]);o.material=next;}
 });
 const report={revision:1,mode:'material-only; no architecture geometry claim',meshes:originals.length,counts,entries,materials:cache.size,protectedProps:'material ownership and city semantic classifier'};
 root.userData.townscaperTargetMaterials=report;return report;
}
