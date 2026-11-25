// R34 拱洞精细门户（battle.navFinePortals）：单位从拱洞里穿过而不是穿墙。
//   测试岛 ARCH_ISLAND：一道 6 层高的墙把小岛隔成南北两半，只有两个拱洞（第 2 层空、3–6 层拱顶）能过。
//   身高 0.34（1.7 m 士兵 ÷ 十二门徒舞台 5 m/格）→ 拱脚各封掉约 14.6% 的门户宽度，出现形变侧壁。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/nav-fine-portals.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { asciiWorld, ARCH_ISLAND, finePortalReport, makeNav, demoNavSample, demoSite, envFromNavSample } from '../src/system-workshop/battle/nav-lab.js';
import { BATTLE_CAPABILITIES, describeBattleCapabilities, matchAll, runPlan } from '../src/system-workshop/battle/capabilities.js';
import { verifyBattle } from '../src/system-workshop/battle/verify.js';
import { planPreload } from '../src/system-workshop/auto-preload.js';

const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const STAGE = { id: 'battle.stage', params: { scale: 5, gridRadius: 8, unitHeight: 1.7 } };

test('拱下几何：两个拱、门户收窄、有侧壁；穿墙探针关时放得下、开后全部拦下', () => {
  const r = finePortalReport(asciiWorld(ARCH_ISLAND), { unitHeight: .34 });
  assert.equal(r.fine.archNodes, 2);
  assert.ok(r.fine.narrowed >= 4, '每个拱两侧门户都收窄 ' + JSON.stringify(r.fine));
  assert.ok(r.fine.sideWalls >= 4, '每个拱两条形变侧壁');
  assert.ok(r.fine.meanNarrowing > .25 && r.fine.meanNarrowing < .35, '收窄约 29%：' + r.fine.meanNarrowing);
  assert.ok(r.probes.probes >= 4);
  assert.equal(r.probes.onBlocked, r.probes.probes, '开精细门户：拱脚那一段一处都放不下身体');
  assert.equal(r.probes.offFitsOnBlocked, r.probes.probes, '关精细门户：同样的位置都放得下（= 贴着拱脚穿墙）');
});

test('穿拱模拟：开精细门户时斜着进拱也不擦墙、都穿过去', () => {
  const r = finePortalReport(asciiWorld(ARCH_ISLAND), { unitHeight: .34 });
  assert.equal(r.crossings, 2);
  assert.equal(r.on.arrived, 2); assert.equal(r.on.through, 2);
  assert.equal(r.on.clips, 0, '开：每一帧身体都在拱洞净宽里');
  assert.ok(r.off.arrived === 2, '关：也能走到（只是会擦墙）');
  assert.ok(r.off.clips >= 0);
});

test('身高敏感：矮个子几乎不收窄；高到拱顶放不下时拱被封死、南北不通', () => {
  const env = asciiWorld(ARCH_ISLAND);
  const low = finePortalReport(env, { unitHeight: .18 }), high = finePortalReport(env, { unitHeight: .6 });
  assert.ok(low.fine.meanNarrowing < .05, '0.18 只封掉拱脚一点点：' + low.fine.meanNarrowing);
  assert.ok(high.fine.closed >= 4, '0.6 高过拱顶：门户封死');
  const nav = makeNav(env, { finePortals: true, unitHeight: .6 }), s = env.at(4, 1), n = env.at(4, 5);
  assert.equal(nav.plan({ x: s.cx, z: s.cz, navFloor: 1 }, n, 1), null, '拱都过不去 → 南北不通');
  assert.ok(makeNav(env, { finePortals: false, unitHeight: .6 }).plan({ x: s.cx, z: s.cz, navFloor: 1 }, n, 1), '关精细门户时（旧行为）照样穿过去');
});

test('能力元数据：§5.3 字段齐全、真实模块、在战役能力表里', () => {
  const c = describeBattleCapabilities().find((x) => x.id === 'battle.navFinePortals');
  assert.ok(c && c.executable && c.line === 'navigation' && c.domain === 'battle' && c.name && c.does);
  assert.deepEqual(c.requires, ['battle.stage']);
  for (const m of c.modules) assert.ok(fs.existsSync(new URL('../../townscaper-web/REACodeRefactoring/' + m, import.meta.url)), '重构库没有 ' + m);
  for (const m of c.modules) assert.ok(fs.existsSync(new URL('../src/vendor/townscaper-rea-refactoring/' + m, import.meta.url)), 'vendor 副本没有 ' + m);
  assert.ok(BATTLE_CAPABILITIES.some((x) => x.meta.id === 'battle.navFinePortals'));
});

