// 926903893866541057 完整轨迹接口：makeWindField（解析场，种子确定）+ WindPath
//（traceWindPath：at(t) 任意时刻位置 / hitsHole·throughHole 命中洞 / exitIndex
// 出界 / blocked）。确定性、轨迹守恒、通洞/封洞/避障语义、共享场同形包装。
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
const { Atmosphere } = await import('../src/life/atmosphere.js');
const near = (a, b, e = 1e-9) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= e);

// --- pure: makeWindField determinism + WindPath query ---
const f1 = W.makeWindField({ seed: 7 }), f2 = W.makeWindField({ seed: 7 }), f3 = W.makeWindField({ seed: 8 });
for (const p of [[1.2, .6, -3], [0, 2, 4], [9, .1, 0], [-5, 3.3, 1.1]]) assert.deepEqual(f1.at(...p), f2.at(...p), 'same seed same field');
assert.notDeepEqual(f1.at(1.2, .6, -3), f3.at(1.2, .6, -3), 'seed changes the perturbation phases');
assert.ok(Math.abs(Math.hypot(...f1.dir) - 1) < 1e-12, 'dir normalised');
assert.equal(f1.sampleCurve, W.sampleCurve);

const path = f1.trace(0, 1, 0, { steps: 40, dt: .1 });
assert.ok(path instanceof W.WindPath);
assert.equal(path.points.length, 41);
assert.equal(path.blocked, 0);
assert.equal(path.status, 'advected');
for (const p of path.points) assert.ok(p[1] >= .02 - 1e-12, 'analytic trace stays above ground');
// determinism: identical call → identical trajectory
assert.deepEqual(f2.trace(0, 1, 0, { steps: 40, dt: .1 }).points, path.points);
// query interface: points sit exactly at k*dt, midpoints interpolate, ends clamp
for (let k = 0; k < path.points.length; k += 7) assert.ok(near(path.at(k * path.dt), path.points[k]), 'at(k*dt)==points[k]');
assert.deepEqual(path.at(-5), path.start);
assert.deepEqual(path.at(1e9), path.end);
assert.deepEqual(path.at(path.duration), path.end);
const seg = 3, mid = path.at((seg + .5) * path.dt);
assert.ok(near(mid, path.points[seg].map((v, i) => v + (path.points[seg + 1][i] - v) * .5)), 'mid-step lerp');
assert.deepEqual(path.stepAt(4), path.points[4]);
assert.deepEqual(path.stepAt(-3), path.start);
assert.ok(path.length > 0 && Math.abs(path.length - path.points.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - path.points[i][0], p[1] - path.points[i][1], p[2] - path.points[i][2]), 0)) < 1e-12);
// conservation: every step is bounded by the field speed at its origin
for (let i = 1; i < path.points.length; i++) {
  const v = f1.at(...path.points[i - 1], 0);
  const d = Math.hypot(path.points[i][0] - path.points[i - 1][0], path.points[i][1] - path.points[i - 1][1], path.points[i][2] - path.points[i - 1][2]);
  assert.ok(d <= Math.hypot(...v) * path.dt + 1e-9, `step ${i} bounded by field speed`);
}
// out-of-bounds: first outside point is the recorded exit, integration stops there
const bx = f1.trace(0, 1, 0, { steps: 400, dt: .1, bounds: { x0: -2, z0: -2, x1: 2, z1: 2 } });
assert.equal(bx.status, 'exited');
assert.equal(bx.exitIndex, bx.points.length - 1);
assert.ok(bx.end[0] > 2 || bx.end[2] > 2 || bx.end[0] < -2 || bx.end[2] < -2, 'exit point outside bounds');
assert.ok(bx.points.slice(0, -1).every((p) => p[0] >= -2 && p[0] <= 2 && p[2] >= -2 && p[2] <= 2), 'all prior points inside');
assert.deepEqual(bx.at(1e9), bx.end);
// validation parity with traceWind
assert.throws(() => W.traceWindPath(null, null, [0, 0, 0]), TypeError);
assert.throws(() => W.traceWindPath(() => [1, 0, 0], null, [0, 0], {}), RangeError);
assert.throws(() => W.traceWindPath(() => [NaN, 0, 0], null, [0, 0, 0], { steps: 2, dt: .1 }), RangeError);
assert.throws(() => W.makeWindField({ dir: [0, 0, 0] }), RangeError);
assert.throws(() => path.at(NaN), RangeError);
console.log('PASS wind-trajectory pure');

