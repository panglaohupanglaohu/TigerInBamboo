// =====================================================================
//  主游戏可调参数 + localStorage 持久化（开发者菜单实时读写）
// =====================================================================

// 版本号升 v2：使旧存档（曾把 aircraftScale 误调到 10）失效，统一回新默认值。
const STORAGE_KEY = "tm.devParams.v2";

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

// ---------- 功能开关（P0 · 高山城堡攻防 V2） ----------
// 不进 P_DEFAULTS：开关不参与开发者菜单与 localStorage 持久化，
// 只用 URL 参数控制（?citadelCombatV2=1&seed=42），默认关闭时完整保留现有流程。
export const FEATURES = {
  citadelCombatV2: false, // 攻防 V2 总开关：战术导航图 / 个体代理（P0~P1 阶段先接管随机源与事件记录）
  combatSeed: 1, // 攻防种子随机源；同 seed + 同输入 → 同事件序列
};

/** 从 URL 查询串读取开关（在场景构建之前调用一次） */
export function applyUrlOverrides(search) {
  if (typeof search !== "string" || !search) return;
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (q.get("citadelCombatV2") === "1") FEATURES.citadelCombatV2 = true;
  const seed = +(q.get("seed") ?? q.get("combatSeed"));
  if (Number.isFinite(seed)) FEATURES.combatSeed = seed >>> 0;
}

// 启动时自动加载
loadParams();
// URL 开关必须在 import 阶段生效：scenes/registry 在 main.js 顶层加载场景、
// 场景内部随即创建攻城/木马系统并读取 FEATURES。
if (typeof location !== "undefined") applyUrlOverrides(location.search);
