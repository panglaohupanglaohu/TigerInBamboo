// =====================================================================
// Grok completion contract
//
// 这份测试把过去依赖“看截图/看 GPU/主人签字”的 Grok 条目收敛为
// 可重复的代码与数据契约。它不把 Node 时间当成硬件 FPS，也不声称
// 浏览器画面已经通过人工验收；它只证明 V8 主线具备可回滚的真源、
// 合法地表/路线、迁移提示、视觉参数和阶段门。
// =====================================================================

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { createDirtyRegionPlan } from "../TigerMessenger/src/procgen/snapshot/incrementalSnapshot.js";
import { validateThemePreset } from "../TigerMessenger/src/world/citadel/themePresets/themePresetLoader.js";
import { validateLightingPreset } from "../TigerMessenger/src/render/lighting/presetLoader.js";
import { migrateSaveV3ToV8 } from "../TigerMessenger/src/world/planetV8/saveMigrationV8.js";
import { validateRolloutStage, rollbackFlags, PROCGEN_ROLLOUT_STAGES } from "../TigerMessenger/src/procgen/migration/rolloutPlan.js";
import { compileWaterRouteLogistics, validateWaterRouteLogistics } from "../TigerMessenger/src/world/waterV8/waterRouteLogistics.js";
import { validateLandformRouteMetadata, validateCombatKeepouts } from "../TigerMessenger/src/world/planetV8/landformGameplayContracts.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.join(REPO, "TigerMessenger");
const read = (relative) => fs.readFileSync(path.join(REPO, relative), "utf8");
const readJson = (relative) => JSON.parse(read(relative));

function mustContain(relative, patterns) {
  const source = read(relative);
  for (const pattern of patterns) assert.match(source, pattern, `${relative} missing ${pattern}`);
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
}

function v6LegacyAndVisualContract() {
  const params = read("TigerMessenger/src/core/params.js");
  for (const flag of ["citadelTownV4", "citadelTerrainUvV2", "citadelCombatV3", "planetTerrainV1", "curvedWaterV1", "cloudImpostorV1"]) {
    assert.match(params, new RegExp(`${flag}:\\s*false`), `${flag} must remain explicitly rollback-safe`);
  }
  mustContain("TigerMessenger/src/core/params.js", [/legacyCanalWorld:\s*true/]);
  mustContain("TigerMessenger/src/world/citadel/runtimeAdapter.js", [/createSurfaceRider/, /bindRidersToSnapshot/]);
  mustContain("TigerMessenger/src/world/citadel/pipeline.js", [/createSurfaceProvider/]);
  mustContain("TigerMessenger/src/render/lighting/presetLoader.js", [/validateLightingPreset/, /VERSION_RE/]);
  mustContain("TigerMessenger/src/world/citadel/themePresets/themePresetLoader.js", [/validateThemePreset/, /THEME_TOKENS/]);

  const theme = readJson("TigerMessenger/src/world/citadel/themePresets/grok-v1.json");
  const lighting = readJson("TigerMessenger/src/render/lighting/presets/grok-v1.json");
  assert.equal(validateThemePreset(theme).ok, true, "versioned Grok theme preset must validate");
  assert.equal(validateLightingPreset(lighting).ok, true, "versioned Grok lighting preset must validate");
  assert.ok(theme.theme.envSkyTop && theme.theme.unitTorch, "reference palette must include sky and torch tokens");
  assert.ok(lighting.keyframes.some((frame) => frame.name === "night"), "night lighting must be versioned");
  return { flags: "rollback-safe", theme: theme.version, lighting: lighting.version };
}

function dirtyRegionPerformanceContract() {
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const plan = createDirtyRegionPlan({
      wfcCells: [`wfc:${i}`, `wfc:${i + 1}`],
      fieldChunks: [`field:${i % 8}`],
      derivedSurfaces: [`surface:${i % 4}`],
      nav: [`nav:${i % 3}`],
      props: [`props:${i % 5}`],
      AO: [`ao:${i % 2}`],
      shadow: [`shadow:${i % 2}`],
    });
    assert.deepEqual(plan.layers.sort(), ["AO", "derivedSurfaces", "fieldChunks", "nav", "props", "shadow", "wfcCells"]);
    assert.ok(plan.regions.wfcCells.length === 2, "dirty plan must preserve only affected cells");
    samples.push(performance.now() - start);
  }
  return { samples: samples.length, p50Ms: +percentile(samples, 0.5).toFixed(3), p95Ms: +percentile(samples, 0.95).toFixed(3) };
}

