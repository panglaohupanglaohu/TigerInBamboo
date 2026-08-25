// ============================================================================
//  Odyssey Citadel — Townscaper 式规则生成的高山圣城
//
//  Local convention: +Y = sky / planet normal, +Z = the player-facing facade.
//  建筑本体由 citadelTown.js 的单元格地图 + 邻接规则生成；本文件负责
//  断崖基岩、五层台地/折返石阶外围地势、水墨描边与球面放置。
// ============================================================================
import * as THREE from "three";
import {
  addOutline,
  SVARBOVA_OUTLINE_COLOR,
  SVARBOVA_OUTLINE_THICKNESS,
} from "../assets/toon.js";
import { mergeStaticGroup } from "./geometryMerge.js";
import { createCitadelWatchtower } from "../assets/citadelWatchtower.js";
import { createCitadelElderTree } from "../assets/citadelElderTree.js";
import { createCitadelTrojanHorse } from "../assets/citadelTrojanHorse.js";
import { PLAYER_HEIGHT } from "../core/constants.js";
import { canyonOffsetDir } from "./canyon.js";
import {
  CITADEL_BLUEPRINT_VERSION,
  citadelBlueprintSummary,
  createCitadelBlueprint,
} from "./citadelBlueprint.js";
import { isCitadelPaletteV3 } from "../core/params.js";
import { registerLocalLight } from "../render/lighting/localLightRegistry.js";
import {
  buildHighlandCitadelContinuousTerrain,
  buildHighlandCitadelLatestDesign,
  HIGHLAND_CITADEL_DESIGN_PALETTE,
  HIGHLAND_CITADEL_DESIGN_VERSION,
  HIGHLAND_TOWNSCAPER_BASE_Y,
  HIGHLAND_TOWNSCAPER_PLATFORM,
} from "./highlandCitadelDesign.js?v=reference-waterfront-v18-lift-trees-lake-cutout";
import { mountHighlandLocalHeroClouds } from "./highlandHeroClouds.js";
import { mountHighlandSlopeGrass } from "./highlandSlopeGrass.js";
import {
  v3HighlandWallPalette,
  v3HighlandGateColor,
  v3HighlandScheme,
  resolveClusterWallColors,
  v3TokenHex,
  v3HexInt,
  jitterLStar,
  v3HashString,
} from "./citadelVisualTheme.js";
import {
  CITADEL_TOWN_SPEC,
  HIGHLAND_TOWNSCAPER_TOWN_SPEC,
  buildCitadelTown,
  normalizeCitadelTerraceLayout,
  trimCitadelGridToTerrain,
  citadelGridCellCenter,
  CITADEL_PALETTE,
  CITADEL_GATE_CHAR,
  CITADEL_GATE_COLOR,
  CITADEL_CASTLE_FLOORS,
  TOWNSCAPER_CANAL_PALETTE,
  TOWNSCAPER_CANAL_GATE_COLOR,
  TOWNSCAPER_HIGHLAND_PALETTE,
  TOWNSCAPER_HIGHLAND_GATE_COLOR,
  TOWNSCAPER_MODULE_VARIANTS,
  TOWNSCAPER_MODULE_FAMILIES,
  citadelPaletteIndexOfChar,
  citadelShadeStep,
} from "./citadelTown.js?v=20260825-highland-obelisk-stone-v3";

/** Maria Svarbova 无菌马卡龙：低语调中间色，禁止赤陶/焦黑。 */
export const SVARBOVA = Object.freeze({
  porcelain: 0xf2f4f4,
  grayBlue: 0xd5dbdb,
  mint: 0xe8f8f5,
  goose: 0xfcf3cf,
  outline: SVARBOVA_OUTLINE_COLOR,
  figure: 0xff3333,
});

/** 城堡建筑专用光照层：世界光仍打在 layer 0，避免整颗星球被 1.6 环境光洗白。 */
export const CITADEL_SVARBOVA_LAYER = 1;
const TOWNSCAPER_OUTLINE_COLOR = 0x233446;

const PALETTE = Object.freeze({
  cliff: SVARBOVA.porcelain,
  stone: SVARBOVA.porcelain,
  weatherStone: SVARBOVA.grayBlue,
  ink: SVARBOVA.grayBlue,
  outline: SVARBOVA.outline,
  wood: SVARBOVA.grayBlue,
  domeIvory: SVARBOVA.mint,
  domeShade: SVARBOVA.mint,
  towerStone: SVARBOVA.mint,
  towerShade: SVARBOVA.grayBlue,
  sandStone: SVARBOVA.porcelain,
  paleBrick: SVARBOVA.grayBlue,
  roofTile: SVARBOVA.goose,
  water: 0x5a9eaa,
  foliageDark: 0xc5ddd6,
  foliageLight: 0xd7ebe4,
  bark: SVARBOVA.grayBlue,
  contour: SVARBOVA.grayBlue,
  pilgrimageStone: SVARBOVA.porcelain,
});

// 城堡连同前方绿地相对护城河水面的下沉量：与 citadelRange.js 的 CITADEL_SINK 一致，
// 让城堡台地外缘/前方绿地浸入护城河水面下，台面仍露出。
export const CITADEL_SINK = 0.6;

