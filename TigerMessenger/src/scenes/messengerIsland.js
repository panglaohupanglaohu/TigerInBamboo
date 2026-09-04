// =====================================================================
//  场景：信使主岛（装配器）
//  出生 / 交通 / 城堡 / 水晶城 / 逐帧更新拆到 scenes/messenger/
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "../world/planet.js";
import { buildWorld } from "../world/platforms.js";
import { buildHills, groundLiftAt } from "../world/hills.js";
import { decorateFarSide, decoratePlayZone, createCloudRing, settleBuriedAssets } from "../world/nature.js";
import { createMoonLake } from "../world/lake.js";
import { GRAND_CRYSTAL } from "../world/moebiusCity.js";
import { canyonOffsetDir } from "../world/canyon.js";
import { SAIHOJI_ZONES } from "../world/saihoji.js";
import { buildStartingCamp } from "../world/startingCamp.js";
import { placeObjectOnSphere, latLonToDir, quatYToDir } from "../world/sphereMath.js";
import { createGrassTuft } from "../assets/bookshop.js";
import { createBookshopHydrangeas } from "../assets/hydrangea.js";
import { createCatalogObject } from "../core/buildingCatalog.js";
import { buildOldHarborScene } from "../assets/harbor.js";
import { buildImpastoMossyGround } from "../world/mossyGround.js";
import { mergeStaticGroup } from "../world/geometryMerge.js";
import { WORLD_SCALE } from "../world/worldScale.js";
import { loadCitadelBlock, loadCitadelCombat } from "./messenger/loadCitadel.js?v=20260903-navona-at-harbor-v1";
import { loadMoebiusDistrict, placeMoebiusSwampAndSky } from "./messenger/loadMoebius.js";
import { loadTram, loadCanalNetwork, loadAbandonedGateBlock } from "./messenger/loadTraffic.js";
import { updateMessengerIsland } from "./messenger/updateIsland.js";
import { createSwampBgmState } from "./messenger/swampBgm.js";
import { createPlanetV8Runtime, planetRendererOwnership } from "../world/planetV8/runtime.js";
import { createScoutDefenseSquad } from "../world/scoutDefense.js";
import { pruneTaggedOfficialOceanOccludeds } from "../core/officialOceanOcclusionPruning.js";
import { sampleSceneHeightAt, collectStaticTerrainMeshes } from "../world/planetV8/cloudTerrainRemap.js";
import { FEATURES } from "../core/params.js";

/** 正式主页（custom/legacy）挂球面 impostor 云海与曲率海洋，只留水晶城运河，不改全局 DEFAULT_ON。 */
export function officialPagePlanetFeatures(base = FEATURES) {
  const features = { ...base };
  const explicit = features.worldVersion === "v7" || features.worldVersion === "v8" || features.worldVersion === "v9";
  if (!explicit) {
    features.cloudImpostorV1 = true;
    features.curvedWaterV1 = true;
    features.oceanWorldRoutesV1 = true;
    features.legacyCanalWorld = false;
    features.canalScope = "crystal-city";
    features.highlandIslandLift = 0;
    features.saihojiIslandLift = 3.2;
    features.bookshopIslandLift = 3.2;
    if (!["v8", "v9"].includes(features.planetPresentationVersion)) {
      features.planetPresentationVersion = "v9";
    }
  }
  return features;
}

// 苔庭周边地被与西芳寺六景共用一套灰青苔色阶；普通主岛苔丘仍保留
// mossyGround 的鲜黄绿默认色，只有苔庭战区切换到这套更克制的色板。
const SAIHOJI_MOSS_PALETTE = Object.freeze({
  low: 0x3f5f49,
  ink: 0x4b7052,
  emerald: 0x587d59,
  fresh: 0x688e64,
  // 与主岛 paintPlanetMossSea 的中间色一致，足迹最外缘才能真正回到周边草地。
  edge: 0x4d9b69,
});

// 玩家 2026-09-02 在场上站定后读出的落点，是地形最终形态下的实测值。
const ELDER_SPOT = new THREE.Vector3(-69.7, 142.01, 27.71);

