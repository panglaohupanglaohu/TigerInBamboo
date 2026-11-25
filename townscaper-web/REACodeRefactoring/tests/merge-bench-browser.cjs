// 第 148 轮 A 类：1401145625572425728「引擎动态合批不够快 → 自写 mesh merger」的浏览器验收。
// 判据全部来自页面 save-mesh.html 的真实 WebGL 场景：提交次数（renderer.info.render.calls）、
// 逐帧耗时（每帧 readPixels 强制同步）、整片重建耗时（WorldMesh.rebuild）、三角一致、三角线框开/关像素。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], reports = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  try {
    await p.goto('http://localhost:8769/save-mesh.html');
    await p.waitForFunction(() => window.saveMesh?.api, null, { timeout: 180000 });

    for (const grid of ['mixed', 'quad']) {
      if (grid === 'quad') {
        await p.selectOption('#grid', 'quad');
        await p.waitForFunction(() => window.saveMesh?.api?.gridKind === 'quad', null, { timeout: 180000 });
      }
      // ① 合并 vs 小网格：提交次数、三角一致（同一份几何）
      const r = await p.evaluate(() => saveMesh.bench({ frames: 16, trisPerMesh: 64 }));
      assert.equal(r.split.meshes, Math.ceil(r.triangles / 64), `${grid} 小网格数应等于 ceil(三角/64)`);
      assert.ok(Math.abs(r.split.calls - r.split.meshes) < 1e-6, `${grid} 每个小网格一次提交 ${r.split.calls} vs ${r.split.meshes}`);
      assert.equal(r.merged.calls, 1, `${grid} 合并后必须 1 次提交`);
      assert.equal(r.merged.meshes, 1);
      assert.ok(r.sameTriangles && Math.round(r.split.triangles) === Math.round(r.triangles), `${grid} 切开/合并三角数必须一致`);
      assert.equal(Math.round(r.triangles), Math.round(await p.evaluate(() => saveMesh.api.view.worldMesh.stats.triangles)));
      assert.ok(r.callRatio > 30, `${grid} 提交比应 > 30，实为 ${r.callRatio}`);
      assert.ok(r.mergeMs > 0 && r.chunks >= 30, `${grid} 整片重建耗时/块数异常 ${r.mergeMs}/${r.chunks}`);

      // ② 提交次数 → 逐帧耗时的单调关系（8×8 视口，填充代价≈0，只剩提交开销）
      const sweep = [];
      for (const k of [16, 64, 256, 512]) {
        const s = await p.evaluate(k => saveMesh.bench({ frames: 16, trisPerMesh: k, tiny: true }), k);
        sweep.push({ trisPerMesh: k, calls: s.split.calls, ms: s.split.ms, mergedMs: s.merged.ms, speedup: s.speedup });
      }
      for (let i = 1; i < sweep.length; i++) assert.ok(sweep[i].calls < sweep[i - 1].calls, `${grid} 提交数应随 trisPerMesh 递减`);
      assert.ok(sweep[0].ms - sweep[sweep.length - 1].ms > 1, `${grid} 提交多的应明显更慢：${JSON.stringify(sweep)}`);
      const slope = (sweep[0].ms - sweep[sweep.length - 1].ms) / (sweep[0].calls - sweep[sweep.length - 1].calls);

      // ③ 整片重建可重复：invalidate 后重建三角数与缓存块不变
      const rebuild = await p.evaluate(() => { const w = saveMesh.api.view.worldMesh, a = { ...w.stats }; w.invalidate(); const t0 = performance.now(); w.rebuild(); saveMesh.api.view.render(0); return { before: a, after: { ...w.stats }, ms: +(performance.now() - t0).toFixed(1) }; });
      assert.equal(rebuild.after.triangles, rebuild.before.triangles, `${grid} 重建三角数应不变`);
      assert.equal(rebuild.after.chunks, rebuild.before.chunks, `${grid} 重建块数应不变`);

      // ④ 三角线框（片 0036–0078 那个视图：白线叠在着色面上）：图层段数 + 开/关像素差 + 回位 0（先冻主循环）
      const wire = await p.evaluate(async () => {
        const v = saveMesh.api.view, orig = v.render.bind(v); v.render = () => {};
        const gl = v.renderer.domElement, c = document.createElement('canvas'); c.width = 300; c.height = 300; const g = c.getContext('2d');
        const grab = () => { orig(0); g.clearRect(0, 0, 300, 300); g.drawImage(gl, 0, 0, 300, 300); return g.getImageData(0, 0, 300, 300).data; };
        const A = grab(); const on = await saveMesh.wire(true); const B = grab(); const png = c.toDataURL('image/png');
        const off = await saveMesh.wire(false); const C = grab(); v.render = orig;
        const diff = (x, y) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 24) n++; return n; };
        return { on: diff(A, B), back: diff(A, C), png, layer: on, removed: !off.on, triangles: on.triangles };
      });
      assert.ok(wire.layer.on && wire.removed, `${grid} 线框层应能加上并摘掉`);
      // WireframeGeometry 会把共享边去掉一次：闭合流形是 1.5×三角，带开边（地形外圈/裙边）会更高，上限 3×三角（逐三角三条边）
      const perTri = wire.layer.segments / wire.layer.triangles;
      assert.ok(perTri >= 1.5 && perTri <= 3, `${grid} 线框段数/三角应在 [1.5,3]，实为 ${perTri.toFixed(3)}`);
      assert.ok(wire.on > 2000, `${grid} 线框开/关差分过小 ${wire.on}`);
      assert.equal(wire.back, 0, `${grid} 关掉线框应逐像素回位，实为 ${wire.back}`);
      fs.writeFileSync(`artifacts/coverage/save-mesh-wire-${grid}-r148.png`, Buffer.from(wire.png.split(',')[1], 'base64'));

      reports.push({ grid, bench: { split: r.split, merged: r.merged, callRatio: r.callRatio, speedup: r.speedup, sameTriangles: r.sameTriangles, mergeMs: r.mergeMs, chunks: r.chunks, triangles: r.triangles, scope: r.scope }, sweep, slopeUsPerSubmit: +(slope * 1000).toFixed(2), rebuild: { ms: rebuild.ms, triangles: rebuild.after.triangles, chunks: rebuild.after.chunks }, wire: { on: wire.on, back: wire.back, segments: wire.layer.segments, triangles: wire.layer.triangles } });
    }

    // ⑤ 页面按钮路径：点「合并对照」后状态栏必须吐出三个数（先清空状态，否则会被上面 evaluate 调用的读数冒充）
    await p.evaluate(() => { document.querySelector('#status').textContent = '__pending__'; });
    await p.click('#bench');
    await p.waitForFunction(() => { const t = document.querySelector('#status').textContent; return t !== '__pending__' && /提交比/.test(t); }, null, { timeout: 120000 });
    const status = await p.textContent('#status');
    assert.ok(/整片重建 \d/.test(status), '状态栏应报整片重建耗时：' + status);
    assert.ok(/小网格 330 个/.test(status), '按钮默认 trisPerMesh=64 时四边格应是 330 个小网格：' + status);
    await p.locator('#scene').screenshot({ path: 'artifacts/coverage/save-mesh-bench-panel-r148.png' });

    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/merge-bench-browser.json', JSON.stringify({ reports, status, errors }, null, 2));
    console.log('PASS merge-bench', reports.map(r => ({ grid: r.grid, calls: `${r.bench.split.calls}→${r.bench.merged.calls}`, ratio: r.bench.callRatio, speedup: +r.bench.speedup.toFixed(2), mergeMs: r.bench.mergeMs, slopeUs: r.slopeUsPerSubmit, wire: r.wire.on })), status.slice(0, 160));
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
