// =====================================================================
//  TigerMessenger 运行时入口（薄装配）
//  - 舞台 / 玩家 / 相机 / 输入 / 任务 / 音频 / 主循环
//  - 世界内容由 scenes/* 模块按需加载（?scene=messenger,saihoji）
// =====================================================================
import { Timer } from "three/addons/misc/Timer.js";
import * as THREE from "three";
import { createStage } from "./core/stage.js";
import { createPerfProbe } from "./tools/perfProbe.js";
import { createSceneCensus } from "./tools/sceneCensus.js";
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
  rebuildCitadelTownIncremental,
  computeCitadelDirtyCells,
  diffCitadelLayouts,
  rebuildCitadelTerrain,
  rebuildCitadelTerrainObjects,
  trimCitadelTownToTerrain,
  citadelTerrainCellSupported,
  updateCitadelNightWindows,
  syncCitadelWindowInstances,
} from "./world/odysseyCitadel.js";
import { collectInfiltrationThreats } from "./world/citadelTerraceBirds.js";
import {
  CITADEL_TOWN_SPEC,
  HIGHLAND_TOWNSCAPER_TOWN_SPEC,
  citadelGridCellCenter,
} from "./world/citadelTown.js?v=20260905-townscaper-palette-v1";
import { citadelColumnCenter } from "./world/citadel/gridMigration.js";
import { rebuildMoebiusCrystalMetropolis } from "./world/moebiusCity.js";
import { P, FEATURES, isOskLightingV1, isVoxelAoV1, isLocalLightBudgetV1 } from "./core/params.js";
import { createMiniBloom } from "./render/postprocessing/miniBloom.js";
import { nightWeightAt } from "./render/lighting/highlandLightVolumes.js";
import { createSceneDistanceCulling } from "./core/sceneDistanceCulling.js";
import { createIdleLightCulling } from "./render/lighting/idleLightCulling.js";
import { createLightPool } from "./render/lighting/lightPool.js";
import { createLightingDirector } from "./render/lighting/lightingDirector.js";
import { setLightingPresetOverrides } from "./render/lighting/lightingState.js";
import {
  getLocalLightHub,
  resolveLocalLightBudget,
} from "./render/lighting/localLightRegistry.js";
import { createLocalLightBridge } from "./render/lighting/localLightBridge.js";
import { createVoxelAoSystem } from "./render/ao/voxelAoRenderer.js";
import { createG8DebugOverlay } from "./render/debug/g8Overlay.js";
import { refreshTownV4 } from "./world/citadel/presentationMesh.js";
import { setupEnvironment, updateLanterns } from "./world/environment.js";
import { createDayNight } from "./world/dayNight.js";
import { createTramRide } from "./player/tramRide.js";
import { createAirshipRide } from "./player/airshipRide.js";
import { createAircraftRide } from "./player/aircraftRide.js";
import { createScoutAircraftRide } from "./player/scoutAircraftRide.js";
import { createBubblePodRide } from "./player/bubblePodRide.js";
import { createBoatRide } from "./player/boatRide.js";
import { createWeatherSystem } from "./world/weather.js";
import { seasonAt } from "./world/seasonBands.js";
import { createSeasonWeatherBias } from "./world/seasonWeatherBias.js";
import { createElderMusicInteraction } from "./world/elderMusic.js";
import { createFoxNpc } from "./world/foxNpc.js";
import {
  updateSwampTigerDialog,
  findSwampTiger,
} from "./world/moebiusTiger.js";
import { createTouchControls } from "./ui/touchControls.js";
import { createMinimap } from "./ui/minimap.js";
import { createShotHarnessPanel } from "./ui/shotHarnessPanel.js";
import { createPlanet, PLANET_RADIUS, applyPlanetNightGrade } from "./world/planet.js";
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
  resumeTramRideBgmIfWanted,
  isTramRideBgmPlaying,
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
import {
  resolveWorldLandmarks,
  locateWorldContext,
  visibleLandmarks,
} from "./world/worldStructure.js?v=20260905-world-structure-v1";

// ---------- 舞台 ----------
const { scene, camera, renderer } = createStage();
// 性能探针（F10 显隐 / F9 截图）。performance.now() 以页面导航为起点，
// 首帧读数即完整 boot 耗时，无需额外基准。
const perfProbe = createPerfProbe(renderer);
// 固定容量灯池：接管全部点光，常驻 lightPoolCapacity 盏代理灯追随最重要的灯位。
// 它与 idleLightCulling 会争抢同一批灯的 visible，所以二选一。回滚：?lightPoolV1=0
const lightPool = P.lightPoolV1 === false
  ? null
  : createLightPool({ scene, getCamera: () => camera, capacity: P.lightPoolCapacity ?? 8 });
// 空闲灯剔除：Three 的 intensity=0 灯仍占 uniform 槽位并参与逐片元循环，
// 实测 78 盏点光/聚光占 140ms / 62% 帧时间。回滚：?idleLightCullV1=0
const idleLightCulling = lightPool || P.idleLightCullV1 === false
  ? null
  : createIdleLightCulling({ scene });
// S18 夜港辉光：迷你 bloom（只让灯头/窗光/塔冠这类超亮自发光起晕；
// 强度乘夜权重——白天自动直出。回滚：P.nightBloomV1 = false）。
// S18 卡顿治理：小件静态装饰距离剔除（地平线天然遮蔽远处）
const distanceCulling = P.distanceCullV1
  ? createSceneDistanceCulling(THREE, {
      scene,
      getCamera: () => camera,
      planetRadius: 160,
      cullDistance: P.distanceCullMeters,
    })
  : null;
let nightBloom = P.nightBloomV1
  ? createMiniBloom(THREE, renderer, {
      strength: P.nightBloomStrength,
      threshold: P.nightBloomThreshold,
      getTimeOfDay: () => P.timeOfDay,
      nightWeightAt,
    })
  : null;
