// =====================================================================
//  主游戏可调参数 + localStorage 持久化（开发者菜单实时读写）
// =====================================================================

const STORAGE_KEY = "tm.devParams.v1";

export const P_DEFAULTS = Object.freeze({
  moveSpeed: 7.2,
  sprintMult: 1.45,
  gravity: 22.0,
  jumpV: 9.5,
  camLerp: 6.5,
  upLerp: 4.0,
  camDist: 7.5,
  talkRange: 3.2,
  tramSpeed: 3.2, // 电车行驶速度（开发者菜单可调）
  aircraftSpeed: 1.65, // 空中鲸群：沉重缓巡（世界单位/秒）
  aircraftScale: 2.6, // 宏大压迫感体量（约原飞艇两倍以上）
  aircraftHoldSec: 36, // 站点上空滞空更久，像鲸群盘桓
  windSpeed: 0.8, // 风速（云漂移与拉伸）
  windDir: 45, // 风向（度，世界 XZ 平面方位角）
  daySpeed: 0.4, // 昼夜速度（0=暂停，1=90 秒一昼夜）
  timeOfDay: 0.5, // 时刻（0 午夜 / 0.28 朝霞 / 0.5 正午 / 0.75 暮云）
  weather: 0, // 天气：0 晴 / 1 雨（带闪电） / 2 雪
  sunIntensity: 1.6,
  ambientIntensity: 0.9, // 水墨：暖白环境光
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

// 启动时自动加载
loadParams();
