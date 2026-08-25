// =====================================================================
//  主游戏可调参数 + localStorage 持久化（开发者菜单实时读写）
// =====================================================================

// 版本号升 v2：使旧存档（曾把 aircraftScale 误调到 10）失效，统一回新默认值。
const STORAGE_KEY = "tm.devParams.v2";

import { isLightingQualityName } from "../render/lighting/lightingQuality.js";

export const P_DEFAULTS = Object.freeze({
  moveSpeed: 7.2,
  sprintMult: 1.45,
  gravity: 22.0,
  jumpV: 9.5,
  camLerp: 6.5,
  upLerp: 4.0,
  camDist: 7.5,
  talkRange: 3.2,
  tramSpeed: 7, // 电车行驶速度（地图扩大后默认 7；开发者菜单可调）
  aircraftSpeed: 2.6, // 空中鲸群：城↔店单程≈4分钟（苔庭鲸每~4分钟升空一次）
  aircraftScale: 1.0, // 飞行器体积：1 = 原始尺寸（缩小编队，避免遮挡场景）
  aircraftHoldSec: 36, // 站点上空滞空更久，像鲸群盘桓
  windSpeed: 0.8, // 风速（云漂移与拉伸）
  windDir: 45, // 风向（度，世界 XZ 平面方位角）
  daySpeed: 0.4, // 昼夜速度（0=暂停，1=90 秒一昼夜）
  timeOfDay: 0.5, // 时刻（0 午夜 / 0.28 朝霞 / 0.5 正午 / 0.75 暮云）
  weather: 0, // 天气：0 晴 / 1 雨（带闪电） / 2 雪
  sunIntensity: 1.6,
  ambientIntensity: 1.4, // 纯白强环境光：Toon 色块不掉死黑（1.2~1.5）
});

/** 运行时可变参数（每帧被玩家/相机/交互读取） */
export const P = { ...P_DEFAULTS };

/** 从 localStorage 加载；非法字段忽略 */
export function loadParams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return false;
    for (const k of Object.keys(P_DEFAULTS)) {
      const value = +data[k];
      // 缩放为 0 或负数会让整支 aircraft 编队不可见，忽略这类旧存档值。
      if (!Number.isFinite(value)) continue;
      if (k === "aircraftScale" && value <= 0) continue;
      P[k] = value;
    }
    return true;
  } catch {
    return false;
  }
}

