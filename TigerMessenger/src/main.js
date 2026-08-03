// =====================================================================
//  TigerMessenger 运行时入口（薄装配）
//  - 舞台 / 玩家 / 相机 / 输入 / 任务 / 音频 / 主循环
//  - 世界内容由 scenes/* 模块按需加载（?scene=messenger,saihoji）
// =====================================================================
import { Timer } from "three/addons/misc/Timer.js";
import * as THREE from "three";
import { createStage } from "./core/stage.js";
import { createInput } from "./core/input.js";
import { createCameraRig } from "./core/camera.js";
import { createDevPanel } from "./core/devPanel.js";
import { createMapEditor } from "./core/mapEditor.js";
import { P } from "./core/params.js";
import { setupEnvironment, updateLanterns } from "./world/environment.js";
import { createDayNight } from "./world/dayNight.js";
import { createTramRide } from "./player/tramRide.js";
import { createAirshipRide } from "./player/airshipRide.js";
import { createWeatherSystem } from "./world/weather.js";
import { createElderMusicInteraction } from "./world/elderMusic.js";
import { createFoxNpc } from "./world/foxNpc.js";
import { createTouchControls } from "./ui/touchControls.js";
import { createPlanet, PLANET_RADIUS } from "./world/planet.js";
import { resolveCollisions, resolveAssetColliders } from "./world/collision.js";
import { createPlayer, syncPlayerVisual } from "./player/player.js";
import { updatePlayerControl } from "./player/controller.js";
import { updatePlayerAnim } from "./player/animation.js";
import { createQuestSystem } from "./quest/questSystem.js";
import {
  elIntro,
  elStartBtn,
  showToast,
  updateToast,
  initQuestPanelCollapse,
} from "./ui/hud.js";
import {
  ensureAudio,
  startAmbience,
  startTramSound,
  sfxJump,
  sfxWaterTrain,
  setCanyonApproachBgm,
  isCanyonBgmPlaying,
} from "./audio/sfx.js";
import { journalCount } from "./quest/letterJournal.js";
import {
  resolveSceneIdsFromUrl,
  loadScenes,
  listScenes,
} from "./scenes/registry.js";
import { mergeColliders, updateScenes } from "./scenes/sceneApi.js";

// ---------- 舞台 ----------
const { scene, camera, renderer } = createStage();
initQuestPanelCollapse();

// ---------- 环境光 / 天空（跨场景共享） ----------
const { lanterns, ambient, sun, skyMat, hemi } = setupEnvironment(scene);

// ---------- 星球壳（各场景可在其上贴装） ----------
const planet = createPlanet(scene);

// ---------- 按 URL 加载场景模块 ----------
// 例：?scene=messenger  |  ?scene=saihoji  |  ?scene=messenger,saihoji
const sceneIds = resolveSceneIdsFromUrl(location.search);
const sceneHandles = loadScenes(sceneIds, {
  scene,
  planetRadius: PLANET_RADIUS,
  planet,
  options: {
    // 苔海六景密度；石组位置与数量由庭园构图固定。
    saihoji: { seed: 884, mossCount: 132 },
  },
});

// 从已加载场景中取玩法依赖（平台/土坡）；若未加载 messenger 则为空
const messenger = sceneHandles.find((h) => h.id === "messenger") || null;
const platforms = messenger?.platforms || [];
const hills = messenger?.hills || null;
// 可写碰撞列表（地图编辑器会 push / 改 position）
const assetColliders = mergeColliders(sceneHandles);

// ---------- 玩家 / 相机 / 输入 ----------
const { player, playerGroup, messengerMesh, holdAura } = createPlayer(scene);

// 庭园视觉验收/漫游入口：?tour=saihoji 从第一景开始，不影响默认出生点。
if (new URLSearchParams(location.search).get("tour") === "saihoji") {
  const saihoji = sceneHandles.find((handle) => handle.id === "saihoji");
  const entry = saihoji?.landmarks?.zones?.["moss-entry"];
  const next = saihoji?.landmarks?.zones?.["master-stones"];
  if (entry?.pathDirection) {
    player.position.copy(entry.pathDirection).multiplyScalar(PLANET_RADIUS + 2);
    player.checkpoint.copy(player.position);
    player.groundR = PLANET_RADIUS + 2;
    if (next?.pathDirection) {
      player.forward.copy(next.pathDirection);
      const up = player.position.clone().normalize();
      player.forward.addScaledVector(up, -player.forward.dot(up)).normalize();
      player.facing.copy(player.forward);
    }
  }
}
const cameraRig = createCameraRig(camera, player);

let gameStarted = false;
const keys = createInput({
  isActive: () => gameStarted,
  onZoom: (d) => cameraRig.zoomBy(d),
  onOrbit: (dx) => cameraRig.orbitBy(dx),
  onOrbitPitch: (dy) => cameraRig.orbitPitchBy(dy),
  onMidDrag: (on) => cameraRig.setMidDrag(on),
  onRightDrag: (on) => cameraRig.setRightDrag(on),
});

