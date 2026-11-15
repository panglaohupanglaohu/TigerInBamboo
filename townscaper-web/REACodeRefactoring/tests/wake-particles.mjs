// r53 G4: REACode wake.js — Kelvin-angle broadside foam, faint central veil, bow spray,
// world-space V left behind after a turn, and live Boats wiring.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { makeWakeParticles, KELVIN } = await import('../src/core/wake-sampling.js');
const { Boats } = await import('../src/life/boats.js');

for (const target of [KELVIN, 25]) {
  const w = makeWakeParticles({ angle: target, rate: 300, seed: 3 });
  const ship = { id: 0, x: 0, z: 0, dx: 1, dz: 0, speed: 2, len: 2.3, beam: .64 };
  for (let i = 0; i < 180; i++) { w.step(1 / 60, [ship]); ship.x += ship.speed / 60; }
  const m = w.measureAngle(ship);
  assert.ok(Math.abs(m.angleDeg - target) < 2.5, `edge angle ${m.angleDeg} ≈ ${target}`);
  assert.ok(w.foam.some((p) => p.veil) && w.foam.filter((p) => p.veil).length < w.foam.length * .45, 'veil is a minority');
  const edge = w.foam.filter((p) => !p.veil), veil = w.foam.filter((p) => p.veil);
  assert.ok(edge.reduce((s, p) => s + p.shade, 0) / edge.length > 2 * veil.reduce((s, p) => s + p.shade, 0) / veil.length, 'bright edges, faint centre');
  assert.ok(w.spray.length > 0 && w.spray.length < w.foam.length / 10, 'few spray chips');
  console.log('PASS wake angle', target.toFixed(2), '→', m.angleDeg.toFixed(2), 'samples', m.samples);
}
// turn: old foam keeps moving on its own heading (world space), no new foam on the old line
const w = makeWakeParticles({ rate: 200, seed: 9 }), ship = { id: 1, x: 0, z: 0, dx: 1, dz: 0, speed: 2, len: 2, beam: .5 };
for (let i = 0; i < 60; i++) { w.step(1 / 60, [ship]); ship.x += 2 / 60; }
const old = w.foam.slice(0, 20).map((p) => [p.x, p.z, p.vx, p.vz]);
ship.dx = 0; ship.dz = 1;
for (let i = 0; i < 10; i++) w.step(1 / 60, [ship]);
for (let k = 0; k < 20; k++) { const p = w.foam[k]; if (!p) break; assert.equal(p.vx, old[k][2]); assert.ok(Math.abs(p.x - old[k][0] - old[k][2] * 10 / 60) < 1e-9); }
// stopped ship emits nothing; death after life
const quiet = makeWakeParticles();
quiet.step(1, [{ id: 0, x: 0, z: 0, dx: 1, dz: 0, speed: 0, len: 1, beam: .2 }]);
assert.equal(quiet.emitted, 0);
assert.throws(() => quiet.step(.1, [{ id: 0, x: 0, z: 0, dx: 2, dz: 0, speed: 1, len: 1, beam: .2 }]));
for (let i = 0; i < 300; i++) w.step(1 / 30, []);
assert.equal(w.foam.length, 0); assert.equal(w.spray.length, 0);

// live Boats: particles follow boat poses, buffers mirror simulation
const scene = new THREE.Scene(), uTime = { value: 0 }, boats = new Boats({ scene, uTime });
boats.refresh((x, z) => Math.hypot(x, z) < 3, 6, 2);
for (let i = 0; i < 120; i++) { uTime.value += 1 / 30; boats.update(1 / 30); }
const n = boats.foamPoints.geometry.drawRange.count;
assert.ok(n > 50 && boats.sprayPoints.geometry.drawRange.count > 0, 'foam + spray drawn ' + n);
const last = boats.wakeFx.foam.at(-1), P = boats.foamPoints.geometry.attributes.position.array;
assert.ok(Math.abs(P[(n - 1) * 3] - last.x) < 1e-5 && Math.abs(P[(n - 1) * 3 + 2] - last.z) < 1e-5);
for (const p of boats.wakeFx.foam) assert.ok(Math.hypot(p.x, p.z) > 3, 'wake stays on water');
boats.refresh((x, z) => Math.hypot(x, z) < 3, 6, 2);
assert.equal(boats.wakeFx.foam.length, 0, 'refresh clears stale particles');
console.log('PASS wake particles + Boats', { foam: n });
