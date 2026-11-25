// R-A5 端到端（轻量）：十二门徒「按实测选优」区块。
//   新隔离上下文 → pipeline.html#scene → 选十二门徒 → #apostles-measure-pick 出现：
//   状态行显示「待实测选出 · P-R32-01」（pending-measurement 种子），「跑实测选出」可点、「撤销实测选择」禁用；
//   tm.defaults.v1 里 apostles:apostles-terrain 是 pending-measurement 记录；管线页「当前默认」栏同步显示 pending。
//   全流程（点「跑实测选出」→ 三套各重载一次游戏 → 写 winner 登记 → 恢复原外观）每次约 5–15 分钟，
//   本测试默认不跑；加 --full 参数才执行（NOT_RUN 常态）。
// 运行：cd TigerMessenger && $NODE tests/apostles-measure-pick-browser.mjs [--full]
//   截图 artifacts/apostles-measure-pick-e2e/run-*/：1-measure-pick.png（+ --full 时 2-winner.png / 3-undone.png）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { launch, BASE, waitApostlesStable, expect } from './lib/apostles-e2e.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../artifacts/apostles-measure-pick-e2e/run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const FULL = process.argv.includes('--full');
const report = { out, full: FULL, steps: {}, errors: [], pass: false, notRun: !FULL ? ['跑实测选出全流程（三次游戏重载 + checks）：本次 NOT_RUN，加 --full 执行'] : [] };
let browser = await launch();
let ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
let page = await ctx.newPage();
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
const M = '#apostles-measure-pick';
const state = () => page.evaluate((M) => ({
  text: document.querySelector(M + ' [data-measure-state]')?.textContent || '',
  kind: document.querySelector(M + ' [data-measure-state]')?.dataset.measureState || '',
  runDisabled: document.querySelector(M + ' [data-measure-run]')?.disabled ?? null,
  undoDisabled: document.querySelector(M + ' [data-measure-undo]')?.disabled ?? null,
  rows: [...document.querySelectorAll(M + ' [data-measure-results] li')].map((li) => li.textContent),
  record: JSON.parse(localStorage.getItem('tm.defaults.v1') || '{}').records?.['apostles:apostles-terrain'] || null,
  summaryText: document.getElementById('defaults-summary')?.textContent || '',
  live: document.querySelector('.apt-side p[data-look]')?.dataset.look || null,
}), M);
try {
  await page.goto(BASE + 'pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#scene option')].some((o) => o.value === 'apostles'), {}, { timeout: 90000 });
  await page.locator('#scene').selectOption('apostles');
  await page.waitForSelector(M + ' [data-measure-state]', { timeout: 360000 });
  await page.waitForTimeout(800);
  const s0 = await state(); report.steps.initial = s0;
  await page.locator(M).scrollIntoViewIfNeeded(); await page.locator(M).screenshot({ path: path.join(out, '1-measure-pick.png') });
  expect(s0.kind === 'pending', '初始应是 pending：' + s0.kind);
  expect(/待实测选出 · P-R32-01/.test(s0.text), '状态行不对：' + s0.text);
  expect(s0.runDisabled === false, '「跑实测选出」应可点');
  expect(s0.undoDisabled === true, '无 winner 时「撤销实测选择」应禁用');
  expect(s0.record?.status === 'pending-measurement' && s0.record?.pendingRef === 'P-R32-01', '登记不是 pending-measurement：' + JSON.stringify(s0.record));
  expect(/待实测选出/.test(s0.summaryText), '「当前默认」栏没显示 pending：' + s0.summaryText.slice(0, 200));

  if (FULL) {
    // 全流程：三套各切一次（每次重载游戏）→ 写 winner → 恢复原外观 → 撤销回 pending。
    // 渲染进程在顺序重载时崩过（Target crashed）：measure-pick 有断点续跑（tm.apt.measure.v1），
    // 崩了重开页面选回十二门徒，工坊自动从未完成的那套继续，最多容忍 3 次。
    // 先等到实景外观读数出现再记基线（元素先于稳定采样挂载，s0 时可能还是 null）
    await page.waitForFunction(() => document.querySelector('.apt-side p[data-look]')?.dataset.look, {}, { timeout: 180000 });
    const liveBaseline = await page.evaluate(() => document.querySelector('.apt-side p[data-look]')?.dataset.look || null);
    report.steps.liveBaseline = liveBaseline;
    await page.locator(M + ' [data-measure-run]').click();
    // 完成信号 = 「跑实测选出」按钮重新可用（跑的时候 disabled；三套全失败也会回到 pending 但按钮复原，断言另行区分）
    await page.waitForTimeout(1500);
    const waitDone = () => page.waitForFunction((M) => document.querySelector(M + ' [data-measure-run]')?.disabled === false, M, { timeout: 3600000 });
    let crashes = 0;
    for (;;) {
      try { await waitDone(); break; }
      catch (e) {
        if (!/crashed/.test(e.message) || ++crashes > 3) throw e;
        report.steps['crash' + crashes] = { note: 'Target crashed，重启浏览器续跑（同进程 GPU 崩溃计数会让下次重载也崩）' };
        // 同一 browser 实例的 GPU 进程崩溃计数会连坐下一次加载——整只换掉；
        // storageState 带走 localStorage（tm.apt.measure.v1 断点草稿靠它续跑）
        const ss = await ctx.storageState().catch(() => null);
        try { await browser.close(); } catch {}
        browser = await launch(); ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, ...(ss ? { storageState: ss } : {}) });
        page = await ctx.newPage(); page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
        await page.goto(BASE + 'pipeline.html#scene');
        await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
        await page.locator('#scene').selectOption('apostles');
        await page.waitForSelector(M + ' [data-measure-state]', { timeout: 360000 });
        // 自动续跑启动时按钮会立即禁用——先等它禁用再等复原，避免挂载间隙误读
        await page.waitForFunction((M) => document.querySelector(M + ' [data-measure-run]')?.disabled === true, M, { timeout: 60000 }).catch(() => {});
      }
    }
    report.crashes = crashes;
    const w = await state(); report.steps.winner = w;
    await page.locator(M).screenshot({ path: path.join(out, '2-winner.png') });
    expect(w.kind === 'winner' && w.record?.planId && w.record?.adoptedBy === 'auto-test', 'winner 登记不对：' + JSON.stringify(w.record));
    expect(w.record.status === 'pending-measurement', 'winner 仍应是 pending-measurement（推荐不是采用）：' + w.record.status);
    expect(w.undoDisabled === false, 'winner 后「撤销实测选择」应可点');
    // 恢复原外观：实景外观应与跑之前一致
    await waitApostlesStable(page, { need: 3 });
    const live = await state(); expect(live.live === liveBaseline, `跑完实测外观应恢复 ${liveBaseline}，读到 ${live.live}`);
    // 撤销 → 回到 pending
    await page.locator(M + ' [data-measure-undo]').click();
    await page.waitForTimeout(500);
    const u = await state(); report.steps.undone = u;
    await page.locator(M).screenshot({ path: path.join(out, '3-undone.png') });
    expect(u.kind === 'pending' && /待实测选出/.test(u.text), '撤销后没回到待实测选出：' + u.text);
    expect(u.record?.status === 'pending-measurement' && !u.record?.planId, '撤销后登记应是无 winner 的 pending：' + JSON.stringify(u.record));
  }
  report.pass = !report.errors.length; if (!report.pass) throw Error(report.errors.join(' | '));
} catch (e) { report.failure = e.message; try { await page.screenshot({ path: path.join(out, 'zz-failure.png') }); } catch {} }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, notRun: report.notRun, out }, null, 1));
await browser.close(); process.exit(report.pass ? 0 : 1);
