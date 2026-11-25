// R33–R36 导航端到端共用：新开隔离浏览器 → pipeline.html#battle（R21 直达）→ 等游戏连上、战役面板挂好、自动扫描完成。
// 每个脚本自己断言、自己写 report.json；这里只放取页面状态的小工具。不点「采用」，最后点「放弃」停战拆台。
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
export const BASE = 'http://localhost:8931/TigerMessenger/';
export const BATTLE_SCENES = ['apostles', 'citadel', 'moss', 'bookshop'];

export async function launch(name, { capabilities = [] } = {}) {
  const out = path.resolve(here, `../artifacts/${name}-e2e/run-${Date.now()}`); fs.mkdirSync(out, { recursive: true });
  const report = { out, capabilities, steps: {}, errors: [], pass: false };
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text().slice(0, 300)); });
  const shot = (n, target = page) => target.screenshot({ path: path.join(out, n + '.png') });
  const finish = async (code) => {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ pass: report.pass, failure: report.failure || null, out }, null, 1));
    await ctx.close(); await browser.close(); process.exit(code ?? (report.pass ? 0 : 1));
  };
  return { out, report, browser, ctx, page, shot, finish };
}
export const expect = (cond, msg) => { if (!cond) throw Error(msg); };
export const note = (page) => page.locator('#battle-workshop .agent-note').textContent();
export const gameFrame = (page) => page.frames().find((f) => f.url().includes('/TigerMessenger/index.html'));

/** 直达战役：等连上、等场景、等面板、等第一次扫描完 */
export async function openBattle(page) {
  await page.goto(BASE + 'pipeline.html#battle');
  await page.waitForFunction(() => document.querySelector('#connection')?.textContent.includes('游戏已连接'), {}, { timeout: 300000 });
  await page.waitForFunction((s) => document.body.dataset.layerFocus === 'battle' && s.includes(window.__tmCurrentScene), BATTLE_SCENES, { timeout: 300000 });
  await page.waitForFunction(() => document.querySelector('#battle-workshop .tier-lane'), {}, { timeout: 120000 });
  const f = gameFrame(page); await f.waitForFunction(() => !!globalThis.__tm?.scene && !!globalThis.__tm?.camera, {}, { timeout: 300000 });
  await page.waitForFunction(() => /扫描完成|扫描失败/.test(document.querySelector('#battle-workshop .agent-note')?.textContent || ''), {}, { timeout: 300000 });
  return page.evaluate(() => window.__tmCurrentScene);
}
/** 切场景并重新扫描（战役面板已挂载时切场景不会自动重扫） */
export async function switchScene(page, id) {
  if (await page.evaluate(() => window.__tmCurrentScene) !== id) {
    await page.locator('#scene').selectOption(id);
    await page.waitForFunction((x) => window.__tmCurrentScene === x, id, { timeout: 60000 });
  }
  await rescan(page);
}
export async function rescan(page) {
  await page.locator('#battle-workshop button', { hasText: '⟳ 扫描' }).first().click();
  await page.waitForFunction(() => /扫描中/.test(document.querySelector('#battle-workshop .agent-note')?.textContent || ''), {}, { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => /扫描完成|扫描失败/.test(document.querySelector('#battle-workshop .agent-note')?.textContent || ''), {}, { timeout: 300000 });
  return note(page);
}
/** 侧栏导航块里某个导航能力的扫描结果 */
export const navMatch = (page, id) => page.evaluate((x) => { const li = document.querySelector(`.nav-cap-list li[data-capability-id="${x}"]`); return li ? { count: Number(li.dataset.count), text: li.textContent } : null; }, id);
export const pipelineIds = (page) => page.evaluate(() => [...document.querySelectorAll('#battle-workshop .tier-node[data-node-id]')].map((n) => n.dataset.nodeId));
/** 能力不在管线里就走真实 UI 加进去：侧栏切「工坊分区」，双击卡片（与 battle-apostles-browser.mjs 同一路径） */
export async function ensureNodes(page, ids) {
  const have = await pipelineIds(page), missing = ids.filter((id) => !have.includes(id));
  if (missing.length) {
    await page.locator('#capability-sidebar button', { hasText: '工坊分区' }).click(); await page.waitForTimeout(500);
    for (const id of missing) { const card = page.locator(`#capability-sidebar .cap-item[data-capability-id="${id}"]`); await card.scrollIntoViewIfNeeded(); await card.dblclick(); await page.waitForTimeout(300); }
  }
  return { preloaded: ids.filter((id) => have.includes(id)), added: missing, now: await pipelineIds(page) };
}
/** ▶ 执行管线 → 等候选 → 读执行结果与验证项 */
export async function runPipeline(page) {
  await page.locator('#battle-workshop .tier-head-actions .primary').click();
  await page.waitForFunction(() => { const h = document.querySelector('#battle-workshop .agent-result h4'); return h && /候选/.test(h.textContent); }, {}, { timeout: 240000 });
  return page.evaluate(() => ({
    title: document.querySelector('#battle-workshop .agent-result h4')?.textContent,
    steps: [...document.querySelectorAll('#battle-workshop .agent-result > ul:not(.verify-checks) li')].map((li) => li.textContent.trim()),
    checks: [...document.querySelectorAll('#battle-workshop .verify-checks li')].map((li) => ({ status: (li.className.match(/check-(\w+)/) || [])[1], text: li.textContent.trim() })),
  }));
}
/** 实景导航状态（读真实的 __tmBattleStage / BattleNavigation） */
export const liveNav = (page) => gameFrame(page).evaluate(() => {
  const st = globalThis.__tmBattleStage, b = st?.battle, n = b?.navigation; if (!n) return null;
  const units = (b.units || []).filter((u) => !u.dead && !u.onBoat && !u.fall);
  let covered = 0, clips = 0, heavy = 0, heavyRadius = null;
  for (const u of units) { if (u.tmBody === 'heavy') { heavy++; heavyRadius = u.radius; } const node = n.unitNode(u); if (node && node.floor < st.world.top(node.cell)) { covered++; if (!n.discFits(node, u.x, u.z, u.radius ?? n.radius)) clips++; } }
  return { running: !!st.running, units: units.length, finePortals: !!n.finePortals, unitHeight: n.unitHeight, fine: n.fine?.stats?.() ?? null, graph: (() => { const s = n.graph.stats(); return { nodes: s.nodes, components: s.components, covered: s.covered }; })(),
    archesOn: !!st.archesOn, archCandidates: st.archColumns?.length || 0, footing: !!st.footing, covered, clips, heavy, heavyRadius, measure: (() => { try { return n.measureFooting(units); } catch (e) { return String(e.message); } })(), drawn: st.drawnFooting?.() ?? null, plan: st.plan?.navigation ? Object.keys(st.plan.navigation) : null };
});
export async function revert(page) { try { await page.locator('#battle-workshop button', { hasText: '放弃' }).first().click({ timeout: 5000 }); await page.waitForTimeout(800); } catch {} }
export const pageErrors = (report) => report.errors.filter((e) => e.startsWith('pageerror'));
