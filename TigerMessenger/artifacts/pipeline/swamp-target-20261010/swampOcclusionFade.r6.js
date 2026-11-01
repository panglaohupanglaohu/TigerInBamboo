import * as THREE from 'three';
// 湖沼镜头第二步（方案 docs/greg-team/SWAMP_CAMERA_PLAN.md 2.3）：挡在镜头与信使之间的树叶、树干“让路”。
// 每个湖沼植物/树干材质加一个视线胶囊：镜头 → 信使胸口线段，半径 0.9 world；胶囊内的片元按 4×4 Bayer 抖动丢掉约 70%，
// 看起来像半透明，不排序、不进透明队列、不加绘制调用。只在湖沼镜头生效时打开。?swampCamFade=0 关闭。
const FOLIAGE=/leaf|leaves|crown|frond|fern|foliage|vine|understory|pendant|canopy|palm|reed|grass|moss|trunk|branch|root|bark|tree/i;
export function installSwampOcclusionFade({swamp,enabled=new URLSearchParams(globalThis.location?.search||'').get('swampCamFade')!=='0'}={}){
  const report={enabled,version:1,materials:0,meshes:0,active:false};
  if(!enabled||!swamp)return {report,update(){}};
  const inner=swamp.userData?.inner||swamp;
  const U={uSwFadeA:{value:new THREE.Vector3()},uSwFadeB:{value:new THREE.Vector3()},uSwFadeR:{value:.9},uSwFadeOn:{value:0}};
  const patched=new Set();
  const FADE_GLSL=`if(uSwFadeOn>.5){vec3 ab=uSwFadeB-uSwFadeA;float t=clamp(dot(vSwFadeW-uSwFadeA,ab)/max(dot(ab,ab),1e-4),0.,1.);
          float d=length(vSwFadeW-(uSwFadeA+ab*t));float k=(1.-smoothstep(uSwFadeR*.7,uSwFadeR,d))*step(.02,t)*(1.-step(.96,t));
          float kl=1.-smoothstep(2.4,3.6,length(vSwFadeW-uSwFadeA));// leaves right at the lens make way too
          if(kl>.95)discard;k=max(k,kl);
          if(k>0.){ivec2 p=ivec2(mod(gl_FragCoord.xy,4.));int i=p.x+p.y*4;
            float b=float(i==0?0:i==1?8:i==2?2:i==3?10:i==4?12:i==5?4:i==6?14:i==7?6:i==8?3:i==9?11:i==10?1:i==11?9:i==12?15:i==13?7:i==14?13:5)/16.;
            if(b<.72*k)discard;}}`;
  const DECL='varying vec3 vSwFadeW;uniform vec3 uSwFadeA;uniform vec3 uSwFadeB;uniform float uSwFadeR;uniform float uSwFadeOn;';
  // The lake's screen-space ink shells (trunks, crowns) must fade with their surfaces, or a ghost outline stays behind.
  const patchInk=m=>{
    if(!m||patched.has(m)||m.name!=='greg-lake-screen-ink'||m.vertexShader.includes('vSwFadeW'))return;patched.add(m);
    Object.assign(m.uniforms,U);
    m.vertexShader=m.vertexShader.replace('varying float inkFade;','varying float inkFade;\nvarying vec3 vSwFadeW;').replace('vec4 viewPosition = modelViewMatrix * p;','vec4 viewPosition = modelViewMatrix * p;\n        vSwFadeW = (modelMatrix * p).xyz;');
    m.fragmentShader=m.fragmentShader.replace('varying float inkFade;','varying float inkFade;\n'+DECL).replace('void main() { if (inkFade < 0.01) discard;','void main() { if (inkFade < 0.01) discard;\n'+FADE_GLSL);
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
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSwFadeW;uniform vec3 uSwFadeA;uniform vec3 uSwFadeB;uniform float uSwFadeR;uniform float uSwFadeOn;')
        .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+FADE_GLSL);
    };
    m.customProgramCacheKey=()=>{const k=prevKey?prevKey():'';return k.endsWith('|sw-fade')?k:k+'|sw-fade';};m.needsUpdate=true;report.materials++;
  };
  inner.traverse(o=>{
    if(!o.isMesh)return;
    if(o.userData.isOutline){const pn=`${o.parent?.name||''} ${o.parent?.parent?.name||''}`;if(o.parent?.userData?.gregVisualRole==='foliage'||o.parent?.userData?.gregVisualRole==='bark'||FOLIAGE.test(pn))patchInk(o.material);return;}
    const n=`${o.name} ${o.parent?.name||''} ${o.parent?.parent?.name||''}`,role=o.userData.gregVisualRole;
    if(!(role==='foliage'||role==='bark'||FOLIAGE.test(n)))return;
    if(/tiger|whale|beluga|monkey|bird|fish|boat|courier/i.test(n))return;
    report.meshes++;for(const m of Array.isArray(o.material)?o.material:[o.material])patch(m);
  });
  return {report,uniforms:U,patch,update(camera,player,on){
    U.uSwFadeOn.value=on?1:0;report.active=!!on;if(!on)return;
    U.uSwFadeA.value.copy(camera.position);
    U.uSwFadeB.value.copy(player.position).addScaledVector(player.position.clone().normalize(),1.0);
  }};
}
