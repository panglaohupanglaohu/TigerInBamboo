// =====================================================================
//  V5 光照 · 纯数据 LightingState 合成（PLAN.md 第九章 9.4）
//  composeLightingState(snapshot) 是唯一算状态的入口：
//    时刻（dayNight 时钟）→ 主题关键帧插值 → 天气 overlay → 面板 trim
//  纯函数、不 import Three.js；输出全部为可序列化普通数据。
// =====================================================================
import { sampleLightingTheme, setLightingThemeKeyframes } from "./lightingTheme.js";
import { composeBounceLighting } from "./lightingBounce.js";
import { validateLightingPreset, formatPresetErrors } from "./presetLoader.js";
import { sunDirectionFromAngles } from "../../world/sunRig.js";

// 天气 overlay：只改强度/雾/色调，永久不改基础 token（PLAN 7.5 同一原则）
// 导出供 V6-G11 参数包做逐字段对照（tools/test_lighting_presets.mjs）
export const WEATHER_OVERLAYS = Object.freeze({
  clear: Object.freeze({ sunMul: 1, hemiMul: 1, ambientAdd: 0, fogMul: 1, tint: null, tintMix: 0 }),
  rain: Object.freeze({
    sunMul: 0.55,
    hemiMul: 0.85,
    ambientAdd: 0.02,
    fogMul: 1.8,
    tint: "#8FA5AD",
    tintMix: 0.35,
  }),
  snow: Object.freeze({
    sunMul: 0.8,
    hemiMul: 0.95,
    ambientAdd: 0.06,
    fogMul: 1.4,
    tint: "#EEF3F2",
    tintMix: 0.25,
  }),
});

export const LIGHTING_V5_WEATHERS = Object.freeze(Object.keys(WEATHER_OVERLAYS));

// ---------- V6-G11 参数包注入 ----------
// 缺省 = 代码内置 WEATHER_OVERLAYS，行为与注入前逐位一致。
let activeOverlays = WEATHER_OVERLAYS;

/**
 * 注入 versioned 光照参数包（presets/grok-vN.json 解析后的对象）：
 *   keyframes → lightingTheme 关键帧表；weathers → 天气 overlay 表。
 * 传 null 回滚到代码内置常量（上一版回滚值，见 JSON rollback 字段）。
 * 注入前做完整 schema 校验，失败抛出带字段路径的错误，绝不半注入。
 */
export function setLightingPresetOverrides(preset) {
  if (preset == null) {
    setLightingThemeKeyframes(null);
    activeOverlays = WEATHER_OVERLAYS;
    return;
  }
  const res = validateLightingPreset(preset);
  if (!res.ok) {
    throw new Error(`setLightingPresetOverrides: 参数包校验失败：${formatPresetErrors(res.errors)}`);
  }
  setLightingThemeKeyframes(preset.keyframes);
  activeOverlays = preset.weathers;
}

/** 当前生效的天气 overlay 表（测试/调试只读） */
export function getActiveWeatherOverlays() {
  return activeOverlays;
}

// P.weather: 0 晴 / 1 雨 / 2 雪
export function lightingWeatherName(weather) {
  return weather === 1 ? "rain" : weather === 2 ? "snow" : "clear";
}

function hexRgb(hex) {
  const s = String(hex).replace(/^#/, "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function rgbHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function mixHex(ha, hb, k) {
  if (!k) return ha;
  const a = hexRgb(ha);
  const b = hexRgb(hb);
  return rgbHex([
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ]);
}

/**
 * @param {object} snapshot
 *   { timeOfDay: 0..1, weather: "clear"|"rain"|"snow",
 *     trims?: { sunMul?: number, ambientMul?: number },
 *     moebius?: 0..1 }  // 莫比斯结界染色强度（主循环平滑后传入）
 * @returns 纯数据 LightingState
 */
export function composeLightingState(snapshot) {
  const s = snapshot || {};
  const theme = sampleLightingTheme(s.timeOfDay ?? 0.5);
  const weather = activeOverlays[s.weather] || activeOverlays.clear;
  const trims = s.trims || {};
  const sunMul = Number.isFinite(trims.sunMul) ? trims.sunMul : 1;
  const ambientMul = Number.isFinite(trims.ambientMul) ? trims.ambientMul : 1;

  let background = theme.background;
  let sunColor = theme.sunColor;
  let skyColor = theme.skyColor;
  if (weather.tint) {
    background = mixHex(background, weather.tint, weather.tintMix);
    skyColor = mixHex(skyColor, weather.tint, weather.tintMix * 0.5);
    sunColor = mixHex(sunColor, weather.tint, weather.tintMix * 0.4);
  }
  // 莫比斯结界：南半球粉紫暖橙染色（与旧管线 updateMoebiusBarrier 同语义）
  const mf = Math.max(0, Math.min(1, s.moebius || 0));
  if (mf > 0) {
    background = mixHex(background, "#EBB9B6", mf);
    skyColor = mixHex(skyColor, "#EBB9B6", mf);
    sunColor = mixHex(sunColor, "#F0C294", mf);
  }

  return Object.freeze({
    band: theme.name,
    sun: Object.freeze({
      color: sunColor,
      intensity: theme.sunIntensity * weather.sunMul * sunMul,
      // C13-7（PLAN §10.7）：摇杆接管时方向由 azimuth/elevation 直接给出，
      // 不再从时刻主题里读。方向不参与一阶平滑（见 lightingDirector），
      // 所以摇杆一动主光下一帧就跟上。
      direction: Object.freeze(
        s.sunOverride
          ? sunDirectionFromAngles(s.sunOverride.azimuth, s.sunOverride.elevation)
          : [...theme.sunDir]
      ),
    }),
    sky: Object.freeze({
      skyColor,
      groundColor: theme.groundColor,
      intensity: theme.hemiIntensity * weather.hemiMul,
    }),
    ambientFloor: Math.max(0, (theme.ambientFloor + weather.ambientAdd) * ambientMul),
    background,
    fog: Object.freeze({
      color: background,
      // 与旧管线 FogExp2 0.007 同量级；雨/雪加密
      density: 0.007 * weather.fogMul,
    }),
    // K5 bounce 是独立实验开关；未明确 enabled 时保持关闭且 intensity=0。
    bounce: composeBounceLighting(s.bounce),
    exposure: 1,
  });
}
