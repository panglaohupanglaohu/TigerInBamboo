// 1580158269267406849（第 50 轮，迁自 REACode src/foliageblob.js）：树冠 = metaball 等值面。
// 同一组圆包：kernel 'metaball' 仍是闭合流形；孤立单包半径保持 r；接缝处（跨两包的边）面法线夹角比球体并集小（折痕被抹平）；
// 两包之间的「腰」被鼓起（腰部最窄截面更宽）。passes:0 只看提取本身，不让 seam springs 掺和。
import assert from 'node:assert/strict';
import { buildCanopy } from '../src/core/canopy.js';
const blobs = [{ x: 0, y: .3, z: 0, r: .16 }, { x: .11, y: .25, z: .04, r: .12 }, { x: -.1, y: .26, z: -.03, r: .12 }, { x: .02, y: .4, z: -.02, r: .11 }, { x: 0, y: .24, z: .11, r: .1 }];
const seamAngle = (m) => {   // 接缝边（两侧面最近的包不同）上，相邻两面法线夹角的平均（度）
  const fn = m.triangles.map(([a, b, c]) => { const A = m.positions[a], B = m.positions[b], C = m.positions[c], u = B.map((v, k) => v - A[k]), v = C.map((x, k) => x - A[k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1; return n.map((x) => x / l); });
  const hard = new Set(m.hardEdges.map(([a, b]) => (a < b ? a + ':' + b : b + ':' + a))), faces = new Map();
  m.triangles.forEach((t, f) => { for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3], key = a < b ? a + ':' + b : b + ':' + a; if (!faces.has(key)) faces.set(key, []); faces.get(key).push(f); } });
  let s = 0, n = 0; for (const [key, fs] of faces) if (hard.has(key) && fs.length === 2) { const d = fn[fs[0]].reduce((x, v, k) => x + v * fn[fs[1]][k], 0); s += Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI; n++; }
  return n ? s / n : 0;
};
const U = buildCanopy(blobs, { passes: 0, resolution: 20 }), M = buildCanopy(blobs, { passes: 0, resolution: 20, kernel: 'metaball' });
assert.ok(M.stats.closed, 'metaball 树冠闭合');
const au = seamAngle(U), am = seamAngle(M);
assert.ok(am < au, `接缝折痕变平（并集 ${au.toFixed(1)}° → metaball ${am.toFixed(1)}°）`);
// 单包半径保持
const one = buildCanopy([{ x: 0, y: 0, z: 0, r: 1 }], { passes: 0, resolution: 20, kernel: 'metaball' });
const rs = one.positions.map((p) => Math.hypot(...p)), mean = rs.reduce((a, b) => a + b, 0) / rs.length;
assert.ok(Math.abs(mean - 1) < 0.05, `孤立单包半径 ≈ r（${mean.toFixed(3)}）`);
// 两包之间的腰：x=0 截面上 y 方向最大半宽
const pair = [{ x: -.6, y: 0, z: 0, r: .5 }, { x: .6, y: 0, z: 0, r: .5 }];
const waist = (m) => Math.max(...m.positions.filter((p) => Math.abs(p[0]) < .06).map((p) => Math.hypot(p[1], p[2])), 0);
const wu = waist(buildCanopy(pair, { passes: 0, resolution: 24 })), wm = waist(buildCanopy(pair, { passes: 0, resolution: 24, kernel: 'metaball' }));
assert.ok(wm > wu + .05, `两包之间鼓起相连（腰半宽 并集 ${wu.toFixed(2)} → metaball ${wm.toFixed(2)}）`);
assert.throws(() => buildCanopy(blobs, { kernel: 'cards' }), RangeError);
console.log('PASS metaball 树冠：闭合、单包半径不变、接缝折痕变平、两包之间鼓起相连', JSON.stringify({ seamUnion: +au.toFixed(1), seamMeta: +am.toFixed(1), waistUnion: +wu.toFixed(2), waistMeta: +wm.toFixed(2), tris: M.stats.triangles }));
