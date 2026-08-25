// =====================================================================
//  V8-K0 Kimi 视觉参数包 · 纯逻辑校验器（不 import Three.js，不碰 fs/网络）
//  JSON 由调用方注入；本模块只做 schema 校验，错误带字段路径（仿
//  lighting/presetLoader.js 风格）。强制「只引用 semantic token」：
//  镜头/色板中不得出现 Object3D 名、solver/field/route/snapshot 字段。
// =====================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VERSION_RE = /^kimi-v8-v\d+$/;
const TIME_BANDS = ["predawn", "dawn", "noon", "sunset", "night"];
const WEATHERS = ["clear", "rain", "snow"];
const CAMERA_GROUPS = {
  global: 4,
  highland: 6,
  canyon: 5,
  saihoji: 4,
  swamp: 4,
  bookshop: 3,
  "triple-gate": 3,
  water: 3,
  cloud: 2,
};
export const CAMERA_TOTAL = 34;
export const TERRAIN_TOKENS = Object.freeze([
  "deepOcean", "shallowOcean", "shore", "grass", "hill",
  "moss", "forest", "rock", "snow", "wetland",
]);
export const WATER_TOKENS = Object.freeze([
  "deep-ocean", "shallow-ocean", "shallow-lake", "deep-lake", "wetland", "shore", "foam",
]);
export const CLOUD_CONDITIONS = Object.freeze(["noon", "sunset", "night", "rain", "snow"]);
// 与 Grok 真源同名的禁词：出现即说明参数包越界引用实现细节
const FORBIDDEN_CAMERA_FIELDS = ["solver", "field", "route", "snapshot", "object3D", "objectName", "mesh", "worker"];

function pushErr(errors, path, message) {
  errors.push({ path, message });
}

function checkVersion(json, errors) {
  if (typeof json.version !== "string" || !VERSION_RE.test(json.version)) {
    pushErr(errors, "version", "版本必须是 kimi-v8-vN 形式字符串（如 kimi-v8-v1）");
  }
  if (typeof json.baseOn !== "string" || !json.baseOn) {
    pushErr(errors, "baseOn", "必须声明非空 baseOn 来源");
  }
}

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * 校验 34 镜头清单（cameras-v1.json 已解析对象）。
 * landmarkIds：可用 landmark 稳定 ID 数组（来自 landmarkManifest）。
 */
