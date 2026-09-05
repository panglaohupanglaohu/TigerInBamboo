// =====================================================================
//  场景 / 相机 / 渲染器
// =====================================================================
import * as THREE from "three";
import { P } from "./params.js";

export function createStage() {
  const scene = new THREE.Scene();
  // 莫比斯黄昏结界淡粉紫底（#EBB9B6）；昼夜循环会再 lerp 天空色
  scene.background = new THREE.Color(0xebb9b6);
  // 远景雾与背景同色相，避免纯黑/水泥灰吞没高空飞艇
  scene.fog = new THREE.FogExp2(0xebb9b6, 0.007);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.layers.enable(1); // 斯瓦尔博娃圣城光照层
  camera.position.set(0, 50, 20);

  // 模板缓冲：three r163 起 `stencil` 默认 **false**（早年默认 true）。
  // 不申请就没有模板位，`stencilWindows.js` 写的模板状态全部空转——
  // 2026-09-05 实测：现网写法 gl.STENCIL_BITS = 0，加上这一行才是 8。
  // 只在挖窗开关打开时申请，关着的时候不为它付带宽。
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    stencil: P.stencilWindowsV1 === true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // 性能（2026-08-28）：像素比上限 2 → 1.5。Retina 下 fragment 成本约减半，
  // Toon 平涂 + 描边风格在 1.5 倍下几乎无视觉差；4751 draw calls 的场景
  // 主要瓶颈在 fragment 带宽。
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  // 显式色彩管理（V5 K1）：即 r172 默认值，写明以便回归测试断言、防重复转换
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap; // 硬边投影（Cel 动漫感，不要软渐变）
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}
