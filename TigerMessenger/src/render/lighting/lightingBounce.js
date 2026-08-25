// =====================================================================
// Opt-in bounce lighting（V5 K5）
// 只生成可序列化参数，不创建 Three Light；默认关闭，且有强度上限。
// 真正的局部灯仍必须通过 LocalLightRegistry，避免重复全局灯。
// =====================================================================

export const BOUNCE_LIMITS = Object.freeze({ maxIntensity: 0.18, maxMix: 0.35 });

export function composeBounceLighting({ enabled = false, intensity = 0, mix = 0, tint = "#FFFFFF" } = {}) {
  const safeIntensity = enabled ? Math.min(BOUNCE_LIMITS.maxIntensity, Math.max(0, Number(intensity) || 0)) : 0;
  const safeMix = enabled ? Math.min(BOUNCE_LIMITS.maxMix, Math.max(0, Number(mix) || 0)) : 0;
  return Object.freeze({ enabled: Boolean(enabled), intensity: safeIntensity, mix: safeMix, tint: String(tint).toUpperCase() });
}

export function applyBounceToState(state, options = {}) {
  return Object.freeze({ ...state, bounce: composeBounceLighting(options) });
}
