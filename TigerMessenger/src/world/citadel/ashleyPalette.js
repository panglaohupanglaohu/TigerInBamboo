import * as THREE from 'three';
// Color relationships from the user's eight reference images; not a painting/texture simulation.
export const ASHLEY_PALETTE=Object.freeze({bone:'#ded5b9',ivory:'#c9bea1',ochre:'#a58a58',rust:'#8f583e',olive:'#74765b',smoke:'#758b8c',shadow:'#45483f',ink:'#302c29'});
const skip=/soldier|trooper|horse|bird|crew|player|torch|glow|lamp|waterfall|water|cloud|light|particle|projectile/i;
export function applyAshleyPalette(root){
 if(!root||new URLSearchParams(location.search).get('ashleyPalette')==='0')return;
 const clones=new Map();let changed=0;
 root.traverse(o=>{
  if(!o.isMesh||o.userData.ashleyPalette||o.userData.isOutline)return;
  for(let a=o;a&&a!==root;a=a.parent)if(skip.test(a.name))return;
  const label=o.name+' '+(o.parent?.name||'');
  const role=/roof|dome|tile|wood|trunk/.test(label)?'rust':/leaf|tree|cypress|pine|shrub|grass|canopy|plant/.test(label)?'olive':/rock|cliff|terrain|mountain|ridge/.test(label)?'smoke':/window|niche|recess|dark/.test(label)?'shadow':/gold|brass|metal|finial/.test(label)?'ochre':/cloth|banner|flag/.test(label)?'smoke':'bone';
  const recolor=(c)=>{const h={};c.getHSL(h);if(h.l<.035)return new THREE.Color(ASHLEY_PALETTE.ink);const resolved=role==='bone'&&h.s>.25&&h.h<.105?'rust':role==='bone'&&h.s>.25&&h.h>.43&&h.h<.75?'smoke':role;const base=new THREE.Color(ASHLEY_PALETTE[resolved]);return base.multiplyScalar(.70+.30*Math.min(1,Math.sqrt(Math.max(0,h.l))));};
  const swap=m=>{if(!m?.color||m.isShaderMaterial)return m;const key=m.uuid+role;if(!clones.has(key)){const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;if(/roof|dome/.test(m.name)){c.color.set(ASHLEY_PALETTE.rust);}else if(c.vertexColors||c.map)c.color.set(0xddd5c2);else c.color.copy(recolor(m.color));if(c.emissive)c.emissive.multiplyScalar(.65);clones.set(key,c);}return clones.get(key);};
  o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);
  const vc=o.geometry?.attributes.color;if(vc){o.geometry=o.geometry.clone();const a=o.geometry.attributes.color,c=new THREE.Color();for(let i=0;i<a.count;i++){c.setRGB(a.getX(i),a.getY(i),a.getZ(i));const n=recolor(c);a.setXYZ(i,n.r,n.g,n.b);}a.needsUpdate=true;}
  o.userData.ashleyPalette=1;changed++;
 });
 root.userData.ashleyPaletteReport={changed,total:(root.userData.ashleyPaletteReport?.total||0)+changed};
}
