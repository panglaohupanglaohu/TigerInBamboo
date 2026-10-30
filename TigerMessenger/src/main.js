import {createMorrisPrincessPatrol} from './world/morrisPrincessPatrol.js?v=morris-threeview-r81';
import {createMorrisHorseRide} from './player/morrisHorseRide.js?v=morris-profile-route-r57';
import {installMorrisIslandPresentation} from './ui/morrisIslandPresentation.js?v=threeview-r81';
import {sfxLaserSwing} from './audio/worldSfx.js';
import {vanguardRosterSlot,vanguardMuzzleWorld} from './world/vanguardTrooper.js';
import { batianObstacleRadius } from './world/batianDestination.js';
import { createBatianFleet } from './world/batianFleet.js?v=heavy-cover-r3-20261025';
import { installCrystalColossus } from './assets/crystalColossus.js';
import {createStartupProgress,runStartupSteps} from './core/startupTasks.js';
import {sampleSwampRimGround,sampleSwampAuthoredGround,sampleSwampStairGround} from './world/swampPlayerSupport.js';
import {createSwampEdgeGuard,createEdgeGuard,installSwampEntranceBridge} from './world/swampEdgeGuard.js';
import {PLAYER_RADIUS as GUARD_PLAYER_RADIUS} from './core/constants.js';
import {clearSwampCavity,clearSwampAirspace} from './world/swampCavityClearance.js';
import {createSwampWalkwaySteer} from './world/swampWalkwaySteer.js';
import {createSwampCameraProfile} from './world/swampCameraProfile.js';
import {installSwampOcclusionFade} from './world/swampOcclusionFade.js';
import {createSwampInkPost} from './world/swampInkPost.js';
import {installSwampHandInk} from './world/swampHandInk.js';
import {installSwampWaterMarks} from './world/swampWaterMarks.js';
import {installSwampPaintWater} from './world/swampPaintWater.js';
import {installSwampTreeRoots} from './world/swampTreeRoots.js';
import {installSwampWaterfalls} from './world/swampWaterfalls.js';
import {installSwampRimFlowers} from './world/swampRimFlowers.js';
import {installSwampFloatingDebris} from './world/swampFloatingDebris.js';
import {installSwampWhaleCalves} from './world/swampWhaleCalves.js';
import {installSwampHarborScene} from './world/swampHarborScene.js';
import {applySwampTargetPass} from './world/swampTargetPass.js';
import {installSwampAirHaze} from './world/swampAirHaze.js';
import {canyonOffsetDir as swampGuardCanyonOffset} from './world/canyon.js';
import {citadelWalkLiftDir as swampGuardCitadelLift} from './world/citadelRange.js';
import {createSwampCameraOccluders} from './world/swampCameraOcclusion.js';
import {createTargetCityProductionOptions} from './world/citadel/targetCityProductionOptions.js';
import {createCitadelPlazaGuardian} from './world/citadel/citadelPlazaGuardian.js';
import {createCitadelGuardianAtmosphere} from './world/citadel/citadelGuardianAtmosphere.js';
import {createTargetEastCrossingStartupSupport} from './world/citadel/targetEastCrossingStartupSupport.js';
import {installTargetCityRuntimeSteps} from './world/citadel/targetCityRuntime.js?v=varied-clouds-20261024';
import {installTargetCityPresentation} from './ui/targetCityPresentation.js?v=coral-view-20261024';
import {installMoonLakePresentation} from './ui/moonLakePresentation.js?v=moon-coast-r4d-20261025';
import {targetCityRuntimeEnabled} from './world/citadel/targetCityRelease.js';
import {nearestCitadelTarget,isCitadelClick} from './ui/citadelTargetPicking.js?v=morris-editor-block-r57';
import {setSfxListener,updateWorldSfx,hintEngine,sfxBombRelease,sfxSmallExplosion,sfxEnergyPulse,sfxBatianBombRelease,sfxBatianBombFall,sfxBatianBombExplosion,sfxBatianShieldHit,sfxBoltCharge,sfxBoltFire,sfxBoltHit,sfxRobotShot} from './audio/worldSfx.js';
import {createRobotGreeting} from './gameplay/robotGreeting.js';
import {createRobotOperations} from './gameplay/robotOps/runtime.js?v=morris-walk-r40';
import {createJunctionPlayerSupport} from './world/canalJunctionTarget.js';
import {createCitadelPlayerWalls,createCitadelCameraOccluders} from './world/citadel/playerWalls.js';
import {createCitadelPlayerGround} from './world/citadel/playerGround.js';
import {createTargetCityPlayerNavigation} from './world/citadel/targetCityPlayerNavigation.js';
import {levelNewCityPlaza} from './world/citadel/levelNewCityPlaza.js';
import {createRadialHeightIndex} from './world/radialHeightIndex.js';
import {officialOceanLevelAt as batianOceanLevelAt} from './world/waterV8/officialOcean.js';
import {installGateApproachRailings} from './world/gateApproachRailings.js';
import {createGatePlayerGround,createGatePlayerWalls} from './world/gateTarget.js';
import { bindOriginalWorldRomanArmor } from "./world/romanWorldArmor.js";
// =====================================================================
//  TigerMessenger 运行时入口（薄装配）
//  - 舞台 / 玩家 / 相机 / 输入 / 任务 / 音频 / 主循环
//  - 世界内容由 scenes/* 模块按需加载（?scene=messenger,saihoji）
// =====================================================================
import { Timer } from "three/addons/misc/Timer.js";
import * as THREE from "three";
import { createStage } from "./core/stage.js";
import { createPerfProbe } from "./tools/perfProbe.js?v=remote-clearance-20261025";
import { createSceneCensus } from "./tools/sceneCensus.js";
import { createInput } from "./core/input.js";
import { createCameraRig } from "./core/camera.js?v=airship-down15-20261025";
import { morrisViewer } from "./world/morrisViewer.js";
import { createDevPanel } from "./core/devPanel.js?v=morris-profile-route-r57";
import { createStoryEngine } from "./story/storyEngine.js";
import { createRescueCampaign } from "./story/rescueCampaign.js";
import { createTigerCompanion } from "./gameplay/tigerCompanion.js";
import { requestStoryboard } from "./story/storyLLM.js";
import { createStoryboardPanel } from "./story/storyboardPanel.js";
import { createMapEditor } from "./core/mapEditor.js";
import { createCitadelEditorPanel } from "./ui/citadelEditorPanel.js";
import { createCitadelSceneEdit } from "./ui/citadelSceneEdit.js?v=morris-editor-block-r57";
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
import { createSceneDistanceCulling } from "./core/sceneDistanceCulling.js?v=courier-culling-r1";
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
import { createBookshopAtmosphere } from "./world/bookshopAtmosphere.js";
import { installBookshopJakubPass } from "./world/bookshopJakubPass.js";
import { bookshopRaiseAtWorld, BOOKSHOP_TERRACE } from "./world/bookshopTownSite.js";
import { createTramRide } from "./player/tramRide.js";
import { createAirshipRide } from "./player/airshipRide.js?v=airship-down15-20261025";
import { handleAirshipSummonShortcut } from "./player/airshipSummonShortcut.js";
import { createAircraftRide } from "./player/aircraftRide.js";
import { createScoutAircraftRide } from "./player/scoutAircraftRide.js";
import { createBubblePodRide } from "./player/bubblePodRide.js";
import { createBoatRide } from "./player/boatRide.js";
import { createWeatherSystem } from "./world/weather.js";
import { seasonAt } from "./world/seasonBands.js";
import { createSeasonWeatherBias } from "./world/seasonWeatherBias.js";
import { createElderMusicInteraction } from "./world/elderMusic.js?v=mounted-elder-r1";
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
import { createPlayer, syncPlayerVisual } from "./player/player.js?v=head-profile-20261028";
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
  updateBgmListenerContext,
  getMorrisGardenBgmSnapshot,
  getBgmOwnershipSnapshot,
  startAmbience,
  startTramSound,
  sfxJump,
  setTramRideBgm,
  resumeTramRideBgmIfWanted,
  isTramRideBgmPlaying,
  setCanyonApproachBgm,
  isCanyonBgmPlaying,
  setSiegeAssaultBgm,
  setBatianBattleBgm,
} from "./audio/sfx.js";
import { journalCount } from "./quest/letterJournal.js";
import {
  resolveSceneIdsFromUrl,
  loadScenesIncrementally,
  listScenes,
} from "./scenes/registry.js?v=morris-threeview-r81";
import { mergeColliders, updateScenes } from "./scenes/sceneApi.js";
import {
  resolveWorldLandmarks,
  locateWorldContext,
  visibleLandmarks,
} from "./world/worldStructure.js?v=20260905-world-structure-v1";

// ---------- 舞台 ----------
const { scene, camera, renderer } = createStage();
morrisViewer.camera = camera;
let targetCityRuntime=null;
let citadelGuardian=null;
let targetCityInspection=null;
let moonLakeInspection=null;
let morrisInspection=null,morrisStartupTourShown=false;
// Include the scene and every post-processing pass in frame diagnostics.
renderer.info.autoReset = false;
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
// The jointly rendered east crossing is now the normal messenger build.
// Explicit =0 retains the previous release for rollback; no camera/spawn change.
let citadelEastGlobalCrossing=null;
if(sceneIds.includes('messenger')&&targetCityRuntimeEnabled()&&new URLSearchParams(location.search).get('citadelEastCrossing')!=='0'){
  if(!targetCityRuntimeEnabled())throw new Error('East crossing requires the normal target-city runtime');
  const base=new URL('../artifacts/pipeline/citadel-east-shore-route-20261006/',import.meta.url);
  const [artifactResponse,auditResponse]=await Promise.all([
    fetch(new URL('remesh-final-surface-geometry.json',base)),
    fetch(new URL('remesh-expanded-shift-audit.json',base)),
  ]);
  if(!artifactResponse.ok||!auditResponse.ok)throw new Error('Audited east crossing startup data unavailable');
  const [terrainArtifact,audit]=await Promise.all([artifactResponse.json(),auditResponse.json()]);
  citadelEastGlobalCrossing={enabled:true,terrainArtifact,candidateInput:audit.candidateInput};
}
const startup = createStartupProgress();
window.__tmStartup = startup.report;
const sceneHandles = await loadScenesIncrementally(sceneIds, {
  scene,
  planetRadius: PLANET_RADIUS,
  planet,
  options: {
    // 苔海六景密度；石组位置与数量由庭园构图固定。
    saihoji: { seed: 884, mossCount: 132 },
    citadelEastGlobalCrossing,
  },
}, startup.checkpoint);
await startup.checkpoint('正在连接角色与游戏控制…');

