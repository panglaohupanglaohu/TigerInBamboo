// =====================================================================
//  5 天气 × 5 镜头 = 25 组基线镜头描述（G0/G8/G12）
//  GPU 实拍需要浏览器；此处输出可复现的相机/天气/token 矩阵。
// =====================================================================

import { CITADEL_V4_WEATHERS, CITADEL_V4_CAMERAS, CITADEL_V4_WEATHER_PARAMS } from "./baselineSpec.js";
import { finalColor } from "./visualTheme.js";
import { weatherTintedSvg, cameraShotId } from "./presentation.js";

export const CAMERA_LOCAL = Object.freeze({
  "citadel-overview": { lx: 0, ly: 28, lz: 42, look: { lx: 0, ly: 8, lz: 0 } },
  harbor: { lx: -8, ly: 6, lz: 48, look: { lx: 0, ly: 2, lz: 36 } },
  "waterfall-l1": { lx: 4, ly: 10, lz: 18, look: { lx: 0, ly: 4, lz: 8 } },
  "siege-clash": { lx: 12, ly: 8, lz: 22, look: { lx: 0, ly: 3, lz: 10 } },
  "trojan-infil": { lx: -6, ly: 5, lz: 8, look: { lx: 0, ly: 2, lz: 0 } },
});

export function listGpuShots() {
  return CITADEL_V4_WEATHERS.flatMap((weather) =>
    CITADEL_V4_CAMERAS.map((camera) =>
      Object.freeze({
        id: cameraShotId(weather, camera),
        weather,
        camera,
        params: CITADEL_V4_WEATHER_PARAMS[weather],
        local: CAMERA_LOCAL[camera],
      })
    )
  );
}

export function buildCameraMatrix(v4) {
  const shots = [];
  for (const weather of CITADEL_V4_WEATHERS) {
    for (const camera of CITADEL_V4_CAMERAS) {
      const timeBand = weather === "night" ? "night" : weather === "sunset" ? "dusk" : "day";
      shots.push({
        id: cameraShotId(weather, camera),
        weather,
        camera,
        params: CITADEL_V4_WEATHER_PARAMS[weather],
        local: CAMERA_LOCAL[camera],
        tokens: {
          wall: finalColor("castleWallChalk", { weather, timeBand }),
          unit: finalColor("unitDefenderMain", { weather, timeBand, backgroundLuminance: 0.35 }),
          water: finalColor("envWater", { weather, timeBand }),
        },
        svg: weatherTintedSvg(v4, weather),
      });
    }
  }
  return shots;
}
