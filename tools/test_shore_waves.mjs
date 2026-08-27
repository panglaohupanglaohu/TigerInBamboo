// =====================================================================
// S13 岸浪（台地-海衔接）：烘焙数据确定性、每顶点 in/out 方向与 time
// offset（沿岸推进错相）、振幅随离岸距离衰减、三角带拓扑、预算；
// legacy 水面不受影响。
// =====================================================================
import assert from "node:assert/strict";
import { bakeHighlandShoreWaves, lakeHeightAt, SHORE_WAVES_SCHEMA_VERSION } from "../TigerMessenger/src/world/highlandShoreWaves.js";
import { bakeHighlandShoreWaves as bakeReal } from "../TigerMessenger/src/world/highlandShoreWaves.js";
import { highlandWaterCenterX, highlandWaterHalfWidth, HIGHLAND_LAKE_CHART } from "../TigerMessenger/src/world/highlandCitadelDesign.js";

// --- 1. 确定性（同参数同 hash，与真实湖岸线一致） ----------------------
const a = bakeHighlandShoreWaves({ seed: 7 });
const b = bakeHighlandShoreWaves({ seed: 7 });
assert.equal(a.hash, b.hash, "same seed must produce identical band");
assert.ok(a.hash.startsWith("shore-waves:"), a.hash);
assert.notEqual(
  bakeHighlandShoreWaves({ seed: 8 }).hash,
  a.hash,
  "different seed must differ"
);
assert.equal(a.version, SHORE_WAVES_SCHEMA_VERSION);

// 用真实湖岸线函数烘焙（生产路径一致）
const real = bakeReal({ seed: 20260826 });
assert.equal(real.hash, bakeReal({ seed: 20260826 }).hash);
assert.ok(real.vertexCount >= 200, `vertexCount ${real.vertexCount}`);
assert.ok(real.rowCount >= 25, `rowCount ${real.rowCount}`);
assert.ok(real.triangleCount > 200, `triangles ${real.triangleCount}`);

// --- 2. 每顶点都有 in/out/time/amplitude ------------------------------
const n = real.vertexCount;
assert.equal(real.inDirs.length, n * 3);
assert.equal(real.outDirs.length, n * 3);
assert.equal(real.timeOffsets.length, n);
assert.equal(real.amplitudes.length, n);
assert.equal(real.dists.length, n);
// in 与 out 方向相反（in 指向岸、out 指向湖）
for (let v = 0; v < n; v++) {
  const ix = real.inDirs[v * 3], iz = real.inDirs[v * 3 + 2];
  const ox = real.outDirs[v * 3], oz = real.outDirs[v * 3 + 2];
  assert.ok(Math.abs(ix + ox) < 1e-6 && Math.abs(iz + oz) < 1e-6, `in/out must be opposite v${v}`);
  assert.ok(Math.abs(ix) > 0.9, `in-dir must be shore-normal v${v} (x=${ix})`);
}
// time offset 全部在 [0,1)
assert.ok(real.timeOffsets.every((t) => t >= 0 && t < 1));

// --- 3. 沿岸推进错相：相邻 z 排的 time offset 错开 ----------------------
const offsetsByRow = [];
for (let r = 0; r < real.rowCount; r++) offsetsByRow.push(real.timeOffsets[r * 8]);
for (let r = 1; r < offsetsByRow.length; r++) {
  const delta = (offsetsByRow[r] - offsetsByRow[r - 1] + 1) % 1;
  assert.ok(delta > 0.005 && delta < 0.2, `row ${r} phase advance ${delta.toFixed(3)} (推进波)`);
}

// --- 4. 振幅随离岸距离衰减（近岸 > 远岸） ------------------------------
const nearAmps = real.amplitudes.filter((_, i) => real.dists[i] < 0.2);
const farAmps = real.amplitudes.filter((_, i) => real.dists[i] > 0.8);
assert.ok(nearAmps.length > 0 && farAmps.length > 0);
const nearAvg = nearAmps.reduce((s, v) => s + v, 0) / nearAmps.length;
const farAvg = farAmps.reduce((s, v) => s + v, 0) / farAmps.length;
assert.ok(nearAvg > farAvg * 2, `near ${nearAvg.toFixed(3)} must exceed far ${farAvg.toFixed(3)}`);

// --- 5. 浪带贴合真实湖岸线（在湖面开口内、岸线外侧） -------------------
// 每个近岸顶点应在湖面半宽外 shoreGap~2u 处，仍在湖 chart 内
for (let v = 0; v < n; v += 4) {
  const x = real.positions[v * 3];
  const z = real.positions[v * 3 + 2];
  if (z < HIGHLAND_LAKE_CHART.zStart || z > HIGHLAND_LAKE_CHART.zStart + HIGHLAND_LAKE_CHART.depth) continue;
  const half = highlandWaterHalfWidth(z);
  const center = highlandWaterCenterX(z);
  const distFromCenter = Math.abs(x - center);
  assert.ok(distFromCenter > half && distFromCenter < half + 5.5, `shore vert z=${z.toFixed(1)} dist=${distFromCenter.toFixed(2)} half=${half.toFixed(1)}`);
}

// --- 6. 索引合法 + 预算 -------------------------------------------------
assert.ok(real.indices.every((i) => i >= 0 && i < n));
assert.ok(real.vertexCount < 1200, `vertex budget ${real.vertexCount}`);
assert.ok(real.triangleCount < 2400, `triangle budget ${real.triangleCount}`);

// --- 7. 湖面高度基准 ---------------------------------------------------
const y = lakeHeightAt(0, 40);
assert.ok(Number.isFinite(y) && y > -1.5 && y < 7, `lakeHeightAt ${y}`);

console.log(`✅ S13 shore waves: ${real.vertexCount} verts / ${real.triangleCount} tris, near-amp ${nearAvg.toFixed(2)} > far ${farAvg.toFixed(2)}, row phase advance ~${((offsetsByRow[1] - offsetsByRow[0] + 1) % 1).toFixed(3)}, hash=${real.hash}`);
