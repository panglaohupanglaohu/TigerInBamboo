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
  // S18 夜港辉光（主人验收 2026-08-28 参考图夜港）：迷你 bloom 后处理，
  // 只让灯头/窗光/塔冠这类超亮自发光起晕；强度随夜权重（白天自动直出）。
  // 开关就是开关：2026-09-02 删掉了「持续低帧就自动关 bloom」的降级器。
  // 它只降不恢复（注释声称会恢复，代码里根本没有那条路径），而且会在
  // 不知情时改变画面与性能对照基线。回滚：?nightBloomV1=0
  nightBloomV1: true,
  nightBloomStrength: 0.7,
  nightBloomThreshold: 0.72,
  // 距离剔除：小件静态装饰超出视距即不提交绘制。
  // 2026-09-02 保持**默认关闭**：已修复动态物快照、包围球中心、maxObjectRadius，
  // 但实测表明瓶颈在片元光照（~85 盏灯）而非 draw call，本项收益小；
  // 8/29 曾因远景误剔被主人回滚，需浏览器目验后再决定是否常开。
  // 打开：?distanceCullV1=1
  distanceCullV1: false,
  distanceCullMeters: 150,
  // 空闲灯剔除（2026-09-02）：Three 的 intensity=0 灯仍占 uniform 槽位并
  // 参与逐片元循环。实测（A-B-A 对照，漂移 0.9%）：78 盏点光/聚光
  // = 140ms / 62% 帧时间。强度≈0 的灯本来就不可见，隐藏零视觉变化。
  // 回滚：?idleLightCullV1=0
  idleLightCullV1: true,
  // 固定容量灯池（2026-09-02）：常驻 8 盏 PointLight，按「亮度/距离²」
  // 把它们移到最重要的灯位上。灯数恒定 → 永不触发材质重编译。
  // 开启时接管所有点光，idleLightCullV1 自动让位（两者会抢 visible）。
  // 回滚：?lightPoolV1=0
  lightPoolV1: true,
  lightPoolCapacity: 8,
  // 海面巡航战船数量。实测（A-B-A，漂移 2.6%）：8 艘 = 1730 万三角形
  // （全场 33%）/ 5.4ms。纯背景对象，主人 2026-09-02 定为 3 艘。
  // 回滚：?oceanWarshipCount=8
  oceanWarshipCount: 3,
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
  // V8 球形自然世界：默认关闭，只有 snapshot、视觉和性能门禁通过后才开启。
  planetTerrainV1: false,
  curvedWaterV1: false,
  terrainSemanticShaderV1: false,
  cloudImpostorV1: false,
  oceanWorldRoutesV1: false,
  planetSurfaceRidersV1: false,
  legacyCanalWorld: true,
  // 地理季相外观开关（2026-09-01）：按地表纬度对地被/植被染色。回滚：?seasonBandsV1=0
  seasonBandsV1: true,
  // 运河交汇古堡构建开关（2026-09-01 B4）：默认开启，?canalJunctionV1=0 可关闭以诊断成本
  canalJunctionV1: true,
  // 主系统 A-B-C 展示版本；只描述运行时管线，不替代各 feature flag。
  // 默认进入页永远是 custom/legacy，只有显式 ?worldVersion= 才切实验管线。
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
  v8: Object.freeze({
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
  // 世界档不再随日历漂移（2026-09-01 卡顿事故）：默认永远 custom，
  // 只有显式 ?worldVersion=v7|v8|v9 才切实验管线。
  // 事故经过：原 seasonWorldVersion() 按 new Date().getMonth() 选管线版本，
  // 9/1 首次落进「秋」区间，代码一行未改却自动点燃了从未联调过的 V9 重型管线。
  // 季节现由地理纬度驱动，见 world/seasonBands.js。
  FEATURES.worldVersion = "custom";
  FEATURES.planetPresentationVersion = "legacy";
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
  // 验收便捷：?timeOfDay=0.9 直设初始时刻（配合 ?autostart=1 截夜景）
  const todOverride = q.get("timeOfDay");
  if (todOverride !== null && Number.isFinite(parseFloat(todOverride))) {
    P.timeOfDay = Math.max(0, Math.min(1, parseFloat(todOverride)));
  }
  // 性能系统 URL 开关（卡顿二分定位/回滚用）
  for (const [flag, target] of [
    ["distanceCullV1", "P"],
    ["nightBloomV1", "P"],
    ["idleLightCullV1", "P"],
    ["lightPoolV1", "P"],
  ]) {
    const value = readFlag(q, flag);
    if (value !== null) {
      if (target === "P") P[flag] = value;
      else FEATURES[flag] = value;
    }
  }
  const poolCap = parseInt(q.get("lightPoolCapacity"), 10);
  if (Number.isFinite(poolCap) && poolCap >= 0) P.lightPoolCapacity = poolCap;
  const warships = parseInt(q.get("oceanWarshipCount"), 10);
  if (Number.isFinite(warships) && warships >= 0) P.oceanWarshipCount = warships;
  const localLight = readFlag(q, "localLightBudgetV1");
  if (localLight !== null) FEATURES.localLightBudgetV1 = localLight;
  // Shot/QA convenience switch: enables the complete opt-in Planet V8
  // presentation stack without changing the legacy default scene.
  const planetOskar = readFlag(q, "planetOskarV1");
  if (planetOskar === true) {
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
    "planetTerrainV1",
    "curvedWaterV1",
    "terrainSemanticShaderV1",
    "cloudImpostorV1",
    "oceanWorldRoutesV1",
    "planetSurfaceRidersV1",
    "legacyCanalWorld",
    "seasonBandsV1",
    "canalJunctionV1",
  ]) {
    const value = readFlag(q, key);
    if (value !== null) FEATURES[key] = value;
  }
  const canalJunctionShort = readFlag(q, "canalJunction");
  if (canalJunctionShort !== null) FEATURES.canalJunctionV1 = canalJunctionShort;
  // worldVersion 是主系统 B/C 的原子选择。放在逐项 flag 之后应用，确保
  // 切换不会留下上一版本残余参数；需要诊断单个 flag 时不传 worldVersion 即可。
  const worldVersion = q.get("worldVersion");
  if (worldVersion) applyWorldVersionPreset(worldVersion);
  const presentationVersion = q.get("planetPresentationVersion");
  if (["v8", "v9"].includes(presentationVersion)) {
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
export function isSeasonBandsV1() {
  return FEATURES.seasonBandsV1 !== false;
}
export function isCanalJunctionV1() {
  return FEATURES.canalJunctionV1 !== false;
}
export function getWorldVersion() {
  return FEATURES.worldVersion;
}
export function getPlanetPresentationVersion() {
  return FEATURES.planetPresentationVersion;
}

/** B/C 当前世界。无 URL、无原子 preset 时返回 custom，绝不默认落到 V9。 */
export function resolveActiveWorldVersion({ search = "", features = FEATURES } = {}) {
  const q = new URLSearchParams(typeof search === "string" && search.startsWith("?") ? search.slice(1) : search);
  const fromUrl = q.get("worldVersion");
  if (WORLD_VERSION_PRESETS[fromUrl]) return fromUrl;
  if (WORLD_VERSION_PRESETS[features.worldVersion]) return features.worldVersion;
  if (features.planetTerrainV1) {
    if (features.planetPresentationVersion === "v9") return "v9";
    return "v8";
  }
  return "custom";
}

// 启动时自动加载
loadParams();
// URL 开关必须在 import 阶段生效：scenes/registry 在 main.js 顶层加载场景、
// 场景内部随即创建攻城/木马系统并读取 FEATURES。
if (typeof location !== "undefined") applyUrlOverrides(location.search);
