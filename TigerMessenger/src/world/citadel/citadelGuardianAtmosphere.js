import * as T from 'three';
/** Render-only overlay. Restore every property after rendering, so both legacy
 * and directed lighting keep their original day/night and weather state. */
export function createCitadelGuardianAtmosphere({scene,skyMat,camera,getGuardian}={}){
 const lights=[];scene.traverse(o=>{if(o.isDirectionalLight||o.isHemisphereLight||o.isAmbientLight)lights.push(o);});
 const dark=new T.Color(0x263544),horizon=new T.Color(0x596775),flashColor=new T.Color(0xcbe3f7),cameraP=new T.Vector3();
 return {apply(){
  const guardian=getGuardian?.(),state=guardian?.stormState,origin=guardian?.storm?.group?.position;
  if(!state||!origin||state.intensity<.001&&state.flash<.001)return()=>{};
  camera.getWorldPosition(cameraP);const locality=1-T.MathUtils.smoothstep(cameraP.distanceTo(origin),100,220);
  const amount=state.intensity*locality,flash=state.flash*locality;if(amount+flash<.001)return()=>{};
  const restore=[];
  function color(c,target,k){if(!c?.isColor)return;const previous=c.clone();restore.push(()=>c.copy(previous));c.lerp(target,k).lerp(flashColor,flash*.65);}
  color(scene.background,horizon,amount*.92);color(scene.fog?.color,horizon,amount*.7);
  for(const name of['topColor','midColor','botColor','cloudColor'])color(skyMat?.uniforms?.[name]?.value,name==='topColor'?dark:horizon,amount*.9);
  for(const o of lights){if(!o.parent)continue;const previous=o.intensity;restore.push(()=>{o.intensity=previous;});o.intensity=previous*(1-amount*(o.isDirectionalLight ? .78 : .4))+flash*(o.isDirectionalLight?1.4:.55);}
  return()=>{for(let i=restore.length-1;i>=0;i--)restore[i]();};
 }};
}
