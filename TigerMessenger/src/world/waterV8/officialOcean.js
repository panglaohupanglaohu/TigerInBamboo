// Official-page ocean: a dense curved sphere shell that sits above the legacy
// planet. Coarse geodesic chords were sinking under the ground except in the
// canyon; this shell matches the planet tessellation so the sea stays on top.
import * as THREE from "three";
import { CANYON, canyonOffsetDirSmooth } from "../canyon.js";
import { SEA_LEVEL } from "../seaLevel.js";

/**
 * 海平面（相对 R 的抬升）—— **从 world/seaLevel.js 的唯一真源派生，别在这里写数字**。
 *
 * 2026-09-05 之前这里硬写着 0.72，而 procgen 链默认 `seaLevel = 0`，
 * 于是「地标在不在海面之上」取决于走了哪条水面分支。基线已收拢到
 * `SEA_LEVEL`，本常量保留只为兼容既有 import。
 * 由来、余量与改动须知全部记在 `world/seaLevel.js` 的文件头。
 */
export const OFFICIAL_OCEAN_SEA_LEVEL = SEA_LEVEL;
export const OFFICIAL_OCEAN_COLOR = 0x17698b;
export const OFFICIAL_OCEAN_OPACITY = 0.94;
export const OFFICIAL_OCEAN_WIDTH_SEGMENTS = 72;
export const OFFICIAL_OCEAN_HEIGHT_SEGMENTS = 48;
export const OFFICIAL_HIGHLAND_ISLAND_LIFT = 0;
/**
 * 圣城城堡容器整体下移量（主人验收 2026-08-29 方案1「半沉堡垒」）：
 * 4.63 = 接触极限（基面贴海面）；5.33 = 在接触极限上再降 0.7，海线淹上
 * 城内第一排墙脚——街道平台隐入水下、白城建筑从海面直接拔起
 * （主人确认接受淹街构图）。
 */
export const HIGHLAND_CASTLE_SEA_DROP = 5.33;

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
  seaLevel = OFFICIAL_OCEAN_SEA_LEVEL,
  widthSegments = OFFICIAL_OCEAN_WIDTH_SEGMENTS,
  heightSegments = OFFICIAL_OCEAN_HEIGHT_SEGMENTS,
} = {}) {
  const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  const pos = geo.attributes.position;
  const positions = new Float32Array(pos.count * 3);
  const waterData0 = new Float32Array(pos.count * 4);
  const waterData1 = new Float32Array(pos.count * 4);
  for (let vertex = 0; vertex < pos.count; vertex++) {
    _dir.fromBufferAttribute(pos, vertex).normalize();
    const level = officialOceanLevelAt(_dir, seaLevel);
    const r = radius + level;
    positions[vertex * 3] = _dir.x * r;
    positions[vertex * 3 + 1] = _dir.y * r;
    positions[vertex * 3 + 2] = _dir.z * r;
    const dropped = Math.max(0, seaLevel - level);
    const depth = Math.max(0.22, Math.min(1, 0.42 + dropped / 14));
    const shore = Math.max(0.06, Math.min(1, 0.2 + dropped / 18));
    const fetch = 0.42 + Math.max(0, _dir.x * 0.38);
    waterData0.set([depth, shore, fetch, ((vertex * 37) % 101) / 100], vertex * 4);
    waterData1.set([_dir.x, _dir.z, dropped > 0.4 ? 1 : 0, 0.86], vertex * 4);
  }
  const srcIndex = geo.index.array;
  const indices = new Uint32Array(srcIndex.length);
  indices.set(srcIndex);
  geo.dispose();
  return {
    ocean: {
      kind: "curved-ocean-shell-v8",
      radius: radius + seaLevel,
      positions,
      indices,
      waterData0,
      waterData1,
      semantic: "ocean",
      curved: true,
      topology: { source: "sphere-shell+canyon-inflow", nearShoreData: true, stableVertexIds: true },
      hash: `ocean:fitted:${widthSegments}x${heightSegments}:${(radius + seaLevel).toFixed(2)}`,
    },
    seaLevel,
    radius: radius + seaLevel,
    curved: true,
  };
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
