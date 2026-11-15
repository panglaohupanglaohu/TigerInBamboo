// r53 G4: REACode snapshot64.js — shared-World silhouette → 64² storage → bilinear vs crisp (shader twin),
// with the lab's IoU / edgeEnergy / peakGradient / bandPixels / rmse comparison.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const S = await import('../src/world/island-snapshot.js');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { fbm } = await import('../src/core/noise.js');
const M = S.snapshotMetrics;
for (const [kind, grid] of [['quad', buildQuadGrid({ radius: 9, seed: 7 })], ['mixed', buildMixedGrid({ radius: 12, seed: 7 })]]) {
  decorateCells(grid);
  const world = new World(grid), index = buildCellIndex(grid);
  for (const c of world.cells) if (Math.hypot(c.cx, c.cz) / 9 + (fbm(c.cx * .2, c.cz * .2, { seed: 3 }) - .5) * .6 < .75) world.fill(c, 1, { rock: true });
  const n = 256, m = 64, truth = S.worldSilhouette(world, index, { size: n, half: 9 });
  assert.ok(truth.some((v) => v === 1) && truth.some((v) => v === 0));
  const small = S.downsampleMask(truth, n, m), bil = S.upsampleBilinear(small, m, n), crisp = S.crispSnapshotCPU(small, m, n);
  const r = { iouBil: M.iou(bil, truth), iouCrisp: M.iou(crisp, truth), eBil: M.edgeEnergy(bil, n), eCrisp: M.edgeEnergy(crisp, n), pBil: M.peakGradient(bil, n), pCrisp: M.peakGradient(crisp, n), bBil: M.bandPixels(bil), bCrisp: M.bandPixels(crisp), rBil: M.rmse(bil, truth), rCrisp: M.rmse(crisp, truth) };
  assert.ok(r.iouBil > .9 && Math.abs(r.iouCrisp - r.iouBil) < .02, kind + ' crisping does not move the silhouette');
  assert.ok(r.pCrisp > r.pBil * 1.5, kind + ' steeper edge');
  assert.ok(r.bCrisp < r.bBil * .5, kind + ' narrower transition band');
  assert.ok(r.rCrisp < r.rBil, kind + ' closer to the 0/1 truth');
  assert.ok(Math.abs(r.eCrisp - r.eBil) / r.eBil < .25, kind + ' edgeEnergy is ~invariant (not a crispness metric)');
  // GPU readback path: alpha channel extraction
  const px = new Uint8Array(m * m * 4); small.forEach((v, i) => { px[i * 4 + 3] = Math.round(v * 255); });
  assert.ok(M.rmse(S.snapshotAlpha(px, m), small) < 1 / 255);
  // live World edit changes the truth (no stale cache)
  const c0 = world.cells.find((c) => world.isLand(c)); world.fill(c0, 0);
  assert.ok(M.rmse(S.worldSilhouette(world, index, { size: n, half: 9 }), truth) > 0);
  console.log('PASS snapshot metrics', kind, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(4)])));
}
assert.throws(() => S.downsampleMask(new Float32Array(100), 10, 3));
