// R33 端到端：pipeline.html#battle 的战役侧栏出现「导航 · 原版当裁判」——页面里现算原版 cheesenav / holenav 对 vendor layerednav，
// 表格六行（两座岛 × 连通块数 / 最大块占比 / 被覆盖节点数）、同判据一致、缺口逐条列出、登记文件有没有写明。
// 这一轮没有新能力（对照本身不是能力），report.capabilities = []。
// 运行：cd TigerMessenger && $NODE tests/nav-parity-browser.mjs   （需要 8931 服务）
import { launch, expect, openBattle, pageErrors } from './nav-e2e-lib.mjs';
const { report, page, shot, finish } = await launch('nav-parity', { capabilities: [] });
try {
  report.steps.scene = await openBattle(page);
  await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('.nav-parity')?.dataset.state), {}, { timeout: 120000 });
  const st = await page.evaluate(() => {
    const box = document.querySelector('.nav-parity'), rows = [...box.querySelectorAll('tr[data-case]')].map((tr) => ({ case: tr.dataset.case, metric: tr.dataset.metric, cells: [...tr.querySelectorAll('td')].map((td) => ({ text: td.textContent, cls: td.className })) }));
    const v = box.querySelector('.nav-parity-verdict'), reg = box.querySelector('.nav-parity-reg');
    return { state: box.dataset.state, rows, verdict: v?.textContent, sameEqual: v?.dataset.sameEqual, gaps: Number(v?.dataset.gaps), gapItems: [...box.querySelectorAll('.nav-parity-gaps li')].map((li) => li.dataset.diff), registered: reg?.dataset.registered, regText: reg?.textContent, live: window.__tmNavParity ? { registered: window.__tmNavParity.registered, error: window.__tmNavParity.error || null, verdict: window.__tmNavParity.doc?.verdict } : null };
  });
  report.steps.parity = st;
  await page.locator('.nav-panel').scrollIntoViewIfNeeded();
  await shot('1-parity-panel', page.locator('.nav-panel')); await shot('2-battle-page');
  expect(st.state === 'ready', '对照现算失败：' + JSON.stringify(st.live));
  expect(st.rows.length === 6, '表格应 6 行，实际 ' + st.rows.length);
  for (const r of st.rows) expect(r.cells.length === 5 && r.cells.slice(2).every((c) => c.text.trim() !== ''), '空格子：' + JSON.stringify(r));
  expect(st.sameEqual === '1', '同判据不一致：' + st.verdict);
  expect(st.rows.every((r) => r.cells[3].cls === 'eq'), '同判据一列应全绿');
  expect(st.gaps >= 1 && st.gapItems.includes('holes.routes.cost'), '门洞加价口径缺口没列出：' + JSON.stringify(st.gapItems));
  expect(['0', '1'].includes(st.registered), '登记状态没写');
  if (st.registered === '1') expect(st.live?.registered?.sameAsLive === true, '登记文件与现算不一致：重跑 tools/refactor/nav-parity.mjs');
  report.pass = pageErrors(report).length === 0;
  if (!report.pass) throw Error('page errors: ' + pageErrors(report).join(' | '));
} catch (e) { report.failure = e.message; try { await shot('zz-failure'); } catch {} }
await finish();
