// =====================================================================
//  电车 / 运河交汇古堡 / 星海运河 / 战船 / 叹息之门
// =====================================================================
import * as THREE from "three";
import { buildChristchurchTramSystem } from "../../world/tramSystem.js";
import { carveHillsForTrack } from "../../world/hills.js";
import { buildWorldCanal, buildCanalJunctionBox } from "../../world/canalSystem.js";
import { buildCanalLakeLink } from "../../world/canalLakeLink.js";
import { createCanalBoatPatrol } from "../../world/canalBoats.js";
import {
  buildOdysseyCitadel,
  citadelTerrainKey,
  citadelTerrainObjectsKey,
} from "../../world/odysseyCitadel.js";
import { CANAL_JUNCTION_TOWN_SPEC, citadelLevelsKey } from "../../world/citadelTown.js?v=20260903-column-coherent-jitter-v1";
import {
  waterCityCanalWaypointDir,
  waterCityShoreAng,
  WATER_CITY_WATER_DROP,
  CITY_SEA_LAKE,
} from "../../world/citySeaLake.js";
import { quatUprightOnSphere, latLonToDir, flatXZToLatLon } from "../../world/sphereMath.js";
import { LAKE } from "../../world/lake.js";
import { buildAbandonedGate, GATE, GATE_DEPTH } from "../../world/abandonedGate.js";
import { BirdVortexManager } from "../../world/birdVortex.js";
import { isOceanWorldRoutesV1, FEATURES, P } from "../../core/params.js";
import { CANYON, canyonOffsetDir } from "../../world/canyon.js";
import { compileWaterRoutes } from "../../world/waterV8/curvedWaterCompiler.js";
import { createWaterRouteFleet } from "../../world/waterV8/waterRouteFleet.js";
import { buildOceanPatrolCurve, OFFICIAL_OCEAN_SEA_LEVEL } from "../../world/waterV8/officialOcean.js";

export function loadTram({ scene, R, hills, camp, grandTopTarget }) {
  const tramSystem = buildChristchurchTramSystem(scene, R, { beamTarget: grandTopTarget });
  carveHillsForTrack(hills.mesh, [tramSystem.curve, ...Object.values(tramSystem.curves || {})], R);
  {
    const trackPts = [tramSystem.curve, ...Object.values(tramSystem.curves || {})].flatMap((c) => c.getPoints(320));
    for (const flower of camp.landmarks.campFlowers || []) {
      if (trackPts.some((p) => p.distanceToSquared(flower.position) < 2.2 * 2.2)) flower.removeFromParent();
    }
  }
  return tramSystem;
}

