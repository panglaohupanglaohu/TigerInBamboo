// R62 端到端：多种子分布面板出现在各层工坊侧栏（opt-in 按 seed-layers.js 登记表），在 Worker 里跑 N 个种子，给出分布与三张代表。
//   新的非持久上下文 → pipeline.html#scene → 选场景（默认苔庭 moss，SCENE 可改）→ 等战役 / 表现层 / 光影与生命面板出现
//   → 每块面板把种子数设成 6（SEEDS 可改）并点「跑 N 个种子」→ 等 data-state=done → 断言表格行数 = 指标数、三张代表的种子在 1..N 里
//   → 每块面板截图。另断言：高山圣城以外不会出现山形的通用面板（山形用自己的 R28 面板）。不写 localStorage。
// 运行：cd TigerMessenger && $NODE tests/seed-report-browser.mjs   （需要 8931 服务）
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, openScene, expect, runDir, writeReport, pageErrors } from './lib/lightlife-e2e.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), out = runDir(here, 'seed-report-e2e'), N = Number(process.env.SEEDS) || 6;
const report = { out, scene: null, panels: {}, errors: [], pass: false, capabilities: [] };
const browser = await launch();
let page;
try {
  const o = await openScene(browser, { errors: report.errors }); page = o.page; report.scene = o.scene;
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.endsWith('.pipeline.v2')).sort());
  const want = (process.env.LAYERS || 'battle,fx,lightlife').split(',');
  for (const layer of want) {
    const sel = '#seed-report-' + layer;
    await page.waitForSelector(sel, { timeout: 180000, state: 'attached' });
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.locator(sel + ' input[type=number]').fill(String(N));
    await page.locator(sel + ' [data-seed-run]').click();
    await page.waitForFunction(([s]) => ['done', 'error', 'not-run'].includes(document.querySelector(s)?.dataset.state), [sel], { timeout: 600000 });
    const st = await page.evaluate((s) => { const r = document.querySelector(s); return { state: r.dataset.state, count: +r.dataset.count, best: +r.dataset.best, typical: +r.dataset.typical, worst: +r.dataset.worst, metricRows: r.querySelectorAll('tr[data-metric]').length, picks: [...r.querySelectorAll('[data-pick]')].map((x) => x.dataset.seed), text: r.textContent.slice(0, 400), height: Math.round(r.getBoundingClientRect().height) }; }, sel);
    report.panels[layer] = st;
    await page.locator(sel).screenshot({ path: path.join(out, `panel-${layer}.png`) });
    expect(st.state === 'done', `${layer}：分布没跑完（${st.state}）：${st.text}`);
    expect(st.count === N, `${layer}：种子数 ${st.count} ≠ ${N}`);
    expect(st.metricRows >= 3, `${layer}：指标行 ${st.metricRows} < 3`);
    for (const k of ['best', 'typical', 'worst']) expect(st[k] >= 1 && st[k] <= N, `${layer}：${k} 种子 ${st[k]} 不在 1..${N}`);
  }
  report.mountainGenericPanel = await page.evaluate(() => !!document.getElementById('seed-report-mountain'));
  expect(!report.mountainGenericPanel || report.scene === 'citadel', '非高山圣城出现了山形通用分布面板');
  const keysAfter = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.endsWith('.pipeline.v2')).sort());
  report.localStorage = { before: keysBefore, after: keysAfter };
  expect(JSON.stringify(keysBefore) === JSON.stringify(keysAfter), '分布面板写了 localStorage：' + keysAfter.join(','));
  await page.screenshot({ path: path.join(out, 'page.png'), fullPage: false });
  report.pass = pageErrors(report.errors).length === 0;
  if (!report.pass) throw Error('page errors: ' + report.errors.join(' | '));
} catch (e) { report.failure = e.message; try { await page?.screenshot({ path: path.join(out, 'zz-failure.png') }); } catch {} }
writeReport(out, report);
await browser.close(); process.exit(report.pass ? 0 : 1);
