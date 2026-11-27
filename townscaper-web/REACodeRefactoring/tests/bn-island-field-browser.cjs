// 1579474420749725696（"I'm back on the island generation"，454 帧）运行验收：
// 原片可观察行为只有两件 —— ① 岛以线框搭出（方格三角网，逐步长出）；② 着上台地色（草绿台地/浅沙岸/岩崖/黄顶小屋），
// 然后转镜换第二个种子再来一次。本测试在真实浏览器里跑 bn-island-field.html：
// 线框档画全部三角边、着色档画同一批三角顶点色，搭出进度对两者同一口径；顺带核小屋落在草台平顶上。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const URL = 'http://127.0.0.1:8769/bn-island-field.html';

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const out = {};
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
    await p.goto(URL);
    await p.waitForFunction(() => window.islandReviewReady === true, null, { timeout: 60000 });

    // ---------- ① 场与几何：种子确定性、两种子互异、海面不建面 ----------
    const base = await p.evaluate(() => {
      const api = window.islandReview.api;
      const a = api.ash();
      api.setSeed(1); const again = api.ash();
      api.setSeed(2); const other = api.ash();
      api.setSeed(1);
      const st = api.stats, f = api.field;
      // 小屋必须落在草/草顶、四邻同高（平顶内部），且互不小于 3 格
      const bad = [];
      for (const h of f.houses.houses) {
        const k = h.j * f.n + h.i;
        if (f.mat[k] !== 2 && f.mat[k] !== 3) bad.push([h.i, h.j, 'mat', f.mat[k]]);
        for (const dk of [-1, 1, -f.n, f.n]) if (Math.abs(f.h[k] - f.h[k + dk]) > 0.02 + 1e-9) bad.push([h.i, h.j, 'slope']);
      }
      // 海面格（mat 0）在几何里必须一格不建：面片三角数 = 非海格 ×2（顶面）+ 崖裙
      let nonSea = 0;
      for (let j = 0; j < f.n - 1; j++) for (let i = 0; i < f.n - 1; i++) if (f.mat[j * f.n + i] !== 0) nonSea++;
      return { a, again, other, st, bad, nonSea, houses: f.houses.houses.map((h) => [h.i, h.j, +h.h.toFixed(4), h.spire]), n: f.n };
    });
    assert.deepEqual(base.a, base.again, '同种子两次生成必须逐位相同');
    assert.notDeepEqual(base.a.hash, base.other.hash, '两个种子必须生成不同的岛（原片两组岛互异）');
    assert.ok(base.a.triangles > 1000, '三角太少，岛没建出来 ' + base.a.triangles);
    assert.ok(base.a.triangles >= base.nonSea * 2, '非海格的面片数对不上（海面被建了面或漏面）' + JSON.stringify({ tri: base.a.triangles, nonSea: base.nonSea }));
    assert.ok(base.a.triangles < (base.n - 1) * (base.n - 1) * 2 * 1.6, '三角数超过非海格上限，海面格被建面');
    assert.ok(base.st.sea > 500, '场上没有海面格，岛铺满了整张场 ' + base.st.sea);
    assert.deepEqual(base.bad, [], '小屋候选不在草台平顶上 ' + JSON.stringify(base.bad));

    // ---------- ② 搭出进度：线框与面片同一口径、单调、两端闭合 ----------
    const reveal = await p.evaluate(() => {
      const api = window.islandReview.api, st = api.stats, seq = [];
      api.setPhase(0);
      for (const t of [0, 0.25, 0.5, 1]) { api.setReveal(t); seq.push({ t, ...api.drawn() }); }
      const wireFull = st.wireVertices, triFull = st.triangles;
      api.setPhase(1); api.setReveal(1); const shade1 = api.drawn();
      api.setReveal(0.5); const shadeHalf = api.drawn();
      api.setReveal(1);
      return { seq, wireFull, triFull, shade1, shadeHalf };
    });
    const [r0, r25, r50, r100] = reveal.seq;
    assert.equal(r0.wire, 0, '搭出 0% 时线框不该有端点');
    assert.equal(r100.wire, reveal.wireFull, '搭出 100% 时线框端点应等于全部 ' + reveal.wireFull);
    assert.ok(r50.wire > r25.wire && r25.wire > 0 && r50.wire < r100.wire, '搭出进度必须单调递增 ' + JSON.stringify(reveal.seq.map((s) => s.wire)));
    assert.equal(reveal.shade1.surface, reveal.triFull * 3, '着色档的 drawRange 必须覆盖全部三角');
    assert.equal(reveal.shadeHalf.surface, Math.round(reveal.triFull * 3 * 0.5), '着色档搭出 50% 应与线框同一口径');

    // ---------- ③ 真实像素：线框档=细线，着色档=面，两者差异远高于噪声 ----------
    const px = await p.evaluate(async () => {
      const api = window.islandReview.api;
      api.setSpin(false); api.setView(-0.6, 0.86); api.setHouses(true); api.setReveal(1);
      const THREE = await import('three');
      const rt = new THREE.WebGLRenderTarget(640, 400, { depthBuffer: true });
      const r = api.renderer;
      const grab = () => {
        const old = r.getRenderTarget(); r.setRenderTarget(rt); r.render(api.scene, api.camera);
        const buf = new Uint8Array(640 * 400 * 4); r.readRenderTargetPixels(rt, 0, 0, 640, 400, buf);
        r.setRenderTarget(old);
        let line = 0, sat = 0, lum = 0, warm = 0;
        for (let i = 0; i < buf.length; i += 4) {
          const R = buf[i], G = buf[i + 1], B = buf[i + 2];
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          lum += mx;
          if (mx > 200 && mx - mn < 26) line++;           // 近白且低饱和 → 线框像素
          if (mx - mn > 34 && mx > 70) sat++;             // 明显彩色 → 着色像素
          if (R > 150 && G > 110 && B < G - 45) warm++;   // 黄屋顶
        }
        return { line, sat, warm, meanLum: +(lum / (640 * 400)).toFixed(2), sig: Array.from(buf.filter((_, i) => i % 97 === 0)) };
      };
      api.setPhase(0); const wire = grab();
      api.setPhase(1); const shade = grab();
      // 噪声底：同状态连拍两次
      const a1 = grab(), a2 = grab();
      let diff = 0; for (let i = 0; i < a1.sig.length; i++) if (a1.sig[i] !== a2.sig[i]) diff++;
      let ws = 0; for (let i = 0; i < wire.sig.length; i++) if (wire.sig[i] !== shade.sig[i]) ws++;
      rt.dispose();
      return { wire: { line: wire.line, sat: wire.sat, meanLum: wire.meanLum }, shade: { line: shade.line, sat: shade.sat, warm: shade.warm, meanLum: shade.meanLum }, noise: diff, wireShadeDiff: ws, samples: a1.sig.length };
    });
    assert.ok(px.wire.line > 4000, '线框档看不到线，白色细线像素 ' + px.wire.line);
    assert.ok(px.shade.sat > 20000, '着色档没有成片彩色面，彩色像素 ' + px.shade.sat);
    assert.ok(px.shade.sat > px.wire.sat * 3, '着色档彩色应远多于线框档 ' + JSON.stringify({ w: px.wire.sat, s: px.shade.sat }));
    assert.ok(px.shade.warm > 150, '黄色屋顶看不到，暖色像素 ' + px.shade.warm);
    assert.ok(px.noise === 0, '同状态连拍有噪声，像素断言不可靠 ' + px.noise);
    // 背景占了大部分像素，只要求有实质比例（>15%）变化，且远高于噪声底（=0）
    assert.ok(px.wireShadeDiff > px.samples * 0.15, '线框与着色档的像素差异不够，画面没换 ' + JSON.stringify({ ws: px.wireShadeDiff, n: px.samples }));

    // ---------- 截图（人眼复核口径：线框 / 着色 / 半程搭出） ----------
    await p.evaluate(() => { const a = window.islandReview.api; a.setSpin(false); a.setView(-0.6, 0.86); a.setReveal(1); a.setPhase(0); });
    await p.waitForTimeout(120);
    await p.screenshot({ path: 'artifacts/coverage/bn-island-field-wire.png' });
    await p.evaluate(() => window.islandReview.api.setPhase(1));
    await p.waitForTimeout(120);
    await p.screenshot({ path: 'artifacts/coverage/bn-island-field-shade.png' });
    await p.evaluate(() => { const a = window.islandReview.api; a.setPhase(0); a.setReveal(0.45); });
    await p.waitForTimeout(120);
    await p.screenshot({ path: 'artifacts/coverage/bn-island-field-half.png' });

    out.field = { triangles: base.a.triangles, hashSeed1: base.a.hash, hashSeed2: base.other.hash, materials: base.st.materials, seaCells: base.st.sea };
    out.houses = { count: base.st.houses, candidates: base.st.candidates, picks: base.houses };
    out.reveal = { wireFull: reveal.wireFull, triFull: reveal.triFull, seq: reveal.seq.map((s) => ({ t: s.t, wire: s.wire })) };
    out.pixels = px;
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/bn-island-field-browser.json', JSON.stringify({ out, errors }, null, 2));
    console.log('PASS bn-island-field：三角', base.a.triangles, '· 小屋', base.st.houses, '/ 候选', base.st.candidates,
      '· 线框像素', px.wire.line, '· 着色彩色像素', px.shade.sat, '· 黄屋顶', px.shade.warm, '· 噪声', px.noise);
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
