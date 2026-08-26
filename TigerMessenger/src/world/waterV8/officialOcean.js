// Official-page ocean: a geodesic curved shell draped over the legacy planet.
// Does not enable planetTerrainV1. Canyon vertices follow canyonOffsetDir so
// the crystal-city rift stays open instead of getting an ocean lid.
import * as THREE from "three";
import { buildGeodesicMainAndDualGrid } from "../../procgen/planet/geodesicGrid.js";
import { buildGeodesicWaterShell } from "./curvedWaterCompiler.js";
import { CANYON, canyonOffsetDirSmooth } from "../canyon.js";

export const OFFICIAL_OCEAN_SEA_LEVEL = 0.12;
export const OFFICIAL_OCEAN_SUBDIVISION = 5;
export const OFFICIAL_HIGHLAND_ISLAND_LIFT = 6;

const _dir = new THREE.Vector3();

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Ocean height relative to planet radius.
 * Open water stays at sea level; across the canyon rim it keeps sea level,
 * then slopes down the rift so the sea visibly pours into the crystal-city canyon.
 */
export function officialOceanLevelAt(dir, seaLevel = OFFICIAL_OCEAN_SEA_LEVEL) {
  if (!dir) return seaLevel;
  _dir.copy(dir).normalize();
  const smooth = canyonOffsetDirSmooth(_dir);
  if (!(smooth < 0)) return seaLevel;
  const t = Math.max(0, Math.min(1, -smooth / CANYON.depth));
  const pour = smoothstep(0.04, 0.42, t);
  return seaLevel * (1 - pour) + (smooth + 0.45) * pour;
}

/** Drape geodesic ocean vertices: sea level outside, continuous inflow inside the canyon. */
export function drapeOceanOnLegacyPlanet(positions, radius, seaLevel = OFFICIAL_OCEAN_SEA_LEVEL) {
  if (!positions || positions.length < 3) return positions;
  for (let i = 0; i < positions.length; i += 3) {
    _dir.set(positions[i], positions[i + 1], positions[i + 2]);
    if (_dir.lengthSq() < 1e-12) continue;
    _dir.normalize();
    const r = radius + officialOceanLevelAt(_dir, seaLevel);
    positions[i] = _dir.x * r;
    positions[i + 1] = _dir.y * r;
    positions[i + 2] = _dir.z * r;
  }
  return positions;
}

export function compileOfficialOcean({
  radius = 160,
  seed = 42,
  subdivision = OFFICIAL_OCEAN_SUBDIVISION,
  seaLevel = OFFICIAL_OCEAN_SEA_LEVEL,
} = {}) {
  const grid = buildGeodesicMainAndDualGrid({ radius, subdivision, seed });
  const ocean = buildGeodesicWaterShell({ grid, radius, level: seaLevel });
  drapeOceanOnLegacyPlanet(ocean.positions, radius, seaLevel);
  ocean.hash = `${ocean.hash}:legacy-drape`;
  return { grid, ocean, seaLevel, radius: radius + seaLevel, curved: true };
}

/** Closed spherical patrol curve: lerp+normalize between landmark dirs so chords stay on the shell. */
export function buildOceanPatrolCurve(anchors, radius, seaLevel = OFFICIAL_OCEAN_SEA_LEVEL) {
  const dirs = [];
  for (const anchor of anchors || []) {
    if (!anchor?.isVector3 || anchor.lengthSq() < 1e-8) continue;
    dirs.push(anchor.clone().normalize());
  }
  if (dirs.length < 3) return null;
  const waterR = radius + seaLevel;
  const pts = [];
  for (let i = 0; i < dirs.length; i++) {
    const a = dirs[i];
    const b = dirs[(i + 1) % dirs.length];
    const ang = Math.max(0.04, a.angleTo(b));
    const steps = Math.max(8, Math.ceil(ang * 18));
    for (let s = 0; s < steps; s++) {
      pts.push(a.clone().lerp(b, tSafe(s / steps)).normalize().multiplyScalar(waterR));
    }
  }
  return {
    curve: new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.5),
    waterR,
    closed: true,
  };
}

function tSafe(t) {
  return Number.isFinite(t) ? t : 0;
}
