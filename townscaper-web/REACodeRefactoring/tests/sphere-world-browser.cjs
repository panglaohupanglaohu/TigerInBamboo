// 1768627849529893109「put this on a sphere」残差收口 · 浏览器实景验收（真实 GPU/three 渲染）
//   对象：sphere-world.html —— src/sphere/sphere-world.js 的最小渲染入口。
//   a) sphereGrid 的球面格真实渲染成三角面片 mesh（非有限顶点 0，全角点严格在 R 上）；
//   b) spherePick/sphereApply/sphereEdit 走通：球面 3D 点 build/erase/raise/level/paint，
//      渲染前后像素差非零；
//   c) encodeSphereWorld→decodeSphereWorld 进同规格 World：solid/rock/color/river 逐位相等、
//      再编码逐字相等、换渲染恢复出的世界逐像素一致（pixelDiff = 0）；
//   d) 接缝闭合：内部半边 twin 角点 3D 距离全 0 + GPU 顶点对账（共享角点引用数）+ 接缝特写截图。
// 截图 artifacts/coverage/sphere-world-{base,edit,seam}.png；报告 sphere-world-browser.json。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [], out = {};
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://localhost:8769/sphere-world.html');
    await p.waitForFunction(() => window.sphereWorldDemo?.ready, null, { polling: 100 });

    // a) 球面格真实渲染成 mesh
    out.stats = await p.evaluate(() => sphereWorldDemo.stats());
    assert.ok(out.stats.cells > 50, 'sphereGrid cells');
    assert.equal(out.stats.nonFinite, 0, 'non-finite mesh verts');
    assert.ok(out.stats.meshTris > out.stats.cells, 'mesh triangulated');
    // d) 接缝顶点对账（GPU 同源数据）
    out.seam = await p.evaluate(() => sphereWorldDemo.seamReport());
    assert.equal(out.stats.cornerRefsOnSphere, out.seam.cornerRefs, 'all corner refs strictly on R');
    assert.ok(out.seam.edgePairs > out.stats.cells, 'interior half-edges');
    assert.equal(out.seam.mismatched, 0, 'seam twin corners identical');
    assert.equal(out.seam.maxGap, 0, 'seam max gap');
    assert.ok(out.seam.uniqueCorners < out.seam.cornerRefs, 'corners welded (shared)');
    assert.ok(out.seam.weldedCornerRefs > out.seam.cornerRefs / 2, 'most corners shared');

    out.snap = await p.evaluate(() => sphereWorldDemo.snap('before'));
    await p.screenshot({ path: 'artifacts/coverage/sphere-world-base.png' });

    // b) 球面编辑 → 渲染变化
    out.edits = await p.evaluate(() => sphereWorldDemo.applyEdits());
    const real = out.edits.ops.filter((o) => o.cell !== null);
    assert.ok(real.every((o) => o.hit && o.changed === true), 'every in-patch edit changed something');
    const miss = out.edits.ops.find((o) => o.x === 30);
    assert.ok(miss && miss.hit === false, 'out-of-patch pick is a no-op');
    assert.equal(out.edits.solidCells, 5, 'edited cells solid');
    assert.deepEqual(out.edits.tops, { 41: 2, 144: 3, 363: 2, 532: 2, 606: 4 }, 'column tops after edits');
    out.editDiff = await p.evaluate(() => { sphereWorldDemo.snap('after'); return sphereWorldDemo.diff('before', 'after'); });
    assert.ok(out.editDiff.pixels > 5000, `render changed after edits (${out.editDiff.pixels}px)`);
    await p.screenshot({ path: 'artifacts/coverage/sphere-world-edit.png' });

    // c) 保存恢复往返 → 渲染逐像素一致
    out.roundtrip = await p.evaluate(() => sphereWorldDemo.roundtrip());
    assert.equal(out.roundtrip.specRoundTrip, true, 'spec round-trip');
    assert.equal(out.roundtrip.arraysEqual, true, 'voxel arrays identical');
    assert.equal(out.roundtrip.reencoded, true, 're-encode identical');
    assert.equal(out.roundtrip.pixelDiff, 0, `decoded world renders identically (${out.roundtrip.pixelDiff}px)`);

    // d) 接缝特写截图
    out.seamView = await p.evaluate(() => sphereWorldDemo.focusSeam());
    await p.screenshot({ path: 'artifacts/coverage/sphere-world-seam.png' });
    await p.evaluate(() => sphereWorldDemo.restoreView());

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/sphere-world-browser.json', JSON.stringify({ ...out, errors }, null, 2));
    console.log('PASS sphere-world browser', JSON.stringify({
      cells: out.stats.cells, meshTris: out.stats.meshTris,
      seamGap: out.seam.maxGap, welded: `${out.seam.weldedCornerRefs}/${out.seam.cornerRefs}`,
      editPx: out.editDiff.pixels, saveLen: out.roundtrip.saveLen, rtPx: out.roundtrip.pixelDiff,
    }));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