export function validateCameraManifest(json, landmarkIds) {
  const errors = [];
  if (!isPlainObject(json)) return { ok: false, errors: [{ path: "$", message: "镜头清单必须是对象" }] };
  checkVersion(json, errors);
  const anchors = new Set([...(landmarkIds || []), "global"]);
  const cams = json.cameras;
  if (!Array.isArray(cams)) {
    pushErr(errors, "cameras", "cameras 必须是数组");
    return { ok: false, errors };
  }
  if (cams.length !== CAMERA_TOTAL) pushErr(errors, "cameras", `镜头总数必须=${CAMERA_TOTAL}，实得 ${cams.length}`);
  const ids = new Set();
  const groupCounts = {};
  for (let i = 0; i < cams.length; i++) {
    const c = cams[i] || {};
    const p = `cameras[${i}]`;
    if (typeof c.id !== "string" || !c.id) pushErr(errors, `${p}.id`, "缺 id");
    else if (ids.has(c.id)) pushErr(errors, `${p}.id`, `重复 id: ${c.id}`);
    ids.add(c.id);
    if (!CAMERA_GROUPS[c.group]) pushErr(errors, `${p}.group`, `未知分组: ${c.group}`);
    else groupCounts[c.group] = (groupCounts[c.group] || 0) + 1;
    if (!Number.isInteger(c.seed)) pushErr(errors, `${p}.seed`, "seed 必须是整数");
    if (!TIME_BANDS.includes(c.timeBand)) pushErr(errors, `${p}.timeBand`, `非法 timeBand: ${c.timeBand}`);
    if (!WEATHERS.includes(c.weather)) pushErr(errors, `${p}.weather`, `非法 weather: ${c.weather}`);
    if (!(c.fov >= 20 && c.fov <= 80)) pushErr(errors, `${p}.fov`, `fov 须在 20~80: ${c.fov}`);
    if (!(c.near > 0)) pushErr(errors, `${p}.near`, "near 必须 >0");
    if (!(c.far > c.near)) pushErr(errors, `${p}.far`, "far 必须 >near");
    if (!anchors.has(c.anchorLandmark)) pushErr(errors, `${p}.anchorLandmark`, `未知锚点: ${c.anchorLandmark}`);
    const off = c.offset || {};
    for (const k of ["azimuthDeg", "polarDeg", "heightUnits"]) {
      if (typeof off[k] !== "number" || !Number.isFinite(off[k])) pushErr(errors, `${p}.offset.${k}`, "必须是有限数值");
    }
    if (!(off.polarDeg >= 0 && off.polarDeg <= 90)) pushErr(errors, `${p}.offset.polarDeg`, "polarDeg 须在 0~90");
    if (!(off.heightUnits >= 0)) pushErr(errors, `${p}.offset.heightUnits`, "heightUnits 不得为负");
    if (!Array.isArray(c.visibleLandmarks) || !c.visibleLandmarks.length) {
      pushErr(errors, `${p}.visibleLandmarks`, "必须列出可见 landmark");
    } else {
      for (const lm of c.visibleLandmarks) {
        if (!anchors.has(lm) || lm === "global") pushErr(errors, `${p}.visibleLandmarks`, `未知可见 landmark: ${lm}`);
      }
    }
    if (typeof c.historicalProblem !== "string" || !c.historicalProblem) {
      pushErr(errors, `${p}.historicalProblem`, "必须记录历史问题描述");
    }
    for (const bad of FORBIDDEN_CAMERA_FIELDS) {
      if (bad in c) pushErr(errors, `${p}.${bad}`, "禁止引用 solver/field/route/snapshot/对象名字段");
    }
  }
  for (const [group, want] of Object.entries(CAMERA_GROUPS)) {
    const got = groupCounts[group] || 0;
    if (got !== want) pushErr(errors, `groups.${group}`, `分组数量必须=${want}，实得 ${got}`);
  }
  return { ok: errors.length === 0, errors };
}

function validateTokenBands(json, tokens, label, errors) {
  if (!isPlainObject(json)) { pushErr(errors, "$", `${label} 必须是对象`); return; }
  checkVersion(json, errors);
  const t = json.tokens;
  if (!isPlainObject(t)) { pushErr(errors, "tokens", `${label} 缺 tokens 表`); return; }
  for (const token of tokens) {
    const entry = t[token];
    if (!isPlainObject(entry)) { pushErr(errors, `tokens.${token}`, `${label} 缺 token: ${token}`); continue; }
    for (const band of ["noon", "sunset", "night"]) {
      if (typeof entry[band] !== "string" || !HEX_RE.test(entry[band])) {
        pushErr(errors, `tokens.${token}.${band}`, `${label} 必须是 #RRGGBB: ${entry[band]}`);
      }
    }
  }
  for (const extra of Object.keys(t)) {
    if (!tokens.includes(extra)) pushErr(errors, `tokens.${extra}`, `${label} 未知 token: ${extra}`);
  }
}

export function validateTerrainPalette(json) {
  const errors = [];
  validateTokenBands(json, TERRAIN_TOKENS, "地形色板", errors);
  return { ok: errors.length === 0, errors };
}

export function validateWaterPalette(json) {
  const errors = [];
  validateTokenBands(json, WATER_TOKENS, "水体色板", errors);
  return { ok: errors.length === 0, errors };
}

