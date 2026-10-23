import * as THREE from 'three';
// 湖沼镜头第二步（方案 docs/greg-team/SWAMP_CAMERA_PLAN.md 2.3）：挡在镜头与信使之间的树叶、树干“让路”。
// 仅在镜头→信使的局部开口让路，保留 opaque 深度，不改几何/碰撞。
// 不再将全部近镜植物变成规则网点；旧版可用 swampCamFadeLegacy=1 对照。
const FOLIAGE=/leaf|leaves|crown|frond|fern|foliage|vine|understory|pendant|canopy|palm|reed|grass|moss|trunk|branch|root|bark|tree/i;
// CPU counterpart to the clean aperture SDF. Negative fragments make way.
export function swampOcclusionApertureDistance(point,a,b,radius=1.15,weight=1,nearRadius=2.2){
  if(weight<=0)return Infinity;
  const ab=new THREE.Vector3().subVectors(b,a),offset=new THREE.Vector3().subVectors(point,a),raw=offset.dot(ab)/Math.max(ab.lengthSq(),1e-4),t=Math.max(0,Math.min(1,raw));
  const distance=offset.clone().addScaledVector(ab,-t).length(),beam=raw>=-.04&&raw<=.98?distance-radius*weight*(.60+.55*t):1e3;
  return Math.min(beam,offset.length()-nearRadius*weight);
}
export function installSwampOcclusionFade({swamp,enabled=new URLSearchParams(globalThis.location?.search||'').get('swampCamFade')!=='0',now=()=>globalThis.performance?.now?.()??Date.now()}={}){
  const legacy=new URLSearchParams(globalThis.location?.search||'').get('swampCamFadeLegacy')==='1';
  const nearRadius=new URLSearchParams(globalThis.location?.search||'').get('swampCamFadeNear')==='0'?.42:2.2;
  const report={enabled,version:legacy?2:nearRadius>.42?4:3,mode:legacy?'bayer-legacy':'clean-aperture',nearRadius,materials:0,meshes:0,active:false,weight:0};
  if(!enabled||!swamp)return {report,update(){}};
  const inner=swamp.userData?.inner||swamp;
  const U={uSwFadeA:{value:new THREE.Vector3()},uSwFadeB:{value:new THREE.Vector3()},uSwFadeR:{value:legacy?.9:1.15},uSwFadeNear:{value:nearRadius},uSwFadeOn:{value:0},uSwFadeMark:{value:0}};
  const patched=new Set();
  const FADE_GLSL=legacy?`float swFadeK=0.;if(uSwFadeOn>.5){vec3 ab=uSwFadeB-uSwFadeA;float t=clamp(dot(vSwFadeW-uSwFadeA,ab)/max(dot(ab,ab),1e-4),0.,1.);
          float d=length(vSwFadeW-(uSwFadeA+ab*t));float k=(1.-smoothstep(uSwFadeR*.7,uSwFadeR,d))*step(.02,t)*(1.-step(.96,t));
          float kl=1.-smoothstep(2.4,3.6,length(vSwFadeW-uSwFadeA));// leaves right at the lens make way too
          if(kl>.95)discard;k=max(k,kl);
          swFadeK=k;if(k>0.){ivec2 p=ivec2(mod(gl_FragCoord.xy,4.));int i=p.x+p.y*4;
            float b=float(i==0?0:i==1?8:i==2?2:i==3?10:i==4?12:i==5?4:i==6?14:i==7?6:i==8?3:i==9?11:i==10?1:i==11?9:i==12?15:i==13?7:i==14?13:5)/16.;
            if(b<.72*k)discard;}}`:`
      float swFadeK=0.;
      if(uSwFadeOn>.001){
        vec3 swAb=uSwFadeB-uSwFadeA,swOffset=vSwFadeW-uSwFadeA;
        float swRaw=dot(swOffset,swAb)/max(dot(swAb,swAb),1e-4),swT=clamp(swRaw,0.,1.);
        float swBeamDistance=length(swOffset-swAb*swT);
        float swBeam=swBeamDistance-uSwFadeR*uSwFadeOn*(.60+.55*swT);
        if(swRaw<-.04||swRaw>.98)swBeam=1e3;
        float swDistance=min(swBeam,length(swOffset)-uSwFadeNear*uSwFadeOn);
        // Pixel-sized marker only on the clean clip boundary for optional ink.
        // No screen grid, moving noise, partial dither or material transparency.
        float swEdge=max(fwidth(swDistance),.001);
        swFadeK=1.-smoothstep(-swEdge,swEdge,swDistance);
        if(swDistance<0.)discard;
      }`;
  const DECL='varying vec3 vSwFadeW;uniform vec3 uSwFadeA;uniform vec3 uSwFadeB;uniform float uSwFadeR;uniform float uSwFadeNear;uniform float uSwFadeOn;uniform float uSwFadeMark;';
  // The lake's screen-space ink shells (trunks, crowns) must fade with their surfaces, or a ghost outline stays behind.
  const patchInk=m=>{
    if(!m||patched.has(m)||m.name!=='greg-lake-screen-ink'||m.vertexShader.includes('vSwFadeW'))return;patched.add(m);
    Object.assign(m.uniforms,U);
    m.vertexShader=m.vertexShader.replace('varying float inkFade;','varying float inkFade;\nvarying vec3 vSwFadeW;').replace('vec4 viewPosition = modelViewMatrix * p;','vec4 viewPosition = modelViewMatrix * p;\n        vSwFadeW = (modelMatrix * p).xyz;');
    m.fragmentShader=m.fragmentShader.replace('varying float inkFade;','varying float inkFade;\n'+DECL).replace(/void main\(\) \{ if \(inkFade < 0\.01[^;]*discard;/,m=>m+'\n'+FADE_GLSL);
    m.needsUpdate=true;report.materials++;
  };
  const patch=m=>{
    if(!m||patched.has(m)||m.isShaderMaterial||m.isRawShaderMaterial)return;patched.add(m);
    const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile=(sh,r)=>{prev?.call(m,sh,r);Object.assign(sh.uniforms,U);
      // a material cloned after patching carries this wrapper twice: inject once only
      if(sh.vertexShader.includes('vSwFadeW'))return;
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSwFadeW;')
        .replace('#include <project_vertex>','#include <project_vertex>\n{vec4 swp=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nswp=instanceMatrix*swp;\n#endif\nvSwFadeW=(modelMatrix*swp).xyz;}');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+DECL)
        .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+FADE_GLSL)
        // 墨线后处理（swampInkPost.js）读 alpha=0 认出“正在让路”的抖动片元，不在它们周围描线。
        .replace('#include <opaque_fragment>','#include <opaque_fragment>\n'+(m.transparent?'':'if(uSwFadeMark>.5&&swFadeK>0.)gl_FragColor.a=0.;'));
    };
    m.customProgramCacheKey=()=>{const k=prevKey?prevKey():'';const t=(m.transparent?'|sw-fade-t':'|sw-fade')+(legacy?'':nearRadius>.42?'-aperture-v4':'-aperture-v3');return k.endsWith(t)?k:k+t;};m.needsUpdate=true;report.materials++;
  };
  inner.traverse(o=>{
    if(!o.isMesh)return;
    if(o.userData.isOutline){const pn=`${o.parent?.name||''} ${o.parent?.parent?.name||''}`;if(o.parent?.userData?.gregVisualRole==='foliage'||o.parent?.userData?.gregVisualRole==='bark'||FOLIAGE.test(pn))patchInk(o.material);return;}
    const n=`${o.name} ${o.parent?.name||''} ${o.parent?.parent?.name||''}`,role=o.userData.gregVisualRole;
    if(!(role==='foliage'||role==='bark'||FOLIAGE.test(n)))return;
    if(/tiger|whale|beluga|monkey|bird|fish|boat|courier/i.test(n))return;
    report.meshes++;for(const m of Array.isArray(o.material)?o.material:[o.material])patch(m);
  });
  let lastTime=null;
  return {report,uniforms:U,patch,update(camera,player,on,dtOverride){
    const time=now(),dt=dtOverride??(lastTime===null?1/60:Math.max(0,Math.min(.25,(time-lastTime)/1000)));lastTime=time;
    const target=on?1:0;
    U.uSwFadeOn.value=legacy?target:target+(U.uSwFadeOn.value-target)*Math.exp(-dt/(on?.16:.22));
    if(U.uSwFadeOn.value<.001)U.uSwFadeOn.value=0;
    report.weight=U.uSwFadeOn.value;report.active=report.weight>0;
    if(!on&&!report.active)return;
    // The camera position stays exact so nearby geometry cannot invade the lens;
    // only the aperture radius eases as the swamp profile enters or leaves.
    U.uSwFadeA.value.copy(camera.position);
    U.uSwFadeB.value.copy(player.position).addScaledVector(player.position.clone().normalize(),1.0);
  }};
}
