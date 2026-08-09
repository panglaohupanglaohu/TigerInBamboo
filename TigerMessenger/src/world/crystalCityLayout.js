// =====================================================================
//  水晶城布局数据模型（与搭建面板 / moebiusCity 共用）
//  - 局部坐标 (lx, lz)：峡谷谷心切平面角坐标（弧度），原点 = 谷心
//  - 花厅 halls：grand / gold
//  - 晶体 crystals：实例化尖塔
//  - 「汇聚高地」：落在峡谷中上层台地环带（较高山峦），避免深谷底
// =====================================================================
import * as THREE from "three";
import { CANYON } from "./canyon.js";
import { latLonToDir } from "./sphereMath.js";

// 与 moebiusCity 保持同值（避免循环依赖，不从 moebiusCity 反向 import）
const CITY_ENTRY_DROP = CANYON.depth / CANYON.steps;
const CITY_APPROACH_DISTANCE_MULTIPLIER = 5;
const CITY_BUILDING_SCALE = 3;
const ORIGINAL_CITY_RADIUS =
  CANYON.rim * (1 - CITY_APPROACH_DISTANCE_MULTIPLIER / CANYON.steps);
export const LAYOUT_CITY_FOOTPRINT = Math.min(
  CANYON.rim - 0.08,
  ORIGINAL_CITY_RADIUS * 3
);
export const LAYOUT_BUILDING_SCALE = CITY_BUILDING_SCALE;

/** 编辑器 / 主场景共用存档键 */
export const CRYSTAL_CITY_LAYOUT_KEY = "tm.crystalCity.layout.v1";

/** 高地环带：距谷心角距 ∈ [外环内侧, 外环外侧]，落在较高阶地 */
export const HIGH_RIDGE_RING = Object.freeze({
  inner: LAYOUT_CITY_FOOTPRINT * 0.42,
  outer: LAYOUT_CITY_FOOTPRINT * 0.78,
  cluster: LAYOUT_CITY_FOOTPRINT * 0.14,
});

const _cityCenter = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
const _cityEast = new THREE.Vector3()
  .crossVectors(new THREE.Vector3(0, 1, 0), _cityCenter)
  .normalize();
const _cityNorth = new THREE.Vector3().crossVectors(_cityCenter, _cityEast).normalize();

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 谷心切平面角坐标 → 单位方向 */
export function cityLocalToDir(lx, lz, out = new THREE.Vector3()) {
  const d = Math.hypot(lx, lz);
  if (d < 1e-6) return out.copy(_cityCenter);
  return out
    .copy(_cityCenter)
    .multiplyScalar(Math.cos(d))
    .addScaledVector(_cityEast, (lx / d) * Math.sin(d))
    .addScaledVector(_cityNorth, (lz / d) * Math.sin(d))
    .normalize();
}

/** 单位方向 → 谷心切平面角坐标（仅峡谷邻域有意义） */
export function dirToCityLocal(dir, out = { lx: 0, lz: 0 }) {
  const d = Math.acos(THREE.MathUtils.clamp(dir.dot(_cityCenter), -1, 1));
  if (d < 1e-6) {
    out.lx = 0;
    out.lz = 0;
    return out;
  }
  // 切向分量
  const t = dir.clone().addScaledVector(_cityCenter, -dir.dot(_cityCenter));
  if (t.lengthSq() < 1e-12) {
    out.lx = 0;
    out.lz = 0;
    return out;
  }
  t.normalize();
  out.lx = t.dot(_cityEast) * d;
  out.lz = t.dot(_cityNorth) * d;
  return out;
}

export function getCityFrame() {
  return {
    center: _cityCenter.clone(),
    east: _cityEast.clone(),
    north: _cityNorth.clone(),
    footprint: LAYOUT_CITY_FOOTPRINT,
    ridge: { ...HIGH_RIDGE_RING },
  };
}

/** 空布局 */
export function emptyCrystalLayout() {
  return { version: 1, halls: [], crystals: [] };
}

/**
 * 默认「高地汇聚」布局：花厅 + 晶体落在较高阶地环带，绕若干山脊枢纽成簇。
 */
