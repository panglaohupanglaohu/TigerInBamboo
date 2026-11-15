/**
 * lightStyle.js — 系统工坊「球系统 · 光照与时间」的实景执行端（2026-11-09）。
 * 把「光照与时间」学习条目变成能调的旋钮。天气样式（weatherStyle.js）里的 light 字段交给这里执行：
 *   预览 / 对照 / 定稿 / 恢复都跟天气走同一条路（weatherStyle.set → apply(st.light)）。
 * 灯光强度 / 地面色 / 曝光只在每帧渲染期间乘系数，渲染完写回原值（别的系统看不到，不会互相累乘；系数 1 = 不动）。
 *
 * 旋钮 → 学习来源（逐条，做不到的照实写）
 *   sun        直射光强度                   1305951750638231552 长影 / 塔楼投影（真实投影，强度可调）
 *   soft       软阴影 0 硬边 · 1 很软         1305948413872267265 PCF 软阴影（切到 PCFShadowMap + shadow.radius；0 = 原来的硬边 Basic）
 *   shadows    投影开关                       1190191289922465793 逐顶点体素阴影（只学了：这里用的是真实阴影贴图，不是体素步进）
 *                                              1704218784028905984 / 1705195380457996629 高度图阴影（只学了：2.5D 近似，游戏里没有地表高度图）
 *   ambient    天光 / 环境光强度               1791049306213912823 天空光（半球光）
 *   bounce     地面反弹光的颜色量（暖土红）     1237305125070426112 红墙反红到白墙（近似：整体地面反弹色，不是逐面传光）
 *                                              1580835075629133825 / 1580846877855338497 / 1580845127207387137 / 1582757294672314368 体素 GI 多次反弹
 *                                              （只学了：游戏里没有 GI 体积，用半球光地面色近似「反弹偏色」）
 *   ao         体素 AO 强度                    1168168400155267072 / 1168571866405097472 / 793557992931266561
 *                                              （游戏已有 K3 体素 AO，但默认没开：需 ?oskLightingV1=1&voxelAoV1=1；没开时这个旋钮报告「未开」）
 *   ink / rim  圣城墨线粗细 / 逆光亮边强度       1017355723171344385 粗描边（REA OutlineLayers）· 1751945034851570056 逆光亮边
 *                                              929417420921556993 软硬法线混合（只学了：需要改所有材质的片元着色，未接）
 *   strata / rockCool 岩层纹理 / 崖面冷灰       1786014232594485497 山体按法线烘焙明暗 · 1480635131614355459 大块颜料斑（只在崖面，草面没做三档量化）
 *                                              1707490932017279035 纯纹理灌木、1063115611289645057 坡面草更密（只学了：游戏的草和灌木不是这套，未接）
 *   view       0 正常 · 1 只看光照 · 2 只看贴图（不打光）   1313841094069817344 / 1298689301488775169（AO 烘焙网格可视化没做）
 *   saturation / exposure 饱和度 / 曝光         1197909675443916803 显示器饱和度纠偏（画布 CSS saturate，不改材质）
 *   798580832906739712 是寻路开阔度，被误分到光照，不做。
 */
import * as THREE from 'three';

export const DEFAULT_LIGHT = Object.freeze({ sun: 1, soft: 0, shadows: 1, ambient: 1, bounce: 0, ao: null, ink: 1, rim: 1, strata: null, rockCool: null, view: 0, saturation: 1, exposure: 1 });
const BOUNCE = new THREE.Color(0xc0704a);   // 暖土红（白墙旁红墙那种偏色）

