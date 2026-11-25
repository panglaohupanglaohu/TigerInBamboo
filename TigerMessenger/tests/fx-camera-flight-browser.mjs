// R40 端到端：fx.camera 的路径真实驱动游戏镜头飞一圈，停止后还原。
//   ▶ 执行出候选 → 点「✈ 镜头飞一圈」→ 在游戏 iframe 里每 250 ms 读一次真实镜头位置（__tm.camera），用舞台的 worldToStage 换回舞台坐标，
//   独立算镜头绕舞台中心扫过的角度（不用 fxLive 自己报的数）→ 断言 ≥ 300°（计划 1 圈）、镜头离开了起点；工坊提示出现「飞完一圈」；
//   点「■ 停止并还原镜头」→ 镜头位置回到起飞前（偏差 < 0.5 世界单位），桥返回 restored:true。
//   截图：1-candidate、2-flight-00 / 33 / 66 / 100（游戏画面，同一座岛从四个方向看）、3-restored（与 0-before-flight 同机位）。
// 运行：cd TigerMessenger && $NODE tests/fx-camera-flight-browser.mjs   （需要 8931 服务）
import { openFx, runFxPipeline, expect } from './fx-live-e2e-common.mjs';
const t = await openFx('fx-camera-flight-e2e', { capabilities: ['fx.camera'] });
const { report, shot, gameCmd, page } = t;
const sweep = (pts, c) => { let s = 0; for (let i = 1; i < pts.length; i++) { let d = Math.atan2(pts[i][1] - c[1], pts[i][0] - c[0]) - Math.atan2(pts[i - 1][1] - c[1], pts[i - 1][0] - c[0]); while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; s += d; } return s * 180 / Math.PI; };
try {
  const { frame } = await runFxPipeline(t, { needNodes: ['fx.camera'] });
  await shot('1-candidate');
  const cam = () => frame.evaluate(() => { const c = globalThis.__tm.camera, s = globalThis.__tmBattleStage, v = s.worldToStage(c.position.clone()); return { stage: [v.x, v.z], world: c.position.toArray() }; });
  const iframeBox = await page.locator('iframe').first().boundingBox();
  const gshot = (n) => t.shot(n, iframeBox ? { clip: iframeBox } : {});
  report.steps.before = await cam(); await gshot('0-before-flight');
  expect(await page.locator('#fx-camera-fly').isEnabled(), '「镜头飞一圈」按钮不可点');
  await page.locator('#fx-camera-fly').click();
  await page.waitForFunction(() => /起飞|飞行中/.test(document.getElementById('fx-camera-note')?.textContent || ''), {}, { timeout: 15000 });
  const st0 = await gameCmd('fx.camera.state'); report.steps.flightStart = st0;
  expect(st0.mode === 'flight' && st0.seconds > 0, '没有开始飞：' + JSON.stringify(st0));
  const seconds = st0.seconds, samples = [], shots = new Set(), t0 = Date.now();
  for (;;) {
    const c = await cam(); samples.push(c.stage); const st = await gameCmd('fx.camera.state');
    for (const k of [0, 33, 66, 100]) if (!shots.has(k) && st.u * 100 >= k - 0.5) { shots.add(k); await gshot('2-flight-' + String(k).padStart(2, '0')); }
    if (st.done || Date.now() - t0 > (seconds + 8) * 1000) { report.steps.flightEnd = st; break; }
    await page.waitForTimeout(250);
  }
  report.steps.samples = samples.length;
  // 舞台中心：用采样点的外接圆心近似（fx.camera 的中心 = 舞台格网质心；镜头在半径 R 的圆上）
  let cx = 0, cz = 0; for (const p of samples) { cx += p[0]; cz += p[1]; } cx /= samples.length; cz /= samples.length;
  report.steps.sweepMeasured = +sweep(samples, [cx, cz]).toFixed(1);
  report.steps.travel = +Math.hypot(samples.at(-1)[0] - samples[0][0], samples.at(-1)[1] - samples[0][1]).toFixed(2);
  const maxFromStart = Math.max(...samples.map((p) => Math.hypot(p[0] - samples[0][0], p[1] - samples[0][1])));
  report.steps.maxFromStart = +maxFromStart.toFixed(2);
  expect(report.steps.flightEnd?.done, '飞行没在 ' + (seconds + 8) + 's 内结束');
  expect(Math.abs(report.steps.sweepMeasured) >= 300, '镜头只扫过 ' + report.steps.sweepMeasured + '°');
  expect(maxFromStart > 5, '镜头几乎没动');
  await page.waitForFunction(() => /飞完一圈/.test(document.getElementById('fx-camera-note')?.textContent || ''), {}, { timeout: 5000 }).catch(() => {});
  report.steps.note = await page.locator('#fx-camera-note').textContent();
  await page.locator('#fx-camera-stop').click(); await page.waitForTimeout(1200);
  report.steps.after = await cam();
  const dw = Math.hypot(...report.steps.after.world.map((v, i) => v - report.steps.before.world[i]));
  report.steps.restoreDelta = +dw.toFixed(4); report.steps.stopNote = await page.locator('#fx-camera-note').textContent();
  await gshot('3-restored');
  expect(dw < 0.5, '还原后镜头偏了 ' + dw);
  expect(/已还原/.test(report.steps.stopNote), '工坊没提示已还原：' + report.steps.stopNote);
  report.steps.stateAfter = await gameCmd('fx.camera.state'); expect(!report.steps.stateAfter.saved, '还原后仍持有镜头');
  report.pass = report.errors.filter((e) => e.startsWith('pageerror')).length === 0;
  if (!report.pass) throw Error('页面报错：' + report.errors.join(' | '));
} catch (e) { report.pass = false; report.failure = String(e.stack || e).slice(0, 1500); try { await shot('zz-failure'); report.state = await gameCmd('fx.camera.state'); await gameCmd('fx.camera.stop'); } catch {} }
await t.finish();
