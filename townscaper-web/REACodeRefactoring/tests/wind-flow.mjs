// r53 G4: REACode wind.js / voxelflow.js / flowdemo.js / engine/snow.js / engine/fog.js on the shared World.
// Pure node: trace particles + flag curve, packed GPU wind field == CPU sampler, soft normals with hard
// edges, deformed-mesh collision, snow contact AO, fog wisps steered around World voxels.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { makeWorldProbes } = await import('../src/core/world-probes.js');
const W = await import('../src/core/wind-flow.js');
const { makeFogWisps } = await import('../src/core/fog-envelope.js');
const { Atmosphere } = await import('../src/life/atmosphere.js');

// --- pure: sampleCurve passes through controls; ribbon has fixed arc
const pts = [[0, 0, 0], [1, .2, 0], [2, .1, .5], [3, .4, 1]];
for (let i = 0; i < pts.length; i++) assert.deepEqual(W.sampleCurve(pts, i / 3).map((v) => +v.toFixed(9)), pts[i].map((v) => +v.toFixed(9)));
const rib = W.flagRibbon(pts, { length: .5, height: .3, segments: 6 });
assert.equal(rib.top.length, 7);
let arc = 0; for (let i = 1; i < rib.top.length; i++) arc += Math.hypot(...rib.top[i].map((v, k) => v - rib.top[i - 1][k]));
assert.ok(Math.abs(arc - .5) < .02, 'flag length independent of gust strength ' + arc);
assert.ok(rib.bottom.every((b, i) => Math.abs(rib.top[i][1] - b[1] - .3) < 1e-12));
assert.throws(() => W.flagRibbon([[0, 0, 0], [0, 0, 0]]));

