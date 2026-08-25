// =====================================================================
//  水晶城 / 气泡艇 / 海湖 / 湖沼 / 航空器
// =====================================================================
import * as THREE from "three";
import { canyonOffsetDir, CANYON } from "../../world/canyon.js";
import { FlockManager } from "../../world/flock.js";
import { buildMoebiusCrystalMetropolis, GRAND_CRYSTAL } from "../../world/moebiusCity.js";
import { loadCrystalLayoutFromStorage } from "../../world/crystalCityLayout.js";
import { createBubblePod, createBubblePodsAroundFlowerBuildings } from "../../assets/bubblePod.js";
import {
  createCitySeaLake,
  CITY_SEA_LAKE,
  WATER_CITY_WATER_DROP,
  WATER_CITY_ANG_R,
} from "../../world/citySeaLake.js";
import { createCatalogObject } from "../../core/buildingCatalog.js";
import { placeMoebiusSwampOnSphere } from "../../world/moebiusSwamp.js";
import { latLonToDir } from "../../world/sphereMath.js";
import { createMoebiusAircraftSquad } from "../../assets/moebiusAircraft.js";
import { createMoebiusAirship, placeMoebiusAirshipAbove } from "../../assets/moebiusAirship.js";
import { AirshipEscortManager } from "../../world/airshipEscort.js";

export function loadMoebiusDistrict({ scene, R, tramSystem }) {
  const grandDir = latLonToDir(GRAND_CRYSTAL.lat, GRAND_CRYSTAL.lon, new THREE.Vector3());
  const grandTopTarget = grandDir
    .clone()
    .multiplyScalar(R + canyonOffsetDir(grandDir) + GRAND_CRYSTAL.h * 0.96);

  const moebius = buildMoebiusCrystalMetropolis(scene, R, {
    trackCurve: tramSystem.curve,
    layout: loadCrystalLayoutFromStorage() || undefined,
    useStorage: true,
  });
  const bubblePods = createBubblePodsAroundFlowerBuildings(scene, moebius.crystals, { count: 3 });
  const citySeaLake = createCitySeaLake(scene, R, {
    seed: 5521,
    centerDir: latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3()),
    baseRadius: R - WATER_CITY_WATER_DROP - CITY_SEA_LAKE.waterLift,
    angR: WATER_CITY_ANG_R,
    fixedLevel: true,
  });

  const grandTower = moebius.grand;
  const roofAlt = grandTower.root + grandTower.h - R;
  const hallFlock = new FlockManager(scene, {
    count: 12,
    planetRadius: R,
    centerDir: grandTower.dir,
    altMin: roofAlt - 2,
    altMax: roofAlt + 18,
    homeRadius: 12,
    homeWeight: 1.3,
    windDir: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), grandTower.dir).normalize(),
    obstacles: moebius.crystals,
  });

  const canyonDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
  const flock = new FlockManager(scene, {
    count: 18,
    planetRadius: R,
    centerDir: canyonDir,
    windDir: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), canyonDir).normalize(),
    obstacles: moebius.crystals,
  });

  return {
    moebius,
    bubblePods,
    citySeaLake,
    grandDir,
    grandTopTarget,
    hallFlock,
    flock,
    canyonDir,
  };
}

export function placeMoebiusSwampAndSky({ scene, R, moebius, grandDir, bubblePods, bookshop }) {
  let moebiusSwamp = null;
  {
    const swampScale = 0.5;
    const swamp = createCatalogObject("moebiusSwamp", { seed: 7711, scale: swampScale });
    swamp.userData.mapUid = "world-swamp-crystal";
    const cityDir = grandDir.clone().normalize();
    const canyonCenter = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
    const outward = cityDir.clone().sub(canyonCenter);
    outward.addScaledVector(cityDir, -outward.dot(cityDir));
    if (outward.lengthSq() < 1e-8) {
      outward.crossVectors(cityDir, new THREE.Vector3(0, 0, 1));
      if (outward.lengthSq() < 1e-8) outward.set(1, 0, 0).addScaledVector(cityDir, -cityDir.x);
    }
    outward.normalize();
    const side = new THREE.Vector3().crossVectors(cityDir, outward).normalize();
    const target = cityDir.clone().multiplyScalar(R).addScaledVector(outward, 28).addScaledVector(side, 16);
    const swampDir = target.normalize();
    const lift = canyonOffsetDir(swampDir);
    placeMoebiusSwampOnSphere(swamp, swampDir, R, swampScale, lift);
    scene.add(swamp);
    moebiusSwamp = swamp;
  }

  {
    const shopPod = createBubblePod({ scale: 0.72, accent: 0xffd98e });
    const shopUp = bookshop.position.clone().normalize();
    const shopRight = new THREE.Vector3(1, 0, 0).applyQuaternion(bookshop.quaternion).normalize();
    const shopFront = new THREE.Vector3(0, 0, 1).applyQuaternion(bookshop.quaternion).normalize();
    shopPod.userData.orbit = {
      center: bookshop.position.clone(),
      up: shopUp,
      right: shopRight,
      front: shopFront,
      radius: 4.5,
      altitude: 3.2,
      phase: 0.7,
      speed: 0.3,
    };
    shopPod.userData.hoverPhase = 0.7;
    shopPod.userData.anchorDirection = shopUp.clone();
    shopPod.userData.bookshopPod = true;
    bubblePods.add(shopPod);
  }

  const cityDir = grandDir.clone().normalize();
  const bookshopDir = bookshop.position.clone().normalize();
  const aircraftHeight = 20;
  const aircraftSquad = createMoebiusAircraftSquad(cityDir, R, {
    count: 5,
    height: aircraftHeight,
    radius: 18,
    spin: 0.03,
    formation: "v",
    whaleFlight: true,
    patrol: {
      dirA: cityDir,
      dirB: bookshopDir,
      maxSpeed: 2.6,
    },
  });
  scene.add(aircraftSquad);

  const airship = createMoebiusAirship();
  airship.scale.setScalar(1.25);
  scene.add(airship);
  {
    const dir = (moebiusSwamp?.position || grandDir).clone().normalize();
    placeMoebiusAirshipAbove(airship, dir, R, 20);
  }
  const airshipAnchor = { swamp: null, lastPos: new THREE.Vector3(), locked: false };
  const escort = new AirshipEscortManager(scene, airship, {
    count: 9,
    obstacles: moebius.crystals,
  });

  return { moebiusSwamp, aircraftSquad, airship, airshipAnchor, escort };
}
