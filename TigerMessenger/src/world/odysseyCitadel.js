// ============================================================================
//  Odyssey Citadel — Townscaper 式规则生成的高山圣城
//
//  Local convention: +Y = sky / planet normal, +Z = the player-facing facade.
//  建筑本体由 citadelTown.js 的单元格地图 + 邻接规则生成；本文件负责
//  断崖基岩、五层台地/折返石阶外围地势、水墨描边与球面放置。
// ============================================================================
import * as THREE from "three";
import { addOutline } from "../assets/toon.js";
import { mergeStaticGroup } from "./geometryMerge.js";
import { createCitadelWatchtower } from "../assets/citadelWatchtower.js";
import { createCitadelElderTree } from "../assets/citadelElderTree.js";
import { createCitadelTrojanHorse } from "../assets/citadelTrojanHorse.js";
import { PLAYER_HEIGHT } from "../core/constants.js";
import { canyonOffsetDir } from "./canyon.js";
import {
  CITADEL_TOWN_SPEC,
  buildCitadelTown,
  normalizeCitadelTerraceLayout,
  trimCitadelGridToTerrain,
  citadelGridCellCenter,
  CITADEL_PALETTE,
  CITADEL_GATE_CHAR,
  CITADEL_GATE_COLOR,
  citadelShadeStep,
  citadelPaletteIndexOfChar,
  CITADEL_CASTLE_FLOORS,
} from "./citadelTown.js";

const PALETTE = Object.freeze({
  // 浅色系基岩与土坡：与黄土坡/白石梯湖的暖色盘统一，弃用深灰。
  cliff: 0xcfc5a2,
  stone: 0xe5eff2,
  weatherStone: 0xb8c5c9,
  ink: 0x2a2b2d,
  outline: 0x000000,
  wood: 0x8b5a2b,
  // Architecture owns no orange sunset color: illumination supplies it.
  domeIvory: 0xe6e3d7,
  domeShade: 0xbdc6c4,
  towerStone: 0xd6d8d4,
  towerShade: 0xaeb8b7,
  // 小镇字符配色：W 白石（stone）/ L 浅砂石 / B 淡砖角塔 / D 棕色正门。
  sandStone: 0xd9cfac,
  paleBrick: 0xcaa88c,
  roofTile: 0xe87828, // Townscaper 陶瓦橙
  water: 0x5a9eaa, // 原版岛城青绿水
  foliageDark: 0x365c3b,
  foliageLight: 0x628253,
  bark: 0x59452d,
  contour: 0xcfc49a,
  pilgrimageStone: 0xe3ddc7,
});

// 城堡连同前方绿地相对护城河水面的下沉量：与 citadelRange.js 的 CITADEL_SINK 一致，
// 让城堡台地外缘/前方绿地浸入护城河水面下，台面仍露出。
export const CITADEL_SINK = 0.6;

export const CITADEL = Object.freeze({
  layer0: { rockRadius: 2.3, rockCount: 7, centerY: 11.2 },
  outline: 0.055,
  finialHeight: PLAYER_HEIGHT * 2.0,
  // 规则生成的小镇按最终尺寸直接落地：基座底面咬入顶层台地（Y=12）0.06。
  townBaseY: 11.94,
  // 网格中心与台地圆心对齐（z=0）：编辑器中城堡居中，各层土坡上方均可
  // 放置城堡单元（terrainSupportLevel 射线命中台地实心 core）。
  townOffsetZ: 0,
  contourTerrain: {
    layerCount: 5,
    layerHeight: 2.0,
    baseRadius: 24.0,
    shrink: 0.9,
    radialSegments: 12,
    // 编辑器与几何统一采用鸟瞰顺序：台地 1 是最高、最内侧的一层；
    // 台地 5 是最低、最外侧的一层。每层半径/层高均可独立修改。
    terraces: Object.freeze([
      Object.freeze({ radius: 15.7464, height: 2.0 }),
      Object.freeze({ radius: 17.496, height: 2.0 }),
      Object.freeze({ radius: 19.44, height: 2.0 }),
      Object.freeze({ radius: 21.6, height: 2.0 }),
      Object.freeze({ radius: 24.0, height: 2.0 }),
    ]),
    // 瀑布缺口：仅当 cascadeEnabled 时，前四层台地在朝向梯湖的窄扇区开槽；
    // 缺口不切入 coreRadius 实心核，城堡基座始终落在实土上。
    // 半角从旧 0.56（≈±32°，占台面约 1/6 环带）收窄到 0.30（≈±17°），
    // 只让出梯湖水道与水帘宽度，避免整块前缘台地被水系吃掉。
    // 梯湖椭圆本身仍可作为城堡承重面（见 citadelTerrainPointSupported）。
    cascadeEnabled: true, // 层叠瀑布+梯湖总开关（编辑器可删/加）
    coreRadius: 9.0,
    notchCenter: 0.17, // 方位角 φ（从 +z 朝 +x 量）≈ 10°，正对梯湖水道
    notchHalf: 0.30, // 半角 ≈ 17°，刚好覆盖收窄后的梯湖水道
    notchedLayers: 4, // 仅前四层开槽；顶层台地完整，托住城堡与门廊平桥
  },
  // Terrace 5 starts at local Y=2. This removes the local construction offset;
  // placement also subtracts citadelCurvatureDrop(), so the outer rim—not only
  // the centre—meets the radius-160 spherical ground.
  groundEmbed: 2.0,
});

/**
 * 层叠梯湖足迹（站点/城堡局部 xz，与 citadelRange 水系同坐标）。
 * 每座湖对应一座台地；椭圆内（含略放宽的白石岸）允许安放城堡体块。
 */
export const CITADEL_CASCADE_POOL_SPECS = Object.freeze([
  Object.freeze({ name: "terrace-1-pool", x: 2.2, z: 15.2, rx: 3.5, rz: 2.1, depth: 0.7, seed: 9300 }),
  Object.freeze({ name: "terrace-2-pool", x: 2.6, z: 18.0, rx: 3.8, rz: 2.3, depth: 0.75, seed: 9301 }),
  Object.freeze({ name: "terrace-3-pool", x: 2.3, z: 21.2, rx: 4.0, rz: 2.5, depth: 0.85, seed: 9302 }),
  Object.freeze({ name: "terrace-4-pool", x: 2.5, z: 25.0, rx: 4.4, rz: 2.7, depth: 0.95, seed: 9303 }),
  Object.freeze({ name: "terrace-5-pool", x: 1.0, z: 38.0, rx: 10.5, rz: 6.8, depth: 1.75, seed: 9304 }),
]);

/** 鸟瞰图 / 编辑器上的层叠瀑布标记落点（水道中段）。 */
export const CITADEL_CASCADE_MARKER = Object.freeze({ x: 2.4, z: 22.0 });

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/** 地形编辑器（圣城搭建面板）与主场景启动共用的台地参数存档键。 */
export const CITADEL_TERRAIN_KEY = "tm.citadel.terrain.v1";
export const CITADEL_TERRAIN_OBJECTS_KEY = "tm.citadel.terrainObjects.v1";

/**
 * 城堡实例化：台地/地貌对象存档键按实例隔离。
 * 默认实例（高山圣城）用兼容旧档的键；其他实例（如运河交汇古堡）带 id 后缀。
 */
export function citadelTerrainKey(instanceId = null) {
  return instanceId ? `tm.citadel.terrain.${instanceId}.v1` : CITADEL_TERRAIN_KEY;
}
export function citadelTerrainObjectsKey(instanceId = null) {
  return instanceId ? `tm.citadel.terrainObjects.${instanceId}.v1` : CITADEL_TERRAIN_OBJECTS_KEY;
}

/** 相邻台地的最小高差 = 一个城堡建筑层，确保同层建筑天然错落。 */
export const CITADEL_MIN_TERRACE_HEIGHT = CITADEL_TOWN_SPEC.cellHeight;

/** 兼容旧版统一收分参数，归一化为“台地 1 最高”的逐层半径/层高数组。 */
export function normalizeCitadelTerrain(contourSpec = CITADEL.contourTerrain) {
  const source = Array.isArray(contourSpec?.terraces)
    ? contourSpec.terraces
    : Array.from({ length: contourSpec?.layerCount ?? 5 }, (_, index) => {
        const reverse = (contourSpec?.layerCount ?? 5) - 1 - index;
        return {
          radius: (contourSpec?.baseRadius ?? 24) * (contourSpec?.shrink ?? 0.9) ** reverse,
          height: contourSpec?.layerHeight ?? 2,
        };
      });
  const terraces = source.slice(0, 5).map((entry, index) => ({
    radius: Math.max(3, Number(entry?.radius) || 8 + index * 3),
    height: Math.max(CITADEL_MIN_TERRACE_HEIGHT, Number(entry?.height) || 2),
  }));
  while (terraces.length < 5) {
    const previous = terraces.at(-1) ?? { radius: 12, height: 2 };
    terraces.push({ radius: previous.radius + 2.5, height: previous.height });
  }
  // 台地编号不可因滑杆交叉而反转：由高到低，半径必须逐层扩大。
  for (let i = 1; i < terraces.length; i++) {
    terraces[i].radius = Math.max(terraces[i].radius, terraces[i - 1].radius + 0.5);
  }
  // 层叠瀑布总开关：关则不占台地缺口（notchedLayers=0），开才开窄扇区。
  // 注意：关闭时会把 notchedLayers/notchHalf 写成 0；再次开启时若仍读到 0
  // 必须回落到默认 4 / 0.30，否则前缘缺口永远不会恢复。
  const cascadeEnabled = contourSpec?.cascadeEnabled !== false;
  // 梯湖开关（瀑布独立化）：关 = 瀑布独立挂帘（不建湖），台面全部让给建筑。
  // 与 cascadeEnabled 正交：瀑布可独立存在而不占用台地（无白石梯湖/水面）。
  const cascadePoolsEnabled = contourSpec?.cascadePoolsEnabled !== false;
  const notchHalfRaw = Number(contourSpec?.notchHalf);
  const notchHalf = cascadeEnabled
    ? (Number.isFinite(notchHalfRaw) && notchHalfRaw > 0
      ? Math.min(0.8, Math.max(0.08, notchHalfRaw))
      : 0.30)
    : 0;
  const notchedRaw = Number(contourSpec?.notchedLayers);
  const notchedLayers = cascadeEnabled
    ? Math.min(
      terraces.length - 1,
      Number.isFinite(notchedRaw) && notchedRaw > 0 ? notchedRaw : 4
    )
    : 0;
  return {
    ...contourSpec,
    layerCount: terraces.length,
    terraces,
    radialSegments: contourSpec?.radialSegments ?? 12,
    cascadeEnabled,
    cascadePoolsEnabled,
    coreRadius: contourSpec?.coreRadius ?? 9,
    notchCenter: contourSpec?.notchCenter ?? 0.17,
    notchHalf,
    notchedLayers,
  };
}

