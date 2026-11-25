/**
 * R34 演示页：拱洞精细门户（nav-arch-demo.html）。俯视画 ARCH_ISLAND（一道墙、两个拱洞），左右两栏同一个兵斜着进拱：
 *   左「关精细门户」（换件前的行为）：门户 = 整条格边，身体会擦进拱脚（红点 = 用「开」的判据看，这一帧身体在墙里）；
 *   右「开精细门户」（R34）：门户按拱下几何收窄（绿线），两侧形变侧壁（橙线），身体始终在净宽里。
 * 数字全部来自 nav-lab.finePortalReport / BattleNavigation；页面只负责画。结果挂在 window.__navDemo 供端到端读取。
 *   ?h=0.34   身高（舞台单位，默认 0.34 = 1.7 m ÷ 5 m/格）
 */
import { asciiWorld, ARCH_ISLAND, makeNav, simulateWalk, finePortalReport, BODY_RADIUS } from './nav-lab.js?v=nav-r1';

const q = new URLSearchParams(location.search), H = Number(q.get('h')) > 0 ? Number(q.get('h')) : .34, S = 56;
const env = asciiWorld(ARCH_ISLAND), report = finePortalReport(env, { unitHeight: H });
const off = makeNav(env, { finePortals: false, unitHeight: H }), on = makeNav(env, { finePortals: true, unitHeight: H });
const arch = on.graph.nodes.find((n) => on.fine.under[n.id]?.kind === 'arch'), A = arch.cell, under = on.fine.under[arch.id];
const from = env.at(A.i, A.j - 1), to = env.at(A.i, A.j + 2);   // 拱南边一格 → 拱北边两格
const startOffset = { dx: .45, dz: .2 };   // 斜着进拱：起点贴到拱脚那一侧（离拱口 0.3 格、偏东 0.45 格）

function track(nav) {
  const u = { x: from.cx + startOffset.dx, z: from.cz + startOffset.dz, navFloor: 1, radius: BODY_RADIUS, goal: to, goalFloor: 1 }, pts = [];
  const sim = simulateWalk(env, nav, [u], { frames: 600, lanes: false, separation: false, onFrame: (v) => { const node = on.unitNode(v); pts.push({ x: v.x, z: v.z, clip: !node || !on.discFits(node, v.x, v.z, BODY_RADIUS) }); } });
  return { pts, arrived: u.arrived, frames: sim.frames, clips: pts.filter((p) => p.clip).length };
}
const runs = { off: track(off), on: track(on) };

function draw(canvas, kind, upto) {
  const g = canvas.getContext('2d'), W = env.cols * S, Hh = env.rows * S;
  canvas.width = W; canvas.height = Hh;
  const X = (x) => (x + .5) * S, Z = (z) => (z + .5) * S;
  g.fillStyle = '#cfe3c4'; g.fillRect(0, 0, W, Hh);
  for (const c of env.world.cells) {
    const top = env.world.top(c), hollow = env.world.isSolid(c, 1) && !env.world.isSolid(c, 2) && top > 2;
    if (top >= 6 && !hollow) { g.fillStyle = '#6b5f7a'; g.fillRect(X(c.cx - .5), Z(c.cz - .5), S, S); }
    if (hollow) { g.fillStyle = '#b9a9c9'; g.fillRect(X(c.cx - .5), Z(c.cz - .5), S, S); }
  }
  g.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i <= env.cols; i++) { g.beginPath(); g.moveTo(i * S, 0); g.lineTo(i * S, Hh); g.stroke(); } for (let j = 0; j <= env.rows; j++) { g.beginPath(); g.moveTo(0, j * S); g.lineTo(W, j * S); g.stroke(); }
  if (kind === 'on') {
    for (const n of on.graph.nodes) {
      const u = on.fine.under[n.id]; if (!u || u.kind !== 'arch') continue;
      g.strokeStyle = '#e08a2e'; g.lineWidth = 3; for (const [a, b] of u.sideWalls) { g.beginPath(); g.moveTo(X(a.x), Z(a.z)); g.lineTo(X(b.x), Z(b.z)); g.stroke(); }
      for (const [e] of u.open) { const f = on.fine.aperture(n.id, e); if (!f?.p) continue; g.strokeStyle = '#2e9b57'; g.lineWidth = 4; g.beginPath(); g.moveTo(X(f.p.x), Z(f.p.z)); g.lineTo(X(f.q.x), Z(f.q.z)); g.stroke(); }
    }
  }
  const r = runs[kind], n = Math.min(upto, r.pts.length);
  g.lineWidth = 2; g.strokeStyle = kind === 'on' ? '#1f6fb5' : '#7a4b2a'; g.beginPath();
  for (let k = 0; k < n; k++) { const p = r.pts[k]; if (k) g.lineTo(X(p.x), Z(p.z)); else g.moveTo(X(p.x), Z(p.z)); } g.stroke();
  for (let k = 0; k < n; k++) { const p = r.pts[k]; if (!p.clip) continue; g.fillStyle = '#d33'; g.beginPath(); g.arc(X(p.x), Z(p.z), 3, 0, Math.PI * 2); g.fill(); }
  const p = r.pts[Math.max(0, n - 1)];
  if (p) { g.fillStyle = p.clip ? 'rgba(220,50,50,.55)' : 'rgba(31,111,181,.45)'; g.beginPath(); g.arc(X(p.x), Z(p.z), BODY_RADIUS * S, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#123'; g.lineWidth = 1; g.stroke(); }
}

const $ = (id) => document.getElementById(id);
function stats() {
  $('stat-off').textContent = `关精细门户：${runs.off.arrived ? '到达' : '未到'} · ${runs.off.frames} 帧 · 身体擦进拱脚 ${runs.off.clips} 帧`;
  $('stat-on').textContent = `开精细门户：${runs.on.arrived ? '到达' : '未到'} · ${runs.on.frames} 帧 · 身体擦进拱脚 ${runs.on.clips} 帧`;
  $('stat-all').textContent = `身高 ${H} · 拱下节点 ${report.fine.archNodes} · 收窄门户 ${report.fine.narrowed}（平均收窄 ${(report.fine.meanNarrowing * 100).toFixed(1)}%）· 侧壁 ${report.fine.sideWalls} · 穿墙探针 ${report.probes.probes} 处：关时放得下 ${report.probes.offFits}、开后拦下 ${report.probes.offFitsOnBlocked}`;
}
let frame = 0, raf = 0;
const total = Math.max(runs.off.pts.length, runs.on.pts.length);
function tick() {
  frame = Math.min(total, frame + 3); draw($('cv-off'), 'off', frame); draw($('cv-on'), 'on', frame);
  globalThis.__navDemo.frame = frame; globalThis.__navDemo.done = frame >= total;
  if (frame < total) raf = requestAnimationFrame(tick);
}
globalThis.__navDemo = { ready: true, done: false, frame: 0, total, unitHeight: H, report, arch: { cell: A.id, u0: under.u0 },
  off: { arrived: runs.off.arrived, frames: runs.off.frames, clips: runs.off.clips }, on: { arrived: runs.on.arrived, frames: runs.on.frames, clips: runs.on.clips },
  jump(to) { cancelAnimationFrame(raf); frame = Math.max(0, Math.min(total, to | 0)); draw($('cv-off'), 'off', frame); draw($('cv-on'), 'on', frame); this.frame = frame; this.done = frame >= total; } };
stats();
$('replay').onclick = () => { cancelAnimationFrame(raf); frame = 0; tick(); };
if (q.get('static') === '1') globalThis.__navDemo.jump(total); else tick();
