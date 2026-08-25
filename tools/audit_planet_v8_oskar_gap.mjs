import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { createCapabilityLedger } from "../TigerMessenger/src/world/planetV8/capabilityLedgerV9.js";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const source = {
  params: read("TigerMessenger/src/core/params.js"),
  runtime: read("TigerMessenger/src/world/planetV8/runtime.js"),
  field: read("TigerMessenger/src/procgen/planet/planetFieldComposer.js"),
  vegetation: read("TigerMessenger/src/procgen/planet/vegetationCompilerV8.js"),
  cloudCompiler: read("TigerMessenger/src/render/clouds/cloudClusterCompiler.js"),
  cloudShader: read("TigerMessenger/src/render/clouds/cloudImpostorMaterial.js"),
  waterCompiler: read("TigerMessenger/src/world/waterV8/curvedWaterCompiler.js"),
  waterShader: read("TigerMessenger/src/render/water/curvedWaterMaterial.js"),
  terrainShader: read("TigerMessenger/src/render/terrain/semanticTerrainMaterial.js"),
  vegetationRuntime: read("TigerMessenger/src/render/vegetation/vegetationRuntime.js"),
  waterEvents: read("TigerMessenger/src/world/waterV8/waterSurfaceEvents.js"),
  capabilityLedger: read("TigerMessenger/src/world/planetV8/capabilityLedgerV9.js"),
};

const seeds = [1, 7, 42, 884];
const worlds = seeds.map((seed) => compilePlanetV8({
  seed,
  landformChain: true,
  subdivision: 1,
  chartLimit: 6,
  resolution: 4,
}));
assert.ok(worlds.every((world) => world.ok), "V8 audit worlds must compile");

const elevationSamples = worlds.map((world, index) => {
  const samples = world.manifest
    .filter((entry) => entry.chainOrder != null)
    .map((entry) => ({ id: entry.id, height: world.field.heightAt(entry.direction) }));
  const highland = samples.find((entry) => entry.id === "highland-citadel");
  const second = Math.max(...samples.filter((entry) => entry.id !== "highland-citadel").map((entry) => entry.height));
  const final = world.finalElevationReport;
  return {
    seed: seeds[index],
    samples,
    highlandMargin: final?.highlandMargin ?? (highland.height - second),
    strictHighest: final?.ok === true,
    probeCount: final?.probeCount ?? 0,
    prominentPeaks: final?.prominentPeaks ?? 0,
  };
});

const defaultFlags = Object.fromEntries([
  "planetTerrainV1",
  "curvedWaterV1",
  "terrainSemanticShaderV1",
  "cloudImpostorV1",
].map((name) => {
  const match = source.params.match(new RegExp(`${name}:\\s*(true|false)`));
  return [name, match?.[1] === "true"];
}));

const vegetationDataCount = worlds.reduce(
  (total, world) => total + world.vegetation.reduce((sum, chart) => sum + chart.instanceCount, 0),
  0,
);
const runtimeRendersVegetation = /createVegetation|vegetationRenderer|state\.vegetation|InstancedMesh\([^)]*vegetation/i.test(`${source.runtime}\n${source.vegetationRuntime}`);
const cloudHasClimateData = /oceanFetch/.test(source.cloudCompiler)
  && /windward/.test(source.cloudCompiler)
  && /rainShadow/.test(source.cloudCompiler)
  && /cloudBase/.test(source.cloudCompiler);
const cloudFollowsTerrain = /ridgeTangent|terrainClearance|surfaceHeight|orographicPath|terrainFlow/i.test(`${source.cloudCompiler}\n${source.cloudShader}`);
const waterIsCurved = worlds.every((world) => world.water?.ocean?.curved && world.water?.lakes?.every((lake) => lake.curved));
const waterUsesTerrainWfcMc = /fieldRecipe|semanticAt|waterData0|irregular/i.test(source.waterCompiler);
const oceanHasFoam = /foam|shoreDistance|breakingWave|whitecap/i.test(source.waterShader);
const lakeHasWakeOrRipples = /wake|ripple|ringEvent|impulseAtlas/i.test(`${source.waterCompiler}\n${source.waterShader}`);
const grassHasDetailGeometryOrTexture = /grassBlade|grassBillboard|sampler2D|windBend|detailNormal/i.test(`${source.terrainShader}\n${source.vegetationRuntime}`);
const editorBackend = [
  "TigerMessenger/src/procgen/inspector/procgenInspector.js",
  "TigerMessenger/src/world/planetV8/snapshotCommitV8.js",
  "TigerMessenger/src/procgen/snapshot/incrementalSnapshot.js",
].every((path) => existsSync(new URL(path, ROOT)));
const editorUi = [
  "TigerMessenger/src/tools/terrainEditorV8.js",
  "TigerMessenger/src/tools/terrainEditorV8.html",
  "TigerMessenger/src/world/planetV8/terrainEditorV8.js",
  "TigerMessenger/src/tools/terrainEditorV9/terrainEditorCore.js",
  "TigerMessenger/src/tools/terrainEditorV9/terrainEditorView.js",
].some((path) => existsSync(new URL(path, ROOT)));

