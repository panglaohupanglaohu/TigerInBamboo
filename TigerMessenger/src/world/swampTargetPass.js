import {attachScreenInk} from './swampGregVisuals.js';
// 湖沼目标图（artifacts/pipeline/swamp-target-20261010/TARGET_SPEC.md）落地的美术细节：
// 可走面（坑缘步道、三层岸台与坡、虎台阶、码头、入口补板）加屏幕宽度恒定的墨线外轮廓，
// 让“路”的边缘像莫比斯画里一样被一条线勾出来。
// 2026-10-10：外壳描线在贴水面的薄片上断断续续，改由 swampHandInk.js 沿顶面边缘画连续的线；本模块默认关闭，?swampTargetPass=1 才开。
export function applySwampTargetPass(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('swampTargetPass')==='1',width=1.7}={}){
  const report={enabled,version:1,outlineDraws:0,meshes:[]};
  if(!enabled||!swamp)return report;
  const u=(swamp.userData?.inner||swamp).userData;
  const walk=[...(u.gregCoralRim?.walkMeshes||[]),...(u.gregSpatialPlan?.walkMeshes||[]),...(u.tigerWalkSurfaces||[]),
    ...(u.gregShoreDock?.walkMeshes||[]),...(u.swampEntranceBridge?.walkMeshes||[])].filter(m=>m?.isMesh&&m.geometry?.attributes?.normal);
  for(const m of new Set(walk)){attachScreenInk(m,width,report);report.meshes.push(m.name||'(unnamed)');}
  // Cliff rock and the bowl wall: their silhouettes (rim lip, ledges against the water) get the same line.
  const inner=swamp.userData?.inner||swamp;
  for(const name of ['greg-natural-cliff-rock','swamp-sinkhole-wall']){const m=inner.getObjectByName(name);if(m?.isMesh&&m.geometry?.attributes?.normal){attachScreenInk(m,width*.9,report);report.meshes.push(name);}}
  // Thicken the existing trunk / crown ink a little so it reads at walking distance (0.85 -> 1.2 CSS px).
  inner.traverse(o=>{if(o.name==='greg-lake-outline'&&o.material?.uniforms?.pixelWidth&&o.parent&&!walk.includes(o.parent)){const prev=o.onBeforeRender;o.onBeforeRender=(r,...a)=>{prev?.call(o,r,...a);o.material.uniforms.pixelWidth.value*=1.2/.85;};report.thickened=(report.thickened||0)+1;}});
  return report;
}
