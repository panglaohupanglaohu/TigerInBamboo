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
import { placeObjectOnSphere, latLonToDir } from "../world/sphereMath.js";
import { createGrassTuft } from "../assets/bookshop.js";
import { createBookshopHydrangeas } from "../assets/hydrangea.js";
import { createCatalogObject } from "../core/buildingCatalog.js";
import { buildOldHarborScene } from "../assets/harbor.js";
import { buildImpastoMossyGround } from "../world/mossyGround.js";
import { WORLD_SCALE } from "../world/worldScale.js";
import { loadCitadelBlock, loadCitadelCombat } from "./messenger/loadCitadel.js?v=20260823-citadel-reference-v6";
import { loadMoebiusDistrict, placeMoebiusSwampAndSky } from "./messenger/loadMoebius.js";
import { loadTram, loadCanalNetwork, loadAbandonedGateBlock } from "./messenger/loadTraffic.js";
import { updateMessengerIsland } from "./messenger/updateIsland.js";
import { createSwampBgmState } from "./messenger/swampBgm.js";
import { createPlanetV8Runtime, planetRendererOwnership } from "../world/planetV8/runtime.js";
import { FEATURES } from "../core/params.js";

/** 正式主页（custom/legacy）挂球面 impostor 云海，不改全局 DEFAULT_ON。 */
export function officialPagePlanetFeatures(base = FEATURES) {
  const features = { ...base };
  const explicit = features.worldVersion === "v7" || features.worldVersion === "v8" || features.worldVersion === "v9";
  if (!explicit) {
    features.cloudImpostorV1 = true;
    features.legacyCanalWorld = false;
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
    const planetV8 = createPlanetV8Runtime({
      scene,
      planet: ctx.planet,
      radius: R,
      seed: ctx.options?.planetV8?.seed ?? FEATURES.terrainSeed ?? 42,
      features: planetFeatures,
    });

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
    });

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
      heightScale: 0.42,
      palette: SAIHOJI_MOSS_PALETTE,
      avoidWorld: [...mossAvoidCommon, ...zoneAvoid],
    });
    scene.add(mossSaihoji);
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
    };

    const state = {
      scene,
      R,
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
      saihojiPhalanx: combatPack.saihojiPhalanx,
      combatPack,
      airship: skyPack.airship,
      airshipAnchor: skyPack.airshipAnchor,
      moebius: moebiusPack.moebius,
      gateBirdVortex: gatePack.gateBirdVortex,
      terraceBirds: citadelPack.terraceBirds,
      flock: moebiusPack.flock,
      hallFlock: moebiusPack.hallFlock,
      escort: skyPack.escort,
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
