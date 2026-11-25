// R36 端到端：穿洞与脚高插值（battle.navFooting）——实景。
//   找第一个有拱洞候选的战役场景（没有就用十二门徒，只验楼梯 / 实况脚高）→ 拱洞门户 + 脚高两个导航能力进管线 → ▶ 执行
//   → 验证「脚高报告复算」「洞里脚贴洞底」通过 → 实景 stage.footing 真开；每 2 秒采样 BattleNavigation.measureFooting（悬空 / 埋地）
//   与洞底画面脚高偏差（drawnFooting）；再临时关掉 footing 采一次作对照（只读，马上恢复）。不点采用，最后放弃。
// 运行：cd TigerMessenger && $NODE tests/nav-footing-browser.mjs   （需要 8931 服务）
import { launch, expect, BATTLE_SCENES, openBattle, switchScene, navMatch, ensureNodes, runPipeline, liveNav, revert, gameFrame, pageErrors } from './nav-e2e-lib.mjs';
const CAP = 'battle.navFooting';
const { report, page, shot, finish } = await launch('nav-footing', { capabilities: [CAP] });
try {
  const first = await openBattle(page); report.steps.scan = {};
  let scene = null;
  for (const id of BATTLE_SCENES) {
    if (id !== first || Object.keys(report.steps.scan).length) await switchScene(page, id);
    const m = await navMatch(page, 'battle.navFinePortals'); report.steps.scan[id] = { arches: m, footing: await navMatch(page, CAP) };
    if (m?.count > 0) { scene = id; break; }
  }
  if (!scene) { await switchScene(page, 'apostles'); scene = 'apostles'; report.steps.noArchScene = true; }
  report.steps.scene = scene;
  report.steps.nodes = await ensureNodes(page, ['battle.stage', 'battle.navFinePortals', CAP]);
  await shot('1-pipeline');
  const r = await runPipeline(page); report.steps.run = r;
  const step = r.steps.find((t) => t.startsWith('穿洞与脚高插值')); report.steps.stepText = step || null;
  expect(step && /踏面最大一步/.test(step) && /洞道节点/.test(step), '执行结果里没有脚高报告：' + JSON.stringify(r.steps));
  const chk = r.checks.filter((c) => /脚高|洞里脚|踏面/.test(c.text)); report.steps.navChecks = chk;
  expect(chk.find((c) => /脚高报告复算/.test(c.text))?.status === 'pass', '脚高报告复算没通过：' + JSON.stringify(chk));
  expect(!chk.some((c) => c.status === 'fail'), '脚高验证有 fail：' + JSON.stringify(chk));
  const samples = [];
  for (let k = 0; k < 10; k++) { await page.waitForTimeout(2000); samples.push(await liveNav(page)); }
  report.steps.samples = samples.map((s) => s && { units: s.units, footing: s.footing, archesOn: s.archesOn, covered: s.covered, measure: s.measure, drawn: s.drawn });
  const last = samples.at(-1);
  expect(last?.footing === true, '实景 footing 没开 ' + JSON.stringify(last));
  expect(typeof last.measure === 'object' && Number.isFinite(last.measure.units), 'measureFooting 读不出 ' + JSON.stringify(last.measure));
  // 对照：临时关掉画面修正，看洞底的人画在哪（只读，马上恢复）
  report.steps.compare = await gameFrame(page).evaluate(() => { const st = globalThis.__tmBattleStage; const on = st.drawnFooting(); st.footing = false; const off = st.drawnFooting(); st.footing = true; return { on, off }; });
  if (last.archesOn) expect(samples.every((s) => !s.drawn?.checked || s.drawn.off === 0), '开了脚高修正后，洞底仍有人画偏 ' + JSON.stringify(samples.map((s) => s?.drawn)));
  await page.locator('#game').screenshot({ path: report.out + '/2-live-battle.png' });
  await page.locator('#battle-workshop .agent-result').screenshot({ path: report.out + '/3-result.png' }).catch(() => {});
  await page.locator('.nav-panel').screenshot({ path: report.out + '/4-nav-panel.png' }).catch(() => {});
  await revert(page);
  report.pass = pageErrors(report).length === 0;
  if (!report.pass) throw Error('page errors: ' + pageErrors(report).join(' | '));
} catch (e) { report.pass = false; report.failure = e.message; try { await shot('zz-failure'); } catch {} }
await finish();
