// R34 端到端：拱洞精细门户（battle.navFinePortals）——演示页与实景各验一次。
//   A 演示页 nav-arch-demo.html：同一个兵斜着进拱，「开」每一帧身体都在拱洞净宽里、走到了；穿墙探针关时放得下、开后拦下。
//   B 实景：pipeline.html#battle，依次在十二门徒 / 高山圣城 / 苔庭 / 书店镇扫描，挑第一个有拱洞候选的场景；
//     导航能力自动预装（没预装就走侧栏双击）→ ▶ 执行 → 验证项无 fail → 实景里 BattleNavigation.finePortals 真开、拱洞真挖空。
//   拱洞分两种（worker 的穿拱模拟数据已经区分过）：
//     通路拱——两侧开口边各对一个同层可站格，单位能从一侧穿到另一侧。对通路拱，本测试主动下指令：
//     挑一支活着的守军队，把它的目标格设到拱的另一侧（复用实景点击改 goal 的同一条 navigation.plan 路径），
//     每 0.8s 采样直到有人身体进洞（≤40s）——不靠 AI 闲逛碰巧路过。
//     死角拱——单侧开口或没有同层邻格（悬垂岩檐），单位本来就该绕开，进去反而错。此时只验「没人卡进墙」。
//   两个场景都没有拱洞候选：B 判不通过（failure = no-arch-scene）。拱洞都是死角拱：live 穿洞部分记 NOT_VERIFIED，不算失败。
// 运行：cd TigerMessenger && $NODE tests/nav-fine-portals-browser.mjs   （需要 8931 服务）
import { launch, expect, BASE, BATTLE_SCENES, openBattle, switchScene, navMatch, ensureNodes, runPipeline, liveNav, revert, gameFrame, pageErrors } from './nav-e2e-lib.mjs';
const CAP = 'battle.navFinePortals';
const { report, page, ctx, shot, finish } = await launch('nav-fine-portals', { capabilities: [CAP] });
report.notRun = [];
try {
  // ── A 演示页
  const demo = await ctx.newPage(); demo.on('pageerror', (e) => report.errors.push('demo pageerror: ' + e.message));
  await demo.goto(BASE + 'nav-arch-demo.html?static=1');
  await demo.waitForFunction(() => globalThis.__navDemo?.done === true, {}, { timeout: 60000 });
  const d = await demo.evaluate(() => { const x = globalThis.__navDemo; return { unitHeight: x.unitHeight, arch: x.arch, on: x.on, off: x.off, fine: x.report.fine, probes: x.report.probes, stat: document.getElementById('stat-all').textContent }; });
  report.steps.demo = d;
  await demo.screenshot({ path: report.out + '/1-demo-final.png' });
  await demo.evaluate(() => globalThis.__navDemo.jump(Math.round(globalThis.__navDemo.total * .45)));
  await demo.screenshot({ path: report.out + '/1b-demo-in-arch.png' });
  expect(d.on.arrived && d.on.clips === 0, '演示页：开精细门户时应走到且不擦墙 ' + JSON.stringify(d.on));
  expect(d.probes.offFitsOnBlocked > 0 && d.probes.onBlocked === d.probes.probes, '演示页：穿墙探针 ' + JSON.stringify(d.probes));
  expect(d.fine.archNodes === 2 && d.fine.sideWalls >= 4, '演示页：拱下几何 ' + JSON.stringify(d.fine));
  report.steps.demoOffClips = d.off.clips;   // 关精细门户时擦墙的帧数（预期 > 0，只记录）
  await demo.close();

  // ── B 实景
  report.steps.firstScene = await openBattle(page);
  report.steps.scan = {};
  let scene = null;
  for (const id of BATTLE_SCENES) {
    if (id !== report.steps.firstScene || Object.keys(report.steps.scan).length) await switchScene(page, id);
    const m = await navMatch(page, CAP); report.steps.scan[id] = m;
    await page.locator('.nav-panel').screenshot({ path: `${report.out}/2-scan-${id}.png` }).catch(() => {});
    if (m?.count > 0) { scene = id; break; }
  }
  if (!scene) throw Error('no-arch-scene：四个场景的战斗舞台都没有拱洞候选（多层射线没找到朝下的面），实景这一半没法验');
  report.steps.scene = scene;
  report.steps.nodes = await ensureNodes(page, ['battle.stage', CAP]);
  await shot('3-pipeline');
  const r = await runPipeline(page); report.steps.run = { title: r.title, steps: r.steps };
  const navChecks = r.checks.filter((c) => /精细门户|门户身高|拱脚|门户报告|穿拱/.test(c.text));
  expect(navChecks.length >= 3, '验证项里没有导航检查：' + JSON.stringify(r.checks));
  expect(!navChecks.some((c) => c.status === 'fail'), '导航验证有 fail：' + JSON.stringify(navChecks));

  // 通路拱判定 + 主动下指令：找「两侧开口都有同层可站格」的拱下节点，挑一支活守军队把目标格设到拱另一侧。
  const route = await gameFrame(page).evaluate(() => {
    const st = globalThis.__tmBattleStage, b = st?.battle, n = b?.navigation;
    if (!n?.fine?.under || !b?.squads?.length) return { reason: 'no-nav-or-squads' };
    for (const node of n.graph.nodes) {
      const u = n.fine.under[node.id]; if (!u || u.kind !== 'arch' || !(u.u0 < .5)) continue;
      const edges = [...u.open.keys()]; if (edges.length < 2) continue;
      const c1 = n.world.neighbor(node.cell, edges[0]), c2 = n.world.neighbor(node.cell, edges[1]);
      const stand = (c) => !!c && n.graph.nodes.some((x) => x.cell === c && x.floor === node.floor);
      if (!stand(c1) || !stand(c2)) continue;
      const sq = b.squads.find((s) => s.alive && s.members.some((m) => !m.dead && !m.onBoat));
      if (!sq) return { through: true, ordered: false, reason: 'no-alive-defender' };
      const lead = sq.members.find((m) => !m.dead && !m.onBoat);
      const d1 = Math.hypot(lead.x - c1.cx, lead.z - c1.cz), d2 = Math.hypot(lead.x - c2.cx, lead.z - c2.cz);
      const far = d1 > d2 ? c2 : c1;
      if (!n.plan(lead, far, node.floor)) return { through: true, ordered: false, reason: 'unreachable' };
      sq.goal = far; sq.goalFloor = node.floor;      // 与实景点击改目标同一条路径（vendor battle.js:389）
      return { through: true, ordered: true, squad: sq.id, archNode: node.id, side: [edges[0], edges[1]] };
    }
    return { through: false, reason: 'dead-end-arches-only' };
  });
  report.steps.routeArch = route;

  const samples = [], ticks = route?.ordered ? 50 : 10, gap = route?.ordered ? 800 : 2000;
  for (let k = 0; k < ticks; k++) { await page.waitForTimeout(gap); samples.push(await liveNav(page)); if (route?.ordered && samples.at(-1)?.covered > 0) break; }
  report.steps.samples = samples.slice(-4);
  const last = samples.at(-1);
  await page.locator('#game').screenshot({ path: report.out + '/4-live-battle.png' });
  await page.locator('#battle-workshop button', { hasText: '对照原样' }).click(); await page.waitForTimeout(800);
  await page.locator('#game').screenshot({ path: report.out + '/5-compare-original.png' });
  await page.locator('#battle-workshop button', { hasText: '看候选' }).click().catch(() => {});
  expect(last?.finePortals === true, '实景 BattleNavigation.finePortals 没开 ' + JSON.stringify(last));
  expect(last.archesOn && last.archCandidates > 0, '实景拱洞没挖空 ' + JSON.stringify(last));
  expect((last.fine?.covered || 0) > 0, '挖空后没有洞道节点 ' + JSON.stringify(last.fine));
  expect(samples.every((s) => s && s.clips === 0), '有人卡在墙里（洞里身体放不下）：' + JSON.stringify(samples.map((s) => s?.clips)));
  report.steps.maxUnderCover = Math.max(...samples.map((s) => s?.covered || 0));
  if (route?.ordered) {
    expect(report.steps.maxUnderCover > 0, `下令穿拱后 ${ticks * gap / 1000}s 内没有人走进洞里（通路拱没被用上）：` + JSON.stringify(route));
  } else {
    report.notRun.push(`实景穿洞：${route?.reason || '场景只有死角拱'}——开关/挖空/不卡墙已验，单位穿洞 NOT_VERIFIED`);
  }
  await revert(page);
  report.steps.afterRevert = await gameFrame(page).evaluate(() => !!globalThis.__tmBattleStage);
  report.pass = pageErrors(report).length === 0;
  if (!report.pass) throw Error('page errors: ' + pageErrors(report).join(' | '));
} catch (e) { report.pass = false; report.failure = e.message; try { await shot('zz-failure'); } catch {} }
await finish();
