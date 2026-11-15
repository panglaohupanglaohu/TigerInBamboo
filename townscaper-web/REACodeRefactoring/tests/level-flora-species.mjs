// r53 G4: REACode levelflora.js on the shared World + live Vegetation: per-level species,
// one species per cell cluster, species predicts terrace level; global mode loses that.
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
const { levelFloraSpecies, levelFloraRanks, measureLevelFlora, LEVEL_SPECIES } = await import('../src/core/level-flora.js');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells, pointInQuad } = await import('../src/core/spatial.js');
const { Vegetation } = await import('../src/life/vegetation.js');

// pure policy
assert.deepEqual([...levelFloraRanks([0, 4, 2, 2, 6, 8, 4])], [[2, 0], [4, 1], [6, 2], [8, 3]]);
const rows = [], glob = [];
for (let id = 0; id < 400; id++) { const level = id % 4; rows.push({ level, key: levelFloraSpecies(level, id).key }); glob.push({ level, key: levelFloraSpecies(level, id, { mode: 'global' }).key }); }
const per = measureLevelFlora(rows), gl = measureLevelFlora(glob);
assert.equal(per.sharedSpecies, 0); assert.equal(per.levelFromSpecies, 1); assert.equal(per.speciesUsed, 8);
assert.equal(gl.sharedSpecies, 3); assert.ok(gl.levelFromSpecies < .5, 'global palette carries little height information');
assert.equal(levelFloraSpecies(2, 17).key, levelFloraSpecies(2, 17).key, 'deterministic');
assert.equal(levelFloraSpecies(9, 3).key, levelFloraSpecies(3, 3).key, 'ranks above 4 reuse the top set');
assert.throws(() => levelFloraSpecies(-1, 0));

for (const [kind, grid] of [['quad', buildQuadGrid({ radius: 7, seed: 3 })], ['mixed', buildMixedGrid({ radius: 8, seed: 3 })]]) {
  decorateCells(grid);
  const world = new World(grid);
  for (const c of world.cells) { const r = Math.hypot(c.cx, c.cz); if (r < 6.5) world.fill(c, r < 1.8 ? 8 : r < 3.4 ? 6 : r < 5 ? 4 : 2, { rock: true }); }
  const veg = new Vegetation({ scene: new THREE.Scene(), levelHeight: .5, uTime: { value: 0 } });
  veg.levelFlora = true; veg.refresh(world, null, {}, 11);
  const m = measureLevelFlora(veg.floraSpecies);
  assert.ok(m.levels >= 3 && m.sharedSpecies === 0 && m.levelFromSpecies === 1, kind + ' species are a height legend ' + JSON.stringify(m));
  // tuft colours inside one cell come from that cell's single species
  const allowed = new Map(veg.floraSpecies.map((r) => [r.cell, LEVEL_SPECIES[r.key]]));
  const col = new THREE.Color(); let checked = 0;
  const mat = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < veg.tufts.count; i++) {
    veg.tufts.getMatrixAt(i, mat); p.setFromMatrixPosition(mat);
    const cell = world.cells.find((c) => pointInQuad(c.pts, p.x, p.z));
    if (!cell) continue;
    const edgeDist = Math.min(...cell.pts.map((a, k) => { const b = cell.pts[(k + 1) % cell.pts.length], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); }));
    const sp = allowed.get(cell.id); if (!sp || edgeDist < .1) continue;
    const got = [veg.tuftColor.getX(i), veg.tuftColor.getY(i), veg.tuftColor.getZ(i)];
    const ok = [sp.col, sp.hi].some((h) => { col.set(h); return Math.abs(col.r - got[0]) + Math.abs(col.g - got[1]) + Math.abs(col.b - got[2]) < 1e-5; });
    assert.ok(ok, kind + ' tuft colour from its cell species'); checked++;
  }
  assert.ok(checked > 10, 'checked tufts ' + checked);
  veg.levelFlora = false; veg.refresh(world, null, {}, 11);
  assert.equal(veg.floraSpecies.length, 0, 'default appearance unchanged when off');
  console.log('PASS level flora species', kind, m, { checked });
}