/** 写入 localStorage */
export function saveParams() {
  try {
    const payload = {};
    for (const k of Object.keys(P_DEFAULTS)) payload[k] = P[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

/** 恢复出厂 */
export function resetParams() {
  Object.assign(P, P_DEFAULTS);
  saveParams();
}

// ---------- 功能开关 ----------
// 不进 P_DEFAULTS：只用 URL。V4 有蓝图就编译；开关只开 overlay / V3 仿真 / V2 旧图。
// 旧 citadelTown/Range/phalanx 已标 @legacy。?v4Debug=1 挂模块 overlay。
//   ?citadelCombatV2=1&citadelTownV4=1&citadelTerrainUvV2=1&citadelCombatV3=1&v4Debug=1&seed=42
export const FEATURES = {
  citadelCombatV2: false, // @legacy 环采样战术图；默认关，V4 用 surfaceGraph
  citadelTownV4: false, // true 才隐藏 legacy 镇体并挂 V4 presentationMesh；同时 walkLift 改走 snapshot
  citadelTerrainUvV2: false, // 显式声明走 SurfaceProvider walk；关=legacy walkLift，禁止与 V6 外观混用
  citadelCombatV3: false, // 表面图战斗仿真（不替换 @legacy phalanx 运兵）
  citadelPaletteV3: false, // V3 Bad North 语义配色（world/citadelVisualTheme.js）；关=旧色板
  oskLightingV1: false, // V5 光照（render/lighting/lightingDirector.js）；关=旧四灯管线
  voxelAoV1: false, // K3 体素 AO 垂直样片（render/ao/）；仅 V5 开启时有意义
  // K5 单次色彩反弹（render/ao/voxelBounce.js）；仅 high 档 + V5 + AO 时有意义
  voxelBounceV1: false,
  // K7 质量分档（render/lighting/lightingQuality.js）：low/medium/high
  lightingQuality: "medium",
  // K4 局部灯预算（render/lighting/localLight*）；null=跟随 V5，0/1 可显式覆盖
  localLightBudgetV1: null,
  procgenEngineV1: false, // V7 引擎 debug API（procgen/）；生产画面保持 V6/legacy（V7-G17 阶段一）
  wfcCastleV1: false, // V7 WFC 城堡求解；关=V6 constraintSolver 路径（阶段二启用）
  marchingTerrainV1: false, // V7 Marching Cubes 地形；关=citadelRange @legacy（阶段三起）
  // V8 球形自然世界：默认关闭，只有 snapshot、视觉和性能门禁通过后才开启。
  planetGraphV1: false,
  planetTerrainV1: false,
  curvedWaterV1: false,
  terrainSemanticShaderV1: false,
  cloudImpostorV1: false,
  oceanWorldRoutesV1: false,
  planetSurfaceRidersV1: false,
  legacyCanalWorld: true,
  // shot-harness / 主系统 A-B-C 展示版本；只描述运行时管线，不替代各 feature flag。
  // 默认进入页必须是 custom/legacy：点 C 或带 worldVersion=v9 才进 V9。
  planetPresentationVersion: "legacy",
  worldVersion: "custom",
  combatSeed: 1,
  townSeed: 1,
  terrainSeed: 1,
};

function readFlag(q, key) {
  const v = q.get(key);
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return null;
}

export const WORLD_VERSION_PRESETS = Object.freeze({
  v7: Object.freeze({
    procgenEngineV1: true,
    wfcCastleV1: true,
    marchingTerrainV1: true,
    planetGraphV1: false,
    planetTerrainV1: false,
    curvedWaterV1: false,
    terrainSemanticShaderV1: false,
    cloudImpostorV1: false,
    oceanWorldRoutesV1: false,
    planetSurfaceRidersV1: false,
    legacyCanalWorld: true,
    planetPresentationVersion: "v7",
  }),
  v8: Object.freeze({
    procgenEngineV1: true,
    wfcCastleV1: true,
    marchingTerrainV1: true,
    planetGraphV1: true,
    planetTerrainV1: true,
    curvedWaterV1: true,
    terrainSemanticShaderV1: true,
    cloudImpostorV1: true,
    oceanWorldRoutesV1: true,
    planetSurfaceRidersV1: false,
    legacyCanalWorld: false,
    planetPresentationVersion: "v8",
  }),
  v9: Object.freeze({
    procgenEngineV1: true,
    wfcCastleV1: true,
    marchingTerrainV1: true,
    planetGraphV1: true,
    planetTerrainV1: true,
    curvedWaterV1: true,
    terrainSemanticShaderV1: true,
    cloudImpostorV1: true,
    oceanWorldRoutesV1: true,
    planetSurfaceRidersV1: true,
    legacyCanalWorld: false,
    planetPresentationVersion: "v9",
  }),
});

/** 将经过测试的 V7/V8/V9 组合一次性写入 FEATURES，避免半开半关的混合态。 */
export function applyWorldVersionPreset(version) {
  const key = String(version || "").toLowerCase();
  const preset = WORLD_VERSION_PRESETS[key];
  if (!preset) return false;
  Object.assign(FEATURES, preset, { worldVersion: key });
  return true;
}

/** 从 URL 查询串读取开关（在场景构建之前调用一次） */
export function applyUrlOverrides(search) {
  if (typeof search !== "string" || !search) return;
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const v2 = readFlag(q, "citadelCombatV2");
  if (v2 !== null) FEATURES.citadelCombatV2 = v2;
  const town = readFlag(q, "citadelTownV4");
  if (town !== null) FEATURES.citadelTownV4 = town;
  const uv = readFlag(q, "citadelTerrainUvV2");
  if (uv !== null) FEATURES.citadelTerrainUvV2 = uv;
  const v3 = readFlag(q, "citadelCombatV3");
  if (v3 !== null) FEATURES.citadelCombatV3 = v3;
  const paletteV3 = readFlag(q, "citadelPaletteV3");
  if (paletteV3 !== null) FEATURES.citadelPaletteV3 = paletteV3;
  const oskLighting = readFlag(q, "oskLightingV1");
  if (oskLighting !== null) FEATURES.oskLightingV1 = oskLighting;
  const voxelAo = readFlag(q, "voxelAoV1");
  if (voxelAo !== null) FEATURES.voxelAoV1 = voxelAo;
  const voxelBounce = readFlag(q, "voxelBounceV1");
  if (voxelBounce !== null) FEATURES.voxelBounceV1 = voxelBounce;
  const lightingQuality = q.get("lightingQuality");
  if (isLightingQualityName(lightingQuality)) FEATURES.lightingQuality = lightingQuality;
  const localLight = readFlag(q, "localLightBudgetV1");
  if (localLight !== null) FEATURES.localLightBudgetV1 = localLight;
  const procgen = readFlag(q, "procgenEngineV1");
  if (procgen !== null) FEATURES.procgenEngineV1 = procgen;
  const wfcCastle = readFlag(q, "wfcCastleV1");
  if (wfcCastle !== null) FEATURES.wfcCastleV1 = wfcCastle;
  const mcTerrain = readFlag(q, "marchingTerrainV1");
  if (mcTerrain !== null) FEATURES.marchingTerrainV1 = mcTerrain;
  // Shot/QA convenience switch: enables the complete opt-in Planet V8
  // presentation stack without changing the legacy default scene.
  const planetOskar = readFlag(q, "planetOskarV1");
  if (planetOskar === true) {
    FEATURES.planetGraphV1 = true;
    FEATURES.planetTerrainV1 = true;
    FEATURES.curvedWaterV1 = true;
    FEATURES.terrainSemanticShaderV1 = true;
    FEATURES.cloudImpostorV1 = true;
    FEATURES.oceanWorldRoutesV1 = true;
    if (!["v8", "v9"].includes(FEATURES.planetPresentationVersion)) {
      FEATURES.planetPresentationVersion = "v8";
    }
  }
  for (const key of [
    "planetGraphV1",
    "planetTerrainV1",
    "curvedWaterV1",
    "terrainSemanticShaderV1",
    "cloudImpostorV1",
    "oceanWorldRoutesV1",
    "planetSurfaceRidersV1",
    "legacyCanalWorld",
  ]) {
    const value = readFlag(q, key);
    if (value !== null) FEATURES[key] = value;
  }
  // worldVersion 是主系统 A/B/C 的原子选择。放在逐项 flag 之后应用，确保
  // 切换不会留下上一版本残余参数；需要诊断单个 flag 时不传 worldVersion 即可。
  const worldVersion = q.get("worldVersion");
  if (worldVersion) applyWorldVersionPreset(worldVersion);
  const presentationVersion = q.get("planetPresentationVersion");
  if (["v7", "v8", "v9"].includes(presentationVersion)) {
    FEATURES.planetPresentationVersion = presentationVersion;
  }
  // 注意 +null===0：缺省参数必须先判空，否则会把 seed 冲成 0
  const rawSeed = q.get("seed") ?? q.get("combatSeed");
  const seed = rawSeed == null ? NaN : +rawSeed;
  if (Number.isFinite(seed)) FEATURES.combatSeed = seed >>> 0;
  const rawTownSeed = q.get("townSeed");
  const townSeed = rawTownSeed == null ? NaN : +rawTownSeed;
  if (Number.isFinite(townSeed)) FEATURES.townSeed = townSeed >>> 0;
  const rawTerrainSeed = q.get("terrainSeed");
  const terrainSeed = rawTerrainSeed == null ? NaN : +rawTerrainSeed;
  if (Number.isFinite(terrainSeed)) FEATURES.terrainSeed = terrainSeed >>> 0;
}

/** V4 层开关。编译不再依赖这些标志；@legacy 网格文件仍提供 Three 外观。 */
export function isCitadelTownV4() {
  return FEATURES.citadelTownV4 === true;
}
export function isCitadelTerrainUvV2() {
  return FEATURES.citadelTerrainUvV2 === true;
}
export function isCitadelCombatV3() {
  return FEATURES.citadelCombatV3 === true;
}
export function isCitadelPaletteV3() {
  return FEATURES.citadelPaletteV3 === true;
}
export function isOskLightingV1() {
  return FEATURES.oskLightingV1 === true;
}
/** K3 体素 AO 垂直样片：仅 V5 开启时有意义（挂在 ?oskLightingV1=1 之下） */
export function isVoxelAoV1() {
  return FEATURES.voxelAoV1 === true;
}
/** K5 单次色彩反弹：独立开关，且仅在 V5+AO+high 档下才可能生效（能力门控见 render/ao/voxelBounce.js） */
export function isVoxelBounceV1() {
  return FEATURES.voxelBounceV1 === true && FEATURES.voxelAoV1 === true && FEATURES.oskLightingV1 === true;
}
/** K7 质量分档名（low/medium/high），URL ?lightingQuality= 可覆盖 */
export function getLightingQuality() {
  return FEATURES.lightingQuality;
}
/** K4 局部灯预算：挂在 V5 之下，缺省跟随 V5（?localLightBudgetV1=0/1 显式覆盖） */
export function isLocalLightBudgetV1() {
  return (FEATURES.localLightBudgetV1 ?? FEATURES.oskLightingV1) === true;
}
export function isAnyCitadelV4() {
  return isCitadelTownV4() || isCitadelTerrainUvV2() || isCitadelCombatV3();
}
/** V7 引擎 debug API（阶段一：只暴露调试入口，不改生产画面） */
export function isProcgenEngineV1() {
  return FEATURES.procgenEngineV1 === true;
}
/** V7 WFC 城堡求解（阶段二：可独立回滚到 V6 constraintSolver） */
export function isWfcCastleV1() {
  return FEATURES.wfcCastleV1 === true;
}
/** V7 Marching Cubes 地形（阶段三起：苔庭+L1 瀑布样片先行） */
export function isMarchingTerrainV1() {
  return FEATURES.marchingTerrainV1 === true;
}

export function isPlanetGraphV1() {
  return FEATURES.planetGraphV1 === true;
}
export function isPlanetTerrainV1() {
  return FEATURES.planetTerrainV1 === true;
}
export function isCurvedWaterV1() {
  return FEATURES.curvedWaterV1 === true;
}
export function isTerrainSemanticShaderV1() {
  return FEATURES.terrainSemanticShaderV1 === true;
}
export function isCloudImpostorV1() {
  return FEATURES.cloudImpostorV1 === true;
}
export function isOceanWorldRoutesV1() {
  return FEATURES.oceanWorldRoutesV1 === true;
}
export function isPlanetSurfaceRidersV1() {
  return FEATURES.planetSurfaceRidersV1 === true;
}
export function getWorldVersion() {
  return FEATURES.worldVersion;
}
export function getPlanetPresentationVersion() {
  return FEATURES.planetPresentationVersion;
}

/** A/B/C 当前世界。无 URL、无原子 preset 时返回 custom，绝不默认落到 V9。 */
export function resolveActiveWorldVersion({ search = "", features = FEATURES } = {}) {
  const q = new URLSearchParams(typeof search === "string" && search.startsWith("?") ? search.slice(1) : search);
  const fromUrl = q.get("worldVersion");
  if (WORLD_VERSION_PRESETS[fromUrl]) return fromUrl;
  if (WORLD_VERSION_PRESETS[features.worldVersion]) return features.worldVersion;
  if (features.planetTerrainV1) {
    if (features.planetPresentationVersion === "v9") return "v9";
    return "v8";
  }
  if (features.procgenEngineV1 || features.wfcCastleV1 || features.marchingTerrainV1) return "v7";
  return "custom";
}

// 启动时自动加载
loadParams();
// URL 开关必须在 import 阶段生效：scenes/registry 在 main.js 顶层加载场景、
// 场景内部随即创建攻城/木马系统并读取 FEATURES。
if (typeof location !== "undefined") applyUrlOverrides(location.search);
