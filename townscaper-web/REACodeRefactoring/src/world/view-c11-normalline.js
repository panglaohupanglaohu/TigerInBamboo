/**
 * view-c11-normalline.js — 第 56 批 C11 · 1482011744843223042
 * "I'm creating pixel thin lines from contrasts in my procedural normal map. I should probably move to a bespoke contrast
 *  texture (to get more deliberate control over the lines)."
 * 画面（384 帧）：绿草顶 + 灰崖的岛转镜；草面是一块块明暗不同的大笔触（程序化法线），笔触之间、崖面竖条之间、草/崖交界
 * 有一像素宽的深色细线；岛对背景的剪影没有粗描边（线只来自法线反差，不来自深度）。
 *
 * 已有：r55 ?shade=paintnormal（主材质按大笔触法线图扰动着色法线）、?fx=outline（ScreenOutlinePass，法线遍用几何法线）。
 * 缺：描边的线源不是"程序化法线图"。本开关（?c11=normalline）：
 *   ① 打开 paintnormal（着色）与 outline（后处理），outline 改成只用法线反差（uDepthMix 0，原文的"from contrasts in my
 *      procedural normal map"，所以剪影不另加描边）；
 *   ② 法线遍换成本文件的材质：在 MeshNormalMaterial 的 normal_fragment_maps 处做与主材质完全相同的扰动（同一张法线图
 *      uniform、同一投影/切线空间），所以法线缓冲里笔触之间是硬跳变 → 合成里一像素细线；
 *   ③ 合成的法线边阈值换成 uniform（默认 0.55–0.98 是给几何折痕的；笔触法线最大倾 26°，相邻笔触 1−n·n' ≈ 0.02–0.35），
 *      开时 uNdLo/uNdHi = 0.025/0.09，关时还原原着色器字符串，outline-pass.js 默认行为不变。
 *   ④ 世界 y < 海面（0.03）的片元在法线遍里写平法线：海面、水下倒影不出线（片子海面干净）。
 * 关：还原法线遍材质、合成着色器、uDepthMix，并把本开关打开的 paintnormal / outline 按打开前状态还原。
 */
import * as THREE from 'three';

const PN_GLSL = /* glsl */`
if (vC11Pos.y < uC11SeaY) normal = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);   // 海面/水下倒影：法线缓冲里平的，不出线（片子海面无线）
else if (uShPN > 0.) {
  vec3 shN = normalize((vec4(normal, 0.) * viewMatrix).xyz), shA = abs(shN);
  vec2 shUV = shA.y >= shA.x && shA.y >= shA.z ? vC11Pos.xz : shA.x >= shA.z ? vC11Pos.zy : vC11Pos.xy;
  vec3 shT = texture2D(uShPNMap, shUV / uShPNScale).xyz * 2. - 1.; shT.xy *= uShPN; shT = normalize(shT);
  vec3 shR = abs(shN.x) < .99 ? vec3(1., 0., 0.) : vec3(0., 0., 1.), shTa = normalize(shR - shN * dot(shR, shN)), shB = cross(shTa, shN);
  normal = normalize((viewMatrix * vec4(normalize(shTa * shT.x + shB * shT.y + shN * shT.z), 0.)).xyz);
}`;

