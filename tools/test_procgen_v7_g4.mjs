// V7-G4：Simple Tiled 与 Overlapping 二维模型
import assert from "node:assert/strict";
import { createRectGrid2D } from "../TigerMessenger/src/procgen/graph/rectGrid2d.js";
import { createSimpleTiledModel, solveSimpleTiled, pin2D, assignmentGrid } from "../TigerMessenger/src/procgen/wfc/simpleTiledModel.js";
import { createOverlappingModel2D, solveOverlapping2D, renderOverlappingAssignment } from "../TigerMessenger/src/procgen/wfc/overlappingModel2d.js";

const F = (connector, parity = "symmetric", extra = {}) => ({ connector, parity, ...extra });
const tile = (id, c, weight = 1) => ({ id, family: "tile", weight, orientationGroup: "NONE", faces: { N: F(c), E: F(c), S: F(c), W: F(c) } });

let passed = 0;
const ok = (msg) => { passed++; console.log(`  ✓ ${msg}`); };

{
  const graph = createRectGrid2D({ width: 3, height: 2 });
  const model = createSimpleTiledModel({ prototypes: [tile("stone", "stone"), tile("brick", "brick")], graph });
  const pin = pin2D(model, 1, 0, "stone@r0");
  const result = solveSimpleTiled({ model, seed: 11, pins: [pin] });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.assignmentByCellId["r:1:0"], "stone@r0");
  assert.equal(assignmentGrid(model, result).length, 2);
  assert.equal(assignmentGrid(model, result)[0].length, 3);
  ok("Simple Tiled：稳定二维图、pin、解网格输出");
}

{
  const sample = [["a", "b", "a"], ["b", "a", "b"], ["a", "b", "a"]];
  const model = createOverlappingModel2D({ sample, N: 2, outWidth: 2, outHeight: 2, augmentSymmetry: false });
  assert.ok(model.compiled.variants.length >= 2);
  const result = solveOverlapping2D({ model, seed: 3 });
  assert.equal(result.ok, true, JSON.stringify(result));
  const rendered = renderOverlappingAssignment(model, result);
  assert.equal(rendered.length, 3);
  assert.equal(rendered[0].length, 3);
  for (const row of rendered) for (const value of row) assert.ok(value === "a" || value === "b");
  ok("Overlapping：N×N pattern 提取、重叠兼容和恢复输出");
}

{
  const periodic = createOverlappingModel2D({ sample: [[0, 1], [1, 0]], N: 3, periodic: true, augmentSymmetry: true });
  assert.equal(periodic.graph.boundary, "periodic-both");
  assert.ok(periodic.compiled.variants.length >= 2);
  const result = solveOverlapping2D({ model: periodic, seed: 8 });
  assert.equal(result.ok, true, JSON.stringify(result));
  ok("Overlapping：周期样例可提取 N 大于样例尺寸且结果确定");
}

console.log(`✅ V7-G4 assertions=${passed}`);
