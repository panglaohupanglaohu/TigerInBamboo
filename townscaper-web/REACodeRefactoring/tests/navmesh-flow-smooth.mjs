// 导航面流向：逐面常量梯度 → 共边带混合（跨面换向拉到 0 附近，人群轨迹不再有折线感）
// 816748103193817088 第 47 轮记的缺口：948 条共面边采样 p90=0.39 / max=1.08 rad 的跨面换向。
import assert from 'node:assert/strict';
import { navMeshFromTerraces, buildVertexField, buildFaceDirs, faceGradient, flowAt, stepCrowd, locate, heightAt, insidePoly } from '../src/world/navmesh-flow.js';

const nx = 18, nz = 12;
const levelAt = (i, j) => {
  if (i <= 6) return 1;
  if (i === 7) return j === 5 || j === 6 ? 1 : null;
  if (j >= 8 && i >= 12) return j === 8 ? (i === 14 || i === 15 ? 2 : null) : 3;
  return 2;
};
const rampAt = (i, j) => (i === 7 && (j === 5 || j === 6) ? 'x+' : j === 8 && (i === 14 || i === 15) ? 'z+' : false);
const mesh = navMeshFromTerraces({ nx, nz, size: 1, L: 0.6, levelAt, rampAt });
const goal = { x: 12, z: 3, r: 1.2 };
const field = buildVertexField(mesh, { goal });
const fd = buildFaceDirs(mesh, field);

const dot = (a, b) => Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
const angDeg = (a, b) => Math.acos(dot(a, b)) * 180 / Math.PI;
const quant = (arr, q) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// ── 跨共面边的方向差：边中点两侧各自取流向 ────────────────────────────────────────
function edgeDiscontinuity(band) {
  const gaps = []; let edges = 0;
  for (const p of mesh.polys) {
    for (let i = 0; i < p.vs.length; i++) {
      const q = p.nb[i]; if (q < 0 || q <= p.id) continue;      // 每条共享边只算一次
      const a = mesh.verts[p.vs[i]], b = mesh.verts[p.vs[(i + 1) % p.vs.length]];
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const f1 = flowAt(mesh, field, p.id, mx, mz, band ? fd : null);
      const f2 = flowAt(mesh, field, q, mx, mz, band ? fd : null);
      // 目标圆内 / 退化面（顶点距离全 0，方向本就无定义）不算
      if ((f1[0] === 0 && f1[1] === 0) || (f2[0] === 0 && f2[1] === 0)) continue;
      edges++; gaps.push(angDeg(f1, f2));
    }
  }
  return { edges, p50: quant(gaps, .5), p90: quant(gaps, .9), max: Math.max(...gaps) };
}
const faceQ = edgeDiscontinuity(false), blendQ = edgeDiscontinuity(true);
console.log('共面边两侧流向差（度）', JSON.stringify({
  逐面常量: { edges: faceQ.edges, p50: +faceQ.p50.toFixed(2), p90: +faceQ.p90.toFixed(2), max: +faceQ.max.toFixed(2) },
  共边带混合: { edges: blendQ.edges, p50: +blendQ.p50.toFixed(2), p90: +blendQ.p90.toFixed(2), max: +blendQ.max.toFixed(2) },
}));
assert.ok(faceQ.edges > 200, `共面边采样数（${faceQ.edges}）`);
assert.ok(faceQ.p90 > 5, `旧口径确有跨面换向（p90 ${faceQ.p90.toFixed(2)}°）`);
assert.ok(blendQ.p90 < 0.5, `共边带 p90 应趋 0（${blendQ.p90.toFixed(3)}°）`);
assert.ok(blendQ.max < 2, `共边带 max 应趋 0（${blendQ.max.toFixed(3)}°）`);

// ── 面内 / 沿直线采样：不再有折点 ────────────────────────────────────────────────
function lineJump(useBlend, z) {
  let maxJump = 0, prev = null, n = 0, at = null;
  for (let x = 0.3; x < 6.7; x += 0.02) {
    const p = locate(mesh, x, z); if (p < 0) continue;
    const f = flowAt(mesh, field, p, x, z, useBlend ? fd : null); n++;
    if (f[0] === 0 && f[1] === 0) { prev = null; continue; }
    if (prev) { const j = angDeg(f, prev); if (j > maxJump) { maxJump = j; at = +x.toFixed(2); } }
    prev = f;
  }
  return { maxJump, n, at };
}
const jFace = lineJump(false, 2.2), jBlend = lineJump(true, 2.2);
console.log('沿 z=2.2 直线采样最大跳（度）', JSON.stringify({ 逐面常量: { max: +jFace.maxJump.toFixed(2), at: jFace.at }, 共边带混合: { max: +jBlend.maxJump.toFixed(2), at: jBlend.at } }));
assert.ok(jBlend.maxJump < jFace.maxJump * 0.5, `面内折点减半：${jFace.maxJump.toFixed(2)}° → ${jBlend.maxJump.toFixed(2)}°`);
assert.ok(jBlend.maxJump < 8, `已无明显折点（${jBlend.maxJump.toFixed(2)}° @ x=${jBlend.at}）`);

