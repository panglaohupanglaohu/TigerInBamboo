const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 第 61 轮：1724449858369568780 —— 节点图"可存可载" + 可视化连线图
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1240, height: 900 } });
  const errors = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const report = {}, problems = [];
  try {
    await p.goto('http://localhost:8769/node-graph.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.nodeGraph && window.nodeGraph.ready, null, { timeout: 15000 });
    await p.waitForTimeout(300);

    // 1. 连线图真的画出来了（6 条边 7 个盒子）
    const wires = await p.evaluate(() => window.nodeGraph.wireStats());
    report.wires = wires;
    if (wires.nodes !== 7 || wires.edges !== 6) problems.push(`图不是 7 节点 6 边：${JSON.stringify(wires)}`);
    if (wires.paths !== 6) problems.push(`连线段 ${wires.paths} 条，应为 6`);
    if (wires.boxes !== 7) problems.push(`节点框 ${wires.boxes} 个，应为 7`);

    // 2. 先走一段，让 lerp 有当前值（导出的必须是"此刻"的状态，不是初始态）
    await p.evaluate(() => { window.nodeGraph.set(true); window.nodeGraph.tick(1.2); });
    const before = await p.evaluate(() => window.nodeGraph.position());
    report.beforeLoad = { y: +before.y.toFixed(3) };

    // 3. 导出当前图
    const exported = await p.evaluate(() => window.nodeGraph.exportJson());
    report.exportLen = exported.length;
    if (!/lerpTowards/.test(exported)) problems.push('导出 JSON 里没有 lerpTowards');
    const parsed = JSON.parse(exported);
    report.exportNodes = parsed.nodes.length;
    report.exportEdges = parsed.edges.length;
    if (parsed.nodes.length !== 7 || parsed.edges.length !== 6) problems.push('导出节点/边数不对');
    const lerpState = parsed.nodes.find((n) => n.id === 'lerp').state;
    report.exportedLerpValue = lerpState && +lerpState.value.toFixed(3);
    if (!(lerpState && Math.abs(lerpState.value - before.y) < 1e-6)) problems.push('导出的 lerp 当前值与页面不一致');

    // 4. 改 speed 后载入：参数确实换掉、位置不跳回
    const tweaked = JSON.parse(exported);
    const lerp = tweaked.nodes.find((n) => n.id === 'lerp');
    lerp.params.speed = 4;
    const msg = await p.evaluate((txt) => window.nodeGraph.importJson(txt), JSON.stringify(tweaked));
    report.importMsg = msg;
    const after = await p.evaluate(() => window.nodeGraph.position());
    const speedAfter = await p.evaluate(() => window.nodeGraph.serialize().nodes.find((n) => n.type === 'lerpTowards').params.speed);
    report.afterLoad = { y: +after.y.toFixed(3), speed: speedAfter };
    if (speedAfter !== 4) problems.push(`载入后 speed 应为 4，实得 ${speedAfter}`);
    if (Math.abs(after.y - before.y) > 0.5) problems.push(`载入后位置跳变：${before.y} → ${after.y}`);

    // 5. 载入后新 speed 真的生效（1 帧 dt=0.1 最多走 0.4，旧 speed 20 会走 2）
    await p.evaluate(() => window.nodeGraph.set(false));   // 目标 -226.9
    const y0 = (await p.evaluate(() => window.nodeGraph.position())).y;
    await p.evaluate(() => window.nodeGraph.tick(0.1));
    const y1 = (await p.evaluate(() => window.nodeGraph.position())).y;
    report.step = { y0: +y0.toFixed(3), y1: +y1.toFixed(3), delta: +Math.abs(y1 - y0).toFixed(3) };
    if (!(Math.abs(y1 - y0) <= 0.45)) problems.push(`新 speed 没生效：单帧走了 ${Math.abs(y1 - y0).toFixed(2)}`);

    // 6. 坏 JSON 不许把图弄坏
    const badMsg = await p.evaluate(() => window.nodeGraph.importJson('{"version":9}'));
    report.badMsg = badMsg;
    const stillOk = await p.evaluate(() => window.nodeGraph.wireStats());
    if (stillOk.nodes !== 7) problems.push('坏 JSON 载入后图被破坏');
    if (!/失败/.test(badMsg)) problems.push('坏 JSON 没有报错提示');

    // 7. 截图
    await p.evaluate(() => { document.getElementById('io').textContent = ''; window.nodeGraph.set(false); window.nodeGraph.tick(3); });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(out, 'r61-node-graph-wires.png'), clip: { x: 620, y: 0, width: 620, height: 520 } });
    await p.screenshot({ path: path.join(out, 'r61-node-graph-full.png'), fullPage: false });

    if (errors.length) problems.push('页面报错：' + errors.slice(0, 3).join(' | '));
    report.problems = problems;
    fs.writeFileSync(path.join(out, 'r61-node-graph.json'), JSON.stringify({ report, errors }, null, 2));
    console.log(JSON.stringify({ report, errors }, null, 1));
    console.log(problems.length ? 'FAIL: ' + problems.join('; ') : 'PASS');
  } finally {
    await b.close();
  }
})();
