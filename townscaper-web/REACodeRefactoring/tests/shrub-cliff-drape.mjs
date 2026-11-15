// 第 69 轮 · 1707490932017279035 / 1707497006640365880（灌木）：第 68 轮遗留缺口 ②
//   「崖**竖直面**上的垂挂段现在是草皮舌头（blotch-tongue-c09），原片那层是灌木色、且比草皮舌头短」。
// 现在 terrainmesh 的草皮垂挂循环按边的灌木标记（shrubEdgeFlags 的 cliff[i]）分两档：
//   灌木边 → 灌木色（SHRUB_DEFAULT_STYLE.color × 0.94）、垂深 × 0.45；其它边维持草皮色 × 0.9、原深度。
// 判据（真几何量，不读代码猜）：
//   A. 灌木色垂挂段确实存在（drapeShrub > 0），且不是全岛统一替换（drapeGrass 也 > 0）；
//   B. 灌木段的最大垂深 ≤ 草皮段的 0.6 倍（原片「比草皮舌头短」）；
//   C. 关掉灌木门控（world.shrubFootC09 = false 时 cliff 仍按崖顶算）时不崩、统计自洽（shrub+grass 为垂挂段总数）；
//   D. 灌木色段与草皮色段在顶点色里可区分（取 MeshWriter 的真实 col 缓冲区，各找一例比 RGB）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildMixedGrid, buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { SHRUB_DEFAULT_STYLE } = await import('../src/terrain/shrub-texture.js');

function build({ grid = 'mixed', seed = 5, shrubFoot = null } = {}) {
  const g = grid === 'quad' ? buildQuadGrid({ radius: 7, seed }) : buildMixedGrid({ radius: 7, seed });
  const world = new World(decorateCells(g));
  if (shrubFoot !== null) world.shrubFootC09 = shrubFoot;
  generateTerrain(world, { seed: 7, rivers: 1, towers: 1 });
  const w = new MeshWriter();
  const out = buildTerrain(w, world, { L: 0.5 });
  return { world, w, out };
}

// —— A/B：两种网格上都要有灌木色段，且明显更短
const rows = [];
for (const grid of ['mixed', 'quad']) {
  const { out } = build({ grid });
  rows.push({ grid, ...out });
  assert.ok(out.drapeShrub > 0, `${grid}: 灌木色垂挂段为 0（cliff 门控或着色没接上）`);
  assert.ok(out.drapeGrass > 0, `${grid}: 草皮垂挂段为 0（对照组没了，判据失效）`);
  assert.ok(out.drapeShrubMaxDepth > 0, `${grid}: 灌木段垂深为 0`);
  assert.ok(out.drapeShrubMaxDepth <= out.drapeGrassMaxDepth * 0.6 + 1e-6,
    `${grid}: 灌木段没更短 ${out.drapeShrubMaxDepth} vs 草皮 ${out.drapeGrassMaxDepth}`);
}

// —— C：关掉 C09 崖脚/墙根门控（默认 off）也要自洽
const off = build({ shrubFoot: false }).out;
assert.equal(off.drapeShrub + off.drapeGrass > 0, true, 'default 门控下垂挂段为 0');
assert.ok(Number.isFinite(off.drapeShrubMaxDepth) && Number.isFinite(off.drapeGrassMaxDepth));

// —— D：从真实顶点色缓冲里各找一例，确认两档颜色确实不同
const { w, out } = build({ grid: 'mixed' });
const sTarget = [SHRUB_DEFAULT_STYLE.color].map((h) => {
  const r = parseInt(h.slice(1, 3), 16) / 255, g2 = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
  return [r, g2, b].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));   // sRGB → 线性（THREE.Color 内部空间）
})[0].map((c) => c * 0.94);
const near = (a, b) => Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02 && Math.abs(a[2] - b[2]) < 0.02;
let shrubTri = -1, grassTri = -1;
for (let i = 0; i + 8 < w.col.length; i += 9) {
  const c0 = [w.col[i], w.col[i + 1], w.col[i + 2]];
  if (shrubTri < 0 && near(c0, sTarget)) shrubTri = i;
  // 草皮段：绿色系且明显偏绿（灌木是橙红：r>g）
  if (grassTri < 0 && c0[1] > c0[0] * 1.15 && c0[1] > 0.02) grassTri = i;
}
assert.ok(shrubTri >= 0, '顶点色里找不到灌木段（颜色没换或色空间算错）');
assert.ok(grassTri >= 0, '顶点色里找不到草皮段');
const sr = w.col[shrubTri], sg = w.col[shrubTri + 1], sb = w.col[shrubTri + 2];
assert.ok(sr > sg, `灌木段应偏红：r=${sr.toFixed(3)} g=${sg.toFixed(3)} b=${sb.toFixed(3)}`);

console.log(JSON.stringify({
  ok: true,
  rows: rows.map((r) => ({ grid: r.grid, shrub: r.drapeShrub, grass: r.drapeGrass, shrubMaxDepth: r.drapeShrubMaxDepth, grassMaxDepth: r.drapeGrassMaxDepth })),
  defaultGate: { shrub: off.drapeShrub, grass: off.drapeGrass },
  sampleShrubRGB: [sr.toFixed(3), sg.toFixed(3), sb.toFixed(3)],
  triangles: w.col.length / 9,
}, null, 1));
