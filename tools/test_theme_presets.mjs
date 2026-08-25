// tools/test_theme_presets.mjs — V6-G11 色板参数包（grok-v1 忠实抽取）验收
// 运行：node tools/test_theme_presets.mjs
// 覆盖：①JSON 与代码常量逐字段相等 ②schema 拒绝坏 JSON ③注入后采样逐位一致
//       ④注入坏包不半注入 ⑤注入 null 回滚代码默认
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vt = await import(
  new URL("../TigerMessenger/src/world/citadel/visualTheme.js", import.meta.url).href
);
const loader = await import(
  new URL("../TigerMessenger/src/world/citadel/themePresets/themePresetLoader.js", import.meta.url).href
);

const {
  THEME,
  TILE_ACCENTS,
  WEATHER_GRADES,
  DAY_GRADES,
  finalColor,
  resolveBuildingTheme,
  setThemePresetOverrides,
  getActiveThemeTables,
} = vt;
const { validateThemePreset, resolvePreset, mergeOverlay } = loader;

const preset = JSON.parse(
  readFileSync(
    new URL("../TigerMessenger/src/world/citadel/themePresets/grok-v1.json", import.meta.url),
    "utf8"
  )
);

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

// ---------- 采样面（基线必须在任何注入之前采集） ----------
const TOKENS = Object.keys(THEME);
const WEATHERS = Object.keys(WEATHER_GRADES);
const TIME_BANDS = Object.keys(DAY_GRADES);
const CLUSTER_IDS = ["A", "B", "keep-01", "plaza-7", "wall-42"];
const SEEDS = [1, 7, 20260823];

function sampleAll() {
  const out = [];
  for (const tok of TOKENS) {
    for (const w of WEATHERS) {
      for (const tb of TIME_BANDS) {
        out.push(finalColor(tok, { weather: w, timeBand: tb }));
      }
    }
  }
  // 单位可读性分支：lum 落在/不落在 backgroundLuminance ±0.12 带内
  out.push(finalColor("unitDefenderMain", { weather: "clear", timeBand: "day", backgroundLuminance: 0.0 }));
  out.push(finalColor("unitDefenderMain", { weather: "night", timeBand: "night", backgroundLuminance: 0.5 }));
  out.push(finalColor("unitTorch", { weather: "night", timeBand: "night", backgroundLuminance: 0.5 }));
  // 未知 token / 未知天气 / 未知时段回退语义
  out.push(finalColor("notAToken", { weather: "clear", timeBand: "day" }));
  out.push(finalColor("castleRoof", { weather: "hail", timeBand: "day" }));
  out.push(finalColor("castleRoof", { weather: "clear", timeBand: "noon" }));
  out.push(finalColor("castleRoof", {}));
  for (const seed of SEEDS) {
    for (const cid of CLUSTER_IDS) {
      out.push(JSON.stringify(resolveBuildingTheme(cid, { seed })));
    }
  }
  return out;
}

const baseline = sampleAll();

// ---------- ① grok-v1.json 与代码常量逐字段相等 ----------
ok("① grok-v1 与代码常量逐字段相等（theme/簇色/天气/昼夜/版本/回滚），且自身通过 schema", () => {
  assert.equal(preset.version, "grok-v1");
  assert.equal(preset.baseOn, "legacy-incode");
  assert.equal(preset.rollback?.version, "legacy-incode", "回滚值 = 代码内置常量");

  const themeKeys = Object.keys(preset.theme).filter((k) => !k.startsWith("_"));
  assert.deepEqual(themeKeys.sort(), TOKENS.slice().sort(), "theme token 集合");
  for (const tok of TOKENS) {
    assert.equal(preset.theme[tok], THEME[tok], `theme.${tok}`);
  }

  assert.equal(preset.tileAccents.length, TILE_ACCENTS.length, "花砖簇色数量");
  preset.tileAccents.forEach((a, i) => {
    assert.equal(a.id, TILE_ACCENTS[i].id, `tileAccents[${i}].id`);
    assert.equal(a.hex, TILE_ACCENTS[i].hex, `tileAccents[${i}].hex`);
  });

  const GRADE_FIELDS = ["sat", "lift", "tint"];
  for (const w of WEATHERS) {
    for (const f of GRADE_FIELDS) {
      assert.deepEqual(preset.weatherGrades[w][f], WEATHER_GRADES[w][f], `weatherGrades.${w}.${f}`);
    }
  }
  for (const d of TIME_BANDS) {
    for (const f of ["sat", "lift"]) {
      assert.deepEqual(preset.dayGrades[d][f], DAY_GRADES[d][f], `dayGrades.${d}.${f}`);
    }
  }
  assert.deepEqual(validateThemePreset(preset), { ok: true, errors: [] });
});