test('扫描与执行：演示岛（实景同一种网格）上匹配、执行写进作战计划', () => {
  const site = demoSite();
  assert.ok(site.nav.arches > 0, '演示岛挖空版本有洞道');
  const m = matchAll(site).find((x) => x.id === 'battle.navFinePortals');
  assert.ok(m.count > 0, '有拱洞候选 → 匹配');
  const rep = runPlan(site, [STAGE, { id: 'battle.navFinePortals', params: { arches: true } }]);
  const r = rep.find((x) => x.id === 'battle.navFinePortals');
  assert.equal(r.status, 'applied', JSON.stringify(r));
  assert.equal(site.plan.navigation.finePortals, true); assert.equal(site.plan.navigation.arches, true);
  assert.equal(site.plan.navigation.unitHeight, .34, '身高 = 1.7 m ÷ 5 m/格');
  assert.ok(site.plan.navigation.fine.fine.covered > 0);
  // 没有导航采样 → 不匹配
  assert.equal(matchAll({ ...site, nav: null }).find((x) => x.id === 'battle.navFinePortals').count, 0);
  // 实心柱、没有拱洞候选 → 不匹配
  assert.equal(matchAll({ ...site, nav: { ...site.nav, hollow: null, arches: 0 } }).find((x) => x.id === 'battle.navFinePortals').count, 0);
});

test('验证：健全计划通过；关掉开关 / 改报告 判失败', () => {
  const site = demoSite(), steps = [STAGE, { id: 'battle.navFinePortals', params: { arches: true } }];
  runPlan(site, steps);
  const ok = verifyBattle(site, site.plan, { steps });
  for (const id of ['nav-fine-on', 'nav-fine-height', 'nav-fine-walls', 'nav-fine-report']) assert.equal(ok.checks.find((c) => c.id === id)?.status, 'pass', id + ' ' + JSON.stringify(ok.checks.find((c) => c.id === id)));
  const off = structuredClone(site.plan); off.navigation.finePortals = false;
  assert.equal(verifyBattle(site, off, { steps }).checks.find((c) => c.id === 'nav-fine-on').status, 'fail');
  const bad = structuredClone(site.plan); bad.navigation.fine.fine.narrowed += 3;
  const v = verifyBattle(site, bad, { steps }), c = v.checks.find((x) => x.id === 'nav-fine-report');
  assert.equal(c.status, 'fail'); assert.deepEqual(c.blame, ['battle.navFinePortals']); assert.equal(v.status, 'fail');
});

test('确定性：同一采样两次执行，报告逐字相同', () => {
  const a = demoSite(), b = demoSite(), steps = [STAGE, { id: 'battle.navFinePortals', params: {} }];
  runPlan(a, steps); runPlan(b, steps);
  assert.equal(JSON.stringify(a.plan.navigation), JSON.stringify(b.plan.navigation));
  // 重建网格与采样一致
  assert.equal(envFromNavSample(demoNavSample()).grid.cells.length, demoNavSample().cells);
});

test('自动预装：扫描匹配到拱洞时，导航能力连同前置舞台一起预装', () => {
  const caps = describeBattleCapabilities(), site = demoSite();
  const r = planPreload({ nodes: [] }, { matches: matchAll(site) }, caps);
  assert.ok(r.ids.includes('battle.navFinePortals'));
  assert.ok(r.ids.indexOf('battle.stage') < r.ids.indexOf('battle.navFinePortals'));
});

test('实景接线：采样带导航、开战前挖拱、开战后开精细门户；默认全关', () => {
  const sb = read('src/world/rea/sceneBattle.js'), st = read('src/world/rea/reaBattleStage.js');
  assert.match(sb, /nav: stage\.navSample\(\)/);
  assert.ok(sb.indexOf('stage.setArches(') < sb.indexOf('stage.start();'), '挖拱必须在开战前');
  assert.match(sb, /n\.finePortals = !!nav\?\.finePortals/);
  assert.match(st, /setArches\(on\)/); assert.match(st, /this\.archesOn = false/);
  assert.match(st, /solidHollow/);
  assert.match(read('src/system-workshop/battle/nav-capabilities.js'), /import \{[^}]*finePortalReport[^}]*\} from '\.\/nav-lab\.js/);
});
