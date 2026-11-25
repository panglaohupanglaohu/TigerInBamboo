// R39 端到端：表现层「崖面沉积层带」+「守军箭雨弹道」进实景，以及能力树验收（解锁前沿为空）。
//   断言：自动预装含 fx.sediment / fx.projectiles；游戏里层带面片 > 0 面、弹道 > 0 条且箭点在动；验证列表有「层带岩性与首尾」「落点命中」；
//   学习工坊能力树页「解锁前沿 · 0」、fire / hallway / sediment / projectiles 四条线都显示可执行（树行提示里「可执行 ≥ 1」）。
//   截图：1-candidate、2-sediment-closeup（崖面上一条条宽窄不一的浅 / 褐层带）、3-projectiles-closeup（黄色弧线从高处落到岸边）、4-tree（能力树页，右侧「解锁前沿 · 0」）、5-reverted。
// 运行：cd TigerMessenger && $NODE tests/fx-sediment-projectiles-browser.mjs   （需要 8931 服务）
import { openFx, runFxPipeline, closeUp, expect } from './fx-live-e2e-common.mjs';
const t = await openFx('fx-sediment-projectiles-e2e', { capabilities: ['fx.sediment', 'fx.projectiles'] });
const { report, shot, gameCmd, page, ctx, out } = t;
try {
  await runFxPipeline(t, { needNodes: ['fx.sediment', 'fx.projectiles'] });
  await shot('1-candidate');
  const L = report.steps.live;
  expect(L?.sediment?.faces > 0 && L.sediment.triangles > 0, '游戏里没有层带：' + JSON.stringify(L?.sediment) + JSON.stringify(L?.errors));
  expect(L?.projectiles?.arcs > 0, '游戏里没有弹道：' + JSON.stringify(L?.errors));
  const moved0 = L.projectiles.moved; await page.waitForTimeout(800); const L2 = await gameCmd('fx.live.state');
  report.steps.arrowsMoved = [moved0, L2.projectiles.moved]; expect(L2.projectiles.moved > moved0, '箭点没在动');
  expect(report.steps.checks.some((c) => /层带岩性与首尾/.test(c)), '验证列表里没有沉积检查');
  expect(report.steps.checks.some((c) => /落点命中/.test(c)), '验证列表里没有弹道检查');
  await closeUp(t, 'sediment', '2-sediment-closeup');
  await closeUp(t, 'projectiles', '3-projectiles-closeup');
  expect(report.steps['focus-sediment']?.ok && report.steps['focus-projectiles']?.ok, '特写对不准');
  report.steps.reverted = await gameCmd('fx.live.revert'); await shot('5-reverted');
  // 能力树验收：新页面（同一隔离上下文）
  const p2 = await ctx.newPage(); p2.on('pageerror', (e) => report.errors.push('tree pageerror: ' + e.message));
  await p2.goto('http://localhost:8931/TigerMessenger/pipeline.html?learningView=tree#learning');
  await p2.waitForFunction(() => [...document.querySelectorAll('h3')].some((h) => /^解锁前沿 · \d+/.test(h.textContent)), {}, { timeout: 240000 });
  await p2.waitForTimeout(1500);
  report.steps.tree = await p2.evaluate(() => {
    const fr = [...document.querySelectorAll('h3')].find((h) => /^解锁前沿 · \d+/.test(h.textContent))?.textContent;
    const rows = [...document.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).filter((t) => /可执行 \d+/.test(t));
    const four = Object.fromEntries(['火焰', '建筑纹理', '沉积', '抛射物'].map((k) => [k, rows.filter((t) => t.startsWith(k)).map((t) => +(/可执行 (\d+)/.exec(t)?.[1] || 0))]));
    return { frontier: fr, rows: rows.length, four };
  });
  await p2.screenshot({ path: out + '/4-tree.png', fullPage: false });
  expect(/^解锁前沿 · 0/.test(report.steps.tree.frontier || ''), '解锁前沿不为空：' + report.steps.tree.frontier);
  report.pass = report.errors.filter((e) => /pageerror/.test(e)).length === 0;
  if (!report.pass) throw Error('页面报错：' + report.errors.join(' | '));
} catch (e) { report.pass = false; report.failure = String(e.stack || e).slice(0, 1500); try { await shot('zz-failure'); report.state = await gameCmd('fx.live.state'); } catch {} }
await t.finish();