// 从已加载场景中取玩法依赖（平台/土坡）；若未加载 messenger 则为空
const originalWorldRomanArmor = bindOriginalWorldRomanArmor(scene);
const messenger = sceneHandles.find((h) => h.id === "messenger") || null;

// ---------- 城头云墙（搁置中：默认不进场景，开发者菜单可开关） ----------
const CLOUD_WALL_KEY = "tm.equatorialClouds.enabled";
const trackCurve = messenger?.landmarks?.tramSystem?.curve ?? null;
const equatorialClouds = createDynamicMoebiusClouds(scene, PLANET_RADIUS, {
  trackCurve,
  anchorU: messenger?.landmarks?.abandonedGate?.userData.anchor?.gateU ?? null,
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
// Bind the finished gate before the first lamp-pool collection (not lazily during render).
messenger?.landmarks?.abandonedGate?.userData.seatRoot?.userData.gateLighting?.userData.update(P.timeOfDay);
// 灯池建在空场景上，这里场景已装配完毕，立刻接管以免首帧按 78 盏灯编译一次再重编译
lightPool?.recollect();
// 距离剔除同理：它内部 2.5s 后才首次 collect()，而 boot 要 5~8s——
// 那次快照拍在半空场景上，之后再不重收集，等于整个模块空转（实测隐藏数 0）。
distanceCulling?.recollect();

// ---------- 玩家 / 相机 / 输入 ----------
const { player, playerGroup, messengerMesh, holdAura } = createPlayer(scene);

// Codrops 交互：光标滑动驱动信使头部与上半身视线朝向 (moveJoint)
player.lookTarget = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("pointermove", (e) => {
    if (!window.innerWidth || !window.innerHeight) return;
    player.lookTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    player.lookTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, { passive: true });
}

// Open the rescue story at its first readable landmark. Legacy panorama remains
// available through ?spawn=legacy; the dedicated garden tour keeps its spawn.
const entryParams = new URLSearchParams(location.search);
const entryBookshop = messenger?.landmarks?.bookshop;
if (entryBookshop && !entryParams.has('tour') && entryParams.get('spawn') !== 'legacy') {
  entryBookshop.updateWorldMatrix(true, false);
  const start = entryBookshop.localToWorld(new THREE.Vector3(0, 0, BOOKSHOP_TERRACE ? 5.4 : 7));
  start.setLength((entryBookshop.userData.townSite ? PLANET_RADIUS+.9+bookshopRaiseAtWorld(start,PLANET_RADIUS)+BOOKSHOP_TERRACE : (hills?.sampleRadius?.(start) ?? entryBookshop.position.length())) + 0.15);
  resolveAssetColliders(start, assetColliders);
  player.position.copy(start);
  player.checkpoint.copy(start);
  const up = start.clone().normalize();
  player.forward.copy(entryBookshop.position).sub(start);
  player.forward.addScaledVector(up, -player.forward.dot(up)).normalize();
  player.facing.copy(player.forward);
  player.groundR = start.length() - 0.15;
}

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
// 湖沼正式游戏入口：从外圈步道看向湖心，保留正常任务、玩家控制和实时场景更新。
// 这是独立的 URL 漫游点，不改变默认故事出生点或存档：?tour=swamp&autostart=1。
if (entryParams.get("tour") === "swamp" && messenger?.landmarks?.moebiusSwamp?.userData?.inner) {
  const swamp = messenger.landmarks.moebiusSwamp;
  const inner = swamp.userData.inner;
  swamp.updateWorldMatrix(true, true);
  const steps = inner.userData.tigerWalkSurfaces || [];
  const firstStep = steps[0];
  const nextStep = steps[1];
  const rim = inner.userData.gregCoralRim;
  const angle = rim?.entranceAngle ?? 0.5;
  const radius = rim?.rimPatrolRadius ?? 37.4;
  const groundY = rim?.topY ?? 40;
  // Use the authored entrance tread itself rather than the tree-lined outer ring.
  const start = firstStep
    ? firstStep.localToWorld(new THREE.Vector3(0, 0.68, 0))
    : inner.localToWorld(new THREE.Vector3(Math.cos(angle) * radius, groundY, Math.sin(angle) * radius));
  const lakeCenter = nextStep
    ? nextStep.localToWorld(new THREE.Vector3(0, 0.68, 0))
    : inner.localToWorld(new THREE.Vector3(0, groundY, 0));
  resolveAssetColliders(start, assetColliders);
  const up = start.clone().normalize();
  player.position.copy(start).addScaledVector(up, 0.15);
  player.velocity.set(0, 0, 0);
  player.checkpoint.copy(player.position);
  player.groundR = player.position.length() - 0.15;
  player.onGround = true;
  player.forward.copy(lakeCenter).sub(player.position);
  player.forward.addScaledVector(up, -player.forward.dot(up)).normalize();
  player.facing.copy(player.forward);
}
// Optional local playtest entry; default story progression still begins at the bookshop.
if (['crystal-mother-port','crystal-v7'].includes(entryParams.get('tour')) && messenger?.landmarks?.crystalMotherPort) {
  const port=messenger.landmarks.crystalMotherPort;
  player.position.copy(port.boardingRoute[0]);player.checkpoint.copy(player.position);
  player.groundR=player.position.length();player.onGround=true;
  const up=player.position.clone().normalize();
  player.forward.copy(port.boat.position).sub(player.position);
  player.forward.addScaledVector(up,-player.forward.dot(up)).normalize();player.facing.copy(player.forward);
}
const cameraRig = createCameraRig(camera, player, {
  // 相机遮挡回拉复用资产碰撞球，避免信使进建筑后被墙挡住
  colliders: () => assetColliders,
});
// The lake tour is a live production scene, but its entry stairs sit below a
// broad canopy. Keep an elevated, oblique inspection camera fixed on the lake
// so the actual animals and boats are readable without changing normal play.
const swampTourCamera = (() => {
  if (entryParams.get("tour") !== "swamp") return null;
  const root = messenger?.landmarks?.moebiusSwamp;
  const inner = root?.userData?.inner;
  if (!root || !inner) return null;
  root.updateWorldMatrix(true, true);
  inner.updateWorldMatrix(true, true);
  const whale = inner.userData.whale;
  const swim = whale?.userData?.swim;
  const target = inner.localToWorld(new THREE.Vector3(swim?.cx ?? 0, 24.6, swim?.cz ?? 0));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion).normalize();
  // Place the tour camera inside the open lake bowl and frame the whale's
  // patrol center. Rim foliage previously filled the entire live-game view.
  const position = inner.localToWorld(new THREE.Vector3(16, 34, 11));
  const viewDirection = target.clone().sub(position).normalize();
  const viewUp = up.clone().addScaledVector(viewDirection, -up.dot(viewDirection)).normalize();
  cameraRig.setFov(56);
  return {position, target, up: viewUp};
})();
// Give the bookshop entrance breathing room on a fresh default camera.
if (entryBookshop && !entryParams.has('tour') && entryParams.get('spawn') !== 'legacy' && P.camDist === 7.5) {
  P.camDist = 14;
  cameraRig.setDist(14);
}
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
  if (morrisHorseRide?.isRiding?.()) return true;
  // 电车也算乘坐：救援护送（虎虎/红狐）据此在电车上随行（主人 2026-09-18）。
  if (tramRide?.isRiding?.()) return true;
  return false;
}

