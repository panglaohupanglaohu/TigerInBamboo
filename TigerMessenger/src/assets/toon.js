// =====================================================================
//  卡通渲染基础设施：Cel-shading 渐变贴图 + 反向壳描边
//  - 2 阶梯灰度 gradientMap：明暗交界彻底硬化（漫画感，无平滑渐变）
//  - addOutline：Inverse Hull 黑边（顶点沿法线外扩，背面渲染）
// =====================================================================
import * as THREE from "three";

let _gradient = null;

/** 2 阶梯渐变贴图（单例）：暗部 / 亮部，Nearest 采样锁死阴影边缘 */
export function getToonGradient() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([110, 255]); // 仅 2 个像素：暗 / 亮
  _gradient = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
  _gradient.minFilter = THREE.NearestFilter;
  _gradient.magFilter = THREE.NearestFilter;
  _gradient.generateMipmaps = false;
  _gradient.needsUpdate = true;
  return _gradient;
}

const _toonMatCache = new Map();

function _toonColorKey(color) {
  if (color == null) return "null";
  if (typeof color === "number") return color.toString(16);
  if (color && typeof color.getHexString === "function") return color.getHexString();
  return String(color);
}

function _toonOptsKey(opts) {
  return Object.keys(opts)
    .sort()
    .map((k) => {
      const v = opts[k];
      if (v == null) return "";
      if (v && v.isColor) return `${k}=${v.getHexString()}`;
      if (v && v.isTexture) return `${k}=tex:${v.uuid}`; // 贴图按实例缓存（罕见）
      const t = typeof v;
      if (t === "number" || t === "string" || t === "boolean") return `${k}=${v}`;
      return `${k}=${String(v)}`;
    })
    .join("|");
}

/** 统一卡通材质（硬边 Cel-shading）· 按 (颜色,选项) 缓存，避免数千个重复 MeshToonMaterial 实例 */
export function toonMat(color, opts = {}) {
  const { flatShading, ...materialOptions } = opts;
  // MeshToonMaterial 不是 PBR 材质，不支持 metalness / roughness；
  // 过滤掉兼容 StandardMaterial 的遗留参数，避免 Three.js 控制台告警。
  delete materialOptions.metalness;
  delete materialOptions.roughness;
  const key = `${_toonColorKey(color)}|${flatShading ? "flat" : "smooth"}|${_toonOptsKey(materialOptions)}`;
  let material = _toonMatCache.get(key);
  if (!material) {
    material = new THREE.MeshToonMaterial({
      color,
      gradientMap: getToonGradient(),
      ...materialOptions,
    });
    if (flatShading !== undefined) {
      material.flatShading = flatShading;
      material.needsUpdate = true;
    }
    // 共享材质：多处复用，禁止被 dispose 释放（否则圣城重建/场景卸载会
    // 把仍在缓存里、之后还要复用的材质 GPU 资源释放掉，导致白模）。
    material.userData.shared = true;
    material.dispose = () => {};
    _toonMatCache.set(key, material);
  }
  return material;
}

const _outlineMatCache = new Map();
/**
 * 逆光亮边（学习工坊 1751945034851570056："another inverted mesh outline layer that shows up when looking into the sun,
 * masked by shadows"；REACodeRefactoring src/world/outline.js）。这里不另加一层外壳，而是让现有墨线外壳在逆光时
 * 迎光一侧变成暖亮边：强度 = 镜头朝向太阳的程度 × 法线偏向太阳 × 不朝下（朝下视为在阴影里，按星球局部「上」算）。
 * 所有描边材质共用这组 uniform；uTmRimAmt 默认 0（和原来完全一样），由区域调色（例如高山圣城暮色）按需打开。
 */
export const OUTLINE_RIM = {
  uTmRimSun: { value: new THREE.Vector3(0, 1, 0) },
  uTmRimAmt: { value: 0 },
  uTmRimColor: { value: new THREE.Color(0xffd3a4) },
  uTmRimPx: { value: 3.0 },                               // 亮边按屏幕像素外扩（远近一样粗，REACodeRefactoring outline.js uWidth 3.2）
  uTmRes: { value: new THREE.Vector2(1280, 720) },        // 画布像素尺寸（由调用方每帧更新）
};
globalThis.__tmOutlineRim = OUTLINE_RIM;

/**
 * 反向壳描边：同一几何体作为子网格，顶点沿法线外扩 thickness，
 * 纯黑（深藏青）不受光 MeshBasicMaterial + BackSide 只渲染背面。
 * 作为 mesh 子节点，自动继承位移/旋转/缩放。
 */
/**
 * 描边厚度（世界单位外扩）· 按资产类型
 * 远景/树冠更细，减缩放后闪烁
 */
export const OUTLINE = Object.freeze({
  character: 0.018,
  characterDetail: 0.01,
  house: 0.014,
  treeTrunk: 0.011,
  treeCrown: 0.008,
  rock: 0.01,
  prop: 0.009,
  street: 0.01,
  far: 0.006,
});

