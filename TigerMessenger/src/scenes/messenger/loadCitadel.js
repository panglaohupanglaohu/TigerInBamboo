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
} from "../../world/citadelRange.js?v=20260903-navona-at-harbor-v1";
import {
  buildOdysseyCitadel,
  CITADEL_TERRAIN_KEY,
  CITADEL_TERRAIN_OBJECTS_KEY,
} from "../../world/odysseyCitadel.js?v=20260903-merged-patch-v1";
import { CITADEL_LEVELS_KEY, normalizeCitadelTerraceLayout } from "../../world/citadelTown.js?v=20260905-townscaper-palette-v1";

import { loadCitadelLevelsSave } from "../../world/citadelLevelsSave.js";
import { OFFICIAL_OCEAN_SEA_LEVEL, HIGHLAND_CASTLE_SEA_DROP } from "../../world/waterV8/officialOcean.js";
import { highlandTerrainSurfaceHeight } from "../../world/highlandCitadelDesign.js?v=20260828-reference-light-v9";
import {
  createCitadelTerraceBirds,
} from "../../world/citadelTerraceBirds.js?v=20260823-citadel-reference-v2";
import { createSaihojiPhalanxBattle } from "../../world/saihojiPhalanx.js?v=20260904-shared-projectile-assets-v1";
import { createVanguardSquad } from "../../world/vanguardTrooper.js";
import { createVanguardAssault } from "../../world/vanguardAssault.js";
import { createSoccoCraft } from "../../world/gateHaulerCraft.js";
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
    const migrated = loadCitadelLevelsSave(localStorage, {
      instanceId: null,
      normalize: normalizeCitadelTerraceLayout,
    });
    if (migrated?.layout) citadelSpec = migrated.layout;
    else {
      const saved = JSON.parse(localStorage.getItem(CITADEL_LEVELS_KEY) || "null");
      if (saved && (Array.isArray(saved) || Array.isArray(saved.terraces) || saved.layout)) {
        citadelSpec = saved.layout || saved;
      }
    }
  } catch { /* 损坏存档回落内置 SPEC */ }
  let citadelTerrainObjects;
  try {
    const saved = JSON.parse(localStorage.getItem(CITADEL_TERRAIN_OBJECTS_KEY) || "[]");
    if (Array.isArray(saved)) citadelTerrainObjects = saved;
  } catch { /* 损坏存档回落空地貌对象 */ }
  // 木马只要一匹（主人定案 2026-09-03）：故事木马由 placeNavonaPlaza 浮在港边水面上。
  // 这里不再注入常驻地貌木马，否则城堡门前会多出第二匹。

  const odysseyCitadel = buildOdysseyCitadel({
    dir: citadelDir,
    faceDir: moonLake?.centerWorld || null,
    // HIGHLAND_CASTLE_SEA_DROP：主人验收 2026-08-27——城堡与台地整体下降，
    // 城市基面(4.95)与海面(0.72)接触，台地崖壁没入海中（S13 参考构图）。
    groundRadius: R + citadelRangeLiftDir(citadelDir) + islandLift - HIGHLAND_CASTLE_SEA_DROP,
    planetRadius: R,
    seed: 20260808,
    spec: citadelSpec,
    contour: citadelContour,
    terrainObjects: citadelTerrainObjects,
    latestDesign: true,
  });
  scene.add(odysseyCitadel);
  odysseyCitadel.updateMatrixWorld(true);
  snapOldHarborToSeaCove({ odysseyCitadel, harbor, harborBuilt, harborColliders, camp, R });

  // 纳沃纳广场落在城堡→旧港连线的 70% 处，门洞朗港（广场局部 +X）。
  // 它是 saihojiPhalanx 的集结点；不摆就回落到城堡侧后方，整个故事场景被城堡遮住。
  // 坐标由旧港实位反解：写死会在 snapOldHarborToSeaCove 改港口位置后失配。
  {
    const h = rangeWorldToLocal(harbor.getWorldPosition(new THREE.Vector3()));
    const t = 0.70;
    const gx = h.x * (1 - t);
    const gz = h.z * (1 - t);
    citadelRange.placeNavonaPlaza(h.x * t, h.z * t, Math.atan2(-gz, -gx), odysseyCitadel);
  }

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

/**
 * 旧港整组贴回圣城岸湾（主人验收 2026-08-27）：港口原本停在 range 基准面，
 * 沉在湖盆水下、海壳横穿树干。这里把整组沿城堡 up 抬到岸湾山体顶面
 * （isHighlandWaterfrontCutout 已为岸湾保留山体），渔船单独压回海平面。
 * 世界碰撞体（港口/起重机/弹琴老人）随抬升刷新。
 */
