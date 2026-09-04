// =====================================================================
//  C13-7 · 太阳装置与逐窗错相点亮（PLAN §10.7）—— Claude 2026-09-04
//
//  S23 sheet_2 150–165s / sheet_3 190–200s：Townscaper 的太阳是一个
//  **二维摇杆（方位 × 高度）**，不是一条时间滑条；拖到夜侧后整场变冷蓝，
//  **窗口逐个亮起**暖橙——不是全城同一帧啪地一起亮。
//
//  本文件是这两件事的**纯函数内核**：不 import Three.js、不碰 DOM、不读 P，
//  所以 headless 可测，也不会把「光」和「窗」耦合进渲染管线。
//  · sunDirectionFromAngles  摇杆角度 → 单位方向（lightingState 用）
//  · sunElevationForPhase    时刻 → 太阳高度角（与 dayNight 的昼夜带对齐）
//  · nightFactor             高度角 → 夜色浓度 0..1（平滑，不是布尔）
//  · windowLitThreshold      窗身份 → 它自己的点亮阈值（错相的来源）
//  · rollWindowLit           当晚这扇窗亮不亮（确定性，替掉原来的 Math.random）
// =====================================================================

/** 昼夜带边界，与 dayNight.js 的 KEYS 一致：入夜 0.82，黎明 0.22。 */
export const DUSK_PHASE = 0.82;
export const DAWN_PHASE = 0.22;
/** 正午太阳高度角（度）。 */
export const MAX_SUN_ELEVATION = 75;
/** 窗全部点亮所跨的夜色浓度区间：错相就发生在这段里。 */
export const WINDOW_STAGGER_BAND = Object.freeze([0.06, 0.92]);

const DEG = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (u) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

/** 32-bit 确定性哈希（禁止 Math.random：夜景要能逐帧复现）。 */
export function sunRigHash(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= 0x9e3779b9; h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296; // 0..1
}

/**
 * 摇杆角度 → 世界方向（从场景指向太阳，单位长）。
 * azimuth：度，0 = +Z，顺时针为正（俯视）；elevation：度，0 = 地平线，90 = 天顶。
 * @returns {[number, number, number]}
 */
export function sunDirectionFromAngles(azimuthDeg, elevationDeg) {
  const az = (Number(azimuthDeg) || 0) * DEG;
  const el = Math.max(-90, Math.min(90, Number(elevationDeg) || 0)) * DEG;
  const c = Math.cos(el);
  return [Math.sin(az) * c, Math.sin(el), Math.cos(az) * c];
}

/**
 * 时刻 → 太阳高度角（度）。**分段**而不是单纯正弦：昼夜带不对称
 * （白天 0.22→0.82 占 0.6，夜 0.82→1.22 占 0.4），硬套正弦会让
 * 日出日落时刻与 dayNight 的调色关键帧对不上，天已经黑了太阳还在地平线上。
 */
export function sunElevationForPhase(phase) {
  const t = ((Number(phase) % 1) + 1) % 1;
  const dayLen = DUSK_PHASE - DAWN_PHASE;          // 0.60
  const nightLen = 1 - dayLen;                      // 0.40
  if (t >= DAWN_PHASE && t < DUSK_PHASE) {
    return MAX_SUN_ELEVATION * Math.sin(Math.PI * ((t - DAWN_PHASE) / dayLen));
  }
  const u = t >= DUSK_PHASE ? (t - DUSK_PHASE) / nightLen : (t + 1 - DUSK_PHASE) / nightLen;
  return -MAX_SUN_ELEVATION * Math.sin(Math.PI * u);
}

/** 时刻 → 摇杆方位角（度）：太阳东升西落，绕一圈。 */
export function sunAzimuthForPhase(phase) {
  const t = ((Number(phase) % 1) + 1) % 1;
  return (t * 360 + 90) % 360;
}

/**
 * 太阳高度角 → 夜色浓度 0..1。
 * 从 +2° 开始爬（还没落山天就先暗下来），到 −8° 满。区间给得窄，
 * 是因为 §10.7 要的是「拖到夜侧」的可感反馈，不是一条慢曲线。
 */
export function nightFactor(elevationDeg) {
  const el = Number(elevationDeg);
  if (!Number.isFinite(el)) return 0;
  return smoothstep((2 - el) / 10);
}

/**
 * 这扇窗自己的点亮阈值（夜色浓度到这个值它才亮）。
 * 阈值均匀铺在 WINDOW_STAGGER_BAND 里 —— 这就是「逐个亮起」：
 * 同一段夜色浓度变化里，不同窗跨过阈值的时刻自然错开。
 * @param {string|number} id 窗身份（houseId / 索引 / 世界坐标串都行）
 */
export function windowLitThreshold(id) {
  const [lo, hi] = WINDOW_STAGGER_BAND;
  return lo + (hi - lo) * sunRigHash("winlit", id);
}

/**
 * 当晚这扇窗亮不亮（确定性，替掉原来的 Math.random）。
 * nightIndex 让「每晚重掷」仍然成立，但同一晚重放结果一样。
 */
export function rollWindowLit(id, nightIndex, chance) {
  return sunRigHash("roll", nightIndex, id) < chance;
}

/**
 * 给定夜色浓度，这扇窗现在该不该亮。
 * @param {number} factor nightFactor 的输出
 * @param {string|number} id 窗身份
 */
export function windowIsLit(factor, id) {
  return factor >= windowLitThreshold(id);
}
