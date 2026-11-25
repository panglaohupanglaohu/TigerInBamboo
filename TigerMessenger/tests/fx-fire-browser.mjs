// R37 端到端：表现层「小屋点火」在真实游戏场景里点着。
//   新开隔离浏览器 → pipeline.html#fx → 自动预装（含 fx.fire）→ ▶ 执行 → 候选 → 预览时 fx.live.preview 把 life/effects.js 的火粒子放进场景
//   断言：游戏里火源数 = 计划点火处数、全部点着、活着的火粒子 > 0、火光强度 > 0；对照原样会隐藏、回退会撤下；验证列表里有「火光衰减与烟放大」。
//   截图：1-candidate（整页）、2-fire-closeup（游戏画面里对准第一处火的特写）、3-compare-hidden、4-reverted。人必须打开看：特写里要看到橙色火苗和橙圈。
// 运行：cd TigerMessenger && $NODE tests/fx-fire-browser.mjs   （需要 8931 服务）
import { openFx, runFxPipeline, closeUp, expect } from './fx-live-e2e-common.mjs';
const t = await openFx('fx-fire-e2e', { capabilities: ['fx.fire'] });
const { report, shot, gameCmd, page } = t;
try {
  await runFxPipeline(t, { needNodes: ['fx.fire'] });
  await shot('1-candidate');
  const f = report.steps.live?.fire;
  expect(report.steps.live?.active, '实景预览没开：' + JSON.stringify(report.steps.live));
  expect(f && f.sources >= 1, '游戏里没有火源');
  expect(f.lit === f.sources, `只点着 ${f.lit}/${f.sources}`);
  expect(f.alive > 0, '火粒子一个都没活');
  expect(f.peakLight > 0, '火光强度为 0');
  expect(!report.steps.live.errors?.fire, '火层报错：' + report.steps.live.errors?.fire);
  expect(report.steps.checks.some((c) => /火光衰减与烟放大/.test(c)), '验证列表里没有火的检查');
  await closeUp(t, 'fire', '2-fire-closeup');
  expect(report.steps['focus-fire']?.ok, '对不准火：' + JSON.stringify(report.steps['focus-fire']));
  expect(report.steps['restore-fire']?.restored, '特写后镜头没还原');
  await page.locator('#fx-workshop button', { hasText: '对照原样' }).click(); await page.waitForTimeout(600);
  report.steps.compare = await gameCmd('fx.live.state'); await shot('3-compare-hidden');
  expect(report.steps.compare.visible === false, '对照原样时火还看得见');
  await page.locator('#fx-workshop button', { hasText: '看候选' }).click(); await page.waitForTimeout(400);
  report.steps.reverted = await gameCmd('fx.live.revert'); report.steps.after = await gameCmd('fx.live.state'); await shot('4-reverted');
  expect(report.steps.reverted?.removed === true && report.steps.after.active === false, '回退没撤下火');
  report.pass = report.errors.filter((e) => e.startsWith('pageerror')).length === 0;
  if (!report.pass) throw Error('页面报错：' + report.errors.join(' | '));
} catch (e) { report.pass = false; report.failure = String(e.stack || e).slice(0, 1500); try { await shot('zz-failure'); report.state = await gameCmd('fx.live.state'); } catch {} }
await t.finish();
