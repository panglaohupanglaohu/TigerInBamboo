// surface-shadow-landing-browser.cjs — 1704218784028905984 + 1705195380457996629
// 两条片子的主张在同一页上正反两面：
//   1704218「I tried some texture based shadows. Note the shadows on the grass and along the roof edges.
//          … feels a bit too 3D」→ 影子到处落（草地/平台/屋顶边）。
//   1705195「the shadow casting height is independent of the z test height. Now I only get shadows over
//          grass-cliff edges and under roofs.」→ 抬高投射门槛后只剩崖缘与檐下。
// 验收口径（真 World，不是合成夹具）：
//   castHeight=0（第一段那版）→ 落点里有大量「别处」（平地/平台），覆盖率明显更高；
//   castHeight=.6（第二段）→ elsewhere 归 0，崖缘 + 檐下占满；
//   接收面=顶面＋洞内 → 第二张体素射线图给出洞内地面影子；
//   GPU 像素 A/B：强度 0 → .55 有变化，同状态两帧噪声 0。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const PW = process.env.PW_EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: PW, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const reports = []; const errors = []; const shots = [];
  try {
    for (const grid of ['mixed', 'quad']) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      p.on('pageerror', (e) => errors.push(grid + ': ' + e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(grid + ': ' + m.text()); });
      // serve.py 偶发 ERR_CONNECTION_RESET 会让 iframe 停在错误页、rea 永不就绪 → 允许重载 iframe（第 166 轮的坑）
      const ready = () => p.waitForFunction(() => !!window.surfaceShadowReview?.landing, null, { polling: 100, timeout: 25000 }).then(() => true).catch(() => false);
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        await p.goto('http://127.0.0.1:8769/surface-shadows.html?_r=' + attempt);
        if (grid === 'quad') await p.selectOption('#grid', 'quad');
        ok = await ready();
        if (!ok) {
          await p.evaluate((n) => { window.surfaceShadowReview = null; document.querySelector('#scene').src = 'index.html?scene=terrain&grid=' + document.querySelector('#grid').value + '&_r=' + n; }, attempt + 1);
          ok = await ready();
        }
      }
      assert.ok(ok, grid + ' 页面未就绪（surfaceShadowReview.landing 一直为空）');

      const setUi = async (castHeight, receivers = 'top', roof = 0.35) => {
        await p.evaluate(({ castHeight, receivers, roof }) => {
          document.querySelector('#cast').value = String(castHeight);
          document.querySelector('#recv').value = receivers;
          document.querySelector('#roof').value = String(roof);
          window.surfaceShadowReview.apply();
        }, { castHeight, receivers, roof });
        await p.waitForTimeout(250);
        return p.evaluate(() => window.surfaceShadowReview.landing);
      };

      // —— 第一段 vs 第二段：投射门槛 0（太 3D）→ .6（只剩崖缘/檐下）
      const too3d = await setUi(0.0);
      const tuned = await setUi(0.6);
      const tunedPixels = await p.evaluate(() => {
        const s = window.surfaceShadowReview.api.view.groundSurfaceShadow;
        return { strength: s.strength.value, hits: s.stats.hits, eligible: s.stats.eligible, res: s.stats.res, version: s.stats.version };
      });

      // —— 接收面 = 顶面＋洞内（第二张体素射线图）与瓦檐抬升的单调性
      const allRecv = await setUi(0.6, 'all');
      const roofUp = await setUi(0.6, 'all', 0.9);
      await setUi(0.6, 'all', 0.35);

      // —— GPU 像素 A/B（强度 0 → .55）+ 同状态噪声
      const gpu = await p.evaluate(async () => {
        const b = await document.querySelector('iframe').contentWindow.eval("import('three')");
        const { view } = window.surfaceShadowReview.api, sh = view.groundSurfaceShadow;
        const rt = new b.WebGLRenderTarget(560, 390), r = view.renderer, old = r.getRenderTarget();
        const read = () => { r.setRenderTarget(rt); r.render(view.scene, view.camera); const o = new Uint8Array(560 * 390 * 4); r.readRenderTargetPixels(rt, 0, 0, 560, 390, o); return o; };
        const diff = (a, c) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== c[i] || a[i + 1] !== c[i + 1] || a[i + 2] !== c[i + 2]) n++; return n; };
        try {
          sh.set({ strength: 0 }); sh.refresh(); const off = read();
          const off2 = read();
          sh.set({ strength: 0.55 }); sh.refresh(); const on = read();
          return { changed: diff(off, on), noise: diff(off, off2) };
        } finally { r.setRenderTarget(old); rt.dispose(); }
      });

      const file = `artifacts/coverage/surface-shadow-landing-${grid}-r203.png`;
      await p.screenshot({ path: file });
      shots.push(file);
      reports.push({ grid, too3d, tuned, tunedPixels, allRecv, roofUp, gpu });
      await p.close();
    }

    fs.writeFileSync('artifacts/coverage/surface-shadow-landing-browser.json', JSON.stringify({ reports, errors, shots }, null, 2));
    for (const r of reports) {
      // 第一段那版（门槛 0）：影子糊到平台内部，覆盖率明显更高、落点更散
      assert.ok(r.too3d.coveragePct > r.tuned.coveragePct * 2,
        r.grid + ' 门槛 0 的覆盖率应至少是调好的两倍：' + r.too3d.coveragePct.toFixed(2) + '% vs ' + r.tuned.coveragePct.toFixed(2) + '%');
      // 第二段：只剩草地-崖缘边
      assert.ok(r.tuned.elsewhere <= 2, r.grid + ' 门槛 .6 时落点应几乎只剩崖缘，实得别处 ' + r.tuned.elsewhere);
      assert.ok(r.tuned.edgeShare > 0.99, r.grid + ' 崖缘占比应接近满值：' + r.tuned.edgeShare.toFixed(3));
      assert.ok(r.tuned.hits > 0 && r.tuned.hits < r.too3d.hits, r.grid + ' 抬高门槛应减少阴影像素');
      // 如实：地形场景没有建筑顶面，檐下份额 0（屋檐那一半由 tests/surface-shadow-casters.mjs 的
      // 「house roof casts an eave shadow」夹具断言覆盖，本页 roofRise 改不动它）
      assert.equal(r.tuned.roofShare, 0, r.grid + ' 地形场景不该有檐下影子');
      // 洞内接收面：第二张体素射线图有像素
      assert.ok(r.allRecv.holeShadowed > 0, r.grid + ' 接收面含洞内时应有洞内地面影子：' + r.allRecv.holeShadowed);
      assert.ok(r.allRecv.receivers === 'all', r.grid + ' 接收面未落到 all');
      assert.ok(r.allRecv.hits >= r.tuned.hits, r.grid + ' 加洞内接收面不该减像素');
      assert.ok(r.gpu.changed > 3000, r.grid + ' 强度 0→.55 的 GPU 差分太小：' + r.gpu.changed);
      assert.equal(r.gpu.noise, 0, r.grid + ' 同状态两帧噪声应为 0，实得 ' + r.gpu.noise);
      assert.ok(r.tunedPixels.eligible > 0 && r.tunedPixels.res >= 96, r.grid + ' 应跑真 World 的烘焙');
    }
    assert.deepEqual(errors, []);
    const fmt = (r) => `${r.grid}: 门槛0 覆盖 ${r.too3d.coveragePct.toFixed(2)}%/别处 ${r.too3d.elsewhere}px → 门槛.6 覆盖 ${r.tuned.coveragePct.toFixed(2)}%/崖缘 ${(r.tuned.edgeShare * 100).toFixed(1)}%/檐下 ${(r.tuned.roofShare * 100).toFixed(1)}%/别处 ${r.tuned.elsewhere}px；洞内 ${r.allRecv.holeShadowed}px；瓦檐抬高 ${r.roofUp.coveragePct.toFixed(2)}%；GPU A/B ${r.gpu.changed}px 噪声 ${r.gpu.noise}`;
    console.log('PASS surface shadow landing\n' + reports.map(fmt).join('\n'));
  } finally { await browser.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
