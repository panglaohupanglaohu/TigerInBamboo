/* 906207980802252801 · new fog：圆盘环 + 贴水雾片（软边 / 风场平流 / 体素绕行 / 深度遮挡 / 流速档）
 * 运行：NODE_PATH=/tmp/pw-shim:<REA-agent>/node_modules node tests/fog-wisps-browser.cjs
 * 口径：雾片本身在 node 侧有 wind-flow.mjs 的模拟断言；这里只认「真实场景里画出来了、会动、流速能冻结、岛体挡得住、对比度低」。
 */
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const reports = [], errors = [];
  try {
    for (const grid of ['mixed', 'quad']) {
      const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
      p.on('pageerror', (e) => errors.push(e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
      await p.goto('http://localhost:8769/wake-fog.html');
      if (grid === 'quad') await p.selectOption('#grid', grid);
      await p.waitForFunction(() => window.wakeFog?.api && window.atmosphereFog);
      // 页面入口：读数条真的在跑（不是只有静态文案）
      await p.waitForFunction(() => /雾片 \d+ 片/.test(document.querySelector('#fogStats')?.textContent || ''));
      const head = await p.textContent('header');
      assert.ok(!/圆盘近似/.test(head), '页头仍写着旧口径「圆盘近似」');
      assert.ok(/薄雾片/.test(head), '页头没有写雾片层');

      const r = await p.evaluate(async () => {
        const { api } = wakeFog, { view } = api, A = view.atmosphere;
        const T = await document.querySelector('#scene').contentWindow.eval("import('three')");
        const t0 = view.waterUniforms.uTime.value, version = api.world.version;
        const snapshot = () => A.fogWisps.wisps.map((m) => [m.x, m.y, m.z]);
        const disp = (a, c) => a.map((q, k) => Math.hypot(q[0] - c[k][0], q[2] - c[k][2]));
        const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
        const wind = A.uWind.value, wn = Math.hypot(wind.x, wind.z) || 1;
        const advance = (n, dt) => { for (let i = 0; i < n; i++) A.update(dt); };
        const out = {};
        try {
          // —— 结构：两层都在，实例数 == 雾片数，没有一片落在实心体素里
          const st = A.fogStats();
          out.stats = st;
          if (!st.discVisible || !st.sheetsVisible) throw Error('fog layers not both visible');
          if (st.instanceCount !== st.count) throw Error('instanceCount ' + st.instanceCount + ' != wisps ' + st.count);
          if (st.insolid !== 0) throw Error('wisps inside solid: ' + st.insolid);
          if (st.count < 8) throw Error('too few wisps');
          if (st.aspect > 0.5) throw Error('sheets are not flat: aspect ' + st.aspect);
          if (!(st.discs.inner > 0 && st.discs.outer > st.discs.inner)) throw Error('disc radii');
          if (st.minY < 0.15 - 1e-6) throw Error('wisp below water band: ' + st.minY);

          // —— 流速档：0 冻结 / 1 原速 / 2 双倍（看真实位移，不看 uniform 字面值）
          A.setFogAppearance({ opacity: .35, speed: 0 });
          let a0 = snapshot(); advance(30, 1 / 30);
          out.frozen = mean(disp(a0, snapshot()));
          A.setFogAppearance({ speed: 1 });
          a0 = snapshot(); advance(30, 1 / 30);
          const one = snapshot(), d1 = disp(a0, one);
          out.oneSpeed = { mean: mean(d1), max: Math.max(...d1) };
          const dx = mean(one.map((q, k) => q[0] - a0[k][0])), dz = mean(one.map((q, k) => q[2] - a0[k][2]));
          out.align = (dx * wind.x + dz * wind.z) / ((Math.hypot(dx, dz) || 1) * wn);
          A.setFogAppearance({ speed: 2 });
          const a2 = snapshot(); advance(30, 1 / 30);
          const d2 = disp(a2, snapshot());
          out.twoSpeed = { mean: mean(d2), ratio: mean(d2) / (mean(d1) || 1) };
          out.afterStep = A.fogStats();
          if (out.frozen > 1e-9) throw Error('speed 0 still drifts: ' + out.frozen);
          if (out.oneSpeed.mean < 0.02) throw Error('sheets do not drift: ' + out.oneSpeed.mean);
          if (out.align < 0.8) throw Error('drift not downwind: cos ' + out.align);
          if (!(out.twoSpeed.ratio > 1.5 && out.twoSpeed.ratio < 2.5)) throw Error('speed 2 is not ~2x: ' + out.twoSpeed.ratio);
          if (out.afterStep.insolid !== 0) throw Error('wisps entered solid while drifting');

          // —— GPU：离屏 FBO 抓帧（默认帧缓冲合成后被清，readPixels 恒 0）
          const W = 320, Hh = 200, rt = new T.WebGLRenderTarget(W, Hh, { depthBuffer: true });
          const grab = () => { view.renderer.setRenderTarget(rt); view.renderer.render(view.scene, view.camera); const px = new Uint8Array(W * Hh * 4); view.renderer.readRenderTargetPixels(rt, 0, 0, W, Hh, px); view.renderer.setRenderTarget(null); return px; };
          const diff = (x, y) => { let n = 0, any = 0, mx = 0, sum = 0, all = 0; for (let i = 0; i < x.length; i += 4) { const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])); if (d > 0) any++; if (d > 2) { n++; sum += d; } all += d; if (d > mx) mx = d; } return { px: n, any, max: mx, mean: n ? sum / n : 0, allMean: all / (x.length / 4), share: n / (x.length / 4) }; };
          A.setFogAppearance({ opacity: .35, speed: 1 });
          view.waterUniforms.uTime.value = 0;
          const disc0 = A.fog.visible, band0 = A.fogSheets.geometry.instanceCount;
          // 只留雾片层：整场景隐掉（否则水面按 uTime 在动，跨时刻差分不成立）
          const kids = view.scene.children.map((c) => [c, c.visible]);
          const iso = () => { for (const c of view.scene.children) c.visible = false; A.group.visible = true; A.fog.visible = false; A.snow.visible = false; A.arrows.visible = false; A.fogSheets.visible = true; };
          const restore = () => { for (const [c, v] of kids) c.visible = v; A.fog.visible = disc0; A.fogSheets.visible = true; };
          iso();
          A.setFogAppearance({ speed: 0 }); const f0 = grab(); view.waterUniforms.uTime.value = 1.2; const f1 = grab();
          A.setFogAppearance({ speed: 1 }); const f2 = grab(); view.waterUniforms.uTime.value = 2.4; const f3 = grab();
          out.sheetFrozen = diff(f0, f1); out.sheetDrift = diff(f2, f3);
          const same = diff(f0, grab()); out.noise = same.px;
          out.isolatedPx = f3.length / 4;
          restore();
          A.setFogAppearance({ speed: 0 });
          A.fog.visible = false; const off0 = grab(); A.fogSheets.visible = false; const off1 = grab(); A.fogSheets.visible = true; A.fog.visible = disc0;
          out.layersAB = diff(off0, off1);                                     // 只雾片层 开/关
          const all0 = grab(); A.showFog = false; const all1 = grab(); A.showFog = true;
          out.fogAB = diff(all0, all1);                                        // 两层 + 圆盘 开/关
          rt.dispose();
          if (out.sheetFrozen.any !== 0) throw Error('speed 0 sheet still animated: ' + out.sheetFrozen.any);
          if (!(out.sheetDrift.any > 300 && out.sheetDrift.allMean > .005)) throw Error('speed 1 sheet static: ' + out.sheetDrift.any + ' / ' + out.sheetDrift.allMean);
          if (out.noise !== 0) throw Error('same-state noise ' + out.noise);
          if (!(out.layersAB.any > 4000 && out.layersAB.allMean > .15)) throw Error('sheet layer not on screen: ' + out.layersAB.any + ' / ' + out.layersAB.allMean);
          if (!(out.fogAB.any > out.layersAB.any)) throw Error('disc adds nothing: ' + out.fogAB.any + ' vs ' + out.layersAB.any);
          if (out.fogAB.max > 48) throw Error('fog is not subtle: max delta ' + out.fogAB.max);
          if (!(out.fogAB.share > .02 && out.fogAB.share < .85)) throw Error('fog share ' + out.fogAB.share);
          if (api.world.version !== version) throw Error('fog test edited the World');
          return out;
        } finally {
          A.setFogAppearance({ opacity: .35, speed: 1 });
          A.showFog = true;
          view.waterUniforms.uTime.value = t0;
          view.render(0);
        }
      });
      // 截图证据：两层开 / 只关雾 同一机位
      await p.waitForTimeout(600);
      await p.screenshot({ path: `artifacts/coverage/fog-wisps-${grid}-on.png` });
      await p.evaluate(() => { wakeFog.api.view.setDebug('fog', false); });
      await p.waitForTimeout(400);
      await p.screenshot({ path: `artifacts/coverage/fog-wisps-${grid}-off.png` });
      await p.evaluate(() => { wakeFog.api.view.setDebug('fog', true); });
      reports.push({ grid, ...r });
      await p.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/fog-wisps-browser.json', JSON.stringify({ reports, errors }, null, 2));
    console.log('PASS fog disc + wisp sheets: soft cards, wind advection, speed 0/1/2, no solid overlap, subtle low-contrast GPU A/B');
    for (const r of reports) console.log(JSON.stringify({ grid: r.grid, count: r.stats.count, frozen: r.frozen, one: r.oneSpeed.mean, ratio: r.twoSpeed.ratio.toFixed(2), align: r.align.toFixed(3), layers: r.layersAB.any, fog: r.fogAB.any, max: r.fogAB.max, noise: r.noise }));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
