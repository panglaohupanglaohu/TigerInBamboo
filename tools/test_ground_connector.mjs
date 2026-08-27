// =====================================================================
// S14/S15 地面连接带（relax pass）：平面版 + 球面版。
// relax 收敛性（迭代后稳定）、剖面平滑（无突变）、防膨胀（高度不超
// 期望上限）、确定性 hash、预算；球面版大圆弧采样与球面高度收敛。
// =====================================================================
import assert from "node:assert/strict";
import { bakeGroundConnector, GROUND_CONNECTOR_SCHEMA_VERSION } from "../TigerMessenger/src/world/groundConnector.js";

// --- 1. 确定性（平面版） ----------------------------------------------
const a = bakeGroundConnector({ seed: 7 });
const b = bakeGroundConnector({ seed: 7 });
assert.equal(a.hash, b.hash, "same seed same hash");
assert.ok(a.hash.startsWith("ground-connector:"), a.hash);
assert.notEqual(bakeGroundConnector({ seed: 8 }).hash, a.hash, "different seed differs");
assert.equal(a.version, GROUND_CONNECTOR_SCHEMA_VERSION);

// --- 2. relax 收敛性：多次烘焙的最终变化 < 1e-3（迭代后稳定） ----------
assert.ok(a.relaxFinalMaxChange < 1e-3, `relax final change ${a.relaxFinalMaxChange}`);
// 增加迭代次数后结果接近（收敛）
const more = bakeGroundConnector({ seed: 7, relaxPasses: 48 });
const maxDiff = Math.max(...a.heights.map((h, i) => Math.abs(h - more.heights[i])));
assert.ok(maxDiff < 1e-3, `更多迭代应收敛到同一剖面 maxDiff=${maxDiff}`);

// --- 3. 剖面平滑（相邻点高度差有界，无突变） ---------------------------
const cols = a.crossSegments + 1;
const maxStep = Math.max(...a.heights.map((h, i) => {
  const r = Math.floor(i / cols);
  const c = i % cols;
  let m = 0;
  if (r > 0) m = Math.max(m, Math.abs(h - a.heights[(r - 1) * cols + c]));
  if (c > 0) m = Math.max(m, Math.abs(h - a.heights[r * cols + c - 1]));
  return m;
}));
assert.ok(maxStep < 2.0, `相邻高度差有界 maxStep=${maxStep.toFixed(2)}（无突变）`);

// --- 4. 防膨胀：高度不超期望剖面 + maxDeviation ------------------------
for (let i = 0; i < a.heights.length; i++) {
  assert.ok(
    a.heights[i] <= a.desired[i] + a.maxDeviation + 1e-6 &&
    a.heights[i] >= a.desired[i] - a.maxDeviation - 1e-6,
    `高度不超期望上限 i=${i} h=${a.heights[i].toFixed(2)} desired=${a.desired[i].toFixed(2)}`
  );
}
// 端点保持期望高度（from/to）
assert.ok(Math.abs(a.heights[0] - a.fromHeight) < a.maxDeviation + 0.5, "起点接近期望");
assert.ok(Math.abs(a.heights[a.vertexCount - cols] - a.toHeight) < a.maxDeviation + 0.5, "终点接近期望");

// --- 5. 拓扑与预算 -----------------------------------------------------
assert.ok(a.indices.every((i) => i >= 0 && i < a.vertexCount), "索引合法");
assert.equal(a.triangleCount * 3, a.indices.length);
assert.ok(a.vertexCount <= 500, `预算 vertexCount=${a.vertexCount}`);
assert.ok(a.triangleCount <= 1000, `预算 triangles=${a.triangleCount}`);

// --- 6. 球面版：大圆弧采样 + 球面高度收敛 ------------------------------
const sa = bakeGroundConnector({ fromDir: [1, 0, 0], toDir: [0, 1, 0], radius: 160, seed: 7 });
const sb = bakeGroundConnector({ fromDir: [1, 0, 0], toDir: [0, 1, 0], radius: 160, seed: 7 });
assert.equal(sa.hash, sb.hash, "球面版确定性");
assert.equal(sa.spherical, true);
// 所有顶点在球面附近（半径 + 抬升）
for (let i = 0; i < sa.vertexCount; i++) {
  const x = sa.positions[i * 3], y = sa.positions[i * 3 + 1], z = sa.positions[i * 3 + 2];
  const len = Math.hypot(x, y, z);
  const lift = sa.heights[i];
  assert.ok(Math.abs(len - (160 + lift)) < 1.5, `顶点在球面上 v${i} len=${len.toFixed(2)} lift=${lift.toFixed(2)}`);
}
// 起点/终点方向与大圆弧一致
const startDir = [
  sa.positions[0] / Math.hypot(sa.positions[0], sa.positions[1], sa.positions[2]),
  sa.positions[1] / Math.hypot(sa.positions[0], sa.positions[1], sa.positions[2]),
  sa.positions[2] / Math.hypot(sa.positions[0], sa.positions[1], sa.positions[2]),
];
assert.ok(Math.abs(startDir[0] - 1) < 0.1, `起点方向 ≈ fromDir ${startDir[0].toFixed(3)}`);
// 球面版 relax 同样收敛
assert.ok(sa.relaxFinalMaxChange < 1e-3, `球面 relax 收敛 ${sa.relaxFinalMaxChange}`);
// 球面版防膨胀
for (let i = 0; i < sa.heights.length; i++) {
  assert.ok(
    sa.heights[i] <= sa.desired[i] + sa.maxDeviation + 1e-6 &&
    sa.heights[i] >= sa.desired[i] - sa.maxDeviation - 1e-6,
    `球面高度防膨胀 i=${i}`
  );
}

console.log(`✅ S14/S15 ground connector: flat ${a.vertexCount}v/${a.triangleCount}t + spherical ${sa.vertexCount}v/${sa.triangleCount}t, relax 收敛 ${a.relaxFinalMaxChange.toFixed(5)}, 防膨胀+平滑+确定性全过`);
