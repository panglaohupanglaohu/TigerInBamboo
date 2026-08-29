// =====================================================================
// 贴地脊线雾毯（用户建议 ①②⑥）：
// ① 高坡+高程 cell 走 bakeRidgePath hugRidge（clearance 0.2–0.4 贴地）；
// ② ridge-mist-blanket 带 base 0.15–0.35、薄、lowLayer；
// ⑥ 雾毯 speed 调小（几乎不飘）。
// =====================================================================
import assert from "node:assert/strict";
import {
  compileCloudClusters,
  cloudBaseForBand,
  buildRidgeDirections,
  bakeRidgePath,
  OSKAR_CLOUD_CHAIN_BANDS,
} from "../TigerMessenger/src/render/clouds/cloudClusterCompiler.js";

// --- 1. 山脊 cell → 雾毯；平地 cell → 非雾毯 --------------------------
const cells = Array.from({ length: 60 }, (_, i) => ({
  id: `cell:${i}`,
  index: i,
  direction: [0.2, 0.9, 0.3 + i * 0.001],
}));
const semantics = new Map(cells.map((c, i) => [c.id, {
  landformClass: i % 2 ? "volcanic-snow-massif" : "japanese-alluvial-plain",
  height: i % 2 ? 8 : 1,
  slope: i % 2 ? 0.6 : 0.05,
  wetness: 0.5,
  flow: [0.8, 0.1, -0.2],
}]));
const c = compileCloudClusters({ cells, semantics, wind: [1, 0, 0], seed: 1, maxInstances: 80 });
const mist = c.instances.filter((i) => i.type === "ridge-mist-blanket");
const other = c.instances.filter((i) => i.type !== "ridge-mist-blanket");
assert.ok(mist.length >= 3, `雾毯实例 ≥3（实际 ${mist.length}）`);
assert.ok(other.length >= 1, `非雾毯实例 ≥1`);

// --- ② 雾毯参数：贴地（clearance ≤ 0.5）、低 base（≤ 0.35）、lowLayer --
for (const instance of mist) {
  assert.ok(instance.terrainClearance <= 0.5, `雾毯 clearance ${instance.terrainClearance} ≤ 0.5`);
  assert.ok(instance.cloudBase <= 0.35, `雾毯 base ${instance.cloudBase} ≤ 0.35`);
  assert.equal(instance.lowLayer, true, "雾毯 lowLayer");
  assert.ok(instance.pathPoints.every((p) => p.terrainClearance <= 0.5), "雾毯路径贴地");
  assert.ok(instance.pathPoints.length >= 2, "雾毯路径为折线");
}
// 非雾毯保持原 clearance（≥1.2）
for (const instance of other) {
  assert.ok(instance.terrainClearance >= 1.2, `非雾毯 clearance ${instance.terrainClearance} ≥ 1.2`);
}

// --- ⑥ 雾毯慢速 -------------------------------------------------------
for (const instance of mist) {
  assert.ok(instance.speed <= 0.07, `雾毯 speed ${instance.speed} ≤ 0.07（几乎不飘）`);
}

// --- 带配置 -----------------------------------------------------------
assert.ok(cloudBaseForBand("ridge-mist-blanket", 5, 0.5) <= 0.35, "雾毯带 base ≤ 0.35");
assert.ok(cloudBaseForBand("ridge-mist-blanket", 5, 0.5) >= 0.15, "雾毯带 base ≥ 0.15");
assert.ok(cloudBaseForBand("open-sky-edge") >= 0.8, "非雾毯带不受小 clamp 影响");

// --- ① 脊线折线 -------------------------------------------------------
const dirs = buildRidgeDirections({ anchor: [0.2, 0.95, 0.24] });
assert.equal(dirs.length, 3, "脊线折线 3 点");
for (const d of dirs) {
  const l = Math.hypot(...d);
  assert.ok(Math.abs(l - 1) < 1e-4, `脊线点单位向量 len=${l.toFixed(4)}`);
}
// hugRidge 路径贴地
const field = { heightAt: (dir) => 8 };
const ridgePath = bakeRidgePath({
  anchor: [0.2, 0.95, 0.24],
  semantic: { height: 8 },
  wind: [1, 0, 0],
  altitude: 9,
  lift: 0.4,
  field,
  clearance: 0.2,
  hugRidge: true,
  ridgeDirections: dirs,
});
assert.ok(ridgePath.points.every((p) => p.terrainClearance <= 0.4), "hugRidge 贴地 clearance ≤ 0.4");

// --- 确定性 -----------------------------------------------------------
const c2 = compileCloudClusters({ cells, semantics, wind: [1, 0, 0], seed: 1, maxInstances: 80 });
assert.equal(c.climateHash, c2.climateHash, "确定性 hash");

console.log(`✅ 贴地脊线雾毯: 雾毯 ${mist.length}（clearance ${mist[0]?.terrainClearance}，base ${mist[0]?.cloudBase}，speed ${mist[0]?.speed}） vs 非雾毯 ${other.length}（clearance ≥1.2），hugRidge 折线贴地，确定性 ✓`);
