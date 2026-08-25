// =====================================================================
//  V8-K0 / V8-G4 / V8-G9 · Kimi 视觉参数包门禁
//  ① 34 镜头清单 schema + 分组计数 + landmark 锚点合法性
//  ② 地形/水体/云/光照四份 JSON schema（只引用 semantic token）
//  ③ 地形色板可访问性：草/林/岩/苔 noon 两两 ΔE00、灰度 ΔL*、
//     deuteranopia/protanopia/tritanopia 模拟后仍可区分（V8-G4 Kimi 项）
//  ④ 海陆 ΔL* 正午 ≥18 / 深夜 ≥12（对齐 C7 门槛）
//  ⑤ 云深夜不发白、水沫深夜不发白
//  运行：node tools/test_planet_v8_visual.mjs
// =====================================================================
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  validateCameraManifest,
  validateTerrainPalette,
  validateWaterPalette,
  validateCloudPalette,
  validateLightingV8,
} from "../TigerMessenger/src/render/visualV8/validateVisualPackageV8.js";
import { LANDMARK_IDS, createLandmarkManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import {
  resolveCameraManifestV8,
  cameraManifestPoseHash,
} from "../TigerMessenger/src/render/visualV8/resolveCameraV8.js";
import { WORLD_RADIUS } from "../TigerMessenger/src/world/worldScale.js";
import { hexToRgb, rgbToLab, deltaE00, deltaLStar } from "./lib/pixelStats.mjs";
import { simulateCvd } from "./lib/colorblindSim.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.join(here, "../TigerMessenger/src/render/visualV8");
const load = (name) => JSON.parse(readFileSync(path.join(pkgDir, name), "utf8"));

const cameras = load("cameras-v1.json");
const terrain = load("terrain-palette-v8.json");
const water = load("water-palette-v8.json");
const cloud = load("cloud-palette-v8.json");
const lighting = load("lighting-v8.json");

// ---- ① 镜头清单 ----
{
  const r = validateCameraManifest(cameras, LANDMARK_IDS);
  assert.ok(r.ok, `镜头清单校验失败: ${JSON.stringify(r.errors, null, 2)}`);
  assert.equal(cameras.cameras.length, 34);
  console.log("① 34 镜头清单：分组 4/6/5/4/4/3/3/3/2、锚点合法、字段齐全 ✅");
}

// ---- ② 色板/光照 schema ----
for (const [label, json, fn] of [
  ["terrain-palette-v8", terrain, validateTerrainPalette],
  ["water-palette-v8", water, validateWaterPalette],
  ["cloud-palette-v8", cloud, validateCloudPalette],
  ["lighting-v8", lighting, validateLightingV8],
]) {
  const r = fn(json);
  assert.ok(r.ok, `${label} 校验失败: ${JSON.stringify(r.errors, null, 2)}`);
}
console.log("② 四份 JSON schema 通过（版本/baseOn/token/字段路径校验）✅");

// ---- ③④⑤ 色彩可访问性与门槛 ----
const lab = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToLab(r, g, b);
};
const labL = (hex) => lab(hex).L;
const C = terrain.constraints;

// ③ 植被/岩层 noon 两两 ΔE00
const vegTokens = ["grass", "hill", "moss", "forest", "rock"];
for (let i = 0; i < vegTokens.length; i++) {
  for (let j = i + 1; j < vegTokens.length; j++) {
    const a = vegTokens[i];
    const b = vegTokens[j];
    const de = deltaE00(lab(terrain.tokens[a].noon), lab(terrain.tokens[b].noon));
    assert.ok(
      de >= C.vegetationPairDeltaE00Noon,
      `noon ΔE00(${a},${b})=${de.toFixed(2)} < ${C.vegetationPairDeltaE00Noon}`
    );
  }
}
// 灰度 ΔL*：forest/rock 对 grass
for (const t of ["forest", "rock"]) {
  const dl = deltaLStar(terrain.tokens[t].noon, terrain.tokens.grass.noon);
  assert.ok(dl >= C.grassForestRockDeltaL, `noon ΔL*(${t},grass)=${dl.toFixed(2)} < ${C.grassForestRockDeltaL}`);
}
// 三类色盲模拟后 grass/forest/rock 两两 ΔE00
for (const type of ["deuteranopia", "protanopia", "tritanopia"]) {
  const sim = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const s = simulateCvd(r, g, b, type);
    return rgbToLab(s.r, s.g, s.b);
  };
  const trio = ["grass", "forest", "rock"];
  for (let i = 0; i < trio.length; i++) {
    for (let j = i + 1; j < trio.length; j++) {
      const de = deltaE00(sim(terrain.tokens[trio[i]].noon), sim(terrain.tokens[trio[j]].noon));
      assert.ok(
        de >= C.vegetationPairDeltaE00Cvd,
        `${type} ΔE00(${trio[i]},${trio[j]})=${de.toFixed(2)} < ${C.vegetationPairDeltaE00Cvd}`
      );
    }
  }
}
console.log("③ 草/丘/苔/林/岩 noon 两两 ΔE00、灰度 ΔL*、三类色盲模拟可区分 ✅");

