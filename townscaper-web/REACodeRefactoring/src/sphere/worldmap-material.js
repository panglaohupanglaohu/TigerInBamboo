/**
 * worldmap-material.js — r55: put the buildWorldMap texture ON the planet (engine/worldmap.js gap
 * "没作为贴图上到星球，纹理混合也没做"). Lookup is per fragment from the object-space direction
 * (no UV seam in the mesh; mipmaps off so the lon wrap has no derivative seam). Blending:
 * top faces (normal ≈ radial) take the map, walls keep their tile colour, with a smooth
 * transition; uMapMix = 0 restores the original material exactly.
 */
import * as THREE from 'three';
import { buildWorldMap, worldMapColors, WORLDMAP_GLSL } from './worldmap.js';
import { worldMapShoreColors } from './worldmap-shore.js';

/** opts.shore = true（第 56 批 C11）：改用岸缘配色（陆侧暗带 / 平行浪线 / 沙滩月牙 / 两色草块）；默认 r55 配色不变。 */
export function worldMapTexture(opts = {}) {
  const map = buildWorldMap(opts), col = opts.shore ? worldMapShoreColors(map, opts) : worldMapColors(map, opts);
  const tex = new THREE.DataTexture(col.rgba, map.w, map.h, THREE.RGBAFormat);
  // r154：配色 bytes 是 sRGB 作者值（与 worldMapColors 的 0..1 色板一致）。r160 的 DataTexture 默认
  // NoColorSpace（当线性数据用），而渲染器输出是 sRGB → 整颗星球被线性→sRGB 再提亮一次（海 (92,158,161)
  // 渲成灰蓝、草变粉绿），原片是高饱和的绿/青。这里补上标记，采样时 sRGB→线性。
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;   // data row 0 (north) sits at v = 0; the shader flips v accordingly
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { map, colors: col, texture: tex };
}

/** Patch a MeshStandardMaterial (vertexColors) to blend the world map onto top faces. */
export function attachWorldMap(material, texture, { mix = 1, walls = 0 } = {}) {
  const uniforms = { uWorldMap: { value: texture }, uMapMix: { value: mix }, uMapWalls: { value: walls } };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWmPos; varying vec3 vWmNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWmPos = position; vWmNrm = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWmPos; varying vec3 vWmNrm; uniform sampler2D uWorldMap; uniform float uMapMix; uniform float uMapWalls;\n${WORLDMAP_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 d = normalize(vWmPos); vec2 wuv = worldMapUV(d); wuv.y = 1.0 - wuv.y;   // DataTexture row 0 = north
        vec3 tc = texture2D(uWorldMap, wuv).rgb;
        float up = dot(normalize(vWmNrm), d), w = uMapMix * mix(uMapWalls, 1.0, smoothstep(0.55, 0.85, up));
        diffuseColor.rgb = mix(diffuseColor.rgb, tc, w); }`);
  };
  material.customProgramCacheKey = () => 'worldmap-r55';
  material.needsUpdate = true;
  return uniforms;
}