export const CITADEL = Object.freeze({
  layer0: { rockRadius: 2.3, rockCount: 7, centerY: 11.2 },
  outline: SVARBOVA_OUTLINE_THICKNESS,
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

const _pastelMatCache = new Map();

/**
 * 斯瓦尔博娃瓷砖：牛奶弱高光。独立缓存，禁止改透明（否则整座城一起发虚）。
 * @param {number|THREE.Color} color
 */
export function makePastelStandard(color) {
  const hex = typeof color === "number" ? color : (color?.getHex?.() ?? SVARBOVA.porcelain);
  let material = _pastelMatCache.get(hex);
  if (!material) {
    const albedo = new THREE.Color(hex);
    material = new THREE.MeshStandardMaterial({
      color: albedo,
      roughness: 0.15,
      metalness: 0.02,
      envMapIntensity: 0.4,
      emissive: albedo.clone().multiplyScalar(0.08),
      emissiveIntensity: 1,
    });
    material.userData.shared = true;
    material.userData.svarbova = true;
    material.dispose = () => {};
    _pastelMatCache.set(hex, material);
  }
  return material;
}

function makeToon(color, _gradientMap) {
  return makePastelStandard(color);
}

// ---------------------------------------------------------------------------
//  Townscaper 15 色调色板材质（含明度微抖缓存）
// ---------------------------------------------------------------------------

const _citadelPaletteMats = new Map(); // hex -> material

// ---------------------------------------------------------------------------
//  运河交汇古堡与高山圣城各有独立 Townscaper 配色；两套材质体系互不污染。
// ---------------------------------------------------------------------------

/** 运河彩城构件色：橙红陶瓦 / 焦黑铁架 / 深色木 / 墨窗 / 饱和绿植。 */
export const CANAL_TOWNSCAPER = Object.freeze({
  roofTile: 0xd9732f, // 橙红陶瓦（原版标志性屋顶，比蜜橙墙深一档）
  trim: 0x4a3b2e, // 深色木线脚（屋脊/栏杆/风向标）
  iron: 0x2e2a26, // 焦黑铁（飞楼 stilts）
  wood: 0x8a5a33, // 门/船/栅栏暖木
  ink: 0x2b3540, // 门洞/窗洞深墨
  dome: 0xde8138, // 穹顶随屋顶陶瓦
  stone: 0xf6efe3, // 教堂塔身奶油石
  seawall: 0x7e8b99, // 防波堤青灰石
  plaza: 0xc9bca4, // 广场石板
  water: 0x3e8fa3, // 水道青绿
  foliageDark: 0x2f7d3f,
  foliageLight: 0x55a84f,
  windowDark: 0x22303c, // 窗洞深海军蓝
  crenel: 0xf6efe3, // 露台矮墙奶油
  balconyTileVariants: Object.freeze([0xf3b47f, 0xef8c93, 0x83c5d4, 0xf4d66f]),
  foundationVariants: Object.freeze([0x7e8b99, 0xc9bca4, 0xb8aa95]),
  fenceVariants: Object.freeze([0x4a3b2e, 0x2e2a26, 0x765044]),
});

/**
 * 高山城堡专用构件色。墙体与屋顶统一到方尖碑冷白石材；画面的蓝/橙
 * 来自环境光与窗灯，不再把建筑本体涂成马卡龙色块。
 */
export const HIGHLAND_TOWNSCAPER = Object.freeze({
  roofTile: 0x627b90,
  roofVariants: Object.freeze([0x627b90, 0x71889a, 0x536b82, 0x8196a6]),
  trim: 0x344257,
  iron: 0x243243,
  wood: 0x566575,
  ink: 0x203549,
  dome: 0x758ba0,
  stone: 0xd8e1e8,
  seawall: 0x7f8d9a,
  plaza: 0xaaa38e,
  // 参考图的街台是压暗的冷暖灰石，不再沿用旧版近白色台地。
  contour: 0x98a5a0,
  pilgrimageStone: 0xb8aa95,
  water: 0x3e8fa3,
  foliageDark: 0x4f8f7c,
  foliageLight: 0x70aa91,
  windowDark: 0x1e4058,
  crenel: 0xeee9d8,
  balconyTileVariants: Object.freeze([0xc7d2da, 0xb8c7d1, 0xaabdc9, 0xd5dde1]),
  foundationVariants: Object.freeze([0x7f8d9a, 0x91a0aa, 0x718391]),
  fenceVariants: Object.freeze([0x344257, 0x243243, 0x566575, 0x485a6a]),
});

const _canalMatCache = new Map(); // "hex|v|pattern" -> material
const _townPatternTextures = new Map();

function townPatternHash(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * 程序化 Townscaper 表面纹理。墙面为错缝灰浆砖；屋顶为交错陶瓦；
 * 阳台单独使用彩色小花砖纹理，避免把阳台继续误当成绿色植被面。
 * 墙/瓦纹理只储存中性明度，最终与每户主色相乘；花砖纹理保留少量
 * 固定的红、蓝、黄、青色釉砖，形成参考图中的彩色拼花。
 */
function makeTownPatternTexture(kind = "flat") {
  if (kind === "flat") return null;
  const cached = _townPatternTextures.get(kind);
  if (cached) return cached;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const roof = kind === "roof";
  const balcony = kind === "balcony";
  const courseH = balcony ? 16 : roof ? 21 : 32;
  const brickW = balcony ? 16 : roof ? 32 : 64;
  const mortar = roof ? 196 : balcony ? 184 : 216;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / courseH);
    const rowY = y % courseH;
    const stagger = (row & 1) * Math.floor(brickW * 0.5);
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      if (balcony) {
        const tileX = Math.floor(x / brickW);
        const tileY = Math.floor(y / courseH);
        const localX = x % brickW;
        const localY = y % courseH;
        const grout = localX < 2 || localY < 2;
        const accent = (tileX + tileY * 3) % 4;
        const tileColors = [
          [244, 147, 127], // coral
          [94, 181, 208],  // blue
          [246, 207, 94],  // yellow
          [121, 207, 153], // mint
        ];
        const color = grout ? [184, 176, 164] : tileColors[accent];
        const shine = !grout && localY < 5 ? 12 : 0;
        data[offset] = Math.min(255, color[0] + shine);
        data[offset + 1] = Math.min(255, color[1] + shine);
        data[offset + 2] = Math.min(255, color[2] + shine);
      } else {
        const jointX = (x + stagger) % brickW;
        const grout = rowY < 2 || jointX < 2;
        const brickX = Math.floor((x + stagger) / brickW);
        const cellNoise = (townPatternHash(brickX, row, roof ? 73 : 19) % 25) - 12;
        const grain = (townPatternHash(x >> 2, y >> 2, roof ? 31 : 11) % 7) - 3;
        let value = grout
          ? mortar + grain
          : (roof ? 235 : 244) + cellNoise + grain;
        // 陶瓦下沿略暗，形成参考图中的层层瓦行；墙砖保持更柔和的粉刷质感。
        if (roof && !grout && rowY > courseH - 5) value -= 8;
        value = Math.max(150, Math.min(255, value));
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
      }
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = `citadel-townscaper-${kind}-pattern`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  _townPatternTextures.set(kind, texture);
  return texture;
}

/**
 * Townscaper 哑光彩釉：饱和 albedo + 哑光表面（马卡龙管线是牛奶高光，
 * 直接复用会显得塑料）。共享缓存 + dispose noop，与 makePastelStandard 同约定。
 */
export function makeCanalMat(hex, { vertexColors = false, pattern = "flat" } = {}) {
  const key = `${hex.toString(16)}|${vertexColors ? "v" : "p"}|${pattern}`;
  let material = _canalMatCache.get(key);
  if (!material) {
    const albedo = new THREE.Color(hex);
    const map = makeTownPatternTexture(pattern);
    material = new THREE.MeshStandardMaterial({
      color: albedo,
      map,
      bumpMap: map,
      bumpScale: pattern === "roof" ? 0.055 : pattern === "wall" ? 0.035 : pattern === "balcony" ? 0.028 : 0,
      roughness: pattern === "roof" ? 0.9 : pattern === "balcony" ? 0.82 : 0.86,
      metalness: 0.0,
      envMapIntensity: pattern === "roof" ? 0.28 : pattern === "balcony" ? 0.2 : 0.16,
      emissive: albedo.clone().multiplyScalar(pattern === "roof" ? 0.35 : pattern === "balcony" ? 0.045 : 0.018),
      emissiveIntensity: 1,
      vertexColors,
    });
    material.userData.townscaperPattern = pattern;
    material.userData.shared = true;
    material.dispose = () => {};
    _canalMatCache.set(key, material);
  }
  return material;
}

/**
 * 把装配材质表整体切换成 Townscaper 原版配色（就地覆盖，调用方每次
 * 构建都新建材质表，不会污染高山圣城实例）。新增 roofTileGrad：
 * 带顶点渐变的陶瓦，仅屋顶片（几何必带 color 属性）使用。
 */
function applyTownscaperCanalMaterials(materials, scheme = CANAL_TOWNSCAPER) {
  materials.stone = makeCanalMat(scheme.stone, { pattern: "wall" });
  materials.weatherStone = makeCanalMat(scheme.seawall, { pattern: "wall" });
  materials.plazaStone = makeCanalMat(scheme.plaza, { pattern: "wall" });
  materials.ink = makeCanalMat(scheme.ink);
  materials.wood = makeCanalMat(scheme.wood);
  materials.gold = makeCanalMat(scheme.dome, { pattern: "roof" });
  materials.goldShade = makeCanalMat(scheme.dome, { pattern: "roof" });
  materials.roofTile = makeCanalMat(scheme.roofTile, { pattern: "roof" });
  materials.roofTileVariants = (scheme.roofVariants ?? [scheme.roofTile]).map((hex) =>
    makeCanalMat(hex, { vertexColors: true, pattern: "roof" })
  );
  materials.roofTileGrad = materials.roofTileVariants[0];
  materials.balconyTileVariants = (scheme.balconyTileVariants ?? scheme.roofVariants ?? [scheme.roofTile]).map((hex) =>
    makeCanalMat(hex, { vertexColors: true, pattern: "balcony" })
  );
  materials.balconyTile = materials.balconyTileVariants[0];
  materials.foundationVariants = (scheme.foundationVariants ?? [scheme.seawall, scheme.plaza]).map((hex) =>
    makeCanalMat(hex, { pattern: "wall" })
  );
  materials.fenceVariants = (scheme.fenceVariants ?? [scheme.iron, scheme.trim]).map((hex) =>
    makeCanalMat(hex)
  );
  materials.water = makeCanalMat(scheme.water);
  materials.foliageDark = makeCanalMat(scheme.foliageDark);
  materials.foliageLight = makeCanalMat(scheme.foliageLight);
  materials.bark = makeCanalMat(scheme.wood);
  materials.trim = makeCanalMat(scheme.trim);
  materials.iron = makeCanalMat(scheme.iron);
  materials.crenel = makeCanalMat(scheme.crenel, { pattern: "wall" });
  materials.windowDark = makeCanalMat(scheme.windowDark);
  materials.contour = makeCanalMat(scheme.contour ?? scheme.seawall);
  materials.pilgrimageStone = makeCanalMat(scheme.pilgrimageStone ?? scheme.plaza);
  return materials;
}

/**
 * Townscaper 墙面 shade 工厂（运河/高山两堡共用）：尊重布局字符的户色
 * （竖柱同色=一户），按 citadelShadeStep 做 ±10% 明度微抖；材质开
 * vertexColors，与 applyPatchyWallColors 的墙面渐变色块相乘出原版手绘墙感。
 * V3（opts.v3，C2 簇配色）：有 clusterInfo 时按建筑簇取主色+相邻辅色，
 * 朝向做路线导向明度，抖动换成 L*±2.5 五档（不碰色相/饱和度，PLAN 7.4.4）。
 */
function makeTownscaperShadeFactory(palette = TOWNSCAPER_CANAL_PALETTE, gateColor = TOWNSCAPER_CANAL_GATE_COLOR, opts = {}) {
  const cache = new Map(); // "char|step" -> material
  const v3 = opts.v3 === true;
  return function townscaperShade(char, ix, iz, iy, clusterInfo) {
    if (char === CITADEL_GATE_CHAR) {
      return makeCanalMat(gateColor, { vertexColors: true, pattern: "wall" });
    }
    if (v3 && clusterInfo?.clusterId) {
      const { main, accent } = resolveClusterWallColors(clusterInfo.clusterId);
      const h = v3HashString(`${clusterInfo.clusterId}|${ix},${iz}`);
      // 同簇最多一个主色 + 一个相邻辅色：约 1/5 墙面用辅色（PLAN 7.4.2）
      const token = h % 5 === 0 ? accent : main;
      const step = ((h >>> 3) % 5) - 2; // -2..+2 五档，保证材质可缓存
      const key = `v3|${token}|${clusterInfo.facing}|${step}`;
      let material = cache.get(key);
      if (!material) {
        let hex = v3TokenHex(token, { facing: clusterInfo.facing });
        if (step !== 0) hex = jitterLStar(hex, step * 1.25); // L*±2.5 内
        material = makeCanalMat(v3HexInt(hex), {
          vertexColors: true,
          pattern: "wall",
        });
        material.userData.townShade = true;
        material.userData.paletteV3 = true;
        cache.set(key, material);
      }
      return material;
    }
    const idx = citadelPaletteIndexOfChar(char);
    if (idx < 0) return null; // 未知字符回落 materials[char]
    const step = citadelShadeStep(ix, iz, char); // -2..+2 五档
    const key = `${char}|${step}`;
    let material = cache.get(key);
    if (!material) {
      const albedo = new THREE.Color(palette[idx].color);
      albedo.multiplyScalar(1 + step * 0.08);
      albedo.r = Math.min(1, Math.max(0, albedo.r));
      albedo.g = Math.min(1, Math.max(0, albedo.g));
      albedo.b = Math.min(1, Math.max(0, albedo.b));
      material = makeCanalMat(albedo.getHex(), {
        vertexColors: true,
        pattern: "wall",
      });
      material.userData.townShade = true; // 五档明暗混色材质，色值是运行时基色×(1+step·0.08)
      cache.set(key, material);
    }
    return material;
  };
}

/**
 * 调色板字符 → 基色材质表：buildCitadelTown 的 materials[char] 直接可用。
 * 每个装配调用共享同一份缓存（材质复用，避免重建 15+ 个 MeshToonMaterial）。
 * entries/factory/gateColor 可覆盖——运河交汇古堡传 TOWNSCAPER_CANAL_PALETTE
 * + 哑光彩釉工厂，出原版高饱和户色。
 */
function buildCitadelPaletteMaterials(gradientMap, entries = CITADEL_PALETTE, factory = null, gateColor = CITADEL_GATE_COLOR) {
  const make = factory ?? ((hex) => makeToon(hex, gradientMap));
  const table = {};
  for (const entry of entries) {
    table[entry.char] = make(entry.color);
  }
  // 正门字符：门廊语义专用材质（非调色板色）
  table[CITADEL_GATE_CHAR] = make(gateColor);
  // 旧档兼容键（normalize 已迁移字符，这里兜底面板/编辑器直传旧字符）
  table.W = table["0"];
  table.L = table["2"];
  table.B = table["6"];
  table.D = table[CITADEL_GATE_CHAR];
  return table;
}

/**
 * 墙面配色：底层/中层瓷白↔浅灰蓝棋盘；顶两层与外凸体统一薄荷。
 * 不做明度微抖，保持机械对称的隐形网格。
 */
function makeCitadelShadeMaterialFactory(_gradientMap, floors = CITADEL_CASTLE_FLOORS) {
  return function makeCitadelShadeMaterial(char, ix, iz, iy = 0) {
    const topStart = Math.max(0, (Number(floors) || CITADEL_CASTLE_FLOORS) - 2);
    let hex;
    if (char === CITADEL_GATE_CHAR) {
      hex = SVARBOVA.grayBlue;
    } else if (iy >= topStart) {
      hex = SVARBOVA.mint;
    } else {
      hex = ((ix + iz) & 1) === 0 ? SVARBOVA.porcelain : SVARBOVA.grayBlue;
    }
    const key = `svarbova|${hex.toString(16)}`;
    let material = _citadelPaletteMats.get(key);
    if (!material) {
      material = makePastelStandard(hex);
      _citadelPaletteMats.set(key, material);
    }
    return material;
  };
}

/** 古堡窗口夜灯：鹅黄瓷面微自发光，仍保持无菌弱高光。 */
function makeWindowLitMat(_gradientMap, highlandLatest = true) {
  const color = highlandLatest
    ? HIGHLAND_CITADEL_DESIGN_PALETTE.windowWarm
    : SVARBOVA.goose;
  const emissive = highlandLatest
    ? HIGHLAND_CITADEL_DESIGN_PALETTE.windowCore
    : SVARBOVA.goose;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: highlandLatest ? 0.42 : 0.15,
    metalness: highlandLatest ? 0.0 : 0.02,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: highlandLatest ? 1.65 : 0.55,
  });
  material.userData.shared = true;
  material.userData.svarbova = true;
  material.userData.semanticToken = highlandLatest
    ? "highland-window-warm"
    : "canal-window-warm";
  return material;
}

