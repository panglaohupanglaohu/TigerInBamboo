// =====================================================================
//  语义主题：古堡鲜艳簇色 + 战场可读 token + 天气/昼夜只读 grade（G4/G8）
//  V6-G11 起四张常量表可经 setThemePresetOverrides 注入 versioned JSON
//  参数包（themePresets/grok-vN.json）；缺省/注入 null 即代码内置常量。
// =====================================================================

import { hashHex } from "../../core/rng.js";
import { validateThemePreset, formatPresetErrors } from "./themePresets/themePresetLoader.js";

export const TILE_ACCENTS = Object.freeze([
  Object.freeze({ id: "coral", hex: "#C89082" }),
  Object.freeze({ id: "teal", hex: "#7FA6AC" }),
  Object.freeze({ id: "mustard", hex: "#B4A06B" }),
  Object.freeze({ id: "sage", hex: "#7FA98C" }),
]);

export const THEME = Object.freeze({
  castleWallChalk: "#F2F4F4",
  castleWallMist: "#D5DBDB",
  castleWallSage: "#A7BE9C",
  castleWallSand: "#E8D5B5",
  castleWallBlush: "#E8A0A8",
  castleWallAccent: "#7FB3C8",
  castleRoof: "#C98778",
  castleRoofShade: "#9D6866",
  castleTrim: "#46545D",
  castleWindow: "#294452",
  castleGateFocus: "#EEE2CB",
  castlePlaza: "#A9B2AB",
  envSkyTop: "#8EADB0",
  envFog: "#A9B9B8",
  envWater: "#6F9EA4",
  envGrass: "#88A779",
  envCliff: "#D6DEDA",
  unitDefenderMain: "#416F91",
  unitAttackerMain: "#593B47",
  unitTorch: "#FFB347",
  battleBloodFresh: "#A9283C",
  battleBloodDry: "#672F3A",
  shipEnemyHull: "#533842",
  outlineSoft: "#5A6670",
  outlineHard: "#2D353B",
});

export const WEATHER_GRADES = Object.freeze({
  clear: { sat: 1, lift: 0, tint: null },
  sunset: { sat: 1.02, lift: 0.02, tint: "#C87669" },
  rain: { sat: 0.82, lift: -0.06, tint: null },
  snow: { sat: 0.9, lift: 0.14, tint: "#E8EEF0" },
  night: { sat: 0.92, lift: -0.18, tint: "#1E2D3D" },
});

export const DAY_GRADES = Object.freeze({
  day: { sat: 1, lift: 0 },
  dusk: { sat: 1, lift: -0.04 },
  night: { sat: 0.95, lift: -0.12 },
});

// ---------- V6-G11 色板参数包注入 ----------
// 缺省 = 代码内置四表，行为与注入前逐位一致。
let activeTheme = THEME;
let activeTileAccents = TILE_ACCENTS;
let activeWeatherGrades = WEATHER_GRADES;
let activeDayGrades = DAY_GRADES;

/**
 * 注入 versioned 色板参数包（themePresets/grok-vN.json 解析后的对象）：
 *   theme → 语义 token 表；tileAccents → 花砖簇色表；
 *   weatherGrades / dayGrades → 天气/昼夜 grade 表。
 * 传 null 回滚到代码内置常量（上一版回滚值，见 JSON rollback 字段）。
 * 注入前做完整 schema 校验，失败抛出带字段路径的错误，绝不半注入。
 */
export function setThemePresetOverrides(preset) {
  if (preset == null) {
    activeTheme = THEME;
    activeTileAccents = TILE_ACCENTS;
    activeWeatherGrades = WEATHER_GRADES;
    activeDayGrades = DAY_GRADES;
    return;
  }
  const res = validateThemePreset(preset);
  if (!res.ok) {
    throw new Error(`setThemePresetOverrides: 参数包校验失败：${formatPresetErrors(res.errors)}`);
  }
  activeTheme = preset.theme;
  activeTileAccents = preset.tileAccents;
  activeWeatherGrades = preset.weatherGrades;
  activeDayGrades = preset.dayGrades;
}

/** 当前生效的四张色板表（测试/调试只读） */
export function getActiveThemeTables() {
  return Object.freeze({
    theme: activeTheme,
    tileAccents: activeTileAccents,
    weatherGrades: activeWeatherGrades,
    dayGrades: activeDayGrades,
  });
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function rgbToHex({ r, g, b }) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

function applyGrade(rgb, grade) {
  const sat = grade.sat ?? 1;
  const lift = grade.lift ?? 0;
  const lum = rgb.r * 0.3 + rgb.g * 0.59 + rgb.b * 0.11;
  let r = lum + (rgb.r - lum) * sat + lift;
  let g = lum + (rgb.g - lum) * sat + lift;
  let b = lum + (rgb.b - lum) * sat + lift;
  let out = { r, g, b };
  if (grade.tint) out = mix(out, hexToRgb(grade.tint), 0.12);
  return out;
}

export function finalColor(token, context = {}) {
  const base = hexToRgb(activeTheme[token] || "#888888");
  const weathered = applyGrade(base, activeWeatherGrades[context.weather] || activeWeatherGrades.clear);
  const timed = applyGrade(weathered, activeDayGrades[context.timeBand] || activeDayGrades.day);
  if (token.startsWith("unit") && context.backgroundLuminance != null) {
    const lum = timed.r * 0.3 + timed.g * 0.59 + timed.b * 0.11;
    if (Math.abs(lum - context.backgroundLuminance) < 0.12) {
      timed.r *= 0.86;
      timed.b *= 1.08;
    }
  }
  return rgbToHex(timed);
}

const WALLS = ["castleWallChalk", "castleWallMist", "castleWallSage", "castleWallSand", "castleWallBlush", "castleWallAccent"];

export function resolveBuildingTheme(clusterId, context = {}) {
  const h = parseInt(hashHex(`${context.seed || 1}|${clusterId}`), 16);
  const main = WALLS[h % WALLS.length];
  const secondary = WALLS[((h >>> 8) + 1) % WALLS.length];
  const accent = activeTileAccents[h % activeTileAccents.length];
  return {
    wallMain: activeTheme[main],
    wallSecondary: activeTheme[secondary],
    tileAccent: accent.hex,
    tileId: accent.id,
    trim: activeTheme.castleTrim,
    roof: activeTheme.castleRoof,
    clusterId,
  };
}

export function outlineWeight({ contrast = 0.4, depthDelta = 0.2, semanticHard = false, grassInterior = false }) {
  if (grassInterior && !semanticHard) return 0.15 * contrast;
  if (semanticHard) return 0.9;
  return Math.min(1, contrast * 0.7 + depthDelta * 0.5);
}

export function torchFlicker(tick, seed = 1) {
  const n = Math.sin(tick * 0.37 + seed * 1.7) * 0.5 + Math.sin(tick * 0.91 + seed) * 0.5;
  return 0.85 + n * 0.08;
}
