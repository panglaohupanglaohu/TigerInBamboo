// =====================================================================
// Compile landmark-pinned hero cloud clusters and the keepouts that stop
// them (and climate clouds) from permanently hiding peaks or combat sightlines.
// Reuses the climate impostor instance schema; does not import Three.js.
// =====================================================================

import { tangentBasis } from "../../procgen/planet/barycentric.js";
import {
  applyCloudCameraKeepouts,
  bakeRidgePath,
  compileCloudClusters,
  hashCloudInstances,
} from "./cloudClusterCompiler.js";
import { heroCloudSpecForLandmark } from "./heroCloudCatalog.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(...v) || 1; return v.map((n) => n / l); }
function addScaled(a, b, scale) { return a.map((value, index) => value + b[index] * scale); }

function cardJitter(index, [min, max], salt = 0) {
  const t = ((Math.imul(index + 1 + salt, 2654435761) >>> 0) / 4294967296);
  return min + t * (max - min);
}

function highlandPeakDirections(landmark) {
  const basis = tangentBasis(landmark.direction);
  const offsets = [[0, 0], [0.11, 0.035], [-0.095, 0.05]];
  return offsets.map(([right, forward]) => normalize(addScaled(
    addScaled(landmark.direction, basis.right, right),
    basis.forward,
    forward,
  )));
}

function directionOnRing(landmark, angularDistance, azimuth) {
  const basis = tangentBasis(landmark.direction);
  const radial = Math.cos(angularDistance);
  const sweep = Math.sin(angularDistance);
  return normalize(addScaled(
    addScaled(landmark.direction.map((value) => value * radial), basis.right, Math.cos(azimuth) * sweep),
    basis.forward,
    Math.sin(azimuth) * sweep,
  ));
}

function lowerWaterfallDirection(landmark) {
  const direction = normalize(landmark.direction);
  const forward = normalize(landmark.forward || [0, 0, 1]);
  const projected = addScaled(forward, direction, -dot(forward, direction));
  const length = Math.hypot(...projected) || 1;
  const offset = Math.max(0.08, landmark.angularRadius * 1.6);
  return normalize(direction.map((value, index) => value + projected[index] / length * offset));
}

function makeHeroInstance({
  id, role, landmark, spec, direction, altitude, scale, wind, field, ridgeDirections, hugRidge, lowLayer, climateBand, type,
}) {
  const semantic = field?.semanticAt?.(direction) || { height: field?.heightAt?.(direction) || 0 };
  const lift = hugRidge ? 0.06 : 0.1;
  const ridgePath = bakeRidgePath({
    anchor: direction,
    semantic,
    wind,
    altitude,
    lift,
    scale: scale / Math.max(1, spec.cardWorldScale),
    hugRidge,
    ridgeDirections,
    field,
    clearance: hugRidge ? 0.38 : 0.7,
  });
  const phase = cardJitter(id.length + role.length, [0, 1], id.charCodeAt(id.length - 1) || 1);
  return {
    cellIndex: id,
    anchor: direction.slice(),
    altitude: ridgePath.points[Math.min(2, ridgePath.points.length - 1)].altitude,
    type,
    climateBand,
    cloudBase: altitude,
    lowLayer: !!lowLayer,
    chainBand: role === "forest-scatter" ? null : "highland-citadel",
    oceanFetch: 0.72,
    slope: Math.max(0, Math.min(1, (semantic.slope ?? 0.45))),
    windward: 0.64,
    rainShadow: 0.12,
    humidity: 0.58,
    pathPoints: ridgePath.points,
    ridgeTangent: ridgePath.ridgeTangent,
    terrainClearance: ridgePath.terrainClearance,
    lift,
    landformClass: landmark.landformClass || "volcanic-snow-massif",
    scale,
    rotation: phase * Math.PI * 2,
    inDir: wind.slice(),
    outDir: ridgePath.ridgeTangent.slice(),
    timeOffset: phase,
    speed: spec.driftSpeed,
    phase,
    cameraKeepout: false,
    lod: role === "cap" ? "cluster-detail" : "octa-impostor",
    shadowMode: "projected-low-resolution",
    authored: true,
    heroRole: role,
    landmarkId: landmark.id,
    hugRidge: !!hugRidge,
    dayPhaseWeight: spec.dayPhaseWeight,
    source: "hero-landmark",
  };
}

