// 1481661852887265288: chunky painted normals applied to shared World / mesh normals.
import assert from 'node:assert/strict';
import { buildQuadGrid } from '../src/core/grid.js';
import { decorateCells } from '../src/core/spatial.js';
import { World } from '../src/core/world.js';
import { generateTerrain } from '../src/terrain/generate.js';
import { paintNormal, decodeTexel, sampleWorldPlanar, perturbNormal, paintMeshNormals, shadeWithNormals, shadeWorldTops, auditPaintNormal } from '../src/core/paint-normal.js';
const map = paintNormal({ size: 96, chunks: 16, seed: 7 });
assert.deepEqual(map.rgb, paintNormal({ size: 96, chunks: 16, seed: 7 }).rgb, 'seeded');
assert.equal(map.chunks, 16);
// Chunky: texels in the same chunk share a normal except a thin softened rim.
const ids = new Set(map.chunkId); assert.equal(ids.size, 16, 'all chunks own texels');
let interior = 0, same = 0; const s = map.size;
for (let y = 0; y < s; y++) for (let x = 1; x < s; x++) { const i = y * s + x; if (map.chunkId[i] !== map.chunkId[i - 1]) continue; interior++; if ([0, 1, 2].every((k) => Math.abs(map.rgb[i * 3 + k] - map.rgb[(i - 1) * 3 + k]) <= 1)) same++; }
assert(same / interior > 0.85, 'flat inside chunks: ' + (same / interior).toFixed(3));
// Tilt bounded by maxTiltDeg, never below horizon
for (let i = 0; i < s * s; i++) { const n = decodeTexel(map, i); assert(n[2] > Math.cos((27 * Math.PI) / 180) - 0.02); }
// Periodic: world lookup tiles exactly
assert.deepEqual(sampleWorldPlanar(map, 1.3, 2.7, 4), sampleWorldPlanar(map, 1.3 + 8, 2.7 - 4, 4));
// Perturbation keeps unit length; identity sample returns geometric normal for any orientation
for (const n of [[0, 1, 0], [1, 0, 0], [0, 0, -1], [.3, .8, .2]]) { const nl = Math.hypot(...n), p = perturbNormal(n, [0, 0, 1]); assert(p.every((v, k) => Math.abs(v - n[k] / nl) < 1e-9)); assert(Math.abs(Math.hypot(...perturbNormal(n, [.3, .2, .93])) - 1) < 1e-9); }
// Mesh: positions untouched, normals changed, each stays within the tilt cone of its face normal
const pos = new Float32Array([0, 1, 0, 3, 1, 2, 5, 1, 7, 2, 0.5, 0, 2, 3, 1]), nrm = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1]), posBefore = pos.slice();
const out = paintMeshNormals(map, pos, nrm, { scale: 4 }); assert.deepEqual(pos, posBefore, 'silhouette (positions) unchanged');
for (let i = 0; i < out.length; i += 3) { const dot = out[i] * nrm[i] + out[i + 1] * nrm[i + 1] + out[i + 2] * nrm[i + 2]; assert(dot > Math.cos((27 * Math.PI) / 180) - 0.02 && dot <= 1 + 1e-9); }
// Plane shading: geometry flat, shading varies (the clip's point)
const lit = shadeWithNormals(map); let mn = Infinity, mx = -Infinity; for (const v of lit) { mn = Math.min(mn, v); mx = Math.max(mx, v); } assert(mx - mn > 0.15);
const audit = auditPaintNormal({ size: 64 }); assert(audit.rows.every((r) => r.litStd > 0.05 && r.pctPixelsChanged > 40 && r.silhouetteChange === 0 && r.meanTiltDeg > 8 && r.meanTiltDeg < 26));
// Shared World: flat terrace tops get varied painted shading, deterministic per position
const w = new World(decorateCells(buildQuadGrid({ radius: 10 }))); generateTerrain(w, { seed: 7, rivers: 0, caves: 0 });
const t = shadeWorldTops(w, map, { scale: 3 }); assert.equal(t.cells.length, w.cells.filter((c) => w.top(c)).length);
assert(t.stats.std > 0.03, 'tops no longer one flat tone: ' + t.stats.std); assert.deepEqual(shadeWorldTops(w, map, { scale: 3 }).painted, t.painted);
assert.throws(() => paintNormal({ maxTiltDeg: 90 }), RangeError); assert.throws(() => perturbNormal([0, 0, 0], [0, 0, 1]), RangeError); assert.throws(() => paintMeshNormals(map, pos, nrm.slice(3)), RangeError);
console.log('PASS chunky painted normals: chunk-flat, tiling, mesh perturb w/o moving vertices, World top variation', JSON.stringify({ sameInChunk: +(same / interior).toFixed(3), worldTopStd: +t.stats.std.toFixed(3), audit: audit.rows.map((r) => [r.chunks, +r.litStd.toFixed(3), +r.meanTiltDeg.toFixed(1)]) }));
