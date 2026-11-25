// 十二门徒地形候选端到端共用部分（R29–R32）：开隔离上下文 → pipeline.html 选十二门徒 → 等岩体网格「稳定出现」再读状态（R29 竞态修复）→ 机位 / 截图 / 检查。
// 只读：候选开关只写本测试上下文的 localStorage（新的非持久上下文，关掉就没了），不保存任何岩体编辑，不点任何「采用 / 记为候选」。
import { createRequire } from 'node:module'; import path from 'node:path';
import { waitForStable } from '../../src/world/rea/stable-wait.js';
const require = createRequire(import.meta.url);
export const { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
export const BASE = 'http://localhost:8931/TigerMessenger/';
export const PROBE = './src/world/rea/apostlesLookProbe.js?v=apt-r1';
/** 网址参数写法 → APOSTLES_LOOK.id */
export const LOOK_ID = { approved: 'approved', soft: 'soft', 'soft,palette': 'palette+soft', palette: 'palette', latest: 'latest' };
export const fileName = (look) => look.replace(',', '+');
export const launch = () => chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
export const gameFrame = (page) => page.frames().find((f) => f.url().includes('/TigerMessenger/index.html'));

/** 新上下文打开系统工坊并切到十二门徒。look = 'approved' | 'soft' | 'soft,palette' …（approved 不写任何开关）。 */
export async function openApostles(browser, { look = 'approved', viewport = { width: 1500, height: 1500 }, errors = [] } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((v) => { try { localStorage.setItem('tm.apostles.look.v1', v); } catch {} }, look);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 240)); });
  await page.goto(BASE + 'pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#scene option')].some((o) => o.value === 'apostles'), {}, { timeout: 90000 });
  await page.locator('#scene').selectOption('apostles'); await page.locator('#edit').click();
  const frame = gameFrame(page); if (!frame) throw Error('找不到游戏 iframe');
  await frame.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
  return { ctx, page, errors };
}

/** R29：岩体网格连续 need 次「同一场景对象 + 同样块数 + 同一候选」才算稳定；iframe 重载时每次重新找 frame，读不到只清零不下结论。 */
export async function waitApostlesStable(page, { need = 3, interval = 1500, timeout = 300000, min = 1 } = {}) {
  return waitForStable(async () => { const f = gameFrame(page); if (!f) return null; return f.evaluate(async (p) => (await import(p)).sampleApostleState(), PROBE); }, { need, interval, timeout, min });
}
export const probeCall = (page, fn, ...args) => gameFrame(page).evaluate(async ([p, fn, args]) => (await import(p))[fn](...args), [PROBE, fn, args]);

/** 摆机位 → 等两帧 → 截游戏 iframe。返回机位信息（valid：镜头在海面以上且没被岩体挡住）。 */
export async function shootView(page, view, file, opts = {}) {
  const info = await probeCall(page, 'setApostleView', view, opts);
  await page.waitForTimeout(1800);
  await page.locator('#game').scrollIntoViewIfNeeded(); await page.locator('#game').screenshot({ path: file });
  return { ...info, file: path.basename(file) };
}
export const expect = (c, m) => { if (!c) throw Error(m); };