export function compileHeroCloudClusters({ landmarks = [], field = null, wind = [1, 0, 0] } = {}) {
  const direction = normalize(wind);
  const instances = [];
  for (const landmark of landmarks) {
    const spec = heroCloudSpecForLandmark(landmark);
    if (!spec) continue;
    const peaks = highlandPeakDirections(landmark);
    const peakHeight = Math.max(...peaks.map((peak) => field?.heightAt?.(peak) || 8.6), field?.heightAt?.(landmark.direction) || 8.6);
    const capMix = spec.capCard.ridgeMix ?? 0.38;
    const capDirection = normalize(peaks[0].map((value, index) => value * (1 - capMix) + peaks[1][index] * capMix));
    const capAltitude = peakHeight * spec.capCard.heightRatio;
    const capScale = spec.cardWorldScale * spec.capCard.scale;
    instances.push(makeHeroInstance({
      id: `hero:${landmark.id}:cap`,
      role: "cap",
      landmark,
      spec,
      direction: capDirection,
      altitude: capAltitude,
      scale: capScale,
      wind: direction,
      field,
      ridgeDirections: [peaks[2], peaks[0], peaks[1]],
      hugRidge: spec.capCard.hugRidge !== false,
      climateBand: "snowline-crown",
      type: "orographic",
    }));
    const ringRadius = landmark.angularRadius * spec.ringRadiusRatio;
    for (let index = 0; index < spec.ringCardCount; index++) {
      const azimuth = index / spec.ringCardCount * Math.PI * 2;
      const ringDirection = directionOnRing(landmark, ringRadius, azimuth);
      const towardCap = Math.max(0, dot(ringDirection, capDirection));
      const bandT = cardJitter(index, [0, 1], 17);
      const heightRatio = spec.ringHeightBand[0]
        + (spec.ringHeightBand[1] - spec.ringHeightBand[0]) * bandT
        + towardCap * towardCap * 0.16;
      const jitter = cardJitter(index, spec.sizeJitter, 9);
      instances.push(makeHeroInstance({
        id: `hero:${landmark.id}:ring:${index}`,
        role: "ring",
        landmark,
        spec,
        direction: ringDirection,
        altitude: peakHeight * heightRatio,
        scale: spec.cardWorldScale * jitter,
        wind: direction,
        field,
        hugRidge: false,
        climateBand: "snowline-crown",
        type: "orographic",
      }));
    }
    const forest = spec.forestScatter;
    if (forest?.count > 0) {
      const basis = tangentBasis(landmark.direction);
      for (let index = 0; index < forest.count; index++) {
        const forestDirection = normalize(addScaled(
          addScaled(landmark.direction, basis.right, -forest.radiusRatio * landmark.angularRadius),
          basis.forward,
          (0.18 + index * 0.07) * landmark.angularRadius,
        ));
        const heightRatio = forest.heightBand[0] + (forest.heightBand[1] - forest.heightBand[0]) * cardJitter(index, [0, 1], 23);
        instances.push(makeHeroInstance({
          id: `hero:${landmark.id}:forest:${index}`,
          role: "forest-scatter",
          landmark,
          spec,
          direction: forestDirection,
          altitude: peakHeight * heightRatio,
          scale: spec.cardWorldScale * forest.scale,
          wind: direction,
          field,
          hugRidge: false,
          lowLayer: true,
          climateBand: "open-sky-edge",
          type: "fair-weather",
        }));
      }
    }
  }
  return {
    kind: "hero-cloud-clusters-v1",
    instances,
    instanceCount: instances.length,
    heroCount: instances.length,
    heroHash: hashCloudInstances(instances),
  };
}

export function compileCloudKeepouts({ landmarks = [], field = null } = {}) {
  const keepouts = [];
  for (const entry of landmarks) {
    if (entry.cameraKeepouts?.length) {
      keepouts.push({
        id: `${entry.id}:camera`,
        direction: entry.direction.slice(),
        angularRadius: Math.max(0.035, entry.angularRadius * 0.22),
        kind: "camera",
        blockLowCloud: false,
      });
    }
    if (entry.id === "highland-citadel") {
      const peakHeight = field?.heightAt?.(entry.direction) || 8.6;
      const cityDirection = normalize(addScaled(
        entry.direction,
        tangentBasis(entry.direction).forward,
        entry.angularRadius * 0.45,
      ));
      keepouts.push({
        id: "highland-citadel:peak-visibility",
        direction: entry.direction.slice(),
        angularRadius: Math.max(0.028, entry.angularRadius * 0.16),
        kind: "peak-visibility",
        peakHeight,
        peakVisibleMinFraction: 0.05,
        allowHeroRoles: ["cap"],
      });
      keepouts.push({
        id: "highland-citadel:castle-sightline",
        direction: cityDirection,
        angularRadius: Math.max(0.045, entry.angularRadius * 0.28),
        kind: "combat-sightline",
        maxAltitude: peakHeight * 0.48,
        blockHeroRoles: ["forest-scatter"],
      });
      keepouts.push({
        id: "highland-citadel:waterfall-horse",
        direction: lowerWaterfallDirection(entry),
        angularRadius: 0.048,
        kind: "combat-sightline",
        maxAltitude: peakHeight * 0.42,
        blockLowCloud: true,
      });
    }
  }
  return keepouts;
}

export function mergeCloudClusters(climate, hero) {
  const instances = [...(climate?.instances || []), ...(hero?.instances || [])];
  return {
    kind: climate?.kind || "cloud-clusters-v8",
    instances,
    instanceCount: instances.length,
    climateHash: hashCloudInstances(instances),
    heroHash: hero?.heroHash || hashCloudInstances(instances.filter((instance) => instance.authored)),
    heroCount: instances.filter((instance) => instance.authored).length,
    climateInputs: climate?.climateInputs || [],
    cloudChain: climate?.cloudChain || null,
  };
}

export function compilePlanetClouds({
  cells = [],
  semantics = new Map(),
  water = null,
  wind = [1, 0, 0],
  seed = 1,
  maxInstances = 600,
  landmarks = [],
  field = null,
  climate = null,
} = {}) {
  const sampled = compileCloudClusters({ cells, semantics, water, wind, seed, maxInstances, climate, field });
  const hero = compileHeroCloudClusters({ landmarks, field, wind });
  const merged = mergeCloudClusters(sampled, hero);
  merged.climateFieldHash = climate?.hash || sampled.climateFieldHash || null;
  return applyCloudCameraKeepouts(merged, compileCloudKeepouts({ landmarks, field }));
}

export function heroLayoutHash(instances) {
  return hashCloudInstances((instances || []).filter((instance) => instance.authored).map((instance) => ({
    cellIndex: instance.cellIndex,
    altitude: 0,
    scale: instance.scale,
    phase: 0,
    climateBand: instance.heroRole,
    cloudBase: 0,
    heroRole: instance.heroRole,
    anchor: instance.anchor,
  })));
}
