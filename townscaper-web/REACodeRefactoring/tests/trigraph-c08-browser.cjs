// 运行验收：trigraph-c08.html（1677242779162877952「generic triangle graph … stress test … manifold and delauney-ish」）
// 口径：随机加点的同时，「局部编辑」（删点耳切重三角 + Lawson / 移点）必须仍然流形 + 近 Delaunay，且改动边可读。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const BASE = 'http://127.0.0.1:8769/trigraph-c08.html';
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const out = {};
  try {
    // ① 200 步增量插点：每步记新增/删除边差分，每 10 步全图复检
    await p.goto(BASE + '?steps=200');
    await p.waitForFunction(() => window.trigraphC08 && window.trigraphC08.audit);
    const grow = await p.evaluate(() => ({ step: trigraphC08.step, hot: trigraphC08.hot, audit: trigraphC08.audit, tris: trigraphC08.g.triangles().length, verts: trigraphC08.g.x.length - 3 }));
    out.grow = grow;
    assert.equal(grow.step, 200, '200 步全插完');
    assert.equal(grow.verts, 200, '200 个输入顶点');
    assert.ok(grow.tris > 300, '三角数随插点增长（实测 ' + grow.tris + '）');
    assert.ok(grow.hot > 0, '「刚改过的边」要有染色（实测 ' + grow.hot + ' 条）');
    assert.equal(grow.audit.manifold, true, '流形');
    assert.equal(grow.audit.delaunay, true, '近 Delaunay');
    assert.equal(grow.audit.degenerate, 0, '无退化三角');
    assert.ok(grow.audit.full, '全脸检查（不是抽样冒充全查）');
    await p.screenshot({ path: 'artifacts/coverage/trigraph-c08-insert.png' });

    // ② 删 5 点：星形环耳切重三角 + Lawson —— 局部编辑后仍是同一张流形图
    await p.locator('#del').click();
    await p.waitForFunction(() => window.trigraphC08.edits.removed === 5);
    const del = await p.evaluate(() => ({ edits: trigraphC08.edits, audit: trigraphC08.audit, tris: trigraphC08.g.triangles().length, removed: trigraphC08.g.removed.size }));
    out.del = del;
    assert.equal(del.edits.removed, 5);
    assert.equal(del.removed, 5, '被删的点记进 removed');
    assert.equal(del.audit.manifold, true, '删点后仍流形（孤立点已排除）');
    assert.equal(del.audit.delaunay, true, '删点后仍近 Delaunay');
    assert.equal(del.audit.full, true);
    await p.screenshot({ path: 'artifacts/coverage/trigraph-c08-delete.png' });

    // ③ 移 5 点（删 + 插，失败回滚）—— 顶点数不变、审计不破
    await p.locator('#move').click();
    await p.waitForFunction(() => window.trigraphC08.edits.moved === 5);
    const move = await p.evaluate(() => ({ edits: trigraphC08.edits, audit: trigraphC08.audit, live: trigraphC08.g.x.length - 3 - trigraphC08.g.removed.size }));
    out.move = move;
    assert.equal(move.edits.moved, 5);
    assert.equal(move.live, 195, '移点 = 删一个插一个，活跃顶点数不变（200-5）');
    assert.equal(move.audit.manifold, true, '移点后仍流形');
    assert.equal(move.audit.delaunay, true, '移点后仍近 Delaunay');

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/trigraph-c08-browser.json', JSON.stringify({ ...out, errors }, null, 2));
    console.log(JSON.stringify({
      step: grow.step, verts: grow.verts, tris: grow.tris, hot: grow.hot, manifold: grow.audit.manifold, delaunay: grow.audit.delaunay, full: grow.audit.full,
      afterDelete: { removed: del.edits.removed, tris: del.tris, manifold: del.audit.manifold, delaunay: del.audit.delaunay },
      afterMove: { moved: move.edits.moved, live: move.live, manifold: move.audit.manifold, delaunay: move.audit.delaunay },
    }, null, 1));
    console.log('PASS trigraph-c08-browser');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
