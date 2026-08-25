import assert from "node:assert/strict";
import { createAuthoringField, createTerrainEditorSession, TERRAIN_BRUSHES, terrainEditorHash } from "../TigerMessenger/src/tools/terrainEditorV9/terrainEditorCore.js";
import { createTerrainEditorV9View } from "../TigerMessenger/src/tools/terrainEditorV9/terrainEditorView.js";

assert.equal(TERRAIN_BRUSHES.length, 12);
const initial = createAuthoringField({ width: 8, height: 8, seed: 42, cells: [{ id: "4:4", height: 7, hardLock: true, biome: "mountain" }] });
const session = createTerrainEditorSession({
  field: initial,
  hardLocks: ["4:4", "0:0"],
  compilePreview(snapshot, dirty) { return { ok: dirty.layers.includes("fieldChunks") || snapshot.transactions.length === 0, snapshot }; },
  validate(snapshot) { return { ok: snapshot.field.cells.every((cell) => Number.isFinite(cell.height)), errors: [] }; },
});

const before = terrainEditorHash(session);
const blocked = session.apply({ kind: "raise", center: [4, 4], radius: 0.2, strength: 3 });
assert.equal(blocked.ok, false);
const raised = session.apply({ kind: "raise", center: [2, 2], radius: 1.5, strength: 2 });
assert.equal(raised.ok, true);
assert.ok(raised.transaction.dirty.regions.fieldChunks.length > 0);
const after = terrainEditorHash(session);
assert.notEqual(after, before);
assert.equal(session.undo().ok, true);
assert.equal(terrainEditorHash(session), before);
assert.equal(session.redo().ok, true);
assert.equal(terrainEditorHash(session), after);

for (const kind of TERRAIN_BRUSHES) {
  const result = session.apply({ kind, center: [6, 6], radius: 0.9, strength: 0.25, value: -0.1 });
  assert.equal(result.ok, true, `brush ${kind} should be replayable`);
}
const preview = session.preview();
assert.equal(preview.ok, true);
const committed = session.commit();
assert.equal(committed.ok, true);
assert.equal(committed.committed, true);

const serialized = session.serialize();
assert.match(serialized, /"schema":9/);
const replayed = session.replay(JSON.parse(serialized).transactions.map((entry) => entry.command));
assert.equal(terrainEditorHash(session), terrainEditorHash({ snapshot: () => replayed }));