export function installLightStyle({ scene, renderer, sun, ambient, hemi, fill, getVoxelAo = () => null }) {
  let st = { ...DEFAULT_LIGHT };
  // 只在这一帧渲染期间改：渲染前乘上系数，渲染完把原值写回。别的系统（圣城暮色、书店镇环境光、灯光导演）永远看不到我们的改动，
  // 不会和它们的追踪值互相累乘；系数回到 1 就等于没改。
  const saved = [];
  const scaled = (obj, key, s) => { if (s === 1) return; saved.push([obj, key, obj[key]]); obj[key] *= s; };
  const tinted = (col, target, amt) => { if (amt <= 0) return; saved.push([col, null, col.clone()]); col.lerp(target, amt); };
  const dirLights = () => { const out = []; scene.traverse((o) => { if (o.isDirectionalLight && o !== fill) out.push(o); }); return out; };
  let lightsCache = [], lightsAt = -1e9;

  // 软阴影：只在 soft > 0 时切到 PCF（切换会让材质重编一次）；0 时回到原来的 Basic 硬边
  const origShadowType = renderer.shadowMap.type, origRadius = sun?.shadow?.radius ?? 1, origCast = sun?.castShadow ?? true;
  const applyShadows = () => {
    const want = st.soft > 0.001 ? THREE.PCFShadowMap : origShadowType;
    if (renderer.shadowMap.type !== want) { renderer.shadowMap.type = want; renderer.shadowMap.needsUpdate = true; }
    if (sun?.shadow) { sun.shadow.radius = st.soft > 0.001 ? 1 + st.soft * 7 : origRadius; sun.shadow.blurSamples = 8 + Math.round(st.soft * 16); }
    if (sun) sun.castShadow = st.shadows >= 0.5 ? origCast : false;
  };

  // 视图：只看光照 / 只看贴图。逐网格换材质（天空、水、云这些自定义着色器不动），换回时原样还原
  const swapped = new Map(); let viewAt = -1e9, viewMode = 0;
  const greyMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  const albedoCache = new WeakMap();
  const albedoOf = (m) => { let a = albedoCache.get(m); if (!a) { a = new THREE.MeshBasicMaterial({ color: m.color || 0xffffff, map: m.map || null, vertexColors: !!m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest }); albedoCache.set(m, a); } return a; };
  const lit = (m) => m && !m.isShaderMaterial && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial || m.isMeshPhysicalMaterial);
  const applyView = () => {
    if (viewMode === 0) { for (const [o, m] of swapped) o.material = m; swapped.clear(); return; }
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      const orig = swapped.get(o) ?? o.material; if (Array.isArray(orig) || !lit(orig)) return;
      if (!swapped.has(o)) swapped.set(o, orig);
      o.material = viewMode === 1 ? greyMat : albedoOf(orig);
    });
  };

  const prevAfter = scene.onAfterRender;
  scene.onAfterRender = function (...a) {
    for (let i = saved.length - 1; i >= 0; i--) { const [o, k, v] = saved[i]; if (k === null) o.copy(v); else o[k] = v; }
    saved.length = 0;
    prevAfter?.apply(this, a);
  };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) {
    prev?.apply(this, a);
    for (let i = saved.length - 1; i >= 0; i--) { const [o, k, v] = saved[i]; if (k === null) o.copy(v); else o[k] = v; }   // 上一帧没走到 onAfterRender 时先还原
    saved.length = 0;
    const now = performance.now();
    if (now - lightsAt > 2000) { lightsAt = now; lightsCache = dirLights(); }
    for (const L of lightsCache) scaled(L, 'intensity', st.sun);
    if (ambient) scaled(ambient, 'intensity', st.ambient);
    if (hemi) { scaled(hemi, 'intensity', st.ambient); tinted(hemi.groundColor, BOUNCE, Math.min(1, st.bounce) * 0.75); }
    if (fill) scaled(fill, 'intensity', st.ambient);
    scaled(renderer, 'toneMappingExposure', st.exposure);
    globalThis.__tmCitadelInk?.setStyle?.({ thickness: st.ink, rim: st.rim });   // 墨线可能比样式晚装好，每帧补上
    if (st.view !== viewMode || (viewMode && now - viewAt > 3000)) { viewMode = st.view; viewAt = now; applyView(); }
  };

  const report = () => {
    const vao = getVoxelAo();
    return {
      sun: st.sun, soft: st.soft, shadowType: renderer.shadowMap.type === THREE.PCFShadowMap ? 'PCF 软阴影' : '硬边', shadows: !!sun?.castShadow,
      ambient: st.ambient, bounce: st.bounce,
      ao: vao ? `体素 AO 强度 ${vao.getDebugInfo?.().strength ?? '?'}` : '体素 AO 未开（需 ?oskLightingV1=1&voxelAoV1=1）',
      ink: globalThis.__tmCitadelInk ? `墨线 ×${st.ink} · 亮边 ×${st.rim}` : '圣城墨线未装（离圣城太远或未建好）',
      rock: globalThis.__tmRockStrata ? `岩层 ${globalThis.__tmRockStrata.uniforms.uTmStrata.value} · 冷灰 ${globalThis.__tmRockStrata.uniforms.uTmRockCool.value}` : '岩层未装',
      view: ['正常', '只看光照', '只看贴图'][st.view] + (swapped.size ? `（换了 ${swapped.size} 个网格）` : ''), saturation: st.saturation, exposure: st.exposure,
    };
  };
  const rock0 = globalThis.__tmRockStrata ? { s: globalThis.__tmRockStrata.uniforms.uTmStrata.value, c: globalThis.__tmRockStrata.uniforms.uTmRockCool.value } : null;
  const api = {
    defaults: () => ({ ...DEFAULT_LIGHT }),
    apply(light = {}) {
      st = { ...DEFAULT_LIGHT, ...light };
      st.view = Math.max(0, Math.min(2, Math.round(st.view || 0)));
      applyShadows();
      const vao = getVoxelAo(); if (vao?.uniforms?.uVoxelAoStrength && st.ao != null) vao.uniforms.uVoxelAoStrength.value = st.ao;
      globalThis.__tmCitadelInk?.setStyle?.({ thickness: st.ink, rim: st.rim });
      if (globalThis.__tmOutlineRim) globalThis.__tmOutlineRim.uTmRimPx && (globalThis.__tmOutlineRim.uTmRimPx.value = 3 * st.rim);
      const R = globalThis.__tmRockStrata;
      if (R) { const b = rock0 || { s: 1, c: 0.6 }; R.uniforms.uTmStrata.value = st.strata ?? b.s; R.uniforms.uTmRockCool.value = st.rockCool ?? b.c; }
      renderer.domElement.style.filter = Math.abs(st.saturation - 1) > 0.01 ? `saturate(${st.saturation})` : '';
      return report();
    },
    state: report,
  };
  globalThis.__tmLightStyle = api;
  return api;
}
