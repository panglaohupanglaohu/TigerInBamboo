// r153 · 1727315611959865407「orbital camera 的运动模糊拖影」运行验收（`?fx=smear` = src/world/view-post-extras.js 的解析切向拖影）
// 片内可判的四件事 → 四个量：① 快转时整屏变软（lap95 掉 60%+）；② 拖影沿**切向**（左右带切向≈竖直 → dy/dx 掉，
// 画面中间切向≈水平 → 不降）；③ 拖影长度随屏幕角速度走（outerPx = |omegaDt|·min(w,h)/2，且 lap95 随 ω 单调）；
// ④ 是**单帧**拖抹不是历史叠加（同机位 omegaDt=0 时恒等、无重影残留）；另加 RT 往返不偏色（二次色调映射回归守卫）。
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('fs');
const URL = 'http://127.0.0.1:8769/index.html?fx=smear';
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [];
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
    for (let i = 0; ; i++) {                                  // 主场景首次加载偶发 90s 超时（r150 同型），重试 3 次
      try { await p.goto(URL); await p.waitForFunction(() => window.rea?.view?.postExtras && window.rea.view.worldMesh?.geometry?.attributes?.position?.count > 100, null, { timeout: 60000 }); break; }
      catch (e) { if (i >= 2) throw e; }
    }
    await p.waitForTimeout(1200);

    const r = await p.evaluate(async () => {
      const v = rea.view, pe = v.postExtras, gl = v.renderer.getContext();
      v.__orig = v.render.bind(v); v.render = () => {};        // 停自循环：主场景自己 rAF，setAnimationLoop(null) 管不到
      const grab = () => {
        v.__orig(0);                                          // dt=0：动画不推进，同机位两次渲染逐像素可比
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const lum = new Float32Array(w * h);
        for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = .2126 * px[j] + .7152 * px[j + 1] + .0722 * px[j + 2];
        return { px, lum, w, h };
      };
      const snap = () => {                                    // 只回读，不重渲（重渲会把 stats.smear 覆盖成 omegaDt=0）
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const lum = new Float32Array(w * h);
        for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = .2126 * px[j] + .7152 * px[j + 1] + .0722 * px[j + 2];
        return { px, lum, w, h };
      };
      const bgLum = 152;                                      // 天空/背景（实测取样 89,152,162）
      const diff = (a, c, band = [0, 2], islandOnly = false) => {
        const w = a.w, h = a.h, R = Math.min(w, h) / 2;
        let s = 0, n = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const rr = Math.hypot(x - w / 2, y - h / 2) / R;
          if (rr < band[0] || rr >= band[1]) continue;
          if (islandOnly && Math.abs(a.lum[y * w + x] - bgLum) < 8) continue;
          s += Math.abs(a.lum[y * w + x] - c.lum[y * w + x]); n++;
        }
        return { mean: n ? +(s / n).toFixed(3) : 0, px: n };
      };
      const aniso = (a, x0, x1) => {                           // dy/dx：竖直方向梯度 / 水平方向梯度
        const w = a.w, h = a.h; let dx = 0, dy = 0, n = 0;
        for (let y = Math.floor(h * .25); y < Math.floor(h * .75); y++) for (let x = Math.max(1, Math.floor(w * x0)); x < Math.floor(w * x1); x++) {
          dx += Math.abs(a.lum[y * w + x + 1] - a.lum[y * w + x]);
          dy += Math.abs(a.lum[(y + 1) * w + x] - a.lum[y * w + x]); n++;
        }
        return +(dy / n / (dx / n)).toFixed(3);
      };
      const lap95 = (a) => { const w = a.w, h = a.h, g = []; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; g.push(Math.abs(4 * a.lum[i] - a.lum[i - 1] - a.lum[i + 1] - a.lum[i - w] - a.lum[i + w])); } g.sort((p, q) => p - q); return +g[Math.floor(g.length * .95)].toFixed(2); };
      const flat = (im, pts) => pts.map(([x, y]) => { const i = ((im.h - 1 - y) * im.w + x) * 4; return [im.px[i], im.px[i + 1], im.px[i + 2]]; });
      const PTS = [[100, 100], [640, 60], [200, 400], [640, 700], [1100, 300]];
      const step = async (Y, d) => {                            // 从 Y-d 预热 lastYaw，再落到 Y 出拖影帧
        v.yaw = Y - d; v.updateCamera(); grab();
        await new Promise((r) => setTimeout(r, 90));
        v.yaw = Y; v.updateCamera(); v.__orig(0);
        return { im: snap(), s: pe.stats().smear };
      };
      const Y = 1.05;
      pe.set('smear', true);
      const r1 = await step(Y, .22), B1 = r1.im, s1 = r1.s;      // 1× 角速度
      pe.set('smear', false); const A = grab();                  // 同机位、无拖影的参照
      const A2 = grab();                                         // 同状态噪声
      pe.set('smear', true); const C = grab();                   // 同机位、omegaDt=0 → 必须恒等（无历史叠加）
      await new Promise((r) => setTimeout(r, 60)); const C2 = grab();
      pe.set('smear', false); const A3 = grab();                 // 关掉必须回位
      // 0.5× / 2× 角速度：拖影长度随 ω 走（两倍位移、细节再降）
      pe.set('smear', true);                                    // A3 是关着的状态，这里必须再打开
      const r05 = await step(Y, .11), B05 = r05.im, s05 = r05.s;
      const r2 = await step(Y, .44), B2 = r2.im, s2 = r2.s;
      return {
        size: [A.w, A.h], pitch: v.pitch, stats: [s05, s1, s2],
        flatA: flat(A, PTS), flatC: flat(C, PTS),
        noise: diff(A2, A).mean, identity: diff(C, A).mean, identity2: diff(C2, C).mean, restore: diff(A3, A).mean,
        rings: [[0, .15], [.15, .3], [.3, .45], [.45, .6]].map((bd) => ({ band: bd, d: diff(B1, A, bd, true).mean, px: diff(B1, A, bd, true).px })),
        lap: { A: lap95(A), b05: lap95(B05), b1: lap95(B1), b2: lap95(B2) },
        aniso: { clean: { L: aniso(A, .02, .34), M: aniso(A, .4, .6), R: aniso(A, .66, .98) }, smear: { L: aniso(B1, .02, .34), M: aniso(B1, .4, .6), R: aniso(B1, .66, .98) } },
      };
    });

    // ① 指标接口齐全（旧 stats 只有 omegaDt/outerPx/center）
    for (const s of r.stats) {
      for (const k of ['omegaDt', 'screenOmega', 'shutter', 'taps', 'maxPx', 'outerPx', 'center']) assert.ok(k in s, 'stats.smear 缺 ' + k);
      assert.equal(s.taps, 6); assert.equal(s.shutter, 1 / 60); assert.equal(s.maxPx, 24);
      assert.ok(Math.abs(s.outerPx - Math.abs(s.omegaDt) * Math.min(...r.size) / 2) < .02, 'outerPx 与 omegaDt 不成正比');
    }
    assert.ok(r.stats[1].omegaDt > r.stats[0].omegaDt && r.stats[2].omegaDt > r.stats[1].omegaDt, '角速度未随 dyaw 递增');
    assert.ok(Math.abs(r.stats[2].outerPx / r.stats[0].outerPx - 4) < .05, '0.44/0.11 的拖影长度比应为 4');
    // ② RT 往返不偏色（r153 修掉二次色调映射：旧版 omegaDt=0 时亮度 130.14→143.75）
    assert.deepEqual(r.flatC, r.flatA, 'RT 往返改了平色（二次色调映射回归）');
    // ③ 快转时整屏变软，且随 ω 单调
    assert.ok(r.lap.b1 < r.lap.A * .45, `1× 角速度没把细节砍掉：${r.lap.A} → ${r.lap.b1}`);
    assert.ok(r.lap.b05 < r.lap.A * .5 && r.lap.b1 < r.lap.b05, `细节未随 ω 下降：${JSON.stringify(r.lap)}`);
    // 2× 已在 maxPx 24 处截断（0.0426 rad × 400px = 17px，外圈触顶）→ 细节不再继续掉，允许 +5% 抖动
    assert.ok(r.lap.b2 < r.lap.b1 * 1.05, `2× 角速度后细节异常回升：${JSON.stringify(r.lap)}`);
    // ④ 方向 = 切向：左右带（切向≈竖直）dy/dx 掉，中间带（切向≈水平）不降
    for (const side of ['L', 'R']) {
      assert.ok(r.aniso.smear[side] < r.aniso.clean[side] - .2,
        `${side} 带的 dy/dx 没按竖直拖影下降（${r.aniso.clean[side]} → ${r.aniso.smear[side]}）`);
    }
    assert.ok(Math.abs(r.aniso.smear.M - r.aniso.clean.M) < .15, `中间带不该变（${r.aniso.clean.M} → ${r.aniso.smear.M}）`);
    // ⑤ 中心比外圈清晰（v ∝ r）：岛内像素按半径分带，最内带差分最小
    // 最内带（0–0.15R）干净、0.15–0.3R 带明显被拖：v ∝ r 的像素级体现（精确的比例由 GLSL==CPU 孪生测试保证）
    assert.ok(r.rings[0].d < r.rings[1].d * .85, `中心带不比 0.15–0.3R 带干净：${JSON.stringify(r.rings.map((x) => x.d))}`);
    // ⑥ 单帧拖抹，不是历史叠加：同机位 omegaDt=0 恒等、再渲一帧仍恒等、关掉回位
    assert.ok(r.identity < 6, 'omegaDt=0 不恒等（RT 往返误差过大）' + r.identity);
    assert.equal(r.identity2, 0, 'omegaDt=0 连渲两帧不一致（有历史残留）');
    assert.equal(r.noise, 0, '同状态噪声不为 0');
    assert.equal(r.restore, 0, '关掉拖影没回位');

    // 证据截图：真跑 `?spin=6` 的实时画面（左：关；右：开），以及 24px 上限的近景
    const shots = [];
    for (const [name, url] of [['off', 'http://127.0.0.1:8769/index.html?spin=6'], ['on', 'http://127.0.0.1:8769/index.html?fx=smear&spin=6']]) {
      const q = await b.newPage({ viewport: { width: 1280, height: 800 } });
      q.on('pageerror', (e) => errors.push(e.message));
      for (let i = 0; ; i++) {
        try { await q.goto(url); await q.waitForFunction(() => window.rea?.view?.postExtras && window.rea.view.worldMesh?.geometry?.attributes?.position?.count > 100, null, { timeout: 60000 }); break; }
        catch (e) { if (i >= 2) throw e; }
      }
      await q.waitForTimeout(2600);
      const st = await q.evaluate(() => ({ smear: rea.view.postExtras.stats().smear, state: rea.view.postExtras.state.smear }));
      await q.screenshot({ path: `artifacts/coverage/orbit-smear-${name}-r153.png` });
      shots.push({ name, ...st }); await q.close();
    }
    assert.equal(shots[0].state, false); assert.equal(shots[1].state, true);
    assert.ok(shots[1].smear.outerPx > 20, '实时画面里拖影长度没到 20px：' + JSON.stringify(shots[1].smear));

    const report = { ...r, shots, errors };
    fs.writeFileSync('artifacts/coverage/orbit-smear-browser.json', JSON.stringify(report, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS 解析切向拖影：lap95 %s→%s（0.5×/1×/2× = %s/%s/%s）、各向异性 L %s→%s R %s→%s M %s→%s、岛内环形差分 %s、恒等 %s/%s 回位 %s、实时 outerPx %s',
      r.lap.A, r.lap.b1, r.lap.b05, r.lap.b1, r.lap.b2,
      r.aniso.clean.L, r.aniso.smear.L, r.aniso.clean.R, r.aniso.smear.R, r.aniso.clean.M, r.aniso.smear.M,
      JSON.stringify(r.rings.map((x) => x.d)), r.identity, r.identity2, r.restore, shots[1].smear.outerPx);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
