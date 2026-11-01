import * as THREE from 'three';
import {BOOKSHOP_SITE_OUTLINE} from './bookshopTownSite.js';

// A daytime coastal haze around this industrial district. The global day/night
// and Moebius controllers write their normal colors first on every frame, so
// leaving the district restores them without keeping a second palette state.
export function createBookshopAtmosphere({root,scene,skyMat}){
 const p=new THREE.Vector3(),top=new THREE.Color(0x789db6),mid=new THREE.Color(0xb9cbd3),bottom=new THREE.Color(0xdde0d9);
 const weightAt=(position,phase)=>{
  if(!root||!position)return 0;
  p.copy(position).setLength(160.9);root.worldToLocal(p);
  const depth=p.y+160.9;if(depth<50)return 0;
  const radius=Math.hypot(p.x*160.9/depth,p.z*160.9/depth-BOOKSHOP_SITE_OUTLINE.centerZ);
  const daylight=THREE.MathUtils.smoothstep(phase,.315,.38)*(1-THREE.MathUtils.smoothstep(phase,.62,.72));
  return (1-THREE.MathUtils.smoothstep(radius,90,135))*daylight*.88;
 };
 return {weightAt,update(position,phase){
  const weight=weightAt(position,phase);if(weight<=0)return;
  if(scene.background?.isColor)scene.background.lerp(mid,weight);
  if(scene.fog)scene.fog.color.lerp(mid,weight);
  if(skyMat){skyMat.uniforms.topColor.value.lerp(top,weight);skyMat.uniforms.midColor.value.lerp(mid,weight);skyMat.uniforms.botColor.value.lerp(bottom,weight);}
 }};
}