/**
 * 弹唱老人直接落在玩家选定的世界坐标上，挂在 scene 下不跟随任何建筑。
 * 之前挂书店做子节点会被地图编辑器存档搬走；地形本身在运行时不动，
 * 所以这里用世界坐标反而是稳定解。+Y 对齐球面法线保证人站着而不是躺着。
 */
function placeElderAtWorldPoint(elder, scene, colliders, spot = ELDER_SPOT) {
  elder.removeFromParent();
  scene.add(elder);
  elder.position.copy(spot);
  elder.quaternion.copy(quatYToDir(spot.clone().normalize()));
  elder.scale.setScalar(1);
  elder.visible = true;
  elder.updateMatrixWorld(true);

  const world = elder.position.clone();
  const elderCol = colliders?.find((entry) => entry.kind === "elder");
  if (elderCol) elderCol.position.copy(world);
  else colliders?.push({ position: world.clone(), radius: 0.8, kind: "elder" });
  return { world, radius: world.length() };
}

/** @type {import("./sceneApi.js").SceneModule} */
export const messengerIslandScene = {
  id: "messenger",
  name: "信使主岛",
  description: "送信玩法关卡：平台、土坡、月牙湖码头、背侧大湖、植被与云环",

  load(ctx) {
    const scene = ctx.scene;
    const R = ctx.planetRadius ?? PLANET_RADIUS;

    const platforms = buildWorld(scene);
    const hills = buildHills(scene, R);
    const planetFeatures = officialPagePlanetFeatures({ ...FEATURES, ...(ctx.options?.planetV8?.features || {}) });
    const planetLayers = planetRendererOwnership(planetFeatures);
    const clouds = planetLayers.clouds ? [] : createCloudRing(scene, R);
    const playZone = decoratePlayZone(scene, R);
    const camp = buildStartingCamp(scene, R);
    const farSide = decorateFarSide(scene, R);
    const moonLake = createMoonLake(scene, R);

    const harborBuilt = buildOldHarborScene({ seed: 8844 });
    const harbor = harborBuilt.group;
    scene.add(harbor);
    let messengerLandmarks = null;

    const grandDir = latLonToDir(GRAND_CRYSTAL.lat, GRAND_CRYSTAL.lon, new THREE.Vector3());
    const grandTopTarget = grandDir
      .clone()
      .multiplyScalar(R + canyonOffsetDir(grandDir) + GRAND_CRYSTAL.h * 0.96);
    const tramSystem = loadTram({ scene, R, hills, camp, grandTopTarget });
    const moebiusPack = loadMoebiusDistrict({ scene, R, tramSystem });
    const citadelPack = loadCitadelBlock({
      scene,
      R,
      moonLake,
      camp,
      harbor,
      harborBuilt,
      tramSystem,
      highlandIslandLift: planetFeatures.highlandIslandLift || 0,
    });

    // 云贴地重投影（方案 A）· 阶段 0：可见地形清单。createPlanetV8Runtime 已挪到
    // harbor / moebius / citadel 构建之后，保证云采样时这些 group 已在场景中。
    // 清单经 collectStaticTerrainMeshes 收集为静态 mesh：排除飞鸟群/气泡艇等瞬态
    // 对象（否则云会贴着鸟飞）与水面节点；水域云走海平面兜底不被拽入水下。
    const moebiusRoot = moebiusPack?.moebius?.group || moebiusPack?.moebius;
    const transientExcludes = [
      moebiusPack?.moebius?.flocks, // moebius 城鸟群（数组）
      moebiusPack?.flock,
      moebiusPack?.hallFlock,
      moebiusPack?.bubblePods,
      citadelPack?.birdVortex,            // 圣城阳台鸟旋涡
      citadelPack?.terraceBirds?.primary,
    ];
    const terrainMeshes = [
      ...collectStaticTerrainMeshes(hills?.mesh, transientExcludes),
      ...collectStaticTerrainMeshes(hills?.skirt, transientExcludes),
      ...collectStaticTerrainMeshes(harbor, transientExcludes),
      ...collectStaticTerrainMeshes(citadelPack?.odysseyCitadel, transientExcludes),
      ...collectStaticTerrainMeshes(moebiusRoot, transientExcludes),
    ];
    const planetV8 = createPlanetV8Runtime({
      scene,
      planet: ctx.planet,
      radius: R,
      seed: ctx.options?.planetV8?.seed ?? FEATURES.terrainSeed ?? 42,
      features: planetFeatures,
      terrainMeshes,
    });

    // 三重门编译锚点保留给门侧巡检逻辑，侦察队实际以门的 seatRoot
    // 读取最新姿态，保证开发者菜单搬迁叹息之门后仍能正确赶赴目标。
    const tripleGateLandmark = planetV8.compiler?.manifest?.find((entry) => entry.id === "triple-gate") || {
      id: "triple-gate",
      direction: [-0.46, 0.88, 0.09],
      forward: [0, 0, 1],
    };
    const tripleGateSample = planetV8.compiler?.surface?.sample?.(tripleGateLandmark.direction) || null;

    const bookshopX = 11.5 * WORLD_SCALE;
    const bookshopZ = 5.5 * WORLD_SCALE;
    const bookshop = createCatalogObject("bookshop", {
      signLine1: "HARD TO FIND",
      signLine2: "BOOKSHOP",
    });
    bookshop.userData.mapUid = "world-bookshop";
    placeObjectOnSphere(bookshop, bookshopX, bookshopZ, groundLiftAt(bookshopX, bookshopZ), R);
    bookshop.rotateY(-0.5);
    bookshop.add(createBookshopHydrangeas());
    scene.add(bookshop);

    const skyPack = placeMoebiusSwampAndSky({
      scene,
      R,
      moebius: moebiusPack.moebius,
      grandDir: moebiusPack.grandDir,
      bubblePods: moebiusPack.bubblePods,
      bookshop,
    });
  // 弹唱老人：玩家指定的固定落点。
  {
    let elder = camp?.landmarks?.elder || null;
    if (!elder) scene.traverse((o) => { if (!elder && o.name === "music-elder") elder = o; });
    if (elder) {
      const placed = placeElderAtWorldPoint(elder, scene, camp?.colliders);
      console.log("[ELDER] 已放到指定落点 r=" + placed.radius.toFixed(1));
    } else {
      console.warn("[ELDER] 未找到 music-elder，老人未放置");
    }
  }

    const traffic = loadCanalNetwork({
      scene,
      R,
      moonLake,
      bookshop,
      camp,
      odysseyCitadel: citadelPack.odysseyCitadel,
      citadelRange: citadelPack.citadelRange,
      citySeaLake: moebiusPack.citySeaLake,
      canyonDir: moebiusPack.canyonDir,
      harbor,
      harborBuilt,
      legacyCanalWorld: planetFeatures.legacyCanalWorld,
      canalScope: planetFeatures.canalScope || (planetFeatures.legacyCanalWorld ? "world" : "none"),
      oceanWorldRoutes: planetFeatures.oceanWorldRoutesV1 === true,
      canalBoatsOut: {
        onBoatChange(b) {
          if (messengerLandmarks) messengerLandmarks.boat = b;
        },
      },
    });

    {
      let s = 41;
      const rnd = () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
      };
      for (let i = 0; i < 16; i++) {
        const a = rnd() * Math.PI * 2;
        const d = 2.4 + rnd() * 2.2;
        const x = bookshopX + Math.cos(a) * d;
        const z = bookshopZ + Math.sin(a) * d;
        const tuft = createGrassTuft();
        placeObjectOnSphere(tuft, x, z, groundLiftAt(x, z) + 0.01, R);
        tuft.rotateY(rnd() * Math.PI * 2);
        scene.add(tuft);
      }
    }

    const mossAvoidCommon = tramSystem.curve.getPoints(60).map((p) => ({
      position: p,
      radius: 1.2,
      flatten: true,
    }));
    mossAvoidCommon.push({
      position: bookshop.position,
      radius: bookshop.userData.collideRadius || 3,
      flatten: true,
    });
    const zoneAvoid = SAIHOJI_ZONES.map((z) => ({
      position: latLonToDir(z.lat, z.lon, new THREE.Vector3()).multiplyScalar(R),
      radius: z.radius + 1,
      flatten: true,
    }));
    const mossSaihoji = buildImpastoMossyGround({
      dir: latLonToDir(56, -120, new THREE.Vector3()),
      planetRadius: R,
      seed: 9101,
      yaw: 0.6,
      footprint: { rx: 9.2, rz: 5.8, segments: 28 },
      heightScale: 0.55,
      // 主人验收 2026-08-29：苔庭降到刚露出海面（海 0.72 → 盘面 ≈+0.6），
      // 士兵涉水仅踝深；原 3.2 令周边士兵腰深泡在海里
      baseLift: 0.62,
      palette: SAIHOJI_MOSS_PALETTE,
      avoidWorld: [...mossAvoidCommon, ...zoneAvoid],
    });
    scene.add(mossSaihoji);
    {
      // 湖沼坑口缘碎石 → 苔庭（主人验收 2026-08-29）：这组石头整体迁来，
      // 沿苔庭椭圆边线散布成一组（同色同形，确定性散布）。
      const srand = (function () {
        let state = 20260829 >>> 0;
        return function () {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          return state / 4294967296;
        };
      })();
      const mossDir = latLonToDir(56, -120, new THREE.Vector3());
      const surfaceR = R + 0.62 + 0.18;
      const upT = mossDir.clone();
      const rightT = new THREE.Vector3().crossVectors(upT, new THREE.Vector3(0, 0, 1)).normalize();
      if (rightT.lengthSq() < 1e-6) rightT.set(1, 0, 0);
      const fwdT = new THREE.Vector3().crossVectors(rightT, upT).normalize();
      const screeMat = new THREE.MeshStandardMaterial({ color: 0x2c5f56, roughness: 1, flatShading: true });
      const screeGroup = new THREE.Group();
      screeGroup.name = "saihoji-scree-rocks";
      screeGroup.userData.presentationOnly = true;
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2 + srand() * 0.3;
        const ox = Math.cos(angle) * (7.6 + srand() * 1.4);
        const oz = Math.sin(angle) * (4.6 + srand() * 1.0);
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.9 + srand() * 1.1, 0),
          screeMat
        );
        rock.position
          .copy(mossDir)
          .multiplyScalar(surfaceR)
          .addScaledVector(rightT, ox)
          .addScaledVector(fwdT, oz);
        rock.scale.set(1.3, 0.3 + srand() * 0.3, 1.1);
        rock.rotation.y = srand() * Math.PI;
        rock.castShadow = true;
        screeGroup.add(rock);
      }
      // 性能：碎石组合并（18 网格 → 按材质归并的个位数 draw）
      mergeStaticGroup(screeGroup);
      scene.add(screeGroup);
    }
    const mossSwamp = buildImpastoMossyGround({
      dir: skyPack.moebiusSwamp
        ? skyPack.moebiusSwamp.position.clone().normalize()
        : moebiusPack.grandDir.clone(),
      planetRadius: R,
      seed: 7743,
      yaw: 1.9,
      avoidWorld: mossAvoidCommon,
    });
    scene.add(mossSwamp);

    const colliders = [
      ...playZone.colliders,
      ...camp.colliders,
      ...farSide.colliders,
      ...citadelPack.harborColliders,
      { position: bookshop.position.clone(), radius: bookshop.userData.collideRadius },
      { position: citadelPack.odysseyCitadel.position.clone(), radius: 6.0 },
    ];
    if (moonLake?.deepCollider) colliders.push(moonLake.deepCollider);

    const gatePack = loadAbandonedGateBlock({
      scene,
      R,
      tramSystem,
      flock: moebiusPack.flock,
      canyonDir: moebiusPack.canyonDir,
    });
    const scoutDefense = createScoutDefenseSquad({
      scene,
      radius: R,
      moebius: moebiusPack.moebius,
      abandonedGate: gatePack.abandonedGate,
      getCityBirdFlocks: () => moebiusPack.moebius?.birdFlocks || null,
      getGateBirdVortex: () => gatePack.gateBirdVortex || null,
      surfacePosition: tripleGateSample?.position,
      count: 5,
    });
    // 兼容旧版调试句柄：现在代表5架侦察机组成的 squad，而非单机。
    const tripleGateScoutAircraft = scoutDefense.root;
    settleBuriedAssets(scene, colliders);

    const combatPack = loadCitadelCombat({
      scene,
      R,
      odysseyCitadel: citadelPack.odysseyCitadel,
      citadelRange: citadelPack.citadelRange,
      harbor,
      harborBuilt,
      tramSystem,
      aircraftSquad: skyPack.aircraftSquad,
      v4Runtime: citadelPack.v4Runtime,
      planetV8,
    });
    // 正式页海壳内的谷底静态副本不会进入视野。只处理内容工厂明确标记、
    // 且包围范围完整低于海面的子树；战斗、车辆、倒影等动态内容绝不猜测。
    const officialOceanOcclusion = pruneTaggedOfficialOceanOccludeds(scene, { radius: R });

    messengerLandmarks = {
      playZone,
      camp,
      farSide,
      bookshop,
      tramSystem,
      harbor,
      oldHarbor: harborBuilt,
      boat: harborBuilt.landmarks.boat,
      moebius: moebiusPack.moebius,
      abandonedGate: gatePack.abandonedGate,
      gatePods: gatePack.gatePods, // 叹息之门泡形飞行器 ×3
      gateHaulers: gatePack.gateHaulers, // 叹息之门重型运输艇 ×3
      bubblePods: moebiusPack.bubblePods,
      citySeaLake: moebiusPack.citySeaLake,
      citadelRange: citadelPack.citadelRange,
      odysseyCitadel: citadelPack.odysseyCitadel,
      canalJunctionCitadel: traffic.canalJunctionCitadel,
      canalJunctionBox: traffic.canalJunctionBox,
      canalJunctionStorage: traffic.canalJunctionStorage,
      airship: skyPack.airship,
      flock: moebiusPack.flock,
      gateBirdVortex: gatePack.gateBirdVortex,
      birdVortex: gatePack.gateBirdVortex,
      terraceBirds: citadelPack.terraceBirds,
      hallFlock: moebiusPack.hallFlock,
      escort: skyPack.escort,
      aircraftSquad: skyPack.aircraftSquad,
      tripleGateScoutAircraft,
      scoutDefense,
      saihojiPhalanx: combatPack.saihojiPhalanx,
      tacticalGraph: combatPack.tacticalGraph,
      mossSaihoji,
      moebiusSwamp: skyPack.moebiusSwamp,
      canal: traffic.canalSys,
      canalBoats: traffic.canalBoats,
      waterRouteFleet: traffic.waterRouteFleet,
      canalLakeLink: traffic.canalLakeLink,
      mossSwamp,
      harborLogistics: harborBuilt.logistics || null,
      v4Runtime: citadelPack.v4Runtime,
      planetV8,
      officialOceanOcclusion,
    };

    const state = {
      scene,
      R,
      camp,
      platforms,
      clouds,
      tramSystem,
      canalBoats: traffic.canalBoats,
      waterRouteFleet: traffic.waterRouteFleet,
      canalSys: traffic.canalSys,
      canalJunctionBox: traffic.canalJunctionBox,
      canalJunctionCitadel: traffic.canalJunctionCitadel,
      harborBuilt,
      canalLakeLink: traffic.canalLakeLink,
      bubblePods: moebiusPack.bubblePods,
      citySeaLake: moebiusPack.citySeaLake,
      citadelRange: citadelPack.citadelRange,
      odysseyCitadel: citadelPack.odysseyCitadel,
      v4Runtime: citadelPack.v4Runtime,
      aircraftSquad: skyPack.aircraftSquad,
      tripleGateScoutAircraft,
      scoutDefense,
      saihojiPhalanx: combatPack.saihojiPhalanx,
      vanguardSquad: combatPack.vanguardSquad, // 先锋重甲兵中队
      combatPack,
      airship: skyPack.airship,
      airshipAnchor: skyPack.airshipAnchor,
      moebius: moebiusPack.moebius,
      gateBirdVortex: gatePack.gateBirdVortex,
      gatePods: gatePack.gatePods,
      gateHaulers: gatePack.gateHaulers,
      terraceBirds: citadelPack.terraceBirds,
      flock: moebiusPack.flock,
      hallFlock: moebiusPack.hallFlock,
      escort: skyPack.escort,
      officialOceanOcclusion,
      swampBgm: createSwampBgmState(),
    };

    return {
      id: "messenger",
      platforms,
      hills,
      clouds,
      moonLake,
      colliders,
      landmarks: messengerLandmarks,
      update(dt, t, runtime) {
        updateMessengerIsland(state, dt, t, runtime);
      },
      debug: { playZone, camp, farSide, harbor },
    };
  },
};