initQuestPanelCollapse();

// ---------- 环境光 / 天空（跨场景共享） ----------
const { lanterns, ambient, sun, skyMat, hemi, fill } = setupEnvironment(scene);

// ---------- V5 光照导演（?oskLightingV1=1）：rig 默认隐藏，旧四灯不受影响 ----------
const lightingV5 = isOskLightingV1();
const lightingDirector = createLightingDirector({
  scene,
  renderer,
  skyMat,
  legacy: { ambient, hemi, sun, fill },
});
if (lightingV5) lightingDirector.setEnabled(true);

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
// 灯池建在空场景上，这里场景已装配完毕，立刻接管以免首帧按 78 盏灯编译一次再重编译
lightPool?.recollect();
// 距离剔除同理：它内部 2.5s 后才首次 collect()，而 boot 要 5~8s——
// 那次快照拍在半空场景上，之后再不重收集，等于整个模块空转（实测隐藏数 0）。
distanceCulling?.recollect();

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
  // 3D 直编辑（搭建面板打开且可编辑）时右键用于删除体块，不触发相机平移
  isRightClickEditor: () => citadelSceneEdit?.isEditing?.() === true,
});

// bubblePodRide 稍后创建；触控环视在驾驶气泡艇时改为挪准星
let bubblePodRide = null;
let scoutAircraftRide = null;

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

/**
 * 送信人是否正在**驾驶载具**（飞艇 / 飞行器 / 侦察机 / 气泡艇 / 小船）。
 *
 * 为什么所有 E 键交互都要过这道闸：搭乘期间 `player.position` 被载具接管
 * （`airshipRide` 每帧 `player.position.copy(seat)`），于是「离 NPC 多近」量的
 * 其实是**座位**离 NPC 多近。飞艇停在村口、人坐在船上，按 E 就能隔着船舷跟
 * 地上的居民接信送信——主人 2026-09-05 报的就是这个。
 *
 * **电车不算**：那是公共交通，玩家是乘客不是驾驶员，阿狸还会跟着上车卧在
 * 身旁，车上聊天是原本就有的设计，不能顺手一起封掉。
 *
 * 写成函数声明（会提升）而不是 const 箭头：`quest` 在这些 ride 之前就构造了，
 * 只有提升过的函数名才能被它安全地闭包捕获。
 */
function isPlayerPilotingVehicle() {
  const air = airshipRide?.getState?.();
  if (air && air !== "idle") return true;
  if (aircraftRide?.isRiding?.()) return true;
  if (scoutAircraftRide?.isRiding?.()) return true;
  if (bubblePodRide?.isRiding?.()) return true;
  if (boatRide?.isRiding?.()) return true;
  return false;
}