/** 层叠瀑布（五湖四帘）是否启用。 */
export function isCitadelCascadeEnabled(contourSpec = CITADEL.contourTerrain) {
  return normalizeCitadelTerrain(contourSpec).cascadeEnabled;
}

/** 梯湖是否启用（瀑布独立化：关 = 瀑布独立挂帘、台面无湖）。 */
export function isCitadelCascadePoolsEnabled(contourSpec = CITADEL.contourTerrain) {
  return normalizeCitadelTerrain(contourSpec).cascadePoolsEnabled;
}

/** 台地 1–5 的底/顶高程；数组顺序保持“最高层优先”。 */
export function citadelTerraceMetrics(contourSpec = CITADEL.contourTerrain) {
  const normalized = normalizeCitadelTerrain(contourSpec);
  const metrics = Array(normalized.terraces.length);
  let cursorY = 2;
  for (let index = normalized.terraces.length - 1; index >= 0; index--) {
    const terrace = normalized.terraces[index];
    metrics[index] = {
      terraceIndex: index,
      radius: terrace.radius,
      height: terrace.height,
      bottom: cursorY,
      top: cursorY + terrace.height,
    };
    cursorY += terrace.height;
  }
  return metrics;
}

/**
 * A flat tangent-plane terrace floats above a sphere toward its outer rim.
 * Return the exact sagitta that must be subtracted from the whole citadel so
 * the lowest terrace's furthest vertex touches the spherical surface:
 *   drop = R - sqrt(R² - r²)
 */
export function citadelCurvatureDrop(
  surfaceRadius,
  contourSpec = CITADEL.contourTerrain
) {
  const R = Math.max(1e-6, Number(surfaceRadius) || 160);
  const normalized = normalizeCitadelTerrain(contourSpec);
  const r = Math.min(R - 1e-6, normalized.terraces.at(-1).radius);
  return R - Math.sqrt(Math.max(0, R * R - r * r));
}

const CITADEL_TERRAIN_OBJECT_TYPES = new Set(["watchtower", "elderTree", "trojanHorse"]);

/** Normalize persisted terrain-object placements into a deterministic list. */
export function normalizeCitadelTerrainObjects(input = []) {
  const source = Array.isArray(input) ? input : input?.objects;
  if (!Array.isArray(source)) return [];
  return source.flatMap((entry, index) => {
    if (!CITADEL_TERRAIN_OBJECT_TYPES.has(entry?.type)) return [];
    const terraceIndex = THREE.MathUtils.clamp(
      Math.round(Number(entry.terraceIndex) || 0),
      0,
      4
    );
    return [{
      id: String(entry.id || `${entry.type}-${terraceIndex}-${index}`),
      type: entry.type,
      terraceIndex,
      x: Number(entry.x) || 0,
      z: Number(entry.z) || 0,
      yaw: Number(entry.yaw) || 0,
      scale: Math.max(0.2, Math.min(1.5, Number(entry.scale)
        || (entry.type === "watchtower" ? 0.42
          : entry.type === "trojanHorse" ? 0.9 : 0.45))),
      // 参天树默认扎根地面；瞭望塔/木马默认立在台面。
      grounded: entry.grounded !== undefined ? Boolean(entry.grounded) : entry.type === "elderTree",
    }];
  });
}

/**
 * 点是否落在对应台地的层叠梯湖椭圆上（含白石岸放宽）。
 * 坐标系与城堡体块 / 台地足迹相同（局部 x/z）。
 * 梯湖开关 cascadePoolsEnabled=false 时恒 false：湖不存在，
 * 台面全部让给建筑（放置判定回到纯台地环带）。
 */
export function isCitadelCascadePoolSupported(
  localX,
  localZ,
  terraceIndex = 0,
  contourSpec = CITADEL.contourTerrain
) {
  const normalized = normalizeCitadelTerrain(contourSpec);
  if (!normalized.cascadeEnabled || !normalized.cascadePoolsEnabled) return false;
  const index = THREE.MathUtils.clamp(Math.round(terraceIndex), 0, 4);
  const spec = CITADEL_CASCADE_POOL_SPECS[index];
  if (!spec) return false;
  // 岸台略放大，方便在湖缘落块
  const pad = 1.12;
  const dx = (localX - spec.x) / (spec.rx * pad);
  const dz = (localZ - spec.z) / (spec.rz * pad);
  return dx * dx + dz * dz <= 1;
}

/** True when a local x/z point lies on the selected terrace's exposed top. */
export function citadelTerrainPointSupported(
  contourSpec,
  localX,
  localZ,
  terraceIndex = 0
) {
  const normalized = normalizeCitadelTerrain(contourSpec);
  const index = THREE.MathUtils.clamp(Math.round(terraceIndex), 0, 4);

  // 层叠梯湖：允许在对应台地的湖面/白石岸上安放城堡（缺口扇区不再一刀切禁建）。
  // 湖开关关闭时（cascadePoolsEnabled=false）湖区不存在 → 恒 false，走纯环带判定。
  if (isCitadelCascadePoolSupported(localX, localZ, index, normalized)) {
    return true;
  }

  const r = Math.hypot(localX, localZ);
  const outerR = normalized.terraces[index].radius;
  const innerR = index === 0 ? 0 : normalized.terraces[index - 1].radius;
  if (r > outerR + 0.01 || r < innerR - 0.01) return false;
  // 瀑布缺口扇区不再禁建：湖泊与瀑布也是城堡台地的一部分，
  // 允许在其上搭建（体块会盖住水帘/水道，属预期效果）。
  return true;
}

/**
 * 格级承重判定：中心点或格内任一采样点在可见顶面即承重。
 * 瀑布缺口沿角度切扇区，缺口边缘格的中心会落入切掉区、
 * 但格体部分仍坐在顶面上——8 点采样让这条空台地可放置。
 */
export function citadelTerrainCellSupported(
  contourSpec,
  localX,
  localZ,
  terraceIndex = 0,
  halfExtent = 0.6
) {
  if (citadelTerrainPointSupported(contourSpec, localX, localZ, terraceIndex)) return true;
  const normalized = normalizeCitadelTerrain(contourSpec);
  const index = THREE.MathUtils.clamp(Math.round(terraceIndex), 0, 4);
  const r = Math.hypot(localX, localZ);
  const outerR = normalized.terraces[index].radius;
  const innerR = index === 0 ? 0 : normalized.terraces[index - 1].radius;
  // 中心骑在环带边界上（几厘米误差）不应被拒；采样点本身仍走严格点判定
  if (r > outerR + 0.15 || r < innerR - 0.15) return false;
  // 采样点 = 格内 3×3 去中心（四角 + 四边中点）；
  // 缺口边缘格中心虽在切掉扇区内，任一采样点落在顶面即承重。
  for (const fx of [-1, 0, 1]) {
    for (const fz of [-1, 0, 1]) {
      if (!fx && !fz) continue;
      if (citadelTerrainPointSupported(
        contourSpec,
        localX + fx * halfExtent,
        localZ + fz * halfExtent,
        terraceIndex
      )) return true;
    }
  }
  return false;
}