/** 夜间窗口点亮概率 */
export const CITADEL_WINDOW_LIT_CHANCE = 0.7;

/**
 * 收集古堡拱窗并绑定昼夜材质（热重建后须重调）。
 * @param {THREE.Object3D} castleContainer
 */
const _winWorld = new THREE.Vector3();
const _windowMat = new THREE.Matrix4();
const _windowInv = new THREE.Matrix4();

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
  // 两座城都使用 Townscaper 式深蓝窗洞；高山城堡采用略偏蓝的独立结构色。
  const windowScheme = castleContainer.userData.instanceId === "canal-junction"
    ? CANAL_TOWNSCAPER
    : HIGHLAND_TOWNSCAPER;
  castleContainer.userData.windowDarkMat = makeCanalMat(windowScheme.windowDark);
  castleContainer.userData.windowLitMat = makeWindowLitMat(
    gradientMap,
    castleContainer.userData.instanceId !== "canal-junction"
  );
  const windows = [];
  const designWindows = [];
  castleContainer.traverse((o) => {
    if (!o.isMesh) return;
    const townWindow = o.name === "town-window";
    const designWindow = o.userData.citadelDesignWindow === true;
    if (!townWindow && !designWindow) return;
    o.material = castleContainer.userData.windowDarkMat;
    o.userData.citadelWindow = townWindow;
    o.userData.litTonight = false;
    o.userData.extinguishedBySoldiers = false;
    if (designWindow) {
      o.userData.houseId = `latest-design:${o.name}`;
      designWindows.push(o);
      return;
    }
    const tIdx = resolveWindowTerraceIndex(o);
    const ix = Number.isFinite(o.userData.cellIx) ? o.userData.cellIx : 0;
    const iz = Number.isFinite(o.userData.cellIz) ? o.userData.cellIz : 0;
    o.userData.terraceIndex = tIdx;
    o.userData.houseId = `${tIdx}:${ix},${iz}`;
    windows.push(o);
  });
  castleContainer.userData.townWindows = windows;
  castleContainer.userData.latestDesignWindows = designWindows;
  castleContainer.userData.windowNightRolled = false;
  // 性能（2026-08-24）：town 拱窗全部同构（共享几何布局），打包为
  // lit/dark 两个 InstancedMesh——404 个逐窗 draw call → 2 个。
  // 原窗口 mesh 保留在场景树（visible=false + 禁拾取）以兼容验收断言
  // 与拾取行为；夜灯状态记录在 userData.windowInstances。
  rebuildCitadelWindowInstances(castleContainer);
  return windows;
}

/**
 * 性能（2026-08-24）：把 town 拱窗（town-window，同构共享几何）打包为
 * lit/dark 两个 InstancedMesh。窗口亮/暗/熄灯不再切换逐窗材质，而是把
 * 记录在 lit/dark 实例列表之间移动（syncCitadelWindowInstances 重建矩阵）。
 * 原窗口 mesh 保留（visible=false、raycast 禁用）供验收与拾取兼容。
 * 可重复调用（rebuildCitadelTown 热重建后再次打包，先清旧实例）。
 */
export function rebuildCitadelWindowInstances(castleContainer) {
  if (!castleContainer) return;
  const oldInstances = castleContainer.userData.windowInstances;
  if (oldInstances) {
    oldInstances.lit?.removeFromParent?.();
    oldInstances.dark?.removeFromParent?.();
  }
  const windows = castleContainer.userData.townWindows || [];
  const darkMat = castleContainer.userData.windowDarkMat;
  const litMat = castleContainer.userData.windowLitMat;
  if (!windows.length || !darkMat || !litMat) {
    castleContainer.userData.windowInstances = null;
    return;
  }
  // 同构性校验：全部窗口必须共享同一几何布局（position.count 一致）
  const refCount = windows[0].geometry.getAttribute("position").count;
  if (!windows.every((w) => w.geometry.getAttribute("position").count === refCount)) {
    throw new Error("citadel-window-instances: town windows must share one geometry layout");
  }
  castleContainer.updateMatrixWorld(true);
  _windowInv.copy(castleContainer.matrixWorld).invert();
  const count = windows.length;
  const dark = new THREE.InstancedMesh(windows[0].geometry, darkMat, count);
  const lit = new THREE.InstancedMesh(windows[0].geometry, litMat, count);
  dark.name = "citadel-window-instances-dark";
  lit.name = "citadel-window-instances-lit";
  dark.raycast = () => {};
  lit.raycast = () => {};
  dark.frustumCulled = false;
  lit.frustumCulled = false;
  const records = windows.map((w) => {
    w.updateMatrixWorld(true);
    _windowMat.copy(w.matrixWorld).premultiply(_windowInv);
    const matrix = _windowMat.clone();
    // 原 mesh 隐藏并禁拾取：渲染与 raycast 全部交给 InstancedMesh
    w.visible = false;
    w.raycast = () => {};
    return {
      mesh: w,
      matrix,
      houseId: w.userData.houseId,
      terraceIndex: w.userData.terraceIndex,
      castleFloor: w.userData.castleFloor,
      cellIx: w.userData.cellIx,
      cellIz: w.userData.cellIz,
      cellIy: w.userData.cellIy,
      litTonight: false,
      extinguishedBySoldiers: false,
      lit: false,
    };
  });
  castleContainer.add(dark, lit);
  castleContainer.userData.windowInstances = Object.freeze({
    dark,
    lit,
    records,
  });
  syncCitadelWindowInstances(castleContainer);
}

