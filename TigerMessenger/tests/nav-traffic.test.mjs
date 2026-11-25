// R35 窄道会车（battle.navTraffic，补学 #3：880853661936734211）：弯道、岔口、不同体型重新选路。
//   COURSE：左右两间屋由一条一格宽、四道弯、中间一个死胡同岔口的窄道相连（没有拱）→ 两队对向会车。
//   TRAFFIC_ISLAND：同样两间屋，一条带矮拱的短窄道 + 一条长窄道；身高 0.44 时拱的净宽 ≈ 0.23，
//   普通兵（直径 0.11）钻拱走短路，大个子（半径 0.12，直径 0.24 + 余量）放不进，改走长路。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/nav-traffic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { asciiWorld, COURSE, TRAFFIC_ISLAND, corridorStats, makeNav, meetingRun, trafficReport, demoSite } from '../src/system-workshop/battle/nav-lab.js';
import { describeBattleCapabilities, matchAll, runPlan } from '../src/system-workshop/battle/capabilities.js';
import { verifyBattle } from '../src/system-workshop/battle/verify.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const STAGE = { id: 'battle.stage', params: { scale: 5, gridRadius: 10, unitHeight: 1.7 } };

test('窄道 / 弯道 / 岔口：考场上逐格数对', () => {
  const cs = corridorStats(asciiWorld(COURSE));
  assert.equal(cs.corridors, 10, '一格宽的窄道 10 格');
  assert.equal(cs.curves, 4, '四道弯');
  assert.equal(cs.forks, 3, '中间的死胡同岔口 + 两头屋子的窄道口');
});

test('对向会车：两队（各 3 个普通兵 + 1 个大个子）全部到达、没有人卡死', () => {
  const env = asciiWorld(COURSE), nav = makeNav(env, { finePortals: true, unitHeight: .34 });
  const m = meetingRun(env, nav, env.at(1, 2), env.at(11, 2), { squad: 3, heavyRadius: .12, frames: 3000 });
  assert.equal(m.total, 8);
  assert.equal(m.noPlan, 0, '没有人找不到路');
  assert.equal(m.arrived, m.total, '全部到达 ' + JSON.stringify({ ...m, units: undefined }));
  assert.equal(m.heavyArrived, 2);
  assert.ok(m.frames < 3000);
  // 会车真的发生在窄道里：两队的人都走过同一段窄道格
  const narrow = corridorStats(env).narrow, east = m.units.filter((u) => u.goal === env.at(11, 2)), west = m.units.filter((u) => u.goal === env.at(1, 2));
  const shared = [...east[0].cells].filter((id) => narrow[id] && west.some((w) => w.cells.has(id)));
  assert.ok(shared.length >= 5, '两队共用的窄道格 ' + shared.length);
});

test('不同体型重新选路：普通兵钻矮拱走短路，大个子放不进、改走长路', () => {
  const env = asciiWorld(TRAFFIC_ISLAND), nav = makeNav(env, { finePortals: true, unitHeight: .44 });
  const a = env.at(2, 2), b = env.at(10, 2), arch = env.at(6, 2);
  const small = nav.plan({ x: a.cx, z: a.cz, navFloor: 1, radius: .055 }, b, 1), big = nav.plan({ x: a.cx, z: a.cz, navFloor: 1, radius: .12 }, b, 1);
  assert.ok(small && big, '两种体型都有路');
  assert.ok(big.distance > small.distance + 3, `大个子绕路：${big.distance} vs ${small.distance}`);
  // 沿路线树把普通兵的路线走出来：要经过拱
  const route = (plan) => { const out = []; let id = plan.from.id; for (let k = 0; k < 80 && id >= 0; k++) { out.push(nav.graph.nodes[id].cell.id); if (id === plan.tree.next[id] || plan.tree.next[id] < 0) break; id = plan.tree.next[id]; } return out; };
  assert.ok(route(small).includes(arch.id), '普通兵穿拱');
  assert.ok(!route(big).includes(arch.id), '大个子不穿拱');
  const r = trafficReport(env, { unitHeight: .44, heavyRadius: .12 });
  assert.ok(r.reroute.rerouted >= 1 && r.laneConflicts >= 1, JSON.stringify(r.reroute) + ' laneConflicts=' + r.laneConflicts);
  // 拱高够（身高 0.34）时两种体型走同一条路
  const nav2 = makeNav(env, { finePortals: true, unitHeight: .34 }), big2 = nav2.plan({ x: a.cx, z: a.cz, navFloor: 1, radius: .12 }, b, 1);
  assert.ok(Math.abs(big2.distance - nav2.plan({ x: a.cx, z: a.cz, navFloor: 1, radius: .055 }, b, 1).distance) < 1e-9);
});

test('能力：元数据、在演示岛上执行写进计划、验证复算一致；改报告判失败', () => {
  const c = describeBattleCapabilities().find((x) => x.id === 'battle.navTraffic');
  assert.ok(c && c.line === 'navigation' && c.requires.includes('battle.stage') && c.modules.includes('src/world/traffic.js'));
  const site = demoSite(), steps = [STAGE, { id: 'battle.navFinePortals', params: {} }, { id: 'battle.navTraffic', params: { heavyRadius: .12, heavyShare: .25, squad: 2 } }];
  matchAll(site);
  const rep = runPlan(site, steps), r = rep.find((x) => x.id === 'battle.navTraffic');
  assert.ok(['applied', 'no-target'].includes(r.status));
  const t = site.plan.navigation.traffic;
  assert.equal(t.heavyRadius, .12); assert.equal(t.heavyShare, .25); assert.equal(t.squad, 2);
  for (const k of ['corridors', 'curves', 'forks', 'laneConflicts', 'reroute']) assert.ok(k in t.report, k);
  const ok = verifyBattle(site, site.plan, { steps });
  assert.equal(ok.checks.find((x) => x.id === 'nav-traffic-report').status, 'pass');
  assert.equal(ok.checks.find((x) => x.id === 'nav-traffic-body').status, 'pass');
  const bad = structuredClone(site.plan); bad.navigation.traffic.report.corridors += 1;
  assert.equal(verifyBattle(site, bad, { steps }).checks.find((x) => x.id === 'nav-traffic-report').status, 'fail');
  const fat = structuredClone(site.plan); fat.navigation.traffic.heavyRadius = .5;
  assert.equal(verifyBattle(site, fat, { steps }).checks.find((x) => x.id === 'nav-traffic-body').status, 'fail');
});

test('实景接线：大个子体型按比例换、后面波次也换；实况快照报体型与卡墙', () => {
  const sb = read('src/world/rea/sceneBattle.js');
  assert.match(sb, /function applyBodies\(stage\)/);
  assert.match(sb, /u\.radius = t\.heavyRadius/);
  assert.match(sb, /if \(st\.navPlan\?\.traffic\) applyBodies\(st\)/);
  assert.match(sb, /wallClips: clips, heavy/);
});