/** 台地参数 → 镇体基座高度：最高台地台面咬入 0.06。 */
export function contourTownBaseY(contourSpec = CITADEL.contourTerrain) {
  return citadelTerraceMetrics(contourSpec)[0].top - 0.06;
}

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** A local, headless-safe three-band cel ramp. */
function makeThreeStepGradient() {
  // 5 阶更软：Townscaper 是漫反射渐变，不是两档硬卡通
  const pixels = new Uint8Array([88, 132, 176, 214, 255]);
  const gradient = new THREE.DataTexture(pixels, 5, 1, THREE.RedFormat);
  gradient.name = "citadel-three-step-gradient";
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

function makeToon(color, gradientMap) {
  // Do not pass flatShading through setValues(): the Three.js revision bundled
  // by this project logs an avoidable warning for that constructor key.
  const material = new THREE.MeshToonMaterial({ color, gradientMap });
  // Keep this assignment explicit: older Three.js revisions only rebuild the
  // shader after flatShading is changed post-construction.
  material.flatShading = true;
  material.needsUpdate = true;
  return material;
}

// ---------------------------------------------------------------------------
//  Townscaper 15 色调色板材质（含明度微抖缓存）
// ---------------------------------------------------------------------------

const _citadelPaletteMats = new Map(); // "hex|step" -> material
const _citadelPaletteColor = new THREE.Color();

/**
 * 调色板字符 → 基色材质表：buildCitadelTown 的 materials[char] 直接可用。
 * 每个装配调用共享同一份缓存（材质复用，避免重建 15+ 个 MeshToonMaterial）。
 */
function buildCitadelPaletteMaterials(gradientMap) {
  const table = {};
  for (const entry of CITADEL_PALETTE) {
    table[entry.char] = makeToon(entry.color, gradientMap);
  }
  // 正门字符：木褐专用材质（门廊语义，非调色板色）
  table[CITADEL_GATE_CHAR] = makeToon(CITADEL_GATE_COLOR, gradientMap);
  // 旧档兼容键（normalize 已迁移字符，这里兜底面板/编辑器直传旧字符）
  table.W = table["0"];
  table.L = table["2"];
  table.B = table["6"];
  table.D = table[CITADEL_GATE_CHAR];
  return table;
}

/**
 * 明度微抖材质：citadelShadeStep 给出 -2..+2 档（±4% 亮度），按
 * (char, 档位) 缓存——15 色 × 5 档 = 至多 75 个实例，全城堡共享。
 */
function makeCitadelShadeMaterialFactory(gradientMap) {
  return function makeCitadelShadeMaterial(char, ix, iz) {
    const base = CITADEL_PALETTE[citadelPaletteIndexOfChar(char)] ?? CITADEL_PALETTE[0];
    const step = citadelShadeStep(ix, iz, char);
    const key = `${gradientMap.uuid}|${base.char}|${step}`;
    let material = _citadelPaletteMats.get(key);
    if (!material) {
      _citadelPaletteColor.setHex(base.color);
      // 只动明度：hue/saturation 保持，lightness 微调（+/-4%）
      const hsl = {};
      _citadelPaletteColor.getHSL(hsl);
      hsl.l = THREE.MathUtils.clamp(hsl.l + step * 0.02, 0.02, 0.98);
      _citadelPaletteColor.setHSL(hsl.h, hsl.s, hsl.l);
      material = new THREE.MeshToonMaterial({
        color: _citadelPaletteColor.clone(),
        gradientMap,
        vertexColors: true,
      });
      material.flatShading = true;
      material.needsUpdate = true;
      material.userData.shared = true;
      _citadelPaletteMats.set(key, material);
    }
    return material;
  };
}

/** 古堡窗口夜灯材质：暖黄透光 + 自发光 */
function makeWindowLitMat(gradientMap) {
  const material = new THREE.MeshToonMaterial({
    color: 0xffc878,
    gradientMap,
    emissive: new THREE.Color(0xff8a33),
    emissiveIntensity: 1.15,
  });
  material.flatShading = true;
  material.needsUpdate = true;
  return material;
}

/** 夜间窗口点亮概率 */
export const CITADEL_WINDOW_LIT_CHANCE = 0.7;

/**
 * 收集古堡拱窗并绑定昼夜材质（热重建后须重调）。
 * @param {THREE.Object3D} castleContainer
 */
const _winWorld = new THREE.Vector3();

/** 从父链解析台地索引（town-terrace-T-level-N 或 userData.terraceIndex） */
function resolveWindowTerraceIndex(mesh) {
  let p = mesh;
  while (p) {
    if (Number.isFinite(p.userData?.terraceIndex)) return p.userData.terraceIndex | 0;
    const m = /^town-terrace-(\d+)/.exec(p.name || "");
    if (m) return Number(m[1]) | 0;
    p = p.parent;
  }
  return 0;
}

export function refreshCitadelWindowLights(castleContainer) {
  if (!castleContainer) return [];
  const gradientMap = castleContainer.userData.gradientMap ?? makeThreeStepGradient();
  // 重建后旧材质可能已 dispose，始终新建一对共享昼夜材质
  castleContainer.userData.windowDarkMat = makeToon(PALETTE.ink, gradientMap);
  castleContainer.userData.windowLitMat = makeWindowLitMat(gradientMap);
  const windows = [];
  castleContainer.traverse((o) => {
    if (!o.isMesh || o.name !== "town-window") return;
    o.material = castleContainer.userData.windowDarkMat;
    o.userData.citadelWindow = true;
    o.userData.litTonight = false;
    o.userData.extinguishedBySoldiers = false;
    const tIdx = resolveWindowTerraceIndex(o);
    const ix = Number.isFinite(o.userData.cellIx) ? o.userData.cellIx : 0;
    const iz = Number.isFinite(o.userData.cellIz) ? o.userData.cellIz : 0;
    o.userData.terraceIndex = tIdx;
    o.userData.houseId = `${tIdx}:${ix},${iz}`;
    windows.push(o);
  });
  castleContainer.userData.townWindows = windows;
  castleContainer.userData.windowNightRolled = false;
  return windows;
}

/**
 * 古堡窗口夜景：入夜时每扇窗以 70% 概率点亮，天亮熄灭；每夜重新抽签。
 * 夜间纸士兵靠近房屋时，该屋灯光熄灭，直到第二天夜晚再重新点亮。
 * @param {THREE.Object3D} castleContainer
 * @param {number} phase 昼夜相位 0..1（P.timeOfDay / dayNight.getPhase）
 * @param {{ threats?: THREE.Vector3[], threatRadius?: number }} [opts]
 */
export function updateCitadelNightWindows(castleContainer, phase, opts = {}) {
  if (!castleContainer) return;
  let windows = castleContainer.userData.townWindows;
  if (!Array.isArray(windows) || !windows.length) {
    windows = refreshCitadelWindowLights(castleContainer);
  }
  if (!windows.length) return;

  const p = ((Number(phase) % 1) + 1) % 1;
  // 入夜 ≈0.82，整夜至黎明 ≈0.22（与 dayNight KEYS 一致）
  const night = p >= 0.82 || p < 0.22;

  if (night) {
    if (!castleContainer.userData.windowNightRolled) {
      for (const w of windows) {
        w.userData.extinguishedBySoldiers = false;
        w.userData.litTonight = Math.random() < CITADEL_WINDOW_LIT_CHANCE;
      }
      castleContainer.userData.windowNightRolled = true;
    }
    // 纸士兵经过：整屋熄灯，当夜不再亮起
    const threats = opts.threats;
    if (Array.isArray(threats) && threats.length) {
      const r = Number.isFinite(opts.threatRadius) ? opts.threatRadius : 3.6;
      const r2 = r * r;
      const snuffed = new Set();
      for (const w of windows) {
        if (!w.userData.litTonight || w.userData.extinguishedBySoldiers) continue;
        if (snuffed.has(w.userData.houseId)) continue;
        w.getWorldPosition(_winWorld);
        let near = false;
        for (let i = 0; i < threats.length; i++) {
          const s = threats[i];
          if (!s) continue;
          const dx = _winWorld.x - s.x;
          const dy = _winWorld.y - s.y;
          const dz = _winWorld.z - s.z;
          if (dx * dx + dy * dy + dz * dz <= r2) {
            near = true;
            break;
          }
        }
        if (!near) continue;
        snuffed.add(w.userData.houseId);
      }
      if (snuffed.size) {
        for (const w of windows) {
          if (!snuffed.has(w.userData.houseId)) continue;
          w.userData.litTonight = false;
          w.userData.extinguishedBySoldiers = true;
        }
      }
    }
  } else if (castleContainer.userData.windowNightRolled) {
    for (const w of windows) {
      w.userData.litTonight = false;
      w.userData.extinguishedBySoldiers = false;
    }
    castleContainer.userData.windowNightRolled = false;
  }

  const dark = castleContainer.userData.windowDarkMat;
  const lit = castleContainer.userData.windowLitMat;
  if (!dark || !lit) return;
  for (const w of windows) {
    const on = night && w.userData.litTonight && !w.userData.extinguishedBySoldiers;
    if (w.material !== (on ? lit : dark)) w.material = on ? lit : dark;
  }
}

function mesh(geometry, material, name, outlineThickness = CITADEL.outline) {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  result.userData.outlineThickness = outlineThickness;
  return result;
}

/**
 * Starts as the specified thin BoxGeometry and bends its upper vertices inward
 * on a sine/cosine shoulder, producing a hand-cut Byzantine pointed arch.
 */
function makeArchedWindowGeometry() {
  const geometry = new THREE.BoxGeometry(0.4, 1.5, 0.05, 4, 8, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) + 0.75; // [0, 1.5]
    if (y > 0.92) {
      const t = THREE.MathUtils.clamp((y - 0.92) / 0.58, 0, 1);
      const sineTaper = Math.cos(t * Math.PI * 0.5);
      position.setX(i, position.getX(i) * sineTaper);
    }
    position.setY(i, y);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function buildHalfDome(radius, material, name, stretchY = 1.0) {
  const dome = mesh(
    new THREE.SphereGeometry(
      radius,
      16,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    ),
    material,
    name
  );
  dome.scale.set(1.0, stretchY, 1.0);
  return dome;
}

function buildCitadelShrub(name, scale, materials, random) {
  const shrub = new THREE.Group();
  shrub.name = name;

  const trunk = mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, 0.28 * scale, 5),
    materials.bark,
    `${name}-trunk`,
    0.012
  );
  trunk.position.y = 0.12 * scale;
  shrub.add(trunk);

  for (let i = 0; i < 6; i++) {
    const crown = mesh(
      new THREE.IcosahedronGeometry((0.42 + random() * 0.2) * scale, 0),
      i % 2 ? materials.foliageLight : materials.foliageDark,
      `${name}-crown`,
      0.018
    );
    const angle = (i / 6) * Math.PI * 2 + random() * 0.35;
    crown.position.set(
      Math.cos(angle) * (0.38 + random() * 0.25) * scale,
      (0.3 + random() * 0.28) * scale,
      Math.sin(angle) * (0.38 + random() * 0.25) * scale
    );
    crown.scale.y = 0.8 + random() * 0.35;
    shrub.add(crown);
  }
  return shrub;
}

function buildCitadelRoundTopiary(name, scale, materials, random) {
  const topiary = new THREE.Group();
  topiary.name = name;
  const trunk = mesh(
    new THREE.CylinderGeometry(0.045 * scale, 0.075 * scale, 0.34 * scale, 5),
    materials.bark,
    `${name}-trunk`,
    0.009
  );
  trunk.position.y = 0.15 * scale;
  topiary.add(trunk);
  const crown = mesh(
    new THREE.SphereGeometry((0.36 + random() * 0.12) * scale, 8, 6),
    random() > 0.45 ? materials.foliageLight : materials.foliageDark,
    `${name}-round-crown`,
    0.014
  );
  crown.position.y = (0.56 + random() * 0.08) * scale;
  topiary.add(crown);
  return topiary;
}

/** Add inverse-hull ink only after the complete town assembly exists. */
export function applyInkOutlines(assembly, enabled = true) {
  if (!enabled) return 0;
  const surfaces = [];
  assembly.traverse((object) => {
    if (object.isMesh && !object.userData.isOutline) surfaces.push(object);
  });
  for (const surface of surfaces) {
    addOutline(
      surface,
      surface.userData.outlineThickness ?? CITADEL.outline,
      PALETTE.outline,
      0
    );
  }
  return surfaces.length;
}