export function loadCanalNetwork({
  scene,
  R,
  moonLake,
  bookshop,
  camp,
  odysseyCitadel,
  citadelRange,
  citySeaLake,
  canyonDir,
  harbor,
  harborBuilt,
  canalBoatsOut,
  legacyCanalWorld = FEATURES.legacyCanalWorld,
  canalScope = null,
  oceanWorldRoutes = null,
  buildCanalJunction = FEATURES.canalJunctionV1 !== false,
}) {
  // 主人约定：正式主页只留水晶城区域运河；交汇古堡保留。A·V7 仍走世界运河回滚。
  const scope = canalScope || (legacyCanalWorld === true ? "world" : "none");
  const useCrystalCanal = scope === "crystal-city";
  const useOceanRoutes = oceanWorldRoutes ?? isOceanWorldRoutesV1();

  const moonLakeLatLon = flatXZToLatLon(LAKE.x, LAKE.z, R);
  const canalJunctionDir = latLonToDir(
    (moonLakeLatLon.lat + CITY_SEA_LAKE.lat) * 0.5,
    (moonLakeLatLon.lon + CITY_SEA_LAKE.lon) * 0.5,
    new THREE.Vector3()
  );
  let canalJunctionCitadel = null;
  let canalJunctionStorage = null;
  let canalJunctionBox = null;
  if (buildCanalJunction) {
    const cjsLevelsKey = citadelLevelsKey("canal-junction");
    const cjsTerrainKey = citadelTerrainKey("canal-junction");
    const cjsObjectsKey = citadelTerrainObjectsKey("canal-junction");
    canalJunctionStorage = { levels: cjsLevelsKey, terrain: cjsTerrainKey, objects: cjsObjectsKey };
    let cjSpec;
    try {
      const saved = JSON.parse(localStorage.getItem(cjsLevelsKey) || "null");
      if (saved && (Array.isArray(saved) || Array.isArray(saved.terraces))) cjSpec = saved;
    } catch { /* 回落空布局 */ }
    if (!cjSpec) cjSpec = CANAL_JUNCTION_TOWN_SPEC;
    let cjContour;
    try {
      const saved = JSON.parse(localStorage.getItem(cjsTerrainKey) || "null");
      if (saved) cjContour = saved;
    } catch { /* 回落默认 */ }
    let cjObjects;
    try {
      const saved = JSON.parse(localStorage.getItem(cjsObjectsKey) || "[]");
      if (Array.isArray(saved)) cjObjects = saved;
    } catch { /* 空 */ }
    const faceDir = moonLake?.centerWorld || canalJunctionDir;
    const junctionBox = buildCanalJunctionBox(scene, R, {
      centerDir: canalJunctionDir,
      forwardDir: moonLake?.centerWorld || canalJunctionDir,
      halfLength: 22,
      halfWidth: 18,
      waterLift: 0.6,
    });
    scene.add(junctionBox.group);
    canalJunctionBox = junctionBox.group;
    canalJunctionCitadel = buildOdysseyCitadel({
      dir: canalJunctionDir,
      faceDir,
      groundRadius: R,
      planetRadius: R,
      seed: 918273,
      spec: cjSpec,
      contour: cjContour,
      terrainObjects: cjObjects,
      instanceId: "canal-junction",
      floors: 12,
      skipOuterTerrain: true,
      townBaseLift: 0.62,
      place: false,
    });
    scene.add(canalJunctionCitadel);
    const up = canalJunctionDir.clone().normalize();
    quatUprightOnSphere(up, moonLake?.centerWorld || canalJunctionDir, canalJunctionCitadel.quaternion);
    const waterLift = junctionBox.group.userData.waterLift ?? 0.6;
    const townLift = canalJunctionCitadel.userData.townBaseLift ?? 0.62;
    canalJunctionCitadel.position.copy(up).multiplyScalar(R + waterLift - townLift);
    canalJunctionCitadel.updateMatrixWorld(true);
    junctionBox.group.userData.citadel = canalJunctionCitadel;
  }

  const cityCanalWaypoint = waterCityCanalWaypointDir();
  const canalAnchors = [];
  const canalNames = [];
  const oceanAnchors = [];
  const canalPush = (dir, name, into = canalAnchors) => {
    if (dir?.isVector3 && dir.lengthSq() > 1e-6) {
      into.push(dir.clone());
      if (into === canalAnchors) canalNames.push(name);
    }
  };
  // 主人约定：只有水晶城区域还留运河；交汇古堡保留。战船改走球面海洋。
  if (useCrystalCanal) {
    canalPush(cityCanalWaypoint, "水晶城");
    canalPush(citySeaLake?.centerDir || latLonToDir(CITY_SEA_LAKE.lat, CITY_SEA_LAKE.lon, new THREE.Vector3()), "白鲸海湖");
    canalPush(canyonDir || latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3()), "水晶城峡谷");
  }
  if (useOceanRoutes) {
    canalPush(bookshop?.position, "书店镇", oceanAnchors);
    canalPush(camp?.landmarks?.anchor?.position, "出发营地", oceanAnchors);
    canalPush(moonLake?.centerWorld || moonLake?.position, "月亮湖", oceanAnchors);
    canalPush(odysseyCitadel?.position, "高山圣城", oceanAnchors);
    canalPush(canalJunctionCitadel?.position, "运河交汇古堡", oceanAnchors);
    canalPush(harbor?.position, "旧港", oceanAnchors);
  }

  let canalSys = null;
  let canalBoats = null;
  let canalLakeLink = null;
  let waterRouteFleet = null;
  if (useOceanRoutes) {
    const harborAnchors = oceanAnchors.map((position, index) => ({
      id: `harbor-anchor:${index}`,
      direction: position.clone().normalize().toArray(),
      clearance: 2.4,
    }));
    const routes = compileWaterRoutes({ harborAnchors, radius: R + OFFICIAL_OCEAN_SEA_LEVEL });
    const oceanPatrol = buildOceanPatrolCurve(oceanAnchors, R, OFFICIAL_OCEAN_SEA_LEVEL);
    if (oceanPatrol) {
      canalBoats = createCanalBoatPatrol(scene, oceanPatrol, {
        count: Math.max(0, P.oceanWarshipCount ?? 3),
        scale: 1.84,
        namePrefix: "ocean-warship",
        kind: "ocean-warship",
      });
    }
    const routeBoat = harborBuilt?.landmarks?.boat;
    if (routeBoat && oceanPatrol) {
      if (routeBoat.parent !== scene) scene.attach(routeBoat);
      routeBoat.userData.canalPatrol = true;
      routeBoat.userData.oceanPatrol = true;
      routeBoat.userData.kind = "ocean-warship";
      routeBoat.userData.piloted = false;
      routeBoat.userData.u = 0.08;
      routeBoat.userData.speed = (1 / 180) * 0.92;
      oceanPatrol.curve.getPointAt(routeBoat.userData.u, routeBoat.position);
      routeBoat.position.normalize().multiplyScalar(oceanPatrol.waterR + 0.12);
      if (canalBoats?.boats && !canalBoats.boats.includes(routeBoat)) canalBoats.boats.push(routeBoat);
    }
    waterRouteFleet = createWaterRouteFleet({ routes, boats: [] });
  }
  if (canalAnchors.length >= 3 && useCrystalCanal) {
    const canal = buildWorldCanal(scene, R, {
      anchors: canalAnchors,
      names: canalNames,
      groundLift: canyonOffsetDir,
      excludeZones: [],
      embankGapTest: () => false,
      // 主岛的海/湖是连续自然水面：港口、交汇古堡、苔庭等不再
      // 出现旧运河的两条河堤。只有真正落在东非大裂谷区域的水道
      // 保留立壁/土埂；河床和水面不受此策略影响。
      embankmentKeepTest: (_dir) => canyonOffsetDir(_dir) < -1e-6,
    });
    canalSys = canal;
    if (!useOceanRoutes) {
      canalBoats = createCanalBoatPatrol(scene, canal, {
        count: 4,
        scale: 1.84,
      });
      canalLakeLink = buildCanalLakeLink(scene, canal, citySeaLake, {
        edgeAng: waterCityShoreAng(WATER_CITY_WATER_DROP) - 0.02,
        cruiseAng: 0.2,
      });
      canalLakeLink?.attachAll?.(canalBoats.boats);
    } else {
      canalLakeLink = buildCanalLakeLink(scene, canal, citySeaLake, {
        edgeAng: waterCityShoreAng(WATER_CITY_WATER_DROP) - 0.02,
        cruiseAng: 0.2,
      });
    }
  }

  return {
    canalJunctionCitadel,
    canalJunctionBox,
    canalJunctionStorage,
    canalSys,
    canalBoats,
    canalLakeLink,
    waterRouteFleet,
  };
}

