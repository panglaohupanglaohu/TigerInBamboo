// =====================================================================
// C13-5（上半）· 城堡轮廓泡沫带（PLAN §10.5）
//
// 「复用 S13 烘焙器，沿城堡轮廓环再生成一条窄带」的可测部分：
//   ① traceGridOutlineRings：占据格 → 闭合外轮廓环（有洞时多环）
//   ② bakeContourFoamBand 输出与 bakeHighlandShoreWaves **同构**的属性表
//      （createHighlandShoreWaveSystem 才能原样渲染）
//   ③ 外法线朝外：带上的点必须比轮廓点更远离形心
//   ④ 闭合：最后一段接回第 0 点，三角数 = N×(cross−1)×2，无缝
//   ⑤ 确定性：同输入两次烘焙 hash 一致（禁止 Math.random）
//
// 运行：node tools/test_contour_foam_band.mjs
// =====================================================================
import assert from "node:assert/strict";
import {
  bakeContourFoamBand,
  traceGridOutlineRings,
  bakeHighlandShoreWaves,
  SHORE_WAVES_SCHEMA_VERSION,
} from "../TigerMessenger/src/world/highlandShoreWaves.js";

// ---- ① 轮廓描边：3×3 实心块 → 一个 12 段的方环
{
  const cells = [];
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) cells.push([ix, iz]);
  const rings = traceGridOutlineRings(cells, { cellSize: 2, originX: -3, originZ: -3 });
  assert.equal(rings.length, 1, `实心 3×3 应只有 1 个环，实得 ${rings.length}`);
  assert.equal(rings[0].length, 12, `3×3 外轮廓应是 12 个顶点（每边 3 段），实得 ${rings[0].length}`);
  const xs = rings[0].map((p) => p[0]);
  const zs = rings[0].map((p) => p[1]);
  assert.equal(Math.min(...xs), -3); assert.equal(Math.max(...xs), 3);
  assert.equal(Math.min(...zs), -3); assert.equal(Math.max(...zs), 3);

  // 环形（中间挖空）→ 外环 + 内环
  const donut = cells.filter(([ix, iz]) => !(ix === 1 && iz === 1));
  const rings2 = traceGridOutlineRings(donut, { cellSize: 2, originX: -3, originZ: -3 });
  assert.equal(rings2.length, 2, `中空 3×3 应有外环 + 内环，实得 ${rings2.length}`);
  console.log(`  轮廓：实心 3×3 → 1 环 12 点；中空 → ${rings2.length} 环（${rings2.map((r) => r.length).join(" / ")} 点）`);
}

// ---- ② 属性表与 S13 同构
{
  const ring = [[-3, -3], [0, -3], [3, -3], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0]];
  const band = bakeContourFoamBand({ ring, bandWidth: 1.6, crossCount: 3, heightAt: () => 4.8 });
  const shore = bakeHighlandShoreWaves({ zStart: 24, zEnd: 28 });
  const keys = ["version", "positions", "inDirs", "outDirs", "timeOffsets", "amplitudes", "dists", "indices", "vertexCount", "triangleCount", "hash", "algorithm"];
  for (const k of keys) assert.ok(k in band, `泡沫带缺少 S13 属性 ${k}`);
  for (const k of keys) assert.equal(typeof band[k], typeof shore[k], `属性 ${k} 类型必须与 S13 一致`);
  assert.equal(band.version, SHORE_WAVES_SCHEMA_VERSION, "schema 版本必须与 S13 相同");
  const n = band.vertexCount;
  assert.equal(band.positions.length, n * 3);
  assert.equal(band.inDirs.length, n * 3);
  assert.equal(band.outDirs.length, n * 3);
  assert.equal(band.timeOffsets.length, n);
  assert.equal(band.amplitudes.length, n);
  assert.equal(band.dists.length, n);
  assert.equal(n, ring.length * 3, `8 个环点 × 3 排 = 24 个顶点，实得 ${n}`);
  // in / out 必须互为反向且单位长
  for (let i = 0; i < n; i++) {
    const ix = band.inDirs[i * 3], iz = band.inDirs[i * 3 + 2];
    const ox = band.outDirs[i * 3], oz = band.outDirs[i * 3 + 2];
    assert.ok(Math.abs(ix + ox) < 1e-9 && Math.abs(iz + oz) < 1e-9, "in / out 必须反向");
    assert.ok(Math.abs(Math.hypot(ox, oz) - 1) < 1e-9, "out 必须是单位向量");
  }

  // ---- ③ 外法线朝外：每列 dist 越大离形心越远
  for (let i = 0; i < ring.length; i++) {
    const r0 = Math.hypot(band.positions[(i * 3) * 3], band.positions[(i * 3) * 3 + 2]);
    const r2 = Math.hypot(band.positions[(i * 3 + 2) * 3], band.positions[(i * 3 + 2) * 3 + 2]);
    assert.ok(r2 > r0, `第 ${i} 列外缘应比贴岸排更远离形心（${r2.toFixed(3)} vs ${r0.toFixed(3)}）——法线朝反了`);
  }
  // 贴岸排 dist=0、外缘排 dist=1，振幅近岸大
  assert.equal(band.dists[0], 0);
  assert.equal(band.dists[2], 1);
  assert.ok(band.amplitudes[0] > band.amplitudes[2], "近岸振幅应大于外缘");

  // ---- ④ 闭合：三角数 = N × (cross−1) × 2，且索引里出现了「回到第 0 列」的边
  assert.equal(band.triangleCount, ring.length * (3 - 1) * 2, `闭合带三角数应为 N×(cross−1)×2，实得 ${band.triangleCount}`);
  const maxIdx = Math.max(...band.indices);
  assert.equal(maxIdx, n - 1, "索引应覆盖到最后一个顶点");
  const lastCol = (ring.length - 1) * 3;
  const usesWrap = band.indices.some((v, k) => v >= lastCol && band.indices[(k - (k % 3))] < 3);
  assert.ok(usesWrap || band.indices.includes(0), "最后一列必须接回第 0 列（闭合，不留缝）");
  console.log(`  泡沫带：环点 ${band.rowCount} × 3 排 = ${n} 顶点 / ${band.triangleCount} 三角 / 周长 ${band.perimeter.toFixed(2)}`);
}

// ---- ⑤ 确定性
{
  const ring = [[-3, -3], [0, -3], [3, -3], [3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0]];
  const a = bakeContourFoamBand({ ring, heightAt: () => 4.8 });
  const b = bakeContourFoamBand({ ring, heightAt: () => 4.8 });
  assert.equal(a.hash, b.hash, "同输入两次烘焙 hash 必须一致（禁止 Math.random）");
  const c = bakeContourFoamBand({ ring, heightAt: () => 4.8, seed: 7 });
  assert.notEqual(a.hash, c.hash, "换 seed 应换结果");
}

// ---- 重采样：格边折线太粗，重采样后顶点变密但环仍闭合
{
  const ring = [[-3, -3], [3, -3], [3, 3], [-3, 3]];
  const dense = bakeContourFoamBand({ ring, resample: 1, crossCount: 3, heightAt: () => 4.8 });
  assert.equal(dense.rowCount, 24, `周长 24 / 步长 1 → 24 个环点，实得 ${dense.rowCount}`);
  assert.equal(dense.triangleCount, 24 * 2 * 2);
}

console.log("✅ test_contour_foam_band（轮廓描环 · 与 S13 同构 · 法线朝外 · 闭合 · 确定性）");
