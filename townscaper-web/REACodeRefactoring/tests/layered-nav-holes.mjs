// 第 53 批 G5 · 906425294533394432「It's like navigating a Swiss cheese」/ 797119718477991936「Got some basic navigation going」。
// 对照 REACode cheesenav（可站 = 空气 + 脚下实心 + 头顶净空）、holenav（门洞图 + 门洞加价 + 封门后不连通）、
// voxelnav（同一柱子多层节点；单值高度图 = 二维对照会丢掉洞道连通）。全部在共享 World + BattleNavigation 上量。
import assert from 'node:assert/strict';
import { stripWorld } from './fixtures/g5-battle.mjs';
import { BattleNavigation } from '../src/world/battle-navigation.js';
import { buildNav } from '../src/world/navgraph.js';
const L = .5;
const make = ({ arch = true, gap = false, doorCost } = {}) => {
  const S = stripWorld(7, 3); for (const c of S.cells) S.world.fill(c, 1, { rock: true });
  for (let j = 0; j < 3; j++) for (let lv = 2; lv <= 5; lv++) S.world.setSolid(S.at(3, j), lv, true, { rock: true });   // 墙高 4 层（爬不上去）
  if (arch) S.world.setSolid(S.at(3, 1), 2, false);                       // 拱洞：2 层挖空、3–5 层留作门楣
  if (gap) for (let lv = 2; lv <= 5; lv++) S.world.setSolid(S.at(3, 0), lv, false);   // 另一个无顶缺口
  return { ...S, nav: new BattleNavigation(S.world, S.index, { levelHeight: L, ...(doorCost ? { doorCost } : {}) }) };
};
const walk = (S, from, to) => {
  const u = { x: from.cx, z: from.cz, y: L, navFloor: 1 }, route = [from.id];
  for (let k = 0; k < 60; k++) { const p = S.nav.plan(u, to, 1); if (!p) return null; if (p.arrived) return route; u.x = p.next.cell.cx; u.z = p.next.cell.cz; u.navFloor = p.next.floor; route.push(p.next.cell.id); }
  return null;
};
// ① voxelnav：拱下有节点（被门楣覆盖）；单值高度图里拱格的高度是墙顶，左右两半不连通
let S = make();
S.nav.refresh();
const archNode = S.nav.graph.at(S.at(3, 1), 1);
assert.ok(archNode >= 0 && S.nav.graph.nodes[archNode].floor < S.world.top(S.at(3, 1)), '拱下 1 层是可站节点（头顶 2 层空、3 层门楣）');
assert.equal(S.nav.graph.at(S.at(3, 0), 1), -1, '实心墙脚没有节点');
const height = buildNav(S.world, { start: S.at(0, 1) });
assert.ok(!Number.isFinite(height.tree.time[S.at(6, 1).id]), '二维高度图：墙两侧不连通（洞道在单值高度里不存在）');
const route = walk(S, S.at(0, 1), S.at(6, 1));
assert.ok(route && route.includes(S.at(3, 1).id), '分层图：穿拱洞过去');
const st = S.nav.graph.stats();
assert.equal(st.components, 2, '地面（含拱下）一块 + 墙顶 5 层一块（够不着，单独一块）');
assert.ok(st.covered === 1 && st.coveredShare > 0 && st.largestShare > .8, JSON.stringify(st));
// ② cheesenav：头顶净空——拱洞只挖 0 层（门楣直接压在地板上）就不是节点
S.world.setSolid(S.at(3, 1), 2, true, { rock: true }); S.nav.refresh();
assert.equal(S.nav.graph.at(S.at(3, 1), 1), -1, '没有头顶空间不能站');
assert.equal(walk(S, S.at(0, 1), S.at(6, 1)), null, '封门：两侧不连通（门洞是唯一横向通路）');
// ③ holenav：门洞加价——拱洞比绕到无顶缺口近时走拱洞；门价调高后宁可多走两步走开口
S = make({ arch: true, gap: true });
assert.ok(walk(S, S.at(0, 1), S.at(6, 1)).includes(S.at(3, 1).id), '默认门价 1.35：拱洞 6.7 < 绕行 8');
const S2 = make({ arch: true, gap: true, doorCost: 2.5 });
const r2 = walk(S2, S2.at(0, 1), S2.at(6, 1));
assert.ok(r2.includes(S2.at(3, 0).id) && !r2.includes(S2.at(3, 1).id), '门价 2.5：拱洞 9 > 绕行 8，改走无顶缺口');
assert.throws(() => new BattleNavigation(S.world, S.index, { doorCost: .5 }));
// ④ 797119718477991936：导航跟着几何长——逐格加地板，节点数单调不减、最后全连通
const G = stripWorld(5, 5); const nav = new BattleNavigation(G.world, G.index); let prev = 0;
for (const c of G.cells) { G.world.fill(c, 1, { rock: true }); nav.refresh(); const n = nav.graph.nodes.length; assert.ok(n >= prev); prev = n; }
assert.equal(nav.graph.stats().components, 1);
console.log('PASS 拱下多层节点 vs 单值高度图断开、头顶净空、封门不连通、门洞加价改道、导航随几何生长', JSON.stringify({ covered: st.covered, components: st.components, route: route.length, gapRoute: r2.length }));