function snapOldHarborToSeaCove({ odysseyCitadel, harbor, harborBuilt, harborColliders, camp, R }) {
  if (!odysseyCitadel || !harbor?.isGroup) return;
  odysseyCitadel.updateMatrixWorld(true);
  harbor.updateMatrixWorld(true);
  const up = citadelSiteDir(new THREE.Vector3());
  const inv = new THREE.Matrix4().copy(odysseyCitadel.matrixWorld).invert();
  const local = harbor.position.clone().applyMatrix4(inv);
  const terrain = highlandTerrainSurfaceHeight(local.x, local.z);
  if (!Number.isFinite(terrain)) return;
  const delta = terrain - local.y;
  if (!(Math.abs(delta) > 1e-4)) return;
  harbor.position.addScaledVector(up, delta);
  harbor.updateMatrixWorld(true);
  // 船留在海面：泊位在水上，不跟港台一起上崖
  const boat = harborBuilt?.landmarks?.boat;
  if (boat) {
    const boatR = boat.getWorldPosition(new THREE.Vector3()).length();
    boat.position.y -= boatR - (R + OFFICIAL_OCEAN_SEA_LEVEL + 0.1);
    boat.updateMatrixWorld(true);
  }
  for (const collider of harborColliders || []) collider.position.addScaledVector(up, delta);
  // 弹唱老人的最终落位在 messengerIsland 的沉船编排块（湖沼旁半沉沉船）
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
  // 先锋重甲兵中队（用户 2026-09-04）：随莫比斯 aircraft 出行 → 苔庭之战落地参战。
  // 挂在 scene 上而不是机队下——伴飞是每帧跟位，落地后就该留在地面，
  // 挂成机队子节点的话机队一走它们会被拖上天。
  const vanguardSquad = createVanguardSquad();
  vanguardSquad.name = "vanguard-squad";
  scene.add(vanguardSquad);

  // gateHaulerCraft 气垫运输艇 ×3（先锋兵专属）：贴海进场 → 苔庭附近海面开
  // 尾门放出重甲兵（每艇 6 名，实载 6/6/4）→ 撤离时苔庭上空收绳 → 贴海离场。
  // 原本停在叹息之门的三艘全部随队参战（门口不再停运兵艇）。
  const vanguardHaulers = [0, 1, 2].map((i) => {
    const c = createSoccoCraft();
    c.name = `vanguard-hauler-${i}`;
    c.visible = false; // 开局不出场，vanguardAssault.begin 时才压到进场起点
    scene.add(c);
    return c;
  });

  // 先锋兵突击任务状态机：到场（索降+卸兵）→ 三三制推进 → 闪电炮/激光刀作战 → 绳索撤离
  let saihojiPhalanx = null; // 改 let：突击模块要懒取 phalanx 暴露的苔庭地表采样
  const vanguardAssault = createVanguardAssault({
    scene,
    squad: vanguardSquad,
    R,
    getPods: () => aircraftSquad?.userData?.gatePodEscort?.children || [],
    getHaulers: () => vanguardHaulers,
    getFleet: () => aircraftSquad || null,
    getGroundHeightAt: () => saihojiPhalanx?.userData?.groundHeightAt || null,
    getDefenders: () => saihojiPhalanx?.userData?.getDefenders?.() || [],
    getSpawnSmoke: () => saihojiPhalanx?.userData?.spawnSmoke || null,
    // 巡演下一站：湖沼（moebius-swamp）。湖沼之虎与红狐受保护（白名单），
    // 其余生物一旦登记进可打清单即会被扫描光线/麻醉炮/重甲兵攻击
    // 巡演路线（主人 2026-09-05：「组成一个强大的陆海空舰队去扫荡一切景点」）：
    // 不再只有湖沼一站，而是按下面这一圈景点轮转，走完一圈从头再来。
    // 找不到的站自动跳过（场景没加载就当它不存在），一站都找不到才返回 null。
    // getTourAnchor 于 2026-09-06 下线（主人：「舰队围绕主舰」）。
    // 它原本是一个 4 站轮转环（湖沼 / 老港 / 纳沃纳广场 / 绿丘停机坪），
    // 由登陆队自己排班挑下一站，再用 missionLock 把主舰拽过去——反向指挥，
    // 也是「重甲兵反复空降」的主发动机（站与站之间没有一帧停顿）。
    // 现在扫荡由主舰自己的航线完成：主舰停在哪，登陆队就在哪开局。
    // 若要让舰队走遍这四站，改的是**主舰的航线**，不是这里。
    getTourTargets: () => {
      // 白名单：湖沼之虎（swampTiger）、红狐（fox-ali）永不成为目标。
      // 目前湖沼暂无其它战斗生物登记 → 返回空（框架就绪，新生物加入即自动参战）。
      const protectedNames = /tiger|swamp-tiger|fox-ali/i;
      const list = [];
      scene.traverse((o) => {
        if (!o.parent || o.userData?.dead) return;
        if (!o.userData?.combatant && !o.userData?.wildCreature) return;
        if (o.userData.faction === "moebius") return;   // 舰队自身单位
        if (protectedNames.test(o.name || "")) return;  // 白名单
        if (o.userData.unitClass === "vanguard-trooper") return;
        list.push(o);
      });
      return list;
    },
  });
  scene.add(vanguardAssault.root);

  const saihojiPhalanxBattle = useV3
    ? null
    : createSaihojiPhalanxBattle({
        scene,
        isWhaleRisen: () => {
          const lev = scene.getObjectByName("leviathanGroup");
          return !!(lev && lev.position.length() > R + 3);
        },
        getSquad: () => aircraftSquad,
        getVanguards: () => vanguardSquad,
        vanguardAssault,
        getTram: () => tramSystem,
        oldHarbor: harborBuilt || harbor,
        getTimeOfDay: () => P.timeOfDay,
        getNightInfiltration: () => citadelRange?.nightInfiltration || null,
        surfaceProvider: planetV8?.surfaceProjectionEnabled ? planetV8.compiler?.surface : null,
        surfaceProjectionEnabled: !!planetV8?.surfaceProjectionEnabled,
        seed: FEATURES.combatSeed,
        events: createCombatEventLog({ seed: FEATURES.combatSeed, scenario: "siege" }),
      });
  saihojiPhalanx = saihojiPhalanxBattle;
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

  return { saihojiPhalanx, vanguardSquad, vanguardAssault, vanguardHaulers, paperLanding, tacticalGraph, tacticalGraphView, collectCastleGates, tgState };
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
