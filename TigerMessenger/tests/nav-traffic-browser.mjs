// R35 端到端：窄道会车（battle.navTraffic）——十二门徒实景。
//   扫描 → 导航能力自动预装（没预装就走侧栏双击）→ ▶ 执行 → 结果里有窄道 / 弯道 / 岔口 / 体型重路由 / 会车模拟，验证「会车报告复算」通过
//   → 实景里每队按比例换了大个子（u.radius = 计划里的半径），20 秒内没人卡在墙里；实景里拿一个大个子和一个普通兵对同一个目标求路，记录代价。
//   不点采用，最后放弃。
// 运行：cd TigerMessenger && $NODE tests/nav-traffic-browser.mjs   （需要 8931 服务）
import { launch, expect, openBattle, navMatch, ensureNodes, runPipeline, liveNav, revert, gameFrame, pageErrors } from './nav-e2e-lib.mjs';
const CAP = 'battle.navTraffic';
const { report, page, shot, finish } = await launch('nav-traffic', { capabilities: [CAP] });
try {
  report.steps.scene = await openBattle(page);
  report.steps.match = await navMatch(page, CAP);
  await page.locator('.nav-panel').screenshot({ path: report.out + '/1-scan.png' }).catch(() => {});
  report.steps.nodes = await ensureNodes(page, ['battle.stage', CAP]);
  await shot('2-pipeline');
  const r = await runPipeline(page); report.steps.run = r;
  const step = r.steps.find((t) => t.startsWith('窄道会车')); report.steps.stepText = step || null;
  expect(step && /窄道 \d+ 格/.test(step) && /体型重路由/.test(step), '执行结果里没有会车报告：' + JSON.stringify(r.steps));
  const chk = r.checks.filter((c) => /会车|体型参数/.test(c.text)); report.steps.navChecks = chk;
  expect(chk.find((c) => /会车报告复算/.test(c.text))?.status === 'pass', '会车报告复算没通过：' + JSON.stringify(chk));
  expect(!chk.some((c) => c.status === 'fail'), '会车验证有 fail：' + JSON.stringify(chk));
  const samples = [];
  for (let k = 0; k < 10; k++) { await page.waitForTimeout(2000); samples.push(await liveNav(page)); }
  report.steps.samples = samples.map((s) => s && { units: s.units, heavy: s.heavy, heavyRadius: s.heavyRadius, clips: s.clips, covered: s.covered });
  const last = samples.at(-1);
  expect(last?.heavy > 0 && Math.abs(last.heavyRadius - .12) < 1e-9, '实景里没换大个子 ' + JSON.stringify(last));
  expect(samples.every((s) => s && s.clips === 0), '有人卡在墙里：' + JSON.stringify(samples.map((s) => s?.clips)));
  // 实景体型重路由：同一个起点、同一个目标，普通体型与大个子各求一次路（BattleNavigation.plan）
  report.steps.reroute = await gameFrame(page).evaluate(() => {
    const st = globalThis.__tmBattleStage, n = st.battle.navigation, u = st.battle.units.find((x) => !x.dead && !x.onBoat && !x.fall && n.unitNode(x));
    if (!u) return null;
    let tried = 0, rerouted = 0, blocked = 0;
    for (const g of n.graph.nodes.filter((x, i) => i % 7 === 0).slice(0, 60)) {
      const a = n.plan({ x: u.x, z: u.z, navFloor: u.navFloor, radius: .055 }, g.cell, g.floor); if (!a) continue; tried++;
      const b = n.plan({ x: u.x, z: u.z, navFloor: u.navFloor, radius: .12 }, g.cell, g.floor);
      if (!b) blocked++; else if (b.distance > a.distance + 1e-6) rerouted++;
    }
    return { tried, rerouted, blocked, minPortal: Math.min(...n.graph.portals.map((p) => p.width)) };
  });
  await page.locator('#game').screenshot({ path: report.out + '/3-live-battle.png' });
  await page.locator('#battle-workshop .agent-result').screenshot({ path: report.out + '/4-result.png' }).catch(() => {});
  await revert(page);
  report.pass = pageErrors(report).length === 0;
  if (!report.pass) throw Error('page errors: ' + pageErrors(report).join(' | '));
} catch (e) { report.pass = false; report.failure = e.message; try { await shot('zz-failure'); } catch {} }
await finish();
