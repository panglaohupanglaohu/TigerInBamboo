// 缓坡连续化（generate.js limitSoftSlopes / softRelax，1447488323845509121）：
// 缓坡省相邻格 ≤1 层 → soft-tops 连成连续坡面；陡崖省的崖保留；只降不升；海岸轮廓不变；塔柱不被压平。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain, limitSoftSlopes } = await import('../src/terrain/generate.js');
const { softCorners } = await import('../src/terrain/soft-tops.js');

// 纯函数：一条 0-1-…链
{ const cells = [0, 1, 2, 3, 4].map((id) => ({ id, edgeNeighbors: [id - 1, id + 1 > 4 ? -1 : id + 1] }));
  const level = Int32Array.from([1, 6, 6, 6, 8]), sharp = Float32Array.from([0, 0, 0, 0, 1]);
  const r = limitSoftSlopes(cells, level, sharp); assert.deepEqual([...level], [1, 2, 3, 4, 8], '缓坡成 1 层一级的坡，陡崖格不动'); assert.deepEqual(r, { lowered: 3, volume: 4 + 3 + 2, step: 1 });
  const sea = Int32Array.from([0, 5, 5, 5, 5]); limitSoftSlopes(cells, sea, new Float32Array(5)); assert.deepEqual([...sea], [0, 5, 5, 5, 5], '海不是源：临海崖不被压成滩');
  assert.throws(() => limitSoftSlopes(cells, level, sharp, { step: 0 }), RangeError); }

const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 10 })], ['mixed', buildMixedGrid({ radius: 14 })]]) for (const seed of [7, 21]) {
  const g = decorateCells(grid), base = new World(g), soft = new World(g), cont = new World(g);
  const opt = { seed, rivers: 0, caves: 0, features: false };
  generateTerrain(base, opt); generateTerrain(soft, { ...opt, softSlopes: true }); generateTerrain(cont, { ...opt, softSlopes: true, softRelax: true });
  const cells = cont.cells, mask = cont.slopeMask, isSoft = (c) => cont.ground(c) > 0 && mask[c.id] < 0.5;
  let softPairs = 0, softBad = 0, cliffs = 0, raised = 0, coastChanged = 0, softBefore = 0;
  for (const c of cells) {
    if (cont.ground(c) > soft.ground(c)) raised++;
    if ((cont.ground(c) > 0) !== (soft.ground(c) > 0)) coastChanged++;
    for (const o of c.edgeNeighbors) { if (o < c.id) continue; const n = cells[o], d = Math.abs(cont.ground(c) - cont.ground(n));
      if (isSoft(c) && isSoft(n)) { softPairs++; if (d > 1) softBad++; if (Math.abs(soft.ground(c) - soft.ground(n)) > 1) softBefore++; }
      else if (cont.ground(c) > 0 && cont.ground(n) > 0 && d >= 2) cliffs++; }
  }
  assert.equal(softBad, 0, `${name}/${seed} 缓坡省相邻格都 ≤1 层`); assert.ok(softBefore > 0, '连续化之前缓坡省里确实有 ≥2 层的小崖');
  assert.equal(raised, 0, '只降不升'); assert.equal(coastChanged, 0, '陆地轮廓不变'); assert.ok(cliffs > 10, '陡崖省仍有 ≥2 层的崖：' + cliffs);
  assert.ok(cont.softLimit.lowered > 0 && soft.softLimit == null);
  // soft-tops：记录连续化前后被连成坡面的格角数（不作为通过条件）
  soft.softTops = cont.softTops = true; const a = softCorners(soft), b = softCorners(cont);
  // 2026-11-15 实测：连成坡面的格角数几乎不变（23→29、38→37）——坡度上限本身成立，但 soft-tops 的成面条件仍很窄，可见的连续坡面还没做到
  out[name + '/' + seed] = { softPairs, cliffsBefore: softBefore, cliffsKept: cliffs, lowered: cont.softLimit.lowered, softVertices: [a.vertices, b.vertices] };
  // 确定性
  const again = new World(g); generateTerrain(again, { ...opt, softSlopes: true, softRelax: true }); assert.deepEqual(Array.from(again.solid), Array.from(cont.solid));
}
console.log('PASS soft-continuous', JSON.stringify(out));
