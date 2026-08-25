// V7-G8 MC benchmark（TODO 1209）：24³ cells + 1 halo 基准 chunk，
// 每 chunk 分阶段耗时（sample/mesh/normal/group）与峰值内存，输出 JSON 统计。
// 用法：node tools/bench_procgen_v7_mc.mjs [--chunks 8]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createChunkField, MC_BASELINE_CELLS, MC_BASELINE_HALO } from "../TigerMessenger/src/procgen/field/chunkField.js";
import { marchingCubes } from "../TigerMessenger/src/procgen/field/marchingCubes.js";
import { sdMountain, sdCanalVolume, sdFoundationCollar, sampleWithProvenance } from "../TigerMessenger/src/procgen/field/composites.js";
import { smoothSubtract, smoothUnion } from "../TigerMessenger/src/procgen/field/sdf.js";
import { semanticId } from "../TigerMessenger/src/procgen/field/semantics.js";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const argChunks = Number(process.argv.find((a, i) => i > 1 && process.argv[i - 1] === "--chunks")) || 8;

// 世界采样器：山体 − 运河槽，平滑并地基裙边；与 profile 复合方式同形
const samplers = [
  { name: "mountain", fn: (p) => sdMountain(p, { center: [12, 0, 12], radius: 18, height: 14 }) },
  { name: "canal", fn: (p) => sdCanalVolume(p, { path: [[-4, 6], [28, 6], [28, 20]], width: 2.4, floorY: 2.5, depth: 6 }) },
  { name: "collar", fn: (p) => sdFoundationCollar(p, { center: [12, 6, 12], halfSize: [2, 3, 2], collar: 1.2, height: 1.5 }) },
];
const worldSample = (p) => smoothUnion(smoothSubtract(samplers[0].fn(p), samplers[1].fn(p), 1.5), samplers[2].fn(p), 1.0);

const mb = (bytes) => Math.round(bytes / 1048576 * 100) / 100;
const summarize = (xs) => ({ min: Math.min(...xs), max: Math.max(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length });

if (globalThis.gc) globalThis.gc();
const mem0 = process.memoryUsage();
let peakRss = mem0.rss; let peakHeap = mem0.heapUsed;
const trackPeak = () => {
  const m = process.memoryUsage();
  peakRss = Math.max(peakRss, m.rss); peakHeap = Math.max(peakHeap, m.heapUsed);
};

const cells = MC_BASELINE_CELLS; const halo = MC_BASELINE_HALO;
const coords = [];
for (let i = 0; i < argChunks; i++) coords.push([i % 4, Math.floor(i / 4) % 2, Math.floor(i / 8)]);

const perChunk = [];
for (const [cx, cy, cz] of coords) {
  // sample 阶段：chunk 场采样 + 语义/flow 通道写入
  const t0 = performance.now();
  const chunk = createChunkField({ origin: [cx * cells, cy * cells, cz * cells], size: [cells, cells, cells], resolution: cells, halo, sample: worldSample });
  const count = chunk.field.count;
  const semantics = new Uint8Array(count);
  const flow = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = chunk.field.worldPosition(...chunk.field.coords(i));
    semantics[i] = chunk.field.data[i] < 0 ? (p[1] < 4 ? semanticId("canal-bed") : semanticId("grass")) : 0;
    flow[i * 3] = 0; flow[i * 3 + 1] = -1; flow[i * 3 + 2] = 0;
  }
  chunk.field.semantics = semantics;
  chunk.field.flow = flow;
  const t1 = performance.now();
  trackPeak();
  // mesh/normal/group 阶段：MC 内部 stats.timings
  const mesh = marchingCubes(chunk.field, {
    cellRange: { min: [halo, halo, halo], max: [halo + cells - 1, halo + cells - 1, halo + cells - 1] },
    normalMode: "gradient",
    materialGroups: true,
  });
  trackPeak();
  perChunk.push({
    chunk: `${cx}:${cy}:${cz}`,
    sampleMs: t1 - t0,
    meshMs: mesh.stats.timings.meshMs,
    normalMs: mesh.stats.timings.normalMs,
    groupMs: mesh.stats.timings.groupMs,
    vertices: mesh.stats.vertexCount,
    triangles: mesh.stats.triangleCount,
    groups: mesh.groups?.length ?? 0,
    degenerateTriangles: mesh.stats.degenerateTriangles,
  });
}

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
const report = {
  benchmark: "procgen-v7-g8-marching-cubes",
  date: new Date().toISOString(),
  config: { cells, halo, chunkCount: coords.length, resolutionWithHalo: cells + 2 * halo },
  stagesMs: {
    sample: round(summarize(perChunk.map((c) => c.sampleMs))),
    mesh: round(summarize(perChunk.map((c) => c.meshMs))),
    normal: round(summarize(perChunk.map((c) => c.normalMs))),
    group: round(summarize(perChunk.map((c) => c.groupMs))),
  },
  totals: {
    vertices: perChunk.reduce((s, c) => s + c.vertices, 0),
    triangles: perChunk.reduce((s, c) => s + c.triangles, 0),
    degenerateTriangles: perChunk.reduce((s, c) => s + c.degenerateTriangles, 0),
  },
  memoryMB: { baselineRss: mb(mem0.rss), peakRss: mb(peakRss), peakHeapUsed: mb(peakHeap) },
  perChunk: perChunk.map((c) => ({ ...c, sampleMs: Math.round(c.sampleMs * 1000) / 1000, meshMs: Math.round(c.meshMs * 1000) / 1000, normalMs: Math.round(c.normalMs * 1000) / 1000, groupMs: Math.round(c.groupMs * 1000) / 1000 })),
};

const outPath = path.join(TOOLS, "out", "mc-benchmark.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`=== V7-G8 MC benchmark（${coords.length} chunk，${cells}³ cells + ${halo} halo）===`);
for (const [stageName, s] of Object.entries(report.stagesMs)) console.log(`  ${stageName.padEnd(7)} min=${s.min}ms mean=${s.mean}ms max=${s.max}ms`);
console.log(`  顶点=${report.totals.vertices} 三角形=${report.totals.triangles} 退化=${report.totals.degenerateTriangles}`);
console.log(`  内存：baselineRss=${report.memoryMB.baselineRss}MB peakRss=${report.memoryMB.peakRss}MB peakHeap=${report.memoryMB.peakHeapUsed}MB`);
console.log(`  JSON → ${path.relative(process.cwd(), outPath)}`);

// 基本 sanity：分阶段耗时有限非负、无退化三角形
for (const c of perChunk) {
  for (const k of ["sampleMs", "meshMs", "normalMs", "groupMs"]) {
    if (!Number.isFinite(c[k]) || c[k] < 0) { console.error(`❌ ${c.chunk} ${k} 非法`); process.exit(1); }
  }
  if (c.degenerateTriangles !== 0) { console.error(`❌ ${c.chunk} 退化三角形 ${c.degenerateTriangles}`); process.exit(1); }
}
console.log("✅ MC benchmark 完成");
