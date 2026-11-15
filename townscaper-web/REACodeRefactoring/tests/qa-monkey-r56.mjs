// 第 56 批 C05：1344290848180203523 猴子 QA（src/core/qa-monkey.js）。
// node 里直接跑真 WorldMesh（关烘焙）：种子化乱改 → 每步审几何 → 每 10 步增量=整体 → 还原零残留；
// 再做反例：增量网格"漏重建"必须被抓住；摘要与三角顺序无关、对 1 个顶点的改动敏感。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { PALETTES } = await import('../src/core/palette.js');
const { buildScene } = await import('../src/world/scenes.js');
const { WorldMesh } = await import('../src/world/worldmesh.js');
const Q = await import('../src/core/qa-monkey.js');

// 摘要：顺序无关 + 敏感
{
  const g = new THREE.BufferGeometry(); const p = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 2, 2, 3, 2, 2, 2, 3, 2]);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const d = Q.positionDigest(g);
  const h = new THREE.BufferGeometry(); h.setAttribute('position', new THREE.BufferAttribute(new Float32Array([2, 2, 2, 3, 2, 2, 2, 3, 2, 0, 1, 0, 0, 0, 0, 1, 0, 0]), 3));
  assert.equal(Q.positionDigest(h), d, '三角/顶点顺序不影响');
  p[4] += 0.01; g.attributes.position.needsUpdate = true; assert.notEqual(Q.positionDigest(g), d, '动一个顶点就变');
}

const out = [];
for (const kind of ['quad', 'mixed']) {
  const grid = decorateCells(kind === 'mixed' ? buildMixedGrid({ radius: 22, hexSize: 0.62 }) : buildQuadGrid({ radius: 14, hexSize: 1 }));
  const world = new World(grid); world.palette = PALETTES.town; buildScene(world, 'town', 7);
  const wm = new WorldMesh(world, { levelHeight: 0.5 }); wm.bake = false;
  const view = { worldMesh: wm, changed() {}, render() { wm.rebuild(); } };
  const fresh = (w) => { const m = new WorldMesh(w, { levelHeight: 0.5 }); m.bake = false; m.rebuild(); return m.geometry; };
  const before = world.snapshot();
  const r = await Q.runMonkeyQA({ world, view }, { seed: 11, steps: 60, checkEvery: 10, freshGeometry: fresh });
  assert.ok(r.valid); assert.ok(r.checks.length >= 6 && r.checks.every((c) => c.same));
  for (const op of ['stack', 'float', 'carve', 'drop', 'paint']) assert.ok(r.counts[op] > 0, `${kind} 操作 ${op} 应出现`);
  assert.ok(r.endState.floating > 0, '序列应制造悬空体块');
  assert.equal(r.backDigest, r.startDigest);
  for (const k of ['solid', 'rock', 'color', 'river']) assert.deepEqual(Array.from(world[k]), Array.from(before[k]), `${kind} ${k} 还原`);
  // 同种子可复现
  const r2 = await Q.runMonkeyQA({ world, view }, { seed: 11, steps: 60, checkEvery: 60, freshGeometry: fresh });
  assert.deepEqual(r2.log, r.log, '同种子同序列');
  // 反例：增量网格在第 3 步之后不再重建（模拟块缓存漏更新）→ 必须在核对点抛错，并且 World 仍被还原
  let n = 0; const stale = { worldMesh: wm, changed() {}, render() { if (n++ < 3) wm.rebuild(); } };
  await assert.rejects(Q.runMonkeyQA({ world, view: stale }, { seed: 11, steps: 20, checkEvery: 5, freshGeometry: fresh }), /incremental mesh ≠ full rebuild/);
  for (const k of ['solid', 'color']) assert.deepEqual(Array.from(world[k]), Array.from(before[k]), '抛错后也还原');
  wm.invalidate(); wm.rebuild();
  out.push(`${kind}: ${JSON.stringify(r.counts)} 核对 ${r.checks.length} 次一致, 悬空 ${r.endState.floating}, 退化 ${r.maxDegenerate}`);
}
console.log('PASS qa-monkey r56: ' + out.join(' | ') + ' ；摘要顺序无关且敏感；同种子可复现；漏重建反例被抓住且抛错后还原');
