// tools/test_lighting_presets.mjs — V6-G11 光照参数包（grok-v1 忠实抽取）验收
// 运行：node tools/test_lighting_presets.mjs
// 覆盖：①JSON 与代码常量逐字段相等 ②schema 拒绝坏 JSON ③注入后采样逐位一致
//       ④overlay 注入后雨/雪合成一致 ⑤注入 null 回滚代码默认
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const theme = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingTheme.js", import.meta.url).href
);
const state = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingState.js", import.meta.url).href
);
const loader = await import(
  new URL("../TigerMessenger/src/render/lighting/presetLoader.js", import.meta.url).href
);

const { LIGHTING_V5_KEYFRAMES, sampleLightingTheme } = theme;
const { composeLightingState, WEATHER_OVERLAYS, setLightingPresetOverrides } = state;
const { validateLightingPreset, resolvePreset, mergeOverlay } = loader;

const preset = JSON.parse(
  readFileSync(
    new URL("../TigerMessenger/src/render/lighting/presets/grok-v1.json", import.meta.url),
    "utf8"
  )
);

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

// ---------- 基线快照（必须在任何注入之前采集） ----------
const TS = [0, 0.2, 0.28, 0.5, 0.75, 0.9, 0.97];
const baselineTheme = TS.map((t) => JSON.stringify(sampleLightingTheme(t)));
const baselineCompose = [];
for (const t of [0.5, 0.28, 0.9]) {
  for (const w of ["clear", "rain", "snow"]) {
    baselineCompose.push(JSON.stringify(composeLightingState({ timeOfDay: t, weather: w })));
  }
}

