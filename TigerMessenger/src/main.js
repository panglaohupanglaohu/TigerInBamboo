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
import { createStoryEngine } from "./story/storyEngine.js";
import { requestStoryboard } from "./story/storyLLM.js";
import { createStoryboardPanel } from "./story/storyboardPanel.js";
import { createMapEditor } from "./core/mapEditor.js";
import { createCitadelEditorPanel } from "./ui/citadelEditorPanel.js";
import { createCitadelSceneEdit } from "./ui/citadelSceneEdit.js";
import { createCrystalCityEditorPanel } from "./ui/crystalCityEditorPanel.js";
import {
  rebuildCitadelTown,
  rebuildCitadelTerrain,
  rebuildCitadelTerrainObjects,
  citadelTerrainCellSupported,
  updateCitadelNightWindows,
} from "./world/odysseyCitadel.js";
import { collectInfiltrationThreats } from "./world/citadelTerraceBirds.js";
import { CITADEL_TOWN_SPEC, citadelGridCellCenter } from "./world/citadelTown.js";
import { rebuildMoebiusCrystalMetropolis } from "./world/moebiusCity.js";
import { P } from "./core/params.js";
import { setupEnvironment, updateLanterns } from "./world/environment.js";
import { createDayNight } from "./world/dayNight.js";
import { createTramRide } from "./player/tramRide.js";
import { createAirshipRide } from "./player/airshipRide.js";
import { createAircraftRide } from "./player/aircraftRide.js";
import { createBubblePodRide } from "./player/bubblePodRide.js";
import { createBoatRide } from "./player/boatRide.js";
import { createWeatherSystem } from "./world/weather.js";
import { createElderMusicInteraction } from "./world/elderMusic.js";
import { createFoxNpc } from "./world/foxNpc.js";
import {
  updateSwampTigerDialog,
  findSwampTiger,
} from "./world/moebiusTiger.js";
import { createTouchControls } from "./ui/touchControls.js";
import { createMinimap } from "./ui/minimap.js";
import { createPlanet, PLANET_RADIUS } from "./world/planet.js";
import { FlockManager } from "./world/flock.js";
import { resolveCollisions, resolveAssetColliders } from "./world/collision.js";
import {
  createDynamicMoebiusClouds,
  updateDynamicMoebiusClouds,
} from "./world/equatorialClouds.js";
// 城头云盖要和三重门严格对齐：高度/锚点/沿轨跨度全部取自城门模块，不再各自硬编码
import { GATE, GATE_DEPTH, findGateSeatU } from "./world/abandonedGate.js";
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
  showBubble,
  hideBubble,
} from "./ui/hud.js";
import {
  ensureAudio,
  startAmbience,
  startTramSound,
  sfxJump,
  setTramRideBgm,
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

// ---------- 城头云墙（搁置中：默认不进场景，开发者菜单可开关） ----------
const CLOUD_WALL_KEY = "tm.equatorialClouds.enabled";
const trackCurve = messenger?.landmarks?.tramSystem?.curve ?? null;
const equatorialClouds = createDynamicMoebiusClouds(scene, PLANET_RADIUS, {
  trackCurve,
  anchorU: trackCurve ? findGateSeatU(trackCurve, PLANET_RADIUS) : null,
  crownY: GATE.wallTop,
  spanX: GATE_DEPTH,
});
/** 云墙是否在场景中显示并更新（默认关，设计未定稿） */
function isCloudWallEnabled() {
  return localStorage.getItem(CLOUD_WALL_KEY) === "1";
}
function setCloudWallEnabled(on) {
  const want = !!on;
  localStorage.setItem(CLOUD_WALL_KEY, want ? "1" : "0");
  if (!equatorialClouds) return want;
  equatorialClouds.visible = want;
  equatorialClouds.userData.enabled = want;
  if (want) {
    if (!equatorialClouds.parent) scene.add(equatorialClouds);
  } else if (equatorialClouds.parent) {
    equatorialClouds.parent.remove(equatorialClouds);
  }
  return want;
}
// 默认：从场景删除（仅代码仍创建，方便以后菜单打开）
setCloudWallEnabled(isCloudWallEnabled());
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

// bubblePodRide 稍后创建；触控环视在驾驶气泡艇时改为挪准星
let bubblePodRide = null;

// ---------- 触控遥控杆（手机 / 平板；可收起） ----------
const touchControls = createTouchControls({
  keys,
  isGameStarted: () => gameStarted,
  onOrbit: (dx) => cameraRig.orbitBy(dx),
  onOrbitPitch: (dy) => cameraRig.orbitPitchBy(dy),
  onRightDrag: (on) => cameraRig.setRightDrag(on),
  toast: showToast,
  isBubbleRiding: () => bubblePodRide?.isRiding?.() ?? false,
  onBubbleAim: (dx, dy) => bubblePodRide?.aimByDelta?.(dx, dy),
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
  // 地图以送信人为锚：打开先定位，再按相对位置放物品
  getPlayer: () => player,
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

// ---------- 小地图（左上角 · 经典场景标注 + 送信人位置/视野框） ----------
// getDir 惰性求值：三重门/白鲸湖可被开发者菜单搬迁，每次绘制取最新方向
const _mmViewFwd = new THREE.Vector3();
const minimap = createMinimap({
  planetRadius: PLANET_RADIUS,
  getPlayer: () => player,
  // 相机实时位姿：视野扇形框（第三人称跟随 / 驾驶舱第一人称均适用）
  getView: () => {
    camera.getWorldDirection(_mmViewFwd);
    return {
      position: camera.position,
      forward: _mmViewFwd,
      fov: camera.fov,
      aspect: camera.aspect,
    };
  },
  toast: showToast,
  landmarks: [
    { id: "bookshop", name: "书店镇", color: "#d98a2b",
      getDir: () => messenger?.landmarks?.bookshop?.position },
    { id: "camp", name: "出发营地", color: "#4aa76c",
      getDir: () => messenger?.landmarks?.camp?.landmarks?.anchor?.position },
    { id: "gate", name: "叹息之门", color: "#b85a42",
      getDir: () => messenger?.landmarks?.abandonedGate?.userData?.seatRoot?.position },
    { id: "citadel", name: "高山圣城", color: "#d4af37",
      getDir: () => messenger?.landmarks?.odysseyCitadel?.position },
    { id: "city", name: "水晶城", color: "#7eb0ff",
      getDir: () => messenger?.landmarks?.moebius?.grand?.dir },
    { id: "lake", name: "白鲸海水湖", color: "#48c9b0",
      getDir: () => messenger?.landmarks?.citySeaLake?.centerDir },
    { id: "harbor", name: "旧港码头", color: "#8a9bb8",
      getDir: () => messenger?.landmarks?.boat?.position },
    { id: "moon", name: "月亮湖", color: "#c9a8ff",
      getDir: () => messenger?.landmarks?.moonLake?.centerWorld },
    { id: "saihoji", name: "西芳寺苔庭", color: "#2f8f7a",
      getDir: () =>
        sceneHandles.find((h) => h.id === "saihoji")?.landmarks?.zones?.["moss-entry"]
          ?.pathDirection },
  ],
});

// ---------- 书店上方忽聚忽散的鸟群 ----------
// 取书店在世界中的球面位置（法线方向）→ 在其正上方低空小空域盘旋聚散。
let bookshopFlock = null;
{
  const shopPos = messenger?.landmarks?.bookshop?.position;
  if (shopPos && shopPos.lengthSq() > 1e-6) {
    const centerDir = shopPos.clone().normalize();
    bookshopFlock = new FlockManager(scene, {
      count: 16, // 一群手绘小鸟
      planetRadius: PLANET_RADIUS,
      centerDir, // 书店正上方
      altMin: 8, // 书店顶上空 8 单位起
      altMax: 16, // 上界 16 单位（低空小空域）
      homeRadius: 7, // 家域收紧在书店上空
      homeWeight: 1.2, // 较强回拉 → 围绕书店忽聚忽散
    });
  }
}

// ---------- 故事板引擎 + 并列工作台（🎬，与开发者菜单并列） ----------
const storyEngine = createStoryEngine({
  scene,
  player,
  planetRadius: PLANET_RADIUS,
  colliders: assetColliders,
  camera,
  cameraRig,
});

async function executeStoryboardText(text) {
  const rawSpec = await requestStoryboard(text);
  return storyEngine.play(rawSpec);
}

const storyboardPanel = createStoryboardPanel({
  onExecute: executeStoryboardText,
  onClear: () => storyEngine.dispose(),
  toast: showToast,
});

// ---------- 三重门 / 云墙：可交互定位（存 localStorage，刷新后保留） ----------
const GATE_ANCHOR_KEY = "tm.gateAnchorU.v1";

/** 找轨道上距给定世界位置最近的参数 u（弧长参数化，采样 1200 点足够） */
function nearestTrackU(worldPos) {
  const curve = messenger?.landmarks?.tramSystem?.curve;
  if (!curve || !worldPos) return null;
  const probe = new THREE.Vector3();
  let bestU = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 1200; i++) {
    const u = i / 1200;
    curve.getPointAt(u, probe);
    const d = probe.distanceToSquared(worldPos);
    if (d < bestD) {
      bestD = d;
      bestU = u;
    }
  }
  return { u: bestU, dist: Math.sqrt(bestD), curve };
}

/** 同步搬迁三重门 + 门体鸟群 + 城头云墙到轨道参数 u */
function moveGateAndCloudsTo(u) {
  const gate = messenger?.landmarks?.abandonedGate;
  const okGate = gate?.userData?.relocate?.(u) ?? false;
  // 三重门千鸟漩涡随门重锚
  const vortex =
    messenger?.landmarks?.gateBirdVortex || messenger?.landmarks?.birdVortex;
  const okBird = okGate ? vortex?.syncToGate?.(gate, { respawn: true }) ?? false : false;
  // 小群 Boids 家域也跟着门走
  if (okGate && messenger?.landmarks?.flock?.setHome) {
    const seat = gate.userData?.seatRoot;
    if (seat) {
      seat.updateWorldMatrix(true, false);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(seat.quaternion).normalize();
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(seat.quaternion).normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(seat.quaternion).normalize();
      const origin = new THREE.Vector3();
      seat.getWorldPosition(origin);
      messenger.landmarks.flock.setHome(up, {
        altMin: 8,
        altMax: 32,
        homeRadius: 18,
        homeWeight: 1.15,
        windDir: fwd,
        respawn: true,
      });
      messenger.landmarks.flock.setCorridor?.({
        origin,
        right,
        up,
        forward: fwd,
        halfWidth: 5,
        halfLength: 18,
        yMin: 3,
        yMax: 30,
        cloudCeilY: 40,
      });
    }
  }
  const okCloud =
    isCloudWallEnabled() && equatorialClouds?.parent
      ? equatorialClouds?.userData?.relocate?.(u) ?? false
      : false;
  return { okGate, okBird, okCloud };
}

// 启动时套用上次保存的位置
{
  const saved = Number(localStorage.getItem(GATE_ANCHOR_KEY));
  if (Number.isFinite(saved) && saved > 0 && saved < 1) {
    moveGateAndCloudsTo(saved);
  }
}

// ---------- 白鲸湖：可交互定位（搬离水晶城以减轻同屏渲染负担） ----------
// 实测该湖 283 个可绘制对象 / 15556 三角面，分别是水晶城的 45% 与 105%，
// 且原湖心与花厅塔重合 —— 看城市时必然连带渲染整片湖。
const LAKE_ANCHOR_KEY = "tm.seaLakeDir.v1";

function moveSeaLakeTo(dir, baseRadius) {
  const lake = messenger?.landmarks?.citySeaLake;
  return lake?.relocate?.(dir, baseRadius) ?? false;
}

{
  const raw = localStorage.getItem(LAKE_ANCHOR_KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (Number.isFinite(d?.x) && Number.isFinite(d?.y) && Number.isFinite(d?.z)) {
        moveSeaLakeTo(new THREE.Vector3(d.x, d.y, d.z));
      }
    } catch {
      /* 存档损坏：忽略，用默认位置 */
    }
  }
}

const devPanel = createDevPanel({
  sun,
  ambient,
  onCamDist: (d) => cameraRig.setDist(d),
  onOpenMap: () => mapEditor.setOpen(true),
  onOpenStoryboard: () => storyboardPanel.setOpen(true),
  cloudWallEnabled: isCloudWallEnabled(),
  onCloudWallToggle: (on) => {
    const enabled = setCloudWallEnabled(on);
    // 打开时：若有保存的门锚点，云墙跟着对齐
    if (enabled) {
      const saved = Number(localStorage.getItem(GATE_ANCHOR_KEY));
      if (Number.isFinite(saved) && saved > 0 && saved < 1) {
        equatorialClouds?.userData?.relocate?.(saved);
      } else {
        const defU = messenger?.landmarks?.abandonedGate?.userData?.anchor?.defaultGateU;
        if (Number.isFinite(defU)) equatorialClouds?.userData?.relocate?.(defU);
      }
    }
    return enabled
      ? "城头云墙已显示（设计搁置中，可随时关掉）"
      : "城头云墙已从场景移除";
  },
  onGateHere: () => {
    const hit = nearestTrackU(player.position);
    if (!hit) return "找不到电车轨道，无法定位";
    const { okGate, okBird, okCloud } = moveGateAndCloudsTo(hit.u);
    if (!okGate && !okBird && !okCloud) return "三重门/鸟群/云墙未就绪";
    localStorage.setItem(GATE_ANCHOR_KEY, String(hit.u));
    const s = hit.u * hit.curve.getLength();
    return (
      `已搬到轨道 s=${s.toFixed(1)}（距你 ${hit.dist.toFixed(1)}）` +
      `${okGate ? " · 三重门✓" : " · 三重门✗"}${okBird ? " · 鸟群✓" : " · 鸟群✗"}${okCloud ? " · 云墙✓" : " · 云墙✗"}`
    );
  },
  onGateReset: () => {
    localStorage.removeItem(GATE_ANCHOR_KEY);
    const gate = messenger?.landmarks?.abandonedGate;
    // 必须用 defaultGateU（出厂值）；gateU 会被上一次搬迁覆盖
    const defU = gate?.userData?.anchor?.defaultGateU;
    if (Number.isFinite(defU)) {
      moveGateAndCloudsTo(defU);
      return "已恢复默认位置（入谷口），刷新后完全复位";
    }
    return "已清除保存位置，刷新后复位";
  },
  onLakeHere: () => {
    const lake = messenger?.landmarks?.citySeaLake;
    if (!lake?.relocate) return "白鲸湖未就绪";
    const dir = player.position.clone().normalize();
    if (!moveSeaLakeTo(dir)) return "搬迁失败";
    localStorage.setItem(
      LAKE_ANCHOR_KEY,
      JSON.stringify({ x: dir.x, y: dir.y, z: dir.z })
    );
    // 报告与水晶城的新距离，直观说明减负效果
    const cityDir = messenger?.landmarks?.moebius?.grand?.dir;
    const away = cityDir ? dir.angleTo(cityDir) * PLANET_RADIUS : NaN;
    return (
      `湖已搬到你脚下（水面 R=${lake.surfaceR.toFixed(1)}）` +
      (Number.isFinite(away) ? ` · 距母塔 ${away.toFixed(1)}（原 0，同屏负担已移除）` : "")
    );
  },
  onLakeReset: () => {
    localStorage.removeItem(LAKE_ANCHOR_KEY);
    const lake = messenger?.landmarks?.citySeaLake;
    if (lake?.defaultCenterDir) {
      moveSeaLakeTo(lake.defaultCenterDir, lake.defaultBaseRadius);
      return "湖已回到花厅塔下（水晶城会重新变重）";
    }
    return "已清除保存位置，刷新后复位";
  },
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
    // 若已近峡谷 / 在谷内：直接切峡谷 BGM；否则登车曲 Tram 头 16s → 城南花已开
    const tramSystem = messenger?.landmarks?.tramSystem;
    const cue = tramSystem?.getCanyonAudioCue?.(tram);
    const nearCanyon = cue && (cue.inCanyon || cue.secondsToEntry <= 10);
    if (nearCanyon) {
      setCanyonApproachBgm(true, { fade: 0.8 });
      // 仍标记搭乘 wanted，离谷后可接主曲
      setTramRideBgm(true, { fade: 0.1 });
    } else {
      setTramRideBgm(true, { fade: 0.7 });
    }
    const color = tram?.userData?.variant === "blue" ? "蓝色" : "红色";
    const foxHint =
      foxNpc?.isFollowing?.() ? " · 阿狸卧在身旁" : "";
    showToast(
      `已登上${color}电车 · 窗边乘客 · [C] 司机视野 · [F] 下车${foxHint}`,
      3.4
    );
  },
  onAlight: () => {
    setTramRideBgm(false, { fade: 0.9 });
  },
});