/**
 * 圣城静态几何合并：Townscaper 小镇 ~1264 网格 → 按「层组 × 材质」合并。
 * 运行时依赖全部保留（skip 不合并）：
 *   - town-window 夜间逐窗切换材质；
 *   - contour-step* 台地顶面——3D 直编辑按名字 getObjectByName 拾取；
 *   - 瞭望塔/参天树（userData.terrainObjectId）——右键删除拾取依赖。
 * 合并锚点 = 每个 town-terrace-N-level-M 组：合并网格挂回组内，隐藏高层
 * （组 visible 切换）与层语义保持不变。cell 体块供 3D 直编辑拾取 →
 * 合并网格 userData.faceToCell = [{ triStart, triCount, cell }]（面区间
 * 相对该合并网格自身，citadelSceneEdit 按 hit.faceIndex 反查）。
 * pilgrimage-step / pilgrimage-landing 无拾取依赖，随组合并。
 * 可重复调用（rebuildCitadelTown 热重建后再次合并，幂等清旧）。
 */
export function mergeCitadelTownStatic(assemblyRoot) {
  // 幂等：先移除上次合并产生的网格
  const stale = [];
  assemblyRoot.traverse((o) => {
    if (o.isMesh && o.userData.mergedGeometry) stale.push(o);
  });
  for (const mesh of stale) {
    mesh.geometry?.dispose?.();
    mesh.removeFromParent();
  }

  const skip = (mesh) =>
    mesh.name === "town-window" ||
    mesh.userData.citadelWindow === true ||
    mesh.userData.terrainObjectId != null ||
    mesh.name?.startsWith("contour-step-");

  const onSurface = (merged, _material, segments, groupTriStart) => {
    // 只给含 cell 数据的体块组建立面区间映射。
    // triStart 必须用「相对该合并网格自身」的段起点（seg.triStart）——
    // raycaster 命中的 hit.faceIndex 是网格局部索引；groupTriStart 是跨
    // 材质组累计的全局游标，若写入全局值，多材质组下映射会整体错位，
    // 3D 直编辑点块/悬停拾取随机失败（扭曲网格引入多组后暴露）。
    const faceToCell = [];
    for (const seg of segments) {
      if (!seg.mesh.userData?.cell) continue;
      faceToCell.push({
        triStart: seg.triStart,
        triCount: seg.triCount,
        cell: seg.mesh.userData.cell,
      });
    }
    if (faceToCell.length) {
      merged.userData.faceToCell = faceToCell;
      // 合并网格本身也携带 cell 引用（供 castCell 判定「这是体块网格」）
      merged.userData.hasMergedCells = true;
    }
  };

  // 按层组合并：每层一个锚点，隐藏高层的组 visible 语义保持有效
  const layers = assemblyRoot.userData?.layers;
  const levelGroups = [];
  if (Array.isArray(layers)) {
    for (const layer of layers) {
      for (const child of layer.children) {
        if (/^town-(terrace-)?\d+-level-\d+$/.test(child.name || "")) {
          levelGroups.push(child);
        }
      }
    }
  }
  if (levelGroups.length) {
    for (const level of levelGroups) {
      mergeStaticGroup(level, { skip, onSurface });
    }
  } else {
    // 兜底：无分层信息时整体合并（编辑器外部直用）
    mergeStaticGroup(assemblyRoot, { skip, onSurface });
  }

  // 外围台地石阶（无层语义）单独合并：contour-step 仍按名字拾取，跳过
  const terrain = assemblyRoot.userData?.outerTerrainSystem;
  if (terrain && terrain !== assemblyRoot) {
    mergeStaticGroup(terrain, { skip });
  }

  return assemblyRoot;
}

/**
 * Annular terrace sector: a flat-topped ring slab from `innerRadius` to
 * `radius`, missing the waterfall notch wedge centered at
 * `notchCenter ± notchHalf`. Azimuth convention matches cylinder placement:
 * x = r·sinφ, z = r·cosφ (φ = 0 faces the facade / cascade channel).
 */
function makeTerraceRingGeometry(radius, innerRadius, height, notchCenter, notchHalf) {
  // Shape angle α relates to φ by α = φ - π/2 (extrude plane maps (sx, sy)
  // onto world (x, -z) after rotateX(-π/2)).
  const aStart = notchCenter + notchHalf - Math.PI / 2;
  const aEnd = notchCenter - notchHalf + Math.PI * 1.5;
  const shape = new THREE.Shape();
  shape.moveTo(radius * Math.cos(aStart), radius * Math.sin(aStart));
  shape.absarc(0, 0, radius, aStart, aEnd, false);
  shape.lineTo(innerRadius * Math.cos(aEnd), innerRadius * Math.sin(aEnd));
  shape.absarc(0, 0, innerRadius, aEnd, aStart, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 18,
  });
  geometry.rotateX(-Math.PI / 2); // 挤出方向转为 +Y，台板厚 [0, height]
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Five editable terrace shelves around the sacred city. Terrace 1 is the
 * highest bird's-eye layer; terrace 5 is the lowest and widest. The default
 * pilgrimage stair and waterfall notches are regenerated from the same data.
 *
 * @param {Record<string, THREE.Material>} materials
 * @param {typeof CITADEL.contourTerrain} contourSpec 台地参数（地形编辑器可调）
 */
function buildOuterCitadelTerrain(materials, contourSpec = CITADEL.contourTerrain) {
  const normalized = normalizeCitadelTerrain(contourSpec);
  const metrics = citadelTerraceMetrics(normalized);
  const terrainSystem = new THREE.Group();
  terrainSystem.name = "citadel-outer-terrain-system";

  // Five hard-edged, twelve-sided contour shelves. The lower four are ring
  // sectors with a front wedge notch toward the stepped lakes, so the four
  // waterfall curtains stay exposed instead of being buried under the slope;
  // a solid core (and the un-notched top shelf) keeps the citadel grounded.
  const contourGroup = new THREE.Group();
  contourGroup.name = "contour-step-terrain";
  for (let terraceIndex = metrics.length - 1; terraceIndex >= 0; terraceIndex--) {
    const metric = metrics[terraceIndex];
    const radius = metric.radius;
    const shelfBottom = metric.bottom;
    // 台地 1（最高层）完整托城；台地 2–5 默认开瀑布缺口。
    const notched = terraceIndex > 0 && terraceIndex <= normalized.notchedLayers;
    const innerRadius = terraceIndex > 0
      ? metrics[terraceIndex - 1].radius
      : normalized.coreRadius;
    const shelf = mesh(
      notched
        ? makeTerraceRingGeometry(
            radius,
            innerRadius,
            metric.height,
            normalized.notchCenter,
            normalized.notchHalf
          )
        : new THREE.CylinderGeometry(
            radius,
            radius,
            metric.height,
            normalized.radialSegments
          ),
      materials.contour,
      `contour-step-${terraceIndex}`
    );
    shelf.position.y = notched ? shelfBottom : shelfBottom + metric.height / 2;
    if (!notched) {
      shelf.rotation.y = (terraceIndex % 2) * (Math.PI / normalized.radialSegments);
    }
    shelf.userData.contourIndex = terraceIndex;
    shelf.userData.terraceNumber = terraceIndex + 1;
    shelf.userData.isCitadelTerrace = true;
    shelf.userData.isHighestTerrace = terraceIndex === 0;
    shelf.userData.contourRadius = radius;
    shelf.userData.terraceHeight = metric.height;
    shelf.userData.terraceTopY = metric.top;
    contourGroup.add(shelf);
    if (notched) {
      // Solid core fills the notch's inner end: the castle footing and the
      // gate causeway always rest on real soil, never over the slot.
      const core = mesh(
        new THREE.CylinderGeometry(
          innerRadius,
          innerRadius,
          metric.height,
          normalized.radialSegments
        ),
        materials.contour,
        `contour-step-${terraceIndex}-core`
      );
      core.position.y = shelfBottom + metric.height / 2;
      core.userData.contourIndex = terraceIndex;
      core.userData.terraceNumber = terraceIndex + 1;
      core.userData.isCitadelTerrace = true;
      core.userData.contourRadius = innerRadius;
      contourGroup.add(core);
    }
  }
  terrainSystem.add(contourGroup);

  // 之字形朝圣石阶：五段梯段一一对应五层台地，在左前坡（负方位角，避开
  // 瀑布缺口）左右折返，各段弧长不同 → 坡度各不相同，绝非直上直下。
  // 每级踏步向下落梁嵌入下层台面，顶段经平桥直抵棕色木门廊（正门）。
  const pilgrimageRamp = new THREE.Group();
  pilgrimageRamp.name = "winding-pilgrimage-ramp";
  // φ：从 +z（正门/瀑布方向）朝 +x 量；负角 = 左前坡。
  const flights = [
    { from: -0.87, to: -1.5, terrace: 4, groundY: 2.0 }, // 地面 → 台地 5
    { from: -1.5, to: -0.91, terrace: 3 },               // 台地 5 → 台地 4
    { from: -0.91, to: -1.47, terrace: 2 },              // 台地 4 → 台地 3
    { from: -1.47, to: -0.94, terrace: 1 },              // 台地 3 → 台地 2
    { from: -0.94, to: -1.4, terrace: 0 },               // 台地 2 → 台地 1（最高）
  ];
  const stepGeometry = new THREE.BoxGeometry(1.85, 1, 1.45);
  let stepIndex = 0;
  for (const flight of flights) {
    const terraceIndex = flight.terrace;
    const metric = metrics[terraceIndex];
    const rho = metric.radius + 1.05;
    const yTop = metric.top + 0.06;
    const lowerMetric = metrics[terraceIndex + 1];
    const yBottom = lowerMetric ? lowerMetric.top + 0.06 : flight.groundY;
    const supportY = lowerMetric ? lowerMetric.top - 0.35 : -0.6;
    const arc = rho * Math.abs(flight.to - flight.from);
    // 踏面沿行进方向互相交叠：整段读作实心石梯，而不是一排悬空立柱。
    const count = Math.max(6, Math.round(arc / 0.78));
    const sweep = Math.sign(flight.to - flight.from);
    for (let i = 0; i < count; i++, stepIndex++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const phi = THREE.MathUtils.lerp(flight.from, flight.to, t);
      const treadY = THREE.MathUtils.lerp(yBottom, yTop, t);
      const height = treadY - supportY;
      const step = mesh(
        stepGeometry,
        materials.pilgrimageStone,
        `pilgrimage-step-${stepIndex}`,
        0.02
      );
      step.scale.y = height;
      step.position.set(
        rho * Math.sin(phi),
        supportY + height / 2,
        rho * Math.cos(phi)
      );
      // 踏步长边垂直于行进方向（沿圆弧切向行走）
      step.rotation.y = Math.atan2(Math.cos(phi) * sweep, -Math.sin(phi) * sweep);
      pilgrimageRamp.add(step);
    }
    // 梯口平台：横跨台地边缘，把梯段端头接上本层台面。
    const landing = mesh(
      new THREE.BoxGeometry(2.7, 0.55, 2.8),
      materials.pilgrimageStone,
      `pilgrimage-landing-${terraceIndex}`,
      0.04
    );
    landing.position.set(
      (rho - 1.15) * Math.sin(flight.to),
      yTop - 0.22,
      (rho - 1.15) * Math.cos(flight.to)
    );
    landing.rotation.y = flight.to;
    pilgrimageRamp.add(landing);
  }
  // 顶端平桥：从末段梯口跨越顶层台面；末端收窄成门槛条，穿过瓮城双塔
  // 直抵棕色木门廊柱前（门廊柱 z = 15.72×0.4 ≈ 6.29，门槛 ≈ Y 12.0）。
  const causewayFrom = new THREE.Vector2(
    (metrics[0].radius - 0.35) * Math.sin(-1.4),
    (metrics[0].radius - 0.35) * Math.cos(-1.4)
  );
  const causewayTo = new THREE.Vector2(0, 9.9); // +2 跟随 townOffsetZ=0 后正门 z=8
  const causewayYaw = Math.atan2(
    causewayTo.x - causewayFrom.x,
    causewayTo.y - causewayFrom.y
  );
  const causewayLength = causewayFrom.distanceTo(causewayTo);
  const causewayCount = Math.round(causewayLength / 1.9);
  const causewayGeometry = new THREE.BoxGeometry(1.9, 0.55, 2.05);
  for (let i = 0; i < causewayCount; i++, stepIndex++) {
    const t = causewayCount === 1 ? 0 : i / (causewayCount - 1);
    const slab = mesh(
      causewayGeometry,
      materials.pilgrimageStone,
      `pilgrimage-step-${stepIndex}`,
      0.025
    );
    slab.position.set(
      THREE.MathUtils.lerp(causewayFrom.x, causewayTo.x, t),
      metrics[0].top + 0.02,
      THREE.MathUtils.lerp(causewayFrom.y, causewayTo.y, t)
    );
    slab.rotation.y = causewayYaw;
    pilgrimageRamp.add(slab);
  }
  // 门槛条：宽 1.3 < 瓮城双塔喉道（±0.68），把平桥接到门廊柱跟前。
  const threshold = mesh(
    new THREE.BoxGeometry(1.3, 0.55, 1.5),
    materials.pilgrimageStone,
    `pilgrimage-step-${stepIndex++}`,
    0.025
  );
  threshold.position.set(0, metrics[0].top + 0.02, 9.05);
  pilgrimageRamp.add(threshold);
  terrainSystem.add(pilgrimageRamp);

  terrainSystem.userData.contourLayerCount = normalized.layerCount;
  terrainSystem.userData.terraceMetrics = metrics;
  terrainSystem.userData.rampartSegmentCount = 0;
  terrainSystem.userData.buttressCount = 0;
  terrainSystem.userData.watchtowerCount = 0;
  terrainSystem.userData.watchtowerCrenelCount = 0;
  terrainSystem.userData.pilgrimageStepCount = stepIndex;
  terrainSystem.userData.pilgrimageFlightCount = flights.length;
  terrainSystem.userData.rampTurnCount = flights.length - 1;
  terrainSystem.userData.waterfallNotchLayers = normalized.notchedLayers;
  terrainSystem.userData.terrainLayerCount = metrics.length;
  terrainSystem.userData.exclusiveTerrainLayers = true;
  return terrainSystem;
}

