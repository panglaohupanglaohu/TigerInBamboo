import * as THREE from 'three';
// 湖沼目标图规则 3（TARGET_SPEC.md）：远近层次。湖沼里的材质随视距逐渐混入月夜空气色，
// 14 world 以内不变，60 world 处最多 35%。只作用于湖沼自己的材质（不碰全局雾与其他场景）。?swampHaze=0 关闭。
export function installSwampAirHaze({swamp,color='#a8bac6',near=18,far=70,amount=.20,
  enabled=new URLSearchParams(globalThis.location?.search||'').get('swampHaze')!=='0'}={}){
  const report={enabled,version:3,materials:0};
  if(!enabled||!swamp)return report;
  const inner=swamp.userData?.inner||swamp;
  const U={uSwHazeColor:{value:new THREE.Color(color)},uSwHaze:{value:new THREE.Vector3(near,far,amount)}};
  // 岩壁只混一半空气色：远处岩壁仍要比步道暗一档（目标图 rim/entrance 的步道—岩壁明度差）。
  const UW={uSwHazeColor:U.uSwHazeColor,uSwHaze:{value:new THREE.Vector3(near,far,amount*.5)}};
  // 树叶只混 45% 空气色：莫比斯的绿要浓艳，远处也不能洗成灰薄荷。
  const UF={uSwHazeColor:U.uSwHazeColor,uSwHaze:{value:new THREE.Vector3(near,far,amount*.45)}};
  const isLeaf=o=>o.userData.gregVisualRole==='foliage'||/leaf|leaves|crown|frond|fern|foliage|understory|pendant|canopy|palm|lobe/i.test((o.name||'')+' '+(o.parent?.name||''));
  const isWall=o=>o.userData.gregVisualRole==='wall'||/sinkhole-wall|cliff-rock|outer-cliff/.test(o.name||'');
  const done=new Set();
  inner.traverse(o=>{
    if(!o.isMesh||o.userData.isOutline)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(!m||done.has(m)||m.isShaderMaterial||m.isRawShaderMaterial||m.transparent&&m.opacity<.5)continue;done.add(m);const uni=isWall(o)?UW:isLeaf(o)?UF:U;
      const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey?.bind(m);
      m.onBeforeCompile=(sh,r)=>{prev?.call(m,sh,r);
        if(sh.fragmentShader.includes('uSwHazeColor'))return;
        if(!sh.vertexShader.includes('#include <project_vertex>')||!sh.fragmentShader.includes('#include <opaque_fragment>'))return;
        Object.assign(sh.uniforms,uni);
        sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vSwHazeD;').replace('#include <project_vertex>','#include <project_vertex>\nvSwHazeD=-mvPosition.z;');
        sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSwHazeD;uniform vec3 uSwHazeColor;uniform vec3 uSwHaze;')
          .replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,uSwHazeColor,smoothstep(uSwHaze.x,uSwHaze.y,vSwHazeD)*uSwHaze.z);\n#include <opaque_fragment>');
      };
      m.customProgramCacheKey=()=>{const k=prevKey?prevKey():'';return k.endsWith('|sw-haze')?k:k+'|sw-haze';};
      m.needsUpdate=true;report.materials++;
    }
  });
  return report;
}