// ④ 海陆 ΔL*
{
  const noon = deltaLStar(terrain.tokens.deepOcean.noon, terrain.tokens.grass.noon);
  assert.ok(noon >= C.landSeaDeltaLNoon, `海陆 noon ΔL*=${noon.toFixed(2)} < ${C.landSeaDeltaLNoon}`);
  const night = deltaLStar(terrain.tokens.deepOcean.night, terrain.tokens.grass.night);
  assert.ok(night >= C.landSeaDeltaLNight, `海陆 night ΔL*=${night.toFixed(2)} < ${C.landSeaDeltaLNight}`);
  console.log(`④ 海陆 ΔL*：noon=${noon.toFixed(1)} night=${night.toFixed(1)} ✅`);
}

// ⑤ 云/水沫深夜不发白
{
  const cloudNightL = labL(cloud.conditions.night.color);
  assert.ok(cloudNightL <= cloud.constraints.nightMaxL, `云 night L*=${cloudNightL.toFixed(1)} > ${cloud.constraints.nightMaxL}`);
  const foamNightL = labL(water.tokens.foam.night);
  assert.ok(foamNightL <= water.constraints.foamNightMaxL, `水沫 night L*=${foamNightL.toFixed(1)} > ${water.constraints.foamNightMaxL}`);
  // 云深夜只允许略亮于深夜天空背景
  const skyL = labL(lighting.keyframes.find((k) => k.name === "night").skyColor);
  assert.ok(cloudNightL <= skyL + 8, `云 night L*=${cloudNightL.toFixed(1)} 超出深夜天空 L*=${skyL.toFixed(1)}+8`);
  console.log(`⑤ 云 night L*=${cloudNightL.toFixed(1)}、水沫 night L*=${foamNightL.toFixed(1)}（上限受控）✅`);
}

console.log("✅ V8 Kimi 视觉参数包全部门禁通过");

// ---- ⑥ 镜头解析器：位姿合法 + 同输入逐位一致 ----
{
  const manifest = createLandmarkManifest({ seed: 1 });
  const resolved = resolveCameraManifestV8(cameras, manifest, WORLD_RADIUS);
  assert.equal(resolved.length, 34);
  const byId = new Map(cameras.cameras.map((c) => [c.id, c]));
  for (const c of resolved) {
    const spec = byId.get(c.id);
    const posLen = Math.hypot(...c.position);
    const tgtLen = Math.hypot(...c.target);
    const upLen = Math.hypot(...c.up);
    assert.ok(Math.abs(posLen - (WORLD_RADIUS + spec.offset.heightUnits)) < 1e-4, `${c.id} 相机高度不守恒`);
    assert.ok(Math.abs(tgtLen - WORLD_RADIUS) < 1e-4, `${c.id} 目标点不在球面`);
    assert.ok(Math.abs(upLen - 1) < 1e-6, `${c.id} up 非单位向量`);
    const dist = Math.hypot(c.position[0] - c.target[0], c.position[1] - c.target[1], c.position[2] - c.target[2]);
    assert.ok(dist > spec.near && dist < spec.far, `${c.id} 目标距离 ${dist.toFixed(1)} 超出 near/far`);
  }
  const h1 = cameraManifestPoseHash(resolveCameraManifestV8(cameras, createLandmarkManifest({ seed: 1 }), WORLD_RADIUS));
  const h2 = cameraManifestPoseHash(resolveCameraManifestV8(cameras, createLandmarkManifest({ seed: 1 }), WORLD_RADIUS));
  assert.equal(h1, h2, "同 seed 两次解析 hash 必须一致");
  console.log(`⑥ 34 镜头位姿解析：球面/高度/up/视距合法，pose hash=${h1} 可复现 ✅`);
}