// 救援主线的暗号交互（虎/狐章节靠近按 E）优先于八音盒的 E。
// 函数声明提升：rescueCampaign 在更晚处构造，调用时才解引用（同上 ride 先例）。
function rescueWantsCodePhraseE() {
  return rescueCampaign?.wantsCodePhraseE?.() ?? false;
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

if(messenger?.morrisIsland)worldLandmarks.push({id:'morris-island',name:'繁花锦岛',color:'#bd9755',tier:0,region:'far-nature',getDir:()=>messenger.morrisIsland.root.getWorldPosition(new THREE.Vector3())});

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
const GATE_ANCHOR_KEY = "tm.gateAnchorU.v2";

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
let gateApproachRailings = null; // legacy gate-site railings moved off the tracks to both deck edges (2026-10-14)
function moveGateAndCloudsTo(u) {
  const gate = messenger?.landmarks?.abandonedGate;
  const okGate = gate?.userData?.relocate?.(u) ?? false;
  if (okGate) gateApproachRailings?.apply?.();
  // 三重门千鸟漩涡随门重锚
  const vortex =
    messenger?.landmarks?.gateBirdVortex || messenger?.landmarks?.birdVortex;
  const birdGate = vortex?.hostGate || gate;
  const okBird = okGate ? vortex?.syncToGate?.(birdGate, { respawn: true }) ?? false : false;
  // 小群 Boids 家域也跟着门走
  if (okGate && messenger?.landmarks?.flock?.setHome) {
    const seat = gate.userData?.seatRoot || gate; // the small flock stays with the Sighs Gate even when the vortex is hosted elsewhere
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
try {
  gateApproachRailings = installGateApproachRailings({ scene, gate: messenger?.landmarks?.abandonedGate, tramSystem: messenger?.landmarks?.tramSystem });
} catch (error) { console.warn('[gate-railings] skipped', error); }

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
  onOpenCityReview:()=>{
    moonLakeInspection?.restore();
    morrisInspection?.restore();
    if(!targetCityRuntime?.report.installed)return;
    targetCityInspection??=installTargetCityPresentation({THREE,castle:targetCityRuntime.root.parent,camera,cameraRig,renderer,runtime:targetCityRuntime,scene,tramSystem:messenger?.landmarks?.tramSystem});
    targetCityInspection.open();
  },
  onOpenMoonLake:()=>{morrisInspection?.restore();if(!messenger?.moonLake?.group)return;targetCityInspection?.restore();moonLakeInspection??=installMoonLakePresentation({lake:messenger.moonLake,camera,cameraRig});moonLakeInspection.open();},
  onOpenMorris:()=>{targetCityInspection?.restore();moonLakeInspection?.restore();morrisInspection??=installMorrisIslandPresentation({island:messenger.morrisIsland,camera,cameraRig,getMusicStatus:getMorrisGardenBgmSnapshot,onApproachPrincess:()=>{if(player.riding){showToast('请先离开当前载具',2);return;}const i=messenger.morrisIsland,h=i.princessPatrol?.horse;if(!h)return;const q=h.position.clone().add(new THREE.Vector3(2.6,0,0));q.y=i.heightAt(q.x,q.z)+.05;player.position.copy(i.root.localToWorld(q));player.velocity.set(0,0,0);player.onGround=true;player.groundR=player.position.length();cameraRig.snapToPlayer();showToast('会面起点 · 靠近公主按 E',3);},onApproachHorse:()=>{const i=messenger.morrisIsland,h=i.horses.find(h=>!h.userData.princessOccupied);if(!h)return;if(player.riding){showToast('请先离开当前载具',2);return;}const x=h.position.x+1.8,z=h.position.z,y=i.heightAt(x,z);player.position.copy(i.root.localToWorld(new THREE.Vector3(x,y+.05,z)));player.velocity.set(0,0,0);player.onGround=true;player.groundR=player.position.length();player.forward.copy(h.getWorldPosition(new THREE.Vector3()).sub(player.position)).normalize();player.facing.copy(player.forward);cameraRig.snapToPlayer();showToast('试骑起点 · 靠近披锦马按 F',3);}});morrisInspection.open();},
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
    if (!hit) return "找不到货运铁路，无法定位";
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
  playerGroup,
  getTram: () =>
    messenger?.landmarks?.tramSystem?.getNearestBoardable?.(player.position) ||
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
      `已登上${color}货运机车 · 随车席位 · [C] 司机视野 · [F] 下车${foxHint}`,
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
  const c = getCitadelTarget();
  const junctionRevision=c?.userData?.junctionEditor?.revision;
  if (citadelObstacle && citadelObstacle.junctionRevision===junctionRevision) return citadelObstacle;
  if (!c) return null;
  // 只取建筑本体（断崖+规则小镇），不含外围台地/石阶，净空区才贴建筑
  const body = c.userData.junctionTarget || c.userData.mainCastle || c;
  const box = new THREE.Box3().setFromObject(body);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  let topRadial = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        topRadial = Math.max(topRadial, Math.hypot(x, y, z));
  citadelObstacle = {
    junctionRevision,
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
  groundRadius: (position) => playerSupportRadius(position), // 下艇落点不低于步道/地面
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
    const berth=b.userData.frontHarborBerth;
    const portEntry=b.userData.portNavigation?.atBerth() ? b.userData.boardingRoute?.[0] : null;
    const d = portEntry ? Math.min(player.position.distanceTo(_boatPick),player.position.distanceTo(portEntry)+3.6)
      : berth&&_boatPick.distanceTo(berth.position)<1
      ? Math.min(player.position.distanceTo(_boatPick),player.position.distanceTo(berth.exit)+3.6)
      : player.position.distanceTo(_boatPick);
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

const morrisHorseRide=createMorrisHorseRide({player,playerGroup,messengerMesh,cameraRig,keys,getIsland:()=>messenger?.morrisIsland,groundRadius:p=>playerSupportRadius(p),waterRadius:p=>PLANET_RADIUS+batianOceanLevelAt(p),toast:showToast,enabled:()=>gameStarted});
const morrisPrincessPatrol=createMorrisPrincessPatrol({island:messenger?.morrisIsland,player,isStarted:()=>gameStarted,onMeet:()=>morrisHorseRide.brake()});
if(messenger?.morrisIsland)messenger.morrisIsland.princessPatrol=morrisPrincessPatrol;

// ---------- 高山圣城 · Townscaper 搭建面板 ----------
// 已开局时用鼠标左键点选圣城 → 弹出可拖拽/可收起的搭建面板；
// 面板编辑（2D 平面图 / 场景 3D 直编辑）→ rebuildCitadelTown 即时重建场景圣城
// → v2 布局写 localStorage。每座台地拥有五个 town-terrace-T-level-N 组。
function applyTownLayerVisibility(activeTerrace, activeLayer, hideAbove) {
  if(getCitadelTarget()?.userData?.junctionEditor)return;
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
        if (stats?.ok === false) return stats; // 候选失败：旧场景与派生缓存保持原状。
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
// Selection and editing share the same nearest-visible-instance decision.
function selectCitadelAtPointer(e, { waterFallback = false } = {}) {
  const ray = new THREE.Raycaster();ray.layers.enable(1);
  const rect = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  const morrisRoot=messenger?.morrisIsland?.root;
  if(morrisInspection?.active)return null;
  const blockers=morrisRoot?[morrisRoot]:[];
  let selected=nearestCitadelTarget(ray,citadelTargets,blockers)?.target;
  if(!selected&&waterFallback){
    const steps=scene.getObjectByName('citadel-pilgrimage-water-steps');
    if(steps)selected=nearestCitadelTarget(ray,[{...citadelTargets[0],pick:()=>[steps]}],blockers)?.target;
  }
  if(!selected)return null;
  if((selected.id??null)!==citadelTargetId){
    citadelEditorPanel.switchTarget(()=>{
      citadelTargetId=selected.id??null;citadelSupportCache.clear();citadelObstacle=null;return true;
    });
  }
  return selected;
}

let citadelSceneEdit = citadelEditorPanel
  ? createCitadelSceneEdit({
      dom: renderer.domElement,
      camera,
      scene,
      getCitadel: () => getCitadelTarget(),
      selectTargetAt: (e) => selectCitadelAtPointer(e),
      panel: citadelEditorPanel,
      canEdit: () => gameStarted && !morrisInspection?.active, // Morris inspection never enters castle editing
      isUiEvent: isCitadelUiEvent,
      toast: showToast,
    })
  : null;

{
  let pendingCitadelClick=null;
  renderer.domElement.addEventListener('pointerdown',e=>{
    pendingCitadelClick=null;
    if(!citadelEditorPanel||e.button!==0||!gameStarted||isCitadelUiEvent(e)||citadelEditorPanel.isOpen()||crystalCityEditorPanel?.isOpen?.())return;
    pendingCitadelClick={button:e.button,x:e.clientX,y:e.clientY};
  });
  renderer.domElement.addEventListener('pointerup',e=>{
    const down=pendingCitadelClick;pendingCitadelClick=null;
    if(!isCitadelClick(down,e)||!gameStarted||isCitadelUiEvent(e)||citadelEditorPanel.isOpen())return;
    const selected=selectCitadelAtPointer(e,{waterFallback:true});if(!selected)return;
    showToast(`已选中「${selected.name}」· 搭建面板已打开`,2.2);citadelEditorPanel.open();
  });
  renderer.domElement.addEventListener('pointercancel',()=>{pendingCitadelClick=null;});
}

// [V] 进入/退出飞行器驾驶舱
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.code !== "KeyV") return;
  scoutAircraftRide?.forceExit?.();
  bubblePodRide?.forceExit?.();
  const on = aircraftRide.toggle();
  showToast(on ? "已进入飞行器驾驶舱 · [V] 退出" : "已退出飞行器驾驶舱", 2.4);
});

// [H] 切换信使特写镜头（纯镜头推拉，无弹窗菜单干扰）
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.code !== "KeyH") return;
  if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  const isClose = cameraRig.isCloseup?.() ?? false;
  cameraRig.setCloseup?.(!isClose);
  showToast(!isClose ? "信使特写视角 (按 H 还原)" : "已恢复常规跟随视角", 1.4);
});

