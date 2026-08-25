import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compilePlanetV8, trianglesFromMesh } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import {
  compileVegetationV9,
  mergeVegetationChunks,
  vegetationInstanceHash,
  speciesFromEcologyBand,
} from "../TigerMessenger/src/procgen/planet/vegetationCompilerV9.js";
import { bindVegetationChunks } from "../TigerMessenger/src/render/vegetation/vegetationRuntime.js";
import { createResourceRegistry } from "../TigerMessenger/src/core/resourceRegistry.js";
import { SPECIES_BAND_INDEX_V10 } from "../TigerMessenger/src/procgen/planet/ecologyFieldV10.js";

function keepoutsFromWorld(world) {
  const radius = 160;
  const keepouts = world.manifest
    .filter((entry) => entry.id !== "saihoji-moss-garden")
    .map((entry) => ({
      id: entry.id,
      position: entry.direction.map((value) => value * (radius + world.field.heightAt(entry.direction))),
      radius: entry.angularRadius * radius * 0.35,
    }));
  for (const zone of world.combatSurface.zones) {
    for (const keepout of zone.keepouts) {
      keepouts.push({ id: `${zone.id}:${keepout.id}`, position: keepout.position, radius: keepout.radius });
    }
  }
  return keepouts;
}

function allInstances(vegetationByChart) {
  return vegetationByChart.flatMap((chart) => Object.values(chart.buckets).flat());
}

for (const seed of [1, 7, 42, 884]) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
  assert.equal(world.ok, true, `seed=${seed}`);
  assert.ok(world.ecology?.hash, `seed=${seed} ecology hash`);
  assert.equal(world.snapshot.vegetation.ecologyHash, world.ecology.hash);
  assert.equal(world.snapshot.vegetation.ecologySource, "ecology-v10");
  const total = world.vegetation.reduce((sum, chart) => sum + chart.instanceCount, 0);
  assert.ok(total > 0, `seed=${seed} must have vegetation`);
  const speciesSeen = new Set();
  for (const chart of world.vegetation) {
    assert.equal(chart.kind, "planet-vegetation-v9");
    assert.equal(chart.ecologySource, "ecology-v10");
    assert.ok(chart.chartId);
    for (const [species, instances] of Object.entries(chart.buckets)) {
      speciesSeen.add(species);
      for (const instance of instances) {
        assert.ok(instance.instanceId && instance.normal.length === 3);
        assert.ok(instance.lodRange[1] > instance.lodRange[0]);
        assert.ok(instance.windWeight >= 0 && instance.windWeight <= 1);
        assert.equal(instance.ecologySource, "ecology-v10");
        const packed = world.ecology.cells[instance.cellIndex];
        assert.ok(packed, `seed=${seed} ecology cell ${instance.cellIndex}`);
        assert.equal(instance.cellId, packed.id);
        assert.ok(Math.abs(instance.forestness - packed.ecology.forestness) < 1e-9, "forestness must copy ecologyFieldV10");
        assert.ok(Math.abs(instance.grassness - packed.ecology.grassness) < 1e-9);
        assert.ok(Math.abs(instance.reedness - packed.ecology.reedness) < 1e-9);
        assert.ok(Math.abs(instance.mudness - packed.ecology.mudness) < 1e-9);
        assert.equal(instance.speciesBand, packed.ecology.speciesBand);
        if (instance.species !== "grass") {
          assert.equal(instance.species, speciesFromEcologyBand(instance.speciesBand));
        }
      }
    }
  }
  for (const required of ["pine", "broadleaf", "wetland", "grass", "rock"]) {
    assert.ok(speciesSeen.has(required), `seed=${seed} missing bucket ${required}`);
  }
  for (const chart of world.charts) {
    assert.equal(chart.semantic.climateData1.length, chart.semantic.count * 4);
    assert.equal(chart.semantic.ecologyData0.length, chart.semantic.count * 4);
  }
}

