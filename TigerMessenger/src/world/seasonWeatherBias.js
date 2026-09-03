// =====================================================================
// 季相天气偏置：按玩家当前所处季相带温和偏置天气模式。
// 冬季偏雪 (2)，春季偏雨 (1)，夏/秋偏晴 (0)。
// 带有滞后防抖（默认 3 秒），玩家手动锁定/指定天气时不强制覆盖。
// =====================================================================

export const SEASON_WEATHER_MAP = Object.freeze({
  winter: 2, // 雪
  spring: 1, // 雨
  summer: 0, // 晴
  autumn: 0, // 晴
});

/**
 * 创建季相天气状态机
 * @param {object} [opts]
 * @param {string} [opts.initialSeason]
 * @param {number} [opts.hysteresisSec] 切换滞后防抖时长（秒）
 */
export function createSeasonWeatherBias({ initialSeason = "summer", hysteresisSec = 3.0 } = {}) {
  let activeSeason = initialSeason;
  let pendingSeason = initialSeason;
  let pendingTimer = 0;

  return {
    update(dt, currentSeason, P = null) {
      if (!currentSeason) return activeSeason;

      const delta = Number(dt) || 0;
      if (currentSeason !== pendingSeason) {
        pendingSeason = currentSeason;
        pendingTimer = delta;
      } else if (pendingSeason !== activeSeason) {
        pendingTimer += delta;
      }
      if (pendingSeason !== activeSeason && pendingTimer >= hysteresisSec) {
        activeSeason = pendingSeason;
        if (P && !P.weatherLocked) {
          const targetWeather = SEASON_WEATHER_MAP[activeSeason] ?? 0;
          P.weather = targetWeather;
        }
      }
      return activeSeason;
    },
    getActiveSeason: () => activeSeason,
    getPendingSeason: () => pendingSeason,
    reset(season) {
      activeSeason = season || "summer";
      pendingSeason = activeSeason;
      pendingTimer = 0;
    },
  };
}