// ---------- ② schema 校验拒绝坏 JSON（带具体字段路径） ----------
ok("② schema 拒绝：缺 token/坏 hex/NaN/缺 grade/坏 tint/坏版本/坏簇色/非对象", () => {
  const clone = () => JSON.parse(JSON.stringify(preset));
  const cases = [
    ["非对象", () => [1, 2, 3], "$"],
    ["缺 token", (j) => delete j.theme.castleRoof, "theme.castleRoof"],
    ["坏 hex", (j) => (j.theme.envGrass = "green"), "theme.envGrass"],
    ["NaN sat", (j) => (j.weatherGrades.rain.sat = NaN), "weatherGrades.rain.sat"],
    ["Infinity lift", (j) => (j.dayGrades.dusk.lift = Infinity), "dayGrades.dusk.lift"],
    ["缺天气 grade", (j) => delete j.weatherGrades.night, "weatherGrades.night"],
    ["缺昼夜 grade", (j) => delete j.dayGrades.dusk, "dayGrades.dusk"],
    ["坏 tint", (j) => (j.weatherGrades.snow.tint = "#XYZ"), "weatherGrades.snow.tint"],
    ["坏版本号", (j) => (j.version = "v1"), "version"],
    ["空 baseOn", (j) => (j.baseOn = ""), "baseOn"],
    ["簇色坏 id", (j) => (j.tileAccents[0].id = ""), "tileAccents[0].id"],
    ["簇色坏 hex", (j) => (j.tileAccents[2].hex = 123), "tileAccents[2].hex"],
    ["空簇色表", (j) => (j.tileAccents = []), "tileAccents"],
  ];
  for (const [label, mutate, expectPath] of cases) {
    const bad = mutate.length === 0 ? mutate() : clone();
    if (mutate.length !== 0) mutate(bad);
    const res = validateThemePreset(bad);
    assert.equal(res.ok, false, `${label} 应被拒绝`);
    assert.ok(
      res.errors.some((e) => e.path === expectPath),
      `${label} 错误路径应含 ${expectPath}，实际：${JSON.stringify(res.errors)}`
    );
  }
});

// ---------- ③ 注入 preset 后 finalColor/resolveBuildingTheme 与现状逐位一致 ----------
ok("③ 注入 grok-v1 后采样面（25 token × 5 天气 × 3 时段 + 可读性/回退分支 + 建筑主题）逐位一致", () => {
  setThemePresetOverrides(preset);
  const after = sampleAll();
  assert.equal(after.length, baseline.length, "采样数量");
  after.forEach((v, i) => {
    assert.equal(v, baseline[i], `采样点 #${i} 必须逐位一致`);
  });
});

// ---------- ④ 注入坏包：抛错带路径，且不半注入 ----------
ok("④ 注入校验失败的包：抛带字段路径的错误，当前生效值不被污染", () => {
  const bad = JSON.parse(JSON.stringify(preset));
  delete bad.theme.castleTrim;
  assert.throws(() => setThemePresetOverrides(bad), /theme\.castleTrim/);
  sampleAll().forEach((v, i) => {
    assert.equal(v, baseline[i], `采样点 #${i} 不应被半注入`);
  });
});

// ---------- ⑤ 回滚：注入 null 恢复代码默认 ----------
ok("⑤ 注入 null 回滚：采样逐位恢复，四张表回到代码内置常量", () => {
  setThemePresetOverrides(null);
  sampleAll().forEach((v, i) => {
    assert.equal(v, baseline[i], `采样点 #${i} 回滚`);
  });
  const tables = getActiveThemeTables();
  assert.equal(tables.theme, THEME, "token 表回到内置常量");
  assert.equal(tables.tileAccents, TILE_ACCENTS, "簇色表回到内置常量");
  assert.equal(tables.weatherGrades, WEATHER_GRADES, "天气 grade 表回到内置常量");
  assert.equal(tables.dayGrades, DAY_GRADES, "昼夜 grade 表回到内置常量");
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
  const base = { weatherGrades: { rain: { sat: 0.82, lift: -0.06 }, clear: { sat: 1 } } };
  const delta = { weatherGrades: { rain: { sat: 0.7 } } };
  const merged = mergeOverlay(base, delta);
  assert.equal(merged.weatherGrades.rain.sat, 0.7, "delta 覆盖");
  assert.equal(merged.weatherGrades.rain.lift, -0.06, "未提及字段保留 base");
  assert.equal(merged.weatherGrades.clear.sat, 1, "未提及子树保留");
  assert.equal(base.weatherGrades.rain.sat, 0.82, "入参不被修改");
});

console.log(`\n全部通过：${passed} 项`);
