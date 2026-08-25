// V9 look-dev 参数包门（TODO V8-G13-G / V8-G14 的 Kimi 非阻塞项）：
// landform-palette-v9.json + cloud-band-palette-v9.json 的 schema、语义引用、
// 灰度/CVD 数值检查与 camera pose hash 复核。纯数据测试，不接 runtime，不做发布阻塞点。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hexToRgb, rgbToLab, deltaE00 } from "./lib/pixelStats.mjs";
import { simulateCvd } from "./lib/colorblindSim.mjs";
import { resolveCameraManifestV8, cameraManifestPoseHash } from "../TigerMessenger/src/render/visualV8/resolveCameraV8.js";
import { createLandmarkManifest } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(repo, p), "utf8"));
const landformPkg = read("TigerMessenger/src/render/visualV8/landform-palette-v9.json");
const cloudPkg = read("TigerMessenger/src/render/visualV8/cloud-band-palette-v9.json");
const terrain = read("TigerMessenger/src/render/visualV8/terrain-palette-v8.json");
const cameras = read("TigerMessenger/src/render/visualV8/cameras-v1.json");

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

const CVD_TYPES = ["deuteranopia", "protanopia", "tritanopia"];
const L = (hex) => rgbToLab(...Object.values(hexToRgb(hex))).L;
const dE = (hexA, hexB) => deltaE00(rgbToLab(...Object.values(hexToRgb(hexA))), rgbToLab(...Object.values(hexToRgb(hexB))));
const dECvd = (hexA, hexB, type) => {
  const a = hexToRgb(hexA); const b = hexToRgb(hexB);
  const sa = simulateCvd(a.r, a.g, a.b, type); const sb = simulateCvd(b.r, b.g, b.b, type);
  return deltaE00(rgbToLab(sa.r, sa.g, sa.b), rgbToLab(sb.r, sb.g, sb.b));
};

// ---------- schema 与语义约束 ----------
const SIX_LANDFORMS = ["highland-citadel", "triple-gate", "crystal-canyon", "saihoji-moss-garden", "swamp-lake", "bookshop-town"];
const SIX_BANDS = ["snowline-crown", "windward-wall", "rift-low-fog", "lake-low-cloud", "sea-breeze-scatter", "open-sky-edge"];
assert.deepEqual(Object.keys(landformPkg.landforms).sort(), [...SIX_LANDFORMS].sort());
assert.deepEqual(Object.keys(cloudPkg.bands).sort(), [...SIX_BANDS].sort());
for (const [name, pkg] of [["landform", landformPkg], ["cloud", cloudPkg]]) {
  const raw = JSON.stringify(pkg);
  assert.ok(!/Object3D|InstancedMesh|MeshToon|scene\./.test(raw), `${name} 包不得引用运行时对象名`);
  assert.ok(pkg.version && pkg._note, `${name} 包需带 version/_note`);
}
ok("schema：六地貌/六云带齐备，无语义外对象引用，version/_note 齐");

// ---------- 地貌色板：token 引用可解析 + 数值门 ----------
for (const [id, spec] of Object.entries(landformPkg.landforms)) {
  for (const role of ["primary", "secondary", "accent"]) {
    assert.ok(terrain.tokens[spec.tokens[role]], `${id}.${role}=${spec.tokens[role]} 必须存在于 terrain-palette-v8`);
  }
  const noon = (role) => terrain.tokens[spec.tokens[role]].noon;
  const night = (role) => terrain.tokens[spec.tokens[role]].night;
  const dL = Math.abs(L(noon("primary")) - L(noon("secondary")));
  assert.ok(dL >= landformPkg.checks.primarySecondaryDeltaLNoon, `${id} 主/次 token 正午 ΔL*=${dL.toFixed(1)} < ${landformPkg.checks.primarySecondaryDeltaLNoon}`);
  const dENoon = dE(noon("primary"), noon("accent"));
  assert.ok(dENoon >= landformPkg.checks.primaryAccentDeltaE00Noon, `${id} 主/accent 正午 ΔE00=${dENoon.toFixed(1)} 不足`);
  for (const cvd of CVD_TYPES) {
    const d = dECvd(noon("primary"), noon("accent"), cvd);
    assert.ok(d >= landformPkg.checks.primaryAccentDeltaE00Cvd, `${id} 主/accent ${cvd} ΔE00=${d.toFixed(1)} 不足`);
  }
  for (const role of ["primary", "secondary", "accent"]) {
    assert.ok(L(night(role)) < landformPkg.checks.nightTokenMaxL, `${id}.${role} 深夜 L* 超限`);
  }
  const trim = spec.gradeTrim;
  assert.ok(trim.exposureMul >= 0.8 && trim.exposureMul <= 1.2, `${id} exposureMul 越界`);
  assert.ok(Math.abs(trim.saturationMul - 1) <= 0.1, `${id} saturationMul 越界（克制原则）`);
  assert.equal(trim.ambientAdd, 0, `${id} 禁止抬全局 ambient`);
}
ok("地貌色板：六景区主/次灰度分层、主/accent 三色盲可分、trim 克制（不抬 ambient）");

// ---------- 云带：夜间 L* 上限 + 灰度/CVD 门 ----------
for (const [band, spec] of Object.entries(cloudPkg.bands)) {
  const nightL = L(spec.nightColor);
  assert.ok(nightL <= cloudPkg.checks.nightMaxL, `${band} 夜间 L*=${nightL.toFixed(1)} > ${cloudPkg.checks.nightMaxL}`);
  assert.ok(spec.opacity > 0 && spec.opacity <= 1 && spec.nightOpacity > 0 && spec.nightOpacity <= 1, `${band} opacity 域`);
}
const dLDenseThin = Math.abs(L(cloudPkg.bands["windward-wall"].color) - L(cloudPkg.bands["open-sky-edge"].color));
assert.ok(dLDenseThin >= cloudPkg.checks.denseVsThinDeltaLNoon, `厚墙/薄缘正午 ΔL*=${dLDenseThin.toFixed(1)} 不足`);
for (const cvd of CVD_TYPES) {
  const d = dECvd(cloudPkg.bands["snowline-crown"].color, cloudPkg.bands["rift-low-fog"].color, cvd);
  assert.ok(d >= cloudPkg.checks.crownVsFogDeltaE00Cvd, `雪冠/低雾 ${cvd} ΔE00=${d.toFixed(1)} 不足`);
}
ok("云带：六带夜间 L*≤32、厚墙/薄缘灰度可分、雪冠/低雾三色盲可分");

// ---------- camera pose hash 复核 ----------
{
  const hash = cameraManifestPoseHash(resolveCameraManifestV8(cameras, createLandmarkManifest({ seed: 1 }), 160));
  assert.equal(hash, landformPkg.cameraPoseHash, `pose hash 漂移：${hash} ≠ ${landformPkg.cameraPoseHash}`);
  assert.equal(cameras.cameras.length, 34, "34 镜头清单变动需升版本");
  ok(`camera pose hash=${hash}（34 镜头，与记录一致）`);
}

console.log(`✅ V9 look-dev 参数包门 assertions groups=${passed}（非阻塞，未接入发布门）`);
