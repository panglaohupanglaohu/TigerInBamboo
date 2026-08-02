// =====================================================================
//  TigerMessenger 装配入口：创建各系统、接线、启动主循环
// =====================================================================
import { Timer } from "three/addons/misc/Timer.js";
import { createStage } from "./core/stage.js";
import { createInput } from "./core/input.js";
import { createCameraRig } from "./core/camera.js";
import { createDevPanel } from "./core/devPanel.js";
import { P } from "./core/params.js";
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
const { lanterns, ambient, sun } = setupEnvironment(scene);

// ---------- 星球（先放，平台贴其表面） ----------
createPlanet(scene);

// ---------- 世界：球面平台 + 装饰 ----------
const platforms = buildWorld(scene);

// ---------- 玩家 ----------
const { player, playerGroup, messengerMesh, holdAura } = createPlayer(scene);

// ---------- 第三人称相机 ----------
const cameraRig = createCameraRig(camera, player);

// ---------- 任务系统 / 开局状态 ----------
let gameStarted = false;

// ---------- 输入：键盘 + 滚轮/中键缩放 ----------
const keys = createInput({
  isActive: () => gameStarted,
  onZoom: (d) => cameraRig.zoomBy(d),
  onOrbit: (dx) => cameraRig.orbitBy(dx),
  onMidDrag: (on) => cameraRig.setMidDrag(on),
});

// 右键拖拽环视（yaw + pitch，松手回弹）
{
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("mousedown", (e) => {
    if (e.button !== 2 || !gameStarted) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    cameraRig.setRightDrag(true);
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    cameraRig.orbitBy((e.clientX - lastX) * 0.005);
    cameraRig.orbitPitchBy((e.clientY - lastY) * 0.004);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    cameraRig.setRightDrag(false);
  };
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) endDrag();
  });
  window.addEventListener("blur", endDrag);
}

const quest = createQuestSystem({
  scene,
  platforms,
  player,
  messengerMesh,
  holdAura,
  camera,
  isGameStarted: () => gameStarted,
});

// ---------- 开发者菜单（🤖） ----------
const devPanel = createDevPanel({
  sun,
  ambient,
  onCamDist: (d) => cameraRig.setDist(d),
});

// ---------- 开始按钮 ----------
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
cameraRig.snapToPlayer();
playerGroup.position.copy(player.position);

let fpsFrames = 0;
let fpsAccum = 0;
const showFps = /[?&]fps=1\b/.test(location.search);

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
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
  updatePlayerControl({ player, keys, camera, dt, gameStarted, onJump: sfxJump });
  resolveCollisions(player.position, player.velocity, dt, platforms, player, () => {
    showToast("掉下去了… 已回到检查点");
  });
  syncPlayerVisual(player, playerGroup);

  const upLen = player.position.length() || 1;
  const ux = player.position.x / upLen;
  const uy = player.position.y / upLen;
  const uz = player.position.z / upLen;
  const vr = player.velocity.x * ux + player.velocity.y * uy + player.velocity.z * uz;
  const tx = player.velocity.x - vr * ux;
  const ty = player.velocity.y - vr * uy;
  const tz = player.velocity.z - vr * uz;
  const moving = Math.hypot(tx, ty, tz) > 0.3;
  updatePlayerAnim(player, messengerMesh, dt, moving);
  cameraRig.update(dt);
  quest.updateInteraction(dt);
  quest.updateCompass();
  quest.animateMarkers(t);
  updateLanterns(lanterns, t);
  updatePlatformPulse(platforms, t);
  devPanel.tick(dt);

  renderer.render(scene, camera);
}

animate();

// 调试
window.__tm = { player, quest, cameraRig, P };
