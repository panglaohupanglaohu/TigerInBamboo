import assert from "node:assert/strict";
import { createTerrainTiles, TERRAIN_TILE_PROTOTYPES } from "../TigerMessenger/src/procgen/planet/terrainTiles.js";
import { validateTerrainTile } from "../TigerMessenger/src/procgen/planet/terrainTileSchema.js";
import { compileSphericalTerrainTable } from "../TigerMessenger/src/procgen/planet/sphericalWfc.js";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";

const expected = ["peak.glacier", "peak.snowline", "rift.escarpment", "rift.floor", "rift.fault-step", "lake.rift", "lake.reed-shore", "volcanic.cone", "volcanic.tuff", "plain.alluvial", "plain.moss", "plain.stream"];
const prototypes = new Map(TERRAIN_TILE_PROTOTYPES.map((tile) => [tile.id, tile]));
for (const id of expected) {
  const tile = prototypes.get(id);
  assert.ok(tile, id);
  assert.equal(validateTerrainTile(tile).ok, true, id);
  for (const key of ["snowness", "ashness", "sediment", "mossness"]) assert.ok(Number.isFinite(tile[key]), `${id}.${key}`);
  assert.ok(Array.isArray(tile.flow) && tile.flow.length === 3, `${id}.flow`);
  assert.ok(tile.transitionTags.length > 0, `${id}.transitionTags`);
}
const tiles = createTerrainTiles();
assert.equal(new Set(tiles.map((tile) => tile.key)).size, tiles.length);
assert.equal(tiles.filter((tile) => expected.includes(tile.id)).length, expected.length * 3);
const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 1, seed: 42 });
const table = compileSphericalTerrainTable(grid.dual, tiles);
assert.equal(table.variants.length, tiles.length);
assert.ok(Object.values(table.compatible).every((bitsets) => bitsets.every((bitset) => bitset.popcount() > 0)));
console.log(`✅ Planet V8 landform tiles: prototypes=${expected.length}, variants=${tiles.length}, directions=${table.directions.length}`);