class FakeNode {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.firstChild = null; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  appendChild(node) { this.children.push(node); this.firstChild = this.children[0] || null; return node; }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  removeChild(node) { this.children = this.children.filter((child) => child !== node); this.firstChild = this.children[0] || null; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
}
const fakeDocument = { createElement: (tag) => new FakeNode(tag), createElementNS: (_ns, tag) => new FakeNode(tag) };
const container = new FakeNode("main");
const editorView = createTerrainEditorV9View({ document: fakeDocument, container, session });
assert.equal(editorView.dataset.terrainEditor, "v9");
assert.ok(editorView.children.some((child) => child.dataset.role === "contours"));
assert.ok(editorView.children[0].children.length >= TERRAIN_BRUSHES.length);
editorView.refresh();

console.log(`✅ Planet V9 terrain editor: 12 brushes, hard locks, dirty transactions, undo/redo, commit and replay passed (${session.historySize} commands)`);

// =====================================================================
// V10 dependency cone + field overlay (G21-G DeepSeek data layer, pure
// Node): terrain edit -> hydrology halo + climate downwind cone; cone is
// bounded by maxFetchDistance and crosses chart seams; outside-region hash
// unchanged; undo/redo and rejected transactions restore dirty hashes;
// overlay probes read the same semantic cells the view renders.
// =====================================================================
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { solveHydrologyV10 } from "../TigerMessenger/src/procgen/planet/hydrologyFieldV10.js";
import { solveClimateV10 } from "../TigerMessenger/src/procgen/planet/climateFieldV10.js";
import { solveEcologyV10 } from "../TigerMessenger/src/procgen/planet/ecologyFieldV10.js";
import { invalidateRegionsV10, localHaloV10, dirtyRegionHashV10 } from "../TigerMessenger/src/procgen/planet/editorDirtyV10.js";
import { buildFieldOverlayV10, FIELD_OVERLAY_LAYERS_V10 } from "../TigerMessenger/src/procgen/planet/fieldOverlayV10.js";

const world = compilePlanetV8({ seed: 1, landformChain: true, subdivision: 1, chartLimit: 1, resolution: 3, stopAfter: "routes" });
assert.equal(world.ok, true, world.stage);
const grid = world.grid;
const wind = [0.3, 0.55, 0.78];
const windUnit = wind.map((v) => v / Math.hypot(...wind));
const allIds = grid.dual.cells().map((cell) => cell.id);
const source = [allIds[0], allIds[Math.floor(allIds.length / 2)]];
const axis = (id) => {
  const dir = grid.dual.directionOf(grid.dual.indexOfId(id));
  return dir[0] * windUnit[0] + dir[1] * windUnit[1] + dir[2] * windUnit[2];
};

// 1. dependency scope: terrain edit dirties hydrology (halo) and climate
//    (downwind cone); the cone must NOT be a full halo — downwind cells are
//    dirty, upwind cells beyond the halo are not.
const terrainEdit = invalidateRegionsV10(grid, { touches: ["terrain"], cells: source }, { wind });
assert.ok(terrainEdit.counts.hydrology > 0 && terrainEdit.counts.climate > 0, "terrain edit must dirty hydrology + climate");
assert.equal(terrainEdit.counts.vegetation, 0, "terrain edit must not dirty vegetation");
// 2. maxFetchDistance bound: no cone cell may lie more than maxFetchDistance
//    (radians) downwind of its source
const sourceAxisMin = Math.min(...source.map(axis));
const sourceAxisMax = Math.max(...source.map(axis));
const coneExcess = [...terrainEdit.regions.climate].filter((id) => axis(id) > sourceAxisMax + 1.6 + 1e-6);
assert.equal(coneExcess.length, 0, "cone must be bounded by maxFetchDistance downwind");
// the cone never walks upwind: every cone cell is at or downwind of a source
const coneUpwind = [...terrainEdit.regions.climate].filter((id) => axis(id) < sourceAxisMin - 1e-6 && !terrainEdit.regions.hydrology.has(id));
assert.equal(coneUpwind.length, 0, "cone must not walk upwind");
// 3. cross-seam propagation: the cone touches at least two chart buckets
const chartBuckets = new Set(grid.charts.map((chart) => chart.key));
const coneCharts = new Set(grid.charts.filter((chart) => chart.cellIndices.some((index) => terrainEdit.regions.climate.has(grid.dual.cellId(index)))).map((chart) => chart.key));
assert.ok(coneCharts.size >= 2, `cone must cross chart seams (${coneCharts.size} charts)`);
// 4. outside-region hash unchanged for a repeated invalidation
const outsideHash = (regions) => {
  const outside = allIds.filter((id) => !regions.hydrology.has(id) && !regions.climate.has(id) && !regions.ecology.has(id));
  return dirtyRegionHashV10({ hydrology: outside, climate: new Set(), cloud: new Set(), ecology: new Set(), vegetation: new Set() });
};
const rerun = invalidateRegionsV10(grid, { touches: ["terrain"], cells: source }, { wind });
assert.equal(terrainEdit.hash, rerun.hash, "deterministic dirty hash");
assert.equal(outsideHash(terrainEdit.regions), outsideHash(rerun.regions), "outside-region hash unchanged");
// 5. undo/redo + rejected transaction restore the previous dirty state
//    (an undo reverts the edited source set; a rejected transaction keeps it)
const fullEdit = invalidateRegionsV10(grid, { touches: ["terrain", "water"], cells: source }, { wind });
const undoEdit = invalidateRegionsV10(grid, { touches: ["terrain", "water"], cells: [source[0]] }, { wind });
const rejected = invalidateRegionsV10(grid, { touches: ["terrain", "water"], cells: source, rejected: true }, { wind });
assert.equal(rejected.hash, fullEdit.hash, "rejected transaction must not change dirty regions");
assert.notEqual(undoEdit.hash, fullEdit.hash, "undo must narrow the dirty scope");
// 6. wind edit dirties global climate; vegetation edit only ecology halo
const windEdit = invalidateRegionsV10(grid, { touches: ["wind"], cells: source }, { wind });
assert.equal(windEdit.counts.climate, allIds.length, "wind edit must dirty global climate");
const vegEdit = invalidateRegionsV10(grid, { touches: ["vegetation"], cells: source }, { wind });
assert.equal(vegEdit.counts.climate, 0, "vegetation edit must not dirty climate");
assert.ok(vegEdit.counts.ecology > 0, "vegetation edit dirties local ecology halo");

// 7. field overlay: ten layers, probes read the same semantic cells
const fineGrid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 2, seed: 1, preserve: world.manifest.map((entry) => entry.direction) });
const hydrology = solveHydrologyV10({ grid: fineGrid, elevationAt: (dir) => world.field.heightAt(dir), seaLevel: 0 });
const climate = solveClimateV10({ grid: fineGrid, hydrology, elevationAt: (dir) => world.field.heightAt(dir), wind });
const ecology = solveEcologyV10({ grid: fineGrid, hydrology, climate, elevationAt: (dir) => world.field.heightAt(dir), baseForestnessAt: () => 0.3, snowlineElevation: 5.2, treeLineElevation: 4.2 });
const overlay = buildFieldOverlayV10({ cells: ecology.cells, byId: ecology.byId });
assert.deepEqual(overlay.legend.map((entry) => entry.layer), [...FIELD_OVERLAY_LAYERS_V10]);
assert.equal(overlay.order.length, ecology.cells.length);
const firstCell = ecology.cells[0];
for (const layer of FIELD_OVERLAY_LAYERS_V10) {
  const probe = overlay.probe(firstCell.id, layer);
  assert.ok(Number.isFinite(probe.raw), `overlay ${layer} finite`);
  assert.ok(probe.normalized >= 0 && probe.normalized <= 1, `overlay ${layer} normalized`);
  const direct = { terrain: firstCell.terrain, water: firstCell.water, climate: firstCell.climate, ecology: firstCell.ecology }[layer === "elevation" || layer === "slope" ? "terrain" : layer === "waterDepth" || layer === "coastDistance" ? "water" : layer === "forestness" ? "ecology" : "climate"][{ elevation: "elevation", slope: "slope", waterDepth: "waterDepth", coastDistance: "coastDistance", fetch: "upwindOceanFetch", vapor: "vapor", lift: "orographicLift", rainShadow: "rainShadow", precipitation: "precipitationClimatology", forestness: "forestness" }[layer]];
  assert.ok(Math.abs(probe.raw - direct) < 1e-5, `overlay ${layer} must read the same semantic cell (${probe.raw} vs ${direct})`);
}
// overlay hash stable
const overlay2 = buildFieldOverlayV10({ cells: ecology.cells, byId: ecology.byId });
assert.deepEqual([...overlay.layers.elevation], [...overlay2.layers.elevation], "overlay deterministic");
console.log(`✅ Planet V9 terrain editor V10 extension: dependency cone/halo scope, maxFetchDistance bound, cross-chart, undo/redo/reject hashes, 10-layer overlay probes`);
