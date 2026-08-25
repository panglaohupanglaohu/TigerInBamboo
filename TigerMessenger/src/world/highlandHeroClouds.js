// =====================================================================
// Local highland citadel hero clouds.  The planet-V8 impostor compiler pins
// clusters to geodesic landmarks; the player standing at the obelisk is on
// the authored mountain-valley citadel.  This module places the same catalog
// (cap / ring / forest scatter) in citadel-local XZ, hugging the continuous
// mountain grid, and parents the impostor mesh to the castle group.
// =====================================================================

import { HERO_CLOUD_SPECS } from "../render/clouds/heroCloudCatalog.js";
import { createCloudImpostorSystem } from "../render/clouds/cloudImpostorSystem.js";
import { highlandTerrainSurfaceHeight } from "./highlandCitadelDesign.js";

const RIDGE_PEAKS = Object.freeze([
  Object.freeze([0, -34]),
  Object.freeze([49, -18]),
  Object.freeze([-48, -13]),
]);

function lerp(a, b, t) { return a + (b - a) * t; }
function mix2(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
function hypot2(x, z) { return Math.hypot(x, z); }

function cardJitter(index, [min, max], salt = 0) {
  const t = ((Math.imul(index + 1 + salt, 2654435761) >>> 0) / 4294967296);
  return min + t * (max - min);
}

function occupiesCastle(x, z) {
  return Math.max(Math.abs(x) / 28.5, Math.abs(z + 1.5) / 31.5) < 1.05;
}

function blocksCastleView(x, z, y) {
  if (occupiesCastle(x, z) && y < 38) return true;
  return z > -6 && Math.abs(x) < 16 && y < 40;
}

function bakeLocalPath(x, z, y, { tangentX = 1, tangentZ = 0, lift = 0.6, clearance = 0.9, span = 7 } = {}) {
  const points = [];
  for (let index = 0; index < 10; index++) {
    const t = index / 9;
    const centered = t - 0.5;
    const roll = Math.sin(t * Math.PI);
    const px = x + tangentX * centered * span;
    const pz = z + tangentZ * centered * span;
    const terrain = highlandTerrainSurfaceHeight(px, pz);
    const py = Math.max(y, terrain + clearance) + roll * lift;
    points.push({
      position: [px, py, pz],
      direction: [0, 1, 0],
      altitude: py,
      terrainHeight: terrain,
      terrainClearance: clearance,
      lift,
      curl: 0,
    });
  }
  return points;
}

function makeInstance({
  id, role, spec, x, z, y, scale, lowLayer = false, hugRidge = false, climateBand, type,
}) {
  const pathPoints = bakeLocalPath(x, z, y, {
    tangentX: role === "cap" ? 0.92 : 1,
    tangentZ: role === "cap" ? 0.38 : 0,
    lift: hugRidge ? 0.35 : 0.7,
    clearance: hugRidge ? 0.45 : 0.9,
    span: hugRidge ? 11 : 6,
  });
  const phase = cardJitter(id.length, [0, 1], role.length);
  return {
    cellIndex: id,
    cartesian: true,
    position: [x, y, z],
    anchor: [0, 1, 0],
    altitude: y,
    type,
    climateBand,
    cloudBase: y,
    lowLayer,
    chainBand: role === "forest-scatter" ? null : "highland-citadel",
    oceanFetch: 0.72,
    slope: 0.5,
    windward: 0.64,
    rainShadow: 0.12,
    humidity: 0.58,
    pathPoints,
    ridgeTangent: [0.92, 0, 0.38],
    terrainClearance: hugRidge ? 0.45 : 0.9,
    lift: hugRidge ? 0.35 : 0.7,
    landformClass: "volcanic-snow-massif",
    scale,
    rotation: phase * Math.PI * 2,
    inDir: [1, 0, 0],
    outDir: [0, 0, 1],
    timeOffset: phase,
    speed: spec.driftSpeed,
    phase,
    cameraKeepout: false,
    lod: role === "cap" ? "cluster-detail" : "octa-impostor",
    shadowMode: "projected-low-resolution",
    authored: true,
    heroRole: role,
    landmarkId: "highland-citadel",
    hugRidge,
    dayPhaseWeight: spec.dayPhaseWeight,
    source: "hero-landmark-local",
  };
}

export function compileHighlandLocalHeroClouds({ spec = HERO_CLOUD_SPECS.highlandCitadel, radius = 160 } = {}) {
  const peakHeights = RIDGE_PEAKS.map(([x, z]) => highlandTerrainSurfaceHeight(x, z, radius));
  const peakHeight = Math.max(...peakHeights);
  const capMix = spec.capCard.ridgeMix ?? 0.28;
  const [capX, capZ] = mix2(RIDGE_PEAKS[0], RIDGE_PEAKS[1], capMix);
  const ridgeY = highlandTerrainSurfaceHeight(capX, capZ, radius);
  const capY = Math.max(ridgeY + 0.45, peakHeight * spec.capCard.heightRatio);
  const instances = [];
  instances.push(makeInstance({
    id: "hero:highland-citadel:local-cap",
    role: "cap",
    spec,
    x: capX,
    z: capZ,
    y: Math.max(ridgeY + 0.45, capY),
    scale: spec.cardWorldScale * spec.capCard.scale,
    hugRidge: spec.capCard.hugRidge !== false,
    climateBand: "snowline-crown",
    type: "orographic",
  }));
  const ringRadius = (spec.ringRadiusRatio ?? 0.62) * 90;
  for (let index = 0; index < spec.ringCardCount; index++) {
    const azimuth = index / spec.ringCardCount * Math.PI * 2;
    const x = Math.cos(azimuth) * ringRadius;
    const z = -16 + Math.sin(azimuth) * ringRadius * 0.72;
    const towardCap = Math.max(0, 1 - hypot2(x - capX, z - capZ) / 80);
    const heightRatio = spec.ringHeightBand[0]
      + (spec.ringHeightBand[1] - spec.ringHeightBand[0]) * cardJitter(index, [0, 1], 17)
      + towardCap * 0.14;
    const y = peakHeight * heightRatio;
    if (blocksCastleView(x, z, y)) continue;
    instances.push(makeInstance({
      id: `hero:highland-citadel:local-ring:${index}`,
      role: "ring",
      spec,
      x,
      z,
      y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 0.9),
      scale: spec.cardWorldScale * cardJitter(index, spec.sizeJitter, 9),
      climateBand: "snowline-crown",
      type: "orographic",
    }));
  }
  const forest = spec.forestScatter;
  if (forest?.count > 0) {
    for (let index = 0; index < forest.count; index++) {
      const x = -32 - index * 6;
      const z = -8 + index * 3;
      const y = peakHeight * lerp(forest.heightBand[0], forest.heightBand[1], cardJitter(index, [0, 1], 23));
      if (blocksCastleView(x, z, y)) continue;
      instances.push(makeInstance({
        id: `hero:highland-citadel:local-forest:${index}`,
        role: "forest-scatter",
        spec,
        x,
        z,
        y: Math.max(y, highlandTerrainSurfaceHeight(x, z, radius) + 0.7),
        scale: spec.cardWorldScale * forest.scale,
        lowLayer: true,
        climateBand: "open-sky-edge",
        type: "fair-weather",
      }));
    }
  }
  return {
    kind: "highland-local-hero-clouds-v1",
    instances,
    instanceCount: instances.length,
    heroCount: instances.length,
    peakHeight,
    cap: { x: capX, z: capZ, y: instances[0].position[1] },
  };
}

export function mountHighlandLocalHeroClouds(THREE, citadel, { radius = 160 } = {}) {
  if (!THREE || !citadel) return null;
  const existing = citadel.getObjectByName("highland-hero-cloud-impostors");
  if (existing) {
    existing.removeFromParent();
    existing.geometry?.dispose?.();
    existing.material?.dispose?.();
  }
  const clusters = compileHighlandLocalHeroClouds({ radius });
  const renderer = createCloudImpostorSystem(THREE, citadel, clusters, { radius });
  renderer.mesh.name = "highland-hero-cloud-impostors";
  renderer.mesh.renderOrder = 6;
  renderer.mesh.userData.kind = "highland-hero-clouds";
  renderer.mesh.userData.heroCount = clusters.heroCount;
  renderer.mesh.userData.cap = clusters.cap;
  citadel.userData.highlandHeroClouds = renderer;
  citadel.userData.highlandHeroCloudCount = clusters.heroCount;
  return renderer;
}
