// r184 · 901469409579061248 运行验收（浏览器）：主场景真的走 corridor 尾迹档。
// 判据全部来自页面里的真 View / 真 Boats（不是 node 里的替身）：
//   ① 两条带状边线间距逐段恒定（CV≈0），且等于 2·latOffset；
//   ② 泡沫行按里程成排、行内跳格（有空格）；
//   ③ 远端淡出：带状 alpha 单调递减、边线比泡沫行拖得远（reach.edge > reach.row）；
//   ④ 同页构造 V 档 Boats 作反向对照：间距必须张开 >1.3×；
//   ⑤ 页面上「旧 Kelvin V」下拉真的能把整页切到 V 档（UI 接线）；
//   ⑥ 0 console error；截图交人工看（ViewImage）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const reports = [], errors = [];
  try {
    for (const grid of ['mixed', 'quad']) {
      const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
      // 起页：serve.py 偶发 reset 会让 iframe 变错误页（r166 记过），失败重开一次
      let booted = false;
      for (let attempt = 0; attempt < 2 && !booted; attempt++) {
        await p.goto('http://localhost:8769/wake-fog.html');
        if (grid === 'quad') await p.selectOption('#grid', grid);
        booted = await p.waitForFunction(() => window.wakeFog?.api?.view?.boats?.boats?.length > 0, null, { timeout: 45000 }).then(() => true).catch(() => false);
      }
      assert.ok(booted, grid + ' 页面起不来（iframe 未就绪）');
      await p.locator('#follow').setChecked(true);
      const r = await p.evaluate(async () => {
        const { api } = window.wakeFog, { view, world } = api, boats = view.boats, time = view.waterUniforms.uTime;
        // 确定性预热：真时钟 + 真 Boats.update（10s → trail 封顶 110 段、泡沫稳态）
        for (let i = 0; i < 300; i++) { time.value += 1 / 30; boats.update(1 / 30); }
        const probe = boats.wakeProbe(0, { bins: 6 });
        // 反向对照：同页 new 一个 V 档 Boats（同一份 THREE / 同一套代码），跑同样的 10s
        const THREE = await document.querySelector('#scene').contentWindow.eval("import('three')");
        const { Boats } = await document.querySelector('#scene').contentWindow.eval("import('/src/life/boats.js')");
        const vB = new Boats({ scene: new THREE.Scene(), uTime: { value: 0 }, mode: 'v' });
        vB.refresh((x, z) => Math.hypot(x, z) < 3, 6, 2);
        for (let i = 0; i < 300; i++) { vB.uTime.value += 1 / 30; vB.update(1 / 30); }
        const vProbe = vB.wakeProbe(0, { bins: 6 });
        // 相机钉到第一条船近景（画面里要能看见尾迹）
        const bt = boats.boats[0], pos = bt.mesh.position;
        view.target.copy(pos); view.distance = 3.2; view.pitch = 0.85; view.yaw = Math.atan2(pos.z, pos.x) + Math.PI; view.updateCamera();
        view.renderer.render(view.scene, view.camera);
        const P = boats.foamPoints.geometry.attributes.position.array;
        const drawn = boats.foamPoints.geometry.drawRange.count;
        let offWater = 0;
        for (let i = 0; i < drawn; i++) { const c = view.index.cellAt(P[i * 3], P[i * 3 + 2]); if (c && view.town.top(c) > 0) offWater++; }
        return {
          grid: api.gridKind, mode: boats.mode, corridor: boats.corridor, latOffset: boats.latOffset,
          probe, v: { mode: vB.mode, spans: vProbe.trail.buckets.spans, reaches: vProbe.wake.reach },
          drawn, spray: boats.sprayPoints.geometry.drawRange.count, offWater,
          worldVersion: world.version,
        };
      });
      // ① 恒定间距
      assert.equal(r.mode, 'corridor');
      const sp = r.probe.trail.buckets.spans;
      const mean = sp.reduce((s, v) => s + v, 0) / sp.length;
      assert.ok(Math.abs(mean - 2 * r.latOffset) < 1e-9, `${grid} 间距 == 2·latOffset（${mean} vs ${2 * r.latOffset}）`);
      assert.ok((Math.max(...sp) - Math.min(...sp)) / mean < 1e-9, `${grid} 间距逐段恒定`);
      // ③ 淡出
      assert.ok(r.probe.ribbonAlpha.monotonic, `${grid} 带状 alpha 单调不增`);
      const reach = r.probe.wake.reach;
      assert.ok(reach.edge > 1.2, `${grid} 边线拖到 ${reach.edge.toFixed(2)} 船长`);
      assert.ok(reach.edge > reach.row * 1.5, `${grid} 边线 ${reach.edge.toFixed(2)} 比泡沫行 ${reach.row.toFixed(2)} 拖得远`);
      // ② 成排断续
      assert.ok(r.probe.rows >= 8, `${grid} 发 ${r.probe.rows} 行`);
      assert.ok(r.drawn > 200, `${grid} 泡沫点入缓冲 ${r.drawn}`);
      assert.ok(r.spray > 0, `${grid} 船头泡沫 ${r.spray}`);
      assert.equal(r.offWater, 0, `${grid} 尾迹全在水面（压在陆地上的 ${r.offWater} 粒）`);
      // ④ V 档反向对照
      const vgrow = r.v.spans.at(-1) / r.v.spans[0];
      assert.equal(r.v.mode, 'v');
      assert.ok(vgrow > 1.3, `${grid} V 档间距张开 ${vgrow.toFixed(2)}×（corridor 1.00×）`);
      await p.screenshot({ path: `artifacts/coverage/boats-wake-corridor-${grid}-r184.png` });
      reports.push({ ...r, vGrow: vgrow });
      await p.close();
    }
    // ⑤ UI 接线：下拉切到旧 V 档 → 整页（iframe）真的换档
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
    await p.goto('http://localhost:8769/wake-fog.html');
    await p.waitForFunction(() => window.wakeFog?.api?.view?.boats?.mode === 'corridor', null, { timeout: 60000 });
    await p.selectOption('#wake', 'v');
    await p.waitForFunction(() => window.wakeFog?.api?.view?.boats?.mode === 'v', null, { timeout: 60000 });
    const uiMode = await p.evaluate(() => ({ mode: window.wakeFog.api.view.boats.mode, status: document.querySelector('#status').textContent }));
    assert.equal(uiMode.mode, 'v');
    assert.match(uiMode.status, /v 档/);
    await p.selectOption('#wake', '');
    await p.waitForFunction(() => window.wakeFog?.api?.view?.boats?.mode === 'corridor', null, { timeout: 60000 });
    await p.locator('#follow').setChecked(true);
    await p.waitForTimeout(3000);
    await p.screenshot({ path: 'artifacts/coverage/boats-wake-corridor-ui-r184.png' });
    reports.push({ ui: uiMode });
    await p.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/boats-wake-corridor-browser.json', JSON.stringify({ reports, errors }, null, 2));
    console.log('PASS boats corridor 运行验收', JSON.stringify(reports.map((r) => r.grid ? { grid: r.grid, meanSpan: +(2 * r.latOffset).toFixed(4), reach: r.probe.wake.reach, rows: r.probe.rows, drawn: r.drawn, vGrow: +r.vGrow.toFixed(2) } : r.ui)));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
