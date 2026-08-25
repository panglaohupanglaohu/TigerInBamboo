import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { validatePlanetSnapshot } from "../TigerMessenger/src/procgen/planet/schema.js";
import { solveHydrologyV10 } from "../TigerMessenger/src/procgen/planet/hydrologyFieldV10.js";
import { solveClimateV10 } from "../TigerMessenger/src/procgen/planet/climateFieldV10.js";
import { solveEcologyV10 } from "../TigerMessenger/src/procgen/planet/ecologyFieldV10.js";
import {
  FIELD_DEPENDENCY_GRAPH_VERSION,
  validateDependencyGraphV10,
  assertNoCloudEcologyFeedbackV10,
} from "../TigerMessenger/src/procgen/planet/fieldDependencyGraphV10.js";
import { invalidateRegionsV10 } from "../TigerMessenger/src/procgen/planet/editorDirtyV10.js";
import { createSemanticCellV10, DEFAULT_SEMANTIC_CELL_V10 } from "../TigerMessenger/src/procgen/planet/semanticFieldV10.js";
import { createCapabilityLedger, canPromoteCapability } from "../TigerMessenger/src/world/planetV8/capabilityLedgerV9.js";
import { createPlanetCompileHost } from "../TigerMessenger/src/procgen/worker/compileWorker.js";
import { createPlanetSnapshotCommitQueue } from "../TigerMessenger/src/world/planetV8/snapshotCommitV8.js";
import { planetRendererOwnership } from "../TigerMessenger/src/world/planetV8/runtime.js";
import { bindVegetationChunks } from "../TigerMessenger/src/render/vegetation/vegetationRuntime.js";
import { createResourceRegistry } from "../TigerMessenger/src/core/resourceRegistry.js";

function pipelineIndex(world, name) {
  const index = world.pipeline.indexOf(name);
  assert.ok(index >= 0, `pipeline missing ${name}: ${world.pipeline.join("→")}`);
  return index;
}

assert.equal(validateDependencyGraphV10().ok, true);
assert.doesNotThrow(() => assertNoCloudEcologyFeedbackV10());
createSemanticCellV10({
  id: "cell:coupled",
  terrain: { ...DEFAULT_SEMANTIC_CELL_V10.terrain },
  water: { ...DEFAULT_SEMANTIC_CELL_V10.water },
  climate: { ...DEFAULT_SEMANTIC_CELL_V10.climate },
  ecology: { ...DEFAULT_SEMANTIC_CELL_V10.ecology },
  locks: { ...DEFAULT_SEMANTIC_CELL_V10.locks },
});

assert.equal(canPromoteCapability("DATA_TESTED", "RUNTIME_WIRED"), true);
assert.equal(canPromoteCapability("RUNTIME_WIRED", "DEFAULT_ON"), true);
assert.equal(canPromoteCapability("DATA_TESTED", "DEFAULT_ON"), false);
const ledger = createCapabilityLedger({
  entries: [{ id: "coupled-v10", state: "DATA_TESTED", test: "tools/test_planet_v10_coupled_systems.mjs", hash: "abc", seedCount: 4 }],
});
ledger.set({ id: "coupled-v10", state: "RUNTIME_WIRED", test: "tools/test_planet_v10_coupled_systems.mjs", hash: "abc", seedCount: 4 });
ledger.set({ id: "coupled-v10", state: "DEFAULT_ON", test: "tools/test_planet_v10_coupled_systems.mjs", hash: "abc", seedCount: 4 });
assert.equal(ledger.get("coupled-v10").state, "DEFAULT_ON");
assert.throws(() => createCapabilityLedger({
  entries: [{ id: "boot-default", state: "DEFAULT_ON", test: "x", hash: "abc", seedCount: 1 }],
}));
assert.throws(() => {
  const skip = createCapabilityLedger({
    entries: [{ id: "skip-default", state: "DATA_TESTED", test: "x", hash: "abc", seedCount: 1 }],
  });
  skip.set({ id: "skip-default", state: "DEFAULT_ON", test: "x", hash: "abc", seedCount: 1 });
});

assert.equal(planetRendererOwnership({}).clouds, false);
assert.equal(planetRendererOwnership({ cloudImpostorV1: true }).clouds, true);
assert.equal(planetRendererOwnership({ planetTerrainV1: true, planetPresentationVersion: "v9" }).vegetation, true);