// ── 崖边保持逐面精确：贴着崖边（nb=-1）时仍走逐面方向（顶点插值会在这里把人顶死）──
let cliffChecked = 0;
for (const p of mesh.polys) {
  const i = p.nb.indexOf(-1); if (i < 0) continue;
  const a = mesh.verts[p.vs[i]], b = mesh.verts[p.vs[(i + 1) % p.vs.length]];
  const mx = a.x + (b.x - a.x) * 0.5, mz = a.z + (b.z - a.z) * 0.5;
  const back = 0.02, dx = p.cx - mx, dz = p.cz - mz, l = Math.hypot(dx, dz);
  const px = mx + dx / l * back, pz = mz + dz / l * back;
  if (!insidePoly(mesh, p, px, pz)) continue;
  const fb = flowAt(mesh, field, p.id, px, pz, fd), ff = flowAt(mesh, field, p.id, px, pz, null);
  if (ff[0] === 0 && ff[1] === 0) continue;
  cliffChecked++;
  assert.ok(angDeg(fb, ff) < 25, `崖边 0.02 处仍接近逐面方向（差 ${angDeg(fb, ff).toFixed(1)}°）`);
}
assert.ok(cliffChecked > 20, `崖边采样点数（${cliffChecked}）`);

// ── 群体：换了流向之后百人照样全部到达、不出面、高度连续 ────────────────────────────
function run(useBlend) {
  const agents = [];
  for (let k = 0; k < 100; k++) { const x = 0.5 + (k % 10) * 0.32 + 0.1, z = 1 + Math.floor(k / 10) * 0.32 + 0.1, poly = locate(mesh, x, z); agents.push({ x, z, poly, y: heightAt(mesh, poly, x, z) }); }
  const d0 = agents.reduce((s, a) => s + Math.hypot(a.x - goal.x, a.z - goal.z), 0) / agents.length;
  let left = 0, maxDy = 0, t = 0, polySw = 0;
  const prevPoly = agents.map((a) => a.poly);
  for (; t < 40; t += 1 / 30) {
    const s = stepCrowd(mesh, field, agents, 1 / 30, { speed: 1.4, faceDirs: useBlend ? fd : null });
    left += s.left; maxDy = Math.max(maxDy, s.maxDy);
    agents.forEach((a, k) => { if (a.poly !== prevPoly[k]) { polySw++; prevPoly[k] = a.poly; } });
    if (agents.every((a) => Math.hypot(a.x - goal.x, a.z - goal.z) < goal.r + 1.6)) break;
  }
  const d1 = agents.reduce((s, a) => s + Math.hypot(a.x - goal.x, a.z - goal.z), 0) / agents.length;
  return { t: +t.toFixed(1), left, maxDy: +maxDy.toFixed(4), d0: +d0.toFixed(2), d1: +d1.toFixed(2), polySw };
}
const Rf = run(false), Rb = run(true);
console.log('群体收敛', JSON.stringify({ 逐面常量: Rf, 共边带混合: Rb }));
assert.equal(Rb.left, 0, '不出面');
assert.ok(Rb.maxDy < 0.12, `高度连续（${Rb.maxDy}）`);
assert.ok(Rb.d1 < 1.0, `全部进入目标圈（平均 ${Rb.d1}）`);
assert.ok(Rb.t < Rf.t * 1.35, `收敛时间不劣化（${Rf.t}s → ${Rb.t}s）`);
assert.ok(Rb.polySw <= Rf.polySw * 1.3, `换面抖动不增加（${Rf.polySw} → ${Rb.polySw}）`);

console.log('PASS 导航面流向共边带混合：跨面 p90', faceQ.p90.toFixed(2), '° →', blendQ.p90.toFixed(3), '°；max', faceQ.max.toFixed(2), '° →', blendQ.max.toFixed(3), '°；百人', Rb.t + 's', '全到');
