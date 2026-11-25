// R-A3 + R-A5 端到端：管线页「当前默认」栏（#defaults-summary ← defaults-panel.js ← defaults-ui.js ← defaults.js）。
//   新的非持久上下文 → pipeline.html#scene → defaults-panel mount 时 seedPendingDefaults 写入 4 条 pending 种子
//   + P-R32-01 决议落实（apostles:apostles-terrain → active approved；用户 2026-11-24 认可现状）
//   → 页面里用 localStorage 合并写入 2 条 active 记录（citadel:mountain / old-port:relief，覆盖同名 pending 种子）→ 刷新 →
//   共 5 行：3 条 active 显示能力名 + 「手动采用 / 按实测选优代选」，2 条 pending 显示「待你决定 · P-Rxx」→
//   点撤回 citadel:mountain → active 记录删除、行消失，pending 种子不受影响；无 game 连接时不报错。
//   另开一页全新上下文（不共享 localStorage）→ 4 条 pending + 1 条 apostles 已决 approved。
//   注意：不用 addInitScript 注入——它会在游戏 iframe 每次重载时重跑，把 tm.defaults.v1 重置回种子快照，
//   把面板刚补的 pending 记录抹掉（实测过的坑）。改为页面就绪后直接写 localStorage 再刷新。
//   截图：with-defaults.png、empty.png、after-revert.png、pending-seeds.png。只写 tm.defaults.v1，不碰别的存储。
// 运行：cd TigerMessenger && $NODE tests/defaults-panel-browser.mjs   （需要 8931 服务）
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../artifacts/defaults-panel-e2e/run-' + Date.now()); fs.mkdirSync(out, { recursive: true });
const report = { out, steps: {}, errors: [], pass: false };
const expect = (c, m) => { if (!c) throw Error(m); };
const ACTIVE = {
  'citadel:mountain': { capabilityId: 'mountain.pipeline', planId: 'citadel-m1', plan: null, adoptedBy: 'user', at: '2026-11-24T01:00:00.000Z', source: 'workshop', note: '测试' },
  'old-port:relief': { capabilityId: 'relief.soft', planId: null, plan: null, adoptedBy: 'auto-test', at: '2026-11-24T02:00:00.000Z', source: 'auto-test', note: '' },
};
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
try {
  // A：先进页面让 pending 种子落库 → 合并写入 2 条 active → 刷新 → 5 行
  const A = await ctx.newPage(); A.on('pageerror', (e) => report.errors.push('A pageerror: ' + e.message));
  await A.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await A.waitForSelector('#defaults-summary tr[data-defaults-row]', { timeout: 30000 });
  await A.evaluate((active) => {
    const d = JSON.parse(localStorage.getItem('tm.defaults.v1') || '{"v":1,"records":{}}');
    d.records = d.records || {};
    for (const [k, r] of Object.entries(active)) d.records[k] = { ...r, status: 'active', pendingRef: null };
    localStorage.setItem('tm.defaults.v1', JSON.stringify(d));
  }, ACTIVE);
  await A.reload();
  await A.waitForSelector('#defaults-summary table tr[data-defaults-row]', { timeout: 30000 });
  await A.waitForTimeout(400);
  report.steps.A = await A.evaluate(() => ({ rows: [...document.querySelectorAll('#defaults-summary tr[data-defaults-row]')].map((r) => r.dataset.defaultsRow), text: document.getElementById('defaults-summary').textContent.slice(0, 500) }));
  await A.locator('#defaults-summary').screenshot({ path: path.join(out, 'with-defaults.png') });
  expect(report.steps.A.rows.length === 5, '应有 5 行（3 active + 2 pending 种子）：' + JSON.stringify(report.steps.A.rows));
  for (const k of ['citadel:mountain', 'old-port:relief', 'citadel:building', 'crystal:building', 'apostles:apostles-terrain'])
    expect(report.steps.A.rows.includes(k), '缺行 ' + k + '：' + JSON.stringify(report.steps.A.rows));
  expect(/mountain\.pipeline/.test(report.steps.A.text) && /relief\.soft/.test(report.steps.A.text), 'active 记录能力 id 没显示：' + report.steps.A.text);
  expect(/手动采用|按实测选优代选/.test(report.steps.A.text), '「谁定的」没显示');
  // R-A5 pending 显示：状态文案代替能力名，带 pendingRef；P-R32-01 已决 → apostles 行是 approved 正式默认
  expect(/apostles\.look/.test(report.steps.A.text) && !/待实测选出/.test(report.steps.A.text), 'apostles 应显示已决 approved 默认而非待实测：' + report.steps.A.text);
  expect(/待你决定 · P-R57-01/.test(report.steps.A.text), 'building pending-user 没显示「待你决定 · P-R57-01」：' + report.steps.A.text);
  expect((report.steps.A.text.match(/待你决定/g) || []).length >= 2, '应有两条 building 待决定');
  // 撤回 citadel:mountain（active，无游戏连接也应删登记；pending 种子不受影响）
  const row = A.locator('#defaults-summary tr[data-defaults-row="citadel:mountain"]');
  await row.locator('button', { hasText: '撤回' }).click();
  await A.waitForTimeout(600);
  report.steps.afterRevert = await A.evaluate(() => ({ rows: [...document.querySelectorAll('#defaults-summary tr[data-defaults-row]')].map((r) => r.dataset.defaultsRow), stored: JSON.parse(localStorage.getItem('tm.defaults.v1') || '{}').records }));
  await A.locator('#defaults-summary').screenshot({ path: path.join(out, 'after-revert.png') });
  expect(!report.steps.afterRevert.rows.includes('citadel:mountain'), '撤回后 citadel:mountain 还在：' + JSON.stringify(report.steps.afterRevert.rows));
  expect(report.steps.afterRevert.stored && report.steps.afterRevert.stored['old-port:relief'], '撤回不该动别的记录');
  expect(report.steps.afterRevert.stored['citadel:building']?.status === 'pending-user', 'pending 种子不该被撤回影响');
  // B：全新上下文（不共享 A 的 localStorage）→ mount 时种子写入 4 条 pending + apostles 已决 approved
  const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const B = await ctx2.newPage(); B.on('pageerror', (e) => report.errors.push('B pageerror: ' + e.message));
  await B.goto('http://localhost:8931/TigerMessenger/pipeline.html#scene');
  await B.waitForSelector('#defaults-summary table tr[data-defaults-row]', { timeout: 30000 });
  await B.waitForTimeout(400);
  report.steps.B = await B.evaluate(() => ({ rows: [...document.querySelectorAll('#defaults-summary tr[data-defaults-row]')].map((r) => r.dataset.defaultsRow), text: document.getElementById('defaults-summary').textContent.slice(0, 500) }));
  await B.locator('#defaults-summary').screenshot({ path: path.join(out, 'pending-seeds.png') });
  expect(report.steps.B.rows.length === 5, 'B 应有 5 行（4 pending + 1 已决）：' + JSON.stringify(report.steps.B.rows));
  expect(/apostles\.look/.test(report.steps.B.text) && /待你决定/.test(report.steps.B.text), 'B 没显示已决 apostles / pending 状态：' + report.steps.B.text);
  report.pass = true;
} catch (e) { report.failure = e.message; }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
