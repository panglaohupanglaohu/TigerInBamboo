// 寒梅归雁图 · 启动：铺纸、研墨、布景
// 与 main.js（竹虎溪涧）同构：loadConfig → BGM → renderer/scene/camera → 物理 → 环境 → 生灵 → 主循环
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadConfig } from "./config.js";
import { PlumEnvironment } from "./environment-plum.js";
import { PlumGrove } from "./plumtree.js";
import { GooseFlock } from "./goose.js";
import { PlumCameraDirector, updatePlumAgentPanel } from "./ui-plum.js";
import { BgmPlayer } from "./bgm.js";
import "./panels.js"; // 面板推拉收合（竖柄）

async function boot() {
  const config = await loadConfig();

  const playlist = config.bgm?.playlist?.length
    ? config.bgm.playlist
    : ["assets/audio/bgm.mp3", "assets/audio/duange_xing.mp3"];
  const bgm = new BgmPlayer(playlist, { volume: config.bgm?.volume ?? 0.5 });

  const canvas = document.getElementById("stage");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(-6, 1.8, 42);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.minDistance = 2;
  controls.maxDistance = 300;
  controls.target.set(4, 16, -40);

  // 环境即解析地形（雁与雪直接用 groundHeight，本画无刚体交互，不入物理世界）
  const env = new PlumEnvironment(scene, config); // 五层：石径/山石 → 缓坡 → 水塘 → 远山
  const grove = new PlumGrove(scene, config);     // 第二层：十倍古梅、小竹、芦苇
  const flock = new GooseFlock(scene, config, env); // 第三/四层：栖雁与归雁
  const director = new PlumCameraDirector(camera, controls);
  window.__dbg = { flock, env, grove, camera, controls, director, bgm }; // 调试钩子
  const preset = config.plum?.cameraPreset ?? config.style?.cameraPreset;
  if (preset) director.set(preset);

  const muteBtn = document.getElementById("bgm-toggle");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      muteBtn.textContent = bgm.toggleMute() ? "♪ 启乐" : "♪ 静音";
    });
  }

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

    env.update(dt);          // 水面、薄雪
    grove.update(dt);        // 落花瓣
    flock.update(dt, time);  // 雁群状态机 + 涟漪
    director.update(dt, flock);

    hudClock += dt;
    if (hudClock > 0.25) { hudClock = 0; updatePlumAgentPanel(flock, config); }

    renderer.render(scene, camera);
  });

  document.getElementById("loading")?.classList.add("done");
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById("loading");
  if (el) el.textContent = "装裱失败：" + err.message;
});
