// =====================================================================
//  TigerMessenger 装配入口：创建各系统、接线、启动主循环
// =====================================================================
import { Timer } from "three/addons/misc/Timer.js";
import { createStage } from "./core/stage.js";
import { createInput } from "./core/input.js";
import { createCameraRig } from "./core/camera.js";
import { setupEnvironment, updateLanterns } from "./world/environment.js";
import { buildWorld, updatePlatformPulse } from "./world/platforms.js";
import { createPlanet } from "./world/planet.js";
import { resolveCollisions } from "./world/collision.js";
import { createPlayer, syncPlayerVisual } from "./player/player.js";
import { updatePlayerControl } from "./player/controller.js";
import { updatePlayerAnim } from "./player/animation.js";
import { createQuestSystem } from "./quest/questSystem.js";
import { elIntro, elStartBtn, showToast, updateToast } from "./ui/hud.js";
import { ensureAudio, startAmbience, sfxJump } from "./audio/sfx.js";
import { journalCount } from "./quest/letterJournal.js";

// ---------- 场景 / 相机 / 渲染器 ----------
const { scene, camera, renderer } = createStage();

// ---------- 环境：光照 / 天空 / 星月 / 漂浮光点 ----------
const { lanterns } = setupEnvironment(scene);

// ---------- 世界：平台 + 装饰 ----------
const platforms = buildWorld(scene);

// ---------- 星球：场景中心半径 40 的淡青色球体 ----------
createPlanet(scene);

// ---------- 玩家 ----------
const { player, playerGroup, messengerMesh, holdAura } = createPlayer(scene);

// ---------- 第三人称相机（先建 rig，输入钩子要调用 zoom/orbit） ----------
const cameraRig = createCameraRig(camera, player);

// ---------- 任务系统 / 开局状态（输入 isActive 依赖） ----------
let gameStarted = false;

// ---------- 输入：键盘 + 滚轮/中键缩放 ----------
const keys = createInput({
  isActive: () => gameStarted,
  onZoom: (d) => cameraRig.zoomBy(d),
  onOrbit: (dx) => cameraRig.orbitBy(dx),
  onMidDrag: (on) => cameraRig.setMidDrag(on),
});

const quest = createQuestSystem({
  scene,
  platforms,
  player,
  messengerMesh,
  holdAura,
  camera,
  isGameStarted: () => gameStarted,
});

// ---------- 开始按钮（用户手势内解锁 AudioContext） ----------
elStartBtn.addEventListener("click", () => {
  gameStarted = true;
  elIntro.classList.add("hidden");
  ensureAudio();
  startAmbience();
  const past = journalCount();
  showToast(
    past > 0
      ? `信袋里已有 ${past} 封往事 · 去找发光的寄件人接信吧`
      : "去找发光的寄件人接信吧"
  );
  quest.updateQuestUI();
});

// =====================================================================
//  主循环
// =====================================================================
const timer = new Timer();
cameraRig.snapToPlayer(); // 初始相机目标
playerGroup.position.copy(player.position);

// 简易帧率巡检（控制台每 5s；?fps=1 时在 title 显示）
let fpsFrames = 0;
let fpsAccum = 0;
const showFps = /[?&]fps=1\b/.test(location.search);

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // 防止切后台后大跳
  const t = performance.now() * 0.001;

  fpsFrames += 1;
  fpsAccum += dt;
  if (fpsAccum >= 5) {
    const fps = fpsFrames / fpsAccum;
    if (showFps) document.title = `TigerMessenger · ${fps.toFixed(0)} fps`;
    if (fps < 25) console.warn(`[TigerMessenger] 帧率偏低: ${fps.toFixed(1)} fps`);
    fpsFrames = 0;
    fpsAccum = 0;
  }

  updateToast(dt);

  // 输入 → 移动 / 跳跃 / 重力
  updatePlayerControl({ player, keys, camera, dt, gameStarted, onJump: sfxJump });

  // 平台碰撞 + 坠落复位（检查点）
  resolveCollisions(player.position, player.velocity, dt, platforms, player, () => {
    showToast("掉下去了… 已回到检查点");
  });

  // 同步视觉
  syncPlayerVisual(player, playerGroup);

  const moving = Math.hypot(player.velocity.x, player.velocity.z) > 0.3;
  updatePlayerAnim(player, messengerMesh, dt, moving);
  cameraRig.update(dt);
  quest.updateInteraction(dt);
  quest.updateCompass();
  quest.animateMarkers(t);
  updateLanterns(lanterns, t);
  updatePlatformPulse(platforms, t);

  renderer.render(scene, camera);
}

animate();