export function loadAbandonedGateBlock({ scene, R, tramSystem, flock, canyonDir }) {
  const abandonedGate = buildAbandonedGate({
    curve: tramSystem.curve,
    planetRadius: R,
    setback: 6,
  });
  scene.add(abandonedGate);

  const gateBirdVortex = new BirdVortexManager(scene, {
    name: "bird-vortex-triple-gate",
    getTram: () => tramSystem?.getNearestTram?.(abandonedGate.position) || tramSystem?.tram || null,
  });
  gateBirdVortex.syncToGate(abandonedGate, { respawn: true });
  gateBirdVortex.root.userData.anchor = { kind: "triple-gate" };

  {
    const seat = abandonedGate.userData?.seatRoot;
    seat?.updateWorldMatrix?.(true, false);
    const gateOrigin = new THREE.Vector3();
    const gateQ = new THREE.Quaternion();
    if (seat) {
      seat.getWorldPosition(gateOrigin);
      seat.getWorldQuaternion(gateQ);
    }
    const gateUp = seat
      ? new THREE.Vector3(0, 1, 0).applyQuaternion(gateQ).normalize()
      : canyonDir.clone();
    const gateRight = seat
      ? new THREE.Vector3(1, 0, 0).applyQuaternion(gateQ).normalize()
      : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), gateUp).normalize();
    const gateFwd = seat
      ? new THREE.Vector3(0, 0, 1).applyQuaternion(gateQ).normalize()
      : new THREE.Vector3().crossVectors(gateUp, gateRight).normalize();
    flock.setHome?.(gateUp, {
      altMin: 8,
      altMax: 32,
      homeRadius: 18,
      homeWeight: 1.15,
      windDir: gateFwd,
      respawn: true,
    });
    flock.setCorridor?.({
      origin: gateOrigin.lengthSq() > 1e-6 ? gateOrigin : gateUp.clone().multiplyScalar(R),
      right: gateRight,
      up: gateUp,
      forward: gateFwd,
      halfWidth: Math.max(3.2, (GATE.channelWidth || 10) * 0.48),
      halfLength: Math.max(14, (GATE_DEPTH || 18) * 0.95),
      yMin: 3,
      yMax: 30,
      cloudCeilY: 40,
    });
    if (flock?.root) flock.root.visible = true;
  }

  return { abandonedGate, gateBirdVortex };
}
