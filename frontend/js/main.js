// 启动：铺纸、研墨、布景
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadConfig } from "./config.js";
import { Environment } from "./environment.js";
import { BambooGrove } from "./bamboo.js";
import { Tiger } from "./tiger.js";
import { Scenery } from "./scenery.js";
import { WaterPlants } from "./plants.js";
import { CameraDirector, updateAgentPanel } from "./ui.js";
import { PhysicsWorld } from "./physics.js";

async function boot() {
  const config = await loadConfig();

  const canvas = document.getElementById("stage");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(4, 10, 30);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 4;
  controls.maxDistance = 70;
  controls.target.set(0, 1.5, 0);

  const physics = new PhysicsWorld();
  const env = new Environment(scene, config, physics);
  const grove = new BambooGrove(scene, config, null, physics);
  const tiger = new Tiger(scene, config, physics);
  // 决策：不采用 GLB 虎（四肢不分），保留程序化虎模型
  const scenery = new Scenery(scene);
  new WaterPlants(scene, config, env); // 菖蒲（靠水石旁，翠叶白花）+ 芦苇（阔水两岸，浅赭叶）
  const director = new CameraDirector(camera, controls);
  window.__dbg = { tiger, camera, controls, director, physics, grove }; // 调试钩子：截图/调试用
  if (config.style?.cameraPreset) director.set(config.style.cameraPreset);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  let hudClock = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    env.update(dt);
    tiger.update(dt, time, grove);
    grove.update(dt, tiger.group.position); // 施加回正/风扭矩
    physics.step(dt);                        // Cannon 解算：虎推竹、碰撞
    grove.syncFromPhysics();                 // 物理位姿写回可视模型
    director.update(dt, tiger, null);

    hudClock += dt;
    if (hudClock > 0.25) { hudClock = 0; updateAgentPanel(tiger); }

    renderer.render(scene, camera);
  });

  document.getElementById("loading")?.classList.add("done");
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById("loading");
  if (el) el.textContent = "装裱失败：" + err.message;
});
