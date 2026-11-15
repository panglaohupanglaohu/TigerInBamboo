// r53 G4: REACode shrubcard.js — folded card metrics (fold angle, side width, contrast) and
// opt-in wall-base shrub cards in the live Vegetation on the shared World.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => ctx2d, width: 0, height: 0, set innerHTML(v) {}, set textContent(v) {} });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const B = await import('../src/core/anchored-billboard.js');
const { Vegetation, wallCardGeometry } = await import('../src/life/vegetation.js');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');

// original shrubcard numbers: tris 2→4, verts 4→5, side width 0→depth, fold 0→58.5°, contrast 0→0.198
const card = B.foldedCard({ depth: .28 });
assert.equal(card.triangles, 4); assert.equal(card.vertices, 5);
assert.ok(Math.abs(B.foldAngle({ depth: .28 }) - 58.5) < .1); assert.equal(B.foldAngle({ depth: 0 }), 0);
assert.ok(Math.abs(B.foldedSideWidth(Math.PI / 2, { depth: .28 }) - .28) < 1e-9, 'edge-on card keeps depth width');
assert.ok(B.foldedSideWidth(Math.PI / 2, { depth: 0 }) < 1e-12, 'flat card vanishes edge-on');
for (let d = 0; d <= 90; d += 10) assert.ok(B.foldedSideWidth(d * Math.PI / 180, { depth: .28 }) >= .28 - 1e-9);
assert.ok(Math.abs(B.foldedContrast(undefined, { depth: .28 }) - .198) < .001); assert.equal(B.foldedContrast(undefined, { depth: 0 }), 0);
assert.throws(() => B.foldedCard({ depth: -1 }));
const g = wallCardGeometry();
assert.equal(g.getAttribute('position').count, 12);
const fold = g.getAttribute('aFold'); const ns = new Set(); for (let i = 0; i < 12; i += 3) ns.add([fold.getX(i), fold.getY(i), fold.getZ(i)].map((v) => v.toFixed(3)).join());
assert.equal(ns.size, 4, 'each triangle keeps its own fold normal'); for (let i = 0; i < 12; i++) assert.ok(fold.getZ(i) > 0, 'faces camera side');

for (const [kind, grid] of [['quad', buildQuadGrid({ radius: 6, seed: 2 })], ['mixed', buildMixedGrid({ radius: 7, seed: 2 })]]) {
  decorateCells(grid);
  const world = new World(grid);
  for (const c of world.cells) if (Math.hypot(c.cx, c.cz) < 5) world.fill(c, 2, { rock: true });
  for (const c of world.cells) if (Math.hypot(c.cx - .5, c.cz) < 1.3) { world.setSolid(c, 3, true); world.setSolid(c, 4, true); }
  const veg = new Vegetation({ scene: new THREE.Scene(), levelHeight: .5, uTime: { value: 0 } });
  veg.refresh(world, null, {}, 5);
  const blobs = veg.shrubs.count;
  assert.equal(veg.wallCards.count, 0, 'default look unchanged');
  veg.wallShrubCards = true; veg.refresh(world, null, {}, 5);
  assert.ok(veg.wallCards.count > 4, kind + ' wall-base cards ' + veg.wallCards.count);
  assert.ok(veg.shrubs.count < blobs, 'wall-base blobs replaced, cliff blobs kept');
  // every card sits on terrace ground right next to a built neighbour
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < veg.wallCards.count; i++) {
    veg.wallCards.getMatrixAt(i, m); p.setFromMatrixPosition(m);
    assert.ok(Math.abs(p.y - 1) < 1e-6, 'on level-2 ground');
    const near = world.cells.filter((c) => world.topIsBuilt(c)).some((c) => c.pts.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < .9));
    assert.ok(near, 'next to a house wall');
  }
  console.log('PASS shrub cards', kind, { blobs, cards: veg.wallCards.count, blobsAfter: veg.shrubs.count });
}
