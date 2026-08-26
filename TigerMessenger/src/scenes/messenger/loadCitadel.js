// =====================================================================
//  高山圣城：range / 旧港贴地 / odyssey / V4 适配 / 台地鸟 / 攻城 / 战术图
// =====================================================================
import * as THREE from "three";
import { FEATURES, P } from "../../core/params.js";
import { createCombatEventLog } from "../../world/combatEvents.js";
import {
  buildCitadelRange,
  citadelRangeLiftDir,
  citadelSiteDir,
  citadelWalkFlights,
  citadelWalkLiftLocal,
  citadelWalkMetrics,
  rangeLocalToWorld,
  rangeWorldToLocal,
  CITADEL_CASCADE_POOL_SPECS,
} from "../../world/citadelRange.js?v=20260825-old-harbor-tree-return-v6";
import {
  buildOdysseyCitadel,
  CITADEL_TERRAIN_KEY,
  CITADEL_TERRAIN_OBJECTS_KEY,
} from "../../world/odysseyCitadel.js?v=20260825-highland-reference-clean-v7";
import { CITADEL_LEVELS_KEY } from "../../world/citadelTown.js?v=20260825-highland-obelisk-stone-v3";
import {
  createCitadelTerraceBirds,
} from "../../world/citadelTerraceBirds.js?v=20260823-citadel-reference-v2";
import { createSaihojiPhalanxBattle } from "../../world/saihojiPhalanx.js?v=20260823-citadel-reference-v2";
import { isCitadelCombatV3 } from "../../core/params.js";
import { createHarborLandingSample, selectCombatBackend } from "../../agents/citadel/combatSample.js";
import {
  createCitadelTacticalGraph,
  createTacticalGraphDebugView,
} from "../../world/citadelTacticalGraph.js";

export function loadCitadelBlock({ scene, R, moonLake, camp, harbor, harborBuilt, tramSystem, highlandIslandLift = 0 }) {
  const islandLift = Number.isFinite(highlandIslandLift) ? highlandIslandLift : 0;
  let savedCitadelContour;
  try {
    const saved = JSON.parse(localStorage.getItem(CITADEL_TERRAIN_KEY) || "null");
    if (saved && (Number.isFinite(saved.baseRadius) || Array.isArray(saved.terraces))) {
      savedCitadelContour = saved;
    }
  } catch { /* 损坏存档回落内置台地参数 */ }
  // 2026-08-23 最新圣城：旧五层台地存档只保留非水系参数，不再允许恢复
  // 五座梯湖、四道瀑布或台地缺口。新地形由单一连续山谷网格承担。
  const citadelContour = {
    ...(savedCitadelContour || {}),
    presentationMode: "mountain-valley-v1",
    cascadeEnabled: false,
    cascadePoolsEnabled: false,
    notchedLayers: 0,
    notchHalf: 0,
  };
  const citadelRange = buildCitadelRange(scene, R, citadelContour);
  const citadelDir = citadelSiteDir(new THREE.Vector3());

  const harborColliders = placeHarborOnCitadel({ R, camp, harbor, harborBuilt, islandLift });
  restoreOldHarborTreePair({ harbor, harborBuilt, citadelRange });

  let citadelSpec;
  try {
    const saved = JSON.parse(localStorage.getItem(CITADEL_LEVELS_KEY) || "null");
    if (saved && (Array.isArray(saved) || Array.isArray(saved.terraces))) citadelSpec = saved;
  } catch { /* 损坏存档回落内置 SPEC */ }
  let citadelTerrainObjects;
  try {
    const saved = JSON.parse(localStorage.getItem(CITADEL_TERRAIN_OBJECTS_KEY) || "[]");
    if (Array.isArray(saved)) citadelTerrainObjects = saved;
  } catch { /* 损坏存档回落空地貌对象 */ }

  const odysseyCitadel = buildOdysseyCitadel({
    dir: citadelDir,
    faceDir: moonLake?.centerWorld || null,
    groundRadius: R + citadelRangeLiftDir(citadelDir) + islandLift,
    planetRadius: R,
    seed: 20260808,
    spec: citadelSpec,
    contour: citadelContour,
    terrainObjects: citadelTerrainObjects,
    latestDesign: true,
  });
  scene.add(odysseyCitadel);
  odysseyCitadel.updateMatrixWorld(true);
  if (islandLift > 0) {
    const up = citadelDir.clone().normalize();
    for (const obj of [
      citadelRange.snowMountains,
      citadelRange.moat,
      citadelRange.trojanHorse,
      citadelRange.navonaPlaza,
    ]) {
      if (!obj?.position) continue;
      obj.position.addScaledVector(up, islandLift);
      obj.updateMatrixWorld?.(true);
    }
  }

  // The V4 snapshot compiler still describes the retired five-terrace castle.
  // Compiling it against the continuous mountain-valley design would both
  // reintroduce obsolete combat surfaces and fail its terrace/notch route gate.
  // Keep the adapter available for explicit legacy builds, but never attach it
  // to the reference reconstruction.  The live battle below consumes the new
  // castle-top assault anchors directly.
  const v4Runtime = null;
  odysseyCitadel.userData.v4RuntimeSuppressed = "retired-five-terrace-topology";

  const terraceBirds = createCitadelTerraceBirds(scene, odysseyCitadel, {
    contour: citadelContour,
    disabled: true,
    getTram: () => tramSystem?.tram || null,
    getInfiltration: () => citadelRange?.nightInfiltration || null,
  });

  return {
    citadelRange,
    citadelDir,
    odysseyCitadel,
    terraceBirds,
    birdVortex: terraceBirds.primary,
    harborColliders,
    citadelContour,
    v4Runtime,
  };
}

