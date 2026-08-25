// =====================================================================
//  V6-G11 色板参数包 · 纯逻辑 loader（不 import Three.js，不碰 fs/网络）
//  JSON 由调用方注入（fetch 或 fs 读入后作为对象传入），本模块只做：
//    schema 校验（validateThemePreset）
//    按名解析（resolvePreset，fetcher 回调预留 URL/localStorage 等来源）
//    局部差异合并（mergeOverlay，供后续 grok-vN 相对上一版的 delta 使用）
//  校验失败通过 errors[].path 给出具体字段路径（如 theme.castleRoof），
//  便于在不看全文的情况下定位坏字段。
//  必备 token/天气/昼夜清单与 visualTheme.js 常量一一对应（硬编码于此，
//  避免与 visualTheme.js 循环依赖；漂移由 tools/test_theme_presets.mjs ① 拦截）。
// =====================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VERSION_RE = /^grok-v\d+$/;

// THEME 语义 token 必备清单（与 visualTheme.js THEME 一一对应）
const THEME_TOKENS = [
  "castleWallChalk",
  "castleWallMist",
  "castleWallSage",
  "castleWallSand",
  "castleWallBlush",
  "castleWallAccent",
  "castleRoof",
  "castleRoofShade",
  "castleTrim",
  "castleWindow",
  "castleGateFocus",
  "castlePlaza",
  "envSkyTop",
  "envFog",
  "envWater",
  "envGrass",
  "envCliff",
  "unitDefenderMain",
  "unitAttackerMain",
  "unitTorch",
  "battleBloodFresh",
  "battleBloodDry",
  "shipEnemyHull",
  "outlineSoft",
  "outlineHard",
];
// 天气/昼夜 grade 必备清单（与 visualTheme.js WEATHER_GRADES / DAY_GRADES 一一对应）
const REQUIRED_WEATHER_GRADES = ["clear", "sunset", "rain", "snow", "night"];
const REQUIRED_DAY_GRADES = ["day", "dusk", "night"];
// grade 数值字段（tint 可选：null 或 #RRGGBB，见 applyGrade）
const GRADE_NUM_FIELDS = ["sat", "lift"];