// [Q] 返回玩家视角并召唤航空艇；搭建面板降层使用 PageDown。
window.addEventListener("keydown", (e) => {
  handleAirshipSummonShortcut(e, {
    activeElement: document.activeElement,
    panels: [citadelEditorPanel, crystalCityEditorPanel],
    restoreView: () => targetCityInspection?.restore?.(),
    summon: () => {
      if (!gameStarted) {
        const startBtn = document.getElementById("start-btn");
        if (startBtn) startBtn.click();
      }
      // 若玩家正在驾驶其它载具，先退出其它载具并解除骑乘状态
      if (isPlayerPilotingVehicle()) {
        scoutAircraftRide?.forceExit?.();
        bubblePodRide?.forceExit?.();
        if (aircraftRide?.isRiding?.()) aircraftRide.toggle();
        boatRide?.forceExit?.();
        tramRide?.forceExit?.();
        player.riding = false;
      }
      // 若飞艇状态卡在非 idle（异常未退出/刷新残留），先强制复位再召唤，避免 Q 失效
      if (airshipRide.getState?.() !== "idle") {
        airshipRide.forceExit?.();
        player.riding = false;
      }
      const ok = airshipRide.summon?.();
      if (ok) {
        showToast("航空艇已降临到面前 · 走到绳下按 [F] 登艇", 2.6);
      } else {
        showToast("航空艇暂不可召唤", 1.6);
      }
    },
  });
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
  isBusyRiding: () => !morrisHorseRide.isRiding() && isPlayerPilotingVehicle(),
  onInteract: () => morrisHorseRide.brake(),
  // 主线对暗号的 E 优先：红狐就在八音盒旁，虎/狐章节靠近时八音盒让位
  shouldYieldKeyE: rescueWantsCodePhraseE,
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

// ---------- 莫比斯结界：信使跨赤道时 2s 平滑过渡天空 ----------
// 搭乘时 player.position 随车更新；远处无人列车不能改变当前城市的光色。
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
  const observer = targetCityInspection?.active||moonLakeInspection?.active||morrisInspection?.active ? camera.position : player?.position;
  const target = Number.isFinite(observer?.y) && observer.y < 0 ? 1 : 0;
  moebiusFactor += (target - moebiusFactor) * Math.min(1, dt / 2); // 2 秒时间常数
  if (lightingDirector.isEnabled()) {
    // V5：结界染色作为 override 交给导演合成，不直接改灯/天空
    lightingDirector.setMoebiusFactor(moebiusFactor);
    return;
  }
  // DayNight resets sun/sky, but only ambient intensity. Restore its base
  // colour as well so the last southern tint cannot persist after returning.
  ambient.color.setHex(0xffffff);
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
  ambient.color.lerp(MOEBIUS_SKY, f);
}

// ---------- 阿狸（E 站立跟随 · 球面 lerp 尾随 · 对话 · 随电车卧姿） ----------
const crystalColossus = messenger?.landmarks?.moebius ? installCrystalColossus(scene, { radius: PLANET_RADIUS, sun, city: messenger.landmarks.moebius }) : null;
function batianTarget(id,label,object){
  if(!object?.isObject3D)return null;
  object.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(object),centre=object.getWorldPosition(new THREE.Vector3());
  if(centre.length()<1)box.getCenter(centre);
  if(centre.length()<1)return null;
  const dir=centre.normalize();
  const safeRadius=batianObstacleRadius(object,dir,PLANET_RADIUS);
  return {id,label,dir,safeRadius,surfaceRoot:object};
}
scene.userData.batianBattleScope='sequential';scene.userData.batianCommandMode=true;
const batianTargets=[batianTarget('bookshop','书店镇',entryBookshop),batianTarget('apostles','十二门徒',scene.getObjectByName('g30-far-mountain')),batianTarget('citadel','高山圣城',messenger.landmarks.odysseyCitadel),batianTarget('old-port','旧港湾',messenger.landmarks.oldHarbor?.root||messenger.landmarks.harbor),batianTarget('swamp','湖沼',messenger.landmarks.moebiusSwamp),batianTarget('moss','苔庭',sceneHandles.find(h=>h.id==='saihoji')?.group||scene.getObjectByName('SaihojiSixScenes')),batianTarget('moon-lake','月湖',messenger.moonLake?.group),batianTarget('gate','叹息之门',messenger.landmarks.abandonedGate)].filter(Boolean);
// 2026-10-15 (user): the fleet no longer attacks on its own at spawn; it waits for 集结出击 in the 霸天舰队 panel.
// Demo tours (?tour=bookshop-battle / fleet-command) and ?batianAuto=1 keep the old automatic campaign.
const batianAutoCampaign=['bookshop-battle','fleet-command'].includes(entryParams.get('tour'))||entryParams.get('batianAuto')==='1';
const batianFleet=crystalColossus&&messenger?.landmarks?.aircraftSquad?createBatianFleet({scene,flagship:crystalColossus,squad:messenger.landmarks.aircraftSquad,targets:batianTargets,radius:PLANET_RADIUS,auto:batianAutoCampaign?'campaign':false,audio:{trooperSwing:sfxLaserSwing,trooperCharge:sfxBoltCharge,trooperFire:sfxBoltFire,trooperHit:sfxBoltHit,residentFire:(from,to)=>sfxRobotShot('sentry',from,to),shieldHit:sfxBatianShieldHit,release:sfxBatianBombRelease,fall:sfxBatianBombFall,explosion:(pos,type)=>type==='rain'?sfxBatianBombExplosion(pos):sfxSmallExplosion(pos),charge:sfxEnergyPulse},
  escorts:messenger.landmarks.aircraftSquad.userData.gatePodEscort?.children||[],
  scouts:messenger.landmarks.scoutDefense?.fleetUnits?.().map(u=>u.group)||[],
  transports:messenger.landmarks.vanguardHaulers||[],groundSquad:messenger.landmarks.vanguardSquad,getTown:()=>robotOperations?.pedestrians,groundHooks:{rosterSlot:vanguardRosterSlot,muzzleWorld:vanguardMuzzleWorld},
  autoReady:()=>batianFleet?.snapshot().cycle>0||['bookshop-battle','fleet-command'].includes(entryParams.get('tour'))||player.position.clone().normalize().angleTo(batianTargets[0]?.dir||player.position)*PLANET_RADIUS<100,
  canControl:()=>gameStarted&&!aircraftRide.isRiding?.()&&!scoutAircraftRide?.isRiding?.()&&['idle','done'].includes(messenger.vanguardAssault?.phase?.()||'idle') }):null;
// 2026-10-15 perf: give every Batian target a fast top-surface height (radialHeightIndex). Without it the
// colossus ground shadow and the bomb-landing prediction raycast every mesh of the target each update
// (over the citadel: ~470 rays per update, 200+ ms per frame, 1-3 fps). The citadel target swaps its root to
// the hidden 'highland-west-city' at start, so that root reads the visible citadel's index. Where the index has
// no surface the planet's analytic ground (canyon / sea level) is returned. ?batianHeightIndex=0 disables.
if(batianFleet&&new URLSearchParams(location.search).get('batianHeightIndex')!=='0'){
  const batianIndexes=new Map();
  const indexFor=root=>{let i=batianIndexes.get(root);if(!i){i=createRadialHeightIndex(root,{planetRadius:PLANET_RADIUS});batianIndexes.set(root,i);}return i;};
  const analyticGround=d=>PLANET_RADIUS+Math.max(swampGuardCanyonOffset(d),batianOceanLevelAt(d));
  const attach=(root,source=root)=>{if(!root?.isObject3D||!source?.isObject3D||root.userData.groundHeightAt)return;const idx=indexFor(source);root.userData.groundHeightAt=d=>idx.heightAt(d)??analyticGround(d);root.userData.batianHeightIndex=idx;};
  const attachAll=()=>{for(const t of batianTargets)if(t)attach(t.surfaceRoot);attach(scene.getObjectByName('highland-west-city'),messenger?.landmarks?.odysseyCitadel);};
  attachAll();
  const startFleet=batianFleet.start;batianFleet.start=(...args)=>{const r=startFleet(...args);attachAll();return r;};
  scene.userData.batianHeightIndexes=batianIndexes;
}
let batianFollowCamera=entryParams.get('tour')==='fleet-command';
const batianHud=document.createElement('details');batianHud.style.cssText='position:fixed;left:12px;bottom:160px;z-index:30;background:#17303ddd;color:#e4e7db;border-radius:10px;padding:8px;font:12px sans-serif;max-width:230px';
if(batianFleet){const title=document.createElement('summary');title.textContent='霸天舰队';batianHud.append(title);const select=document.createElement('select');select.id='batian-target';for(const target of batianTargets){const opt=document.createElement('option');opt.value=target.id;opt.textContent=target.label;select.append(opt);}const launch=document.createElement('button');launch.textContent='集结出击';launch.onclick=()=>{if(!batianFleet.start(select.value))showToast('舰队暂不可出击：请先结束乘机或当前战斗',2.5);else setBatianBattleBgm(true);};const back=document.createElement('button');back.textContent='召回返航';back.onclick=()=>batianFleet.retreat();const status=document.createElement('div');status.id='batian-fleet-status';const follow=document.createElement('button');follow.textContent=batianFollowCamera?'返回信使':'跟随霸天';follow.onclick=()=>{batianFollowCamera=!batianFollowCamera;follow.textContent=batianFollowCamera?'返回信使':'跟随霸天';};batianHud.append(select,launch,back,follow,status);const credit=document.createElement('a');credit.textContent='Hitman · Kevin MacLeod · CC BY 4.0';credit.href='https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300013';credit.target='_blank';credit.rel='noopener';credit.style.cssText='display:block;font-size:10px;color:#81b8b2;margin-top:6px';batianHud.append(credit);document.body.append(batianHud);}
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
  // 2026-10-13 用户：狐狸也可以登上飞艇
  getAirshipSpot: (pos, fwd) => airshipRide.rideSpot?.(2, pos, fwd) ?? false,
});

let raidBeatActive = false;
const rescueCampaign = createRescueCampaign({
  scene, player, camera, messenger, worldLandmarks, fox: foxAli,
  platforms, hills, colliders: assetColliders,
  isStarted: () => gameStarted, isRiding: isPlayerPilotingVehicle, toast: showToast,
  getRideSpot: (slot, pos, fwd) => airshipRide.rideSpot?.(slot, pos, fwd) ?? false,
});
// 虎虎同行（用户 2026-10-10）：靠近湖沼之虎按 E 说话、再按 E 跟随；步行/飞艇/电车/船都随行。主线接回虎虎后让位给主线护送。
const tigerCompanion = createTigerCompanion({
  scene, player, findTiger: () => findSwampTiger(scene), groundRadius: (p) => playerSupportRadius(p),
  isRiding: isPlayerPilotingVehicle, isStarted: () => gameStarted, toast: showToast,
  rescueOwnsTiger: () => !!rescueCampaign.snapshot?.().rescuedTiger, rescueWantsE: () => !!rescueCampaign.wantsCodePhraseE?.(),
  getRideSpot: (slot, pos, fwd) => airshipRide.rideSpot?.(slot, pos, fwd) ?? false,
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
      : messenger ? '在书店按 R 接过家书，出发寻找红狐与虎虎' : `去找发光的寄件人接信吧 · ${sceneHint}`
  );
  quest.updateQuestUI();
  touchControls.onGameStart?.();
});

