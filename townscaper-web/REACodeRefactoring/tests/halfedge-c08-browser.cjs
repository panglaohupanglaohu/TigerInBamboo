// 运行验收：halfedge-c08.html（1458921394855718917「exploring the Half Edge data structure」）
// 口径：半边环/扇与「切四边形」局部编辑都必须能从页面跑出来并自证 —— 单边界环、Euler=1、零一致性错误、面积守恒。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const BASE = 'http://127.0.0.1:8769/halfedge-c08.html';
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const out = {};
  try {
    // ① 阶段 1.9：只画到「剩余区域边界环」—— 这是本片的主画面（彩色描线绕出剩余区域）
    await p.goto(BASE + '?t=1.9&seed=1');
    await p.waitForFunction(() => window.halfedgeC08);
    const loopStage = await p.evaluate(() => window.halfedgeC08);
    out.loopStage = loopStage;
    assert.ok(loopStage.loops >= 1, '剩余区域边界环至少一条');
    assert.equal(loopStage.errors, 0, '半边一致性错误应为 0');
    assert.match(await p.locator('#stat').innerText(), /剩余区域半边：边界环 \d+ 条/);
    await p.screenshot({ path: 'artifacts/coverage/halfedge-c08-loops.png' });

    // ② 阶段 3.2：方格 + 间隙三角合成一张半边网格 → 单一边界环、Euler=1
    await p.goto(BASE + '?t=3.2&seed=1');
    await p.waitForFunction(() => window.halfedgeC08);
    const mesh = await p.evaluate(() => window.halfedgeC08);
    out.mesh = mesh;
    assert.ok(mesh.quads > 0 && mesh.tris > 0, '方格与间隙三角都要有');
    assert.equal(mesh.euler, 1, '圆盘网格 Euler 应为 1');
    assert.equal(mesh.fullLoops, 1, '合并后应只有一条边界环');
    assert.equal(mesh.errors, 0, '整网半边一致性错误 0');
    assert.equal(mesh.splitCells, 0, '未开局部编辑时不应有切出三角');
    await p.screenshot({ path: 'artifacts/coverage/halfedge-c08-mesh.png' });

    // ③ 点「切四边形」：splitQuads 局部编辑 —— 四边格沿对角线切两个三角，重建半边后仍须流形
    await p.locator('#split').click();
    await p.waitForFunction(() => window.halfedgeC08 && window.halfedgeC08.splitCells > 0);
    const split = await p.evaluate(() => window.halfedgeC08);
    out.split = split;
    assert.ok(split.splitQuadsBefore > 0, '切之前应有四边格');
    assert.equal(split.splitCells, split.splitEdges * 2, '每个被切的四边格出两个三角');
    assert.ok(split.splitCells >= 2 && split.splitCells < split.splitQuadsBefore * 2 + 1, '只切一部分四边格');
    assert.equal(split.splitEuler, 1, '切完 Euler 仍为 1');
    assert.equal(split.splitLoops, 1, '切完仍只有一条边界环');
    assert.equal(split.splitErrors, 0, '切完半边一致性错误 0');
    assert.ok(split.splitAreaDelta < 1e-12, '切分是纯分割，面积必须守恒（实测 ' + split.splitAreaDelta + '）');
    assert.match(await p.locator('#stat').innerText(), /局部编辑（切四边形/);
    await p.screenshot({ path: 'artifacts/coverage/halfedge-c08-split.png' });

    // ④ 换种子：整套重新生成，编辑状态跟着重建
    await p.locator('#next').click();
    const next = await p.evaluate(() => window.halfedgeC08);
    out.nextSeed = next;
    assert.equal(next.seed, 2);
    assert.equal(next.euler, 1);
    assert.equal(next.errors, 0);
    assert.equal(next.splitEuler, 1, '换种子后编辑仍成立（split 参数保持）');

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/halfedge-c08-browser.json', JSON.stringify({ ...out, errors }, null, 2));
    console.log(JSON.stringify({
      loops: out.loopStage.loops, quads: out.mesh.quads, tris: out.mesh.tris, euler: out.mesh.euler, fullLoops: out.mesh.fullLoops,
      splitQuadsBefore: out.split.splitQuadsBefore, splitCells: out.split.splitCells, splitEdges: out.split.splitEdges,
      splitEuler: out.split.splitEuler, splitLoops: out.split.splitLoops, splitErrors: out.split.splitErrors, splitAreaDelta: out.split.splitAreaDelta,
      nextSeed: out.nextSeed.seed,
    }, null, 1));
    console.log('PASS halfedge-c08-browser');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
