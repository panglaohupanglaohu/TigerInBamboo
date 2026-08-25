// =====================================================================
// Climate-aware cloud clusters.  Input is terrain/water semantics, so cloud
// placement follows ocean fetch, wetness, elevation and wind instead of a
// uniform latitude ring.
// =====================================================================

import { createStableRng } from "../../procgen/core/stableRng.js";

export const CLOUD_RIDGE_PATH_POINTS = 10;

/** Five authored climate bands from the coast to the snow peak. */
export const OSKAR_CLOUD_CHAIN_BANDS = Object.freeze([
  Object.freeze({ id: "bookshop-old-harbor", color: "#9B5E0A", elevation: "low", style: "puffy-low", cloudCount: 3, base: 1.05, thickness: 1.15, lowLayer: true }),
  Object.freeze({ id: "swamp-white-whale-lake", color: "#087C6B", elevation: "lowest", style: "water-fog+storm", cloudCount: 2, base: 0.55, thickness: 0.32, lowLayer: true, thunder: true }),
  Object.freeze({ id: "crystal-canyon", color: "#9D3C18", elevation: "low-medium", style: "cirrus", cloudCount: 2, base: 6.6, thickness: 0.15, lowLayer: false }),
  Object.freeze({ id: "triple-gate", color: "#4639A6", elevation: "high", style: "thin-wave", cloudCount: 3, base: 5.4, thickness: 0.18, lowLayer: false }),
  Object.freeze({ id: "highland-citadel", color: "#4D4B47", elevation: "highest", style: "windward-cloud-sea+lens", cloudCount: 5, base: 8.5, thickness: 1.25, lowLayer: false, snowCap: true }),
]);

