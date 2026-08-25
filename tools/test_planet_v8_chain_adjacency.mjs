// =====================================================================
// Planet V8 chain adjacency gate (2026-08-24, P0-2).
//
// The elevation narrative must hold on the FINAL field, not on authored
// metadata: every inter-landmark great arc is sampled and must show
//   1) saddle midpoint strictly between the two section cores (monotonic
//      geological profile, no "six bumps in shallow water"),
//   2) no open ocean notch (semantic water below the shelf floor),
//   3) triple-gate saddle strictly between highland terrace and canyon
//      floor,
//   4) adjacent section caps touching/overlapping (no un-interpreted gap).
// This test mirrors the exact gate now wired into compilePlanetV8
// (stage "chain-adjacency") plus the cap-contact manifest check.
// =====================================================================

import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { createContinuousLandformManifest, DEFAULT_LANDMARK_MANIFEST } from "../TigerMessenger/src/world/planetV8/landmarkManifest.js";
import { buildGeodesicMainAndDualGrid } from "../TigerMessenger/src/procgen/planet/geodesicGrid.js";
import { createTerrainTiles } from "../TigerMessenger/src/procgen/planet/terrainTiles.js";
import { solveSphericalTerrain, terrainAssignmentMap } from "../TigerMessenger/src/procgen/planet/sphericalWfc.js";
import { createPlanetFieldRecipe } from "../TigerMessenger/src/procgen/planet/planetFieldComposer.js";
import { buildTransitionCollars, validateChainAdjacency, angularDistance } from "../TigerMessenger/src/procgen/planet/landformChainV8.js";

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

const golden = [1, 7, 42, 884];
let goldenPairs = 0;
for (const seed of golden) {
  const world = compilePlanetV8({ seed, landformChain: true, subdivision: 1, chartLimit: 6, resolution: 4 });
  assert.equal(world.ok, true, `seed=${seed} stage=${world.stage}`);
  assert.equal(world.chainAdjacencyReport.ok, true, `seed=${seed} chain-adjacency gate`);
  assert.equal(world.chainAdjacencyReport.errors.length, 0, `seed=${seed} adjacency errors`);
  for (const pair of world.chainAdjacencyReport.pairs) {
    // 弧线中点严格介于两端真实高度之间（剖面单调）
    assert.ok(
      pair.hMid > Math.min(pair.hFrom, pair.hTo) && pair.hMid < Math.max(pair.hFrom, pair.hTo),
      `seed=${seed} ${pair.from}->${pair.to} mid=${pair.hMid.toFixed(3)} not between [${Math.min(pair.hFrom, pair.hTo).toFixed(3)}, ${Math.max(pair.hFrom, pair.hTo).toFixed(3)}]`,
    );
    // 无海洋缝隙：最深点不低于 shelfFloor（-1.2，seaLevel=0）
    assert.ok(pair.deepest > -1.2, `seed=${seed} ${pair.from}->${pair.to} ocean gap deepest=${pair.deepest.toFixed(3)}`);
    goldenPairs++;
  }
  // 三重门鞍部严格介于高山台地与裂谷谷底
  assert.ok(world.chainAdjacencyReport.saddle.highland > world.chainAdjacencyReport.saddle.gate, `seed=${seed} highland>gate`);
  assert.ok(world.chainAdjacencyReport.saddle.gate > world.chainAdjacencyReport.saddle.canyonFloor, `seed=${seed} gate>canyonFloor`);
  // 相邻 cap 边缘必须衔接（P0-3 半径保证 overlap ≥ gap）
  const chain = world.manifest.filter((entry) => entry.chainOrder != null).sort((a, b) => a.chainOrder - b.chainOrder);
  for (let i = 1; i < chain.length; i++) {
    const gap = angularDistance(chain[i - 1].direction, chain[i].direction);
    const overlap = chain[i - 1].angularRadius + chain[i].angularRadius;
    assert.ok(gap <= overlap, `seed=${seed} cap gap ${chain[i - 1].id}->${chain[i].id}: ${gap.toFixed(4)} > ${overlap.toFixed(4)}`);
  }
}

// 1000 seed 纯 field 门（与 final-elevation 同构，不重建 chart/MC）
let minMidMargin = Infinity;
for (let seed = 1; seed <= 1000; seed++) {
  const manifest = createContinuousLandformManifest({ entries: DEFAULT_LANDMARK_MANIFEST, seed });
  const chain = manifest.filter((entry) => entry.chainOrder != null).sort((a, b) => a.chainOrder - b.chainOrder);
  const grid = buildGeodesicMainAndDualGrid({ radius: 160, subdivision: 1, seed, preserve: manifest.map((entry) => entry.direction) });
  const wfc = solveSphericalTerrain({ graph: grid.dual, landmarks: chain, tiles: createTerrainTiles(), seed, maxBacktrack: 64 });
  assert.equal(wfc.ok, true, `seed=${seed} wfc`);
  const assignment = new Map(Object.entries(terrainAssignmentMap(wfc)));
  const field = createPlanetFieldRecipe({
    radius: 160,
    grid,
    landmarks: manifest,
    assignment,
    transitionCollars: buildTransitionCollars(chain, { radius: 160 }),
  });
  const report = validateChainAdjacency({ field, chain });
  assert.equal(report.ok, true, `seed=${seed}: ${report.errors.join(";")}`);
  for (const pair of report.pairs) {
    minMidMargin = Math.min(minMidMargin, Math.min(pair.hMid - Math.min(pair.hFrom, pair.hTo), Math.max(pair.hFrom, pair.hTo) - pair.hMid));
    assert.ok(pair.deepest > -1.2, `seed=${seed} ${pair.from}->${pair.to} ocean gap`);
  }
  // cap 接触
  for (let i = 1; i < chain.length; i++) {
    const gap = angularDistance(chain[i - 1].direction, chain[i].direction);
    const overlap = chain[i - 1].angularRadius + chain[i].angularRadius;
    assert.ok(gap <= overlap, `seed=${seed} cap gap ${chain[i - 1].id}->${chain[i].id}`);
  }
}
console.log(`✅ Planet V8 chain adjacency: ${golden.length} golden seeds (${goldenPairs} arcs) + 1000-seed field gate; minMidMargin=${minMidMargin.toFixed(3)}`);
