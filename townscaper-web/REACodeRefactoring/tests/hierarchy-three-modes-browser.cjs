/**
 * 1670725072540106755 "no-, dumb- and hierarchical smoothing"
 * 页面口径：hierarchy.html 的三档选择器（no / dumb / hierarchical）+ 同一座 World 的三档读数 + 真画面像素 A/B。
 *
 * 断言分四组：
 *   A 页面入口：三个档位标签就是原片左上角那三个词；切档后 worldMesh.shape.mode 真的跟着变；
 *   B 三档读数：hierarchical 把崖顶线拉直（kink 下降）且不像 dumb 那样把海岸吃掉（drift 更小）；no 档位移为 0；
 *   C 钉住不变量：三档里 pinned 顶点的采样位移必须都是 0（原片「保留输入 tile 的意图」的最低要求）；
 *   D 画面：同机位三档各自 readPixels，两两差分远超同档重渲的噪声底。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const report = {};

  const grab = (key) => p.evaluate((k) => {
    const { view } = window.hierarchyModes.api();
    view.render(0);
    const gl = view.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    window.__px = window.__px || {};
    window.__px[k] = { W, H, buf };
    return { W, H };
  }, key);

  const diff = (a, b2) => p.evaluate(([ka, kb]) => {
    const A = window.__px[ka], B = window.__px[kb];
    if (!A || !B) return null;
    let n = 0, maxd = 0, sum = 0;
    const len = Math.min(A.buf.length, B.buf.length);
    for (let i = 0; i < len; i += 4) {
      const d = Math.abs(A.buf[i] - B.buf[i]) + Math.abs(A.buf[i + 1] - B.buf[i + 1]) + Math.abs(A.buf[i + 2] - B.buf[i + 2]);
      if (d > 9) n++;
      if (d > maxd) maxd = d;
      sum += d;
    }
    return { differing: n, total: len / 4, pct: +(100 * n / (len / 4)).toFixed(2), maxd, mean: +(sum / (len / 4)).toFixed(2) };
  }, [a, b2]);

  try {
    await p.goto('http://127.0.0.1:8769/hierarchy.html');
    let ready = false;
    for (let k = 0; k < 3 && !ready; k++) {
      try {
        await p.waitForFunction(() => !!window.hierarchyModes, null, { timeout: 45000 });
        ready = true;
      } catch (e) {
        // 本地 serve.py 偶发 ERR_CONNECTION_RESET（iframe 变错误页、rea 永不就绪）→ 重载一次，不是代码问题
        if (k === 2) { console.error('page errors:', errors); throw e; }
        await p.reload();
      }
    }
    // 冻时间轴：index.html 的主循环每帧喂真 dt（水/云/烟/鸟），readPixels 抓到的会是不同瞬间 → 同档差分假噪声。
    // 同时把机位拉回「整岛侧视」并把 iframe 的 HUD 摘掉，截图才和原片三档画面同一口径。
    await p.evaluate(() => {
      const v = window.hierarchyModes.api().view;
      const o = v.render.bind(v);
      v.render = () => o(0);
      v.onFrame = null;
      v.target.set(0, 3.2, 0); v.distance = 40; v.pitch = 0.62; v.yaw = 0.55; v.updateCamera(); v.render(0);
      const doc = document.querySelector('#scene').contentDocument;
      const hud = doc?.querySelector('#hud');
      if (hud) hud.style.display = 'none';
    });
    await p.waitForTimeout(1200);

    // A. 三个档位标签 == 原片左上角那三个词
    const labels = await p.evaluate(() => [...document.querySelectorAll('#mode option')].map((o) => ({ value: o.value, text: o.textContent })));
    assert.deepEqual(labels.map((o) => o.value), ['none', 'dumb', 'hierarchical']);
    assert.ok(/no smoothing/.test(labels[0].text) && /dumb smoothing/.test(labels[1].text) && /hierarchical smoothing/.test(labels[2].text));
    report.labels = labels;

    // B. 三档读数（同一座 World）
    await p.waitForFunction(() => window.hierarchyModes.table()?.none, null, { timeout: 60000 });
    const table = await p.evaluate(() => window.hierarchyModes.table());
    assert.equal(table.none.slices, table.hierarchical.slices);
    assert.equal(table.none.verts, table.dumb.verts);
    assert.equal(table.none.moved, 0, 'panel 1 = no smoothing at all');
    assert.ok(table.hierarchical.moved > 0 && table.dumb.moved > 0);
    assert.ok(table.none.kinkTop > table.hierarchical.kinkTop + 5,
      `hierarchical straightens cliff-top outlines (${table.none.kinkTop} → ${table.hierarchical.kinkTop})`);
    assert.ok(table.dumb.kinkTop > table.hierarchical.kinkTop,
      'dumb smoothing leaves the cliff-top janky');
    assert.ok(table.dumb.drift > table.hierarchical.drift,
      `dumb eats more of the coast (${table.dumb.drift} vs ${table.hierarchical.drift})`);
    assert.ok(table.hierarchical.maxMove < table.dumb.maxMove,
      `hierarchical moves points less than dumb (${table.hierarchical.maxMove} vs ${table.dumb.maxMove})`);
    // C. 钉住不变量
    for (const m of ['none', 'dumb', 'hierarchical']) assert.equal(table[m].pinnedBad, 0, `${m}: pinned vertices must not move`);
    assert.equal(table.none.maxMove, 0, 'panel 1 has no displacement at all');
    assert.ok(table.diff.hierVsNone.n > 0 && table.diff.dumbVsNone.n > 0 && table.diff.hierVsDumb.big > 0);
    report.table = table;

    // D. 画面 A/B（同机位，只切档）
    const cam = await p.evaluate(() => ({ target: window.hierarchyModes.api().view.target.toArray(), distance: window.hierarchyModes.api().view.distance, pitch: window.hierarchyModes.api().view.pitch, yaw: window.hierarchyModes.api().view.yaw }));
    report.camera = cam;
    const shots = {};
    for (const m of ['none', 'dumb', 'hierarchical']) {
      await p.selectOption('#mode', m);
      await p.waitForFunction((mm) => window.hierarchyReview?.shape?.mode === mm, m, { timeout: 60000 });
      const status = await p.textContent('#status');
      assert.ok(status.includes(`档位${m}`), `status shows the active panel: ${status}`);
      // 切档会触发 worldMesh.rebuild() 后的 birdTimer/decor.refresh 等异步补件 → 等它们落定再抓像素，
      // 否则「同档两帧」的差分里混进植被/鸟的重新摆位（首轮 2073px 假噪声就是这么来的）。
      await p.waitForTimeout(1800);
      const size = await grab(m);
      shots[m] = size;
      if (m === 'none') { await grab('none2'); }
      if (m === 'hierarchical') { await grab('hier2'); }
      await p.screenshot({ path: `artifacts/coverage/hierarchy-modes-${m}.png` });
      // 原片是近景（岛填满画面、台地与岸线同屏）→ 再补一张中景，岸线形制在缩略图上才分得出
      await p.evaluate(() => {
        const v = window.hierarchyModes.api().view;
        v.target.set(0, 3.0, 0); v.distance = 17; v.pitch = 0.5; v.yaw = 0.55; v.updateCamera(); v.render(0);
      });
      await p.waitForTimeout(400);
      await p.screenshot({ path: `artifacts/coverage/hierarchy-modes-${m}-close.png` });
      await p.evaluate(() => {
        const v = window.hierarchyModes.api().view;
        v.target.set(0, 3.2, 0); v.distance = 40; v.pitch = 0.62; v.yaw = 0.55; v.updateCamera(); v.render(0);
      });
    }
    const noise = { none: await diff('none', 'none2'), hier: await diff('hierarchical', 'hier2') };
    const ab = {
      noneVsDumb: await diff('none', 'dumb'),
      noneVsHier: await diff('none', 'hierarchical'),
      dumbVsHier: await diff('dumb', 'hierarchical'),
    };
    assert.equal(noise.none.differing, 0, 'same panel re-render must be pixel identical');
    assert.equal(noise.hier.differing, 0, 'same panel re-render must be pixel identical');
    for (const [k, v] of Object.entries(ab)) assert.ok(v.differing > 2000, `${k} must move real pixels (${v.differing})`);
    assert.ok(ab.noneVsHier.differing > ab.noneVsDumb.differing * 0.3);
    assert.deepEqual(errors, []);
    report.shots = shots;
    report.noise = noise;
    report.ab = ab;

    fs.writeFileSync('artifacts/coverage/hierarchy-three-modes-browser.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      kink: ['none', 'dumb', 'hierarchical'].map((m) => +table[m].kinkTop.toFixed(2)),
      drift: ['none', 'dumb', 'hierarchical'].map((m) => +(table[m].drift * 100).toFixed(2)),
      moved: ['none', 'dumb', 'hierarchical'].map((m) => table[m].moved),
      diffSamples: table.diff,
      noise: [noise.none.differing, noise.hier.differing],
      ab: Object.fromEntries(Object.entries(ab).map(([k, v]) => [k, v.differing])),
    }, null, 1));
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
