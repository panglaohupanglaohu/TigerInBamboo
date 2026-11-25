// R71 实景穿拱探针：四个战斗场景逐个找「通路拱」（两侧开口边各对一个同层可站格），
// 找到就真开战（deploySceneBattle 直接驱动，不走管线 UI）并给守军队下令穿拱，采样单位进洞。
// 找不到通路拱就如实报 NOT_VERIFIED（场景几何限制，不是代码缺口）。
// 运行：cd TigerMessenger && $NODE tests/nav-arch-through-browser.mjs   （需要 8931 服务）
import { launch, expect, BATTLE_SCENES, openBattle, switchScene, gameFrame, liveNav, pageErrors } from './nav-e2e-lib.mjs';
const { report, page, finish } = await launch('nav-arch-through', { capabilities: ['battle.navFinePortals'] });
report.notRun = [];
try {
  await openBattle(page);
  /** 场景 id → { arch 候选数, through 判定（deploy 后） } */
  report.steps.scenes = {};
  let verdict = null;
  for (const id of BATTLE_SCENES) {
    await switchScene(page, id);
    // 直接在游戏帧里起舞台采样 + 按「拱 + 精细门户」作战计划开战（与 ?battleAt 采用计划同一条 deploySceneBattle 路径）
    const dep = await gameFrame(page).evaluate(async (sceneId) => {
      const sb = await import('/TigerMessenger/src/world/rea/sceneBattle.js');
      const probe = sb.probeSceneBattle({ scene: globalThis.__tm.scene, camera: globalThis.__tm.camera, id: sceneId });
      if (!probe?.ok) return { ok: false, reason: probe?.reason || 'probe failed' };
      const stage = globalThis.__tmBattleStage;
      const plan = { navigation: { arches: true, finePortals: true, unitHeight: probe.site.nav?.unitHeight || undefined, footing: true } };   // nav.unitHeight = 舞台单位身高（如 1.7m/5m=0.34），不是米
      const r = sb.deploySceneBattle({ scene: globalThis.__tm.scene, camera: globalThis.__tm.camera, id: sceneId, plan });
      return { ok: !!r?.ok, archesOn: stage.archesOn, archCandidates: stage.archColumns?.length || 0, navigation: r.navigation };
    }, id);
    report.steps.scenes[id] = { deployed: dep };
    if (!dep.ok || !dep.archCandidates) { await gameFrame(page).evaluate(async () => (await import('/TigerMessenger/src/world/rea/sceneBattle.js')).stopSceneBattle()); continue; }
    // 与 nav-fine-portals-browser 同一段判定：找两侧开口都有同层可站格的拱下节点 → 下令穿拱
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
        sq.goal = far; sq.goalFloor = node.floor;
        return { through: true, ordered: true, squad: sq.id, archNode: node.id, side: [edges[0], edges[1]], narrowing: u.u0 };
      }
      return { through: false, reason: 'dead-end-arches-only' };
    });
    report.steps.scenes[id].route = route;
    if (!route?.ordered) {
      await gameFrame(page).evaluate(async () => (await import('/TigerMessenger/src/world/rea/sceneBattle.js')).stopSceneBattle());
      continue;
    }
    // 有通路拱且已下令：采样直到有人进洞（≤40s）
    const samples = [];
    for (let k = 0; k < 50; k++) { await page.waitForTimeout(800); samples.push(await liveNav(page)); if (samples.at(-1)?.covered > 0) break; }
    report.steps.scenes[id].samples = samples.slice(-3);
    const last = samples.at(-1), maxCovered = Math.max(...samples.map((s) => s?.covered || 0));
    report.steps.scene = id;
    verdict = { id, route, maxCovered, clips: samples.every((s) => s && s.clips === 0), last };
    break;
  }
  if (!verdict) {
    report.notRun.push('实景穿洞：四个场景都只有死角拱或没有拱候选——开关/挖空在 nav-fine-portals-browser 已验，单位穿洞 NOT_VERIFIED');
    report.pass = pageErrors(report).length === 0;
  } else {
    expect(verdict.last?.finePortals === true, '实景 finePortals 没开 ' + JSON.stringify(verdict.last));
    expect(verdict.maxCovered > 0, `下令穿拱后 40s 内没人进洞：${JSON.stringify(verdict.route)}`);
    expect(verdict.clips, '有人卡进墙里：' + JSON.stringify(verdict.last));
    report.pass = pageErrors(report).length === 0;
    if (!report.pass) throw Error('page errors: ' + pageErrors(report).join(' | '));
  }
  await gameFrame(page).evaluate(async () => (await import('/TigerMessenger/src/world/rea/sceneBattle.js')).stopSceneBattle()).catch(() => {});
} catch (e) { report.pass = false; report.failure = e.message; }
await finish();
