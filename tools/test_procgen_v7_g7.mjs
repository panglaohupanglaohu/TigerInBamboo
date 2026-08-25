// V7-G7：ScalarField / SDF / chunk halo
import assert from "node:assert/strict";
import { createScalarField } from "../TigerMessenger/src/procgen/field/scalarField.js";
import { sdSphere, sdBox, sdCapsule, sdfSubtract, smoothUnion } from "../TigerMessenger/src/procgen/field/sdf.js";
import { createChunkField, chunkKey, chunkBounds } from "../TigerMessenger/src/procgen/field/chunkField.js";

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

{
  const field = createScalarField({ min: [0, 0, 0], max: [2, 2, 2], resolution: { x: 3, y: 3, z: 3 }, sample: (p) => p[0] + p[1] * 10 + p[2] * 100 });
  assert.equal(field.valueAt(2, 1, 0), 12);
  assert.deepEqual(field.coords(field.index(2, 1, 0)), [2, 1, 0]);
  assert.equal(field.sampleWorld([1, 1, 1]), 111);
  assert.deepEqual(field.minMax(), { min: 0, max: 222 });
  const mapped = field.map((v) => v * 2);
  assert.equal(mapped.valueAt(1, 1, 1), 222);
  ok("ScalarField：世界坐标/索引、三线性采样、map 和 minMax");
}

{
  assert.ok(sdSphere([0, 0, 0], [0, 0, 0], 1) < 0);
  assert.ok(sdBox([2, 0, 0], [0, 0, 0], [1, 1, 1]) > 0);
  assert.ok(sdCapsule([0, 0, 0], [0, -1, 0], [0, 1, 0], 0.5) < 0);
  assert.equal(sdfSubtract(-1, 1), -1);
  assert.ok(smoothUnion(-1, -0.5, 0.2) <= -0.5);
  ok("SDF：sphere/box/capsule、布尔运算、smooth union 符号约定");
}

{
  const sample = (p) => p[0] + p[1] * 10 + p[2] * 100;
  const chunk = createChunkField({ origin: [10, 20, 30], size: [2, 2, 2], resolution: 3, halo: 1, sample });
  assert.equal(chunk.field.resolution.x, 5);
  assert.equal(chunk.field.min[0], 9);
  assert.equal(chunk.field.min[1], 19);
  assert.equal(chunk.field.min[2], 29);
  assert.equal(chunk.field.valueAt(1, 1, 1), 10 + 20 * 10 + 30 * 100);
  assert.equal(chunkKey(-1, 2, 3), "-1:2:3");
  assert.deepEqual(chunkBounds({ chunk: [1, 0, -1], origin: [0, 0, 0], size: [2, 3, 4] }), { min: [2, 0, -4], max: [4, 3, 0] });
  ok("ChunkField：halo 采样、共享世界坐标与 chunk bounds");
}

console.log(`✅ V7-G7 assertions=${passed}`);
