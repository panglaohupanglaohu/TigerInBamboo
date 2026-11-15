// 972829402873716737（第 50 轮，迁自 REACode src/triflowfield.js）：面级流场 → 通口 → 漏斗拉直。
// 共享导航面（三层台地 + 两条坡道）上：漏斗 + 视线捷径比逐边中点路径短、拐弯不多，全程在导航面内（不跨崖缝），同层无遮挡时就是直线。
import assert from 'node:assert/strict';
import { navMeshFromTerraces, buildPolyField, portalsAlong, funnelPath, midpointPath, pathStats, locate, shortcutPath } from '../src/world/navmesh-flow.js';
const levelAt = (i, j) => { if (i <= 6) return 1; if (i === 7) return j === 5 || j === 6 ? 1 : null; if (j >= 8 && i >= 12) return j === 8 ? (i === 14 || i === 15 ? 2 : null) : 3; return 2; };
const rampAt = (i, j) => (i === 7 && (j === 5 || j === 6) ? 'x+' : j === 8 && (i === 14 || i === 15) ? 'z+' : false);
const mesh = navMeshFromTerraces({ nx: 18, nz: 12, size: 1, L: 0.6, levelAt, rampAt });
const out = {};
for (const [name, s, g] of [['上一层', [0.5, 1.2], [12.3, 3.1]], ['上两层', [0.6, 10.5], [13.4, 10.6]], ['同层', [0.5, 0.5], [6.2, 11.4]]]) {
  const F = buildPolyField(mesh, locate(mesh, g[0], g[1]), g);
  const P = portalsAlong(mesh, F, s, g); assert.ok(P && P.length > 3, `${name} 有通口序列`);
  const fun = shortcutPath(mesh, funnelPath(P)), mid = midpointPath(P), a = pathStats(fun), b = pathStats(mid), straight = Math.hypot(g[0] - s[0], g[1] - s[1]);
  assert.ok(a.length < b.length, `${name} 漏斗比逐边中点短（${a.length.toFixed(2)} < ${b.length.toFixed(2)}）`);
  assert.ok(a.turns <= b.turns, `${name} 拐弯不多于逐边中点（${a.turns} ≤ ${b.turns}）`);
  assert.ok(a.length >= straight - 1e-9, '不短于直线');
  // 全程在导航面内（逐 0.05 采样）；换层只经坡道列
  for (let i = 1; i < fun.length; i++) { const [x0, z0] = fun[i - 1], [x1, z1] = fun[i], n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; assert.ok(locate(mesh, x, z) >= 0, `${name} 路径点在导航面内 (${x.toFixed(2)},${z.toFixed(2)})`); } }
  out[name] = { funnel: +a.length.toFixed(2), funnelTurns: a.turns, midpoint: +b.length.toFixed(2), midTurns: b.turns, straight: +straight.toFixed(2) };
}
assert.ok(Math.abs(out['同层'].funnel - out['同层'].straight) < 1e-6 && out['同层'].funnelTurns === 0, '同层无遮挡：走廊选对 → 漏斗 = 直线');
console.log('PASS 导航面漏斗拉直：比逐边中点短、拐弯少、全程在面内', JSON.stringify(out));