/** 按 records 的 lit 状态重建两个 InstancedMesh 的实例矩阵与 count。 */
export function syncCitadelWindowInstances(castleContainer) {
  const instances = castleContainer.userData.windowInstances;
  if (!instances) return;
  const darkList = [];
  const litList = [];
  for (const record of instances.records) (record.lit ? litList : darkList).push(record);
  instances.dark.count = darkList.length;
  instances.lit.count = litList.length;
  for (let i = 0; i < darkList.length; i++) instances.dark.setMatrixAt(i, darkList[i].matrix);
  for (let i = 0; i < litList.length; i++) instances.lit.setMatrixAt(i, litList[i].matrix);
  instances.dark.instanceMatrix.needsUpdate = true;
  instances.lit.instanceMatrix.needsUpdate = true;
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
  const designWindows = Array.isArray(castleContainer.userData.latestDesignWindows)
    ? castleContainer.userData.latestDesignWindows
    : [];
  const instances = castleContainer.userData.windowInstances;
  const records = instances?.records ?? null;
  // town 窗口状态读/写统一走 record（有实例时）；design 窗口始终走 mesh.userData
  const stateOf = (entry) => (entry.userData ? entry.userData : entry); // record 直接有字段，mesh 有 userData
  const readState = (entry, key) => (entry.userData ? entry.userData[key] : entry[key]);
  const writeState = (entry, key, value) => {
    if (entry.userData) entry.userData[key] = value;
    else entry[key] = value;
    if (entry.mesh) entry.mesh.userData[key] = value; // 同步到原 mesh（兼容其他消费者）
  };
  const getWorld = (entry, out) => {
    if (entry.mesh) entry.mesh.getWorldPosition(out);
    else entry.getWorldPosition(out);
    return out;
  };
  const controlledWindows = (records ?? windows).concat(designWindows);
  if (!controlledWindows.length) return;

  const p = ((Number(phase) % 1) + 1) % 1;
  // 入夜 ≈0.82，整夜至黎明 ≈0.22（与 dayNight KEYS 一致）
  const night = p >= 0.82 || p < 0.22;

  if (night) {
    if (!castleContainer.userData.windowNightRolled) {
      for (const w of controlledWindows) {
        writeState(w, "extinguishedBySoldiers", false);
        writeState(w, "litTonight", Math.random() < CITADEL_WINDOW_LIT_CHANCE);
      }
      castleContainer.userData.windowNightRolled = true;
    }
    // 纸士兵经过：整屋熄灯，当夜不再亮起
    const threats = opts.threats;
    if (Array.isArray(threats) && threats.length) {
      const r = Number.isFinite(opts.threatRadius) ? opts.threatRadius : 3.8;
      const r2 = r * r;
      const snuffed = new Set();
      for (const w of controlledWindows) {
        if (!readState(w, "litTonight") || readState(w, "extinguishedBySoldiers")) continue;
        const houseId = readState(w, "houseId");
        if (snuffed.has(houseId)) continue;
        getWorld(w, _winWorld);
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
        snuffed.add(houseId);
      }
      if (snuffed.size) {
        for (const w of controlledWindows) {
          if (!snuffed.has(readState(w, "houseId"))) continue;
          writeState(w, "litTonight", false);
          writeState(w, "extinguishedBySoldiers", true);
        }
      }
    }
    // The assault system commits captured floors on the same castle container.
    // Apply that state after the nightly roll so a captured room cannot be
    // randomly relit by the next frame.
    const capturedFloors = new Set(
      Array.isArray(castleContainer.userData.capturedFloors)
        ? castleContainer.userData.capturedFloors.map((floor) => Number(floor))
        : []
    );
    if (capturedFloors.size) {
      for (const w of controlledWindows) {
        const floor = Number(readState(w, "castleFloor"));
        if (!Number.isFinite(floor) || !capturedFloors.has(floor)) continue;
        writeState(w, "litTonight", false);
        writeState(w, "extinguishedBySoldiers", true);
      }
    }
  } else if (castleContainer.userData.windowNightRolled) {
    for (const w of controlledWindows) {
      writeState(w, "litTonight", false);
      writeState(w, "extinguishedBySoldiers", false);
    }
    castleContainer.userData.windowNightRolled = false;
  }

  const dark = castleContainer.userData.windowDarkMat;
  const lit = castleContainer.userData.windowLitMat;
  if (!dark || !lit) return;
  if (records) {
    // town 窗口：状态变化 → 移动实例（lit/dark 列表），无逐窗材质切换
    let changed = false;
    for (const record of records) {
      const on = night && record.litTonight && !record.extinguishedBySoldiers;
      if (record.lit !== on) { record.lit = on; changed = true; }
    }
    if (changed) syncCitadelWindowInstances(castleContainer);
    // design 窗口（尺寸参数化，不实例化）：逐窗材质切换
    for (const w of designWindows) {
      const on = night && w.userData.litTonight && !w.userData.extinguishedBySoldiers;
      if (w.material !== (on ? lit : dark)) w.material = on ? lit : dark;
    }
  } else {
    for (const w of controlledWindows) {
      const on = night && readState(w, "litTonight") && !readState(w, "extinguishedBySoldiers");
      if (w.material !== (on ? lit : dark)) w.material = on ? lit : dark;
    }
  }
}

/** Called by the siege simulation when an interior floor is secured. */
export function markCitadelFloorCaptured(castleContainer, floorIndex) {
  if (!castleContainer || !Number.isFinite(floorIndex)) return [];
  const floors = new Set(
    Array.isArray(castleContainer.userData.capturedFloors)
      ? castleContainer.userData.capturedFloors
      : []
  );
  floors.add(floorIndex | 0);
  castleContainer.userData.capturedFloors = [...floors].sort((a, b) => a - b);
  castleContainer.userData.capturedTopFloor = Math.max(
    Number(castleContainer.userData.capturedTopFloor ?? -1),
    floorIndex | 0
  );
  return castleContainer.userData.capturedFloors;
}

