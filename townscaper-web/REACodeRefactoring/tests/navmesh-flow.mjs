// 导航面内连续流场 + 百人群体（816748103193817088 "I'm flowing right on the nav mesh, so it depends"）。
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { navMeshFromTerraces, buildVertexField, flowAt, stepCrowd, locate, heightAt } from '../src/world/navmesh-flow.js';

// 片中那种地形：下层台地（左）—— 2 格宽坡道 —— 上层台地（右），上层再经另一条坡道到第三层（右上）
const nx = 18, nz = 12;
const levelAt = (i, j) => {
  if (i <= 6) return 1;
  if (i === 7) return j === 5 || j === 6 ? 1 : null;          // 坡道列：只有两格坡，其余是崖
  if (j >= 8 && i >= 12) return j === 8 ? (i === 14 || i === 15 ? 2 : null) : 3;   // 第三层 + 坡
  return 2;
};
const rampAt = (i, j) => (i === 7 && (j === 5 || j === 6) ? 'x+' : j === 8 && (i === 14 || i === 15) ? 'z+' : false);
const mesh = navMeshFromTerraces({ nx, nz, size: 1, L: 0.6, levelAt, rampAt });
assert.ok(mesh.polys.length > 150, '导航面');
// 坡道与上下平台连通
const rampPoly = locate(mesh, 7.5, 5.5);
assert.ok(rampPoly >= 0 && mesh.polys[rampPoly].nb.filter((q) => q >= 0).length >= 3, '坡道连着上下平台和旁边那块坡');
assert.ok(Math.abs(heightAt(mesh, rampPoly, 7.5, 5.5) - 0.9) < 1e-6, '坡面中点高度 = 1.5 层');

function run(goal, start, n = 100, T = 60, dt = 1 / 30) {
  const field = buildVertexField(mesh, { goal });
  const agents = [];
  for (let k = 0; k < n; k++) { const x = start.x + (k % 10) * 0.32 + 0.1, z = start.z + Math.floor(k / 10) * 0.32 + 0.1, poly = locate(mesh, x, z); agents.push({ x, z, poly, y: heightAt(mesh, poly, x, z) }); }
  const trails = agents.map((a) => [[a.x, a.z]]);
  const reached = (a) => Math.hypot(a.x - goal.x, a.z - goal.z) < goal.r + 1.6 && (goal.y == null || a.y > goal.y - 1e-6);
  let left = 0, maxDy = 0, t = 0, crossOutside = 0, maxTurn = 0;
  const prevDir = agents.map(() => null);
  for (; t < T; t += dt) {
    const px = agents.map((a) => a.x), pz = agents.map((a) => a.z);
    const s = stepCrowd(mesh, field, agents, dt, { speed: 1.4 });
    left += s.left; maxDy = Math.max(maxDy, s.maxDy);
    agents.forEach((a, k) => {
      if (px[k] < 7.5 !== a.x < 7.5 && !(a.z > 5 && a.z < 7)) crossOutside++;   // 只能经坡道换层
      const dx = a.x - px[k], dz = a.z - pz[k], l = Math.hypot(dx, dz);
      if (l > 1e-3 && Math.hypot(a.x - goal.x, a.z - goal.z) > goal.r + 1) { const d = [dx / l, dz / l]; if (prevDir[k]) maxTurn = Math.max(maxTurn, Math.acos(Math.max(-1, Math.min(1, d[0] * prevDir[k][0] + d[1] * prevDir[k][1])))); prevDir[k] = d; }
      if (Math.round(t / dt) % 6 === 0) trails[k].push([a.x, a.z]);
    });
    if (agents.every(reached)) break;
  }
  const arrived = agents.filter(reached).length;
  let minSep = 1e9; for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) minSep = Math.min(minSep, Math.hypot(agents[i].x - agents[j].x, agents[i].z - agents[j].z));
  return { field, agents, trails, arrived, left, maxDy, t: +t.toFixed(1), crossOutside, maxTurnDeg: +(maxTurn * 180 / Math.PI).toFixed(1), minSep: +minSep.toFixed(3) };
}
// ① 下层 → 上层圆圈
const A = run({ x: 12, z: 3, r: 1.2, y: 1.2 }, { x: 0.5, z: 1 });
assert.equal(A.arrived, 100, `百人全部到达（${A.arrived}）`);
assert.equal(A.left, 0, '没人走出导航面');
assert.equal(A.crossOutside, 0, '只经坡道换层');
assert.ok(A.maxDy < 0.12, `高度连续（单步最大 ${A.maxDy.toFixed(3)}）`);
assert.ok(A.minSep > 0.08, `不重叠（最近 ${A.minSep}）`);
// ② 目标换到第三层（片中目标换层后整体转向，穿两条坡道）
const B = run({ x: 13.5, z: 10.5, r: 1.0, y: 1.8 }, { x: 0.5, z: 7.5 }, 100, 90);
assert.equal(B.arrived, 100, `换层目标全部到达（${B.arrived}）`);
assert.equal(B.left, 0); assert.equal(B.crossOutside, 0);
assert.ok(B.agents.every((a) => a.y > 1.79), '到第三层（y = 3 × 0.6）');
// ③ 流向在面内 / 过边连续：沿一条线密采样，相邻样本方向差小
let maxJump = 0, prev = null;
for (let x = 0.3; x < 6.7; x += 0.05) { const p = locate(mesh, x, 2.2); const f = flowAt(mesh, A.field, p, x, 2.2); if (prev) maxJump = Math.max(maxJump, Math.acos(Math.max(-1, Math.min(1, f[0] * prev[0] + f[1] * prev[1])))); prev = f; }
assert.ok(maxJump * 180 / Math.PI < 30, `流向连续（最大跳 ${(maxJump * 180 / Math.PI).toFixed(1)}°）`);

// 俯视图：导航面（按层着色）+ 两次轨迹
function png(w, h, rgb) {
  const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const ch = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d])), 8 + d.length); return b; };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
const S = 40, W = nx * S, H = nz * S, img = new Uint8Array(W * H * 3).fill(40);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = locate(mesh, (x + .5) / S, (y + .5) / S); if (p < 0) continue; const h = heightAt(mesh, p, (x + .5) / S, (y + .5) / S); const g = 90 + h * 60; img.set([g, g, g * 1.05], (y * W + x) * 3); }
const dot = (x, z, c) => { const px = Math.round(x * S), py = Math.round(z * S); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const X = px + a, Y = py + b; if (X >= 0 && Y >= 0 && X < W && Y < H) img.set(c, (Y * W + X) * 3); } };
for (const tr of A.trails) for (const [x, z] of tr) dot(x, z, [90, 170, 230]);
for (const tr of B.trails) for (const [x, z] of tr) dot(x, z, [240, 170, 80]);
writeFileSync(new URL('../artifacts/coverage/navmesh-flow-trails.png', import.meta.url), png(W, H, img));
console.log('PASS 导航面内连续流场：百人经坡道换层全部到达、不出面、高度连续、不重叠、流向连续', JSON.stringify({ polys: mesh.polys.length, A: { t: A.t, maxDy: +A.maxDy.toFixed(3), minSep: A.minSep, maxTurnDeg: A.maxTurnDeg }, B: { t: B.t, minSep: B.minSep }, flowJumpDeg: +(maxJump * 180 / Math.PI).toFixed(1) }));
