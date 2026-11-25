// 1798310423554658732「地块耕纹」纯逻辑验收（r212）：world/field-plot-map.js
// 片内口径：同一块地里条带方向完全一致、走到地块边界才改向；条带是宽软带；
// 块内条带连续（不能像旧实现那样逐格随机取角——那样每一格都顶死）。
// 这里用合成 World（6×6 四边形格）验四件事：
//   ① 地块划分非平凡（>1 块、每块 ≥1 格、块内同高）；
//   ② 行号（行 = 人字坐标 / 垄宽）在**同一块地内**跨格边界连续 —— 相邻纹素跳变 < 0.5 条垄；
//   ③ 对照：旧做法（逐格 hash 取角）在同一批纹素上行号大面积断裂（判据有分辨力）；
//   ④ 田埂通道贴地块边界为 0、块内为 1；地块主轴夹角跨度 > 0（真的改向）。
import assert from 'node:assert/strict';
import { buildFieldPlotField, fieldPlotAt, fieldToneAt, axisSpreadDeg, fieldPlotCells } from '../src/world/field-plot-map.js';

/* ---- 合成 World：N×N 四边形格，第 1 层实心（地表） ---- */
function quadWorld(N = 6, level = 2) {
  const cells = [], tops = [], river = new Uint8Array(N * N);
  const at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const id = j * N + i;
    const pts = [
      { id: id * 4, x: i, z: j }, { id: id * 4 + 1, x: i + 1, z: j },
      { id: id * 4 + 2, x: i + 1, z: j + 1 }, { id: id * 4 + 3, x: i, z: j + 1 },
    ];
    cells.push({
      id, n: 4, pts, cx: i + 0.5, cz: j + 0.5, minX: i, maxX: i + 1, minZ: j, maxZ: j + 1,
      edgeNeighbors: [at(i, j - 1), at(i + 1, j), at(i, j + 1), at(i - 1, j)],
    });
    tops.push(level);
  }
  return {
    cells, river, tops,
    top(c) { return this.tops[c.id]; },
    topIsBuilt() { return false; },
  };
}

const world = quadWorld(6, 2);
const cells = fieldPlotCells(world);
assert.equal(cells.length, 36, '可种格 = 全部 36 格');

const f = buildFieldPlotField(world, { seed: 5, joinChance: 0.55, maxCells: 6, bandWidth: 0.55, texel: 0.08 });
assert.ok(f && f.w > 10 && f.h > 10, '烘焙出图');
console.log('map', { w: f.w, h: f.h, texel: f.texel, plots: f.plots.length, cells: f.count, filled: f.filled, borders: f.borders });

/* ① 地块划分非平凡 */
assert.ok(f.plots.length >= 3 && f.plots.length <= 36, `地块数 ${f.plots.length} 应在 3–36`);
const covered = f.plots.reduce((s, p) => s + p.cells, 0);
assert.equal(covered, f.count, '每格恰属一块');
assert.ok(f.filled > f.w * f.h * 0.3, `有效纹素 ${f.filled} 应占多数`);

/* ④ 主轴真的改向 */
const spread = axisSpreadDeg(f.plots);
assert.ok(spread.maxDeg > 10, `地块主轴最大夹角 ${spread.maxDeg}° 应 > 10°`);

/* ② 行号连续：**同一块地内**相邻纹素跳变 < 0.5 条垄。
   同一块地的判据 = 色调通道（B 通道是逐地块常量）；跨地块断裂是应该的（片内边界一刀切换向）。 */
function maxJump(field) {
  let max = 0, n = 0, big = 0;
  for (let iz = 0; iz < field.h; iz++) for (let ix = 0; ix + 1 < field.w; ix++) {
    const a = (iz * field.w + ix) * 4, b = a + 4;
    if (field.data[a + 3] < 0.5 || field.data[b + 3] < 0.5) continue;
    if (Math.abs(field.data[a + 2] - field.data[b + 2]) > 1e-6) continue;   // 不同地块
    const d = Math.abs(field.data[b] - field.data[a]);
    max = Math.max(max, d); n++; if (d > 0.5) big++;
  }
  return { max: +max.toFixed(3), n, big };
}
const jump = maxJump(f);
console.log('row continuity', jump);
assert.ok(jump.big === 0, `块内行号断裂 ${jump.big} 处应为 0（最大跳变 ${jump.max}）`);

