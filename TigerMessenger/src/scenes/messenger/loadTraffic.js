// =====================================================================
//  电车 / 运河交汇古堡 / 星海运河 / 战船 / 叹息之门
// =====================================================================
import * as THREE from "three";
import { buildChristchurchTramSystem } from "../../world/tramSystem.js";
import { carveHillsForTrack } from "../../world/hills.js";
import { buildWorldCanal, buildCanalJunctionBox } from "../../world/canalSystem.js";
import { buildCanalLakeLink } from "../../world/canalLakeLink.js";
import { createCanalBoatPatrol } from "../../world/canalBoats.js";
import { createHarborLogistics } from "../../assets/harborLogistics.js";
import {
  buildOdysseyCitadel,
  citadelTerrainKey,
  citadelTerrainObjectsKey,
} from "../../world/odysseyCitadel.js";
import { CANAL_JUNCTION_TOWN_SPEC, citadelLevelsKey } from "../../world/citadelTown.js?v=20260825-highland-obelisk-stone-v3";
import {
  waterCityCanalWaypointDir,
  waterCityShoreAng,
  WATER_CITY_WATER_DROP,
  CITY_SEA_LAKE,
} from "../../world/citySeaLake.js";
import { citadelRangeLiftDir } from "../../world/citadelRange.js";
import { quatUprightOnSphere, latLonToDir, flatXZToLatLon } from "../../world/sphereMath.js";
import { LAKE } from "../../world/lake.js";
import { buildAbandonedGate, GATE, GATE_DEPTH } from "../../world/abandonedGate.js";
import { BirdVortexManager } from "../../world/birdVortex.js";
import { isOceanWorldRoutesV1, FEATURES } from "../../core/params.js";
import { compileWaterRoutes } from "../../world/waterV8/curvedWaterCompiler.js";
import { createWaterRouteFleet } from "../../world/waterV8/waterRouteFleet.js";

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
}) {
  const moonLakeLatLon = flatXZToLatLon(LAKE.x, LAKE.z, R);
  const canalJunctionDir = latLonToDir(
    (moonLakeLatLon.lat + CITY_SEA_LAKE.lat) * 0.5,
    (moonLakeLatLon.lon + CITY_SEA_LAKE.lon) * 0.5,
    new THREE.Vector3()
  );
  let canalJunctionCitadel = null;
  let canalJunctionStorage = null;
  let canalJunctionBox = null;
  {
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
  const canalPush = (dir, name) => {
    if (dir?.isVector3 && dir.lengthSq() > 1e-6) {
      canalAnchors.push(dir.clone());
      canalNames.push(name);
    }
  };
  canalPush(bookshop?.position, "书店镇");
  canalPush(camp?.landmarks?.anchor?.position, "出发营地");
  canalPush(moonLake?.centerWorld || moonLake?.position, "月亮湖");
  canalPush(odysseyCitadel?.position, "高山圣城");
  canalPush(canalJunctionCitadel?.position, "运河交汇古堡");
  canalPush(cityCanalWaypoint, "水晶城");
  canalPush(citySeaLake?.centerDir || latLonToDir(CITY_SEA_LAKE.lat, CITY_SEA_LAKE.lon), "白鲸海湖");
  canalPush(canyonDir, "叹息之门");

  let canalSys = null;
  let canalBoats = null;
  let canalLakeLink = null;
  let waterRouteFleet = null;
  const useOceanRoutes = isOceanWorldRoutesV1();
  if (useOceanRoutes) {
    const harborAnchors = canalAnchors.map((position, index) => ({
      id: `harbor-anchor:${index}`,
      direction: position.clone().normalize().toArray(),
      clearance: 2.4,
    }));
    const routes = compileWaterRoutes({ harborAnchors, radius: R });
    const routeBoat = harborBuilt?.landmarks?.boat;
    const routeBoats = routeBoat && routes.length ? [{
      id: "old-harbor-route-boat",
      object: routeBoat,
      position: routeBoat.position?.toArray?.() || [0, 0, R],
      routeId: routes[0].id,
      speed: 0.004,
      u: 0,
    }] : [];
    waterRouteFleet = createWaterRouteFleet({ routes, boats: routeBoats });
    if (routeBoat) routeBoat.userData.waterRouteBoat = routeBoats[0] || null;
  }
  const useLegacyCanal = legacyCanalWorld === true;
  if (canalAnchors.length >= 3 && useLegacyCanal) {
    const canal = buildWorldCanal(scene, R, {
      anchors: canalAnchors,
      names: canalNames,
      groundLift: citadelRangeLiftDir,
      excludeZones: canalJunctionDir
        ? [{
            center: canalJunctionDir,
            radius: canalJunctionBox?.userData?.excludeRadius ?? Math.hypot(22, 18) + 1.6,
          }]
        : [],
      embankGapTest: ((_dir, worldP) => {
        const ms = citadelRange.moat?.userData?.spec;
        if (!ms) return false;
        const lx = worldP.dot(citadelRange.right);
        const lz = worldP.dot(citadelRange.fwd);
        const r = Math.hypot(lx, lz);
        return r > ms.inner - 8.4 && r < ms.outer + 8.4;
      }),
    });
    canalSys = canal;
    citadelRange.linkCanalToMoat?.(canal.curve);
    {
      let plazaGroup = null;
      scene.traverse((o) => {
        if (!plazaGroup && o.name === "citadel-navona-canal-plaza") plazaGroup = o;
      });
      if (!plazaGroup) citadelRange.placeNavonaPlaza(-10, 75, Math.PI / 2, odysseyCitadel);
    }
    citadelRange.aimHorseToCanal?.(canal.curve);
    canalBoats = createCanalBoatPatrol(scene, canal, { count: 10, scale: 1.84 });
    canalLakeLink = buildCanalLakeLink(scene, canal, citySeaLake, {
      edgeAng: waterCityShoreAng(WATER_CITY_WATER_DROP) - 0.02,
      cruiseAng: 0.2,
    });
    canalLakeLink?.attachAll?.(canalBoats.boats);

    const dockBoat = harborBuilt.landmarks.boat;
    const dockCrane = harborBuilt.landmarks.crane;
    const squads = harborBuilt.squads || harborBuilt.landmarks.porterSquads || [];
    if (dockBoat && dockCrane && squads.length) {
      const logistics = createHarborLogistics({ harbor, boat: dockBoat, crane: dockCrane, squads, scene });
      logistics.bindWorld({ canal, canalBoats, moat: citadelRange.moat, citadel: odysseyCitadel });
      logistics.setOnBoatChange((b) => {
        harborBuilt.landmarks.boat = b;
        if (canalBoatsOut) canalBoatsOut.onBoatChange?.(b);
      });
      harbor.userData.logistics = logistics;
      harborBuilt.logistics = logistics;
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