// ---------- 莫比斯航空艇搭乘（垂绳 [F] 攀爬 · WASD 驾驶） ----------
// 圣城净空区：飞临上空时 hover 下限自动抬到建筑顶端之上（缓存，圣城重建后失效重算）
let citadelObstacle = null;
function getCitadelObstacle() {
  if (citadelObstacle) return citadelObstacle;
  const c = messenger?.landmarks?.odysseyCitadel;
  if (!c) return null;
  // 只取建筑本体（断崖+规则小镇），不含外围台地/石阶，净空区才贴建筑
  const body = c.userData.mainCastle || c;
  const box = new THREE.Box3().setFromObject(body);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  let topRadial = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        topRadial = Math.max(topRadial, Math.hypot(x, y, z));
  citadelObstacle = {
    dir: sphere.center.clone().normalize(),
    topRadial,
    angularRadius: Math.atan2(sphere.radius, sphere.center.length()) * 1.15,
  };
  return citadelObstacle;
}

const airshipRide = createAirshipRide({
  player,
  getAirship: () => messenger?.landmarks?.airship || null,
  cameraRig,
  keys,
  planetRadius: PLANET_RADIUS,
  scene,
  elHint: document.getElementById("airship-hint"),
  toast: showToast,
  getObstacle: getCitadelObstacle,
  playerGroup, // 驾驶员视角隐藏角色，避免挡视野
});

