// =====================================================================
//  V6-G11 光照参数包 · 纯逻辑 loader（不 import Three.js，不碰 fs/网络）
//  JSON 由调用方注入（fetch 或 fs 读入后作为对象传入），本模块只做：
//    schema 校验（validateLightingPreset）
//    按名解析（resolvePreset，fetcher 回调预留 URL/localStorage 等来源）
//    局部差异合并（mergeOverlay，供后续 grok-vN 相对上一版的 delta 使用）
//  校验失败通过 errors[].path 给出具体字段路径（如 keyframes[3].sunColor），
//  便于在不看全文的情况下定位坏字段。
// =====================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VERSION_RE = /^grok-v\d+$/;

// 关键帧必备字段（与 lightingTheme.js LIGHTING_V5_KEYFRAMES 一一对应）
const KEYFRAME_FIELDS = [
  "t",
  "name",
  "sunColor",
  "sunIntensity",
  "sunDir",
  "skyColor",
  "groundColor",
  "hemiIntensity",
  "ambientFloor",
  "background",
];
const HEX_FIELDS = ["sunColor", "skyColor", "groundColor", "background"];
const NUM_FIELDS = ["sunIntensity", "hemiIntensity", "ambientFloor"];
// 天气 overlay 必备字段（与 lightingState.js WEATHER_OVERLAYS 一一对应）
const OVERLAY_NUM_FIELDS = ["sunMul", "hemiMul", "ambientAdd", "fogMul", "tintMix"];
const REQUIRED_WEATHERS = ["clear", "rain", "snow"];

function pushErr(errors, path, message) {
  errors.push({ path, message });
}

/**
 * 校验一份光照参数包 JSON（已解析的对象）。
 * @returns {{ ok: boolean, errors: Array<{path: string, message: string}> }}
 *   ok=true 时 errors 为空；失败时每个错误都带具体字段路径。
 */
