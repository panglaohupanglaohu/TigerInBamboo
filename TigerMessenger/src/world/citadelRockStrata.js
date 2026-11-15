// 高山圣城 / 十二门徒岩体的水平风化层理（2026-11-09，按目标图 citadel-target-20261024：「灰蓝石灰岩、细的不规则水平风化层线、几层宽岩阶」）。
// 不加几何，只给岩体材质加一段着色器：
//   学习工坊 1699146321318314094 "make the whole world wobbly, do the texturing math, then simply undo the wobble"
//     → 先按位置把「高度」抖一下再分层，层线是弯的、不死直；
//   学习工坊 1786014232594485497（山体贴图：明暗烘进颜色、不逐像素算法线）→ 每层一个随机明暗，层线略暗，只调颜色明度。
// 高度按星球半径方向算（小星球上「水平」= 等半径）；只加在陡的崖面上（平台顶面不加）。
// 每个岩体材质克隆一份再改，不影响别处共用这份材质的东西。?citadelStrata=0 关闭。
import * as THREE from 'three';

const NAME = /mountain-surface|rock-footing|rock-crags|backdrop-ridge|rock-shoulder|far-mountain|rock-support/i;
// uTmRockCool：岩石往灰蓝石灰岩偏一点（目标图），0 = 原色
export const STRATA = { uTmStrata: { value: 1 }, uTmPlanetR: { value: 161 }, uTmRockCool: { value: 0.6 } };

function patch(material) {
  const m = material.clone();
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    Object.assign(shader.uniforms, STRATA);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTmSW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 tmSW = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    tmSW = instanceMatrix * tmSW;
    #endif
    vTmSW = (modelMatrix * tmSW).xyz; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTmSW;\nuniform float uTmStrata;\nuniform float uTmPlanetR;\nuniform float uTmRockCool;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uTmStrata > 0.001) {
    vec3 tmUp = normalize(vTmSW);
    vec3 tmWN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float tmSteep = 1.0 - smoothstep(0.5, 0.85, abs(dot(tmWN, tmUp)));
    vec3 p = vTmSW;
    float wob = sin(dot(p, vec3(0.23, 0.17, 0.29))) * 0.55 + sin(dot(p, vec3(-0.61, 0.47, 0.38))) * 0.22;
    float layer = (length(p) - uTmPlanetR + wob) / 1.35;
    float tone = fract(sin(floor(layer) * 12.9898) * 43758.5453);
    float f = fract(layer), aa = clamp(fwidth(layer) * 1.5, 0.0, 0.5);
    float line = smoothstep(0.86 - aa, 0.95, f) * (1.0 - smoothstep(0.97, 1.0, f));
    float shade = 1.0 + (tone - 0.5) * 0.10 - line * 0.2 * (1.0 - aa * 1.6);
    diffuseColor.rgb *= mix(1.0, shade, tmSteep * uTmStrata);
    float tmLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(tmLum), diffuseColor.rgb, 0.55) * vec3(0.93, 0.98, 1.1), uTmRockCool * uTmStrata * tmSteep);   // 只偏崖面，平台上的草不动
  }`);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|tm-strata-1';
  m.userData = { ...material.userData, tmStrata: true };
  return m;
}

export function installCitadelRockStrata({ getRoots, radius = 161 }) {
  if (new URLSearchParams(globalThis.location?.search || '').get('citadelStrata') === '0') return { update() {}, count: 0 };
  STRATA.uTmPlanetR.value = radius;
  const done = new WeakMap();   // 原材质 → 补丁后的材质（同一材质的多个网格共用同一份补丁）
  let count = 0, at = -1e9;
  const scan = () => {
    for (const root of getRoots() || []) root?.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline || o.userData.tmStrataDone) return;
      const name = o.name || o.parent?.name || '';
      if (!NAME.test(name)) return;
      const swap = (mat) => {
        if (!mat || mat.userData?.tmStrata || !(mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshToonMaterial || mat.isMeshPhongMaterial)) return mat;
        let p = done.get(mat); if (!p) { p = patch(mat); done.set(mat, p); }
        return p;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      o.userData.tmStrataDone = true; count++;
    });
  };
  scan();
  globalThis.__tmRockStrata = { uniforms: STRATA, get count() { return count; } };
  return {
    get count() { return count; },
    update() { const now = performance.now(); if (now - at > 10000) { at = now; scan(); } },   // 岩体有时会被后续模块重建，隔一会儿补一次
  };
}