// ---------- 水晶城巡逻飞行器 · 第一人称驾驶舱（[V] 进入/退出） ----------
const aircraftRide = createAircraftRide({
  camera,
  cameraRig,
  getSquad: () => messenger?.landmarks?.aircraftSquad || null,
  exitAirshipRide: () => {
    airshipRide.forceExit();
    bubblePodRide?.forceExit?.();
  },
});

// ---------- 气泡艇：驾驶 / 瞄准气泡弹 / 水晶城海水湖潜行 ----------
bubblePodRide = createBubblePodRide({
  camera,
  cameraRig,
  player,
  playerGroup,
  getFleet: () => messenger?.landmarks?.bubblePods || null,
  getSeaLake: () => messenger?.landmarks?.citySeaLake || null,
  getLandmarks: () => messenger?.landmarks || null,
  scene,
  planetRadius: PLANET_RADIUS,
  keys,
  elHint: document.getElementById("bubble-hint"),
  elCrosshair: document.getElementById("bubble-crosshair"),
  elDiveTint: document.getElementById("dive-tint"),
  toast: showToast,
  exitOtherRides: () => {
    airshipRide.forceExit?.();
    if (aircraftRide.isRiding?.()) aircraftRide.toggle();
  },
});

// ---------- 战船驾驶（码头古战船 + 运河巡游战船；靠近 [F] 上船 · WASD 驾驶） ----------
const _boatPick = new THREE.Vector3();
function pickNearestBoat() {
  const candidates = [];
  const dockBoat = messenger?.landmarks?.boat;
  if (dockBoat) candidates.push(dockBoat);
  const patrol = messenger?.landmarks?.canalBoats?.boats;
  if (Array.isArray(patrol)) candidates.push(...patrol);
  let best = null;
  let bestD = 5.2;
  for (const b of candidates) {
    if (!b) continue;
    b.getWorldPosition(_boatPick);
    const d = player.position.distanceTo(_boatPick);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}
const boatRide = createBoatRide({
  scene,
  player,
  playerGroup,
  getBoat: pickNearestBoat,
  cameraRig,
  keys,
  elHint: document.getElementById("boat-hint"),
  toast: showToast,
  exitOtherRides: () => {
    airshipRide.forceExit?.();
    bubblePodRide?.forceExit?.();
    if (aircraftRide.isRiding?.()) aircraftRide.toggle();
  },
  onDismount: (left) => {
    // 运河船下船后吸附回航道继续巡游
    messenger?.landmarks?.canalBoats?.markNeedsSnap?.(left);
  },
});

// ---------- 高山圣城 · Townscaper 搭建面板 ----------
// 乘坐航空艇（热气球）时用鼠标左键点选圣城 → 弹出可拖拽/可收起的搭建面板；
// 面板编辑（2D 平面图 / 场景 3D 直编辑）→ rebuildCitadelTown 即时重建场景圣城
// → v2 布局写 localStorage。每座台地拥有五个 town-terrace-T-level-N 组。
function applyTownLayerVisibility(activeTerrace, activeLayer, hideAbove) {
  const layers = messenger?.landmarks?.odysseyCitadel?.userData?.layers;
  if (!layers) return;
  for (const layer of layers) {
    for (const child of layer.children) {
      const m = /^town-terrace-(\d+)-level-(\d+)$/.exec(child.name || "");
      if (m) {
        const terrace = Number(m[1]);
        const floor = Number(m[2]);
        child.visible = !hideAbove || terrace !== activeTerrace || floor <= activeLayer;
      }
    }
  }
}

// 土坡支撑缓存：键 "ix,iz" → 层级（-1 = 无承重土坡）；布局/地形变更即失效
const citadelSupportCache = new Map();
function citadelSupportAt(ix, iz, terraceIndex = 0) {
  const key = `${terraceIndex}:${ix},${iz}`;
  if (citadelSupportCache.has(key)) return citadelSupportCache.get(key);
  const citadel = messenger?.landmarks?.odysseyCitadel;
  if (!citadel) return -1;
  // Pure canonical transform: safe even while the panel is still being
  // constructed, and exactly identical to both the 2D map and 3D generator.
  const c = citadelGridCellCenter(ix, 0, iz);
  const contour = citadel.userData?.contourSpec;
  if (!contour) return -1;
  // 格级承重：瀑布缺口边缘格的中心可能落在被切掉的扇区里，
  // 但格体仍坐在台地顶面上——任一角点（格半宽处）支撑即允许放置。
  const level = citadelTerrainCellSupported(
    contour,
    c.x,
    c.z,
    terraceIndex,
    CITADEL_TOWN_SPEC.cellSize * 0.5
  )
    ? 0
    : -1;
  citadelSupportCache.set(key, level);
  return level;
}

const citadelEditorPanel = messenger?.landmarks?.odysseyCitadel
  ? createCitadelEditorPanel({
      toast: showToast,
      onLayerVisibility: applyTownLayerVisibility,
      onViewAction: citadelViewAction,
      getSupportLevel: citadelSupportAt,
      onTerrainChange: (contour) => {
        rebuildCitadelTerrain(messenger.landmarks.odysseyCitadel, contour);
        messenger.landmarks.citadelRange?.rebuildWaterTerraces?.(contour);
        // 护城河内径/外径：实时重建环带几何（注意曲率贴合）
        messenger.landmarks.citadelRange?.rebuildMoat?.(contour?.moat);
        citadelSupportCache.clear();
        citadelObstacle = null; // 净空区下帧重算
      },
      onTerrainObjectsChange: (objects) => {
        rebuildCitadelTerrainObjects(messenger.landmarks.odysseyCitadel, objects);
        citadelObstacle = null;
      },
      onApply: (layout) => {
        // 编辑器提交的是 v2 五台地布局对象（{ terraces: [...] }），不能再包进
        // 旧版单城堡的 `levels` 字段；否则归一化时会得到五座空城堡。
        const stats = rebuildCitadelTown(messenger.landmarks.odysseyCitadel, layout);
        citadelObstacle = null; // 建筑体量变了，净空区下帧重算
        citadelSupportCache.clear(); // 包围盒可能变，支撑缓存失效
        // 重建后 level 组全部换新，按面板状态重新断言一次可见性
        const st = citadelEditorPanel?.getState?.();
        if (st) applyTownLayerVisibility(st.activeTerrace, st.activeLayer, st.hideAbove);
        return stats;
      },
    })
  : null;

// 点击落在 UI 面板上则忽略（圣城点选与 3D 直编辑共用同一判定）
function isCitadelUiEvent(e) {
  const t = e.target;
  return (
    t instanceof Element &&
    (t.closest("#citadel-editor") ||
      t.closest("#ce-io") ||
      t.closest("#crystal-city-editor") ||
      t.closest("#map-editor") ||
      t.closest("#dev-panel") ||
      t.closest("#dev-toggle") ||
      t.closest("#storyboard-panel") ||
      t.closest("#quest-panel") ||
      t.closest("#journal-panel") ||
      t.closest("#intro"))
  );
}

// ---------- 水晶城 · 搭建面板（对齐圣城面板交互） ----------
const crystalCityEditorPanel = messenger?.landmarks?.moebius
  ? createCrystalCityEditorPanel({
      toast: showToast,
      onApply: (layout) => {
        const api = messenger.landmarks.moebius;
        rebuildMoebiusCrystalMetropolis(api, scene, PLANET_RADIUS, {
          trackCurve: messenger.landmarks.tramSystem?.curve,
          layout,
          useStorage: false,
        });
        // 海水湖跟到新母皇塔基
        const lake = messenger.landmarks.citySeaLake;
        const grand = api.grand;
        if (lake?.relocate && grand?.dir) {
          lake.relocate(grand.dir, grand.root);
        }
        return { halls: layout.halls?.length ?? 0, crystals: layout.crystals?.length ?? 0 };
      },
    })
  : null;

// 航空艇飞行中左键点选水晶城建筑 → 打开搭建面板
{
  const cityPickRay = new THREE.Raycaster();
  const cityPickNdc = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!crystalCityEditorPanel || e.button !== 0) return;
    if (!gameStarted || !airshipRide.isFlying?.()) return;
    if (isCitadelUiEvent(e)) return;
    if (crystalCityEditorPanel.isOpen()) return;
    if (citadelEditorPanel?.isOpen?.()) return;
    const city = messenger?.landmarks?.moebius?.group;
    if (!city) return;
    const rect = renderer.domElement.getBoundingClientRect();
    cityPickNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    cityPickRay.setFromCamera(cityPickNdc, camera);
    const hits = cityPickRay.intersectObject(city, true);
    if (!hits.length) return;
    crystalCityEditorPanel.open();
    showToast("水晶城搭建 · 左键放置 / 右键删除 / 汇聚高地", 2.8);
  });
}