/**
 * 旧港口的两株参天古樟必须是港口子树的一部分，而不是圣城山坡植物。
 * 复用 range 构建器已生成的确定性资产，重新设置为港口局部坐标，保持
 * 两株古树的灯光注册、资产类型和存档引用不变。
 */
function restoreOldHarborTreePair({ harbor, harborBuilt, citadelRange }) {
  if (!harbor || !citadelRange) return [];
  const trees = [
    [citadelRange.sacredTarnTree, -3.5, 0, 3.25, -0.18],
    [citadelRange.tarnCompanionPine, 2.8, 0, 3.15, 0.88],
  ].filter(([tree]) => tree?.isGroup);
  for (const [tree, x, y, z, yaw] of trees) {
    tree.removeFromParent();
    harbor.add(tree);
    tree.visible = true;
    tree.position.set(x, y, z);
    tree.rotation.set(0, yaw, 0);
    tree.scale.setScalar(1);
    tree.userData.pendingHarborRestore = false;
    tree.userData.designRole = "old-harbor-giant-tree";
    tree.userData.harborLocal = { x, y, z, yaw };
    tree.userData.referenceScale = 1;
  }
  const restored = trees.map(([tree]) => tree);
  harbor.userData.oldHarborGiantTreeCount = restored.length;
  harbor.userData.oldHarborGiantTrees = restored;
  if (harborBuilt?.landmarks) harborBuilt.landmarks.oldHarborGiantTrees = restored;
  harbor.updateMatrixWorld(true);
  return restored;
}

function placeHarborOnCitadel({ R, camp, harbor, harborBuilt, islandLift = 0 }) {
  const TREE_LX = -15.2;
  const TREE_LZ = 42.0;
  const POOL_LX = 1.0;
  const POOL_LZ = 43.0;
  const toPoolFlatX = POOL_LX - TREE_LX;
  const toPoolFlatZ = POOL_LZ - TREE_LZ;
  const flatLen = Math.hypot(toPoolFlatX, toPoolFlatZ) || 1;
  const harborLx = TREE_LX + (toPoolFlatX / flatLen) * 1.0;
  const harborLz = TREE_LZ + (toPoolFlatZ / flatLen) * 1.0;
  rangeLocalToWorld(harborLx, harborLz, R, harbor.position);
  const siteUp = citadelSiteDir(new THREE.Vector3());
  harbor.position.addScaledVector(siteUp, 0.04 + islandLift);
  const poolC = rangeLocalToWorld(POOL_LX, POOL_LZ, R, new THREE.Vector3());
  const toPool = poolC.sub(harbor.position);
  toPool.addScaledVector(siteUp, -toPool.dot(siteUp)).normalize();
  const zAxis = new THREE.Vector3().crossVectors(toPool, siteUp).normalize();
  harbor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(toPool, siteUp, zAxis));
  harbor.updateMatrixWorld(true);
  const harborWater = harbor.getObjectByName("harbor-water");
  if (harborWater) harborWater.visible = false;
  const boat = harborBuilt.landmarks.boat;
  if (boat && boat.position.y < 0.3) boat.position.y = 0.61;

  const elder = camp?.landmarks?.elder;
  const crane = harborBuilt.landmarks.crane;
  const cratesByCrane = harborBuilt.landmarks.cratesByCrane;
  if (elder && crane) {
    elder.removeFromParent();
    harbor.add(elder);
    const deckTop = cratesByCrane?.position?.y ?? crane.position.y ?? 0.51;
    const seat = new THREE.Vector3(
      (crane.position.x + (cratesByCrane?.position.x ?? 2.2)) * 0.5 - 0.75,
      deckTop,
      (crane.position.z + (cratesByCrane?.position.z ?? 1.0)) * 0.5 + 0.15
    );
    elder.position.copy(seat);
    elder.rotation.set(0, Math.PI * 0.55, 0);
    elder.updateMatrixWorld(true);
    const elderWorld = elder.getWorldPosition(new THREE.Vector3());
    const elderCol = camp.colliders?.find((c) => c.kind === "elder");
    if (elderCol) elderCol.position.copy(elderWorld);
    else camp.colliders?.push({ position: elderWorld.clone(), radius: 0.8, kind: "elder" });
    harborBuilt.landmarks.elder = elder;
  }

  return [
    { position: harbor.position.clone(), radius: 3.8 },
    {
      position: (crane || harborBuilt.landmarks.crane).getWorldPosition(new THREE.Vector3()),
      radius: 1.15,
    },
  ];
}

