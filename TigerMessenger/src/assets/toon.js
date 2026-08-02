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
export function addOutline(mesh, thickness = 0.02, color = 0x14202c) {
  const key = `${thickness.toFixed(4)}_${color.toString(16)}`;
  let mat = _outlineMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n\ttransformed += normal * ${thickness.toFixed(4)};`
      );
    };
    _outlineMatCache.set(key, mat);
  }
  const outline = new THREE.Mesh(mesh.geometry, mat);
  outline.raycast = () => {}; // 不参与拾取
  mesh.add(outline);
  return outline;
}