// ---------- 圣城视角控制（面板「视角」行：居中 / 环视四周 / 到顶） ----------
// 以圣城为锚点摆放飞行中的飞艇：保持当前方位角，90° 步进环视，或升到顶端。
let citadelViewState = null; // { bearing, dist, height } —— 相对圣城的观察位
function citadelViewAction(action) {
  const citadel = messenger?.landmarks?.odysseyCitadel;
  const airship = messenger?.landmarks?.airship;
  if (!citadel || !airship) return;
  if (!airshipRide.isFlying?.()) {
    showToast("先乘坐航空艇，再调整圣城视角", 2);
    return;
  }
  const center = citadel.getWorldPosition(new THREE.Vector3());
  const up = center.clone().normalize();
  const obs = getCitadelObstacle();
  const topH = obs ? Math.max(10, obs.topRadial - center.length()) : 32; // 建筑净高
  if (!citadelViewState) {
    const b = airship.position.clone().sub(center);
    b.addScaledVector(up, -b.dot(up)); // 切平面方位
    citadelViewState = {
      bearing: b.lengthSq() > 1e-6 ? b.normalize() : new THREE.Vector3(1, 0, 0),
      dist: 40, // 艇身离圣城足够远，气囊不挡城堡
      height: topH * 0.55,
    };
  }
  const st = citadelViewState;
  if (action === "orbitL") st.bearing.applyAxisAngle(up, Math.PI / 2);
  else if (action === "orbitR") st.bearing.applyAxisAngle(up, -Math.PI / 2);
  else if (action === "top") st.height = topH + 6;
  else if (action === "center") st.height = topH * 0.55;
  const target = center
    .clone()
    .addScaledVector(up, action === "top" ? topH : st.height * 0.8);
  const pos = center
    .clone()
    .addScaledVector(st.bearing, st.dist)
    .addScaledVector(up, st.height);
  airshipRide.setPose?.(pos.clone().normalize(), pos.length() - PLANET_RADIUS, target);
}