// ---------- ① grok-v1.json 与代码常量逐字段相等 ----------
ok("① grok-v1 与代码常量逐字段相等（关键帧/天气/版本/回滚），且自身通过 schema", () => {
  assert.equal(preset.version, "grok-v1");
  assert.equal(preset.baseOn, "legacy-incode");
  assert.equal(preset.rollback?.version, "legacy-incode", "回滚值 = 代码内置常量");
  const KF_FIELDS = [
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
  assert.equal(preset.keyframes.length, LIGHTING_V5_KEYFRAMES.length, "关键帧数量");
  preset.keyframes.forEach((k, i) => {
    const c = LIGHTING_V5_KEYFRAMES[i];
    for (const f of KF_FIELDS) assert.deepEqual(k[f], c[f], `keyframes[${i}].${f}`);
  });
  const OV_FIELDS = ["sunMul", "hemiMul", "ambientAdd", "fogMul", "tint", "tintMix"];
  for (const w of ["clear", "rain", "snow"]) {
    for (const f of OV_FIELDS) {
      assert.deepEqual(preset.weathers[w][f], WEATHER_OVERLAYS[w][f], `weathers.${w}.${f}`);
    }
  }
  assert.deepEqual(validateLightingPreset(preset), { ok: true, errors: [] });
});

// ---------- ② schema 校验拒绝坏 JSON（带具体字段路径） ----------
ok("② schema 拒绝：缺字段/坏 hex/NaN/Infinity/非单调 t/破闭环/缺天气/坏版本", () => {
  const clone = () => JSON.parse(JSON.stringify(preset));
  const cases = [
    ["缺字段", (j) => delete j.keyframes[2].sunColor, "keyframes[2].sunColor"],
    ["坏 hex", (j) => (j.keyframes[0].background = "red"), "keyframes[0].background"],
    ["NaN", (j) => (j.keyframes[1].hemiIntensity = NaN), "keyframes[1].hemiIntensity"],
    ["Infinity", (j) => (j.weathers.rain.sunMul = Infinity), "weathers.rain.sunMul"],
    ["非单调 t", (j) => (j.keyframes[3].t = 0.1), "keyframes[3].t"],
    ["首帧 t≠0", (j) => (j.keyframes[0].t = 0.01), "keyframes[0].t"],
    ["破闭环", (j) => (j.keyframes[5].sunIntensity = 0.5), "keyframes[5].sunIntensity"],
    ["缺天气", (j) => delete j.weathers.snow, "weathers.snow"],
    ["坏 tint", (j) => (j.weathers.rain.tint = "#XYZ"), "weathers.rain.tint"],
    ["tintMix 越界", (j) => (j.weathers.snow.tintMix = 1.5), "weathers.snow.tintMix"],
    ["坏版本号", (j) => (j.version = "v1"), "version"],
    ["零向量 sunDir", (j) => (j.keyframes[0].sunDir = [0, 0, 0]), "keyframes[0].sunDir"],
  ];
  for (const [label, mutate, expectPath] of cases) {
    const bad = clone();
    mutate(bad);
    const res = validateLightingPreset(bad);
    assert.equal(res.ok, false, `${label} 应被拒绝`);
    assert.ok(
      res.errors.some((e) => e.path === expectPath),
      `${label} 错误路径应含 ${expectPath}，实际：${JSON.stringify(res.errors)}`
    );
  }
});

// ---------- ③ 注入 preset 后 sampleLightingTheme 与现状逐位一致 ----------
ok("③ 注入 grok-v1 后 sampleLightingTheme 在 7 个采样点逐位一致", () => {
  setLightingPresetOverrides(preset);
  TS.forEach((t, i) => {
    assert.equal(
      JSON.stringify(sampleLightingTheme(t)),
      baselineTheme[i],
      `t=${t} 采样结果必须逐位一致（JSON 字符串级相等）`
    );
  });
});

// ---------- ④ overlay 注入后雨/雪/晴合成与现状一致 ----------
ok("④ 注入后 compose（晴/雨/雪 × 3 时刻）与现状逐位一致，未知天气回退 clear", () => {
  let n = 0;
  for (const t of [0.5, 0.28, 0.9]) {
    for (const w of ["clear", "rain", "snow"]) {
      assert.equal(
        JSON.stringify(composeLightingState({ timeOfDay: t, weather: w })),
        baselineCompose[n++],
        `t=${t} weather=${w}`
      );
    }
  }
  // 未知天气回退 clear 的语义不因注入改变
  assert.equal(
    JSON.stringify(composeLightingState({ timeOfDay: 0.5, weather: "hail" })),
    JSON.stringify(composeLightingState({ timeOfDay: 0.5, weather: "clear" }))
  );
});

// ---------- 注入坏包：抛错带路径，且不半注入 ----------
ok("注入校验失败的包：抛带字段路径的错误，当前生效值不被污染", () => {
  const bad = JSON.parse(JSON.stringify(preset));
  delete bad.keyframes[2].sunColor;
  assert.throws(() => setLightingPresetOverrides(bad), /keyframes\[2\]\.sunColor/);
  TS.forEach((t, i) => {
    assert.equal(JSON.stringify(sampleLightingTheme(t)), baselineTheme[i], `t=${t} 不应被半注入`);
  });
});

// ---------- ⑤ 回滚：注入 null 恢复代码默认 ----------
ok("⑤ 注入 null 回滚：采样与合成都回到代码内置常量", () => {
  setLightingPresetOverrides(null);
  TS.forEach((t, i) => {
    assert.equal(JSON.stringify(sampleLightingTheme(t)), baselineTheme[i], `t=${t} 回滚`);
  });
  assert.equal(
    JSON.stringify(composeLightingState({ timeOfDay: 0.5, weather: "rain" })),
    baselineCompose[1],
    "雨合成回滚"
  );
  assert.equal(state.getActiveWeatherOverlays(), WEATHER_OVERLAYS, "overlay 表回到内置常量");
  assert.equal(theme.getLightingThemeKeyframes(), LIGHTING_V5_KEYFRAMES, "关键帧表回到内置常量");
});

// ---------- resolvePreset / mergeOverlay 接口 ----------
ok("resolvePreset：fetcher 注入、合法包透传、坏包抛带路径错误", async () => {
  const got = await resolvePreset("grok-v1", async (name) => {
    assert.equal(name, "grok-v1");
    return preset;
  });
  assert.equal(got, preset);
  await assert.rejects(
    () => resolvePreset("bad", () => ({ version: "v1" })),
    /resolvePreset\("bad"\) 校验失败：version/
  );
  await assert.rejects(() => resolvePreset("", () => preset), TypeError);
});

ok("mergeOverlay：局部差异深合并，不改入参，数组整体替换", () => {
  const base = { weathers: { rain: { sunMul: 0.55, hemiMul: 0.85 }, clear: { sunMul: 1 } } };
  const delta = { weathers: { rain: { sunMul: 0.5 } } };
  const merged = mergeOverlay(base, delta);
  assert.equal(merged.weathers.rain.sunMul, 0.5, "delta 覆盖");
  assert.equal(merged.weathers.rain.hemiMul, 0.85, "未提及字段保留 base");
  assert.equal(merged.weathers.clear.sunMul, 1, "未提及子树保留");
  assert.equal(base.weathers.rain.sunMul, 0.55, "入参不被修改");
});

console.log(`\n全部通过：${passed} 项`);