// ---------- 触控遥控杆（手机 / 平板；可收起） ----------
const touchControls = createTouchControls({
  keys,
  isGameStarted: () => gameStarted,
  onOrbit: (dx) => cameraRig.orbitBy(dx),
  onOrbitPitch: (dy) => cameraRig.orbitPitchBy(dy),
  onRightDrag: (on) => cameraRig.setRightDrag(on),
  toast: showToast,
});

// ---------- 任务（依赖平台；无 messenger 场景时任务仍可创建但不贴台） ----------
const quest = createQuestSystem({
  scene,
  platforms,
  player,
  messengerMesh,
  holdAura,
  camera,
  isGameStarted: () => gameStarted,
});

// ---------- 地图编辑器（🤖 菜单 · 建筑放置/移动/复制） ----------
const mapEditor = createMapEditor({
  scene,
  planetRadius: PLANET_RADIUS,
  colliders: assetColliders,
  toast: showToast,
});
// 登记场景内置书店（无存档时作为默认布局；有存档则由 loadPersisted 整表覆盖）
if (messenger?.landmarks?.bookshop) {
  const shop = messenger.landmarks.bookshop;
  const col = assetColliders.find(
    (c) => c.position.distanceToSquared(shop.position) < 0.01
  );
  mapEditor.registerFromWorld("bookshop", shop, -0.5, col || null);
}
// 有本机布局时完整恢复（位置/朝向/招牌/增删），不再回落到初始化布局
mapEditor.loadPersisted();
// 地图打开时：3D 左键点选模型 → 地图同步选中高亮
mapEditor.bindScenePick({ camera, domElement: renderer.domElement });

const devPanel = createDevPanel({
  sun,
  ambient,
  onCamDist: (d) => cameraRig.setDist(d),
  onOpenMap: () => mapEditor.setOpen(true),
});

// ---------- 昼夜循环（朝霞/暮云重点过渡；面板可拖时刻与速度） ----------
const dayNight = createDayNight({
  scene,
  skyMat,
  sun,
  ambient,
  hemi,
  clouds: messenger?.clouds || [],
});

// ---------- 电车搭乘（近车 [F] 上车 · 窗边乘坐看风景） ----------
const tramRide = createTramRide({
  player,
  getTram: () =>
    messenger?.landmarks?.tramSystem?.getNearestTram?.(player.position) ||
    messenger?.landmarks?.tramSystem?.tram ||
    null,
  cameraRig,
  elHint: document.getElementById("tram-hint"),
  toast: showToast,
  onBoard: (tram) => {
    // 若已近峡谷 / 在谷内：直接切峡谷 BGM，不再播默认登车氛围
    const tramSystem = messenger?.landmarks?.tramSystem;
    const cue = tramSystem?.getCanyonAudioCue?.(tram);
    const nearCanyon = cue && (cue.inCanyon || cue.secondsToEntry <= 10);
    if (nearCanyon) {
      setCanyonApproachBgm(true, { fade: 0.8 });
    } else {
      sfxWaterTrain();
    }
    const color = tram?.userData?.variant === "blue" ? "蓝色" : "红色";
    showToast(`已登上${color}电车 · 窗边乘客 · [C] 司机视野 · [F] 下车`, 3.4);
  },
});

// ---------- 莫比斯航空艇搭乘（垂绳 [F] 攀爬 · WASD 驾驶） ----------
const airshipRide = createAirshipRide({
  player,
  getAirship: () => messenger?.landmarks?.airship || null,
  cameraRig,
  keys,
  planetRadius: PLANET_RADIUS,
  elHint: document.getElementById("airship-hint"),
  toast: showToast,
});

// ---------- 天气（雨/雪/闪电/停雨彩虹，受风速风向影响） ----------
const weather = createWeatherSystem(scene, PLANET_RADIUS, {
  skyRing: messenger?.landmarks?.camp?.landmarks?.skyRing || null,
});

// ---------- 弹琴老人（近身 E 键播放 / 停止八音盒） ----------
const elderMusic = createElderMusicInteraction({
  player,
  elder: messenger?.landmarks?.camp?.landmarks?.elder || null,
  elHint: document.getElementById("elder-hint"),
  isGameStarted: () => gameStarted,
});

// ---------- 莫比斯结界：电车跨赤道时 2s 平滑过渡天空 ----------
// 北半球保持昼夜循环本色；电车入南（y<0）环境光/天色渐变为莫比斯粉紫
const MOEBIUS_SKY = new THREE.Color(0xebb9b6); // 莫比斯黄昏粉紫
const MOEBIUS_SUN = new THREE.Color(0xf0c294); // 暖橙日光
let moebiusFactor = 0;
function updateMoebiusBarrier(dt) {
  const tramSystem = messenger?.landmarks?.tramSystem;
  const tram = tramSystem?.tram;
  const target = tram && tram.position.y < 0 ? 1 : 0;
  moebiusFactor += (target - moebiusFactor) * Math.min(1, dt / 2); // 2 秒时间常数
  if (moebiusFactor < 0.001) return;
  const cur = dayNight.getCurrent();
  if (!cur) return;
  const f = THREE.MathUtils.smoothstep(moebiusFactor, 0, 1);
  if (scene.background && scene.background.isColor) {
    scene.background.copy(cur.skyMid).lerp(MOEBIUS_SKY, f);
  }
  if (scene.fog) scene.fog.color.copy(cur.skyMid).lerp(MOEBIUS_SKY, f);
  if (skyMat) {
    skyMat.uniforms.topColor.value.copy(cur.skyTop).lerp(MOEBIUS_SKY, f);
    skyMat.uniforms.midColor.value.copy(cur.skyMid).lerp(MOEBIUS_SKY, f);
    skyMat.uniforms.botColor.value.copy(cur.skyBot).lerp(MOEBIUS_SUN, f);
  }
  sun.color.copy(cur.sunColor).lerp(MOEBIUS_SUN, f);
  ambient.color.setHex(0xf3fff7).lerp(MOEBIUS_SKY, f);
}