// 场景 3D 直编辑：面板打开且乘坐航空艇时，点块顶面叠块 / 侧面改色 /
// 当前层空地加块 / 右键删块，悬停出幽灵块（townscaper.html 同款交互）。
const citadelSceneEdit = citadelEditorPanel
  ? createCitadelSceneEdit({
      dom: renderer.domElement,
      camera,
      scene,
      getCitadel: () => messenger?.landmarks?.odysseyCitadel || null,
      panel: citadelEditorPanel,
      canEdit: () => gameStarted && !!airshipRide.isFlying?.(),
      isUiEvent: isCitadelUiEvent,
      toast: showToast,
    })
  : null;

{
  const citadelPickRay = new THREE.Raycaster();
  const citadelPickNdc = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!citadelEditorPanel || e.button !== 0) return;
    // 只有乘坐航空艇时才能点选圣城
    if (!gameStarted || !airshipRide.isFlying?.()) return;
    if (isCitadelUiEvent(e)) return;
    // 面板已打开时左键归 3D 直编辑，不再重复弹面板
    if (citadelEditorPanel.isOpen()) return;
    if (crystalCityEditorPanel?.isOpen?.()) return;
    const citadel = messenger?.landmarks?.odysseyCitadel;
    if (!citadel) return;
    const rect = renderer.domElement.getBoundingClientRect();
    citadelPickNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    citadelPickRay.setFromCamera(citadelPickNdc, camera);
    const hits = citadelPickRay.intersectObject(citadel, true);
    // 梯湖/瀑布水系挂在场景根而非圣城容器：点湖面也应能开面板
    if (!hits.length) {
      const waterSteps = scene.getObjectByName("citadel-pilgrimage-water-steps");
      if (!waterSteps || !citadelPickRay.intersectObject(waterSteps, true).length) return;
    }
    citadelEditorPanel.open();
    showToast("已选中高山圣城 · 搭建面板已打开", 2.2);
  });
}