export function nearestCopy(src) {
  if (!src?.image?.data) return src;
  const t = new THREE.DataTexture(src.image.data, src.image.width, src.image.height, src.format, src.type);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
/** 法线遍材质：MeshNormalMaterial + 与主材质同一套大笔触法线扰动（共用 view.shading 的 uniform 对象）。 */
export function paintedNormalMaterial(shadingUniforms, { seaY = 0.03 } = {}) {
  const m = new THREE.MeshNormalMaterial(), uSea = { value: seaY };
  m.userData.uC11SeaY = uSea;
  // 法线遍用同一张法线图的最近邻副本：线性过滤把笔触交界摊到 2–3 像素，每像素法线差太小、出不了一像素线；
  // 最近邻让交界在一个像素内跳变（主材质着色仍用线性那张，明暗块不变）。
  m.userData.uMap = { value: nearestCopy(shadingUniforms.uShPNMap.value) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uShPN = shadingUniforms.uShPN; sh.uniforms.uShPNMap = m.userData.uMap; sh.uniforms.uShPNScale = shadingUniforms.uShPNScale; sh.uniforms.uC11SeaY = uSea;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vC11Pos;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 c11w = vec4(transformed, 1.);\n#ifdef USE_INSTANCING\n c11w = instanceMatrix * c11w;\n#endif\n vC11Pos = (modelMatrix * c11w).xyz; }');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec3 vC11Pos; uniform float uC11SeaY; uniform float uShPN; uniform sampler2D uShPNMap; uniform float uShPNScale;\nvoid main() {')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + PN_GLSL);
  };
  m.customProgramCacheKey = () => 'c11-painted-normal';
  return m;
}

export const ND_TOKEN = 'smoothstep(0.55, 0.98, nd)';
export function patchCompositeSource(src) {
  if (!src.includes(ND_TOKEN)) throw new Error('normalline: composite token missing');
  return src.replace('uniform float uFade;', 'uniform float uFade;\nuniform float uNdLo;\nuniform float uNdHi;').replace(ND_TOKEN, 'smoothstep(uNdLo, uNdHi, nd)');
}

/**
 * 法线遍的三遍渲染（照 ScreenOutlinePass.render，多一条过滤）：没有 normal 属性的网格（草卡等自带顶点着色器摆位的
 * 物体）在覆盖材质下既摆不对位置、法线又是 NaN（读回全黑）——实测 terrain 场景里草卡这一张网格把整座岛的法线缓冲
 * 盖成黑色，地形上一条法线线都出不来（r55 ?fx=outline 也受影响，地形上的线其实来自别处）。开 normalline 时用这份 render；
 * 关时还原实例方法，outline-pass.js 本身不改。
 */
export function renderWithNormalFilter(pass, scene, camera) {
  const renderer = pass.renderer, prevTarget = renderer.getRenderTarget(), prevOverride = scene.overrideMaterial;
  pass.uniforms.uNear.value = camera.near; pass.uniforms.uFar.value = camera.far;
  pass.uniforms.uUpVS.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
  renderer.setRenderTarget(pass.colorTarget); renderer.clear(); renderer.render(scene, camera);
  const hidden = []; let noNormal = 0, outOfScope = 0;
  // 线源只在被勾选的材质上（默认 = 共享地形材质）。云/天空/远景/树卡一旦进了法线遍，会在天上和云边上画出一像素锯齿线
  // —— 原片天空、剪影、海面全是干净的，线只出现在岛的表面上。
  const only = pass.c11NormalOnly ?? null;
  scene.traverse((o) => {
    if (!o.visible) return;
    const m = o.material, see = Array.isArray(m) ? m[0] : m, lacks = o.isMesh && !o.geometry?.attributes?.normal;
    if (lacks) noNormal++;
    const scoped = only && o.isMesh && !only.has(see) && !(see && see.userData && see.userData.c11LineSource === true);
    if (scoped) outOfScope++;
    if ((o.userData && o.userData.overlayOnly) || o.isLine || o.isPoints || o.isSprite || (see && see.transparent && !see.depthWrite) || lacks || scoped) { o.visible = false; hidden.push(o); }
  });
  scene.overrideMaterial = pass.normalMaterial; renderer.setRenderTarget(pass.normalTarget); renderer.clear(); renderer.render(scene, camera);
  scene.overrideMaterial = prevOverride; for (const o of hidden) o.visible = true;
  renderer.setRenderTarget(prevTarget); renderer.render(pass.quadScene, pass.quadCamera);
  pass.c11NoNormalHidden = noNormal; pass.c11OutOfScope = outOfScope;
}

export function install(view) {
  const st = { on: false, prev: null, mat: null, ndLo: 0.025, ndHi: 0.09 };
  const api = {
    async set(on) {
      if (on === st.on) return;
      const pe = view.postExtras, sh = view.shading;
      if (!pe || !sh) throw new Error('normalline needs view.postExtras (r55 G2) and view.shading (r55 G1)');
      if (on) {
        st.prev = { paintnormal: !!sh.on.paintnormal, outline: !!pe.state?.outline };
        if (!st.prev.paintnormal) view.setDebug('paintnormal', true);
        pe.set('outline', true);
        const pass = pe.outlinePass;
        st.pass = pass; st.prevNormalMat = pass.normalMaterial;
        // r143：outline-pass.js 后来把硬编码阈值 smoothstep(0.55,0.98,nd) 换成了 uNormalThreshold uniform，
        // 旧的「字符串 patch 复合着色器」找不到 token 直接抛错（且已经把几何描边打开、没还原 → 天上/云边全是锯齿线）。
        // 现在直接设 pass 自己的 uniform，不碰着色器源码 → 天然幂等、无恢复残留。
        st.origFrag ??= pass.material.fragmentShader;
        st.prevFrag = st.origFrag; st.prevDepthMix = pass.uniforms.uDepthMix.value;
        st.prevThreshold ??= pass.uniforms.uNormalThreshold.value.clone();
        st.mat ??= paintedNormalMaterial(sh.u);
        pass.normalMaterial = st.mat;
        pass.uniforms.uNdLo = { value: st.ndLo }; pass.uniforms.uNdHi = { value: st.ndHi };
        pass.uniforms.uNormalThreshold.value.set(st.ndLo, st.ndHi);
        pass.uniforms.uDepthMix.value = 0;
        pass.c11NormalOnly = new Set([view.material]);
        st.prevRender = Object.prototype.hasOwnProperty.call(pass, 'render') ? pass.render : null;
        pass.render = (scene, camera) => renderWithNormalFilter(pass, scene, camera);
      } else {
        const pass = st.pass;
        if (st.prevRender) pass.render = st.prevRender; else delete pass.render;
        delete pass.c11NormalOnly;
        pass.normalMaterial = st.prevNormalMat; pass.material.fragmentShader = st.origFrag ?? st.prevFrag; pass.material.needsUpdate = true; pass.uniforms.uDepthMix.value = st.prevDepthMix;
        if (st.prevThreshold) pass.uniforms.uNormalThreshold.value.copy(st.prevThreshold);
        if (!st.prev.outline) pe.set('outline', false);
        if (!st.prev.paintnormal) view.setDebug('paintnormal', false);
      }
      st.on = on;
    },
    setThresholds(lo, hi) { if (!(lo >= 0 && hi > lo && hi <= 2)) throw new RangeError('normalline thresholds'); st.ndLo = lo; st.ndHi = hi; if (st.pass?.uniforms.uNdLo) { st.pass.uniforms.uNdLo.value = lo; st.pass.uniforms.uNdHi.value = hi; st.pass.uniforms.uNormalThreshold.value.set(lo, hi); } },
    stats() { return { on: st.on, ndLo: st.ndLo, ndHi: st.ndHi, depthMix: st.pass?.uniforms.uDepthMix.value ?? null, paintedNormalPass: !!st.pass && st.pass.normalMaterial === st.mat, paintScale: view.shading?.u.uShPNScale.value, noNormalHidden: st.pass?.c11NoNormalHidden ?? null, outOfScope: st.pass?.c11OutOfScope ?? null, scopeSize: st.pass?.c11NormalOnly?.size ?? 0 }; },
  };
  return api;
}
