// 光影与生命 / 多种子分布端到端共用部分（R62–R70）：新的非持久隔离上下文 → pipeline.html → 选场景 → 游戏 iframe 就绪。
// 只读 / 只预览：不点「记为候选」以外的写入；候选只在本测试上下文里，关掉就没了；不改存档、不碰湖上建筑。
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
export const { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
export const BASE = 'http://localhost:8931/TigerMessenger/';
export const CANDIDATE = './src/world/rea/lightlifeCandidate.js?v=light-r66';
export const launch = () => chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
export const gameFrame = (page) => page.frames().find((f) => f.url().includes('/TigerMessenger/index.html'));
export const expect = (c, m) => { if (!c) throw Error(m); };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** artifacts/<name>/run-<时间戳>/（按 TigerMessenger 目录算，不随当前目录漂） */
export function runDir(here, name) { const out = path.resolve(here, '../artifacts/' + name + '/run-' + Date.now()); fs.mkdirSync(out, { recursive: true }); return out; }
export function writeReport(out, report) { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out }, null, 1)); }

/** 新上下文打开系统工坊并切到场景 id（默认苔庭 moss；环境变量 SCENE 可改）。 */
export async function openScene(browser, { scene = process.env.SCENE || 'moss', viewport = { width: 1600, height: 1400 }, errors = [] } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 240)); });
  await page.goto(BASE + 'pipeline.html#scene');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction((id) => [...document.querySelectorAll('#scene option')].some((o) => o.value === id), scene, { timeout: 90000 });
  await page.locator('#scene').selectOption(scene); await page.locator('#edit').click();
  await page.waitForFunction((id) => window.__tmCurrentScene === id, scene, { timeout: 120000 });
  const frame = gameFrame(page); if (!frame) throw Error('找不到游戏 iframe');
  await frame.waitForFunction(() => !!globalThis.__tm?.scene, {}, { timeout: 300000 });
  return { ctx, page, errors, scene };
}
export const candidateCall = (page, fn, ...args) => gameFrame(page).evaluate(async ([p, fn, args]) => (await import(p))[fn](...args), [CANDIDATE, fn, args]);
/** 摆固定机位 → 等两帧 → 截游戏 iframe */
export async function shootPose(page, pose, file) {
  const info = await candidateCall(page, 'cameraPose', { pose });
  await page.waitForTimeout(1800);
  await page.locator('#game').scrollIntoViewIfNeeded(); await page.locator('#game').screenshot({ path: file });
  return { ...info, file: path.basename(file) };
}
export const pageErrors = (errors) => errors.filter((e) => e.startsWith('pageerror'));