// [V] 进入/退出飞行器驾驶舱
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.code !== "KeyV") return;
  bubblePodRide?.forceExit?.();
  const on = aircraftRide.toggle();
  showToast(on ? "已进入飞行器驾驶舱 · [V] 退出" : "已退出飞行器驾驶舱", 2.4);
});

// [Q] 召唤航空艇飞到玩家正上方（idle 状态可用；面板编辑时 Q 归面板换层）
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.code !== "KeyQ") return;
  // 圣城/水晶城编辑面板打开时 Q 归面板使用（换层）
  if (citadelEditorPanel?.isOpen?.()) return;
  if (crystalCityEditorPanel?.isOpen?.()) return;
  if (!gameStarted) return;
  // 若飞艇状态卡在非 idle（异常未退出/刷新残留），先强制复位再召唤，避免 Q 失效
  if (airshipRide.getState?.() !== "idle") {
    airshipRide.forceExit?.();
  }
  const ok = airshipRide.summon?.();
  if (ok) {
    showToast("航空艇已降临到面前 · 走到绳下按 [F] 登艇", 2.6);
  } else {
    showToast("航空艇暂不可召唤", 1.6);
  }
});

// ---------- 天气（雨/雪/闪电/停雨彩虹，受风速风向影响） ----------
const weather = createWeatherSystem(scene, PLANET_RADIUS, {
  skyRing: messenger?.landmarks?.camp?.landmarks?.skyRing || null,
});