// ---------- 任务（依赖平台；无 messenger 场景时任务仍可创建但不贴台） ----------
const quest = createQuestSystem({
  scene,
  platforms,
  player,
  messengerMesh,
  holdAura,
  camera,
  isGameStarted: () => gameStarted,
  isBusyRiding: isPlayerPilotingVehicle,
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
// 登记场景内置莫比斯湖沼（默认在水晶城旁；地图编辑器可拖动/存档/删除）
if (messenger?.landmarks?.moebiusSwamp) {
  mapEditor.registerFromWorld(
    "moebiusSwamp",
    messenger.landmarks.moebiusSwamp,
    0.6,
    null
  );
}
// 有本机布局时完整恢复（位置/朝向/招牌/增删），不再回落到初始化布局
mapEditor.loadPersisted();
// 地图打开时：3D 左键点选模型 → 地图同步选中高亮
mapEditor.bindScenePick({ camera, domElement: renderer.domElement });

// ---------- 世界空间结构：Planet → Region → Landmark → Zone ----------
// 声明在 world/worldStructure.js，这里只做「绑定到活的 scene handle」。
// makeVec 注入让它能取移动苔庭（骑在白鲸上）的实时世界位置，
// 同时 worldStructure.js 自身不 import Three.js，因而可 headless 测试。
const worldLandmarks = resolveWorldLandmarks({
  messenger,
  saihoji: sceneHandles.find((h) => h.id === "saihoji") ?? null,
  makeVec: () => new THREE.Vector3(),
});

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
  // 四级空间结构（Planet → Region → Landmark → Zone）：地标不再手写平铺，
  // 由 world/worldStructure.js 声明并绑定到活的 scene handle。
  // 三级导航 = Tier0 恒显 ∪ Tier1(当前区域) ∪ Tier2(苔庭六景)，
  // 这样六景不会和水晶城同级堆在 HUD 上。见 docs/WORLD_STRUCTURE_ARCHITECTURE.md
  landmarks: worldLandmarks,
  getVisible: () =>
    visibleLandmarks(
      worldLandmarks,
      locateWorldContext(player.position, worldLandmarks)
    ),
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

// 运行时截图工作台在 devPanel 之后装配；回调只在用户点击后执行，
// 因此可以安全引用下面完成初始化的 shotHarnessPanel。
let shotHarnessPanel = null;

const devPanel = createDevPanel({
  sun,
  ambient,
  lightingDirector,
  lightingV5,
  voxelAo: () => voxelAo, // 装配顺序在面板之后，惰性取值
  localLights: () => localLights,
  onCamDist: (d) => cameraRig.setDist(d),
  onOpenMap: () => mapEditor.setOpen(true),
  // 面板本体在后文装配；回调只会在开局后由用户点击，届时已完成初始化。
  onOpenCitadel: () => citadelEditorPanel?.open(),
  onOpenStoryboard: () => storyboardPanel.setOpen(true),
  onOpenShotHarness: () => shotHarnessPanel?.setOpen(true),
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
// V5（?oskLightingV1=1）：dayNight 只推进时钟并发布 sample，
// 太阳/天光/雾/天空由 LightingDirector 统一提交（PLAN 第九章）。
const dayNight = createDayNight({
  scene,
  skyMat,
  sun,
  ambient,
  hemi,
  fill,
  publishOnly: lightingV5,
  // 赤道云墙（MeshToonMaterial 近白基色）也要入夜染色，否则深夜仍亮着白天云带
  clouds: [...(messenger?.clouds || []), ...(equatorialClouds ? [equatorialClouds] : [])],
});

// ---------- shot-harness 能力并入主系统 ----------
// 这些 getter 不复制对象，只把真实场景中的根节点交给同一个 LightingDirector
// 做阴影拟合。因此开发验收看到的就是玩家实际会看到的地形/城堡/瀑布/木马。
shotHarnessPanel = createShotHarnessPanel({
  renderer,
  lightingDirector,
  subjects: {
    citadelEnsemble: () => [
      messenger?.landmarks?.citadelRange?.mesh,
      messenger?.landmarks?.odysseyCitadel,
      messenger?.landmarks?.citadelRange?.trojanHorse,
    ],
    citadelCascadeAudit: () => [
      messenger?.landmarks?.citadelRange?.pilgrimageCascades,
      messenger?.landmarks?.citadelRange?.trojanHorse,
      messenger?.landmarks?.citadelRange?.nightInfiltration?.root,
    ],
    citadelStairAudit: () => [
      messenger?.landmarks?.odysseyCitadel,
      messenger?.landmarks?.citadelRange?.pilgrimageWaterSteps,
    ],
    planetOskarV9: () => messenger?.landmarks?.planetV8?.root,
  },
  onEnableOskar: (version = "v9") => {
    const url = new URL(location.href);
    url.searchParams.set("worldVersion", version);
    url.searchParams.set("planetPresentationVersion", version);
    url.searchParams.delete("planetOskarV1");
    url.searchParams.set("shotLab", "1");
    location.assign(url.href);
  },
});
// V5 阴影焦点：城堡 + 木马 + 玩家（玩家移动时阴影框跟随，见主循环）；
// 不回退整颗星球——焦点过大 texel 过粗，阴影会糊成一片
lightingDirector.setFocus([
  messenger?.landmarks?.odysseyCitadel,
  messenger?.landmarks?.citadelRange?.trojanHorse,
  playerGroup,
].filter(Boolean));
if (new URLSearchParams(location.search).get("shotLab") === "1") {
  shotHarnessPanel?.setOpen(true);
}
// 验收便捷（?autostart=1）：跳过开场弹窗直接开始送信；配合
// ?timeOfDay=0.9 直接截夜景（四季/夜相验收用，替代手工点击时序）。
if (new URLSearchParams(location.search).get("autostart") === "1") {
  setTimeout(() => {
    const startButton = [...document.querySelectorAll("button")]
      .find((button) => button.textContent.trim() === "开始送信");
    startButton?.click();
  }, 1500);
}
// shadow coverage 调试视图：?v5ShadowDebug=1
const v5Params = new URLSearchParams(location.search);
if (v5Params.get("v5ShadowDebug") === "1") {
  lightingDirector.setShadowDebugVisible(true);
}
// K2 PCFSoft 对照 preset：?v5Shadow=soft（默认 paper 硬边纸艺）
if (v5Params.get("v5Shadow")) {
  lightingDirector.setShadowPreset(v5Params.get("v5Shadow"));
}

// ---------- K3 体素 AO 垂直样片（?oskLightingV1=1&voxelAoV1=1，挂在 V5 之下） ----------
// 范围：第一层瀑布—木马—相邻楼梯/门洞（Box3 并集外扩 ~20%，voxel 0.5）。
// 士兵/木马不写静态体积，用脚底 contact shadow 贴片；编辑器 dirty 与
// lightingDirector.invalidateShadowFit() 同步钩子（onApply / onTerrainObjectsChange）。
let voxelAo = null;
if (lightingV5 && isVoxelAoV1() && messenger?.landmarks?.citadelRange) {
  const cascades = messenger.landmarks.citadelRange.pilgrimageCascades;
  const firstWaterfall = cascades?.children?.at(-1) || cascades?.children?.[0] || null;
  const horse = messenger.landmarks.citadelRange.trojanHorse || null;
  const infiltrationRoot = messenger.landmarks.citadelRange.nightInfiltration?.root || null;
  // contact shadow 宿主：潜入士兵 + 系绳兵 + 木马本体（均不进静态 AO 体积）
  const contactShadows = [];
  for (const s of infiltrationRoot?.userData?.soldiers || []) {
    contactShadows.push({ object: s, radius: 0.55, opacity: 0.26 });
  }
  for (const s of horse?.userData?.tiedownSquad?.children || []) {
    contactShadows.push({ object: s, radius: 0.55, opacity: 0.26 });
  }
  if (horse) contactShadows.push({ object: horse, radius: 3.6, opacity: 0.22, y: 0.12 });
  voxelAo = createVoxelAoSystem({
    scene,
    renderer,
    camera,
    regionObjects: [firstWaterfall, horse].filter(Boolean),
    excludeRoots: [horse, infiltrationRoot].filter(Boolean),
    contactShadows,
    // ?voxelAoBudget=毫秒：e2e/调试用每帧预算（默认 4ms，生产不应调大）
    budgetMs: Number(v5Params.get("voxelAoBudget")) > 0 ? Number(v5Params.get("voxelAoBudget")) : 4,
    debug: v5Params.get("voxelAoDebug") || "",
  });
}

// ---------- K4 局部灯预算（?oskLightingV1=1 之下，缺省跟随 V5；?localLightBudgetV1=0 可单关） ----------
// 创建点（太阳盘/火炬/闪电/莫比斯资产等，见 docs/lighting-v5-audit.md）在构建期
// 已注册进 hub；桥接层在 V5 下静音原灯、用固定大小 PointLight 池承载 active 集合。
// ?localLightBudget=desktop|medium|low|数字 覆盖预算档（e2e/调试用）。
const localLightBudget = resolveLocalLightBudget(
  v5Params.get("localLightBudget") && Number.isFinite(+v5Params.get("localLightBudget"))
    ? +v5Params.get("localLightBudget")
    : v5Params.get("localLightBudget") || "desktop"
);
const localLights = createLocalLightBridge({
  scene,
  camera,
  registry: getLocalLightHub(),
  budget: localLightBudget,
  director: lightingDirector,
});
localLights.setEnabled(lightingV5 && isLocalLightBudgetV1());

// ---------- V6-G11 光照参数包（?lightingPreset=grok-v1；缺省=代码内置 legacy-incode） ----------
// versioned JSON（src/render/lighting/presets/）；加载/校验失败保持内置常量并只告警一次，
// 参数包只走 setLightingPresetOverrides 注入，不创建任何 Three Light。
const lightingPresetInfo = { name: "legacy-incode", loaded: false };
if (v5Params.get("lightingPreset")) {
  const presetName = v5Params.get("lightingPreset");
  fetch(`src/render/lighting/presets/${encodeURIComponent(presetName)}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((json) => {
      setLightingPresetOverrides(json);
      lightingPresetInfo.name = json.version || presetName;
      lightingPresetInfo.loaded = true;
    })
    .catch((err) =>
      console.warn("[lightingPreset] 加载失败，保持 legacy-incode：", err.message)
    );
}

// ---------- V6-G8 调试叠图（?g8Debug=wfc-entropy,hard-route,...；默认关，零开销） ----------
// 逗号分隔层 ID（全部 20 层 ID 见 render/debug/v6G8Layers.js）。有几何可视化的
// 层画 LineSegments/Points 叠图（depthTest 关、renderOrder 999）；其余层接受
// 但只出空叠图 + note。URL 直读模式同 v5ShadowDebug/localLightBudget。
const g8Debug = createG8DebugOverlay({
  THREE,
  scene,
  camera,
  getRuntime: () => {
    const lm = messenger?.landmarks;
    const v4rt = lm?.v4Runtime ?? lm?.odysseyCitadel?.userData?.v4Runtime ?? null;
    return {
      v4: v4rt?.v4 ?? null,
      citadel: lm?.odysseyCitadel ?? null,
      director: lightingDirector,
      registry: getLocalLightHub(),
      aoVolume: voxelAo?.volume ?? null,
      lightBudget: localLightBudget,
    };
  },
});
{
  const g8Param = v5Params.get("g8Debug");
  if (g8Param) {
    g8Debug.setLayers(g8Param.split(",").map((s) => s.trim()).filter(Boolean));
  }
}

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
    ensureAudio();
    const variant = tram?.userData?.variant === "red" ? "red" : "blue";
    setTramRideBgm(true, { fade: 0.7, variant });
    const color = variant === "blue" ? "蓝色" : "红色";
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
  const c = getCitadelTarget();
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
    scoutAircraftRide?.forceExit?.();
  },
});

// ---------- 小型侦察飞行器驾驶（靠近 [F] 登机 · WASD · Space/Ctrl 升降） ----------
scoutAircraftRide = createScoutAircraftRide({
  player,
  playerGroup,
  camera,
  cameraRig,
  keys,
  planetRadius: PLANET_RADIUS,
  getSquad: () => messenger?.landmarks?.scoutDefense || null,
  exitOtherRides: () => {
    airshipRide.forceExit?.();
    if (aircraftRide.isRiding?.()) aircraftRide.toggle();
    bubblePodRide?.forceExit?.();
  },
  elHint: document.getElementById("scout-hint"),
  toast: showToast,
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
    scoutAircraftRide?.forceExit?.();
  },
  onDismount: (left) => {
    // 运河船下船后吸附回航道继续巡游
    messenger?.landmarks?.canalBoats?.markNeedsSnap?.(left);
  },
});

// ---------- 高山圣城 · Townscaper 搭建面板 ----------
// 已开局时用鼠标左键点选圣城 → 弹出可拖拽/可收起的搭建面板；
// 面板编辑（2D 平面图 / 场景 3D 直编辑）→ rebuildCitadelTown 即时重建场景圣城
// → v2 布局写 localStorage。每座台地拥有五个 town-terrace-T-level-N 组。
function applyTownLayerVisibility(activeTerrace, activeLayer, hideAbove) {
  const layers = getCitadelTarget()?.userData?.layers;
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
  const citadel = getCitadelTarget();
  if (!citadel) return -1;
  // 无台地模式（运河交汇古堡）：堤岸方框内全部可放置
  if (citadel.userData?.skipOuterTerrain) {
    citadelSupportCache.set(key, 0);
    return 0;
  }
  // 高山圣城现与运河交汇古堡共用单格 Townscaper 构建面；中央核心
  // 留给不可删除的方尖碑及内部旋梯战斗，不允许普通建筑穿入。
  if (citadel.userData?.highlandTownscaperGrid) {
    const core = HIGHLAND_TOWNSCAPER_TOWN_SPEC.protectedCore;
    const protectedCell = Math.abs(ix - core.centerX) <= core.halfX
      && Math.abs(iz - core.centerZ) <= core.halfZ;
    const level = protectedCell ? -1 : 0;
    citadelSupportCache.set(key, level);
    return level;
  }
  // Pure canonical transform: safe even while the panel is still being
  // constructed, and exactly identical to both the 2D map and 3D generator.
  const gridV6 = citadel.userData?.gridV6;
  const c = citadelColumnCenter(ix, iz, {
    quad: gridV6?.quad ?? null,
    mapping: gridV6?.mapping ?? null,
    cellSize: CITADEL_TOWN_SPEC.cellSize,
    gridSize: citadel.userData?.townSpec?.gridSize,
  });
  const contour = citadel.userData?.contourSpec;
  if (!contour) return -1;
  if (!c) {
    citadelSupportCache.set(key, -1);
    return -1;
  }
  // 格级承重：瀑布缺口边缘格的中心可能落在被切掉的扇区里，
  // 但格体仍坐在台地顶面上——任一角点（格半宽处）支撑即允许放置。
  const level = citadelTerrainCellSupported(
    contour,
    c.x,
    c.z,
    terraceIndex,
    c.inradius
  )
    ? 0
    : -1;
  citadelSupportCache.set(key, level);
  return level;
}

/** 设计城堡层时收起圣城台地鸟群，关闭面板后恢复 */
function setCitadelDesignBirdsHidden(hidden) {
  const birds = messenger?.landmarks?.terraceBirds;
  birds?.setVisible?.(!hidden);
}

// 城堡实例注册表：目标切换（高山圣城 ⇄ 运河交汇古堡等）时，编辑/拾取/
// 重建全部指向当前目标实例。id=null 为高山圣城（默认，兼容旧档键）。
let citadelTargetId = null;
const citadelTargets = [];
if (messenger?.landmarks?.odysseyCitadel) {
  citadelTargets.push({
    id: null,
    name: "高山圣城",
    floors: messenger.landmarks.odysseyCitadel.userData.floors ?? 5,
    get: () => messenger.landmarks.odysseyCitadel,
    // 点选命中对象：城堡本体 + 圣城水系（梯湖/瀑布挂在场景根，单独兜底）
    pick: () => [messenger.landmarks.odysseyCitadel],
  });
}
if (messenger?.landmarks?.canalJunctionCitadel) {
  citadelTargets.push({
    id: "canal-junction",
    name: "运河交汇古堡",
    floors: messenger.landmarks.canalJunctionCitadel.userData.floors ?? 12,
    get: () => messenger.landmarks.canalJunctionCitadel,
    // 点选命中对象：古堡本体 + 运河堤岸高亮方框（方框即构建区，点框也能开面板）
    pick: () =>
      [messenger.landmarks.canalJunctionCitadel, messenger.landmarks.canalJunctionBox].filter(
        Boolean
      ),
  });
}
const getCitadelTarget = () => {
  const t = citadelTargets.find((x) => (x.id ?? null) === citadelTargetId) || citadelTargets[0];
  return t ? t.get() : null;
};

const citadelEditorPanel = messenger?.landmarks?.odysseyCitadel
  ? createCitadelEditorPanel({
      toast: showToast,
      onOpen: () => setCitadelDesignBirdsHidden(true),
      onClose: () => setCitadelDesignBirdsHidden(false),
      onLayerVisibility: applyTownLayerVisibility,
      onViewAction: citadelViewAction,
      getSupportLevel: citadelSupportAt,
      getInstanceId: () => citadelTargetId,
      getCitadelTarget: () => getCitadelTarget(),
      getLatestDesign: () => getCitadelTarget()?.userData?.highlandLatestDesign === true,
      getLatestUnits: () => getCitadelTarget()?.userData?.highlandLatestDesignRoot?.userData?.castleUnits ?? [],
      onHighlandUnitEdit: (patch) => {
        const citadel = getCitadelTarget();
        if (!citadel?.userData?.highlandLatestDesign) return { ok: false, error: "not-latest-highland-citadel" };
        const result = citadel.userData.highlandLatestDesignRoot?.userData?.editCastleUnit?.(patch.id, patch);
        if (result?.ok) {
          // 删掉的建筑其窗户仍由全城 InstancedMesh 照画，必须重算实例表
          syncCitadelWindowInstances(citadel);
          lightingDirector.invalidateShadowFit();
          voxelAo?.markWorldDirty(new THREE.Box3().setFromObject(citadel));
        }
        return result || { ok: false, error: "latest-unit-editor-unavailable" };
      },
      getTargets: () =>
        citadelTargets.map((t) => ({
          id: t.id,
          name: t.name,
          floors: t.get()?.userData?.floors ?? t.floors,
        })),
      onTargetChange: (id) => {
        citadelTargetId = id ?? null;
        citadelSupportCache.clear();
        citadelObstacle = null;
        showToast(
          citadelTargetId
            ? `已切换到「${citadelTargets.find((t) => t.id === id)?.name ?? id}」`
            : "已切换回「高山圣城」",
          1.4
        );
      },
      onTerrainChange: (contour) => {
        const citadel = getCitadelTarget();
        rebuildCitadelTerrain(citadel, contour);
        // 高山实例才接护城河/梯湖/运河（第二实例是平地运河畔，无圣城水系）
        if (!citadelTargetId) {
          messenger.landmarks.citadelRange?.rebuildWaterTerraces?.(contour);
          messenger.landmarks.citadelRange?.rebuildMoat?.(contour?.moat);
        }
        citadelSupportCache.clear();
        citadelObstacle = null; // 净空区下帧重算
        // 台地-建筑放置有效性闭环：半径/层高缩放后，越界建筑自动裁剪并重建。
        const trim = trimCitadelTownToTerrain(citadel, contour);
        if (trim.trimmed > 0) {
          citadelEditorPanel?.syncTrimmedLayout?.(citadel.userData.townSpec);
          showToast(`台地缩放：已自动移除 ${trim.trimmed} 个越界建筑格`, 2.4);
        }
      },
      onTerrainObjectsChange: (objects) => {
        rebuildCitadelTerrainObjects(getCitadelTarget(), objects);
        citadelObstacle = null;
        lightingDirector.invalidateShadowFit(); // 地形件变了，V5 阴影下帧重拟合
        // K3：地形件 dirty → 体素 AO 只重栅格受影响切片（与体积求交，交不上即跳过）
        voxelAo?.markWorldDirty(new THREE.Box3().setFromObject(getCitadelTarget()));
      },
      onApply: (layout) => {
        // 编辑器提交的是 v2 五台地布局对象（{ terraces: [...] }），不能再包进
        // 旧版单城堡的 `levels` 字段；否则归一化时会得到五座空城堡。
        const citadel = getCitadelTarget();
        // G30-A（2026-08-26）：布局 diff → 增量重建（只重建 dirty 邻域）。
        // 无差异/差异过多/失败时回退全量 rebuild，保证编辑器行为不降级。
        let stats;
        const prevLayout = citadel.userData?.townSpec ?? null;
        if (prevLayout) {
          const edits = diffCitadelLayouts(prevLayout, layout);
          if (edits.length && edits.length <= 64) {
            const dirty = computeCitadelDirtyCells(edits);
            const incr = rebuildCitadelTownIncremental(citadel, layout, [...dirty], { debounceMs: 400 });
            stats = incr.ok ? incr.stats : rebuildCitadelTown(citadel, layout);
          } else {
            stats = rebuildCitadelTown(citadel, layout);
          }
        } else {
          stats = rebuildCitadelTown(citadel, layout);
        }
        citadelObstacle = null; // 建筑体量变了，净空区下帧重算
        citadelSupportCache.clear(); // 包围盒可能变，支撑缓存失效
        lightingDirector.invalidateShadowFit(); // 建筑 dirty → V5 阴影重拟合
        // K3：建筑 dirty → 体素 AO 受影响切片重栅格（与 invalidateShadowFit 同钩子）
        voxelAo?.markWorldDirty(new THREE.Box3().setFromObject(citadel));
        // 重建后 level 组全部换新，按面板状态重新断言一次可见性
        const st = citadelEditorPanel?.getState?.();
        if (st) applyTownLayerVisibility(st.activeTerrace, st.activeLayer, st.hideAbove);
        refreshTownV4(citadel, FEATURES.terrainSeed);
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
      t.closest("#shot-harness-panel") ||
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
        // 峡谷水城：湖固定于峡谷中心（fixedLevel 水位恒定），重建后复位出厂湖位
        const lake = messenger.landmarks.citySeaLake;
        if (lake?.relocate) {
          lake.relocate(lake.defaultCenterDir);
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
  const citadel = getCitadelTarget();
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

// 场景 3D 直编辑：面板打开（已开局）时，点块顶面叠块 / 侧面改色 /
// 当前层空地加块 / 右键删块，悬停出幽灵块（townscaper.html 同款交互）。
let citadelSceneEdit = citadelEditorPanel
  ? createCitadelSceneEdit({
      dom: renderer.domElement,
      camera,
      scene,
      getCitadel: () => getCitadelTarget(),
      panel: citadelEditorPanel,
      canEdit: () => gameStarted, // 已开局即可编辑（不再要求航空艇）
      isUiEvent: isCitadelUiEvent,
      toast: showToast,
    })
  : null;

{
  const citadelPickRay = new THREE.Raycaster();
  citadelPickRay.layers.enable(1);
  const citadelPickNdc = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!citadelEditorPanel || e.button !== 0) return;
    // 已开局即可点选圣城/运河古堡弹搭建菜单（不再要求乘坐航空艇）
    if (!gameStarted) return;
    if (isCitadelUiEvent(e)) return;
    // 面板已打开时左键归 3D 直编辑，不再重复弹面板
    if (citadelEditorPanel.isOpen()) return;
    if (crystalCityEditorPanel?.isOpen?.()) return;
    const rect = renderer.domElement.getBoundingClientRect();
    citadelPickNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    citadelPickRay.setFromCamera(citadelPickNdc, camera);
    // 遍历全部城堡实例：命中哪个就自动切到哪个目标（高山圣城 ⇄ 运河交汇古堡）。
    // 运河古堡的堤岸高亮方框也是命中对象：点高亮框即可开面板构建。
    let hit = null;
    for (const t of citadelTargets) {
      const objs = t.pick ? t.pick() : [t.get()];
      for (const o of objs) {
        if (o && citadelPickRay.intersectObject(o, true).length) {
          hit = t;
          break;
        }
      }
      if (hit) break;
    }
    // 梯湖/瀑布水系挂在场景根而非圣城容器：点湖面也应能开面板（仅高山实例）
    if (!hit) {
      const waterSteps = scene.getObjectByName("citadel-pilgrimage-water-steps");
      if (!waterSteps || !citadelPickRay.intersectObject(waterSteps, true).length) return;
      hit = citadelTargets[0];
    }
    if (!hit) return;
    if ((hit.id ?? null) !== citadelTargetId) {
      // 点选命中非当前目标：自动切换（含存档键与 3D 目标），再打开面板
      citadelTargetId = hit.id ?? null;
      citadelSupportCache.clear();
      citadelObstacle = null;
      citadelEditorPanel.switchTarget?.(() => true);
    }
    showToast(`已选中「${hit.name}」· 搭建面板已打开`, 2.2);
    citadelEditorPanel.open();
  });
}

// [V] 进入/退出飞行器驾驶舱
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.code !== "KeyV") return;
  scoutAircraftRide?.forceExit?.();
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
const seasonWeatherBias = createSeasonWeatherBias({ initialSeason: "summer", hysteresisSec: 3.0 });

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
  isBusyRiding: isPlayerPilotingVehicle,
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
  if (lightingDirector.isEnabled()) {
    // V5：结界染色作为 override 交给导演合成，不直接改灯/天空
    lightingDirector.setMoebiusFactor(moebiusFactor);
    return;
  }
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
  isBusyRiding: isPlayerPilotingVehicle,
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

/**
 * 渲染的最后一道保险：render 抛异常时不许把画面钉死。
 *
 * 2026-09-05 主人报「系统播放声音，但是无法继续编辑，画面不动了」，控制台
 * 每帧刷同一条 THREE.WebGLAttributes 尺寸不符。根因已经在
 * mergedCellPatch.js 修掉了，但这里暴露出一个更要命的结构问题：
 * **render 一旦持续抛异常，整个应用就只剩音频还活着**。rAF 在函数头就排好了
 * 下一帧，逻辑其实一直在跑，只是画面再也不更新——用户看到的是「死机」，
 * 于是只能杀掉页面，正在编辑的城堡跟着没了。
 *
 * 所以这里把它降级成「画面可能有瑕疵，但还能操作」：
 *   · 第一次失败打完整堆栈（要能定位，不能吞）
 *   · 之后同类错误按次数收敛，不刷屏
 *   · 无论如何不让异常逃出 animate，编辑器、快捷键、存档继续可用
 */
let renderFailures = 0;
let lastRenderError = "";
function safeRender() {
  try {
    renderer.render(scene, camera);
    renderFailures = 0;
  } catch (error) {
    const msg = error?.message || String(error);
    renderFailures++;
    if (renderFailures === 1 || msg !== lastRenderError) {
      console.error("[render] 本帧渲染失败（画面可能停更，但编辑器仍可操作）：", error);
      lastRenderError = msg;
    } else if (renderFailures === 60 || renderFailures % 600 === 0) {
      console.error(`[render] 已连续 ${renderFailures} 帧渲染失败：${msg}`);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = performance.now() * 0.001;

  updateToast(dt);
  dayNight.update(dt);
  // K4 局部灯桥接：先于导演合成，闪电 override 当帧生效（关时 no-op）
  localLights.update(dt);
  // V5 光照导演：开关开时由它提交全局灯/雾/天空/exposure（关时 no-op）
  lightingDirector.update(dt, { timeOfDay: dayNight.getPhase?.() ?? P.timeOfDay, weather: P.weather | 0 });
  // S16 背光高光：圣城山体反向轮廓层随太阳方向 + 相机位置驱动
  {
    const backlit = messenger?.landmarks?.odysseyCitadel?.userData?.highlandBacklit;
    if (backlit?.update) {
      const sunState = lightingDirector.getState?.();
      const sunDir = sunState?.sunDirection;
      if (sunDir && camera?.position) {
        backlit.update({ x: sunDir[0], y: sunDir[1], z: sunDir[2] }, camera.position);
      }
    }
  }
  // K3 体素 AO：dirty 分帧调度（任一切片 ≤4ms；未开启时 voxelAo 为 null）
  voxelAo?.update(dt);
  // V6-G8 调试叠图：节流重建动态层；未启用时内部直接返回（零开销）
  g8Debug.update(dt);
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
    // 交汇古堡也有自己的一套窗实例表；漏掉它，那边的窗永远不会随建筑增删重算
    updateCitadelNightWindows(messenger?.landmarks?.canalJunctionCitadel, phase, {
      threats,
      threatRadius: 3.8,
    });
  }
  updateMoebiusBarrier(dt);
  // 季相天气偏置（E5）：按玩家当前所处季相带温和偏置天气（冬雪/春雨/夏秋晴），3 秒滞后防抖
  if (player?.position) {
    const season = seasonAt(player.position);
    seasonWeatherBias.update(dt, season?.name, P);
  }
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
  citadelSceneEdit?.tick(dt);

  // 搭乘接管：飞行器驾驶舱 / 气泡艇 / 电车 / 航空艇
  const riding =
    scoutAircraftRide?.update(dt) ||
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

  // 电车搭乘 BGM：车上必须保持电车曲。峡谷曲只记 wanted，声道不抢。
  {
    const onTram = tramRide.isRiding?.() === true;
    if (onTram && !isTramRideBgmPlaying()) resumeTramRideBgmIfWanted();
    const tramSystem = messenger?.landmarks?.tramSystem;
    let wantCanyonBgm = false;
    if (onTram && tramSystem?.getCanyonAudioCue) {
      const tram =
        tramRide.getActiveTram?.() ||
        tramSystem.getNearestTram?.(player.position) ||
        tramSystem.tram ||
        null;
      const cue = tramSystem.getCanyonAudioCue(tram);
      if (cue && (cue.inCanyon || cue.secondsToEntry <= 10)) wantCanyonBgm = true;
    }
    if (isCanyonBgmPlaying() && onTram && tramSystem?.getCanyonAudioCue) {
      const tram =
        tramRide.getActiveTram?.() ||
        tramSystem.getNearestTram?.(player.position) ||
        tramSystem.tram ||
        null;
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
  const cockpitView =
    scoutAircraftRide?.isRiding?.() || aircraftRide.isRiding?.() || bubblePodRide.isRiding?.();
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

  // 新视觉系统一律 try 护罩：单系统异常只禁用自身，绝不杀主渲染循环
  try {
    if (distanceCulling) distanceCulling.update(dt);
  } catch (error) {
    console.warn("[perf] distance culling disabled:", error?.message);
    distanceCulling?.dispose?.();
  }
  try {
    lightPool?.update(dt);
  } catch (error) {
    console.warn("[perf] light pool disabled:", error?.message);
    lightPool?.dispose?.();
  }
  try {
    // 熄灭的灯必须 visible=false 才能移出光照 uniform 数组（仅调 intensity 不省钱）
    idleLightCulling?.update(dt);
  } catch (error) {
    console.warn("[perf] idle light culling disabled:", error?.message);
    idleLightCulling?.dispose?.();
  }
  try {
    // 星球夜相（B·V8/C·V9 夜港对齐）：球壳在 V8/V9 就是地平线以外的天空，
    // 夜里压成深蓝，不再透出灰绿/粉调
    if (planet?.material) applyPlanetNightGrade(planet.material, nightWeightAt(P.timeOfDay));
  } catch (error) {
    console.warn("[perf] planet night grade disabled:", error?.message);
  }
  if (nightBloom) {
    try {
      nightBloom.setSize(renderer.domElement.width, renderer.domElement.height);
      nightBloom.render(scene, camera);
    } catch (error) {
      console.warn("[perf] bloom disabled:", error?.message);
      nightBloom.dispose?.();
      // ⚠️ 必须置空。原来只 dispose 不置空，下一帧照样走进这个分支再抛一次，
      // 于是控制台每帧刷一行「bloom disabled」，而 catch 里的兜底 render 也在
      // 抛——异常从 animate 里逃出去，画面停在最后一帧
      // （主人 2026-09-05 贴的那几千行同一条报错就是这么来的）。
      nightBloom = null;
      safeRender();
    }
  } else {
    safeRender();
  }
  // 必须在 render 之后读，renderer.info 才是本帧的真实提交数
  perfProbe?.update(dt);
}

animate();

// 性能探针快捷键：F9 下载截图 / F10 显隐 HUD
window.addEventListener("keydown", (e) => {
  if (e.key === "F9") {
    e.preventDefault();
    perfProbe?.capture(null, scene, camera);
  } else if (e.key === "F10") {
    e.preventDefault();
    perfProbe?.setVisible(!perfProbe.isVisible());
  }
});

// 调试：场景列表与句柄
/**
 * 舰队自检（主人 2026-09-05 反复反馈「没形成以 aircraft 为主导的舰队 / 没伴飞」）。
 *
 * 之前每轮都是「我改代码 → 主人看画面 → 还是不像」，没有中间那把尺子，
 * 谁也说不清是逻辑没接上、还是浏览器还在跑旧模块、还是当下正处在任务的某一段。
 * 这个函数就是那把尺子：**只读**，按名字从场景里现取，不依赖任何内部句柄。
 *
 *   __tm.fleet()
 *
 * 读法：
 *   · aircraft.n  = 0            → 机队根本没建，后面都不用看
 *   · pods.strayed > 0           → 泡机掉在 scene 下没回僚机翼，不会伴飞
 *   · haulers.visible = 0 且 phase 为 idle/done → 运输艇没在随队巡航
 *   · haulers.dist 很大且不收敛   → 跟位没生效
 *   · phase 一直停在某一段         → 任务卡住了，去看 vanguardAssault
 */
function fleetSelfCheck() {
  const V3 = THREE.Vector3;
  const squad = scene.getObjectByName("moebius-aircraft-squad");
  const members = (squad?.userData?.members || []).filter((m) => m?.parent);
  const wing = squad?.userData?.gatePodEscort || null;
  const pods = [];
  scene.traverse((o) => { if (o.userData?.escortSlot) pods.push(o); });
  const haulers = [];
  scene.traverse((o) => { if (/^vanguard-hauler-/.test(o.name || "")) haulers.push(o); });
  const troops = scene.getObjectByName("vanguard-squad");

  const center = new V3();
  for (const m of members) center.add(m.getWorldPosition(new V3()));
  if (members.length) center.multiplyScalar(1 / members.length);
  const groundTrack = members.length
    ? center.clone().normalize().multiplyScalar(PLANET_RADIUS)
    : null;
  const dist = (o) => (groundTrack ? +o.getWorldPosition(new V3()).distanceTo(groundTrack).toFixed(1) : null);

  // messenger 是 sceneHandles 里的场景句柄，vanguardAssault 挂在它身上（main.js:1780 已注明）
  const assault = messenger?.vanguardAssault || messenger?.combatPack?.vanguardAssault || null;
  return {
    phase: assault?.phase?.() ?? "(无 vanguardAssault)",
    aircraft: { n: members.length, center: center.toArray().map((v) => +v.toFixed(1)) },
    pods: {
      n: pods.length,
      inWing: pods.filter((p) => wing && p.parent === wing).length,
      strayed: pods.filter((p) => !wing || p.parent !== wing).length,
      dist: pods.map(dist),
    },
    haulers: {
      n: haulers.length,
      visible: haulers.filter((h) => h.visible).length,
      dist: haulers.map(dist),
    },
    troopers: { visible: !!troops?.visible, state: troops?.userData?.state ?? "(无)" },
  };
}

window.__tm = {
  THREE, // 控制台调试用：new __tm.THREE.Raycaster() 等
  fleet: fleetSelfCheck, // 舰队自检：__tm.fleet()——见上方读法
  player,
  quest,
  cameraRig,
  camera, // 调试/验收截图用
  renderer, // 性能探针读取 draw calls / triangles
  P,
  scene,
  planet,
  perfProbe, // 性能探针：__tm.perfProbe.snapshot() / .capture()
  census: createSceneCensus({ renderer, scene, getCamera: () => camera }), // __tm.census.run()
  idleLightCulling, // 空闲灯剔除：__tm.idleLightCulling.activeCount
  lightPool, // 固定容量灯池：__tm.lightPool.adoptedCount / .activeCount
  distanceCulling, // 距离剔除：__tm.distanceCulling.entryCount / .visibleCount
  FEATURES, // 世界档诊断：应恒为 worldVersion "custom"
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
  scoutAircraftRide,
  elderMusic,
  foxNpc,
  weather,
  seasonWeatherBias, // E5 季相天气偏置
  lightingDirector, // V5 光照导演（验收/调试用）
  shotHarness: shotHarnessPanel, // 运行时截图 / OskSta A-B 工作台
  voxelAo, // K3 体素 AO 垂直样片（验收/调试用，未开启为 null）
  localLights, // K4 局部灯预算桥接（验收/调试用）
  g8Debug, // V6-G8 调试层叠图（验收/调试用，默认空层零开销）
  lightingPresetInfo, // V6-G11 光照参数包加载状态（?lightingPreset=grok-v1）
  touchControls,
  messenger, // messengerIsland 场景句柄（含 vanguardAssault：苔庭之战任务，验收可驱动）
};