/**
 * Townscaper 规则小镇的独立装配：创建全套 toon 材质与 gradientMap，按
 * `CITADEL.townBaseY` 摆好各 level 组（未做水墨描边——由调用方在装配
 * 完成后统一 `applyInkOutlines`，避免重复描边）。
 *
 * `buildOdysseyCitadel` 与 Townscaper 编辑器（townscaper.html）共用本函数，
 * 保证编辑器预览与主场景渲染走同一份材质/规则代码。
 *
 * @param {typeof CITADEL_TOWN_SPEC} spec 逐层 ASCII 布局
 * @param {{
 *   random?: () => number,
 *   materials?: Record<string, THREE.Material>, // 传入则复用，不再自建
 *   gradientMap?: THREE.DataTexture,
 *   baseY?: number, // 镇体基座高度（默认 CITADEL.townBaseY；地形改层高后跟随顶层台面）
 * }} [options]
 * @returns {{
 *   group: THREE.Group,      // 全部 level 组的容器（y 已就位）
 *   levels: THREE.Group[],   // 未归物理层的 level 组
 *   stats: object,
 *   materials: Record<string, THREE.Material>,
 *   gradientMap: THREE.DataTexture,
 * }}
 */
export function buildCitadelTownAssembly(spec, options = {}) {
  const random = options.random ?? lcg(20260808);
  const gradientMap = options.gradientMap ?? makeThreeStepGradient();

  const materials = options.materials ?? {
    cliff: makeToon(PALETTE.cliff, gradientMap),
    stone: makeToon(PALETTE.stone, gradientMap),
    weatherStone: makeToon(PALETTE.weatherStone, gradientMap),
    plazaStone: makeToon(0xbfc9cd, gradientMap), // 石板广场铺装
    ink: makeToon(PALETTE.ink, gradientMap),
    wood: makeToon(PALETTE.wood, gradientMap),
    gold: makeToon(PALETTE.domeIvory, gradientMap),
    goldShade: makeToon(PALETTE.domeShade, gradientMap),
    sand: makeToon(PALETTE.sandStone, gradientMap),
    brickPale: makeToon(PALETTE.paleBrick, gradientMap),
    roofTile: makeToon(PALETTE.roofTile, gradientMap),
    water: makeToon(PALETTE.water, gradientMap),
    foliageDark: makeToon(PALETTE.foliageDark, gradientMap),
    foliageLight: makeToon(PALETTE.foliageLight, gradientMap),
    bark: makeToon(PALETTE.bark, gradientMap),
    contour: makeToon(PALETTE.contour, gradientMap),
    pilgrimageStone: makeToon(PALETTE.pilgrimageStone, gradientMap),
  };
  // 瓦片/户色不要开共享 vertexColors：合并时没色属性的屋脊/尖顶/栏杆会整批变黑。
  if (materials.water) {
    materials.water.transparent = true;
    materials.water.opacity = 0.82;
  }
  // 窗口昼夜材质（可被 options 注入共享实例）
  if (!materials.windowDark) materials.windowDark = makeToon(PALETTE.ink, gradientMap);
  if (!materials.windowLit) materials.windowLit = makeWindowLitMat(gradientMap);

  const town = buildCitadelTown(spec, {
    leanDecor: options.leanDecor === true,
    mesh,
    materials: {
      // Townscaper 15 色调色板：字符 "0"–"9A"–"E" → 基色材质（含旧 4 色兼容键）
      ...buildCitadelPaletteMaterials(gradientMap),
      gold: materials.gold,
      wood: materials.wood,
      ink: materials.ink,
      roofTile: materials.roofTile,
      water: materials.water,
      steepleStone: materials.stone, // 教堂尖塔白石塔身
      foliageDark: materials.foliageDark,
      foliageLight: materials.foliageLight,
      plazaStone: materials.plazaStone ?? materials.weatherStone, // 石板广场
      // 建筑构件统一深色盘：檐口线/墙裙/窗台窗楣/阳台栏杆/屋脊瓦/山墙圆窗/风向标
      trim: materials.trim ?? makeToon(0x333a42, gradientMap),
      iron: materials.iron ?? makeToon(0x1a1b1e, gradientMap),
      windowDark: materials.windowDark,
      windowLit: materials.windowLit,
      // 明度微抖：shade(char, ix, iz) 按格坐标哈希到 5 档明度材质（缓存）
      shade: makeCitadelShadeMaterialFactory(gradientMap),
    },
    shrubMaterials: materials,
    random,
    archWindowGeometry: makeArchedWindowGeometry(),
    buildHalfDome,
    buildShrub: buildCitadelShrub,
    buildTopiary: buildCitadelRoundTopiary,
    finialHeight: CITADEL.finialHeight,
  });

  const group = new THREE.Group();
  group.name = "citadel-town-assembly";
  const baseY = options.baseY ?? CITADEL.townBaseY;
  town.levels.forEach((levelGroup) => {
    levelGroup.position.y = baseY;
    levelGroup.position.z = CITADEL.townOffsetZ; // 正门对齐补偿（见 CITADEL 注释）
    group.add(levelGroup);
  });

  return { group, levels: town.levels, stats: town.stats, materials, gradientMap };
}