export function validateLightingPreset(json) {
  const errors = [];
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, errors: [{ path: "$", message: "参数包必须是对象" }] };
  }

  // ---- 版本与来源 ----
  if (typeof json.version !== "string" || !VERSION_RE.test(json.version)) {
    pushErr(errors, "version", "版本必须是 grok-vN 形式字符串（如 grok-v1）");
  }
  if (typeof json.baseOn !== "string" || !json.baseOn) {
    pushErr(errors, "baseOn", "必须声明非空 baseOn 来源（如 legacy-incode / grok-v1）");
  }

  // ---- 关键帧表 ----
  const K = json.keyframes;
  if (!Array.isArray(K) || K.length < 2) {
    pushErr(errors, "keyframes", "关键帧必须是长度≥2 的数组");
  } else {
    let prevT = -Infinity;
    K.forEach((k, i) => {
      const p = `keyframes[${i}]`;
      if (!k || typeof k !== "object" || Array.isArray(k)) {
        pushErr(errors, p, "关键帧必须是对象");
        return;
      }
      for (const f of KEYFRAME_FIELDS) {
        if (!(f in k)) pushErr(errors, `${p}.${f}`, "缺少字段");
      }
      // t：有限、[0,1)、严格单调递增（跨午夜闭环由末帧与首帧同值保证）
      if (!Number.isFinite(k.t) || k.t < 0 || k.t >= 1) {
        pushErr(errors, `${p}.t`, "t 必须是 [0,1) 内的有限数");
      } else if (k.t <= prevT) {
        pushErr(errors, `${p}.t`, `t 必须严格单调递增（上一帧 t=${prevT}）`);
      }
      if (Number.isFinite(k.t)) prevT = k.t;
      if (typeof k.name !== "string" || !k.name) {
        pushErr(errors, `${p}.name`, "name 必须是非空字符串");
      }
      for (const f of HEX_FIELDS) {
        if (f in k && (typeof k[f] !== "string" || !HEX_RE.test(k[f]))) {
          pushErr(errors, `${p}.${f}`, "必须是 #RRGGBB 十六进制颜色");
        }
      }
      for (const f of NUM_FIELDS) {
        if (f in k && !Number.isFinite(k[f])) {
          pushErr(errors, `${p}.${f}`, "必须是有限数（拒绝 NaN/Infinity）");
        }
      }
      if ("sunDir" in k) {
        const d = k.sunDir;
        if (!Array.isArray(d) || d.length !== 3 || !d.every(Number.isFinite)) {
          pushErr(errors, `${p}.sunDir`, "必须是 3 个有限数的数组");
        } else if (Math.hypot(d[0], d[1], d[2]) < 1e-6) {
          pushErr(errors, `${p}.sunDir`, "太阳方向不能是零向量");
        }
      }
    });
    // 闭环：首帧 t=0，且末帧除 t 外全部字段与首帧同值（跨午夜连续）
    const first = K[0];
    const last = K[K.length - 1];
    if (first && last && typeof first === "object" && typeof last === "object") {
      if (Number.isFinite(first.t) && first.t !== 0) {
        pushErr(errors, "keyframes[0].t", "首帧 t 必须为 0（跨午夜闭环基准）");
      }
      for (const f of KEYFRAME_FIELDS) {
        if (f === "t") continue;
        if (!(f in first) || !(f in last)) continue; // 缺字段已在上面报过
        const same = Array.isArray(first[f])
          ? JSON.stringify(first[f]) === JSON.stringify(last[f])
          : first[f] === last[f];
        if (!same) {
          pushErr(
            errors,
            `keyframes[${K.length - 1}].${f}`,
            `闭环失败：末帧必须与首帧同值（首帧为 ${JSON.stringify(first[f])}）`
          );
        }
      }
    }
  }

  // ---- 天气 overlay 表 ----
  const W = json.weathers;
  if (!W || typeof W !== "object" || Array.isArray(W)) {
    pushErr(errors, "weathers", "weathers 必须是对象");
  } else {
    for (const w of REQUIRED_WEATHERS) {
      if (!(w in W)) pushErr(errors, `weathers.${w}`, "缺少天气 overlay");
    }
    for (const name of Object.keys(W)) {
      const p = `weathers.${name}`;
      const o = W[name];
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        pushErr(errors, p, "overlay 必须是对象");
        continue;
      }
      for (const f of OVERLAY_NUM_FIELDS) {
        if (!(f in o)) {
          pushErr(errors, `${p}.${f}`, "缺少字段");
        } else if (!Number.isFinite(o[f])) {
          pushErr(errors, `${p}.${f}`, "必须是有限数（拒绝 NaN/Infinity）");
        }
      }
      if (Number.isFinite(o.tintMix) && (o.tintMix < 0 || o.tintMix > 1)) {
        pushErr(errors, `${p}.tintMix`, "tintMix 必须在 [0,1]");
      }
      if (!("tint" in o)) {
        pushErr(errors, `${p}.tint`, "缺少字段");
      } else if (o.tint !== null && (typeof o.tint !== "string" || !HEX_RE.test(o.tint))) {
        pushErr(errors, `${p}.tint`, "tint 必须是 null 或 #RRGGBB 十六进制颜色");
      }
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
 * 例如浏览器侧 fetcher = (n) => fetch(`presets/${n}.json`).then((r) => r.json())。
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
  const res = validateLightingPreset(json);
  if (!res.ok) {
    throw new Error(`resolvePreset("${name}") 校验失败：${formatPresetErrors(res.errors)}`);
  }
  return json;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * 深合并局部差异包：overlay 中的标量/数组整体覆盖 base，同名对象递归合并。
 * 不修改入参；供后续 grok-vN 以「上一版 + delta」形式组包（回滚值天然保留在 base）。
 * 合并结果不自动校验——组包后请再过一遍 validateLightingPreset。
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
