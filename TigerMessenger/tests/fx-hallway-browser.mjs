// R38 端到端：表现层「涂鸦走廊样板」—— build/doodle-hallway.js 的走廊（贴图 + cove + 拱门 + 楼梯）放在一座小屋旁。
//   断言：自动预装含 fx.hallway；候选后工坊里出现走廊展开面条（canvas 有多种颜色）；游戏里样板已放下、网格数 ≥ 3（墙壳 / 门 / 楼梯）、板数与计划一致；
//   验证列表里有「版式可独立复算」；回退后撤下。
//   截图：1-candidate（整页，侧栏能看到展开面条）、1b-strip（只截展开面条）、2-hallway-closeup（游戏画面特写：墙上有彩色分区和线稿、一道拱门、楼梯）、3-reverted。
// 运行：cd TigerMessenger && $NODE tests/fx-hallway-browser.mjs   （需要 8931 服务）
import { openFx, runFxPipeline, closeUp, expect } from './fx-live-e2e-common.mjs';
const t = await openFx('fx-hallway-e2e', { capabilities: ['fx.hallway'] });
const { report, shot, gameCmd, page } = t;
try {
  await runFxPipeline(t, { needNodes: ['fx.hallway'] });
  await shot('1-candidate');
  const strip = page.locator('#fx-workshop canvas.fx-hall-strip');
  report.steps.strip = await strip.evaluate((cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, s = new Set(); for (let i = 0; i < d.length; i += 16) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return { shown: getComputedStyle(cv).display !== 'none', colors: s.size, w: cv.width }; });
  expect(report.steps.strip.shown && report.steps.strip.colors >= 4, '展开面条没画出来：' + JSON.stringify(report.steps.strip));
  await strip.screenshot({ path: t.out + '/1b-strip.png' });
  const h = report.steps.live?.hallway;
  expect(h?.placed, '游戏里没有走廊样板：' + JSON.stringify(report.steps.live?.errors));
  expect(h.meshes >= 3, '走廊样板网格太少：' + h.meshes);
  expect(h.panels >= 4, '走廊板数太少：' + h.panels);
  expect(report.steps.checks.some((c) => /版式可独立复算/.test(c)), '验证列表里没有走廊检查');
  await closeUp(t, 'hallway', '2-hallway-closeup');
  expect(report.steps['focus-hallway']?.ok, '对不准走廊：' + JSON.stringify(report.steps['focus-hallway']));
  report.steps.reverted = await gameCmd('fx.live.revert'); report.steps.after = await gameCmd('fx.live.state'); await shot('3-reverted');
  expect(report.steps.after.active === false && report.steps.after.hallway.placed === false, '回退没撤下走廊');
  report.pass = report.errors.filter((e) => e.startsWith('pageerror')).length === 0;
  if (!report.pass) throw Error('页面报错：' + report.errors.join(' | '));
} catch (e) { report.pass = false; report.failure = String(e.stack || e).slice(0, 1500); try { await shot('zz-failure'); report.state = await gameCmd('fx.live.state'); } catch {} }
await t.finish();
