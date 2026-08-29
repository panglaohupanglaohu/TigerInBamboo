import assert from "node:assert/strict";
import { compilePlanetV8 } from "../TigerMessenger/src/procgen/planet/planetCompilerV8.js";
import { sphericalProjectedUv, shorelineManualUv, terrainPatchBlendAt } from "../TigerMessenger/src/procgen/planet/terrainPatchBlendingV10.js";

const radius = 160;
const world = compilePlanetV8({
  seed: 42,
  radius,
  subdivision: 1,
  chartLimit: 1,
  resolution: 4,
  landformChain: true,
});

assert.equal(world.ok, true, `V9 compile failed at ${world.stage}: ${JSON.stringify(world.report || {})}`);
assert.ok(world.globalTerrain, "V9 must expose one global terrain surface");
const { mesh, semantic } = world.globalTerrain;
assert.equal(mesh.stats.topology, "spherical-closed");
assert.equal(mesh.stats.sourceSubdivision, 3);
assert.equal(mesh.stats.triangleCount, 180);
assert.equal(mesh.indices.length, 540);
assert.equal(mesh.positions.length, 92 * 3);
assert.equal(mesh.normals.length, mesh.positions.length);
assert.ok(mesh.positions.every(Number.isFinite), "global positions must be finite");
assert.ok(mesh.normals.every(Number.isFinite), "global normals must be finite");
assert.equal(semantic.patchData0.length, (mesh.positions.length / 3) * 4);
assert.equal(semantic.patchData1.length, (mesh.positions.length / 3) * 4);

const radii = [];
for (let i = 0; i < mesh.positions.length; i += 3) {
  radii.push(Math.hypot(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]));
  const normalLength = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
  assert.ok(Math.abs(normalLength - 1) < 1e-4, `normal ${i / 3} is not normalized`);
}
assert.ok(Math.min(...radii) < radius, "ocean/depression vertices must be below sea shell");
assert.ok(Math.max(...radii) > radius + 2, "landform vertices must rise above sea shell");

const edgeUse = new Map();
for (let i = 0; i < mesh.indices.length; i += 3) {
  const face = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
  for (let j = 0; j < 3; j++) {
    const a = face[j]; const b = face[(j + 1) % 3];
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
  }
}
assert.ok([...edgeUse.values()].every((count) => count === 2), "global terrain must have no open edge");

const projected = sphericalProjectedUv([0.31, 0.72, -0.61]);
const shoreline = shorelineManualUv([0.31, 0.72, -0.61], 0.2);
assert.ok(projected.every(Number.isFinite) && shoreline.every(Number.isFinite));
const patch = terrainPatchBlendAt({ direction: [0.31, 0.72, -0.61], semantic: { land: 1, wetness: 0.7, height: 0.2 } });
assert.equal(patch.version, "terrain-patch-blend-v10");
assert.ok([patch.shorelineWeight, patch.heightBlend, patch.tileVariation, patch.waterWeight].every(Number.isFinite));
assert.equal(world.snapshot.land.globalMeshHash, `${mesh.stats.vertexCount}:${mesh.stats.triangleCount}:spherical-closed`);
assert.equal(world.water.ocean.positions.length / 3, mesh.stats.vertexCount, "V9 water must share the dense spherical surface");
assert.equal(world.water.ocean.indices.length / 3, mesh.stats.triangleCount, "V9 water must use the same closed patch topology");

console.log(`✅ Planet V10 spherical terrain: ${mesh.stats.vertexCount} vertices, ${mesh.stats.triangleCount} closed triangles, projected grass/water + manual shoreline UV`);
