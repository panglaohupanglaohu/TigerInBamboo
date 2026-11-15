/**
 * view-c11-grassline.js — 第 56 批 C11 · 1590674061092212738（?c11=grassline，默认关）
 * 原文："In the vertex shader, my grass gets to sample that contrast texture both where they stand, and also raycast into the
 *  background. The outline strength is determined by the difference between these two samples! Not perfect, but pretty good!
 *  Not too jittery when turning the camera"
 * 画面（181 帧）：反差纹理诊断配色的多层岛环绕；草卡在与背景同区的地方几乎没有轮廓，站在台地沿口、背后是下层/崖壁/海的
 *  草卡才有深色外轮廓，轮廓随镜头转动跟着背景变。
 *
 * 做法：core/c11-maps.js bakeContrastHeightMap（共享 World 反差求解 → XZ 图 RGB + 顶高 A）；Vegetation 草卡 ShaderMaterial
 *  链一个 onBeforeCompile：顶点着色器里 glOutline(origin) = 站立处采样 vs 沿镜头射线步进到高度场命中处采样的差 → vEdge；
 *  片元外轮廓墨线乘 smoothstep(vEdge)（关时 uGL=0 → vEdge = 原静态 aEdge、外轮廓不乘，逐像素等于旧画面）。
 *  debug(on)：顺带打开 r55 ?shade=contrasttex，让地面显示反差纹理配色（片子的诊断画面）。
 */
import * as THREE from 'three';
import { bakeContrastHeightMap, GRASSLINE_VERT_PARS } from '../core/c11-maps.js';

const MIXC = 'c = mix(c, vCol * 0.38 * uLight, ink);';
const OUTER = 'float ink = uInk * max(1.0 - smoothstep(wOut * 0.6, wOut, -d),';
export function patchTuftShader(sh) {
  if (!sh.vertexShader.includes('vEdge = aEdge;') || !sh.fragmentShader.includes(OUTER)) throw new Error('grassline: tuft shader tokens');
  sh.vertexShader = sh.vertexShader.replace('void main() {', GRASSLINE_VERT_PARS + '\nvoid main() {')
    .replace('vEdge = aEdge;', 'vEdge = uGL > .5 ? glOutline(origin, TH * scale * .8) : aEdge;');
  if (!sh.fragmentShader.includes(MIXC)) throw new Error('grassline: tuft shader tokens');
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uGL; uniform float uGLDebug;\nvoid main() {')
    .replace(MIXC, MIXC + '\n        if (uGLDebug > .5) c = mix(vec3(.95), vec3(.85, .1, .1), vEdge);   // 诊断：描边强度（白 0 → 红 1）')
    .replace(OUTER, 'float ink = uInk * max((1.0 - smoothstep(wOut * 0.6, wOut, -d)) * (uGL > .5 ? smoothstep(.06, .4, vEdge) : 1.),');
  return sh;
}

export function install(view) {
  const veg = view.vegetation, mat = veg?.tufts?.material;
  if (!mat) throw new Error('grassline: no vegetation tufts');
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
  const u = { uGL: { value: 0 }, uGLMap: { value: blank }, uGLX: { value: new THREE.Vector4(0, 0, 1, 1) }, uGLMaxH: { value: 1 }, uGLGain: { value: 2.2 }, uGLDebug: { value: 0 } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, u); patchTuftShader(sh); };
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '+c11-grassline';
  mat.needsUpdate = true;
  let version = -1, stats = {}, debugOn = false, ctPrev = null;
  const bake = () => {
    const w = view.town, t0 = performance.now(), m = bakeContrastHeightMap(w, view.index, { res: 256, levelHeight: view.levelHeight });
    const tex = new THREE.DataTexture(m.data, m.res, m.res); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
    u.uGLMap.value?.dispose?.(); u.uGLMap.value = tex; u.uGLX.value.set(m.minX, m.minZ, 1 / m.span, 1 / m.span); u.uGLMaxH.value = m.maxH;
    version = w.version; stats = { res: m.res, tris: m.tris, maxH: +m.maxH.toFixed(2), sameDE: +m.after.sameDE.toFixed(2), contrastDE: +m.after.contrastDE.toFixed(2), bakeMs: Math.round(performance.now() - t0) };
    api.map = m;
  };
  const api = {
    u, map: null,
    set(on) { u.uGL.value = on ? 1 : 0; if (on && version !== view.town.version) bake(); if (!on && debugOn) api.debug(false); },
    update() { if (u.uGL.value && version !== view.town.version) bake(); },
    /** 诊断画面（片子那样）：地面显示反差纹理配色（借 r55 view.shading 的 contrasttex），草卡按描边强度着色（白 0 → 红 1）。 */
    debug(on) { if (on && !debugOn) { ctPrev = view.shading?.on?.contrasttex ?? false; view.setDebug('contrasttex', true); } if (!on && debugOn) view.setDebug('contrasttex', ctPrev); debugOn = !!on; u.uGLDebug.value = debugOn ? 1 : 0; },
    stats: () => ({ ...stats, tufts: veg.tufts.count }),
  };
  return api;
}