/** 五座台地 × 每台地五层城堡的统一装配。台地 1 为最高层和共享中心。 */
function buildCitadelTerraceTownAssembly(spec, contourSpec, options = {}) {
  const layout = normalizeCitadelTerraceLayout(
    spec,
    options.floors ?? spec?.floors ?? CITADEL_CASTLE_FLOORS
  );
  const metrics = citadelTerraceMetrics(contourSpec);
  const group = new THREE.Group();
  group.name = "citadel-terrace-town-assembly";
  const levels = [];
  const terraceLevels = [];
  const stats = {
    cellCount: 0,
    windowCount: 0,
    crenelCount: 0,
    domeCount: 0,
    towerCount: 0,
    archCount: 0,
    shrubCount: 0,
    fenceCount: 0,
    roofCount: 0,
    canalCount: 0,
    waterGateCount: 0,
    doorCount: 0,
    steepleCount: 0,
    gardenCount: 0,
    plazaCount: 0,
    boatCount: 0,
    birdCount: 0,
    corniceCount: 0,
    plinthCount: 0,
    balconyCount: 0,
    pilasterCount: 0,
    arcadeColumnCount: 0,
    ridgeCount: 0,
    eaveCount: 0,
    oculusCount: 0,
    supportCount: 0, // 悬空支撑支架（flying buildings）
    gate: null,
    gates: [],
  };

  layout.terraces.forEach((terrace, terraceIndex) => {
    const assembly = buildCitadelTownAssembly(
      {
        cellSize: CITADEL_TOWN_SPEC.cellSize,
        cellHeight: CITADEL_TOWN_SPEC.cellHeight,
        gridSize: layout.gridSize,
        levels: terrace.levels,
      },
      {
        ...options,
        leanDecor: options.leanDecor === true || options.baseYOverride !== undefined,
        // 无台地模式（运河交汇古堡）：镇体基座 = 堤岸方框水面平台抬升
        baseY: options.baseYOverride ?? metrics[terraceIndex].top - 0.06,
      }
    );
    terraceLevels[terraceIndex] = [];
    assembly.levels.forEach((level, floorIndex) => {
      level.name = `town-terrace-${terraceIndex}-level-${floorIndex}`;
      level.userData.terraceIndex = terraceIndex;
      level.userData.terraceNumber = terraceIndex + 1;
      level.userData.castleFloor = floorIndex;
      level.traverse((object) => {
        if (object.userData?.cell) {
          object.userData.cell.terraceIndex = terraceIndex;
          object.userData.cell.castleFloor = object.userData.cell.iy;
        }
      });
      group.add(level);
      levels.push(level);
      terraceLevels[terraceIndex].push(level);
    });
    for (const [key, value] of Object.entries(assembly.stats)) {
      if (typeof value === "number" && typeof stats[key] === "number") stats[key] += value;
    }
    if (assembly.stats.gate) {
      const gate = { ...assembly.stats.gate, terraceIndex };
      stats.gates.push(gate);
      if (!stats.gate || terraceIndex === 0) stats.gate = gate;
    }
  });

  return {
    group,
    levels,
    terraceLevels,
    stats,
    layout,
    baseYs: metrics.map((metric) =>
      options.baseYOverride !== undefined ? options.baseYOverride : metric.top - 0.06
    ),
    materials: options.materials,
    gradientMap: options.gradientMap,
  };
}

function localSphericalGroundY(x, z, anchor) {
  const r2 = x * x + z * z;
  const planetCenterY = -(anchor.groundR - anchor.radialEmbed);
  const dy = Math.sqrt(Math.max(0, anchor.groundR * anchor.groundR - r2));
  return planetCenterY + dy;
}

function buildCitadelTerrainObjects(placements, contourSpec, anchor = null) {
  const normalizedPlacements = normalizeCitadelTerrainObjects(placements);
  const metrics = citadelTerraceMetrics(contourSpec);
  const group = new THREE.Group();
  group.name = "citadel-terrain-objects";
  for (const placement of normalizedPlacements) {
    if (!citadelTerrainPointSupported(
      contourSpec,
      placement.x,
      placement.z,
      placement.terraceIndex
    )) continue;
    const object = placement.type === "watchtower"
      ? createCitadelWatchtower({ seed: placement.id.length })
      : placement.type === "trojanHorse"
        ? createCitadelTrojanHorse({ seed: placement.id.length, scale: placement.scale })
        : createCitadelElderTree({ seed: placement.id.length, scale: placement.scale });
    if (placement.type === "watchtower") {
      object.scale.setScalar(placement.scale);
      object.userData.collideRadius *= placement.scale;
      object.userData.height *= placement.scale;
    } else if (placement.type === "trojanHorse") {
      object.scale.setScalar(placement.scale);
    }
    object.name = `citadel-terrain-object-${placement.id}`;
    const topY = metrics[placement.terraceIndex].top;
    let baseY = topY;
    if (
      placement.grounded
      && anchor?.dir?.isVector3
      && Number.isFinite(anchor.groundR)
      && Number.isFinite(anchor.radialEmbed)
    ) {
      baseY = localSphericalGroundY(placement.x, placement.z, anchor);
    }
    object.position.set(placement.x, baseY, placement.z);
    if (anchor?.dir?.isVector3 && Number.isFinite(anchor.groundR)) {
      const planetCenterY = -(anchor.groundR - anchor.radialEmbed);
      const up = new THREE.Vector3(
        placement.x,
        baseY - planetCenterY,
        placement.z
      ).normalize();
      const tiltQ = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        up
      );
      const yawQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        placement.yaw
      );
      object.quaternion.copy(tiltQ).multiply(yawQ);
    } else {
      object.rotation.y = placement.yaw;
    }
    object.userData.terrainObjectId = placement.id;
    object.userData.terrainObjectType = placement.type;
    object.userData.terraceIndex = placement.terraceIndex;
    group.add(object);
  }
  group.userData.placements = normalizedPlacements;
  group.userData.objectCount = group.children.length;
  return group;
}

/**
 * 运河交汇无台地模式：放一块看不见的厚垫，名字仍叫 contour-step-0，
 * 这样 3D 直编辑的 getObjectByName / isCitadelTerrace 拾取和高山圣城走同一条路。
 * 用扁盒子而不是无限薄平面，斜视角也能点到空地基。
 */
