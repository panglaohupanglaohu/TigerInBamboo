// =====================================================================
// V7 migration/default-on gate（V7-G17）
// 能力等级必须单向晋升；仅有代码测试不能自动打开生产开关。
// =====================================================================

export const CAPABILITY_LEVEL_ORDER = Object.freeze(["DEFINED", "TESTED", "WIRED", "PERF_ACCEPTED", "VISUAL_ACCEPTED", "DEFAULT_ON"]);

export function canPromote(from, to) {
  return CAPABILITY_LEVEL_ORDER.indexOf(to) >= CAPABILITY_LEVEL_ORDER.indexOf(from);
}

export function evaluateMigrationGate({ capabilities = [], requestedFlags = {}, visualAccepted = false, perfAccepted = false } = {}) {
  const errors = [];
  const levels = new Map(capabilities.map((c) => [c.id, c.level]));
  for (const [flag, capabilityId] of Object.entries(requestedFlags)) {
    const level = levels.get(capabilityId) || "DEFINED";
    if (level !== "DEFAULT_ON") errors.push({ flag, capabilityId, level, reason: "capability-not-default-on" });
    if (!visualAccepted) errors.push({ flag, reason: "visual-acceptance-required" });
    if (!perfAccepted) errors.push({ flag, reason: "performance-acceptance-required" });
  }
  return { ok: errors.length === 0, errors, flags: Object.fromEntries(Object.keys(requestedFlags).map((flag) => [flag, errors.length === 0])) };
}