/**
 * 飞白强度（0=中锋饱满，越大越枯）
 * 角色少飞白，植被略枯，远景更少 discard 防闪
 */
export const OUTLINE_DRY = Object.freeze({
  character: 0.04,
  characterDetail: 0.03,
  house: 0.06,
  treeTrunk: 0.07,
  treeCrown: 0.05,
  rock: 0.08,
  prop: 0.05,
  street: 0.05,
  far: 0.03,
});

/** 松烟墨色（暖黑，非冷蓝黑） */
export const INK_COLOR = 0x211e19;

/** 斯瓦尔博娃圣城：灰蓝铅笔细勾，不污染全局墨线默认值 */
export const SVARBOVA_OUTLINE_COLOR = 0x5d6d7e;
export const SVARBOVA_OUTLINE_THICKNESS = 0.025;

/**
 * 反向壳描边 · 毛笔笔意版：
 *  - 提按：顶点噪声调制宽度 0.65x~1.25x（略收敛，防抖）
 *  - 松烟墨：默认 INK_COLOR
 *  - 飞白：片元 discard，dry 按类型
 * @param {THREE.Mesh} mesh
 * @param {number} [thickness]
 * @param {number} [color]
 * @param {number} [dry]
 */
export function addOutline(
  mesh,
  thickness = OUTLINE.prop,
  color = INK_COLOR,
  dry = OUTLINE_DRY.prop
) {
  const key = `${thickness.toFixed(4)}_${color.toString(16)}_${dry.toFixed(3)}`;
  let mat = _outlineMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, OUTLINE_RIM);
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec3 vBrushPos;\nvarying float vTmRim;\nuniform vec3 uTmRimSun;\nuniform float uTmRimAmt;\nuniform float uTmRimPx;\nuniform vec2 uTmRes;\nvoid main() {\n\tvec4 tmW = vec4(0.0); vec3 tmN = vec3(0.0, 1.0, 0.0);")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
\tvBrushPos = position;
\tfloat tmHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
\ttransformed += normal * (${thickness.toFixed(4)} * (0.65 + 0.6 * tmHash));
\tvTmRim = 0.0;
\tif (uTmRimAmt > 0.001) {
\t\ttmW = vec4(transformed, 1.0); tmN = normal;
\t\t#ifdef USE_INSTANCING
\t\ttmW = instanceMatrix * tmW; tmN = mat3(instanceMatrix) * tmN;
\t\t#endif
\t\ttmW = modelMatrix * tmW; tmN = normalize(mat3(modelMatrix) * tmN);
\t\tfloat tmInto = clamp(dot(normalize(tmW.xyz - cameraPosition), uTmRimSun), 0.0, 1.0);
\t\tfloat tmFacing = clamp(dot(tmN, uTmRimSun) * 0.8 + 0.35, 0.0, 1.0);
\t\tfloat tmLit = clamp(dot(tmN, normalize(tmW.xyz)) * 0.6 + 0.6, 0.0, 1.0);
\t\tvTmRim = tmInto * tmFacing * tmLit;
\t}`
        )
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
\tif (uTmRimAmt > 0.001 && vTmRim > 0.05) {
\t\tvec4 tmClipN = projectionMatrix * viewMatrix * vec4(tmW.xyz + tmN * 0.05, 1.0);
\t\tvec2 tmDir = tmClipN.xy / tmClipN.w - gl_Position.xy / gl_Position.w;
\t\tfloat tmL = length(tmDir);
\t\tif (tmL > 1e-6) gl_Position.xy += (tmDir / tmL) * uTmRimPx * 2.0 / max(uTmRes, vec2(1.0)) * gl_Position.w * smoothstep(0.08, 0.6, vTmRim) * uTmRimAmt;
\t}`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying vec3 vBrushPos;\nvarying float vTmRim;\nuniform float uTmRimAmt;\nuniform vec3 uTmRimColor;\nvoid main() {")
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
\tfloat tmDry = fract(sin(dot(floor(vBrushPos * 36.0).xy, vec2(12.9898, 78.233))) * 43758.5453);
\tif (tmDry < ${dry.toFixed(3)}) discard;`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
\tdiffuseColor.rgb = mix(diffuseColor.rgb, uTmRimColor, smoothstep(0.08, 0.6, vTmRim) * uTmRimAmt);`
        );
    };
    _outlineMatCache.set(key, mat);
  }
  const outline = new THREE.Mesh(mesh.geometry, mat);
  outline.raycast = () => {};
  outline.userData.isOutline = true;
  mesh.add(outline);
  return outline;
}

/** 按类型一键描边 */
export function outlineAs(mesh, kind = "prop") {
  return addOutline(mesh, OUTLINE[kind] ?? OUTLINE.prop, INK_COLOR, OUTLINE_DRY[kind] ?? OUTLINE_DRY.prop);
}