function ensureSkipOuterTerrainEditPad(castleContainer) {
  const lift = castleContainer.userData.townBaseLift ?? 0.6;
  let terrain = castleContainer.userData.outerTerrainSystem;
  if (!terrain) {
    terrain = new THREE.Group();
    terrain.name = "citadel-skip-outer-terrain";
    castleContainer.add(terrain);
    castleContainer.userData.outerTerrainSystem = terrain;
  }
  let pad = terrain.getObjectByName("contour-step-0");
  if (!pad) {
    pad = new THREE.Mesh(
      new THREE.BoxGeometry(52, 0.28, 44),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    pad.name = "contour-step-0";
    terrain.add(pad);
  }
  pad.position.set(0, lift - 0.14, 0);
  pad.rotation.set(0, 0, 0);
  pad.userData.isCitadelTerrace = true;
  pad.userData.terraceIndex = 0;
  pad.visible = true;
  return pad;
}

/**
 * Build the complete landmark without mutating global state.
 *
 * @param {{
 *   dir?: THREE.Vector3,
 *   faceDir?: THREE.Vector3,
 *   planetRadius?: number,
 *   groundRadius?: number,
 *   seed?: number,
 *   place?: boolean,
 *   spec?: typeof CITADEL_TOWN_SPEC, // 小镇布局覆盖（编辑器存档）；缺省用内置 SPEC
 *   contour?: typeof CITADEL.contourTerrain, // 台地参数覆盖（地形编辑器存档）
 *   terrainObjects?: object[], // 瞭望塔/参天树地貌对象
 *   skipOuterTerrain?: boolean, // 不建外围台地/石阶/地貌对象（运河交汇古堡：堤岸方框即地基）
 * }} [options]
 * @returns {THREE.Group & {update(dt:number, t:number):void}}
 */
export function buildOdysseyCitadel(options = {}) {
  const random = lcg(options.seed ?? 20260808);
  const castleFloors = Number.isFinite(options.floors)
    ? Math.min(20, Math.max(1, Math.round(options.floors)))
    : (options.spec?.floors ?? CITADEL_CASTLE_FLOORS);
  const townSpec = normalizeCitadelTerraceLayout(
    options.spec ?? CITADEL_TOWN_SPEC,
    castleFloors
  );
  const contourSpec = normalizeCitadelTerrain(options.contour ?? CITADEL.contourTerrain);
  const skipOuterTerrain = options.skipOuterTerrain === true;
  const townBaseY = contourTownBaseY(contourSpec);
  const planetRadius = Number.isFinite(options.planetRadius) ? options.planetRadius : 160;
  const gradientMap = makeThreeStepGradient();

  const materials = {
    cliff: makeToon(PALETTE.cliff, gradientMap),
    stone: makeToon(PALETTE.stone, gradientMap),
    weatherStone: makeToon(PALETTE.weatherStone, gradientMap),
    plazaStone: makeToon(0xbfc9cd, gradientMap), // 石板广场铺装
    ink: makeToon(PALETTE.ink, gradientMap),
    wood: makeToon(PALETTE.wood, gradientMap),
    gold: makeToon(PALETTE.domeIvory, gradientMap),
    goldShade: makeToon(PALETTE.domeShade, gradientMap),
    sand: makeToon(PALETTE.sandStone, gradientMap),
    brickPale: makeToon(PALETTE.paleBrick, gradientMap),
    roofTile: makeToon(PALETTE.roofTile, gradientMap),
    water: makeToon(PALETTE.water, gradientMap),
    foliageDark: makeToon(PALETTE.foliageDark, gradientMap),
    foliageLight: makeToon(PALETTE.foliageLight, gradientMap),
    bark: makeToon(PALETTE.bark, gradientMap),
    contour: makeToon(PALETTE.contour, gradientMap),
    pilgrimageStone: makeToon(PALETTE.pilgrimageStone, gradientMap),
  };

  const castleContainer = new THREE.Group();
  // 多实例：名字带实例 id，避免 getObjectByName("castleContainer") 在双城堡时歧义。
  // 默认实例保留旧名兼容既有引用（e2e / 编辑器）。
  castleContainer.name = options.instanceId
    ? `castleContainer-${options.instanceId}`
    : "castleContainer";

  const citadelAssembly = new THREE.Group();
  citadelAssembly.name = "odyssey-citadel-five-layer-assembly";

  // 物理层组数跟随城堡层数（高山 5 层 / 运河交汇古堡 12 层）
  const layerCount = Math.max(castleFloors, 5);
  const layers = Array.from({ length: layerCount }, (_, index) => {
    const layer = new THREE.Group();
    layer.name = `citadel-layer-${index}`;
    layer.userData.layerIndex = index;
    return layer;
  });

  // --------------------------------------------------------------------------
  // Layer 0 — primordial rocky understructure
  // 无台地模式（运河交汇古堡）：堤岸方框即地基，跳过断崖岩石——
  // 否则岩石按高山台地高度（centerY 11.2）悬浮在方框平台上方。
  // --------------------------------------------------------------------------
  if (!skipOuterTerrain) {
    const rockGeometry = new THREE.IcosahedronGeometry(CITADEL.layer0.rockRadius, 0);
    for (let i = 0; i < CITADEL.layer0.rockCount; i++) {
      const rock = mesh(rockGeometry, materials.cliff, `primordial-cliff-rock-${i}`);
      const angle = (i / CITADEL.layer0.rockCount) * Math.PI * 2 + (random() - 0.5) * 0.45;
      const spread = i === 0 ? 0 : 2.2 + random() * 1.5;
      rock.position.set(
        Math.cos(angle) * spread,
        CITADEL.layer0.centerY + (random() - 0.5) * 0.8,
        Math.sin(angle) * spread
      );
      rock.scale.set(
        1.0 + random() * 0.4,
        0.8 + random() * 0.3,
        1.0 + random() * 0.4
      );
      rock.rotation.y = random() * Math.PI * 2;
      layers[0].add(rock);
    }
  }

  // --------------------------------------------------------------------------
  // Layers 1–4 —— Townscaper 式规则生成小镇（citadelTown.js）
  // 布局只由 CITADEL_TOWN_SPEC 的逐层 ASCII 决定；体块/穹顶/城垛/拱窗/
  // 悬空拱/塔楼金顶/屋顶花园/棕色正门全部由邻接规则自动生成。
  // --------------------------------------------------------------------------
  // 复用与编辑器（townscaper.html）相同的装配入口；random 已被 Layer 0
  // 断崖消耗过，此处继续同一序列，保证渲染结果与重构前逐位一致。
  const townAssembly = buildCitadelTerraceTownAssembly(townSpec, contourSpec, {
    floors: castleFloors,
    leanDecor: skipOuterTerrain,
    random,
    materials,
    gradientMap,
    // 无台地模式（运河交汇古堡）：镇体基座 = 堤岸方框水面平台抬升。
    // 不传则回落台地 metrics 顶（≈7.5 局部），城堡会悬空在平台上方。
    baseYOverride: skipOuterTerrain ? options.townBaseLift ?? 0.6 : undefined,
  });
  // 每个台地都有独立的城堡 1–5 层；同楼层归入同一物理层级组。
  townAssembly.terraceLevels.forEach((terrace, terraceIndex) => {
    terrace.forEach((levelGroup, floorIndex) => {
      layers[floorIndex].add(levelGroup);
    });
  });

  for (const layer of layers) citadelAssembly.add(layer);
  // 运河交汇：去掉描边，靠外露面融合 + 顶点渐变协调邻接
  const mainOutlinedSurfaceCount = applyInkOutlines(citadelAssembly, !skipOuterTerrain);

  const outerTerrainSystem = skipOuterTerrain
    ? new THREE.Group()
    : buildOuterCitadelTerrain(materials, contourSpec);
  outerTerrainSystem.name = skipOuterTerrain
    ? "citadel-skip-outer-terrain"
    : "citadel-outer-terrain-system";
  const terrainOutlinedSurfaceCount = skipOuterTerrain
    ? 0
    : applyInkOutlines(outerTerrainSystem);
  castleContainer.add(outerTerrainSystem);
  castleContainer.add(citadelAssembly);
  castleContainer.userData.skipOuterTerrain = skipOuterTerrain;
  castleContainer.userData.townBaseLift = options.townBaseLift ?? 0.6;
  castleContainer.userData.outerTerrainSystem = outerTerrainSystem;
  if (skipOuterTerrain) ensureSkipOuterTerrainEditPad(castleContainer);

  // 运河交汇：首次入场 plop（软弹一下），其余帧静态。
  let plopT = skipOuterTerrain ? 0 : 1;
  const update = (dt = 0.016) => {
    if (plopT >= 0.32) return;
    plopT += Math.max(0.008, Number(dt) || 0.016);
    const u = Math.min(1, plopT / 0.32);
    const bounce = 1 + Math.sin(u * Math.PI) * 0.055 * (1 - u);
    citadelAssembly.scale.setScalar(bounce);
    if (u >= 1) citadelAssembly.scale.setScalar(1);
  };
  castleContainer.update = update;
  castleContainer.userData.update = update;

  if (options.place !== false && options.dir) {
    _dir.copy(options.dir).normalize();
    _up.copy(_dir);
    if (options.faceDir) {
      _forward.copy(options.faceDir).normalize();
      _forward.addScaledVector(_up, -_forward.dot(_up));
      if (_forward.lengthSq() < 1e-8) _forward.set(0, 0, 1);
      _forward.normalize();
    } else {
      _forward.set(0, 0, 1).addScaledVector(_up, -_up.z);
      if (_forward.lengthSq() < 1e-8) _forward.set(1, 0, 0);
      _forward.normalize();
    }
    _right.crossVectors(_up, _forward).normalize();
    _basis.makeBasis(_right, _up, _forward);
    castleContainer.quaternion.setFromRotationMatrix(_basis);

    const groundRadius = Number.isFinite(options.groundRadius)
      ? options.groundRadius
      : planetRadius + canyonOffsetDir(_dir);
    const curvatureDrop = citadelCurvatureDrop(groundRadius, contourSpec);
    // 城堡相对护城河水面上浮并整体下沉 CITADEL_SINK，使台地外缘/前方绿地浸入水面下
    const radialEmbed = CITADEL.groundEmbed + curvatureDrop + CITADEL_SINK;
    castleContainer.position.copy(_dir).multiplyScalar(groundRadius - radialEmbed);
    castleContainer.userData.anchor = {
      dir: _dir.clone(),
      groundR: groundRadius,
      curvatureDrop,
      radialEmbed,
    };
    castleContainer.userData.curvatureDrop = curvatureDrop;
  }

  const terrainObjects = skipOuterTerrain
    ? new THREE.Group()
    : buildCitadelTerrainObjects(
      options.terrainObjects,
      contourSpec,
      castleContainer.userData.anchor
    );
  terrainObjects.name = skipOuterTerrain
    ? "citadel-skip-terrain-objects"
    : "citadel-terrain-objects";
  castleContainer.add(terrainObjects);

  castleContainer.userData.kind = "odyssey-citadel";
  castleContainer.userData.instanceId = options.instanceId ?? null; // 多城堡实例标识（null=高山圣城默认）
  castleContainer.userData.floors = castleFloors; // 城堡层数（高山 5 / 运河古堡 12）
  castleContainer.userData.skipOuterTerrain = skipOuterTerrain; // 无台地模式（堤岸方框即地基）
  castleContainer.userData.townBaseLift = options.townBaseLift ?? 0.6;
  castleContainer.userData.spec = CITADEL;
  castleContainer.userData.contourSpec = contourSpec;
  castleContainer.userData.townBaseY = townBaseY;
  // 无台地模式：所有台地基座统一 = 方框水面平台抬升
  castleContainer.userData.townBaseYs = skipOuterTerrain
    ? townAssembly.baseYs.map(() => options.townBaseLift ?? 0.6)
    : townAssembly.baseYs;
  castleContainer.userData.terrainMaterials = {
    contour: materials.contour,
    pilgrimageStone: materials.pilgrimageStone,
  };
  castleContainer.userData.layers = layers;
  castleContainer.userData.mainCastle = citadelAssembly;
  castleContainer.userData.outerTerrainSystem = outerTerrainSystem;
  castleContainer.userData.terrainObjects = terrainObjects;
  castleContainer.userData.terrainObjectsSpec = terrainObjects.userData?.placements ?? [];
  castleContainer.userData.townSpec = townAssembly.layout;
  castleContainer.userData.townStats = townAssembly.stats;
  castleContainer.userData.mainOutlinedSurfaceCount = mainOutlinedSurfaceCount;
  castleContainer.userData.terrainOutlinedSurfaceCount = terrainOutlinedSurfaceCount;
  castleContainer.userData.outlinedSurfaceCount =
    mainOutlinedSurfaceCount + terrainOutlinedSurfaceCount;
  castleContainer.userData.gradientMap = townAssembly.gradientMap;
  // 性能：Townscaper 小镇按材质静态合并（窗口/台地拾取/塔树拾取跳过；
  // cell 面映射供 3D 直编辑）。在窗口灯绑定前执行，合并不动窗口网格。
  mergeCitadelTownStatic(castleContainer);
  // 拱窗夜景：收集 town-window 并绑定昼夜材质
  refreshCitadelWindowLights(castleContainer);

  return castleContainer;
}

/** 释放一组 town-level 组的几何与材质（描边材质在 toon.js 全局缓存，不动）。 */
function disposeTownLevels(levelGroups) {
  const geometries = new Set();
  const materials = new Set();
  for (const group of levelGroups) {
    group.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
  }
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}

/**
 * 游戏内热重建：拆掉 castleContainer 物理层里的旧小镇，按新布局重新生成
 * （断崖基岩、外围台地/石阶/瀑布不动）。供圣城搭建面板（citadelEditorPanel）
 * 在编辑时即时刷新场景。
 *
 * @param {THREE.Group} castleContainer buildOdysseyCitadel 的返回值
 * @param {typeof CITADEL_TOWN_SPEC} spec 新布局
 * @returns {object|null} 新 stats；非圣城容器返回 null
 */
export function rebuildCitadelTown(castleContainer, spec) {
  const layers = castleContainer?.userData?.layers;
  if (!layers?.length) return null;

  const oldLevels = [];
  for (const layer of layers) {
    for (const child of [...layer.children]) {
      if (
        child.name?.startsWith("town-level-") ||
        child.name?.startsWith("town-terrace-")
      ) {
        layer.remove(child);
        oldLevels.push(child);
      }
    }
  }
  disposeTownLevels(oldLevels);

  // 新装配自带材质/gradientMap：旧小镇材质随旧组释放，断崖与外围地势的
  // 材质实例（cliff/contour/pilgrimageStone）仍归初始构建所有，不受影响。
  // 基座高度跟随当前台地参数（地形编辑器可能改过层高）。
  const assembly = buildCitadelTerraceTownAssembly(
    spec,
    castleContainer.userData.contourSpec ?? CITADEL.contourTerrain,
    {
      floors: castleContainer.userData.floors ?? CITADEL_CASTLE_FLOORS,
      // 无台地模式：基座保持方框水面平台抬升（防热重建后城堡悬空）
      baseYOverride: castleContainer.userData.skipOuterTerrain
        ? castleContainer.userData.townBaseLift ?? 0.6
        : undefined,
      leanDecor: castleContainer.userData.skipOuterTerrain === true,
    }
  );
  applyInkOutlines(assembly.group, !castleContainer.userData.skipOuterTerrain);
  assembly.terraceLevels.forEach((terrace) => {
    terrace.forEach((levelGroup, floorIndex) => {
      layers[floorIndex].add(levelGroup);
    });
  });
  // 热重建后再次静态合并（幂等：先清旧合并网格）；窗口/拾取依赖同上
  mergeCitadelTownStatic(castleContainer);
  castleContainer.userData.townStats = assembly.stats;
  castleContainer.userData.townSpec = assembly.layout;
  if (castleContainer.userData.skipOuterTerrain) {
    const lift = castleContainer.userData.townBaseLift ?? 0.6;
    const n = Math.max(1, assembly.baseYs?.length ?? 1);
    castleContainer.userData.townBaseY = lift;
    castleContainer.userData.townBaseYs = Array.from({ length: n }, () => lift);
    ensureSkipOuterTerrainEditPad(castleContainer);
  } else {
    castleContainer.userData.townBaseYs = assembly.baseYs;
  }
  // 布局热重建后窗口列表与夜灯材质需刷新
  castleContainer.userData.gradientMap =
    castleContainer.userData.gradientMap ?? assembly.gradientMap ?? makeThreeStepGradient();
  refreshCitadelWindowLights(castleContainer);
  return assembly.stats;
}

/**
 * 台地-建筑放置有效性闭环：台地半径/层高缩放后，把不再被新台地支撑的
 * 建筑格从镇体布局中剔除并重建，保证「建筑单元始终可放置」。
 * 供地形编辑器 onTerrainChange 调用（radius 滑杆缩小时自动裁剪悬空格）。
 *
 * @param {THREE.Group} castleContainer buildOdysseyCitadel 的返回值
 * @param {typeof CITADEL.contourTerrain} contourSpec 新台地参数
 * @param {object} [spec] 当前镇体布局（缺省用 castleContainer.userData.townSpec）
 * @returns {{ trimmed: number, stats: object|null }}
 */
export function trimCitadelTownToTerrain(castleContainer, contourSpec, spec = null) {
  // 无台地模式（运河交汇古堡）：方框内全部可放置，不裁剪
  if (castleContainer?.userData?.skipOuterTerrain) {
    return { trimmed: 0, stats: castleContainer?.userData?.townStats ?? null };
  }
  const contour = normalizeCitadelTerrain(contourSpec);
  const current = normalizeCitadelTerraceLayout(
    spec ?? castleContainer?.userData?.townSpec ?? CITADEL_TOWN_SPEC,
    castleContainer?.userData?.floors ?? CITADEL_CASTLE_FLOORS
  );
  let totalTrimmed = 0;
  const trimmedTerraces = current.terraces.map((terrace, terraceIndex) => {
    const result = trimCitadelGridToTerrain(terrace.levels, (ix, iz) => {
      const c = citadelGridCellCenter(ix, 0, iz);
      return citadelTerrainCellSupported(
        contour,
        c.x,
        c.z,
        terraceIndex,
        CITADEL_TOWN_SPEC.cellSize * 0.5
      );
    });
    totalTrimmed += result.trimmed;
    return { terraceIndex, levels: result.levels };
  });
  if (!totalTrimmed) return { trimmed: 0, stats: castleContainer?.userData?.townStats ?? null };
  const nextSpec = { ...current, terraces: trimmedTerraces };
  const stats = rebuildCitadelTown(castleContainer, nextSpec);
  castleContainer.userData.townSpec = nextSpec;
  return { trimmed: totalTrimmed, stats };
}

/**
 * 游戏内地形热重建：按新参数整体替换外围台地/石阶（断崖基岩与小镇体块
 * 不动），并把镇体基座抬放到新顶层台面。供圣城搭建面板的「地形地貌」
 * 编辑器即时刷新场景。
 *
 * @param {THREE.Group} castleContainer buildOdysseyCitadel 的返回值
 * @param {typeof CITADEL.contourTerrain} contourSpec 新台地参数
 * @returns {THREE.Group|null} 新外围地势系统；非圣城容器返回 null
 */
export function rebuildCitadelTerrain(castleContainer, contourSpec) {
  // 无台地模式（运河交汇古堡）：不重建外围台地，只更新镇体基座
  if (castleContainer?.userData?.skipOuterTerrain) {
    const baseY = castleContainer.userData.townBaseLift ?? 0.6;
    castleContainer.userData.townBaseY = baseY;
    const n = Math.max(1, castleContainer.userData.townBaseYs?.length ?? 1);
    castleContainer.userData.townBaseYs = Array.from({ length: n }, () => baseY);
    ensureSkipOuterTerrainEditPad(castleContainer);
    return castleContainer.userData.outerTerrainSystem ?? null;
  }
  const old = castleContainer?.userData?.outerTerrainSystem;
  if (!old) return null;

  // 只释放几何：contour / pilgrimageStone 材质归初始构建共享，不能 dispose
  const geometries = new Set();
  old.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    if (o.geometry) geometries.add(o.geometry);
  });
  castleContainer.remove(old);
  for (const g of geometries) g.dispose();

  const normalized = normalizeCitadelTerrain(contourSpec);
  const system = buildOuterCitadelTerrain(
    castleContainer.userData.terrainMaterials,
    normalized
  );
  const outlined = applyInkOutlines(system);
  castleContainer.add(system);
  castleContainer.userData.outerTerrainSystem = system;
  castleContainer.userData.contourSpec = normalized;

  // 台地半径改变会改变球面弦高。整座城堡、五级台地、石阶和地貌对象
  // 共用 castleContainer，因此只需更新容器径向位置即可整体同步下沉。
  const anchor = castleContainer.userData.anchor;
  if (anchor?.dir?.isVector3 && Number.isFinite(anchor.groundR)) {
    const curvatureDrop = citadelCurvatureDrop(anchor.groundR, normalized);
    const radialEmbed = CITADEL.groundEmbed + curvatureDrop + CITADEL_SINK;
    castleContainer.position.copy(anchor.dir).multiplyScalar(anchor.groundR - radialEmbed);
    anchor.curvatureDrop = curvatureDrop;
    anchor.radialEmbed = radialEmbed;
    castleContainer.userData.curvatureDrop = curvatureDrop;
  }
  castleContainer.userData.terrainOutlinedSurfaceCount = outlined;
  castleContainer.userData.outlinedSurfaceCount =
    castleContainer.userData.mainOutlinedSurfaceCount + outlined;

  // 镇体基座跟随新顶层台面
  const baseYs = citadelTerraceMetrics(normalized).map((metric) => metric.top - 0.06);
  const baseY = baseYs[0];
  castleContainer.userData.townBaseY = baseY;
  castleContainer.userData.townBaseYs = baseYs;
  castleContainer.traverse((o) => {
    const match = /^town-terrace-(\d+)-level-(\d+)$/.exec(o.name || "");
    if (match) o.position.y = baseYs[Number(match[1])] ?? baseY;
    else if (o.name?.startsWith("town-level-")) o.position.y = baseY;
  });
  rebuildCitadelTerrainObjects(
    castleContainer,
    castleContainer.userData.terrainObjectsSpec ?? []
  );
  return system;
}