// ---------- 主循环 ----------
const timer = new Timer();
// Explicit review URL only: start at the actual new stairs, without altering chapter saves.
if(new URLSearchParams(location.search).get('gateReview')==='1'){
  const seat=messenger?.landmarks?.abandonedGate?.userData?.seatRoot;
  if(seat){
    seat.updateWorldMatrix(true,false);
    player.position.copy(seat.localToWorld(new THREE.Vector3(-23,-3.72,-36.8)));
    player.velocity.set(0,0,0);player.onGround=true;player.groundR=player.position.length();
    player.checkpoint.copy(player.position);
    (player.forward??=new THREE.Vector3()).set(0,0,1).transformDirection(seat.matrixWorld);
    (player.facing??=new THREE.Vector3()).copy(player.forward);
  }
}
if(new URLSearchParams(location.search).get('junctionReview')==='1'){
 const city=messenger?.landmarks?.canalJunctionCitadel;
 if(city?.userData.junctionTarget){city.updateWorldMatrix(true,false);player.position.copy(city.localToWorld(new THREE.Vector3(0,.67,12)));player.velocity.set(0,0,0);player.onGround=true;player.groundR=player.position.length();player.checkpoint.copy(player.position);(player.forward??=new THREE.Vector3()).set(0,0,-1).transformDirection(city.matrixWorld);(player.facing??=new THREE.Vector3()).copy(player.forward);}
}
if(new URLSearchParams(location.search).get('highlandReview')==='1'){
 const gate=scene.getObjectByName('highland-gate');
 if(gate?.userData.toRailWorld){const start=gate.userData.toRailWorld(-3.15,.05,-32),ground=gate.userData.sampleGroundRadius(start);if(ground!=null)start.normalize().multiplyScalar(ground);player.position.copy(start);player.velocity.set(0,0,0);player.onGround=true;player.groundR=start.length();player.checkpoint.copy(start);(player.forward??=new THREE.Vector3()).copy(gate.userData.toRailWorld(-3.15,.05,-30)).sub(start).normalize();(player.facing??=new THREE.Vector3()).copy(player.forward);}
}
if(entryParams.get('baseReview')==='1'){
 const base=entryBookshop?.userData.steampunkRobots;
 if(base){base.updateWorldMatrix(true,false);const start=base.localToWorld(new THREE.Vector3(0,0,46));start.setLength(PLANET_RADIUS+.97+bookshopRaiseAtWorld(start,PLANET_RADIUS));player.position.copy(start);player.velocity.set(0,0,0);player.onGround=true;player.groundR=start.length();player.checkpoint.copy(start);player.forward.copy(base.localToWorld(new THREE.Vector3(0,0,0))).sub(start);const up=start.clone().normalize();player.forward.addScaledVector(up,-player.forward.dot(up)).normalize();player.facing.copy(player.forward);cameraRig.setDist(19);}
}
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
let swampInkPostRef = null; // 湖沼屏幕空间墨线（swampInkPost.js），湖沼镜头外直接渲染
function safeRender() {
  try {
    if (swampInkPostRef) swampInkPostRef.render(scene, camera); else renderer.render(scene, camera);
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

function activeSwampTiger() {
  let root = window.__tmSwampTiger;
  while (root?.parent) root = root.parent;
  if (root !== scene) window.__tmSwampTiger = findSwampTiger(scene);
  return window.__tmSwampTiger;
}
let swampGroundZone = null;
function refreshSwampGroundZone() {
  // Multiple authored regions now expose this API. Traversal's first match
  // may be an unrelated city or old shoreline, not the actual lake frame.
  const actual=messenger?.landmarks?.moebiusSwamp?.userData?.inner;
  if(typeof actual?.userData?.sampleGroundRadius==='function'){swampGroundZone=actual;return;}
  let root = swampGroundZone;
  while (root?.parent) root = root.parent;
  if (root === scene) return;
  swampGroundZone = null;
  scene.traverse(node => {
    if (!swampGroundZone && typeof node.userData?.sampleGroundRadius === "function") swampGroundZone = node;
  });
}
let citadelPlayerGround=null,citadelPlayerWalls=null,targetCityPlayerNavigation=null;
const bookshopCameraOccluders=entryBookshop?.userData.steampunkRobots?.userData.cameraOccludersNear;
const swampCameraOccluders=createSwampCameraOccluders(messenger?.landmarks?.moebiusSwamp);
const baseCameraOccluders=(position,reach)=>[...(bookshopCameraOccluders?.(position,reach)||[]),...swampCameraOccluders(position,reach)];
let robotOperations=null;
const robotGreeting=createRobotGreeting({player,isStarted:()=>gameStarted,toast:showToast,getModels:()=>[...(entryBookshop?.userData.steampunkRobots?.userData.models||[]),...(robotOperations?[...robotOperations.models.values()].filter(m=>{const u=robotOperations.logistics.get(m.userData.robotId);return u&&['ready','deployed','repair'].includes(u.status);}):[])]});
const bookshopAtmosphere=createBookshopAtmosphere({root:entryBookshop?.userData.steampunkRobots,scene,skyMat});
// Jakub additive bookshop dressing toward the 2026-10-11 target; ?bookshopJakub=0 disables.
const bookshopJakubPass=installBookshopJakubPass({scene,root:entryBookshop?.userData.steampunkRobots,R:160,colliders:Array.isArray(assetColliders)?assetColliders:null,platforms,bookshop:entryBookshop,enabled:new URLSearchParams(location.search).get('bookshopJakub')!=='0'});
// 2026-10-13: horse/statue plaza made radial-level like the fountain (bastion + cut walls + stair); ?plazaLevel=0 disables.
let newCityPlazaLevel=null; // filled once the target-city runtime has built the plaza (see startup below)
// The Hard To Find shop stands on a deck BOOKSHOP_TERRACE m up: its collider must not wall off the arcade beneath.
if(BOOKSHOP_TERRACE&&entryBookshop&&Array.isArray(messenger?.colliders)){const shopR=entryBookshop.position.length();for(const c of messenger.colliders)if(c?.position&&c.minR===undefined&&c.position.distanceTo(entryBookshop.position)<4)c.minR=shopR-1.2;}
const guardianAtmosphere=createCitadelGuardianAtmosphere({scene,skyMat,camera,getGuardian:()=>citadelGuardian});
if(baseCameraOccluders)cameraRig.setOccluderMeshes(baseCameraOccluders);
const highlandGateRuntime=scene.getObjectByName('highland-gate');
const gatePlayerGround=createGatePlayerGround(messenger?.landmarks?.abandonedGate?.userData?.seatRoot);
const gatePlayerWalls=createGatePlayerWalls(messenger?.landmarks?.abandonedGate?.userData?.seatRoot);
const junctionPlayerSupport=createJunctionPlayerSupport(messenger?.landmarks?.canalJunctionCitadel);
const citadelPreviousFoot=new THREE.Vector3();
function refreshCitadelPlayerGround(){
  if(targetCityRuntime?.report.installed){
    if(!targetCityPlayerNavigation){
      const castle=targetCityRuntime.root.parent;
      targetCityPlayerNavigation=createTargetCityPlayerNavigation({runtime:targetCityRuntime,castle,
        finalTerrain:[castle.getObjectByName('citadel-oskar-grid-mountain-surface')],
        legacyCitadelPosition:messenger?.landmarks?.odysseyCitadel?.position,
        legacyColliders:messenger?.colliders||[]});
      citadelPlayerGround=targetCityPlayerNavigation.ground;citadelPlayerWalls=targetCityPlayerNavigation.walls;
      targetCityRuntime.report.navigation.installedIntoPlayer=true;
      targetCityRuntime.report.navigation.adapter=targetCityPlayerNavigation.report;
      cameraRig.setOccluderMeshes((position,reach)=>[...targetCityPlayerNavigation.cameraOccluders(position,reach),...(baseCameraOccluders?.(position,reach)||[])]);
    }
    return;
  }
  if(targetCityPlayerNavigation){targetCityPlayerNavigation.dispose();targetCityPlayerNavigation=null;citadelPlayerGround=null;citadelPlayerWalls=null;cameraRig.setOccluderMeshes(baseCameraOccluders||(()=>[]));if(targetCityRuntime)targetCityRuntime.report.navigation.installedIntoPlayer=false;}
  if(citadelPlayerGround)return;
  const city=scene.getObjectByName('highland-west-city');
  if(city){citadelPlayerGround=createCitadelPlayerGround(city);citadelPlayerWalls=createCitadelPlayerWalls(city);
    // Same authored walls drive the camera pull-in, so entering the gate or the tower
    // no longer leaves the camera stranded outside the stone.
    const cityOccluders=createCitadelCameraOccluders(city);
    cameraRig.setOccluderMeshes((position,reach)=>[...cityOccluders(position,reach),...(baseCameraOccluders?.(position,reach)||[])]);}
}
// 2026-10-09 湖沼走一圈：入口缺口补石板 + 无形边缘护栏（swampEdgeGuard.js，?swampEdgeGuard=0 关闭）。
function swampWalkAidGround(position){
  return swampGroundZone ? installSwampEntranceBridge(swampGroundZone)?.ground(position) ?? null : null;
}
const swampGuardDir=new THREE.Vector3();
const guardDelta=new THREE.Vector3();
// Highest curved-platform top under the feet that the courier could land on (same footprint test as collision.js).
const swampPhysicsLocal=new THREE.Vector3();
// Global spherical platform colliders predate the lake excavation. Their
// flat footprint can still fill the visually clipped lake with a ghost floor.
// Inside that excavation, authored lake meshes supply all walking surfaces.
function swampOwnsPhysics(position){
  if(!swampGroundZone)return false;
  swampGroundZone.updateWorldMatrix(true,false);
  swampPhysicsLocal.copy(position);swampGroundZone.worldToLocal(swampPhysicsLocal);
  return Math.hypot(swampPhysicsLocal.x,swampPhysicsLocal.z)<35.5&&swampPhysicsLocal.y>4&&swampPhysicsLocal.y<60;
}
function platformTopUnder(position){
  if(swampOwnsPhysics(position))return -Infinity;
  const r=position.length();let best=-Infinity;
  swampGuardDir.copy(position).normalize();
  for(const p of platforms){
    if(!p.center||!p.normal||p.topHeight==null)continue;
    if(swampGuardDir.dot(p.normal)<=.05)continue;
    guardDelta.copy(position).sub(p.center);
    if(Math.abs(guardDelta.dot(p.right))>p.half.x+GUARD_PLAYER_RADIUS*.35||Math.abs(guardDelta.dot(p.forward))>p.half.z+GUARD_PLAYER_RADIUS*.35)continue;
    const top=typeof p.topHeightAt==='function'?p.topHeightAt(position):p.topHeight;
    if(top<=r+.75&&top>best)best=top;
  }
  return best;
}
function playerSupportRadius(position){
  const local=samplePlayerLocalGround(position);
  if(local===-Infinity)return -Infinity;
  let ground;
  if(Number.isFinite(local))ground=local;
  else{
    swampGuardDir.copy(position).normalize();
    const citadel=swampGuardCitadelLift(swampGuardDir),base=PLANET_RADIUS+swampGuardCanyonOffset(swampGuardDir)+citadel,hill=hills?.sampleRadius?.(position);
    ground=hill==null?base:citadel>0?Math.max(hill,base):hill;
  }
  return Math.max(ground,platformTopUnder(position));
}
const swampEdgeGuard=createSwampEdgeGuard({getZone:()=>swampGroundZone,supportRadius:playerSupportRadius,toast:text=>showToast(text)});
// 2026-10-09 用户反馈：下船后往前几步走上母塔港升降台/码头就掉下去。码头、连接板、升降台、上层步道同样加无形护栏。
// 2026-10-09 Greg 湖沼实现进真实场景：清掉压在湖沼坑和坑缘步道上的旧水晶城/城市/海面几何（?swampCavityClear=0 关闭）。
const swampCavityClearance=clearSwampCavity({scene,swamp:messenger?.landmarks?.moebiusSwamp,colliders:assetColliders,platforms,v7Shores:messenger?.landmarks?.moebius?.v7Shores});
// 2026-10-10 坑缘上空悬着的旧城绿丘平台/晶体塔（地表降低后悬空）整体隐藏；?swampAirspaceClear=0 关闭。
const swampAirspaceClearance=clearSwampAirspace({scene,swamp:messenger?.landmarks?.moebiusSwamp});
const swampWalkwaySteer=createSwampWalkwaySteer({getZone:()=>swampGroundZone});
// 2026-10-10 湖沼专用镜头第一步（距离/抬高/沿步道跟随），方案 docs/greg-team/SWAMP_CAMERA_PLAN.md；?swampCam=0 关闭。
const swampCameraProfile=createSwampCameraProfile({cameraRig,player,camera,getTerrain:(()=>{let t;return()=>t??=scene.getObjectByName('planet-surface');})(),getZone:()=>swampGroundZone});
// 湖沼镜头第二步：镜头与信使之间的树叶、树干抖动半透明（?swampCamFade=0 关闭）。
// 湖沼目标图美术细节：可走面墨线外轮廓（?swampTargetPass=0 关闭）。在入口补板安装之后执行。
const swampTargetPass=applySwampTargetPass(messenger?.landmarks?.moebiusSwamp);
// 2026-10-11 Greg 团队按手绘目标图（artifacts/pipeline/swamp-target-20261011/target.png）：
// 居住逻辑——修船码头、帆、栈桥、坑缘大叶（?swampHarbor=0）；须在墨线/淡出/空气雾之前。
// 2026-10-11 用户：别改错地方——不动原有角色/剧情物体（出航船 B 保持原样、工猴不放大），只做加法。
const swampHarborScene=installSwampHarborScene({swamp:messenger?.landmarks?.moebiusSwamp,departure:'original',workerScale:1});
// 异星生态 + 有机通行——水下树根、坑壁瀑布、坑缘巨花、浮叶小枝、水下小鲸（各自 ?swampXxx=0 关闭）。
const swampTreeRoots=installSwampTreeRoots({swamp:messenger?.landmarks?.moebiusSwamp});
const swampWaterfalls=installSwampWaterfalls({swamp:messenger?.landmarks?.moebiusSwamp});
const swampRimFlowers=installSwampRimFlowers({swamp:messenger?.landmarks?.moebiusSwamp});
const swampFloatingDebris=installSwampFloatingDebris({swamp:messenger?.landmarks?.moebiusSwamp});
// 2026-10-11 用户说鲸鱼不对：小鲸模块默认不装（它会把原幼鲸按到水下），?swampWhaleCalves=1 才开。
const swampWhaleCalves=new URLSearchParams(location.search).get('swampWhaleCalves')==='1'?installSwampWhaleCalves({swamp:messenger?.landmarks?.moebiusSwamp}):{report:{enabled:false},update(){}};
{ // 小鲸必须在湖沼自己的动画之后、同一时间轴上更新
  const inn=messenger?.landmarks?.moebiusSwamp?.userData?.inner;
  if(inn&&typeof inn.update==='function'){const prev=inn.update;inn.update=function(dt,t,rt){const out=prev.call(this,dt,t,rt);swampWhaleCalves.update(t);return out;};}
}
// 2026-10-10 莫比斯式克制墨线：步道/荷叶沿顶面外缘一条连续线，岩壁几条结构线，水下不画（?swampHandInk=0 关闭）。
const swampHandInk=installSwampHandInk({swamp:messenger?.landmarks?.moebiusSwamp});
// 2026-10-10 Greg 评估水面：笔触只在被扰动处（荷叶舟/换气的鲸/黑娃）成环、零星成簇，不再满铺网格短线（?swampWaterMarks=0 回旧条纹）。
const swampWaterMarks=installSwampWaterMarks({swamp:messenger?.landmarks?.moebiusSwamp});
// 视觉规则——青绿透亮的湖水、赭橙坑缘、灰紫砌石坑壁（?swampPaintWater=0）；须在水面笔触之后、空气雾之前。
const swampPaintWater=installSwampPaintWater({swamp:messenger?.landmarks?.moebiusSwamp});
const swampOcclusionFade=installSwampOcclusionFade({swamp:messenger?.landmarks?.moebiusSwamp});
const swampInkPost=createSwampInkPost({renderer,fadeUniforms:swampOcclusionFade.uniforms,isActive:()=>(swampCameraProfile.report.weight||0)>.2});swampInkPostRef=swampInkPost;
// 湖沼目标图：随视距混入月夜空气色（?swampHaze=0 关闭）。
const swampAirHaze=installSwampAirHaze({swamp:messenger?.landmarks?.moebiusSwamp,color:'#e3e2d4'});// 2026-10-11 目标图远处是暖白雾
const motherPortForGuard=messenger?.landmarks?.crystalMotherPort;
const portEdgeGuard=createEdgeGuard({getZone:()=>motherPortForGuard?.root,supportRadius:playerSupportRadius,toast:text=>showToast(text),
  getNetworkMeshes:()=>(motherPortForGuard?.records||[]).map(r=>r.mesh).filter(m=>m&&!/rail/.test(m.name)),zoneRadius:13,zoneY:[-12,24],label:'母塔港'});
function samplePlayerLocalGround(position){
  const flowerGround=messenger?.morrisIsland?.sampleGroundRadius(position);
  if(flowerGround!=null)return flowerGround;
  // Other authored regions have older radial support providers. They must not
  // fill the lake excavation after a lower tread passes below their height.
  if(swampOwnsPhysics(position))return sampleSwampStairGround(swampGroundZone,position) ?? sampleSwampAuthoredGround(swampGroundZone,position) ?? sampleSwampGround(position) ?? -Infinity;
  return targetCityPlayerNavigation?.ground(position) ?? highlandGateRuntime?.userData.sampleGroundRadius?.(position) ?? sampleSwampStairGround(swampGroundZone,position) ?? sampleSwampAuthoredGround(swampGroundZone,position) ?? swampWalkAidGround(position) ?? sampleSwampRimGround(swampGroundZone,position) ?? messenger?.landmarks?.moebius?.v7Shores?.userData.sampleGroundRadius(position) ?? junctionPlayerSupport.ground(position) ?? gatePlayerGround(position) ?? (targetCityPlayerNavigation ? null : citadelPlayerGround?.(position)) ?? sampleSwampGround(position);
}
function sampleSwampGround(position) {
  return swampGroundZone?.userData?.sampleGroundRadius(position) ?? null;
}

let citadelBgmCity=null;
const citadelBgmPoint=new THREE.Vector3();
const saihojiRuntime=sceneHandles.find(handle=>handle.id==='saihoji');
const saihojiBgmPoint=new THREE.Vector3();
let kunRollWasActive=false;
let kunRollWasPending=false;
// Opt-in local CPU evidence only; no timers or recording during normal play.
const frameCpuEnabled=new URLSearchParams(location.search).get('frameCpuProfile')==='1';
const frameCpuRows=[];let frameCpuLast=0,frameCpuRow=null;
function frameCpuMark(name){if(!frameCpuEnabled)return;const now=performance.now();frameCpuRow[name]=now-frameCpuLast;frameCpuLast=now;}
const frameCpuProfile={reset(){frameCpuRows.length=0;},read(){const means={};for(const row of frameCpuRows)for(const [k,v]of Object.entries(row))means[k]=(means[k]||0)+v/frameCpuRows.length;return {enabled:frameCpuEnabled,samples:frameCpuRows.length,means};}};
function animate() {
  requestAnimationFrame(animate);
  renderer.info.reset();
  if(frameCpuEnabled){frameCpuLast=performance.now();frameCpuRow={};}
  timer.update();
  const elapsedFrame=Math.min(timer.getDelta(),.2);
  const dt = Math.min(elapsedFrame, 0.05);
  scene.userData.batianFrameDelta=elapsedFrame;
  const t = performance.now() * 0.001;

  updateToast(dt);
  dayNight.update(dt);
  targetCityRuntime?.update(performance.now()/1000);
  if(!batianFleet?.active) crystalColossus?.update(t);
  // K4 局部灯桥接：先于导演合成，闪电 override 当帧生效（关时 no-op）
  messenger?.landmarks?.abandonedGate?.userData.seatRoot?.userData.gateLighting?.userData.update(P.timeOfDay);
  localLights.update(dt);
  // V5 光照导演：开关开时由它提交全局灯/雾/天空/exposure（关时 no-op）
  lightingDirector.update(dt, { timeOfDay: dayNight.getPhase?.() ?? P.timeOfDay, weather: P.weather | 0 });
  if(!lightingV5)scene.userData.sunShadowFollow?.follow?.(player.position); // sun shadow box follows the player (2026-10-15)
  // Mountain ridges are fixed geometry; their day/night colour is updated by
  // the citadel, independently of the player and camera.
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
  bookshopAtmosphere.update(camera.position,P.timeOfDay);
  if(!robotOperations&&entryBookshop?.userData.steampunkRobots&&messenger?.landmarks?.tramSystem){robotOperations=createRobotOperations({scene,base:entryBookshop.userData.steampunkRobots,tramSystem:messenger.landmarks.tramSystem,camera,cameraRig,colliders:assetColliders,getFleet:()=>messenger.landmarks.aircraftSquad,getAssault:()=>messenger.vanguardAssault||messenger.combatPack?.vanguardAssault});}
  // 季相天气偏置（E5）：按玩家当前所处季相带温和偏置天气（冬雪/春雨/夏秋晴），3 秒滞后防抖
  if (player?.position) {
    const season = seasonAt(player.position);
    seasonWeatherBias.update(dt, season?.name, P);
  }
  weather.update(dt, player.position, { speed: P.windSpeed, dirDeg: P.windDir }, P.weather | 0);
  // 纳沃纳双栖广场：雨天蓄洪 / 晴雪泄回旱季广场（与天气联动）
  {
    const plaza = messenger?.landmarks?.citadelRange?.navonaPlaza;
    if (plaza?.setFlooded && !plaza.userData?.retiredCitadelPresentation) {
      // weather mode: 0 晴 / 1 雨 / 2 雪 → 仅雨天 isFlooded
      plaza.setFlooded((P.weather | 0) === 1);
    }
  }
  mapEditor.tickHighlight?.(dt);
  citadelSceneEdit?.tick(dt);

  frameCpuMark("lightingWeather");
  activeSwampTiger(); // Validate once per frame, never traverse the scene per physics substep.
  refreshCitadelPlayerGround();
  refreshSwampGroundZone(); // Terrain remains valid if the tiger is removed or replaced.
  swampCavityClearance?.update?.();
  // 搭乘接管：飞行器驾驶舱 / 气泡艇 / 电车 / 航空艇
  const riding =
    morrisHorseRide.update(dt) ||
    scoutAircraftRide?.update(dt) ||
    aircraftRide.update() ||
    bubblePodRide.update(dt) ||
    boatRide.update(dt) ||
    tramRide.update(dt) ||
    airshipRide.update(dt);
  if (!riding) {
    // Bound travel per physics step: thin obstacles must survive a slow frame.
    const physicsSteps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const physicsDt = dt / physicsSteps;
    for (let step = 0; step < physicsSteps; step++) {
    citadelPreviousFoot.copy(player.position);
    swampEdgeGuard.begin(player);
    portEdgeGuard.begin(player);
    updatePlayerControl({ player, keys, camera, dt: physicsDt, gameStarted, onJump: sfxJump });
    swampWalkwaySteer.apply(player, physicsDt);
    resolveCollisions(
      player.position,
      player.velocity,
      physicsDt,
      swampOwnsPhysics(player.position) ? [] : (targetCityPlayerNavigation?.platformsForPhysics(platforms) ?? platforms),
      player,
      () => showToast("掉下去了… 已回到检查点"),
      hills,
      samplePlayerLocalGround
    );
    citadelPlayerWalls?.(citadelPreviousFoot,player.position,player.velocity);
    gatePlayerWalls(citadelPreviousFoot,player.position,player.velocity);
    highlandGateRuntime?.userData.resolveWalls?.(citadelPreviousFoot,player.position,player.velocity);
    junctionPlayerSupport.walls(citadelPreviousFoot,player.position,player.velocity);
    resolveAssetColliders(player.position, targetCityPlayerNavigation?.collidersForPhysics(assetColliders) ?? assetColliders);
    swampEdgeGuard.end(player, physicsDt);
    portEdgeGuard.end(player, physicsDt);
    }
  }
  frameCpuMark("physicsAndRide");

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

  const bgmWhale = saihojiRuntime?.group;
  if(!citadelBgmCity?.parent)citadelBgmCity=scene.getObjectByName('highland-west-city');
  const bgmCityCenter=citadelBgmCity?citadelBgmCity.localToWorld(citadelBgmPoint.fromArray(citadelBgmCity.userData.plazaAnchor || [60,4,71.5])):null;
  updateBgmListenerContext({listener:player.position,saihoji:bgmWhale?.getWorldPosition(saihojiBgmPoint) || null,newCity:bgmCityCenter,morrisCenter:messenger?.morrisIsland?.root.position,morrisListener:morrisInspection?.active&&messenger?.morrisIsland?.previewListening?camera.position:player.position,gameStarted});

  // 玩家驾驶的飞行器：引擎声居中（泡艇/航空艇由各自乘坐模块登记）
  if (scoutAircraftRide?.isRiding?.()) hintEngine("ride-scout", "jet", player.position, 0.7, true);
  else if (aircraftRide.isRiding?.()) hintEngine("ride-aircraft", "light", player.position, 0.6, true);
  setSfxListener(morrisInspection?.active&&messenger?.morrisIsland?.previewListening?camera.position:batianFollowCamera?camera.position:player.position,camera);
  updateWorldSfx(dt);

  // 场景模块自更新（湖、云、平台脉动等）
  frameCpuMark("audio");
  batianFleet?.beforeSceneUpdate();
  updateScenes(sceneHandles, dt, t, { player, gameStarted, keys });
  // Saihoji defenders and Kun advance on the world's clamped simulation clock.
  // The flagship must share that clock or it finishes a sortie before landing at low FPS.
  batianFleet?.update(batianFleet?.snapshot().target==='moss'?dt:elapsedFrame,t);
  if(batianFleet){const bs=batianFleet.snapshot();const targetSelect=document.getElementById('batian-target');if(targetSelect&&bs.target&&bs.phase!=='idle')targetSelect.value=bs.target;setBatianBattleBgm(gameStarted&&!['idle','dock'].includes(bs.phase));const el=document.getElementById('batian-fleet-status');if(el){el.textContent=(batianTargets.find(x=>x.id===bs.target)?.label||'等待书店镇出击')+' · '+(bs.arsenal?.pendingProjectiles>0?'霸天连续投弹':bs.beamActive&&bs.fireLog.at(-1)?.role==='flagship'?({cannon:'晶核脉冲',rain:'连续轰炸',ion:'离子干扰',traction:'牵引光场'}[bs.fireLog.at(-1)?.type]||'旗舰攻击'):{idle:'待命',assemble:'集结',transit:'霸天转场',blockade:'编队到场',pincer:'两翼轮番攻击',cannon:'霸天主炮',guard:'护卫掩护',withdraw:bs.coverBombing?.allowed&&bs.coverBombing.passes<2?'收队前掩护轰炸':'收队',return:'返航',dock:'补能'}[bs.phase]||bs.phase)+' · 能源 '+Math.round(bs.energy)+' · '+bs.members+'架 · '+(bs.shield?'护罩开启':'护罩关闭');if(bs.groundAssault?.active)el.textContent+=' · '+({suppression:'压制防空',insertion:'运输艇索降',sweep:'广场交战',evacuation:'地面收队'}[bs.groundAssault.stage]||'地面作战')+' · 本次 '+bs.groundAssault.assigned+' · 可战 '+bs.groundAssault.ready+' · 索降中 '+bs.groundAssault.rappelling+' · 已落地 '+bs.groundAssault.deployed;if(bs.groundAssault?.tactics){const ts=bs.groundAssault.tactics;el.textContent+=' · 光盾拦截 '+ts.shieldBlocks+' · 光剑命中 '+ts.swordHits+' · 枪阵射击 '+ts.gunBursts;}if(bs.groundAssault?.medical?.patients)el.textContent+=' · 送往黑娃救治 '+bs.groundAssault.medical.patients;el.dataset.saihojiFormation=JSON.stringify(scene.getObjectByName("saihoji-phalanx-battle")?.userData.getBattleSnapshot?.()||null);el.dataset.saihojiBattle=JSON.stringify(scene.getObjectByName("leviathanGroup")?.userData.batianBattleTrigger||null);if(bs.target==='moss')el.textContent+=JSON.parse(el.dataset.saihojiBattle)?.allowed?' · 苔庭迎战':' · 苔庭等待霸天攻击';el.dataset.audit=JSON.stringify(bs);el.dataset.beamActive=bs.beamActive?'1':'0';el.dataset.bombActive=bs.arsenal?.pendingProjectiles>0?'1':'0';el.dataset.ionActive=bs.arsenal?.activeIon?'1':'0';el.dataset.bayOpen=bs.bay?.openness>.5?'1':'0';el.dataset.target=bs.target||'';el.dataset.shattered=String(bs.arsenal?.robotsShattered||0);el.dataset.fireRole=bs.fireLog.at(-1)?.role||'';}}
  frameCpuMark("sceneUpdates");
  citadelGuardian?.update(dt);
  // Trains move in updateScenes. Seat and freight poses must use this frame's
  // transforms before player visuals and the camera are synchronized.
  if (tramRide.isRiding()) tramRide.update(0);
  robotOperations?.update(dt);
  frameCpuMark("robotsAndGuardian");
  robotGreeting.update();
  const kunRollActive=bgmWhale?.userData?.victoryRoll?.active===true;
  const kunRollPending=bgmWhale?.userData?.victoryRoll?.pending===true;
  if(kunRollPending&&!kunRollWasPending&&gameStarted&&player.position.distanceTo(saihojiBgmPoint)<140){
    showToast("鲲已脱困，等待岛上人员与战船撤离后，它将腾空翻身。",6);
  }
  if(kunRollActive&&!kunRollWasActive&&gameStarted&&player.position.distanceTo(saihojiBgmPoint)<140){
    showToast("鲲已脱困，正在腾空翻身！苔庭与松林会随它一同翻转。",6);
  }
  kunRollWasActive=kunRollActive;
  kunRollWasPending=kunRollPending;
  originalWorldRomanArmor.update();
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
  morrisPrincessPatrol?.update(dt,t);
  morrisHorseRide.pose();
  // 驾驶舱第一人称（飞行器 / 气泡艇）由各自 update 写相机，跳过第三人称跟随
  const cockpitView =
    scoutAircraftRide?.isRiding?.() || aircraftRide.isRiding?.() || bubblePodRide.isRiding?.();
  if (!cockpitView&&!targetCityInspection?.active&&!moonLakeInspection?.active&&!morrisInspection?.active) {
    if (swampTourCamera) {
      camera.position.copy(swampTourCamera.position);
      camera.up.copy(swampTourCamera.up);
      camera.lookAt(swampTourCamera.target);
    } else { swampCameraProfile.update(dt); cameraRig.update(dt); swampOcclusionFade.update(camera,player,(swampCameraProfile.report.weight||0)>.2); }
    swampWaterMarks.update(performance.now()*0.001,camera);
  }
  { const tt=performance.now()*0.001; swampPaintWater.update(tt); swampWaterfalls.update(tt); swampRimFlowers.update(tt); swampFloatingDebris.update(tt); swampHarborScene.update(tt); }
  robotOperations?.updateCamera();
  moonLakeInspection?.update(dt,t);
  if(!morrisStartupTourShown&&gameStarted&&new URLSearchParams(location.search).get('tour')==='morris'){const button=document.getElementById('dev-morris-review');if(button){morrisStartupTourShown=true;button.click();if(new URLSearchParams(location.search).get('morrisClean')==='1'){const style=document.createElement('style');style.textContent='body > :not(canvas):not(script):not(style):not(link){visibility:hidden!important;pointer-events:none!important}';document.head.append(style);}morrisInspection?.setView(({court:'城堡琴庭',bridge:'桥前望溪',overview:'岛屿全景',creek:'溪谷',castle:'城堡'})[new URLSearchParams(location.search).get('morrisView')]||'公主巡游');}}
  morrisInspection?.update(dt,t);
  frameCpuMark("cameraWaterAndStory");
  quest.updateInteraction(dt);
  elderMusic.update(dt, t);
  // 阿狸在任务气泡之后更新，避免被 hideBubble 冲掉
  foxNpc.update(dt, t);
  rescueCampaign.update(dt);
  tigerCompanion.update(dt);
  // ---------- 书店镇袭击战（主人 2026-09-18）----------
  // 侦察机队巡回至书店镇/古堡时：古堡驻军开拔增援，交战期播放
  // 《The Best Is Yet To Come》（siege 通道独占，撤离后回落）。
  {
    const squad = messenger?.landmarks?.scoutDefense;
    const zone = squad?.getZone?.();
    const raidZone = !batianFleet && (zone === "bookshop" || zone === "citadel");
    if (raidZone && !raidBeatActive) {
      raidBeatActive = true;
      setSiegeAssaultBgm(true, { resume: true });
      const dir =
        zone === "bookshop" && messenger?.landmarks?.bookshop
          ? messenger.landmarks.bookshop.position.clone().normalize()
          : null;
      if (dir) {
        messenger?.landmarks?.saihojiPhalanx?.userData?.marchGarrisonTo?.(dir);
        const assault = messenger?.vanguardAssault || messenger?.combatPack?.vanguardAssault || null;
        if (assault && typeof assault.begin === "function") {
          assault.begin(dir);
        }
      }
      showToast("警报：莫比斯舰队出现在书店镇上空，运输艇投送重甲兵，古堡战船登陆增援！", 4);
    } else if (!raidZone && raidBeatActive) {
      raidBeatActive = false;
      setSiegeAssaultBgm(false, { fade: 0.6 });
    }
  }
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

  frameCpuMark("questsAndUI");
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
  // Legacy scene updates can toggle windows after the city update; enforce
  // retirement at the render boundary even when distance culling is disabled.
  targetCityRuntime?.enforceVisibility();
  batianFleet?.enforceVisibility?.();
  if (entryParams.get('tour') === 'bookshop-battle' && entryBookshop) {
    const c=entryBookshop.getWorldPosition(new THREE.Vector3()),up=c.clone().normalize();
    const side=new THREE.Vector3(0,1,0).cross(up).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
    const forward=new THREE.Vector3().crossVectors(up,side).normalize();
    camera.up.copy(up);camera.position.copy(c).addScaledVector(up,75).addScaledVector(forward,100).addScaledVector(side,60);
    camera.lookAt(c.clone().addScaledVector(up,18));camera.updateMatrixWorld(true);
  }
  if(batianFollowCamera&&crystalColossus){
    const craft=crystalColossus.aircraft,c=craft.getWorldPosition(new THREE.Vector3()),up=c.clone().normalize(),f=new THREE.Vector3(0,0,1).applyQuaternion(craft.quaternion),side=new THREE.Vector3(1,0,0).applyQuaternion(craft.quaternion);
    const target=batianTargets.find(x=>x.id===batianFleet?.snapshot().target),aim=target&&batianFleet?.active?c.clone().lerp(target.dir.clone().multiplyScalar(PLANET_RADIUS+8),.35):c;
    const combatView=batianFleet?.snapshot(),attacking=['blockade','pincer','cannon','guard'].includes(combatView?.phase),showUnderside=attacking&&combatView?.pendingWeapon==='cannon'&&combatView?.bay?.openness>.2;
    camera.up.copy(up);camera.position.copy(c).addScaledVector(up,showUnderside?-20:attacking?30:65).addScaledVector(f,attacking?-95:-180).addScaledVector(side,attacking?75:80);camera.lookAt(aim);
    const impact= combatView?.arsenal?.lastImpact;
    if(attacking&&impact&&impact.age<(impact.type==='ion'?5:impact.type==='rain'?1.8:0)&&!showUnderside){const p=new THREE.Vector3().fromArray(impact.point),normal=p.clone().normalize(),sideGround=new THREE.Vector3(0,1,0).cross(normal).normalize();if(sideGround.lengthSq()<.1)sideGround.set(1,0,0);const backGround=normal.clone().cross(sideGround).normalize();camera.up.copy(normal);camera.position.copy(p).addScaledVector(normal,25).addScaledVector(sideGround,30).addScaledVector(backGround,35);camera.lookAt(p.clone().addScaledVector(normal,4));}
    const blast=scene.userData.batianBlast;if(blast&&blast.age<.65&&camera.position.distanceTo(blast.position)<250){const shake=.45*(1-blast.age/.65);camera.position.addScaledVector(side,Math.sin(blast.age*83)*shake).addScaledVector(up,Math.cos(blast.age*67)*shake);}
    if(attacking&&combatView?.target==='moss'){
      const battlefield=scene.getObjectByName('saihoji-phalanx-battle'),d=target.dir.clone().normalize();
      const height=battlefield?.userData.groundHeightAt?.(d);
      if(Number.isFinite(height)){const centre=d.clone().multiplyScalar(height),across=new THREE.Vector3(0,1,0).cross(d);if(across.lengthSq()<.01)across.set(1,0,0);across.normalize();const back=d.clone().cross(across).normalize();camera.up.copy(d);camera.position.copy(centre).addScaledVector(d,45).addScaledVector(across,28).addScaledVector(back,55);camera.lookAt(centre.clone().addScaledVector(d,12));}
    }
    camera.updateMatrixWorld(true);
  }
  if (entryParams.get('tour') === 'moon-grass') {
    const lake = messenger?.moonLake;
    if (lake?.group) {
      const up = lake.group.position.clone().normalize();
      const tangent = new THREE.Vector3(0,0,1).applyQuaternion(lake.group.quaternion);
      camera.up.copy(up);camera.position.copy(lake.group.position).addScaledVector(up,32).addScaledVector(tangent,50);
      camera.lookAt(lake.group.position);camera.updateMatrixWorld(true);
    }
  }
  if (entryParams.get('tour') === 'batian' && crystalColossus) {
    const f = crystalColossus.frame;
    camera.up.copy(f.center);
    camera.position.copy(f.center).multiplyScalar(PLANET_RADIUS + 125).addScaledVector(f.north, -150).addScaledVector(f.east, 105);
    camera.lookAt(f.center.clone().multiplyScalar(PLANET_RADIUS + 15));
    camera.updateMatrixWorld(true);
  }
  frameCpuMark("cullingAndLights");
  const restoreGuardianAtmosphere=guardianAtmosphere.apply();
  try {
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
  } finally { restoreGuardianAtmosphere(); }
  // 必须在 render 之后读，renderer.info 才是本帧的真实提交数
  frameCpuMark("render");
  if(frameCpuEnabled){frameCpuRows.push(frameCpuRow);if(frameCpuRows.length>60)frameCpuRows.shift();}
  perfProbe?.update(dt);
}

await startup.checkpoint('正在装配圣城街道与广场…');
if(targetCityRuntimeEnabled()&&messenger?.landmarks?.citadelRange){
 const castle=scene.getObjectByName('castleContainer');
 const tramSystem=messenger.landmarks.tramSystem;
 const cliffTransitRelease=tramSystem?.citadelTransitRelease??null;
 targetCityRuntime=await runStartupSteps(installTargetCityRuntimeSteps({castle,sceneRoot:scene,citadelRange:messenger.landmarks.citadelRange,renderer,distanceCulling,candidateOptions:createTargetCityProductionOptions({tramSystem,oldCityWingStreets:new URLSearchParams(location.search).get('citadelOldWingStreets')!=='0'})}), startup.checkpoint);
 await startup.checkpoint('正在校验铁路、地形与步行连接…');
 if(tramSystem?.crossingBundle){
  const support=createTargetEastCrossingStartupSupport({enabled:true,scene,castle,tramSystem,runtime:targetCityRuntime,planet,hills:messenger.hills,ocean:scene.getObjectByName('planet-v8-curved-ocean'),radius:PLANET_RADIUS});
  try{support.commit();support.finalize();targetCityRuntime.report.tram.startupSupport=support.report;}
  catch(error){support.dispose();throw error;}
 }
 if(cliffTransitRelease){
  Object.assign(targetCityRuntime.report.tram,{routeIntegrated:true,geometryAndVehiclesShareRoute:true,releaseVersion:cliffTransitRelease.version,continuousRouteVerified:false});
  cliffTransitRelease.report.installed=true;
 }
 try{gateApproachRailings?.apply?.();}catch(error){console.warn('[gate-railings] re-apply skipped',error);}
 try{newCityPlazaLevel=levelNewCityPlaza({scene});}catch(error){console.warn('[plaza-level] skipped',error);newCityPlazaLevel={applied:false,error:String(error)};}
 if(window.__tm)window.__tm.newCityPlazaLevel=newCityPlazaLevel;
 await startup.checkpoint('正在安置守军与步行路线…');
 const garrisonSupport=messenger.landmarks.saihojiPhalanx?.refreshNewCitySupport?.({root:targetCityRuntime.root});
 targetCityRuntime.report.garrisonSupport=garrisonSupport?.report??garrisonSupport??null;
 citadelGuardian=createCitadelPlazaGuardian({scene,castle,statue:castle.getObjectByName('citadel-plaza-hero-statue'),horse:messenger.landmarks.citadelRange.trojanHorse,nightInfiltration:messenger.landmarks.citadelRange.nightInfiltration,getFleet:()=>messenger.landmarks.aircraftSquad,getAssault:()=>messenger.vanguardAssault||messenger.combatPack?.vanguardAssault,getPlayerAircraft:()=>aircraftRide.isRiding()?messenger.landmarks.aircraftSquad?.children[0]:null,getListenerPosition:()=>camera.getWorldPosition(new THREE.Vector3())});
 targetCityRuntime.report.guardian=citadelGuardian.report;
 console.info('[citadel] default city installed',JSON.stringify({oldCity:targetCityRuntime.report.cityDetail.oldCity.geometry.version,newCity:targetCityRuntime.report.cityDetail.newCityStairs.authored.revision,rock:targetCityRuntime.report.cityDetail.rockAppearance.version,landmarks:targetCityRuntime.report.landmarkIntegration.ok,spawn:'bookshop-unchanged'}));
}
await startup.checkpoint('正在准备首帧画面…');
animate();
startup.finish();

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
  get gateApproachRailings() { return gateApproachRailings; },
  bookshopJakubPass,
  newCityPlazaLevel,
  swampEdgeGuard, // 湖沼走一圈护栏：__tm.swampEdgeGuard.report
  portEdgeGuard, // 母塔港码头/升降台护栏
  swampCavityClearance, // 湖沼空腔旧几何清理报告
  swampWalkwaySteer, // 坑缘环形步道沿线行走
  swampCameraProfile,
  swampAirspaceClearance,
  swampOcclusionFade,
  swampTargetPass,
  swampAirHaze,
  swampInkPost,
  frameCpuProfile,
  swampHandInk,
  swampWaterMarks,
  swampPaintWater, swampTreeRoots, swampWaterfalls, swampRimFlowers, swampFloatingDebris, swampWhaleCalves, swampHarborScene,
  tigerCompanion,
  sampleSwampGroundChain: position=>({local:swampGroundZone?.worldToLocal(position.clone()).toArray(),stair:sampleSwampStairGround(swampGroundZone,position),authored:sampleSwampAuthoredGround(swampGroundZone,position),bridge:swampWalkAidGround(position),rim:sampleSwampRimGround(swampGroundZone,position),v7:messenger?.landmarks?.moebius?.v7Shores?.userData.sampleGroundRadius(position),junction:junctionPlayerSupport.ground(position),gate:gatePlayerGround(position),city:targetCityPlayerNavigation?.ground(position),citadel:citadelPlayerGround?.(position),highland:highlandGateRuntime?.userData.sampleGroundRadius?.(position),lake:sampleSwampGround(position),legacyPlatformsSuppressed:swampOwnsPhysics(position)}),
  samplePlayerLocalGround, playerSupportRadius, // 与玩家物理同一套地面采样，供走圈回归测试
  targetCityRuntime,
  citadelGuardian,
  get targetCityPlayerNavigation(){return targetCityPlayerNavigation;},
  THREE, // 控制台调试用：new __tm.THREE.Raycaster() 等
  fleet: fleetSelfCheck, // 舰队自检：__tm.fleet()——见上方读法
  player,
  quest,
  rescueCampaign,
  cameraRig,
  camera, // 调试/验收截图用
  renderer, // 性能探针读取 draw calls / triangles
  P,
  dayNight, // Shared clock exposed for reproducible day/dusk/night scene checks.
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
  get robotOperations(){return robotOperations;},
  tramRide,
  robotGreeting,
  morrisHorseRide, morrisPrincessPatrol,
  boatRide, // Actual boarding controller, exposed alongside other ride diagnostics.
  bgm: { snapshot:getBgmOwnershipSnapshot },
  airshipRide,
  scoutAircraftRide,
  elderMusic,
  foxNpc,
  batianFleet,
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