export function generateHighRidgeLayout(seed = 20260803) {
  const rnd = lcg(seed);
  const mid =
    (HIGH_RIDGE_RING.inner + HIGH_RIDGE_RING.outer) * 0.5;
  const hubs = [
    { a: -0.35, kind: "grand", scale: 1, seed: 701 },
    { a: 1.15, kind: "gold", scale: 0.45, seed: 4107 },
    { a: 2.45, kind: "gold", scale: 0.45, seed: 4138 },
  ];
  const halls = hubs.map((h, i) => {
    const ring = mid + (rnd() - 0.5) * 0.06;
    return {
      kind: h.kind,
      lx: Math.cos(h.a) * ring,
      lz: Math.sin(h.a) * ring,
      scale: h.scale,
      seed: h.seed,
      id: `hall-${i}`,
    };
  });

  const crystals = [];
  // 每座花厅周围一簇晶体
  halls.forEach((hub, hi) => {
    const n = hub.kind === "grand" ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 0.035 + rnd() * HIGH_RIDGE_RING.cluster;
      let lx = hub.lx + Math.cos(a) * d;
      let lz = hub.lz + Math.sin(a) * d;
      // 夹回高地环带
      const rho = Math.hypot(lx, lz) || 1e-6;
      if (rho < HIGH_RIDGE_RING.inner || rho > HIGH_RIDGE_RING.outer) {
        const t = THREE.MathUtils.clamp(
          rho,
          HIGH_RIDGE_RING.inner,
          HIGH_RIDGE_RING.outer
        );
        lx = (lx / rho) * t;
        lz = (lz / rho) * t;
      }
      crystals.push({
        id: `c-${hi}-${i}`,
        lx,
        lz,
        r: (0.5 + rnd() * 0.85) * LAYOUT_BUILDING_SCALE,
        // h 由建造时按中心度重算，这里只给相对尺度
        hMul: 0.75 + rnd() * 0.55,
        seg: 4 + ((rnd() * 3) | 0),
        tx: (rnd() - 0.5) * 0.22,
        tz: (rnd() - 0.5) * 0.22,
      });
    }
  });

  return { version: 1, halls, crystals };
}

/** 规范化布局（补 id、裁剪坐标） */
export function normalizeCrystalLayout(raw) {
  const layout = emptyCrystalLayout();
  if (!raw || typeof raw !== "object") return generateHighRidgeLayout();
  const halls = Array.isArray(raw.halls) ? raw.halls : [];
  const crystals = Array.isArray(raw.crystals) ? raw.crystals : [];
  layout.halls = halls.map((h, i) => ({
    id: h.id || `hall-${i}`,
    kind: h.kind === "gold" ? "gold" : "grand",
    lx: Number(h.lx) || 0,
    lz: Number(h.lz) || 0,
    scale: Number.isFinite(h.scale) ? h.scale : h.kind === "gold" ? 0.45 : 1,
    seed: Number.isFinite(h.seed) ? h.seed : 700 + i,
  }));
  layout.crystals = crystals.map((c, i) => ({
    id: c.id || `c-${i}`,
    lx: Number(c.lx) || 0,
    lz: Number(c.lz) || 0,
    r: Number.isFinite(c.r) ? c.r : 1.2 * CITY_BUILDING_SCALE,
    hMul: Number.isFinite(c.hMul) ? c.hMul : 1,
    seg: [4, 5, 6].includes(c.seg) ? c.seg : 5,
    tx: Number.isFinite(c.tx) ? c.tx : 0,
    tz: Number.isFinite(c.tz) ? c.tz : 0,
  }));
  return layout;
}

export function loadCrystalLayoutFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(CRYSTAL_CITY_LAYOUT_KEY) || "null");
    if (raw && (raw.halls || raw.crystals)) return normalizeCrystalLayout(raw);
  } catch {
    /* ignore */
  }
  return null;
}

export function saveCrystalLayoutToStorage(layout) {
  localStorage.setItem(
    CRYSTAL_CITY_LAYOUT_KEY,
    JSON.stringify(normalizeCrystalLayout(layout))
  );
}
