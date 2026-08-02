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

/** 统一卡通材质（硬边 Cel-shading） */
export function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradient(),
    ...opts,
  });
}

const _outlineMatCache = new Map();

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
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying vec3 vBrushPos;\nvoid main() {")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
\tvBrushPos = position;
\tfloat tmHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
\ttransformed += normal * (${thickness.toFixed(4)} * (0.65 + 0.6 * tmHash));`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying vec3 vBrushPos;\nvoid main() {")
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
\tfloat tmDry = fract(sin(dot(floor(vBrushPos * 36.0).xy, vec2(12.9898, 78.233))) * 43758.5453);
\tif (tmDry < ${dry.toFixed(3)}) discard;`
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
