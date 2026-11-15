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
 // 2026-11-08 主人要求：书店镇一带整体调暗 —— 环境光 / 天空半球光 ×0.7，主日光等平行光 ×0.8（书店镇自己的路灯不动）。
 // 环境光是全局灯，按镜头离书店镇的远近渐变：书店镇 90 米内全量调暗，135 米外不变。昼夜控制器每帧先写正常强度，
 // 这里记住自己上一帧写的值；若这一帧没人重写，就按记下的原值算，避免越乘越暗。?bookshopAmbient=1 关闭（数值 0.3~1）。
 const AMB=(()=>{const v=Number(new URLSearchParams(globalThis.location?.search||'').get('bookshopAmbient'));return Number.isFinite(v)&&v>0?Math.min(1,Math.max(.3,v)):.7;})(),DIR=AMB<1?Math.min(1,.8+(AMB-.7)*.67):1;
 let ambLights=[],ambAt=-1e9;
 const nearAt=position=>{if(!root||!position)return 0;p.copy(position).setLength(160.9);root.worldToLocal(p);const depth=p.y+160.9;if(depth<50)return 0;const radius=Math.hypot(p.x*160.9/depth,p.z*160.9/depth-BOOKSHOP_SITE_OUTLINE.centerZ);return 1-THREE.MathUtils.smoothstep(radius,90,135);};
 const dimAmbient=position=>{
  const now=performance.now();if(now-ambAt>10000){ambAt=now;ambLights=[];scene.traverse(o=>{if((o.isAmbientLight||o.isHemisphereLight||o.isDirectionalLight)&&o.layers.mask&1)ambLights.push(o);});}
  const w=nearAt(position),k=1-(1-AMB)*w,kd=1-(1-DIR)*w;
  for(const l of ambLights){const f=l.isDirectionalLight?kd:k;const ud=l.userData;const base=ud.bookshopDimWrote!==undefined&&Math.abs(l.intensity-ud.bookshopDimWrote)<1e-6?ud.bookshopDimBase:l.intensity;ud.bookshopDimBase=base;l.intensity=base*f;ud.bookshopDimWrote=l.intensity;}
  return k;
 };
 return {weightAt,nearAt,ambientScale:AMB,update(position,phase){
  if(AMB<1)dimAmbient(position);
  const weight=weightAt(position,phase);if(weight<=0)return;
  if(scene.background?.isColor)scene.background.lerp(mid,weight);
  if(scene.fog)scene.fog.color.lerp(mid,weight);
  if(skyMat){skyMat.uniforms.topColor.value.lerp(top,weight);skyMat.uniforms.midColor.value.lerp(mid,weight);skyMat.uniforms.botColor.value.lerp(bottom,weight);}
 }};
}
