// =====================================================================
// 地势剖面验收（飞艇鸟瞰）：台地平坦、台地崖壁、山体台阶、湖面关系。
// =====================================================================
import assert from "node:assert/strict";
import { highlandTerrainSurfaceHeight, HIGHLAND_TOWNSCAPER_BASE_Y } from "../TigerMessenger/src/world/highlandCitadelDesign.js";
import { lakeHeightAt } from "../TigerMessenger/src/world/highlandShoreWaves.js";

// --- 1. 台地平坦(城址 ±20 内 ≈ BASE_Y) --------------------------------
const BASE = HIGHLAND_TOWNSCAPER_BASE_Y;
for (const [x, z] of [[0, 0], [15, 0], [-15, 0], [0, 10], [0, -15], [10, 15], [-10, -10]]) {
  const h = highlandTerrainSurfaceHeight(x, z);
  assert.ok(Math.abs(h - BASE) < 0.35, `台地平坦 (${x},${z}) h=${h.toFixed(2)} vs ${BASE}`);
}

// --- 2. 台地崖壁: ±24 处高于台地(崖), ±20 处仍台地 ---------------------
for (const x of [-24, 24]) {
  const cliff = highlandTerrainSurfaceHeight(x, 0);
  assert.ok(cliff > BASE + 2.5, `台地崖壁 x=${x} h=${cliff.toFixed(2)} > 台地+2.5`);
}
for (const x of [-20, 20]) {
  const edge = highlandTerrainSurfaceHeight(x, 0);
  assert.ok(Math.abs(edge - BASE) < 0.5, `台地边缘 x=${x} h=${edge.toFixed(2)} 仍台地`);
}
// 崖壁陡度: ±24 与 ±22 落差 ≥ 2.5(鸟瞰可见的崖线)
for (const x of [24, -24]) {
  const a = highlandTerrainSurfaceHeight(x, 0);
  const b = highlandTerrainSurfaceHeight(x - Math.sign(x) * 2, 0);
  assert.ok(Math.abs(a - b) >= 2.5, `崖壁陡度 x=${x}: |${a.toFixed(2)}-${b.toFixed(2)}| ≥ 2.5`);
}

// --- 3. 山体台阶(出城 z<-32 区域, 相邻 2u 采样呈台阶) -------------------
// 台阶化后: 高度接近 k*1.6+1.15 的台阶级
let stepped = 0;
let sampled = 0;
for (let z = -42; z >= -48; z -= 2) {
  const h = highlandTerrainSurfaceHeight(0, z);
  // 球面偏移会把台阶平移破坏余数检测：先还原本地高度再验台阶级
  const offset = -(160 - Math.sqrt(160 * 160 - z * z));
  const local = h - offset;
  const rem = ((local - 1.3) % 2.6 + 2.6) % 2.6;
  sampled++;
  if (rem < 0.5 || rem > 2.1) stepped++;
}
assert.ok(stepped >= Math.ceil(sampled * 0.5), `出城山体台阶化 ${stepped}/${sampled} 采样点落在台阶级（2.6u，本地高度）`);

// --- 4. 湖面低于台地(湖岸 z=24 起) -------------------------------------
assert.ok(lakeHeightAt(0, 24) < BASE - 1.5, `湖面 z=24 ${lakeHeightAt(0,24).toFixed(2)} < 台地-1.5`);
assert.ok(lakeHeightAt(0, 31) < BASE - 2.5, `湖面 z=31 ${lakeHeightAt(0,31).toFixed(2)} < 台地-2.5`);
// 湖岸地面(承重带 z=22-23)高于湖面
const shore = highlandTerrainSurfaceHeight(0, 22);
assert.ok(shore > lakeHeightAt(0, 24), `湖岸承重带 ${shore.toFixed(2)} > 湖面 ${lakeHeightAt(0,24).toFixed(2)}`);

// --- 5. 山体-台地非断层(主峰到台地有层级过渡, 非直接 50→5 单步) --------
// z=-30 与 z=-22 之间至少 1 个采样点处于中间高度(8~30)
const midH = highlandTerrainSurfaceHeight(0, -28);
assert.ok(midH > 8 && midH < 30, `主峰-台地中间层级 z=-28 h=${midH.toFixed(2)}（需 8~30）`);
const midH2 = highlandTerrainSurfaceHeight(0, -26);
assert.ok(midH2 > 8 && midH2 < 30, `主峰-台地中间层级 z=-26 h=${midH2.toFixed(2)}（需 8~30）`);

console.log(`✅ 地势剖面: 台地 ${BASE} 平坦 · 崖壁 ±24 落差≥2.5 · 出城台阶 ${stepped}/12 · 湖面低于台地 · 过渡有层级`);