const capabilities = [
  {
    id: "terrain-chain",
    status: "DATA_TESTED",
    automatedEvidence: worlds.every((world) => world.chainReport?.ok && world.seamReport?.ok),
    missing: "V8 is opt-in and the final field lacks a strict global-highest-peak gate.",
  },
  {
    id: "highland-global-maximum",
    status: elevationSamples.every((sample) => sample.strictHighest) ? "DATA_TESTED" : "MISSING",
    automatedEvidence: elevationSamples,
    missing: "Validate final field samples, not authored elevationBand metadata.",
  },
  {
    id: "dense-forest",
    status: vegetationDataCount > 0 && runtimeRendersVegetation ? "RUNTIME_WIRED" : "DATA_TESTED",
    automatedEvidence: { vegetationDataCount, runtimeRendersVegetation },
    missing: "Render clustered vegetation with biome density, LOD and keepouts in the V8 runtime.",
  },
  {
    id: "mountain-rolling-clouds",
    status: cloudHasClimateData && cloudFollowsTerrain ? "RUNTIME_WIRED" : "DATA_TESTED",
    automatedEvidence: { cloudHasClimateData, cloudFollowsTerrain },
    missing: "Bake ridge-following streamlines, terrain clearance and windward lift into instance motion.",
  },
  {
    id: "ocean-surface",
    status: waterIsCurved && oceanHasFoam && waterUsesTerrainWfcMc ? "RUNTIME_WIRED" : "DATA_TESTED",
    automatedEvidence: { waterIsCurved, oceanHasFoam, waterUsesTerrainWfcMc },
    missing: "Compile irregular water topology/shore semantics and add swell, whitecaps and shoreline foam.",
  },
  {
    id: "lake-surface",
    status: waterIsCurved && lakeHasWakeOrRipples ? "RUNTIME_WIRED" : "DATA_TESTED",
    automatedEvidence: { waterIsCurved, lakeHasWakeOrRipples },
    missing: "Separate calm-lake material, wake ribbons and bounded ripple impulses from ocean waves.",
  },
  {
    id: "grass-surface",
    status: grassHasDetailGeometryOrTexture ? "RUNTIME_WIRED" : "DATA_TESTED",
    automatedEvidence: { grassHasDetailGeometryOrTexture },
    missing: "Add semantic detail splat and billboard/blade clusters with GPU wind and contrast-aware outlines.",
  },
  {
    id: "terrain-editor",
    status: editorBackend && editorUi ? "RUNTIME_WIRED" : editorBackend ? "DATA_TESTED" : "MISSING",
    automatedEvidence: { editorBackend, editorUi },
    missing: "Provide topographic 2D/3D editor UI, brushes, local rebuild preview and replayable transactions.",
  },
];

const ledger = createCapabilityLedger({
  entries: capabilities.map((entry) => ({
    id: entry.id,
    state: entry.status,
    test: "tools/audit_planet_v8_oskar_gap.mjs",
    hash: createHash("sha1").update(JSON.stringify(entry.automatedEvidence)).digest("hex"),
    seedCount: seeds.length,
    featureFlag: {
      "terrain-chain": "planetGraphV1",
      "highland-global-maximum": "planetTerrainV1",
      "dense-forest": "planetTerrainV1",
      "mountain-rolling-clouds": "cloudImpostorV1",
      "ocean-surface": "curvedWaterV1",
      "lake-surface": "curvedWaterV1",
      "grass-surface": "terrainSemanticShaderV1",
      "terrain-editor": null,
    }[entry.id],
    details: entry.automatedEvidence,
  })),
});
assert.equal(ledger.validate().ok, true);

const report = {
  version: 1,
  audit: "planet-v8-oskar-gap",
  generatedAt: new Date().toISOString(),
  seeds,
  defaultFlags,
  productionEnabled: Object.values(defaultFlags).some(Boolean),
  capabilities,
  ledger: ledger.toJSON(),
  verdict: capabilities.every((entry) => ["DATA_TESTED", "RUNTIME_WIRED", "VISUAL_PROXY_PASSED", "DEFAULT_ON"].includes(entry.status))
    ? (Object.values(defaultFlags).every(Boolean) ? "COMPLETE_DEFAULT_ON" : "RUNTIME_READY_OPT_IN")
    : "NOT_COMPLETE",
};

console.log(JSON.stringify(report, null, 2));