function v8WorkflowContract() {
  const world = compilePlanetV8({ seed: 42, landformChain: true, subdivision: 1, chartLimit: 2, resolution: 5 });
  assert.equal(world.ok, true);
  assert.equal(validateLandformRouteMetadata(world.terrainRoutes.routes).ok, true);
  assert.equal(validateCombatKeepouts(world.combatSurface).ok, true);
  const waterLogistics = compileWaterRouteLogistics({
    routes: world.water.routes,
    ports: [{ id: "old-harbor", direction: [1, 0, 0], routeId: world.water.routes[0]?.id }],
  });
  assert.equal(validateWaterRouteLogistics(waterLogistics).ok, true);
  const boat = { id: "legacy-boat", draft: 0.2 };
  assert.equal(waterLogistics.assignBoat(boat, { portId: "old-harbor" }).ok, true);
  const migrated = migrateSaveV3ToV8(
    { version: 3, player: { position: [0, 0, 160] }, boats: [{ id: boat.id, routeIndex: 0 }] },
    { project: (position) => ({ surfaceId: "planet-land", position, normal: [0, 1, 0], height: 0 }) },
    world.water.routes,
  );
  assert.ok(migrated.migrationToasts.some((toast) => toast.kind === "surface-migration"));
  assert.ok(migrated.migrationToasts.some((toast) => toast.kind === "boat-route"));
  return { routes: world.terrainRoutes.routes.length, waterRoutes: world.water.routes.length, migrationToasts: migrated.migrationToasts.length };
}

function rolloutContract() {
  for (const stage of PROCGEN_ROLLOUT_STAGES) {
    const enabled = Object.fromEntries((stage.enabled || []).map((flag) => [flag, true]));
    const result = validateRolloutStage(stage, enabled);
    assert.equal(result.ok, true, `${stage.id} enabled contract`);
    const rollback = rollbackFlags(stage);
    assert.ok(Object.values(rollback).every((value) => value === false), `${stage.id} rollback must disable every stage flag`);
  }
  assert.ok(PROCGEN_ROLLOUT_STAGES.length >= 5);
  return { stages: PROCGEN_ROLLOUT_STAGES.map((stage) => stage.id), rollbackSafe: true };
}

function runtimeCallerContract() {
  mustContain("TigerMessenger/src/player/tramRide.js", [/onBoard/, /onAlight/, /cameraRig/]);
  mustContain("TigerMessenger/src/player/boatRide.js", [/function mount/, /function dismount/, /onDismount/]);
  mustContain("TigerMessenger/src/audio/sfx.js", [/Various Artists-Tram\.mp3/, /setTramRideBgm/]);
  mustContain("TigerMessenger/src/world/citadelInfiltration.js", [/startNight/, /startReturn/, /citadel-night-infiltration/]);
  mustContain("TigerMessenger/src/world/planetV8/runtime.js", [/createCurvedWaterMaterial/, /createCloudImpostorSystem/]);
  return { tram: "boarding-camera-bgm-contract", boat: "curved-water-ride-adapter", nightHorse: "return-on-daylight" };
}

const report = {
  status: "AUTOMATED_TESTED",
  referenceProfile: "cool-blue-highland-night / warm-window-lights / spherical-cloud-and-lake-chain",
  legacyAndVisual: v6LegacyAndVisualContract(),
  dirtyRegion: dirtyRegionPerformanceContract(),
  v8Workflow: v8WorkflowContract(),
  rollout: rolloutContract(),
  runtimeCallers: runtimeCallerContract(),
  limitations: [
    "不把 Node/SwiftShader 时间解释为真实 GPU FPS",
    "不把参考图解释为已完成的人工视觉签字",
    "legacyCanalWorld 与 V8 feature flags 保持可回滚，退休仍需显式迁移提交",
  ],
};

const output = path.join(REPO, "tools/out/grok-completion-contract.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(`✅ Grok completion contract: V8 workflow, legacy rollback, visual JSON, runtime callers and rollout gates passed`);
console.log(`   dirtyRegion p95=${report.dirtyRegion.p95Ms}ms report=${output}`);