/* ③ 对照：同一批纹素按「逐格 hash 取角」重写行号 → 断裂成片（证明判据有分辨力） */
function hash01(v) { const s = Math.sin(v * 127.1) * 43758.5453; return s - Math.floor(s); }
const ctrl = { w: f.w, h: f.h, texel: f.texel, minX: f.minX, minZ: f.minZ, data: new Float32Array(f.data) };
for (let iz = 0; iz < f.h; iz++) for (let ix = 0; ix < f.w; ix++) {
  const x = f.minX + (ix + 0.5) * f.texel, z = f.minZ + (iz + 0.5) * f.texel, o = (iz * f.w + ix) * 4;
  if (ctrl.data[o + 3] < 0.5) continue;
  const ci = Math.min(35, Math.max(0, Math.floor(x) + Math.floor(z) * 6));
  const ang = hash01(ci * 19 + 5) * Math.PI;            // terrainmesh.js:187 旧口径
  ctrl.data[o] = ((x * Math.cos(ang) + z * Math.sin(ang)) / 0.55);
}
const cj = maxJump(ctrl);
console.log('control (per-cell hash)', cj);
assert.ok(cj.big > jump.big + 20, `旧口径断裂 ${cj.big} 处应远多于地块口径 ${jump.big} 处`);

/* ④ 田埂通道：地块边界处 0 附近，块心处 1 */
let edgeMin = Infinity, innerMax = 0, innerN = 0;
for (let iz = 0; iz < f.h; iz++) for (let ix = 0; ix < f.w; ix++) {
  const o = (iz * f.w + ix) * 4; if (f.data[o + 3] < 0.5) continue;
  const b = f.data[o + 1];
  edgeMin = Math.min(edgeMin, b);
  if (b > 0.999) { innerMax = Math.max(innerMax, b); innerN++; }
}
console.log('border channel', { edgeMin: +edgeMin.toFixed(3), innerN });
assert.ok(edgeMin < 0.35, `地块边界处田埂通道 ${edgeMin.toFixed(3)} 应 < 0.35`);
assert.ok(innerN > f.filled * 0.15, `块内（通道=1）纹素 ${innerN} 应占 15% 以上`);

/* CPU 孪生：色调有明暗（同一条垄上相隔半条垄的两点，tone 差 > 0.15），且在 0.6–1.4 之间 */
const probes = [];
for (let z = 0.3; z < 5.7; z += 0.37) for (let x = 0.3; x < 5.7; x += 0.41) {
  const s = fieldPlotAt(f, x, z), t = fieldToneAt(f, x, z);
  if (s) probes.push({ x, z, row: s.row, tone: t });
}
assert.ok(probes.length > 50, `探针 ${probes.length} 个`);
const tmin = Math.min(...probes.map((p) => p.tone)), tmax = Math.max(...probes.map((p) => p.tone));
console.log('tone', { tmin: +tmin.toFixed(3), tmax: +tmax.toFixed(3), n: probes.length });
assert.ok(tmax - tmin > 0.15, `tone 跨度 ${(tmax - tmin).toFixed(3)} 应 > 0.15（条带不是常数色）`);
assert.ok(tmin > 0.55 && tmax < 1.45, 'tone 应在 0.55–1.45（只调明暗、不改色相）');

console.log('PASS field-plot-map：地块 ✓ 主轴改向 ' + spread.maxDeg + '° · 行号连续（跳变 ' + jump.max + '）· 旧口径断裂 ' + cj.big + ' 处 · 田埂 ' + edgeMin.toFixed(3));