const world42 = compilePlanetV8({ seed: 42, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 8 });
assert.equal(world42.ok, true);
const instances = allInstances(world42.vegetation);
const dirtyInstance = instances.find((instance) => instance.cellId) || { cellId: world42.ecology.cells[0].id };
const dirtyId = dirtyInstance.cellId;
const mutatedCells = world42.ecology.cells.map((cell) => {
  if (cell.id !== dirtyId) return cell;
  return {
    ...cell,
    ecology: {
      ...cell.ecology,
      forestness: 1,
      grassness: 0.8,
      speciesBand: SPECIES_BAND_INDEX_V10.pine,
    },
  };
});
const mutatedEcology = {
  ...world42.ecology,
  cells: mutatedCells,
  byId: new Map(mutatedCells.map((cell) => [cell.id, cell])),
  hash: "mutated",
};
const keepouts = keepoutsFromWorld(world42);
const nextVegetation = world42.charts.map((chart, index) => compileVegetationV9({
  triangles: trianglesFromMesh(chart.mesh, world42.field),
  profile: world42.vegetation[index].profile,
  seed: 42 + chart.cellIndex,
  keepouts,
  maxInstances: 240,
  ecology: mutatedEcology,
  grid: world42.grid,
  chartId: chart.id,
}));
const merged = mergeVegetationChunks(world42.vegetation, nextVegetation, [dirtyId]);
assert.equal(
  world42.vegetation.map((chart) => vegetationInstanceHash(chart, { excludeCellIds: [dirtyId] })).join("|"),
  merged.map((chart) => vegetationInstanceHash(chart, { excludeCellIds: [dirtyId] })).join("|"),
  "instances outside the dirty cell must keep their hash",
);

const registry = createResourceRegistry();
for (let round = 0; round < 20; round++) {
  bindVegetationChunks(registry, world42.vegetation);
  registry.disposeAll();
  assert.equal(registry.size(), 0, `registry must be empty after dispose round ${round + 1}`);
}
bindVegetationChunks(registry, world42.vegetation);
const dirtyChartIds = [world42.vegetation[0].chartId];
bindVegetationChunks(registry, world42.vegetation, { dirtyChartIds });
assert.equal(registry.size(), world42.vegetation.length);
registry.disposeAll();
assert.equal(registry.size(), 0);

const terrainShader = readFileSync(new URL("../TigerMessenger/src/render/terrain/semanticTerrainMaterial.js", import.meta.url), "utf8");
const vegetationRuntime = readFileSync(new URL("../TigerMessenger/src/render/vegetation/vegetationRuntime.js", import.meta.url), "utf8");
const vegetationCompiler = readFileSync(new URL("../TigerMessenger/src/procgen/planet/vegetationCompilerV9.js", import.meta.url), "utf8");
assert.match(terrainShader, /contrastAwareOutline/);
assert.match(terrainShader, /windBend/);
assert.match(terrainShader, /ecologicalWetness/);
assert.match(terrainShader, /precipitation/);
assert.match(terrainShader, /climateData1/);
assert.match(terrainShader, /ecologyData0/);
assert.match(terrainShader, /mudColor/);
assert.match(vegetationRuntime, /grassBillboard/);
assert.match(vegetationRuntime, /InstancedMesh/);
assert.match(vegetationRuntime, /replaceDirty/);
assert.match(vegetationRuntime, /bindVegetationChunks/);
assert.match(vegetationRuntime, /resourceRegistry/);
assert.match(vegetationCompiler, /readEcologySample/);
assert.doesNotMatch(vegetationCompiler, /forestDensityAt/);
assert.doesNotMatch(vegetationCompiler, /dot\(direction,\s*wind\)/);

console.log("✅ Planet V9 forest/grass: ecology-v10 single source, species buckets, dirty replace, 20-round registry recycle and grass wind/contrast shader passed");
