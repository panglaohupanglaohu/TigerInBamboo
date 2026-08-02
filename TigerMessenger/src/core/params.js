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
      if (Number.isFinite(+data[k])) P[k] = +data[k];
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