export function loadCitadelCombat({ scene, R, odysseyCitadel, citadelRange, harbor, harborBuilt, tramSystem, aircraftSquad, v4Runtime, planetV8 }) {
  const latestAssault = odysseyCitadel.userData.highlandAssaultAnchors || null;
  // V3's compiled surfaces still describe the retired terrace graph.  Until
  // that optional backend is rebuilt for this landmark, the latest scene keeps
  // the live phalanx battle, which consumes explicit castle-top routes.
  const useV3 = !latestAssault && selectCombatBackend({ combat: isCitadelCombatV3() }) === "v3";
  const saihojiPhalanx = useV3
    ? null
    : createSaihojiPhalanxBattle({
        scene,
        isWhaleRisen: () => {
          const lev = scene.getObjectByName("leviathanGroup");
          return !!(lev && lev.position.length() > R + 3);
        },
        getSquad: () => aircraftSquad,
        getTram: () => tramSystem,
        oldHarbor: harborBuilt || harbor,
        getTimeOfDay: () => P.timeOfDay,
        getNightInfiltration: () => citadelRange?.nightInfiltration || null,
        surfaceProvider: planetV8?.surfaceProjectionEnabled ? planetV8.compiler?.surface : null,
        surfaceProjectionEnabled: !!planetV8?.surfaceProjectionEnabled,
        seed: FEATURES.combatSeed,
        events: createCombatEventLog({ seed: FEATURES.combatSeed, scenario: "siege" }),
      });
  let paperLanding = null;
  if (useV3 && v4Runtime?.v4) {
    paperLanding = createHarborLandingSample(v4Runtime.v4, { seed: FEATURES.combatSeed });
    v4Runtime.combat = paperLanding;
  }

  let tacticalGraph = null;
  let tacticalGraphView = null;
  const tgState = { refreshT: 0, gatesJson: "" };
  const collectCastleGates = () => latestAssault
    ? [{
        terraceIndex: 0,
        x: latestAssault.keepTop[0],
        z: latestAssault.keepTop[2],
        width: 3.2,
        destination: "castle-top",
      }]
    : (odysseyCitadel.userData.townStats?.gates || []).map((g) => ({
        terraceIndex: g.terraceIndex,
        x: g.x,
        z: g.z,
        width: 1.4,
      }));
  if (FEATURES.citadelCombatV2 && !latestAssault) {
    const horseLocal = citadelRange.trojanHorse
      ? rangeWorldToLocal(citadelRange.trojanHorse.position)
      : null;
    const plazaLocal = citadelRange.navonaPlaza
      ? rangeWorldToLocal(citadelRange.navonaPlaza.getWorldPosition(new THREE.Vector3()))
      : null;
    const harborLocal = rangeWorldToLocal(harbor.position);
    tacticalGraph = createCitadelTacticalGraph({
      metrics: citadelWalkMetrics(),
      flights: citadelWalkFlights(),
      walkLift: v4Runtime?.walkLift || citadelWalkLiftLocal,
      contour: odysseyCitadel.userData.blueprint?.terrain?.config ?? undefined,
      gates: collectCastleGates(),
      extras: {
        waterfalls: (CITADEL_CASCADE_POOL_SPECS || []).map((p) => ({ x: p.x, z: p.z })),
        harbor: harborLocal,
        plaza: plazaLocal,
        trojanDrops: horseLocal ? [horseLocal] : [],
      },
    });
    tgState.gatesJson = JSON.stringify(collectCastleGates());
    if (typeof location !== "undefined" && new URLSearchParams(location.search).get("tgDebug") === "1") {
      const siteUp = citadelSiteDir(new THREE.Vector3());
      const siteRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), siteUp).normalize();
      const siteFwd = new THREE.Vector3().crossVectors(siteUp, siteRight).normalize();
      tacticalGraphView = createTacticalGraphDebugView(tacticalGraph, (p) =>
        siteUp
          .clone()
          .addScaledVector(siteRight, p.x / 160)
          .addScaledVector(siteFwd, p.z / 160)
          .normalize()
          .multiplyScalar(R + p.y + 0.25)
      );
      scene.add(tacticalGraphView.root);
    }
    console.info(`[citadelCombatV2] 战术导航图就绪：${JSON.stringify(tacticalGraph.stats())}`);
  }

  return { saihojiPhalanx, paperLanding, tacticalGraph, tacticalGraphView, collectCastleGates, tgState };
}

export function tickTacticalGraph(pack, dt) {
  const { tacticalGraph, tacticalGraphView, collectCastleGates, tgState } = pack;
  if (!tacticalGraph) return;
  tacticalGraph.tick(dt);
  tgState.refreshT -= dt;
  if (tgState.refreshT > 0) return;
  tgState.refreshT = 1;
  const changed = tacticalGraph.rebuildChanged(citadelWalkMetrics(), citadelWalkFlights());
  const gatesNow = JSON.stringify(collectCastleGates());
  if (gatesNow !== tgState.gatesJson) {
    tgState.gatesJson = gatesNow;
    tacticalGraph.refreshGates(collectCastleGates());
    tacticalGraphView?.rebuild();
  }
  if (changed.length) tacticalGraphView?.rebuild();
}