export function validateCloudPalette(json) {
  const errors = [];
  if (!isPlainObject(json)) return { ok: false, errors: [{ path: "$", message: "云参数包必须是对象" }] };
  checkVersion(json, errors);
  const conds = json.conditions;
  if (!isPlainObject(conds)) { pushErr(errors, "conditions", "缺 conditions 表"); return { ok: false, errors }; }
  for (const name of CLOUD_CONDITIONS) {
    const c = conds[name];
    if (!isPlainObject(c)) { pushErr(errors, `conditions.${name}`, "缺天气档"); continue; }
    if (typeof c.color !== "string" || !HEX_RE.test(c.color)) pushErr(errors, `conditions.${name}.color`, "必须是 #RRGGBB");
    if (!(c.opacity > 0 && c.opacity <= 1)) pushErr(errors, `conditions.${name}.opacity`, "opacity 须在 (0,1]");
    if (!(c.softness >= 0 && c.softness <= 1)) pushErr(errors, `conditions.${name}.softness`, "softness 须在 [0,1]");
    const alt = c.altitudeRange;
    if (!Array.isArray(alt) || alt.length !== 2 || !(alt[0] >= 0) || !(alt[1] > alt[0])) {
      pushErr(errors, `conditions.${name}.altitudeRange`, "必须是 [min,max] 且 max>min≥0");
    }
  }
  for (const extra of Object.keys(conds)) {
    if (!CLOUD_CONDITIONS.includes(extra)) pushErr(errors, `conditions.${extra}`, `未知天气档: ${extra}`);
  }
  return { ok: errors.length === 0, errors };
}

const KEYFRAME_FIELDS = ["t", "name", "sunColor", "sunIntensity", "sunDir", "skyColor", "groundColor", "hemiIntensity", "ambientFloor", "background"];
const HEX_FIELDS = ["sunColor", "skyColor", "groundColor", "background"];
const NUM_FIELDS = ["sunIntensity", "hemiIntensity", "ambientFloor"];
const OVERLAY_NUM_FIELDS = ["sunMul", "hemiMul", "ambientAdd", "fogMul", "tintMix"];

export function validateLightingV8(json) {
  const errors = [];
  if (!isPlainObject(json)) return { ok: false, errors: [{ path: "$", message: "光照参数包必须是对象" }] };
  checkVersion(json, errors);
  const K = json.keyframes;
  if (!Array.isArray(K) || K.length < 2) {
    pushErr(errors, "keyframes", "关键帧必须是长度≥2 的数组");
  } else {
    K.forEach((k, i) => {
      const p = `keyframes[${i}]`;
      for (const f of KEYFRAME_FIELDS) if (!(f in (k || {}))) pushErr(errors, `${p}.${f}`, "缺字段");
      for (const f of HEX_FIELDS) if (k && typeof k[f] === "string" && !HEX_RE.test(k[f])) pushErr(errors, `${p}.${f}`, "必须是 #RRGGBB");
      for (const f of NUM_FIELDS) if (k && typeof k[f] === "number" && !(k[f] >= 0)) pushErr(errors, `${p}.${f}`, "必须 ≥0");
      if (k && !(k.t >= 0 && k.t <= 1)) pushErr(errors, `${p}.t`, "t 须在 [0,1]");
      if (k && (!Array.isArray(k.sunDir) || k.sunDir.length !== 3)) pushErr(errors, `${p}.sunDir`, "必须是三维向量");
    });
  }
  const W = json.weathers;
  if (!isPlainObject(W)) {
    pushErr(errors, "weathers", "缺 weathers 表");
  } else {
    for (const name of ["clear", "rain", "snow"]) {
      if (!isPlainObject(W[name])) pushErr(errors, `weathers.${name}`, "缺必备天气档");
    }
    for (const [name, w] of Object.entries(W)) {
      for (const f of OVERLAY_NUM_FIELDS) {
        if (typeof w[f] !== "number") pushErr(errors, `weathers.${name}.${f}`, "必须是数值");
      }
      if (w.tint != null && (typeof w.tint !== "string" || !HEX_RE.test(w.tint))) {
        pushErr(errors, `weathers.${name}.tint`, "必须是 #RRGGBB 或 null");
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
