// =====================================================================
//  V4 G0 基线目录：5 天气 × 5 镜头 + 瀑布近景 + 单格编辑 + 港口攻城 + 深夜木马 = 29
//  纯数据，不 import Three.js。
// =====================================================================

export const CITADEL_V4_WEATHERS = Object.freeze([
  "clear",
  "sunset",
  "rain",
  "snow",
  "night",
]);

export const CITADEL_V4_CAMERAS = Object.freeze([
  "citadel-overview",
  "harbor",
  "waterfall-l1",
  "siege-clash",
  "trojan-infil",
]);

/** 天气 token → 现有 P.weather / P.timeOfDay */
export const CITADEL_V4_WEATHER_PARAMS = Object.freeze({
  clear: { weather: 0, timeOfDay: 0.5 },
  sunset: { weather: 0, timeOfDay: 0.75 },
  rain: { weather: 1, timeOfDay: 0.5 },
  snow: { weather: 2, timeOfDay: 0.5 },
  night: { weather: 0, timeOfDay: 0.9 },
});

export const CITADEL_V4_SEEDS = Object.freeze({
  combat: 7,
  town: 1,
  terrain: 1,
});

function shotId(weather, camera) {
  return `${weather}/${camera}`;
}

const weatherShots = CITADEL_V4_WEATHERS.flatMap((weather) =>
  CITADEL_V4_CAMERAS.map((camera) =>
    Object.freeze({
      id: shotId(weather, camera),
      kind: "shot",
      weather,
      camera,
      ...CITADEL_V4_WEATHER_PARAMS[weather],
    })
  )
);

export const CITADEL_V4_BASELINES = Object.freeze([
  ...weatherShots,
  Object.freeze({
    id: "waterfall-l1-close",
    kind: "shot",
    weather: "clear",
    camera: "waterfall-l1-close",
    ...CITADEL_V4_WEATHER_PARAMS.clear,
  }),
  Object.freeze({
    id: "single-cell-edit",
    kind: "edit",
    weather: "clear",
    camera: "citadel-overview",
  }),
  Object.freeze({
    id: "harbor-siege",
    kind: "sim",
    scenario: "harbor-landing",
    seed: CITADEL_V4_SEEDS.combat,
  }),
  Object.freeze({
    id: "night-horse",
    kind: "sim",
    scenario: "trojan-night",
    seed: CITADEL_V4_SEEDS.combat,
  }),
]);

if (CITADEL_V4_BASELINES.length !== 29) {
  throw new Error(`CITADEL_V4_BASELINES 应为 29 组，实际 ${CITADEL_V4_BASELINES.length}`);
}