// ---------- 弹琴老人（近身 E 键播放 / 停止八音盒；老人已迁到旧港码头） ----------
const elderMusic = createElderMusicInteraction({
  player,
  // 优先码头上的老人（harbor 迁移后），回落营地引用
  elder:
    messenger?.landmarks?.oldHarbor?.landmarks?.elder ||
    messenger?.landmarks?.camp?.landmarks?.elder ||
    null,
  elHint: document.getElementById("elder-hint"),
  isGameStarted: () => gameStarted,
});
// 双保险：按名称在场景里再绑一次（避免 landmarks 路径漏引用）
{
  let found = null;
  const harborRoot = messenger?.landmarks?.harbor;
  harborRoot?.traverse?.((o) => {
    if (!found && (o.name === "music-elder" || o.userData?.musicKeys)) found = o;
  });
  if (!found) {
    scene.traverse((o) => {
      if (!found && o.name === "music-elder") found = o;
    });
  }
  if (found) elderMusic.setElder?.(found);
}

// ---------- 莫比斯结界：电车跨赤道时 2s 平滑过渡天空 ----------
// 北半球保持昼夜循环本色；电车入南（y<0）环境光/天色渐变为莫比斯粉紫
const MOEBIUS_SKY = new THREE.Color(0xebb9b6); // 莫比斯黄昏粉紫
const MOEBIUS_SUN = new THREE.Color(0xf0c294); // 暖橙日光
let moebiusFactor = 0;

// ---------- 送信人感叹气泡（暮云眺望云墙、手持信件时） ----------
let poemBubbleActive = false; // “烽火连三月，家书抵万金”是否已弹出

/**
 * 玩家是否“面对云墙”：取最近的轨道云墙塔，判断水平视线是否投向该塔。
 * 云墙沿书店→峡谷高架两侧，望向塔身即视为面对云墙。
 */
const _vToTower = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwdH = new THREE.Vector3();
const _towerH = new THREE.Vector3();
function isFacingCloudWall(p, cam, cloudWall) {
  const towers = cloudWall?.userData?.towers;
  if (!towers || !towers.length) return false;
  // 最近的一根云墙塔
  let best = null;
  let bestD = Infinity;
  for (const tw of towers) {
    const d = p.position.distanceToSquared(tw.position);
    if (d < bestD) {
      bestD = d;
      best = tw;
    }
  }
  if (!best) return false;
  _vToTower.copy(best.position).sub(p.position);
  // 仅取水平（切平面）分量：玩家“面对”云墙是朝向切向，而非纯抬头
  _up.copy(p.position).normalize();
  _towerH.copy(_vToTower).addScaledVector(_up, -_vToTower.dot(_up));
  if (_towerH.lengthSq() < 1e-4) return false; // 正下方/正上方，不计入
  _towerH.normalize();
  cam.getWorldDirection(_camFwd);
  _fwdH.copy(_camFwd).addScaledVector(_up, -_camFwd.dot(_up));
  if (_fwdH.lengthSq() < 1e-4) return false;
  _fwdH.normalize();
  return _fwdH.dot(_towerH) > 0.5; // 视线与指向云墙的切向夹角 < 60°
}

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

