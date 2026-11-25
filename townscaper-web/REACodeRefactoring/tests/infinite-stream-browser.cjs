// 1151137783785771008 · "an aperiodic infinite deterministic irregular relaxed quadrilateral grid."
// 验收：真流式（拖到哪长到哪 / 远处缓存丢弃 / 块间无缝）+ 块内疏密均匀度指标。
// 判据全部来自页面真实渲染与页面读数，不看「代码里应该有」。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/infinite-stream.html?r=10');
    await p.waitForFunction(() => !!window.infStream, null, { timeout: 30000 });
    await p.waitForTimeout(200);

    const grab = () => p.evaluate(() => {
      const cv = document.getElementById('c'), ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let light = 0, dark = 0, sum = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += l; if (l > 200) light++; else if (l < 70) dark++; }
      return { light, dark, mean: sum / (d.length / 4), bg: cv.toDataURL('image/png').split(',')[1] };
    });

    // ① 首帧：焦点一块已最终化 + 均匀度可读
    const s0 = await p.evaluate(() => window.infStream);
    const px0 = await grab();
    assert.ok(s0.finals >= 1 && s0.quads > 10, `首帧应有已最终化的块：${JSON.stringify({ finals: s0.finals, quads: s0.quads })}`);
    assert.ok(s0.seam < 1e-9, '块间接缝 ' + s0.seam);
    assert.equal(s0.area.flipped, 0, '首帧不应有翻折格');
    assert.ok(s0.density && s0.density.quads === s0.quads, '均匀度指标应覆盖全部最终化格');
    assert.ok(s0.density.area.p50 > 0.7 && s0.density.area.p50 < 1.3, '面积中位数应贴近原始点阵：' + s0.density.area.p50);
    assert.ok(s0.density.edge.p50 > 0 && s0.density.edge.cv > 0);

    // ② 真指针拖动焦点 → 网格跟着焦点长（不是「一次开窗」）
    const box = await p.locator('#c').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    for (let i = 0; i <= 6; i++) { await p.mouse.move(box.x + box.width / 2 + i * 28, box.y + box.height / 2 - i * 12); await p.waitForTimeout(60); }
    await p.mouse.up();
    await p.waitForTimeout(200);
    const sDrag = await p.evaluate(() => window.infStream);
    assert.ok(Math.hypot(sDrag.focus[0] - s0.focus[0], sDrag.focus[1] - s0.focus[1]) > 1, '拖动应移动焦点：' + JSON.stringify(sDrag.focus));
    assert.ok(sDrag.counters.patches > s0.counters.patches, '走到新位置应继续生成新块拓扑：' + s0.counters.patches + ' → ' + sDrag.counters.patches);

    // ③ 走远：累计生成 >> 缓存上限，说明远处真被丢弃；每步无缝、无翻折
    const walk = await p.evaluate(async () => {
      const out = [];
      for (const x of [0, 40, 80, 120, 160, 200]) {
        const s = window.setFocus(x, 0);
        out.push({ x, finals: s.finals, raws: s.raws, quads: s.quads, cached: s.cached, counters: { ...s.counters }, seam: s.seam, flipped: s.area.flipped, density: s.density && { area: s.density.area, edge: s.density.edge, within: s.density.within, between: s.density.between } });
      }
      return out;
    });
    const last = walk[walk.length - 1], maxCached = Math.max(...walk.map((w) => w.cached.patches));
    for (let i = 1; i < walk.length; i++) assert.ok(walk[i].counters.patches >= walk[i - 1].counters.patches, '生成量单调不减');
    assert.ok(last.counters.patches > 6 * maxCached, `走过 ${last.counters.patches} 块，缓存最多 ${maxCached} 块 → 远处确实丢弃`);
    assert.ok(last.counters.evicted > 100, '丢弃计数 ' + last.counters.evicted);
    for (const w of walk) { assert.ok(w.seam < 1e-9, `焦点 ${w.x} 处块间接缝 ${w.seam}`); assert.equal(w.flipped, 0, `焦点 ${w.x} 处翻折 ${w.flipped}`); }
    assert.ok(last.counters.finalized > 40, '最终化块数 ' + last.counters.finalized);

    // ④ 疏密均匀度：格子大小分布（p90÷p10、CV）+ 块间 vs 块内
    const den = last.density;
    assert.ok(den.area.p10 > 0.35 && den.area.p90 < 2.6, `面积比区间 ${den.area.p10}–${den.area.p90}`);
    assert.ok(den.area.cv < 0.45, '面积 CV 应足够小：' + den.area.cv);
    assert.ok(den.between <= den.within * 1.6 + 0.02, `块均值离散 ${den.between.toFixed(3)} 不应明显大于块内 ${den.within.toFixed(3)}（否则能看出块边界）`);

    // ⑤ 画面：网格线真的画出来了（浅色像素），且每个位置都有一整片（不是只剩几个点）
    const pxFar = await grab();
    assert.ok(px0.light > 2000 && pxFar.light > 2000, `浅色网格线像素 首帧 ${px0.light} / 走远后 ${pxFar.light}`);

    // ⑥ 大半径铺满整屏 + 截图（给证据用）。注意：改半径会 view.cx=cz=0，必须再 setFocus 把镜头带回焦点
    await p.evaluate(async () => { document.getElementById('rad').value = 20; document.getElementById('rad').dispatchEvent(new Event('change')); window.setFocus(200, 0); });
    await p.waitForTimeout(250);
    const full = await p.evaluate(() => ({ s: window.infStream, w: document.getElementById('c').width, h: document.getElementById('c').height }));
    const shotFull = await grab();
    fs.writeFileSync('artifacts/coverage/infinite-stream-r135-full.png', Buffer.from(shotFull.bg, 'base64'));
    assert.ok(shotFull.light > 20000, '铺满整屏后应有大量网格线像素：' + shotFull.light);
    // 放大 1.6 × 再拍一张：给「同一口径量两边」用（格子面积中位 ≈152 px²，对齐原片终帧的 ≈156 px²）
    await p.evaluate(() => { location.search = '?r=14&zoom=2.1'; });
    await p.waitForFunction(() => !!window.infStream, null, { timeout: 30000 });
    await p.evaluate(() => window.setFocus(180, 0));
    await p.waitForTimeout(400);
    const zoomShot = await grab();
    fs.writeFileSync('artifacts/coverage/infinite-stream-r135-zoom.png', Buffer.from(zoomShot.bg, 'base64'));
    const sZoom = await p.evaluate(() => window.infStream);
    assert.ok(zoomShot.light > 5000, '放大后应有网格线像素：' + zoomShot.light);

    console.log(JSON.stringify({
      first: { finals: s0.finals, quads: s0.quads, seam: s0.seam, density: s0.density && { area: s0.density.area, edge: s0.density.edge, between: s0.density.between, within: s0.density.within } },
      drag: { focus: sDrag.focus, patches: sDrag.counters.patches },
      walk: walk.map((w) => ({ x: w.x, finals: w.finals, finalsPatches: w.counters.patches, cached: w.cached.patches, evicted: w.counters.evicted, seam: w.seam, span: +w.density.area.span.toFixed(2), cv: +w.density.area.cv.toFixed(3) })),
      lastDensity: den, light: { first: px0.light, far: pxFar.light, full: shotFull.light, mean: +shotFull.mean.toFixed(1) },
      full: { finals: full.s.finals, quads: full.s.quads, canvas: [full.w, full.h] },
      zoom: { quads: sZoom.quads, edgeP50: sZoom.density.edge.p50, light: zoomShot.light },
    }, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS infinite-stream-browser');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