function pushErr(errors, path, message) {
  errors.push({ path, message });
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validateGrade(errors, p, g) {
  if (!isPlainObject(g)) {
    pushErr(errors, p, "grade 必须是对象");
    return;
  }
  for (const f of GRADE_NUM_FIELDS) {
    if (!(f in g)) {
      pushErr(errors, `${p}.${f}`, "缺少字段");
    } else if (!Number.isFinite(g[f])) {
      pushErr(errors, `${p}.${f}`, "必须是有限数（拒绝 NaN/Infinity）");
    }
  }
  if ("tint" in g && g.tint !== null && (typeof g.tint !== "string" || !HEX_RE.test(g.tint))) {
    pushErr(errors, `${p}.tint`, "tint 必须是 null 或 #RRGGBB 十六进制颜色");
  }
}

/**
 * 校验一份色板参数包 JSON（已解析的对象）。
 * @returns {{ ok: boolean, errors: Array<{path: string, message: string}> }}
 *   ok=true 时 errors 为空；失败时每个错误都带具体字段路径。
 */
export function validateThemePreset(json) {
  const errors = [];
  if (!isPlainObject(json)) {
    return { ok: false, errors: [{ path: "$", message: "参数包必须是对象" }] };
  }

  // ---- 版本与来源 ----
  if (typeof json.version !== "string" || !VERSION_RE.test(json.version)) {
    pushErr(errors, "version", "版本必须是 grok-vN 形式字符串（如 grok-v1）");
  }
  if (typeof json.baseOn !== "string" || !json.baseOn) {
    pushErr(errors, "baseOn", "必须声明非空 baseOn 来源（如 legacy-incode / grok-v1）");
  }

  // ---- THEME 语义 token 表 ----
  const T = json.theme;
  if (!isPlainObject(T)) {
    pushErr(errors, "theme", "theme 必须是对象（token → #RRGGBB）");
  } else {
    for (const tok of THEME_TOKENS) {
      if (!(tok in T)) pushErr(errors, `theme.${tok}`, "缺少语义 token");
    }
    for (const k of Object.keys(T)) {
      if (k.startsWith("_")) continue; // 允许 _note 等说明字段
      if (typeof T[k] !== "string" || !HEX_RE.test(T[k])) {
        pushErr(errors, `theme.${k}`, "必须是 #RRGGBB 十六进制颜色");
      }
    }
  }

  // ---- 花砖簇色表 ----
  const A = json.tileAccents;
  if (!Array.isArray(A) || A.length < 1) {
    pushErr(errors, "tileAccents", "花砖簇色必须是长度≥1 的数组");
  } else {
    A.forEach((a, i) => {
      const p = `tileAccents[${i}]`;
      if (!isPlainObject(a)) {
        pushErr(errors, p, "簇色必须是对象");
        return;
      }
      if (typeof a.id !== "string" || !a.id) {
        pushErr(errors, `${p}.id`, "id 必须是非空字符串");
      }
      if (typeof a.hex !== "string" || !HEX_RE.test(a.hex)) {
        pushErr(errors, `${p}.hex`, "必须是 #RRGGBB 十六进制颜色");
      }
    });
  }

  // ---- 天气 grade 表 ----
  const W = json.weatherGrades;
  if (!isPlainObject(W)) {
    pushErr(errors, "weatherGrades", "weatherGrades 必须是对象");
  } else {
    for (const w of REQUIRED_WEATHER_GRADES) {
      if (!(w in W)) pushErr(errors, `weatherGrades.${w}`, "缺少天气 grade");
    }
    for (const name of Object.keys(W)) {
      validateGrade(errors, `weatherGrades.${name}`, W[name]);
    }
  }

  // ---- 昼夜 grade 表 ----
  const D = json.dayGrades;
  if (!isPlainObject(D)) {
    pushErr(errors, "dayGrades", "dayGrades 必须是对象");
  } else {
    for (const d of REQUIRED_DAY_GRADES) {
      if (!(d in D)) pushErr(errors, `dayGrades.${d}`, "缺少昼夜 grade");
    }
    for (const name of Object.keys(D)) {
      validateGrade(errors, `dayGrades.${name}`, D[name]);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** 把校验错误拼成单行字符串（带字段路径），供抛错/日志使用 */
export function formatPresetErrors(errors) {
  return (errors || []).map((e) => `${e.path}: ${e.message}`).join("; ");
}

/**
 * 按名解析参数包。fetcher 由调用方注入（async 或同步均可），签名：
 *   fetcher(name) => 已解析的 JSON 对象
 * 例如浏览器侧 fetcher = (n) => fetch(`themePresets/${n}.json`).then((r) => r.json())。
 * 解析后强制 schema 校验，失败抛出带字段路径的错误。
 */
export async function resolvePreset(name, fetcher) {
  if (typeof name !== "string" || !name) {
    throw new TypeError("resolvePreset: name 必须是非空字符串");
  }
  if (typeof fetcher !== "function") {
    throw new TypeError("resolvePreset: fetcher 必须是函数");
  }
  const json = await fetcher(name);
  const res = validateThemePreset(json);
  if (!res.ok) {
    throw new Error(`resolvePreset("${name}") 校验失败：${formatPresetErrors(res.errors)}`);
  }
  return json;
}

/**
 * 深合并局部差异包：overlay 中的标量/数组整体覆盖 base，同名对象递归合并。
 * 不修改入参；供后续 grok-vN 以「上一版 + delta」形式组包（回滚值天然保留在 base）。
 * 合并结果不自动校验——组包后请再过一遍 validateThemePreset。
 */
export function mergeOverlay(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
  const out = {};
  for (const k of Object.keys(base)) out[k] = base[k];
  for (const k of Object.keys(overlay)) {
    out[k] = k in base ? mergeOverlay(base[k], overlay[k]) : overlay[k];
  }
  return out;
}
