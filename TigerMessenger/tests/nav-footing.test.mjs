// R36 穿洞与脚高插值（battle.navFooting，补学 #4：906425294533394432 / 828984794407170048）。
//   FOOTING_ISLAND：三格洞道（第 2 层空、3–6 层是顶）+ 一层台地与一架楼梯。
//   洞里：脚高必须是洞底（第 1 层），不是洞顶（第 6 层）——单值高度图会把人放到洞顶上；
//   楼梯：脚高按踏面一级级升（每级 L/3），不插值时跨格一步就是一整层 L。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/nav-footing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { asciiWorld, FOOTING_ISLAND, footingReport, makeNav, demoSite } from '../src/system-workshop/battle/nav-lab.js';
import { describeBattleCapabilities, matchAll, runPlan } from '../src/system-workshop/battle/capabilities.js';
import { verifyBattle } from '../src/system-workshop/battle/verify.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const STAGE = { id: 'battle.stage', params: { scale: 5, gridRadius: 10, unitHeight: 1.7 } };

test('洞道：三个洞底节点，脚高都在洞底；洞顶比洞底高 2.5', () => {
  const env = asciiWorld(FOOTING_ISLAND), r = footingReport(env, { unitHeight: .34, routes: [] });
  assert.equal(r.covered, 3); assert.equal(r.tunnelErrors, 0); assert.equal(r.roofGap, 2.5);
  const nav = makeNav(env, { finePortals: true, unitHeight: .34 }), t = env.at(5, 1), node = nav.graph.nodes[nav.graph.at(t, 1)];
  assert.ok(node, '洞底有节点');
  assert.equal(nav.footHeight({ x: t.cx, z: t.cz, navFloor: 1 }), .5, '脚在洞底 1 × 0.5');
  assert.equal(env.world.top(t) * env.L, 3, '单值高度图会把人放到 3.0（洞顶）');
});

test('楼梯：一架，踏面一级 L/3，比不插值的一整层小', () => {
  const r = footingReport(asciiWorld(FOOTING_ISLAND), { unitHeight: .34, routes: [] });
  assert.equal(r.stairs, 1); assert.equal(r.profiles, 1);
  assert.equal(r.stairFlatStep, .5);
  assert.ok(Math.abs(r.stairMaxStep - .5 / 3) < 2e-3, '踏面一级 ' + r.stairMaxStep);
});

test('逐帧：穿洞那段脚贴洞底，上楼梯那段脚高的最大跳变小于不插值', () => {
  const env = asciiWorld(FOOTING_ISLAND);
  const r = footingReport(env, { unitHeight: .34, routes: [{ from: env.at(1, 1), to: env.at(8, 1) }, { from: env.at(7, 2), to: env.at(11, 2) }] });
  assert.equal(r.walk.arrived, 2, JSON.stringify(r.walk));
  assert.ok(r.walk.tunnelFrames > 0, '真的穿了洞');
  assert.equal(r.walk.tunnelFloorFrames, r.walk.tunnelFrames, '洞里每一帧脚都在洞底');
  assert.ok(r.walk.stairFrames > 0, '真的上了楼梯踏面');
  assert.equal(r.walk.maxJumpFlat, .5);
  assert.ok(r.walk.maxJumpFoot < r.walk.maxJumpFlat, `插值后最大跳变 ${r.walk.maxJumpFoot} < ${r.walk.maxJumpFlat}`);
});

test('能力：元数据；演示岛上执行写进计划；验证复算一致；改报告判失败', () => {
  const c = describeBattleCapabilities().find((x) => x.id === 'battle.navFooting');
  assert.ok(c && c.line === 'navigation' && c.requires.includes('battle.stage') && c.modules.includes('src/world/battle-navigation.js'));
  const site = demoSite(), steps = [STAGE, { id: 'battle.navFinePortals', params: {} }, { id: 'battle.navFooting', params: { routes: 4 } }];
  assert.ok(matchAll(site).find((x) => x.id === 'battle.navFooting').count > 0, '演示岛有楼梯 / 洞道');
  const rep = runPlan(site, steps);
  assert.equal(rep.find((x) => x.id === 'battle.navFooting').status, 'applied');
  const f = site.plan.navigation.footing;
  assert.equal(f.routes, 4); assert.ok(f.report.covered > 0, '挖空后的演示岛有洞底节点');
  const ok = verifyBattle(site, site.plan, { steps });
  for (const id of ['nav-footing-report', 'nav-footing-tunnel']) assert.equal(ok.checks.find((x) => x.id === id).status, 'pass', id);
  const bad = structuredClone(site.plan); bad.navigation.footing.report.tunnelErrors = 0; bad.navigation.footing.report.covered += 1;
  assert.equal(verifyBattle(site, bad, { steps }).checks.find((x) => x.id === 'nav-footing-report').status, 'fail');
});

test('战役层导航线：三个可执行能力都挂在 navigation 线上（树上导航线 ⚙ +3）', () => {
  const nav = describeBattleCapabilities().filter((c) => c.line === 'navigation').map((c) => c.id);
  assert.deepEqual(nav, ['battle.navFinePortals', 'battle.navTraffic', 'battle.navFooting']);
  for (const c of describeBattleCapabilities().filter((x) => x.line === 'navigation')) { assert.ok(c.modules.length >= 3 && c.clips.length >= 1 && c.added === '2026-11-23'); }
});

test('实景接线：画面脚高只在开了 footing 且拱洞已挖空时按洞底修正；实况报洞底画面偏差', () => {
  const st = read('src/world/rea/reaBattleStage.js'), sb = read('src/world/rea/sceneBattle.js');
  assert.match(st, /if \(this\.archesOn && this\.footing\)/);
  assert.match(st, /return a\.groundY - u\.navFloor \* levelHeight/);
  assert.match(st, /drawnFooting\(tol = 0\.15\)/);
  assert.match(sb, /stage\.footing = !!nav\?\.footing/);
  assert.match(sb, /drawn: st\.drawnFooting\?\.\(\)/);
  assert.match(sb, /measureFooting\(units\)/);
});