function mesh(geometry, material, name, outlineThickness = SVARBOVA_OUTLINE_THICKNESS) {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = false;
  result.receiveShadow = false;
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
export function applyInkOutlines(
  assembly,
  enabled = true,
  color = SVARBOVA_OUTLINE_COLOR
) {
  if (!enabled) return 0;
  const surfaces = [];
  assembly.traverse((object) => {
    if (
      object.isMesh
      && !object.userData.isOutline
      && object.userData.skipInkOutline !== true
      && object.material?.transparent !== true
    ) surfaces.push(object);
  });
  for (const surface of surfaces) {
    // 屋顶本身已有瓦行纹理；反向壳若覆盖坡面会把亮陶瓦压成黑色，
    // 因此只给墙体/构件描边，屋顶保留窄檐和屋脊线即可。
    if (surface.material?.userData?.townscaperPattern === "roof") continue;
    addOutline(
      surface,
      surface.userData.outlineThickness ?? SVARBOVA_OUTLINE_THICKNESS,
      color,
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
  // 幂等：先移除上次合并产生的网格（仅 town 层组的 mergedGeometry===true；
  // highland 装饰组合并网格带 "highland-decoration" 命名空间，不可误删）
  const stale = [];
  assemblyRoot.traverse((o) => {
    if (o.isMesh && o.userData.mergedGeometry === true) stale.push(o);
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
  if (terrain && terrain !== assemblyRoot && assemblyRoot.userData?.highlandTownscaperGrid !== true) {
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
  contourGroup.userData.buildStage = "terraces";
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
  pilgrimageRamp.userData.buildStage = "terraces";
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
      step.userData.townModule = {
        family: "stairs",
        variant: TOWNSCAPER_MODULE_FAMILIES.stairs[3],
        terrace: terraceIndex,
        catalogSize: TOWNSCAPER_MODULE_VARIANTS,
      };
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
    landing.userData.townModule = {
      family: "stairs",
      variant: TOWNSCAPER_MODULE_FAMILIES.stairs[1],
      terrace: terraceIndex,
      catalogSize: TOWNSCAPER_MODULE_VARIANTS,
    };
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
  terrainSystem.userData.buildStages = Object.freeze(
    normalized.notchedLayers > 0 ? ["terraces", "waterfalls"] : ["terraces"]
  );
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
  // Townscaper 彩城管线：运河交汇古堡（马卡龙 15 色）与高山圣城
  // （截屏同调薄荷/天青 15 色）共用——哑光彩釉 + 墙面渐变色块 + 陶瓦屋顶渐变。
  const townscaperColors = options.townscaperColors === true; // 运河交汇古堡
  const highlandColors = options.highlandColors === true; // 高山圣城 Townscaper 化
  const townscaperMode = townscaperColors || highlandColors;
  // V3 Bad North 语义配色（?citadelPaletteV3=1）：只接管高山圣城，不动运河古堡。
  const usePaletteV3 = highlandColors && !townscaperColors && isCitadelPaletteV3();
  const townPalette = highlandColors && !townscaperColors
    ? (usePaletteV3 ? v3HighlandWallPalette() : TOWNSCAPER_HIGHLAND_PALETTE)
    : TOWNSCAPER_CANAL_PALETTE;
  const townGateColor = highlandColors && !townscaperColors
    ? (usePaletteV3 ? v3HighlandGateColor() : TOWNSCAPER_HIGHLAND_GATE_COLOR)
    : TOWNSCAPER_CANAL_GATE_COLOR;
  const townMaterialScheme = highlandColors && !townscaperColors
    ? (usePaletteV3 ? v3HighlandScheme() : HIGHLAND_TOWNSCAPER)
    : CANAL_TOWNSCAPER;

  const materials = options.materials ?? {
    cliff: makeToon(PALETTE.cliff, gradientMap),
    stone: makeToon(PALETTE.stone, gradientMap),
    weatherStone: makeToon(PALETTE.weatherStone, gradientMap),
    plazaStone: makePastelStandard(SVARBOVA.porcelain),
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
    trim: makePastelStandard(SVARBOVA.goose),
    crenel: makePastelStandard(SVARBOVA.goose),
  };
  if (townscaperMode) applyTownscaperCanalMaterials(materials, townMaterialScheme);
  // 水道格子用单独半透明材质，绝不改共享 toon（否则整座城会一起变透）。
  const townWaterMat = townscaperMode
    ? makeCanalMat(townMaterialScheme.water).clone()
    : makeToon(PALETTE.water, gradientMap);
  townWaterMat.transparent = true;
  townWaterMat.opacity = 0.55;
  townWaterMat.depthWrite = false;
  townWaterMat.userData.townWater = true;
  // 窗口昼夜材质（可被 options 注入共享实例）
  if (!materials.windowDark) materials.windowDark = makePastelStandard(SVARBOVA.grayBlue);
  if (!materials.windowLit) materials.windowLit = makeWindowLitMat(gradientMap);

  const town = buildCitadelTown(spec, {
    leanDecor: options.leanDecor === true,
    colorful: townscaperMode,
    mesh,
    materials: {
      // Townscaper 15 色调色板：字符 "0"–"9A"–"E" → 基色材质（含旧 4 色兼容键）
      ...buildCitadelPaletteMaterials(
        gradientMap,
        townscaperMode ? townPalette : CITADEL_PALETTE,
        townscaperMode ? (hex) => makeCanalMat(hex, { pattern: "wall" }) : null,
        townscaperMode ? townGateColor : CITADEL_GATE_COLOR
      ),
      gold: materials.gold,
      wood: materials.wood,
      ink: materials.ink,
      roofTile: materials.roofTile,
      roofTileGrad: materials.roofTileGrad, // Townscaper 模式提供；否则回落 roofTile
      roofTileVariants: materials.roofTileVariants,
      balconyTile: materials.balconyTile,
      balconyTileVariants: materials.balconyTileVariants,
      foundationVariants: materials.foundationVariants,
      fenceVariants: materials.fenceVariants,
      water: townWaterMat,
      steepleStone: materials.stone, // 教堂尖塔白石塔身
      foliageDark: materials.foliageDark,
      foliageLight: materials.foliageLight,
      plazaStone: materials.plazaStone ?? materials.weatherStone, // 石板广场
      // 拱窗外框 / 楼顶构件：整面锁死同一淡鹅黄，作为隐形网格
      trim: materials.trim ?? makePastelStandard(SVARBOVA.goose),
      iron: materials.iron ?? makePastelStandard(SVARBOVA.goose),
      crenel: materials.crenel ?? makePastelStandard(SVARBOVA.goose),
      windowDark: materials.windowDark,
      windowLit: materials.windowLit,
      shade: townscaperMode
        ? makeTownscaperShadeFactory(townPalette, townGateColor, { v3: usePaletteV3 })
        : makeCitadelShadeMaterialFactory(
            gradientMap,
            options.floors ?? spec?.floors ?? CITADEL_CASTLE_FLOORS
          ),
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

  const surfaceConformance = Object.freeze({
    provider: options.surfaceProvider ?? "uniform-town-base",
    sampleCount: 1,
    minBaseY: baseY,
    maxBaseY: baseY,
    verticalSpan: 0,
    uniformPlane: true,
  });

  return {
    group,
    levels: town.levels,
    stats: town.stats,
    materials,
    gradientMap,
    surfaceConformance,
  };
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
  const surfaceConformance = [];
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
    chimneyCount: 0, // 烟囱（Townscaper 坡屋顶签名构件）
    supportCount: 0, // 悬空支撑支架（flying buildings）
    courtyardCount: 0,
    courtyardCellCount: 0,
    courtyardWallCount: 0,
    courtyardWellCount: 0,
    moduleCount: 0,
    moduleFamilyCounts: Object.fromEntries(
      Object.keys(TOWNSCAPER_MODULE_FAMILIES).map((family) => [family, 0])
    ),
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
    surfaceConformance[terraceIndex] = assembly.surfaceConformance;
    for (const [key, value] of Object.entries(assembly.stats)) {
      if (typeof value === "number" && typeof stats[key] === "number") stats[key] += value;
    }
    for (const [family, count] of Object.entries(assembly.stats.moduleFamilyCounts ?? {})) {
      if (typeof stats.moduleFamilyCounts[family] === "number") stats.moduleFamilyCounts[family] += count;
    }
    if (assembly.stats.gate) {
      const gate = { ...assembly.stats.gate, terraceIndex };
      stats.gates.push(gate);
      if (!stats.gate || terraceIndex === 0) stats.gate = gate;
    }
  });

  // 外围五段折返石阶也是楼梯模块：它们不属于单个城堡台地的 ASCII
  // 体块，因此在聚合统计中显式登记，保证模块验收覆盖到“楼梯”家族。
  stats.moduleFamilyCounts.stairs += metrics.length;
  stats.moduleCount += metrics.length;

  return {
    group,
    levels,
    terraceLevels,
    stats,
    layout,
    baseYs: metrics.map((metric) =>
      options.baseYOverride !== undefined ? options.baseYOverride : metric.top - 0.06
    ),
    surfaceConformance,
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
/** 房子必须实心：共享材质被改成透明时，整座岛会发虚。 */
function sealCitadelBuildingsOpaque(root) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData?.isOutline) return;
    if (o.name === "canal-junction-water" || o.material?.userData?.townscaperWater) return;
    if (o.material?.userData?.townWater) return;
    if (o.name === "canal-town-reflection" || o.parent?.name === "canal-town-reflection") return;
    if (o.name?.startsWith("contour-step") || o.name === "canal-junction-build-zone") return;
    if (o.material?.visible === false || o.visible === false) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (!mat || mat.userData?.townscaperWater || mat.userData?.townWater) continue;
      if (mat.transparent || mat.opacity < 1 || mat.depthWrite === false) {
        const target = mat.userData?.shared ? mat.clone() : mat;
        target.transparent = false;
        target.opacity = 1;
        target.depthWrite = true;
        if (target !== mat) {
          if (Array.isArray(o.material)) {
            o.material = o.material.map((m) => (m === mat ? target : m));
          } else {
            o.material = target;
          }
        }
      }
    }
  });
}

/** 水面倒影：把镇体沿水面镜像，压暗半透，不参与拾取。 */
function refreshCanalTownReflection(castleContainer) {
  const stale = castleContainer.getObjectByName("canal-town-reflection");
  if (stale) {
    stale.traverse((o) => {
      if (o.isMesh && o.material && !o.material.userData?.shared) o.material.dispose?.();
    });
    stale.removeFromParent();
  }
  if (!castleContainer.userData?.skipOuterTerrain) return;
  const src = castleContainer.userData.mainCastle;
  if (!src) return;
  const waterY = castleContainer.userData.townBaseLift ?? 0.62;
  const mirror = src.clone(true);
  mirror.name = "canal-town-reflection";
  mirror.scale.y = -Math.abs(mirror.scale.y || 1);
  mirror.position.y = 2 * waterY;
  mirror.traverse((o) => {
    if (!o.isMesh) return;
    o.raycast = () => {};
    o.castShadow = false;
    const srcMat = o.material;
    if (!srcMat) return;
    const m = srcMat.clone();
    m.transparent = true;
    m.opacity = 0.32;
    m.depthWrite = false;
    m.userData.townWater = true;
    o.material = m;
  });
  castleContainer.add(mirror);
}

function makeHighlandTownPlatformShape() {
  const { halfWidth: x, halfDepth: z, cornerCut: c } = HIGHLAND_TOWNSCAPER_PLATFORM;
  const shape = new THREE.Shape();
  shape.moveTo(-x + c, -z);
  shape.lineTo(x - c, -z);
  shape.lineTo(x, -z + c);
  shape.lineTo(x, z - c);
  shape.lineTo(x - c, z);
  shape.lineTo(-x + c, z);
  shape.lineTo(-x, z - c);
  shape.lineTo(-x, -z + c);
  shape.closePath();
  return shape;
}

/**
 * 运河交汇古堡同型的水平承重地台：顶面只提供一个 Y，厚底向下插入
 * 球面山体。山体曲率由地台侧壁吸收，Townscaper 单元无需逐格倾斜。
 */
function buildHighlandTownFoundationPlatform(materials) {
  const spec = HIGHLAND_TOWNSCAPER_PLATFORM;
  const geometry = new THREE.ExtrudeGeometry(makeHighlandTownPlatformShape(), {
    depth: spec.thickness,
    bevelEnabled: false,
    steps: 1,
  });
  // ExtrudeGeometry 默认沿 +Z；转成沿 -Y，使 shape 所在面成为水平顶面。
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.userData.surfaceProvider = spec.surfaceProvider;
  geometry.userData.uniformTop = true;
  geometry.userData.embeddedFoundation = true;
  const platform = mesh(
    geometry,
    materials.weatherStone ?? materials.contour,
    "highland-town-foundation-platform"
  );
  platform.position.y = spec.topY;
  // 逻辑地台只负责统一建筑、编辑器和寻路标高；天然山体已在城址内反向
  // 抵消球面下沉并覆盖至顶面，因此实体承重体应完全埋在地下，禁止在
  // 湖岸画面中读成一条人工灰墙。
  platform.visible = false;
  platform.receiveShadow = false;
  platform.castShadow = false;
  platform.userData.buildStage = "foundation";
  platform.userData.isCitadelFoundation = true;
  platform.userData.surfaceProvider = spec.surfaceProvider;
  platform.userData.topY = spec.topY;
  platform.userData.bottomY = spec.topY - spec.thickness;
  platform.userData.uniformTop = true;
  platform.userData.embeddedIntoTerrain = true;
  platform.userData.fullySubmerged = true;
  platform.userData.footprint = {
    halfWidth: spec.halfWidth,
    halfDepth: spec.halfDepth,
    cornerCut: spec.cornerCut,
  };
  return platform;
}

function ensureSkipOuterTerrainEditPad(castleContainer) {
  if (!castleContainer.userData?.skipOuterTerrain && !castleContainer.userData?.highlandTownscaperGrid) return null;
  const highlandPlatform = castleContainer.userData.highlandTownscaperGrid === true;
  const lift = highlandPlatform
    ? HIGHLAND_TOWNSCAPER_BASE_Y
    : castleContainer.userData.townBaseLift ?? 0.6;
  let terrain = castleContainer.userData.outerTerrainSystem;
  if (!terrain) {
    terrain = new THREE.Group();
    terrain.name = "citadel-skip-outer-terrain";
    castleContainer.add(terrain);
    castleContainer.userData.outerTerrainSystem = terrain;
  }
  let pad = terrain.getObjectByName("contour-step-0");
  if (pad && (
    pad.geometry?.type === "BoxGeometry"
    || (highlandPlatform && pad.geometry?.userData?.surfaceProvider !== HIGHLAND_TOWNSCAPER_PLATFORM.surfaceProvider)
  )) {
    pad.removeFromParent();
    pad.geometry.dispose?.();
    pad = null;
  }
  if (!pad) {
    // 高山和运河都使用水平建造面；高山拾取形状与厚地台完全同形。
    const geometry = highlandPlatform
      ? new THREE.ShapeGeometry(makeHighlandTownPlatformShape())
      : new THREE.PlaneGeometry(48, 40, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.userData.surfaceProvider = highlandPlatform
      ? HIGHLAND_TOWNSCAPER_PLATFORM.surfaceProvider
      : "uniform-town-base";
    geometry.userData.curved = false;
    geometry.userData.uniformTop = true;
    pad = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide,
      })
    );
    pad.name = "contour-step-0";
    terrain.add(pad);
  }
  pad.position.set(0, lift + (highlandPlatform ? 0.025 : 0), 0);
  pad.rotation.set(0, 0, 0);
  pad.userData.isCitadelTerrace = true;
  pad.userData.terraceIndex = 0;
  pad.userData.townscaperBuildZone = highlandPlatform
    ? "highland"
    : "canal-junction";
  pad.userData.surfaceProvider = highlandPlatform
    ? HIGHLAND_TOWNSCAPER_PLATFORM.surfaceProvider
    : "uniform-town-base";
  pad.visible = true;
  return pad;
}

/**
 * 主相机 / 拾取射线必须能看见 layer 1，否则无菌光照层上的城体会消失。
 * @param {THREE.Camera|THREE.Raycaster} target
 */
export function enableSvarbovaCitadelLayer(target) {
  target?.layers?.enable?.(CITADEL_SVARBOVA_LAYER);
}

function markSvarbovaLitMesh(object) {
  if (!object?.isMesh) return;
  if (object.material?.userData?.townWater || object.material?.userData?.townscaperWater) return;
  if (object.name === "canal-junction-water" || object.name === "canal-town-reflection") return;
  if (object.name?.startsWith("contour-step")) return;
  object.layers.set(CITADEL_SVARBOVA_LAYER);
  object.castShadow = false;
  object.receiveShadow = false;
}

function attachSvarbovaLightRig(castleContainer, buildingRoot) {
  if (!castleContainer) return;
  const highlandLatest = castleContainer.userData?.highlandLatestDesign === true;
  const ambientColor = highlandLatest ? 0x8eb9e5 : 0xffffff;
  const ambientIntensity = highlandLatest ? 0.34 : 0.62;
  const sunColor = highlandLatest ? 0x78aee0 : 0xfff4e6;
  const sunIntensity = highlandLatest ? 0.62 : 0.95;
  let ambient = castleContainer.getObjectByName("citadel-svarbova-ambient");
  if (!ambient) {
    ambient = new THREE.AmbientLight(ambientColor, ambientIntensity);
    ambient.name = "citadel-svarbova-ambient";
    castleContainer.add(ambient);
  }
  ambient.intensity = ambientIntensity;
  ambient.color.setHex(ambientColor);
  ambient.layers.set(CITADEL_SVARBOVA_LAYER);
  // K4：圣城 layer-1 例外灯登记进 registry（不参与预算选择，仅调试可见）
  registerLocalLight(ambient, {
    id: "citadel-svarbova-ambient",
    owner: "odyssey-citadel",
    kind: "ambient",
    intensity: ambientIntensity,
    exception: true,
  });

  let sun = castleContainer.getObjectByName("citadel-svarbova-sun");
  if (!sun) {
    sun = new THREE.DirectionalLight(sunColor, sunIntensity);
    sun.name = "citadel-svarbova-sun";
    sun.position.set(10, 22, 12);
    sun.castShadow = false;
    castleContainer.add(sun);
  }
  sun.intensity = sunIntensity;
  sun.color.setHex(sunColor);
  sun.layers.set(CITADEL_SVARBOVA_LAYER);
  registerLocalLight(sun, {
    id: "citadel-svarbova-sun",
    owner: "odyssey-citadel",
    kind: "directional",
    intensity: sunIntensity,
    exception: true,
  });

  buildingRoot?.traverse(markSvarbovaLitMesh);
}

function buildSvarbovaRedFigure() {
  const mat = new THREE.MeshStandardMaterial({
    color: SVARBOVA.figure,
    roughness: 0.15,
    metalness: 0.02,
    emissive: new THREE.Color(SVARBOVA.figure).multiplyScalar(0.12),
  });
  mat.userData.svarbova = true;
  const figure = new THREE.Group();
  figure.name = "svarbova-red-figure";
  const part = (geo, y, x = 0, z = 0) => {
    const meshObj = new THREE.Mesh(geo, mat);
    meshObj.position.set(x, y, z);
    meshObj.castShadow = false;
    meshObj.receiveShadow = false;
    addOutline(meshObj, SVARBOVA_OUTLINE_THICKNESS, SVARBOVA_OUTLINE_COLOR, 0);
    figure.add(meshObj);
    return meshObj;
  };
  part(new THREE.BoxGeometry(0.3, 0.44, 0.18), 0.98);
  part(new THREE.BoxGeometry(0.2, 0.2, 0.18), 1.32);
  part(new THREE.BoxGeometry(0.11, 0.5, 0.11), 0.5, -0.075);
  part(new THREE.BoxGeometry(0.11, 0.5, 0.11), 0.5, 0.075);
  part(new THREE.BoxGeometry(0.08, 0.4, 0.08), 0.94, -0.22);
  part(new THREE.BoxGeometry(0.08, 0.4, 0.08), 0.94, 0.22);
  figure.userData.kind = "svarbova-npc";
  figure.userData.frozen = true;
  return figure;
}

function placeSvarbovaRedFigure(castleContainer, skipOuterTerrain, townBaseLift) {
  const host = castleContainer.userData.mainCastle || castleContainer;
  const stale = host.getObjectByName("svarbova-red-figure");
  if (stale) stale.removeFromParent();
  const figure = buildSvarbovaRedFigure();
  if (skipOuterTerrain) {
    figure.position.set(0, (Number(townBaseLift) || 0.6) + 0.08, 4.0);
  } else {
    figure.position.set(0, 11.5, 4.0);
  }
  host.add(figure);
  figure.traverse(markSvarbovaLitMesh);
  return figure;
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
  const skipOuterTerrain = options.skipOuterTerrain === true;
  const useHighlandLatestDesign = !skipOuterTerrain
    && options.instanceId !== "canal-junction"
    && options.latestDesign !== false;
  const defaultTownSpec = useHighlandLatestDesign
    ? HIGHLAND_TOWNSCAPER_TOWN_SPEC
    : CITADEL_TOWN_SPEC;
  const castleFloors = Number.isFinite(options.floors)
    ? Math.min(20, Math.max(1, Math.round(options.floors)))
    : (options.spec?.floors ?? defaultTownSpec.floors ?? CITADEL_CASTLE_FLOORS);
  const blueprint = createCitadelBlueprint({
    spec: options.spec ?? defaultTownSpec,
    contour: options.contour ?? CITADEL.contourTerrain,
    floors: castleFloors,
    instanceId: options.instanceId ?? null,
    skipOuterTerrain,
    townBaseLift: options.townBaseLift ?? 0.6,
    terrainObjects: options.terrainObjects,
  });
  const townSpec = blueprint.town.layout;
  const contourSpec = blueprint.terrain.config;
  const townBaseY = blueprint.terrain.topY - 0.06;
  const planetRadius = Number.isFinite(options.planetRadius) ? options.planetRadius : 160;
  const gradientMap = makeThreeStepGradient();

  const materials = {
    cliff: makeToon(PALETTE.cliff, gradientMap),
    stone: makeToon(PALETTE.stone, gradientMap),
    weatherStone: makeToon(PALETTE.weatherStone, gradientMap),
    plazaStone: makePastelStandard(SVARBOVA.porcelain),
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
    trim: makePastelStandard(SVARBOVA.goose),
    crenel: makePastelStandard(SVARBOVA.goose),
  };

  const castleContainer = new THREE.Group();
  // 多实例：名字带实例 id，避免 getObjectByName("castleContainer") 在双城堡时歧义。
  // 默认实例保留旧名兼容既有引用（e2e / 编辑器）。
  castleContainer.name = options.instanceId
    ? `castleContainer-${options.instanceId}`
    : "castleContainer";

  const citadelAssembly = new THREE.Group();
  citadelAssembly.name = useHighlandLatestDesign
    ? "odyssey-citadel-mountain-valley-assembly"
    : "odyssey-citadel-five-layer-assembly";
  citadelAssembly.userData.buildStage = "town";

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
  if (!skipOuterTerrain && !useHighlandLatestDesign) {
    const rockGeometry = new THREE.IcosahedronGeometry(CITADEL.layer0.rockRadius, 0);
    for (let i = 0; i < CITADEL.layer0.rockCount; i++) {
      const rock = mesh(rockGeometry, materials.cliff, `primordial-cliff-rock-${i}`);
      rock.userData.buildStage = "foundation";
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
    // 运河交汇古堡：Townscaper 原版高饱和彩城（高山圣城不动色盘）
    // 两座城堡都走 Townscaper 彩城管线：运河古堡用马卡龙 15 色，
    // 高山圣城（默认实例）用截屏同调的高地 15 色。
    townscaperColors: options.instanceId === "canal-junction",
    highlandColors: options.instanceId !== "canal-junction",
    // 无台地模式（运河交汇古堡）：镇体基座 = 堤岸方框水面平台抬升。
    // 不传则回落台地 metrics 顶（≈7.5 局部），城堡会悬空在平台上方。
    baseYOverride: skipOuterTerrain
      ? options.townBaseLift ?? 0.6
      : useHighlandLatestDesign
        ? HIGHLAND_TOWNSCAPER_BASE_Y
        : undefined,
    // 高山圣城与运河古堡一样使用统一水平承重面；球面落差由下方厚地台吸收。
    surfaceProvider: useHighlandLatestDesign
      ? HIGHLAND_TOWNSCAPER_PLATFORM.surfaceProvider
      : "uniform-town-base",
  });
  // 高山与运河现在共享同一套逐格 Townscaper 层组；高山仅使用 terrace 0，
  // 其余空 terrace 是存档格式兼容层，不会恢复旧五台地视觉。
  townAssembly.terraceLevels.forEach((terrace) => {
    terrace.forEach((levelGroup, floorIndex) => {
      layers[floorIndex].add(levelGroup);
    });
  });

  for (const layer of layers) citadelAssembly.add(layer);
  // 最新高山圣城：中央圣塔、山脊副塔、两侧山壁、暖光朝圣轴和前景水岸
  // 共同构成连续山谷；旧五层台地和瀑布不再挂入场景。战斗改读显式城顶锚点。
  const highlandLatestDesign = useHighlandLatestDesign
    ? buildHighlandCitadelLatestDesign({
        externalTownscaperCity: true,
        townscaperStats: townAssembly.stats,
      })
    : null;
  if (highlandLatestDesign) citadelAssembly.add(highlandLatestDesign);
  const mainOutlinedSurfaceCount = applyInkOutlines(
    citadelAssembly,
    true,
    TOWNSCAPER_OUTLINE_COLOR
  );

  const outerTerrainSystem = skipOuterTerrain
    ? new THREE.Group()
    : useHighlandLatestDesign
      ? buildHighlandCitadelContinuousTerrain()
      : buildOuterCitadelTerrain(materials, contourSpec);
  outerTerrainSystem.name = skipOuterTerrain
    ? "citadel-skip-outer-terrain"
    : useHighlandLatestDesign
      ? "citadel-continuous-mountain-terrain-system"
      : "citadel-outer-terrain-system";
  outerTerrainSystem.userData.buildStage = skipOuterTerrain
    ? "foundation"
    : useHighlandLatestDesign
      ? "continuous-mountain"
      : "terraces";
  if (useHighlandLatestDesign) {
    outerTerrainSystem.add(buildHighlandTownFoundationPlatform(materials));
    outerTerrainSystem.userData.townFoundation = HIGHLAND_TOWNSCAPER_PLATFORM;
    mountHighlandSlopeGrass(THREE, outerTerrainSystem);
    mountHighlandLocalHeroClouds(THREE, castleContainer);
  }
  const terrainOutlinedSurfaceCount = skipOuterTerrain
    ? 0
    : applyInkOutlines(outerTerrainSystem);
  castleContainer.add(outerTerrainSystem);
  castleContainer.add(citadelAssembly);
  castleContainer.userData.skipOuterTerrain = skipOuterTerrain;
  castleContainer.userData.townBaseLift = options.townBaseLift ?? 0.6;
  castleContainer.userData.outerTerrainSystem = outerTerrainSystem;
  castleContainer.userData.highlandTownscaperGrid = useHighlandLatestDesign;
  if (skipOuterTerrain || useHighlandLatestDesign) ensureSkipOuterTerrainEditPad(castleContainer);

  // 运河交汇：首次入场 plop（软弹一下），其余帧静态。
  let plopT = skipOuterTerrain ? 0 : 1;
  const update = (dt = 0.016, t = 0) => {
    if (plopT < 0.32) {
      plopT += Math.max(0.008, Number(dt) || 0.016);
      const u = Math.min(1, plopT / 0.32);
      const bounce = 1 + Math.sin(u * Math.PI) * 0.055 * (1 - u);
      citadelAssembly.scale.setScalar(bounce);
      if (u >= 1) citadelAssembly.scale.setScalar(1);
    }
    outerTerrainSystem.userData.highlandSlopeGrass?.update?.(t);
    castleContainer.userData.highlandHeroClouds?.update?.(t);
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

  const terrainObjects = skipOuterTerrain || useHighlandLatestDesign
    ? new THREE.Group()
    : buildCitadelTerrainObjects(
      blueprint.objects,
      contourSpec,
      castleContainer.userData.anchor
    );
  terrainObjects.name = skipOuterTerrain || useHighlandLatestDesign
    ? "citadel-skip-terrain-objects"
    : "citadel-terrain-objects";
  terrainObjects.userData.buildStage = "terrain-objects";
  castleContainer.add(terrainObjects);

  castleContainer.userData.kind = "odyssey-citadel";
  castleContainer.userData.blueprint = blueprint;
  castleContainer.userData.blueprintSummary = citadelBlueprintSummary(blueprint);
  castleContainer.userData.buildStages = blueprint.stages;
  castleContainer.userData.blueprintVersion = CITADEL_BLUEPRINT_VERSION;
  castleContainer.userData.instanceId = options.instanceId ?? null; // 多城堡实例标识（null=高山圣城默认）
  castleContainer.userData.highlandLatestDesign = useHighlandLatestDesign;
  castleContainer.userData.highlandLatestDesignVersion = useHighlandLatestDesign
    ? HIGHLAND_CITADEL_DESIGN_VERSION
    : null;
  castleContainer.userData.highlandLatestDesignMetrics = highlandLatestDesign?.userData.latestDesign ?? null;
  castleContainer.userData.highlandLatestDesignRoot = highlandLatestDesign;
  castleContainer.userData.highlandAssaultAnchors = highlandLatestDesign?.userData.assaultAnchors ?? null;
  castleContainer.userData.floors = castleFloors; // 城堡层数（高山 5 / 运河古堡 12）
  castleContainer.userData.skipOuterTerrain = skipOuterTerrain; // 无台地模式（堤岸方框即地基）
  castleContainer.userData.townBaseLift = options.townBaseLift ?? 0.6;
  castleContainer.userData.spec = CITADEL;
  castleContainer.userData.contourSpec = contourSpec;
  castleContainer.userData.townBaseY = useHighlandLatestDesign
    ? HIGHLAND_TOWNSCAPER_BASE_Y
    : townBaseY;
  // 无台地模式：所有台地基座统一 = 方框水面平台抬升
  castleContainer.userData.townBaseYs = skipOuterTerrain
    ? townAssembly.baseYs.map(() => options.townBaseLift ?? 0.6)
    : useHighlandLatestDesign
      ? townAssembly.baseYs.map(() => HIGHLAND_TOWNSCAPER_BASE_Y)
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
  castleContainer.userData.townSurfaceConformance = useHighlandLatestDesign
    ? townAssembly.surfaceConformance?.[0] ?? null
    : null;
  castleContainer.userData.mainOutlinedSurfaceCount = mainOutlinedSurfaceCount;
  castleContainer.userData.terrainOutlinedSurfaceCount = terrainOutlinedSurfaceCount;
  castleContainer.userData.outlinedSurfaceCount =
    mainOutlinedSurfaceCount + terrainOutlinedSurfaceCount;
  castleContainer.userData.gradientMap = townAssembly.gradientMap;
  // 性能：Townscaper 小镇按材质静态合并（窗口/台地拾取/塔树拾取跳过；
  // cell 面映射供 3D 直编辑）。在窗口灯绑定前执行，合并不动窗口网格。
  mergeCitadelTownStatic(castleContainer);
  if (skipOuterTerrain) {
    sealCitadelBuildingsOpaque(castleContainer);
    refreshCanalTownReflection(castleContainer);
  }
  // 拱窗夜景：收集 town-window 并绑定昼夜材质
  refreshCitadelWindowLights(castleContainer);
  attachSvarbovaLightRig(castleContainer, citadelAssembly);
  // 正红人偶仅供旧版 Svarbova 材质基准测试；正式高山圣城不得混入测试模型。
  if (!useHighlandLatestDesign) {
    placeSvarbovaRedFigure(castleContainer, skipOuterTerrain, options.townBaseLift ?? 0.6);
  }

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
  // 布局热重建同样先过蓝图编译器，保证编辑器和首次生成完全同构。
  const blueprint = createCitadelBlueprint({
    spec,
    contour: castleContainer.userData.contourSpec ?? CITADEL.contourTerrain,
    floors: castleContainer.userData.floors ?? CITADEL_CASTLE_FLOORS,
    instanceId: castleContainer.userData.instanceId ?? null,
    skipOuterTerrain: castleContainer.userData.skipOuterTerrain === true,
    townBaseLift: castleContainer.userData.townBaseLift ?? 0.6,
  });
  const assembly = buildCitadelTerraceTownAssembly(
    blueprint.town.layout,
    blueprint.terrain.config,
    {
      floors: blueprint.floors,
      // 无台地模式：基座保持方框水面平台抬升（防热重建后城堡悬空）
      baseYOverride: castleContainer.userData.skipOuterTerrain
        ? castleContainer.userData.townBaseLift ?? 0.6
        : castleContainer.userData.highlandTownscaperGrid
          ? HIGHLAND_TOWNSCAPER_BASE_Y
          : undefined,
      surfaceProvider: castleContainer.userData.highlandTownscaperGrid
        ? HIGHLAND_TOWNSCAPER_PLATFORM.surfaceProvider
        : "uniform-town-base",
      leanDecor: castleContainer.userData.skipOuterTerrain === true,
      // 热重建保持实例配色：运河交汇古堡仍是 Townscaper 高饱和彩城
      townscaperColors: castleContainer.userData.instanceId === "canal-junction",
      highlandColors: castleContainer.userData.instanceId !== "canal-junction",
    }
  );
  applyInkOutlines(assembly.group, true, TOWNSCAPER_OUTLINE_COLOR);
  assembly.terraceLevels.forEach((terrace) => {
    terrace.forEach((levelGroup, floorIndex) => {
      layers[floorIndex].add(levelGroup);
    });
  });
  // 热重建后再次静态合并（幂等：先清旧合并网格）；窗口/拾取依赖同上
  mergeCitadelTownStatic(castleContainer);
  if (castleContainer.userData.skipOuterTerrain) {
    sealCitadelBuildingsOpaque(castleContainer);
    refreshCanalTownReflection(castleContainer);
  }
  castleContainer.userData.townStats = assembly.stats;
  castleContainer.userData.townSurfaceConformance = castleContainer.userData.highlandTownscaperGrid
    ? assembly.surfaceConformance?.[0] ?? null
    : null;
  castleContainer.userData.townSpec = assembly.layout;
  castleContainer.userData.blueprint = blueprint;
  castleContainer.userData.blueprintSummary = citadelBlueprintSummary(blueprint);
  castleContainer.userData.buildStages = blueprint.stages;
  if (castleContainer.userData.skipOuterTerrain) {
    const lift = castleContainer.userData.townBaseLift ?? 0.6;
    const n = Math.max(1, assembly.baseYs?.length ?? 1);
    castleContainer.userData.townBaseY = lift;
    castleContainer.userData.townBaseYs = Array.from({ length: n }, () => lift);
    ensureSkipOuterTerrainEditPad(castleContainer);
  } else if (castleContainer.userData.highlandTownscaperGrid) {
    const n = Math.max(1, assembly.baseYs?.length ?? 1);
    castleContainer.userData.townBaseY = HIGHLAND_TOWNSCAPER_BASE_Y;
    castleContainer.userData.townBaseYs = Array.from({ length: n }, () => HIGHLAND_TOWNSCAPER_BASE_Y);
    ensureSkipOuterTerrainEditPad(castleContainer);
  } else {
    castleContainer.userData.townBaseYs = assembly.baseYs;
  }
  // 布局热重建后窗口列表与夜灯材质需刷新
  castleContainer.userData.gradientMap =
    castleContainer.userData.gradientMap ?? assembly.gradientMap ?? makeThreeStepGradient();
  refreshCitadelWindowLights(castleContainer);
  attachSvarbovaLightRig(castleContainer, castleContainer.userData.mainCastle);
  if (!castleContainer.userData.highlandTownscaperGrid) {
    placeSvarbovaRedFigure(
      castleContainer,
      castleContainer.userData.skipOuterTerrain === true,
      castleContainer.userData.townBaseLift ?? 0.6
    );
  }
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
  const blueprint = createCitadelBlueprint({
    spec: castleContainer.userData.townSpec ?? CITADEL_TOWN_SPEC,
    contour: normalized,
    floors: castleContainer.userData.floors ?? CITADEL_CASTLE_FLOORS,
    instanceId: castleContainer.userData.instanceId ?? null,
    skipOuterTerrain: false,
    townBaseLift: castleContainer.userData.townBaseLift ?? 0.6,
    terrainObjects: castleContainer.userData.terrainObjectsSpec ?? [],
  });
  const system = buildOuterCitadelTerrain(
    castleContainer.userData.terrainMaterials,
    normalized
  );
  const outlined = applyInkOutlines(system);
  castleContainer.add(system);
  castleContainer.userData.outerTerrainSystem = system;
  castleContainer.userData.contourSpec = normalized;
  castleContainer.userData.blueprint = blueprint;
  castleContainer.userData.blueprintSummary = citadelBlueprintSummary(blueprint);
  castleContainer.userData.buildStages = blueprint.stages;

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
  const blueprint = createCitadelBlueprint({
    spec: castleContainer.userData.townSpec ?? CITADEL_TOWN_SPEC,
    contour: castleContainer.userData.contourSpec,
    floors: castleContainer.userData.floors ?? CITADEL_CASTLE_FLOORS,
    instanceId: castleContainer.userData.instanceId ?? null,
    skipOuterTerrain: castleContainer.userData.skipOuterTerrain === true,
    townBaseLift: castleContainer.userData.townBaseLift ?? 0.6,
    terrainObjects: normalized,
  });
  const group = buildCitadelTerrainObjects(
    blueprint.objects,
    blueprint.terrain.config,
    castleContainer.userData.anchor
  );
  castleContainer.add(group);
  castleContainer.userData.terrainObjects = group;
  castleContainer.userData.terrainObjectsSpec = blueprint.objects;
  castleContainer.userData.blueprint = blueprint;
  castleContainer.userData.blueprintSummary = citadelBlueprintSummary(blueprint);
  castleContainer.userData.buildStages = blueprint.stages;
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