// ---------- 阿狸（E 站立跟随 · 球面 lerp 尾随 · 对话 · 随电车卧姿） ----------
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
  // 跟随中玩家上电车 → 阿狸上车卧在身旁
  isPlayerOnTram: () => tramRide.isRiding?.() ?? false,
  getActiveTram: () => tramRide.getActiveTram?.() ?? null,
  getFoxTramSeatLocal: () => tramRide.getFoxSeatLocal?.() ?? null,
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

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = performance.now() * 0.001;

  updateToast(dt);
  dayNight.update(dt);
  // 古堡拱窗：夜晚 70% 概率点亮，天亮熄灭，每夜重新抽签
  // 古堡拱窗：夜亮；纸士兵经过房屋时熄灯，次夜再点亮
  {
    const phase = dayNight.getPhase?.() ?? P.timeOfDay;
    const inf = messenger?.landmarks?.citadelRange?.nightInfiltration;
    const threats = collectInfiltrationThreats(inf);
    updateCitadelNightWindows(messenger?.landmarks?.odysseyCitadel, phase, {
      threats,
      threatRadius: 3.8,
    });
  }
  updateMoebiusBarrier(dt);
  weather.update(dt, player.position, { speed: P.windSpeed, dirDeg: P.windDir }, P.weather | 0);
  // 纳沃纳双栖广场：雨天蓄洪 / 晴雪泄回旱季广场（与天气联动）
  {
    const plaza = messenger?.landmarks?.citadelRange?.navonaPlaza;
    if (plaza?.setFlooded) {
      // weather mode: 0 晴 / 1 雨 / 2 雪 → 仅雨天 isFlooded
      plaza.setFlooded((P.weather | 0) === 1);
    }
  }
  mapEditor.tickHighlight?.(dt);
  citadelSceneEdit?.tick();

  // 搭乘接管：飞行器驾驶舱 / 气泡艇 / 电车 / 航空艇
  const riding =
    aircraftRide.update() ||
    bubblePodRide.update(dt) ||
    boatRide.update(dt) ||
    tramRide.update(dt) ||
    airshipRide.update(dt);
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
  updateScenes(sceneHandles, dt, t, { player, gameStarted, keys });
  // 故事板时间线（无故事板时内部直接返回）
  storyEngine.update(dt);

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
  // 驾驶舱第一人称（飞行器 / 气泡艇）由各自 update 写相机，跳过第三人称跟随
  const cockpitView = aircraftRide.isRiding?.() || bubblePodRide.isRiding?.();
  if (!cockpitView) cameraRig.update(dt);
  quest.updateInteraction(dt);
  elderMusic.update(dt, t);
  // 阿狸在任务气泡之后更新，避免被 hideBubble 冲掉
  foxNpc.update(dt, t);
  quest.updateCompass();
  quest.animateMarkers(t);
  minimap?.update();
  updateLanterns(lanterns, t);
  // 云墙搁置：仅在菜单开启时更新（含雷雨动画）
  if (isCloudWallEnabled() && equatorialClouds?.parent) {
    updateDynamicMoebiusClouds(equatorialClouds, t, sun, camera);
  }
  bookshopFlock?.update(dt, t); // 书店上方鸟群忽聚忽散
  devPanel.tick(dt);

  // ---------- 送信人念诗歌：手持信件 + 视野里有云墙即触发（云墙开启时） ----------
  {
    const hasLetter = !!player.holdingLetter;
    const facingWall =
      isCloudWallEnabled() &&
      isFacingCloudWall(player, camera, equatorialClouds);

    if (!poemBubbleActive && hasLetter && facingWall) {
      showBubble(
        "烽火连三月，家书抵万金",
        window.innerWidth / 2,
        window.innerHeight * 0.7
      );
      poemBubbleActive = true;
    }
    if (poemBubbleActive && (!hasLetter || !facingWall)) {
      hideBubble();
      poemBubbleActive = false;
    }
  }

  // ---------- 湖沼墨虎遇送信人：灯谜对答气泡 ----------
  {
    if (!window.__tmSwampTiger || !window.__tmSwampTiger.parent) {
      window.__tmSwampTiger = findSwampTiger(scene);
    }
    updateSwampTigerDialog({
      tiger: window.__tmSwampTiger,
      player,
      camera,
      dt,
      isGameStarted: () => gameStarted,
      // 念诗气泡占用时不抢
      isBlocked: () => poemBubbleActive,
    });
  }

  renderer.render(scene, camera);
}

animate();

// 调试：场景列表与句柄
window.__tm = {
  player,
  quest,
  cameraRig,
  camera, // 调试/验收截图用
  P,
  scene,
  planet,
  sceneIds,
  sceneHandles,
  listScenes,
  assetColliders,
  equatorialClouds,
  setCloudWallEnabled,
  isCloudWallEnabled,
  platforms,
  hills,
  mapEditor,
  citadelEditorPanel, // 圣城搭建面板（验收/调试用）
  storyEngine, // 故事板引擎（验收/调试用）
  storyboardPanel,
  tramRide,
  airshipRide,
  elderMusic,
  foxNpc,
  weather,
  touchControls,
};