for (const [kind, grid] of [['quad', buildQuadGrid({ radius: 5, seed: 4 })], ['mixed', buildMixedGrid({ radius: 6, seed: 4 })]]) {
  decorateCells(grid);
  const index = buildCellIndex(grid), world = new World(grid);
  // island: rock 2 levels inside r<3.2, a tunnel row (levels 1 empty, 2-3 solid) through x≈0
  for (const c of world.cells) {
    const r = Math.hypot(c.cx, c.cz);
    if (r < 3.2) { world.fill(c, 2, { rock: true }); if (Math.abs(c.cz) < .5) { world.setSolid(c, 1, false); world.setSolid(c, 3, true); } }
  }
  const probes = makeWorldProbes(world, index);
  const scene = new THREE.Scene(), uTime = { value: 0 };
  const atm = new Atmosphere({ scene, levelHeight: .5, uTime });
  atm.rebuild(world, index);

  // 1. trace through the shared field never enters a solid World bit
  let blockedTotal = 0;
  for (let a = 0; a < 12; a++) {
    const start = [Math.cos(a) * 6, .7, Math.sin(a) * 6];
    if (probes.occupied(...start)) continue;
    const t = atm.trace(start, { steps: 40, dt: .2 });
    blockedTotal += t.blocked;
    for (const p of t.points) assert.equal(probes.occupied(...p), false, `${kind} trace in solid`);
  }
  const wall = W.traceWind(() => [1, 0, 0], probes, [-7, .3, 1.6], { steps: 80, dt: .2 });
  assert.ok(wall.blocked > 0 && wall.points.every((p) => !probes.occupied(...p)), kind + ' particle stops at a World wall instead of tunnelling');
  const flag = atm.flagCurve([6, 1.4, 0], { length: .6, height: .3 });
  assert.equal(flag.top.length, 9);
  assert.throws(() => atm.trace([world.cells.find((c) => world.top(c) === 2 && Math.abs(c.cz) >= .5).cx, .25, world.cells.find((c) => world.top(c) === 2 && Math.abs(c.cz) >= .5).cz]));

  // 2. packed texture sampler == Atmosphere.sample (GPU path uses same layout as CPU)
  const tex = atm.windTexture();
  assert.equal(tex.texture.image.width, atm.field.W);
  assert.equal(tex.texture.image.height, atm.field.H * atm.field.LV);
  assert.ok(tex.glsl.includes('sampleWind'));
  let maxErr = 0;
  for (let i = 0; i < 400; i++) {
    const x = atm.field.x0 + ((i * 0.37) % 1) * atm.field.W * .45, z = atm.field.z0 + ((i * 0.71) % 1) * atm.field.H * .45, y = ((i * 0.13) % 1) * 2.5;
    const a = atm.sample(x, y, z), b = W.samplePackedWind(tex.packed, x, y, z, { res: .45, levelHeight: .5 });
    maxErr = Math.max(maxErr, Math.abs(a.x - b[0]), Math.abs(a.y - b[1]), Math.abs(a.z - b[2]));
  }
  assert.ok(maxErr < 1e-5, `${kind} packed wind error ${maxErr}`);
  assert.equal(atm.windTexture().texture, tex.texture, 'cached until rebuild');
  atm.rebuild(world, index); assert.notEqual(atm.windTexture().texture, tex.texture);

  // 3. soft normals into a real mesh: top-face quad at a cliff edge bends outward; a thin-wall
  // opposite normal is kept (hard edge)
  const edgeCell = world.cells.find((c) => world.top(c) === 2 && c.edgeNeighbors.some((n) => n >= 0 && world.top(world.cells[n]) === 0));
  const pos = new Float32Array([edgeCell.cx, 1, edgeCell.cz, edgeCell.pts[0].x, 1, edgeCell.pts[0].z, edgeCell.pts[1].x, 1, edgeCell.pts[1].z]);
  const nrm = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const r = atm.bakeSoftNormals(g, { blend: .55, minDot: .3 });
  assert.ok(r.touched >= 1, kind + ' soft normals touched');
  const cornerTilt = Math.hypot(nrm[3], nrm[5]);
  assert.ok(cornerTilt > .05 && nrm[4] > .3, kind + ' edge corner normal leans outward ' + cornerTilt);
  const hard = new Float32Array([0, 0, 0]), hn = new Float32Array([1, 0, 0]);
  const hr = W.bakeSoftNormals(hard, hn, () => [-1, 0, 0], { blend: 1, minDot: .5 });
  assert.equal(hr.kept, 1); assert.deepEqual([...hn], [1, 0, 0], 'opposite field normal does not flip a face');

  // 4. snow: contact AO from actual support (tunnel floor vs roof), never inside solid
  atm.showSnow = true;
  for (let s = 0; s < 40; s++) { uTime.value += 1 / 30; atm.update(1 / 30); }
  for (let k = 0; k < atm.snowN; k++) assert.equal(probes.occupied(atm.snowPos[k * 3], atm.snowPos[k * 3 + 1], atm.snowPos[k * 3 + 2]), false);
  const alphas = [...atm.snowAlpha];
  assert.ok(Math.min(...alphas) < Math.max(...alphas) * .7, kind + ' contact AO varies');
  assert.ok(atm.snow.material.isShaderMaterial && atm.snow.geometry.getAttribute('aSize').array.some((v, i, a) => v !== a[0]), 'round soft flakes with varying size');
  assert.ok(Math.abs(W.particleContactAlpha(0, 0) / W.particleContactAlpha(2, 0) - .35) < 1e-9);

  // 5. fog wisps: advected by the shared wind, steered around voxels, count preserved
  atm.showFog = true;
  const before = atm.fogWisps.wisps.map((m) => [m.x, m.z]);
  for (let s = 0; s < 200; s++) { uTime.value += .05; atm.update(.05); }
  for (const m of atm.fogWisps.wisps) assert.equal(probes.occupied(m.x, m.y, m.z), false, kind + ' wisp inside voxel');
  assert.ok(atm.fogWisps.wisps.some((m, i) => Math.hypot(m.x - before[i][0], m.z - before[i][1]) > .5), 'wisps drift');
  assert.equal(atm.fogSheets.geometry.instanceCount, atm.fogWisps.wisps.length);
  assert.equal(atm.wispData[0], Math.fround(atm.fogWisps.wisps[0].x), 'instance buffer follows simulation');
  console.log('PASS wind-flow', kind, { cells: world.cells.length, blockedTotal, packedErr: maxErr.toExponential(1), soft: r, alpha: [Math.min(...alphas).toFixed(2), Math.max(...alphas).toFixed(2)] });
}

// 6. deformed collision: a slanted soup returns interpolated height; walls ignored
const soup = new Float32Array([0, 0, 0, 2, 1, 0, 0, 0, 2, /* wall */ 1, 0, 1, 1, 5, 1, 1, 5, 1.0001]);
const col = W.meshCollider(soup);
assert.ok(Math.abs(col.heightAt(1, .5) - .5) < 1e-9);
assert.equal(col.heightAt(5, 5), null);
assert.ok(Math.abs(col.heightAt(1, .5, .4) ?? -1) === 1, 'maxY filters surfaces above the probe');

// 7. fog wisps steer around a blocker
const fw = makeFogWisps({ count: 1, radius: 30, inner: 4, seed: 2 });
fw.wisps[0].x = -3; fw.wisps[0].z = 0;
for (let i = 0; i < 100; i++) fw.step(.1, () => [1, 0, 0], (x, y, z) => Math.abs(x) < 1 && Math.abs(z) < 1);
assert.ok(fw.wisps[0].detours > 0 && fw.wisps[0].x > -3, 'blocked step turns tangentially');
console.log('PASS wind-flow pure');