// --- shared World: 通洞/封洞/避障 semantics on both grid families ---
for (const [kind, grid] of [['quad', buildQuadGrid({ radius: 5, seed: 4 })], ['mixed', buildMixedGrid({ radius: 6, seed: 4 })]]) {
  decorateCells(grid);
  const index = buildCellIndex(grid), world = new World(grid);
  // island r<3.2 two levels of rock; tunnel = every cell touching the |z|<.42
  // strip: level 1 open, level 2 floor-ceiling, level 3 roof (straight corridor).
  const isTunnel = (c) => Math.abs(c.cz) < .5 || c.pts.some((p) => Math.abs(p.z) < .42);
  const tunnelCells = [];
  for (const c of world.cells) {
    const r = Math.hypot(c.cx, c.cz);
    if (r < 3.2) { world.fill(c, 2, { rock: true }); if (isTunnel(c)) { world.setSolid(c, 1, false); world.setSolid(c, 3, true); tunnelCells.push(c); } }
  }
  const probes = makeWorldProbes(world, index);
  const windX = () => [1, 0, 0];
  // find the corridor latitude: free at level-1 height with a solid roof one
  // level up, at every x station across the island
  const xs = [-2.6, -1.6, -.6, .4, 1.4, 2.4];
  let zc = null;
  for (let z = -.35; z <= .35; z += .02) if (xs.every((x) => !probes.occupied(x, .3, z) && probes.occupied(x, .8, z))) { zc = z; break; }
  assert.notEqual(zc, null, kind + ' fixture has an open tunnel corridor');
  const seed = [-4.6, .3, zc];
  // a wall latitude: solid level 1 across the whole island span
  let zw = null;
  for (let z = .6; z <= 2.6; z += .02) if (xs.every((x) => probes.occupied(x, .3, z))) { zw = z; break; }
  assert.notEqual(zw, null, kind + ' fixture has a solid wall latitude');

  // 通洞：constant +x flow passes through the level-1 tunnel and emerges
  const through = W.traceWindPath(windX, probes, seed, { steps: 120, dt: .1, levelHeight: .5 });
  assert.ok(through.hitsHole, kind + ' tunnel hit reported');
  assert.ok(through.throughHole, kind + ' tunnel traversal reported');
  assert.ok(through.end[0] > 3, kind + ' emerged downwind of the island ' + through.end);
  assert.ok(through.tunnels.every((t) => t.from <= t.to && t.from > 0));
  for (const t of through.tunnels) for (let i = t.from; i <= t.to; i++) {
    const p = through.points[i];
    assert.equal(probes.occupied(...p), false, kind + ' in-hole point is free at own level');
    assert.equal(probes.occupied(p[0], p[1] + .5, p[2]), true, kind + ' in-hole point has a roof one level up');
  }
  for (const p of through.points) assert.equal(probes.occupied(...p), false, kind + ' trace never inside rock');
  // conservation on shared field too
  for (let i = 1; i < through.points.length; i++) {
    const d = Math.hypot(through.points[i][0] - through.points[i - 1][0], through.points[i][1] - through.points[i - 1][1], through.points[i][2] - through.points[i - 1][2]);
    assert.ok(d <= 1 * .1 + 1e-9, kind + ' step bounded by field speed');
  }
  // determinism under World probes
  assert.deepEqual(W.traceWindPath(windX, probes, seed, { steps: 120, dt: .1 }).points, through.points, kind + ' deterministic');

  // 封洞：same seed, tunnel level sealed → particle rests against the wall
  for (const c of tunnelCells) world.setSolid(c, 1, true);
  const sealed = W.traceWindPath(windX, probes, seed, { steps: 120, dt: .1, levelHeight: .5 });
  assert.equal(sealed.hitsHole, false, kind + ' sealed tunnel admits no particle');
  assert.ok(sealed.blocked > 0, kind + ' particle blocked at the sealed face');
  assert.equal(sealed.status, 'rest', kind + ' ends at rest against the wall');
  assert.ok(sealed.points.every((p) => p[0] < -1 && !probes.occupied(...p)), kind + ' never crosses, never inside');
  // 避障：wall latitude hits solid rock and never tunnels
  const off = W.traceWindPath(windX, probes, [-4.6, .3, zw], { steps: 120, dt: .1, levelHeight: .5 });
  assert.ok(off.blocked > 0 && !off.hitsHole && off.points.every((p) => !probes.occupied(...p) && p[0] < 0), kind + ' rests against the solid face');
  // 解封：same seed traverses again → state follows World bits, not a cache
  for (const c of tunnelCells) world.setSolid(c, 1, false);
  const reopen = W.traceWindPath(windX, probes, seed, { steps: 120, dt: .1, levelHeight: .5 });
  assert.ok(reopen.throughHole && reopen.end[0] > 3, kind + ' reopened tunnel traversable again');

  // shared field: Atmosphere.tracePath + windField() facade, default bounds = coverage
  const scene = new THREE.Scene(), uTime = { value: 0 };
  const atm = new Atmosphere({ scene, levelHeight: .5, uTime });
  atm.rebuild(world, index);
  atm.setWindDirection(0);          // pure +x through the tunnel
  // The layered field lifts the incoming flow over the island (occ blur at the
  // mouth): an outside seed rides the roofline, never enters a roofed cavity.
  const tp = atm.tracePath(seed, { steps: 160, dt: .1 });
  assert.ok(tp instanceof W.WindPath);
  for (const p of tp.points) assert.equal(probes.occupied(...p), false, kind + ' shared trace never inside rock');
  assert.equal(tp.hitsHole, false, kind + ' shared field steers flow over/around, not through the mouth');
  assert.ok(tp.points.some((p) => p[0] > -3.2), kind + ' makes progress downwind');
  // A particle seeded inside the corridor is recorded as a hole hit: free at its
  // level, roof one level up; it creeps along the tunnel and can re-emerge.
  const inside = [-1.5, .3, zc];
  if (!probes.occupied(...inside)) {
    const ih = atm.tracePath(inside, { steps: 300, dt: .1 });
    assert.ok(ih.hitsHole, kind + ' seed inside cavity → hole hit recorded');
    assert.equal(ih.tunnels[0].from, 0);
    for (const p of ih.points) assert.equal(probes.occupied(...p), false, kind + ' cavity trace never inside rock');
    if (ih.points.some((p) => p[0] > 3)) assert.ok(ih.throughHole, kind + ' re-emerged downwind → through hole');
  }
  assert.deepEqual(atm.tracePath(seed, { steps: 160, dt: .1 }).points, tp.points, kind + ' shared trace deterministic');
  const wf = atm.windField();
  assert.deepEqual(wf.dir, [atm.uWind.value.x, atm.uWind.value.y, atm.uWind.value.z]);
  const sv = atm.sample(1, .7, -1);
  assert.deepEqual(wf.at(1, .7, -1), [sv.x, sv.y, sv.z], kind + ' facade at()==sample()');
  const wt = wf.trace(seed, { steps: 20, dt: .1 });
  assert.ok(wt instanceof W.WindPath && wt.points.length === 21, kind + ' facade trace → WindPath');
  // long trace over open water leaves the coverage bounds → exited
  const high = [atm.field.x0 + 1, 2.6, atm.field.z0 + 1];
  if (!probes.occupied(...high)) {
    const ex = atm.tracePath(high, { steps: 400, dt: .1 });
    assert.equal(ex.status, 'exited', kind + ' leaves the coverage bounds');
    assert.equal(ex.exitIndex, ex.points.length - 1);
    const bx1 = atm.field.x0 + atm.field.W * .45, bz1 = atm.field.z0 + atm.field.H * .45;
    assert.ok(ex.end[0] > bx1 || ex.end[2] > bz1 || ex.end[0] < atm.field.x0 || ex.end[2] < atm.field.z0, kind + ' exit recorded outside');
  }
  // sealed through the shared field too: rebuild picks up the new World bits
  for (const c of tunnelCells) world.setSolid(c, 1, true);
  atm.rebuild(world, index);
  const st = atm.tracePath(seed, { steps: 160, dt: .1, bounds: null });
  assert.equal(st.hitsHole, false, kind + ' sealed in shared field: no hole hit');
  assert.ok(st.points.every((p) => !probes.occupied(...p)), kind + ' shared field never leads inside rock');
  // no point inside the sealed tunnel band while crossing the island span
  assert.ok(!st.points.some((p) => Math.abs(p[0]) < 2.6 && Math.abs(p[2] - zc) < .15 && probes.occupied(p[0], p[1] + .5, p[2])), kind + ' does not slip through the sealed corridor');
  console.log('PASS wind-trajectory', kind, { cells: world.cells.length, tunnels: through.tunnels, throughEnd: through.end.map((v) => +v.toFixed(2)), sealedBlocked: sealed.blocked, sharedHole: tp.tunnels.length });
}
console.log('PASS wind-trajectory all');
