/**
 * view-mixed-persp.js — 1310503825510367232「mixed perspective」接主视图（第 56 批 C05）。
 *
 * 原文："houses further away are smaller, yet the vertical lines stay straight and parallel."
 * 数学在 core/mixed-perspective.js：把 P·V 的 w 行世界 y 系数衰减 k（k=1 竖线平行），P' = M'·V⁻¹。
 *
 * 这里只做三件事，全部挂在 View 实例上，view.js 只有两行挂钩：
 *   1. camera.updateProjectionMatrix 换成「普通透视 → 按当前视图矩阵混合」；updateCamera 结尾再刷新一次
 *      （混合投影依赖视图矩阵，转镜头时也要重算）。
 *   2. pick 的射线：混合投影不再是从相机位置出发的中心投影（屏幕同一点对应的世界点集不过眼点），
 *      Raycaster.setFromCamera 会错。改为把 NDC 的近/远两点用 (P'·V)⁻¹ 反投影，连线即拾取射线。
 *   3. 倒影是同一个相机下 scale.y=-1 的镜像网格，投影一换自动同步，无需单独处理。
 *
 * 默认不加载（index.html?mixedPersp=1 或 =0.5 打开，值即 k）；k=0 时投影矩阵与 three 原生逐元素相同。
 */
import * as THREE from 'three';
import { withVerticalParallel } from '../core/mixed-perspective.js';

export function attachMixedPerspective(view, { k = 1, pivotY } = {}) {
  const cam = view.camera;
  const stockUpdate = cam.updateProjectionMatrix.bind(cam);
  const state = { k: Math.min(1, Math.max(0, +k || 0)), pivotY, applied: 0 };
  const VP = new THREE.Matrix4();

  function mix() {
    cam.updateMatrixWorld();
    // three 的 matrixWorldInverse 在 updateMatrixWorld 里同步
    VP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const piv = state.pivotY ?? view.target.y;
    const P = cam.projectionMatrix.elements, mixed = withVerticalParallel(VP.elements, state.k, piv);
    // 深度行跟着 w' 走：原生 z_clip = -P10·w + P14。只改 w 不改 z 时，低于 pivot 的地面 w' < w，
    // z_ndc = (−P10·w + P14)/w' 会 >1 被远裁面整片切掉（第一版截图里岛面和墙下半截全没了）。
    // 改成 z' = −P10·w' + P14 后沿每条（不过眼点的）视线深度随 w' 单调，k=0 时与原生逐元素相同。
    for (const c of [0, 1, 2]) mixed[c * 4 + 2] = -P[10] * mixed[c * 4 + 3];
    mixed[14] = -P[10] * mixed[15] + P[14];
    // P' = M'·V⁻¹，V⁻¹ = camera.matrixWorld
    const Pp = new THREE.Matrix4().fromArray(mixed).multiply(cam.matrixWorld);
    cam.projectionMatrix.copy(Pp);
    cam.projectionMatrixInverse.copy(Pp).invert();
    state.applied++;
  }
  cam.updateProjectionMatrix = function () { stockUpdate(); if (state.k > 0) mix(); };

  const stockCamera = view.updateCamera.bind(view);
  view.updateCamera = function () { stockCamera(); cam.updateProjectionMatrix(); };

  const api = {
    get k() { return state.k; },
    get applied() { return state.applied; },
    setK(v) { state.k = Math.min(1, Math.max(0, +v || 0)); cam.updateProjectionMatrix(); view.requestShadowUpdate?.(); },
    /** view.pick 挂钩：混合投影下用 (P'V)⁻¹ 反投影近/远两点重设射线。 */
    fixRay(ray, ndcX, ndcY) {
      if (state.k <= 0) return;
      const inv = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert();
      const a = new THREE.Vector3(ndcX, ndcY, -1).applyMatrix4(inv);
      const b = new THREE.Vector3(ndcX, ndcY, 1).applyMatrix4(inv);
      ray.ray.origin.copy(a);
      ray.ray.direction.copy(b.sub(a).normalize());
    },
    /** 诊断：世界竖线 (x,z,y0→y1) 两端在屏幕上的像素横移（k=1 应 ≈0）与该线屏幕高度。 */
    verticalDrift(x, z, y0, y1) {
      const w = view.renderer.domElement.width, h = view.renderer.domElement.height;
      const p = new THREE.Vector3(x, y0, z).project(cam), q = new THREE.Vector3(x, y1, z).project(cam);
      return { dxPx: Math.abs(p.x - q.x) * w / 2, heightPx: Math.abs(p.y - q.y) * h / 2 };
    },
  };
  cam.updateProjectionMatrix();
  return api;
}