/** Hot-rebuild the two editable terrain-object types without touching town cells. */
export function rebuildCitadelTerrainObjects(castleContainer, placements) {
  if (!castleContainer?.userData?.contourSpec) return null;
  const old = castleContainer.userData.terrainObjects;
  if (old) {
    const geometries = new Set();
    const materials = new Set();
    old.traverse((object) => {
      if (!object.isMesh || object.userData.isOutline) return;
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    castleContainer.remove(old);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  const normalized = normalizeCitadelTerrainObjects(placements);
  const group = buildCitadelTerrainObjects(
    normalized,
    castleContainer.userData.contourSpec,
    castleContainer.userData.anchor
  );
  castleContainer.add(group);
  castleContainer.userData.terrainObjects = group;
  castleContainer.userData.terrainObjectsSpec = normalized;
  return group;
}

/**
 * 当前台地的土坡支撑探测。台地 1 接受中心圆盘内的城堡，台地 2–5
 * 只接受各自暴露环带内的城堡；瀑布缺口默认不可放，但层叠梯湖椭圆可放。
 * 返回 0 表示该台地城堡第 1 层可落地，-1 表示无承重面。
 *
 * @param {THREE.Group} castleContainer
 * @param {number} localX 小镇局部 x（level 组坐标系）
 * @param {number} localZ 小镇局部 z
 * @param {number} cellHeight 每层层高（默认 2；本参数保留以兼容旧调用）
 * @param {number} terraceIndex 台地索引（0 = 台地 1 / 最高）
 * @returns {number} 0 = 可落城堡第 1 层；-1 = 无支撑
 */
export function terrainSupportLevel(
  castleContainer,
  localX,
  localZ,
  cellHeight = 2,
  terraceIndex = 0
) {
  const contour = castleContainer?.userData?.contourSpec;
  if (!contour) return -1;
  return citadelTerrainPointSupported(contour, localX, localZ, terraceIndex)
    ? 0
    : -1;
}
