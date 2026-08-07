// =====================================================================
//  场景 / 相机 / 渲染器
// =====================================================================
import * as THREE from "three";

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
  camera.position.set(0, 50, 20);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
