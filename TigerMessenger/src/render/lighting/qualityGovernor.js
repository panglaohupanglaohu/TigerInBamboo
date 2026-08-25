// =====================================================================
//  QualityGovernor — V5-K7 自动质量降级器（TODO 575）
//  输入帧时采样序列，输出目标 quality tier（lightingQuality.js 分档）。
//  规则：
//    - 稳定时间窗口：连续 downgradeHoldMs 超预算才降一档；
//      连续 upgradeHoldMs 低于恢复阈值才升一档（恢复窗口显著更长）；
//    - 滞回：降级阈值 budget*downgradeRatio 与恢复阈值
//      budget*upgradeRatio 分离，滞回带内的帧两边计时都清零，禁止抖动；
//    - 切档后 minDwellMs 驻留期内不允许再次切档；
//    - 每次切档记录结构化原因（code/from/to/时间戳/窗口统计）。
//  纯逻辑：不 import Three、不读时钟（时间戳由调用方给或用帧时累加），
//  同输入序列输出完全确定，可 Node 单测（tools/test_lighting_governor.mjs）。
// =====================================================================
import { LIGHTING_QUALITY_TIERS, isLightingQualityName } from "./lightingQuality.js";

// 档位从低到高的全序（降级 = 索引 -1，恢复 = 索引 +1）
export const QUALITY_GOVERNOR_ORDER = Object.freeze(["low", "medium", "high"]);

export const QUALITY_GOVERNOR_DEFAULTS = Object.freeze({
  budgetMs: 16.7, // 目标帧时预算（60fps）
  downgradeRatio: 1.0, // 帧时 > budget*1.0 计入超预算窗口
  upgradeRatio: 0.75, // 帧时 < budget*0.75 计入恢复窗口（滞回带 0.75~1.0 不动）
  downgradeHoldMs: 2000, // 连续超预算 2s 才降一档
  upgradeHoldMs: 8000, // 连续低于恢复阈值 8s 才升一档（更长稳定窗口）
  minDwellMs: 5000, // 切档后最短驻留，禁止频繁抖动
  windowSize: 60, // 原因日志中窗口统计保留的最近样本数
  maxLog: 64, // 原因日志环形上限
});

export const QUALITY_GOVERNOR_CODES = Object.freeze({
  downgrade: "DOWNGRADE_OVER_BUDGET",
  upgrade: "UPGRADE_STABLE_UNDER_BUDGET",
});

/**
 * @param {object} options
 *   { initialTier?: "low"|"medium"|"high"（缺省 high，非法回落 high）,
 *     ...QUALITY_GOVERNOR_DEFAULTS 任意覆盖 }
 */
export function createQualityGovernor(options = {}) {
  const cfg = { ...QUALITY_GOVERNOR_DEFAULTS, ...options };
  const startTier = isLightingQualityName(options.initialTier) ? options.initialTier : "high";
  let tierIndex = QUALITY_GOVERNOR_ORDER.indexOf(startTier);
  let clock = 0; // 未传时间戳时用帧时累加（确定性）
  let overSince = null; // 连续超预算窗口起点
  let underSince = null; // 连续低于恢复阈值窗口起点
  let lastSwitchAt = -Infinity;
  const windowSamples = [];
  const log = [];

  function windowStats() {
    let sum = 0;
    let max = 0;
    for (const v of windowSamples) {
      sum += v;
      if (v > max) max = v;
    }
    return Object.freeze({
      samples: windowSamples.length,
      avgMs: windowSamples.length ? sum / windowSamples.length : 0,
      maxMs: max,
    });
  }

  function switchTier(nextIndex, code, at, holdMs) {
    const entry = Object.freeze({
      code,
      from: QUALITY_GOVERNOR_ORDER[tierIndex],
      to: QUALITY_GOVERNOR_ORDER[nextIndex],
      at,
      holdMs,
      budgetMs: cfg.budgetMs,
      window: windowStats(),
    });
    tierIndex = nextIndex;
    lastSwitchAt = at;
    overSince = null; // 切档后窗口重新累计，配合 minDwell 双保险防抖
    underSince = null;
    log.push(entry);
    if (log.length > cfg.maxLog) log.shift();
    return entry;
  }

  return {
    /**
     * 喂一帧。返回本次切档的结构化原因记录，未切档返回 null。
     * @param {number} frameMs 本帧耗时
     * @param {number} [atMs] 时间戳；缺省用帧时累加（纯确定性）
     */
    sample(frameMs, atMs) {
      const ms = Number.isFinite(frameMs) ? frameMs : 0;
      const at = Number.isFinite(atMs) ? atMs : (clock += ms);
      windowSamples.push(ms);
      if (windowSamples.length > cfg.windowSize) windowSamples.shift();

      // 滞回：超 budget*downgradeRatio 才累计降级窗口，
      // 低于 budget*upgradeRatio 才累计恢复窗口；滞回带内两边清零
      const overLimit = cfg.budgetMs * cfg.downgradeRatio;
      const underLimit = cfg.budgetMs * cfg.upgradeRatio;
      if (ms > overLimit) {
        if (overSince == null) overSince = at;
      } else {
        overSince = null;
      }
      if (ms < underLimit) {
        if (underSince == null) underSince = at;
      } else {
        underSince = null;
      }

      const dwellOk = at - lastSwitchAt >= cfg.minDwellMs;
      if (tierIndex > 0 && dwellOk && overSince != null && at - overSince >= cfg.downgradeHoldMs) {
        return switchTier(tierIndex - 1, QUALITY_GOVERNOR_CODES.downgrade, at, cfg.downgradeHoldMs);
      }
      if (
        tierIndex < QUALITY_GOVERNOR_ORDER.length - 1 &&
        dwellOk &&
        underSince != null &&
        at - underSince >= cfg.upgradeHoldMs
      ) {
        return switchTier(tierIndex + 1, QUALITY_GOVERNOR_CODES.upgrade, at, cfg.upgradeHoldMs);
      }
      return null;
    },

    getTier: () => QUALITY_GOVERNOR_ORDER[tierIndex],
    /** 当前档位的完整能力声明（lightingQuality.js） */
    getTierSpec: () => LIGHTING_QUALITY_TIERS[QUALITY_GOVERNOR_ORDER[tierIndex]],
    /** 结构化原因日志（浅拷贝；条目本身 frozen） */
    getLog: () => log.slice(),
    getConfig: () => Object.freeze({ ...cfg }),
  };
}