export function compileOskarCloudChain({ prevailingWind = "coastal-moisture-inland-lift" } = {}) {
  return Object.freeze({
    algorithm: "oskar-semantic-five-band-cloud-chain-v1",
    prevailingWind,
    windArrow: Object.freeze([1, 0, 0]),
    bands: OSKAR_CLOUD_CHAIN_BANDS,
  });
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(v) { const l = Math.hypot(...v) || 1; return v.map((n) => n / l); }
function reject(vector, normal) {
  const amount = dot(vector, normal);
  return vector.map((value, index) => value - normal[index] * amount);
}
function addScaled(a, b, scale) { return a.map((value, index) => value + b[index] * scale); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

function slerpUnit(a, b, t) {
  const start = normalize(a);
  const end = normalize(b);
  const cosine = Math.max(-1, Math.min(1, dot(start, end)));
  if (cosine > 0.9995) return normalize(start.map((value, index) => value * (1 - t) + end[index] * t));
  const theta = Math.acos(cosine);
  const sine = Math.sin(theta) || 1;
  return normalize(start.map((value, index) => value * Math.sin((1 - t) * theta) / sine + end[index] * Math.sin(t * theta) / sine));
}

function samplePolylineSlerp(points, t) {
  if (!points?.length) return [0, 1, 0];
  if (points.length === 1) return normalize(points[0]);
  const scaled = Math.max(0, Math.min(1, t)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  return slerpUnit(points[index], points[index + 1], scaled - index);
}

export function bakeRidgePath({
  anchor, semantic = {}, wind = [1, 0, 0], altitude, lift = 0, scale = 1,
  hugRidge = false, ridgeDirections = null, field = null, clearance = null,
} = {}) {
  const radial = normalize(anchor);
  const wind3 = normalize([wind[0] || 0, wind[2] || 0.18, wind[1] || 0]);
  const tangentWind = normalize(reject(wind3, radial));
  const flow = normalize(semantic.flow || cross(radial, tangentWind));
  let ridgeTangent = normalize(reject(flow, radial));
  if (dot(ridgeTangent, tangentWind) < 0) ridgeTangent = ridgeTangent.map((value) => -value);
  const curlAxis = normalize(cross(radial, ridgeTangent));
  const terrainHeight = Number(semantic.height) || 0;
  const terrainClearance = clearance ?? Math.max(1.2, 1.2 + Math.min(4.5, Math.max(0, terrainHeight) * 0.12) + lift * 2.4);
  const safeBaseAltitude = Math.max(altitude, terrainHeight + terrainClearance);
  const points = [];
  if (hugRidge && ridgeDirections?.length >= 2) {
    for (let index = 0; index < CLOUD_RIDGE_PATH_POINTS; index++) {
      const t = index / (CLOUD_RIDGE_PATH_POINTS - 1);
      const direction = samplePolylineSlerp(ridgeDirections, t);
      const sampledHeight = field?.heightAt?.(direction) ?? terrainHeight;
      const hugClearance = clearance ?? 0.38;
      points.push({
        direction,
        altitude: Math.max(altitude, sampledHeight + hugClearance) + Math.sin(t * Math.PI) * lift * 0.35,
        terrainHeight: sampledHeight,
        terrainClearance: hugClearance,
        lift,
        curl: 0,
      });
    }
    ridgeTangent = normalize(reject(
      ridgeDirections[ridgeDirections.length - 1].map((value, index) => value - ridgeDirections[0][index]),
      radial,
    ));
    return { points, ridgeTangent, terrainClearance: points[0].terrainClearance };
  }
  for (let index = 0; index < CLOUD_RIDGE_PATH_POINTS; index++) {
    const t = index / (CLOUD_RIDGE_PATH_POINTS - 1);
    const centered = t - 0.5;
    const roll = Math.sin(t * Math.PI);
    const direction = normalize(addScaled(addScaled(radial, tangentWind, centered * 0.045 * scale), curlAxis, roll * lift * 0.008));
    points.push({
      direction,
      altitude: safeBaseAltitude + roll * lift * 1.6,
      terrainHeight,
      terrainClearance,
      lift,
      curl: roll * dot(ridgeTangent, tangentWind),
    });
  }
  return { points, ridgeTangent, terrainClearance };
}

export function hashCloudInstances(instances) {
  let h = 2166136261;
  for (const instance of instances) {
    const anchor = instance.anchor ? instance.anchor.map((value) => value.toFixed(4)).join(",") : "";
    for (const character of `${instance.cellIndex}:${Number(instance.altitude).toFixed(4)}:${Number(instance.scale).toFixed(4)}:${Number(instance.phase || 0).toFixed(4)}:${instance.climateBand}:${Number(instance.cloudBase || 0).toFixed(4)}:${instance.heroRole || "climate"}:${anchor}`) {
      h ^= character.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16);
}

function hashInstances(instances) {
  return hashCloudInstances(instances);
}

function angularSize(instance, radius = 160) {
  return Math.atan((Number(instance.scale) || 1) * 0.5 / Math.max(1, radius + (Number(instance.altitude) || 0)));
}

function peakCoverFraction(instance, peakDir, peakRadius, radius = 160) {
  const angular = Math.acos(Math.max(-1, Math.min(1, dot(instance.anchor, peakDir))));
  const cloudRadius = angularSize(instance, radius);
  if (cloudRadius <= 0) return 0;
  if (angular + peakRadius <= cloudRadius) return 1;
  if (angular >= cloudRadius + peakRadius) return 0;
  const overlap = cloudRadius + peakRadius - angular;
  return Math.max(0, Math.min(1, overlap / Math.max(1e-6, 2 * peakRadius)));
}

export function instanceFullyOccludesPeak(instance, keepout, radius = 160) {
  const peakDir = keepout.direction || [0, 1, 0];
  const peakRadius = keepout.angularRadius ?? 0.03;
  const covered = peakCoverFraction(instance, peakDir, peakRadius, radius);
  const angular = Math.acos(Math.max(-1, Math.min(1, dot(instance.anchor, peakDir))));
  const coversCenter = angular < angularSize(instance, radius) * 0.28;
  const coversHeight = (instance.altitude ?? 0) >= (keepout.peakHeight ?? 8.6) * 0.97;
  return covered >= 0.95 || (coversCenter && coversHeight);
}

function instanceInsideKeepout(instance, keepout) {
  const d = keepout.direction || [0, 1, 0];
  return dot(instance.anchor, d) > Math.cos(keepout.angularRadius ?? 0.1);
}

function keepoutRemovesInstance(instance, keepout) {
  if (!instanceInsideKeepout(instance, keepout)) return false;
  const role = instance.heroRole || "climate";
  const kind = keepout.kind || "camera";
  if (instance.lowLayer && keepout.blockLowCloud !== true && kind !== "combat-sightline") return false;
  if (kind === "peak-visibility") {
    if (role === "cap") return instanceFullyOccludesPeak(instance, keepout);
    if (role === "ring" || role === "forest-scatter") return false;
    return true;
  }
  if (kind === "combat-sightline") {
    if (keepout.maxAltitude != null && instance.altitude > keepout.maxAltitude) return false;
    if (role === "cap") return false;
    if (Array.isArray(keepout.blockHeroRoles) && keepout.blockHeroRoles.includes(role)) return true;
    if (role !== "climate") return false;
    return true;
  }
  return role === "climate";
}

export function classifyCloudBand(landformClass, wetness = 0, lift = 0, fetch = 0) {
  if (landformClass === "volcanic-snow-massif") return "snowline-crown";
  if (landformClass === "rift-shoulder-pass") return "windward-wall";
  if (landformClass === "rift-escarpment") return "rift-low-fog";
  if (landformClass === "rift-long-lake") return "lake-low-cloud";
  if (landformClass === "auckland-volcanic-hills") return "sea-breeze-scatter";
  if (landformClass === "japanese-alluvial-plain") return "open-sky-edge";
  if (lift > 0.45) return fetch >= 0.5 ? "windward-mountain" : "rain-shadow";
  if (wetness > 0.65) return "lake-low-cloud";
  return "open-sky-edge";
}

export function cloudBaseForBand(band, elevation = 0, wetness = 0) {
  const base = {
    "snowline-crown": 8.5,
    "windward-wall": 6.2,
    "rift-low-fog": 2.4,
    "lake-low-cloud": 1.6,
    "sea-breeze-scatter": 4.2,
    "open-sky-edge": 5.8,
    "windward-mountain": 6.5,
    "rain-shadow": 8.2,
  }[band] ?? 5;
  return Math.max(0.8, base + Math.max(0, elevation) * 0.08 + wetness * 0.35);
}

export function compileCloudClusters({ cells = [], semantics = new Map(), water = null, wind = [1, 0, 0], seed = 1, maxInstances = 600 } = {}) {
  const rng = createStableRng(seed, "cloud-climate");
  const direction = normalize(wind);
  const instances = [];
  for (const cell of cells) {
    if (instances.length >= maxInstances) break;
    const semantic = semantics.get(cell.id) || {};
    const fetch = Math.max(0, dot(cell.direction || [0, 1, 0], direction));
    const oceanMoisture = semantic.wetness ?? (water ? 0.5 : 0);
    const mountainLift = Math.max(0, semantic.height ?? 0) / 8;
    const slope = Math.max(0, Math.min(1, semantic.slope ?? mountainLift * 0.7));
    const rainShadow = Math.max(0, 1 - fetch) * Math.min(1, mountainLift);
    const windwardLift = fetch * Math.min(1, mountainLift + oceanMoisture * 0.35);
    const climateBand = classifyCloudBand(semantic.landformClass, oceanMoisture, mountainLift, fetch);
    const probability = Math.max(0.03, Math.min(0.9, 0.12 + oceanMoisture * 0.42 + fetch * 0.25 + mountainLift * 0.16 + windwardLift * 0.12 - rainShadow * 0.26 - slope * 0.04));
    if (!rng.chance(probability)) continue;
    const phase = rng.next();
    const cloudBase = cloudBaseForBand(climateBand, semantic.height ?? 0, oceanMoisture);
    const chainBand = OSKAR_CLOUD_CHAIN_BANDS.find((band) =>
      band.id === semantic.landmarkId || band.id === semantic.cloudChainBand
    ) || null;
    const lift = Math.max(0, windwardLift + mountainLift * slope);
    const ridgePath = bakeRidgePath({
      anchor: cell.direction || [0, 1, 0],
      semantic,
      wind: direction,
      altitude: chainBand
        ? chainBand.base + rng.range(-chainBand.thickness * 0.18, chainBand.thickness * 0.18)
        : 4.5 + mountainLift * 6 + rng.range(-0.4, 1.4),
      lift,
      scale: 0.75 + oceanMoisture * 0.5,
    });
    instances.push({
      cellIndex: cell.index,
      anchor: (cell.direction || [0, 1, 0]).slice(),
      altitude: ridgePath.points[2].altitude,
      type: mountainLift > 0.45 ? "orographic" : oceanMoisture > 0.65 ? "low-lake" : "fair-weather",
      climateBand,
      cloudBase,
      lowLayer: !!(chainBand?.lowLayer || cloudBase <= 1.8),
      chainBand: chainBand?.id || null,
      oceanFetch: fetch,
      slope,
      windward: windwardLift,
      rainShadow,
      humidity: oceanMoisture,
      pathPoints: ridgePath.points,
      ridgeTangent: ridgePath.ridgeTangent,
      terrainClearance: ridgePath.terrainClearance,
      lift,
      landformClass: semantic.landformClass || null,
      scale: 1.2 + rng.next() * (1.2 + oceanMoisture),
      rotation: rng.next() * Math.PI * 2,
      inDir: direction.slice(),
      outDir: normalize([direction[2], direction[1] * 0.2, -direction[0]]),
      timeOffset: phase,
      speed: 0.08 + rng.next() * 0.12,
      phase,
      cameraKeepout: false,
      lod: mountainLift > 0.45 ? "cluster-detail" : oceanMoisture > 0.65 ? "octa-impostor" : "weather-band",
      shadowMode: "projected-low-resolution",
    });
  }
  return {
    kind: "cloud-clusters-v8",
    instances,
    climateHash: hashInstances(instances),
    instanceCount: instances.length,
    climateInputs: instances.map((instance) => ({
      cellIndex: instance.cellIndex,
      oceanFetch: instance.oceanFetch,
      slope: instance.slope,
      windward: instance.windward,
      rainShadow: instance.rainShadow,
      cloudBase: instance.cloudBase,
      climateBand: instance.climateBand,
      chainBand: instance.chainBand,
      lowLayer: instance.lowLayer,
    })),
    cloudChain: compileOskarCloudChain(),
  };
}

export function applyCloudCameraKeepouts(clusters, keepouts = []) {
  for (const instance of clusters?.instances || []) {
    instance.cameraKeepout = keepouts.some((keepout) => keepoutRemovesInstance(instance, keepout));
  }
  clusters.instances = clusters.instances.filter((instance) => !instance.cameraKeepout);
  clusters.instanceCount = clusters.instances.length;
  clusters.climateHash = hashInstances(clusters.instances);
  if (clusters.heroCount != null) {
    clusters.heroCount = clusters.instances.filter((instance) => instance.authored).length;
    clusters.heroHash = hashInstances(clusters.instances.filter((instance) => instance.authored));
  }
  return clusters;
}
