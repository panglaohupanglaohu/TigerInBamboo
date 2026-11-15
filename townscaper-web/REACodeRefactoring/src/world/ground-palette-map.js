/**
 * ground-palette-map.js — 第 56 批 C11：把「每格一个离散颜色」的结果（调色图 palette-graph / 色体网格 color-volume-grid）
 * 贴到共享 View 主材质上。默认关；不改 view.js —— 链在 view.material 已有的 onBeforeCompile 后面（同 view-shading.js 做法）。
 *
 *   const gpm = attachGroundPaletteMap(view);
 *   gpm.setCellColors({ top: Float32Array(cells*3), wall?: Float32Array(cells*3), feature?: string[] }); gpm.set(true);
 *
 * 世界 XZ 栅格（Nearest，按 view.index.cellAt 落格）：top 图 A 通道 = 特征码（0 无，1 地面类，2 Roof），wall 图 A=255 有效。
 * 着色：地形顶面（vField.z∈(.5,1.5) 且朝上）→ top 色；岩壁（vField.z<−.5）→ wall 色；建筑朝上面且特征是 Roof → top 色。
 * 颜色按 sRGB 存、片元转线性，和 View 其他取色同口径。关掉（uGPM=0）时与原画面逐像素一致（分支不进）。
 */
import * as THREE from 'three';

const PARS = /* glsl */`
uniform float uGPM; uniform sampler2D uGPMTop; uniform sampler2D uGPMWall; uniform vec4 uGPMX; uniform float uGPMWallOn;
vec3 gpmLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
`;
const BODY = /* glsl */`
if(uGPM>.5){vec2 gpmUV=(vWPos.xz-uGPMX.xy)*uGPMX.zw;
  if(gpmUV.x>=0.&&gpmUV.y>=0.&&gpmUV.x<=1.&&gpmUV.y<=1.){vec4 gT=texture2D(uGPMTop,gpmUV);
    if(vField.z>.5&&vField.z<1.5&&vUp>.6&&gT.a>.1)diffuseColor.rgb=gpmLin(gT.rgb);
    else if(abs(vField.z)<.5&&vUp>.3&&gT.a>.6)diffuseColor.rgb=gpmLin(gT.rgb);
    else if(uGPMWallOn>.5&&vField.z< -.5){vec4 gW=texture2D(uGPMWall,gpmUV);if(gW.a>.5)diffuseColor.rgb=gpmLin(gW.rgb);}}}
`;

const blank = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t.needsUpdate = true; return t; };
function bounds(world, pad = 0.5) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of world.cells) for (const p of c.pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  minX -= pad; minZ -= pad; return { minX, minZ, span: Math.max(maxX - minX, maxZ - minZ) + pad };
}

/** 纯 CPU：每格颜色 → 世界 XZ 栅格（测试可直接调）。 */
export function rasterCellColors(world, index, { top, wall = null, feature = null }, res = 320) {
  const B = bounds(world), T = new Uint8Array(res * res * 4), W = new Uint8Array(res * res * 4); let hits = 0;
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
    const c = index.cellAt(B.minX + (x + 0.5) * B.span / res, B.minZ + (z + 0.5) * B.span / res); if (!c || !world.top(c)) continue;
    const o = (z * res + x) * 4, i = c.id * 3;
    T[o] = Math.round(top[i] * 255); T[o + 1] = Math.round(top[i + 1] * 255); T[o + 2] = Math.round(top[i + 2] * 255); T[o + 3] = feature?.[c.id] === 'Roof' ? 255 : 128; hits++;
    if (wall) { W[o] = Math.round(wall[i] * 255); W[o + 1] = Math.round(wall[i + 1] * 255); W[o + 2] = Math.round(wall[i + 2] * 255); W[o + 3] = 255; }
  }
  return { res, top: T, wall: W, bounds: B, hits };
}

export function attachGroundPaletteMap(view, { res = 320 } = {}) {
  if (view.groundPaletteMap) return view.groundPaletteMap;
  const u = { uGPM: { value: 0 }, uGPMTop: { value: blank() }, uGPMWall: { value: blank() }, uGPMX: { value: new THREE.Vector4(0, 0, 1, 1) }, uGPMWallOn: { value: 0 } };
  const m = view.material, prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    Object.assign(shader.uniforms, u);
    if (!shader.fragmentShader.includes('#include <emissivemap_fragment>') || !shader.fragmentShader.includes('varying vec3 vWPos')) throw new Error('ground-palette-map: fragment tokens');
    // 插在 emissivemap 前（所有 color_fragment 链之后、光照之前）：开着时本层颜色最终生效，不被其他取色覆盖
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', PARS + '\nvoid main() {').replace('#include <emissivemap_fragment>', BODY + '\n#include <emissivemap_fragment>');
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '+gpm-c11';
  m.needsUpdate = true;
  const swap = (k, data) => { u[k].value.dispose(); const t = new THREE.DataTexture(data, res, res); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; u[k].value = t; };
  const api = {
    uniforms: u, stats: null,
    setCellColors(colors) {
      const r = rasterCellColors(view.town, view.index, colors, res);
      swap('uGPMTop', r.top); swap('uGPMWall', r.wall); u.uGPMWallOn.value = colors.wall ? 1 : 0;
      u.uGPMX.value.set(r.bounds.minX, r.bounds.minZ, 1 / r.bounds.span, 1 / r.bounds.span);
      api.stats = { res, hits: r.hits, wall: !!colors.wall, version: view.town.version }; return api.stats;
    },
    set(on) { u.uGPM.value = on ? 1 : 0; },
    get on() { return u.uGPM.value > 0.5; },
  };
  view.groundPaletteMap = api;
  return api;
}
