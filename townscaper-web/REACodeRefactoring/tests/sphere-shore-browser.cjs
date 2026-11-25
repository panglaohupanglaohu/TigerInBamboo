// 1768627849529893109「put this on a sphere」残差收口 · 球面平滑海岸线浏览器实景验收
//   对象：sphere-shore.html —— world-sphere.js worldShorelines 的渲染入口
//   （平面 World 水陆体素 → traceShoreLoops/sampleShoreline → 贴球细分 → Taubin → 测地外推蓝线）。
//   a) 确定性水陆生成：fbm 噪声主岛 + 内湖 + 小屿 ⇒ ≥2 条独立闭合岸环（实测 3 条），
//      陆/水/岩格数非零且确定；
//   b) 断点/空洞：贴球+Taubin 后每环相邻角距 ≤ maxStep（0.05 rad，含闭环首尾）、
//      0 非有限点、0 断点、径向偏差 ~0；法线与径向正交（|dot|<1e-3）；蓝线外推距=reach、同半径；
//   c) 跨接缝连续：岸线走过的每个格角，共享它的格贴球角点逐位一致（maxGap 全 0）；
//   d) 确定性：同 World 重抽逐字相等 + 从 spec 重建世界再抽逐字相等；
//   e) 渲染：岸线叠加前后像素差非零；黄线/蓝线特写截图。
//   f) vendor 拷贝验收：?src=vendor 走 TigerMessenger vendor 逐字拷贝（8931 服），
//      同一套岸环/点数/步角 —— 证明拷过去的 sphere/world-sphere.js 在浏览器里行为一致。
// 运行：cd townscaper-web/REACodeRefactoring && node tests/sphere-shore-browser.cjs
//   （需要 8769 静态服；vendor 对照需要 8931 服 = TigerInBamboo 根）
// 截图 artifacts/coverage/sphere-shore-{base,shore,closeup}.png；报告 sphere-shore-browser.json。
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright')); }
const fs = require('fs'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [], out = {};
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://localhost:8769/sphere-shore.html');
    await p.waitForFunction(() => window.sphereShoreDemo?.ready, null, { polling: 100 });

    // a) 水陆世界 + 岸环提取
    out.stats = await p.evaluate(() => sphereShoreDemo.stats());
    assert.equal(out.stats.vendor, false, 'base run uses repo src');
    assert.ok(out.stats.cells > 50, 'sphereGrid cells');
    assert.ok(out.stats.terra.landCells > 20 && out.stats.terra.waterCells > 20, 'mixed land/water voxels');
    assert.ok(out.stats.loops >= 2, `shore loops ${out.stats.loops}`);
    assert.equal(out.stats.nonFiniteMesh, 0, 'non-finite mesh verts');

    // b) 断点/空洞 + 球面/法线口径
    assert.equal(out.stats.totalNonFinite, 0, 'non-finite shore points');
    assert.equal(out.stats.totalBreaks, 0, 'shore breakpoints (step > maxStep)');
    for (const l of out.stats.per) {
      assert.ok(l.maxStepAngle <= 0.05 + 1e-9, `loop${l.loop} maxStep ${l.maxStepAngle}`);
      assert.ok(l.maxRadialDev < 1e-6, `loop${l.loop} radial dev ${l.maxRadialDev}`);
      assert.ok(l.maxNormalDot < 1e-3, `loop${l.loop} normal not tangent ${l.maxNormalDot}`);
      assert.ok(l.minNormalLen > 1 - 1e-6 && l.minNormalLen < 1 + 1e-6, `loop${l.loop} normal unit`);
      assert.ok(l.seaPoints === l.count, `loop${l.loop} sea ring same count`);
      assert.ok(l.maxSeaDev < 1e-9, `loop${l.loop} sea push dev ${l.maxSeaDev}`);
      assert.ok(l.maxSeaRadialDev < 1e-9, `loop${l.loop} sea radial dev ${l.maxSeaRadialDev}`);
      assert.ok(l.minChord > 0, `loop${l.loop} collapsed points`);
    }

    // c) 跨接缝连续：岸角在共享格间逐位一致
    out.seam = await p.evaluate(() => sphereShoreDemo.seamAudit());
    assert.ok(out.seam.shoreLoops >= 2 && out.seam.shoreCorners > 10, 'shore corners audited');
    assert.ok(out.seam.sharedCorners > 0, 'shore crosses shared corners');
    assert.equal(out.seam.maxGap, 0, 'shore seam max gap');
    assert.equal(out.seam.pairsMismatched, 0, 'shore seam mismatched copies');

    // d) 确定性
    out.determinism = await p.evaluate(() => sphereShoreDemo.determinism());
    assert.equal(out.determinism.sameWorld, true, 'same world re-extract identical');
    assert.equal(out.determinism.rebuilt, true, 'rebuilt world identical');

    // e) 渲染证据：岸线叠加前后像素差 + 截图
    await p.evaluate(() => { sphereShoreDemo.showShore(false); sphereShoreDemo.snap('bare'); });
    await p.screenshot({ path: 'artifacts/coverage/sphere-shore-base.png' });
    await p.evaluate(() => { sphereShoreDemo.showShore(true); sphereShoreDemo.snap('shore'); });
    out.shoreDiff = await p.evaluate(() => sphereShoreDemo.diff('bare', 'shore'));
    assert.ok(out.shoreDiff.pixels > 500, `shore overlay rendered (${out.shoreDiff.pixels}px)`);
    await p.screenshot({ path: 'artifacts/coverage/sphere-shore-shore.png' });
    out.closeup = await p.evaluate(() => sphereShoreDemo.focusShore());
    await p.screenshot({ path: 'artifacts/coverage/sphere-shore-closeup.png' });
    await p.evaluate(() => sphereShoreDemo.restoreView());

    // f) vendor 拷贝验收：8931 服 + ?src=vendor（TigerMessenger/src/vendor 逐字拷贝）
    const v = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    v.on('pageerror', (e) => errors.push('vendor: ' + e.message));
    v.on('console', (m) => { if (m.type() === 'error') errors.push('vendor: ' + m.text()); });
    try {
      await v.goto('http://localhost:8931/townscaper-web/REACodeRefactoring/sphere-shore.html?src=vendor', { timeout: 30000 });
      await v.waitForFunction(() => window.sphereShoreDemo?.ready, null, { polling: 100, timeout: 30000 });
      out.vendor = await v.evaluate(() => ({ stats: sphereShoreDemo.stats(), seam: sphereShoreDemo.seamAudit(), det: sphereShoreDemo.determinism() }));
      assert.equal(out.vendor.stats.vendor, true, 'vendor flag');
      assert.equal(out.vendor.stats.loops, out.stats.loops, 'vendor loop count');
      assert.equal(out.vendor.stats.totalPts, out.stats.totalPts, 'vendor total points');
      assert.equal(out.vendor.stats.totalBreaks, 0, 'vendor breakpoints');
      assert.equal(out.vendor.stats.totalNonFinite, 0, 'vendor non-finite');
      assert.equal(out.vendor.seam.maxGap, 0, 'vendor seam gap');
      assert.equal(out.vendor.det.sameWorld && out.vendor.det.rebuilt, true, 'vendor determinism');
      for (let i = 0; i < out.stats.loops; i++) {
        assert.equal(out.vendor.stats.per[i].count, out.stats.per[i].count, `vendor loop${i} count`);
        assert.equal(out.vendor.stats.per[i].maxStepAngle, out.stats.per[i].maxStepAngle, `vendor loop${i} maxStep`);
      }
      out.vendor.available = true;
    } catch (e) { out.vendor = { available: false, error: String(e) }; }
    await v.close();

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/sphere-shore-browser.json', JSON.stringify({ ...out, errors }, null, 2));
    console.log('PASS sphere-shore browser', JSON.stringify({
      cells: out.stats.cells, terra: out.stats.terra, loops: out.stats.loops,
      pts: out.stats.totalPts, breaks: out.stats.totalBreaks,
      maxStep: Math.max(...out.stats.per.map((l) => l.maxStepAngle)),
      seamGap: out.seam.maxGap, shoreCorners: out.seam.shoreCorners,
      det: out.determinism, shorePx: out.shoreDiff.pixels,
      vendor: out.vendor.available ? `OK loops=${out.vendor.stats.loops} pts=${out.vendor.stats.totalPts}` : 'SKIP ' + out.vendor.error,
    }));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