// ---------- 阿狸（E 站立跟随 · 球面 lerp 尾随 · 对话） ----------
const foxAli = messenger?.landmarks?.camp?.landmarks?.foxAli || null;
const foxNpc = createFoxNpc({
  player,
  fox: foxAli,
  camera,
  isGameStarted: () => gameStarted,
  elHint: document.getElementById("fox-hint"),
  planetRadius: PLANET_RADIUS,
  isElderNear: () => elderMusic.isNear?.() ?? false,
  isQuestNear: () => {
    const el = document.getElementById("npc-hint");
    return !!(el && el.classList.contains("show"));
  },
});

// ---------- 开场 ----------
elStartBtn.addEventListener("click", () => {
  gameStarted = true;
  elIntro.classList.add("hidden");
  ensureAudio();
  startAmbience();
  startTramSound();
  const past = journalCount();
  const sceneHint =
    sceneIds.length === 1
      ? `场景 · ${listScenes().find((s) => s.id === sceneIds[0])?.name || sceneIds[0]}`
      : `场景 · ${sceneIds.join(" + ")}`;
  showToast(
    past > 0
      ? `信袋里已有 ${past} 封往事 · ${sceneHint}`
      : `去找发光的寄件人接信吧 · ${sceneHint}`
  );
  quest.updateQuestUI();
  touchControls.onGameStart?.();
});

// ---------- 主循环 ----------
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
  dayNight.update(dt);
  updateMoebiusBarrier(dt);
  weather.update(dt, player.position, { speed: P.windSpeed, dirDeg: P.windDir }, P.weather | 0);
  mapEditor.tickHighlight?.();

  // 搭乘接管：电车上车动画/乘坐 或 航空艇攀爬/驾驶时跳过移动与碰撞
  const riding = tramRide.update(dt) || airshipRide.update(dt);
  if (!riding) {
    updatePlayerControl({ player, keys, camera, dt, gameStarted, onJump: sfxJump });
    resolveCollisions(
      player.position,
      player.velocity,
      dt,
      platforms,
      player,
      () => showToast("掉下去了… 已回到检查点"),
      hills
    );
    resolveAssetColliders(player.position, assetColliders);
  }

  // 峡谷进谷 BGM：乘车且距进谷 ≤10s（或已在谷内）→ 播風之傳說，关默认环境音
  {
    const tramSystem = messenger?.landmarks?.tramSystem;
    let wantCanyonBgm = false;
    if (riding && tramSystem?.getCanyonAudioCue) {
      const tram =
        tramSystem.getNearestTram?.(player.position) || tramSystem.tram || null;
      const cue = tramSystem.getCanyonAudioCue(tram);
      if (cue && (cue.inCanyon || cue.secondsToEntry <= 10)) wantCanyonBgm = true;
    }
    // 滞回：已在播则离谷后再关，避免边界闪断（出谷后 seconds>12 才关）
    if (isCanyonBgmPlaying() && riding && tramSystem?.getCanyonAudioCue) {
      const tram =
        tramSystem.getNearestTram?.(player.position) || tramSystem.tram || null;
      const cue = tramSystem.getCanyonAudioCue(tram);
      if (cue && (cue.inCanyon || cue.secondsToEntry <= 12)) wantCanyonBgm = true;
    }
    setCanyonApproachBgm(wantCanyonBgm, { fade: wantCanyonBgm ? 1.4 : 1.8 });
  }

  // 场景模块自更新（湖、云、平台脉动等）
  updateScenes(sceneHandles, dt, t, { player, gameStarted });

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
  elderMusic.update(dt, t);
  // 阿狸在任务气泡之后更新，避免被 hideBubble 冲掉
  foxNpc.update(dt, t);
  quest.updateCompass();
  quest.animateMarkers(t);
  updateLanterns(lanterns, t);
  devPanel.tick(dt);

  renderer.render(scene, camera);
}

animate();

// 调试：场景列表与句柄
window.__tm = {
  player,
  quest,
  cameraRig,
  P,
  scene,
  planet,
  sceneIds,
  sceneHandles,
  listScenes,
  assetColliders,
  platforms,
  hills,
  mapEditor,
  tramRide,
  airshipRide,
  elderMusic,
  foxNpc,
  weather,
  touchControls,
};