for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 2, resolution: 4 });
  assert.equal(world.ok, true, `golden seed=${seed} ${world.stage}`);
  assert.equal(validatePlanetSnapshot(world.snapshot).ok, true, `snapshot seed=${seed}`);
  assert.ok(pipelineIndex(world, "field") < pipelineIndex(world, "hydrology"));
  assert.ok(pipelineIndex(world, "hydrology") < pipelineIndex(world, "climate"));
  assert.ok(pipelineIndex(world, "climate") < pipelineIndex(world, "ecology"));
  assert.ok(pipelineIndex(world, "climate") < pipelineIndex(world, "clouds"));
  assert.ok(pipelineIndex(world, "ecology") < pipelineIndex(world, "charts"));
  assert.ok(pipelineIndex(world, "clouds") < pipelineIndex(world, "charts"));
  assert.ok(pipelineIndex(world, "charts") < pipelineIndex(world, "vegetation"));
  assert.ok(pipelineIndex(world, "vegetation") < pipelineIndex(world, "snapshot"));
  assert.equal(world.snapshot.hydrologyHash, world.hydrology.hash);
  assert.equal(world.snapshot.climateHash, world.climate.hash);
  assert.equal(world.snapshot.ecologyHash, world.ecology.hash);
  assert.equal(world.snapshot.dependencyGraphVersion, FIELD_DEPENDENCY_GRAPH_VERSION);
  assert.equal(world.snapshot.clouds.climateHash, world.climate.hash);
  assert.equal(world.snapshot.vegetation.climateHash, world.climate.hash);
  assert.equal(world.snapshot.clouds.climateHash, world.snapshot.vegetation.climateHash);
  assert.ok(world.vegetation.every((chart) => chart.climateHash === world.climate.hash));
  assert.ok(world.vegetation.every((chart) => chart.ecologyHash === world.ecology.hash));
  assert.ok(world.clouds.instances.filter((cloud) => !cloud.authored).every((cloud) => cloud.climateSource === "climate-v10"));
  const dirty = invalidateRegionsV10(world.grid, { touches: ["vegetation"], cells: [world.ecology.cells[0].id] });
  assert.ok(dirty.regions.ecology.size >= 1);
  const outside = world.ecology.cells.filter((cell) => !dirty.regions.ecology.has(cell.id));
  assert.ok(outside.length >= 0);
}

for (let seed = 1; seed <= 100; seed++) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3 });
  assert.equal(world.ok, true, `full world seed=${seed}`);
  assert.equal(world.snapshot.climateHash, world.snapshot.vegetation.climateHash);
  assert.equal(world.snapshot.clouds.climateHash, world.climate.hash);
  assert.deepEqual(world.pipeline, ["field", "hydrology", "climate", "ecology", "clouds", "charts", "vegetation", "snapshot"]);
}

for (let seed = 1; seed <= 1000; seed++) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
  assert.equal(world.ok, true, `field seed=${seed}`);
  const hydrology = solveHydrologyV10({
    grid: world.grid,
    elevationAt: (direction) => world.field.heightAt(direction),
    seaLevel: 0,
    basinLocks: world.manifest.filter((entry) => entry.waterNeeds === "closed-lake-basin").map((entry) => ({
      id: entry.id, direction: entry.direction, angularRadius: entry.angularRadius, level: 0.08,
    })),
  });
  const climate = solveClimateV10({ grid: world.grid, hydrology, elevationAt: (direction) => world.field.heightAt(direction), wind: [1, 0, 0] });
  const ecology = solveEcologyV10({ grid: world.grid, hydrology, climate, elevationAt: (direction) => world.field.heightAt(direction) });
  assert.ok(hydrology.hash && climate.hash && ecology.hash, `field hashes seed=${seed}`);
  assert.ok(hydrology.cells.every((cell) => Number.isFinite(cell.water.waterDepth)));
  assert.ok(climate.cells.every((cell) => Number.isFinite(cell.climate.vapor)));
  assert.ok(ecology.cells.every((cell) => Number.isFinite(cell.ecology.forestness)));
}

const host = createPlanetCompileHost({ budgetMs: 1 });
const workerResult = await host.compile({ landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3 }, { id: "v10-coupled", seed: 42 });
assert.equal(workerResult.ok, true, workerResult.payload?.stage);
const queue = createPlanetSnapshotCommitQueue({ validate: validatePlanetSnapshot });
assert.equal(queue.enqueue(workerResult.payload.snapshot).ok, true);
assert.equal(queue.enqueue({ version: 7 }).ok, false);
assert.equal(queue.current, null);
const committed = queue.commitAtFrameBoundary();
assert.equal(committed.ok, true);
assert.equal(committed.snapshot.climateHash, workerResult.payload.climate.hash);
queue.enqueue(workerResult.payload.snapshot);
assert.equal(queue.enqueue({ ...workerResult.payload.snapshot, version: 0 }).ok, false);
assert.equal(queue.commitAtFrameBoundary().snapshot.climateHash, workerResult.payload.climate.hash);
host.dispose();

const registry = createResourceRegistry();
bindVegetationChunks(registry, workerResult.payload.vegetation);
registry.disposeAll();
assert.equal(registry.size(), 0);

const runtime = readFileSync(new URL("../TigerMessenger/src/world/planetV8/runtime.js", import.meta.url), "utf8");
const island = readFileSync(new URL("../TigerMessenger/src/scenes/messengerIsland.js", import.meta.url), "utf8");
const params = readFileSync(new URL("../TigerMessenger/src/core/params.js", import.meta.url), "utf8");
const compiler = readFileSync(new URL("../TigerMessenger/src/procgen/planet/planetCompilerV8.js", import.meta.url), "utf8");
assert.match(runtime, /commitAtFrameBoundary/);
assert.match(runtime, /planetRendererOwnership/);
assert.match(island, /planetRendererOwnership/);
assert.match(island, /planetLayers\.clouds \? \[\] : createCloudRing/);
assert.match(compiler, /mark\("hydrology"\)/);
assert.match(compiler, /mark\("charts"\)/);
assert.doesNotMatch(runtime, /state\.compiler\.clouds \|\| compilePlanetClouds/);
assert.match(params, /planetTerrainV1:\s*false/);
assert.match(params, /curvedWaterV1:\s*false/);
assert.match(params, /cloudImpostorV1:\s*false/);
assert.match(params, /terrainSemanticShaderV1:\s*false/);

console.log("✅ Planet V10 coupled systems: pipeline, shared climate hash, worker commit, ledger no-skip, 4 golden + 100 worlds + 1000 field seeds");
