// =====================================================================
//  场景 / 相机 / 渲染器
// =====================================================================
import * as THREE from "three";

export function createStage() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x79d2c4); // 薄荷青天空（日系白天插画风）
  // 同色系薄雾：远景微微融入天空，绝不死黑
  scene.fog = new THREE.FogExp2(0x79d2c4, 0.006);

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
