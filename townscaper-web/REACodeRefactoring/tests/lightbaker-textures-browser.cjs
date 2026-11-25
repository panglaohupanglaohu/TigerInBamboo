/**
 * tests/lightbaker-textures-browser.cjs
 * 1481661852887265288「Yet another light baker」三张贴图在真实 View 上的运行验收：
 *   ① 大笔触程序法线（正片第一张图）→ ?shade=paintnormal 在主场景真的扰动着色法线，且块尺度与块内单倾角可量；
 *   ② SDF(UV) → mega texture ↔ 六向光体积（第二、三张图）→ megatexture-gi.html 三张画布真的出来，
 *      SDF 的 RG=UV 反查落在「精确穿越面」上的比例 uvMatchRate 可量，反弹相对变化逐轮衰减。
 * 口径全部来自页面里真实跑出来的读数/像素，不从代码「应该有」推断。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage';
const url = (p) => 'http://127.0.0.1:8769/' + p;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const report = {};
  try {
    /* ---------- ① 大笔触法线：贴图自身的块统计 + 主场景像素 A/B ---------- */
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on('pageerror', (e) => errors.push('paintnormal: ' + e.message));
    await p.goto(url('index.html?scene=terrain'), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.rea?.view?.shading, null, { timeout: 120000, polling: 200 });
    await p.waitForTimeout(1200);

    // 贴图自身：块数 / 块宽 / 块内单倾角 / 倾斜量级（同一口径可直接和原片那张图比）
    const mapStats = await p.evaluate(async () => {
      const { paintNormal } = await import('/src/core/paint-normal.js');
      const m = paintNormal({ size: 128, chunks: 25, maxTiltDeg: 26 });
      const counts = new Map(); let tiltSum = 0, tiltMax = 0;
      const perChunk = new Map();
      for (let i = 0; i < m.size * m.size; i++) {
        const id = m.chunkId[i]; counts.set(id, (counts.get(id) || 0) + 1);
        const nx = (m.rgb[i * 3] / 255) * 2 - 1, ny = (m.rgb[i * 3 + 1] / 255) * 2 - 1, nz = (m.rgb[i * 3 + 2] / 255) * 2 - 1;
        const t = (Math.atan2(Math.hypot(nx, ny), nz) * 180) / Math.PI;
        tiltSum += t; tiltMax = Math.max(tiltMax, t);
        if (!perChunk.has(id)) perChunk.set(id, []); perChunk.get(id).push(t);
      }
      const areas = [...counts.values()].sort((a, b) => a - b);
      // 块内倾角离散度：同一块里 tilt 的 p90-p10，应该接近 0（一个块 = 一个随机倾角）
      let within = [];
      for (const [, arr] of perChunk) { const s = arr.slice().sort((a, b) => a - b); within.push(s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)]); }
      const meanArea = areas.reduce((a, b) => a + b, 0) / areas.length;
      return {
        size: m.size, chunks: m.chunks, chunkPx: m.chunkPx, distinctChunks: counts.size,
        meanChunkArea: +meanArea.toFixed(1), chunkWidth: +Math.sqrt(meanArea).toFixed(2),
        chunkWidthOverSize: +(Math.sqrt(meanArea) / m.size).toFixed(3),
        areaMin: areas[0], areaMax: areas[areas.length - 1],
        tiltMean: +(tiltSum / (m.size * m.size)).toFixed(2), tiltMax: +tiltMax.toFixed(2),
        withinChunkSpreadP90P10: +Math.max(...within).toFixed(2),
      };
    });
    report.paintNormalMap = mapStats;

    // 真实 View：冻时间轴后同状态两帧噪声底，再比 开/关
    const shot = async () => {
      await p.evaluate(() => {
        for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.opacity = '0';
      });
      return (await p.locator('canvas').first().screenshot()).toString('base64');
    };
    const geom = await p.evaluate(() => {
      const v = window.rea.view;
      const o = v.render.bind(v); v.render = () => o(0); window.__frozen = true;
      const g = v.worldMesh.geometry.attributes.position;
      let h = 0; for (let i = 0; i < g.count * 3; i++) h = (h * 31 + Math.round(g.array[i] * 1e5)) % 2147483647;
      return { positions: g.count, hash: h };
    });
    await p.evaluate(() => window.rea.view.setDebug('paintnormal', false));
    await p.waitForTimeout(600);
    const offA = await shot(); await p.waitForTimeout(400); const offB = await shot();
    await p.evaluate(() => window.rea.view.setDebug('paintnormal', true));
    await p.waitForTimeout(600);
    const onA = await shot();
    await p.evaluate(() => window.rea.view.setDebug('paintnormal', false));
    await p.waitForTimeout(600);
    const back = await shot();

    const pixel = await p.evaluate(async ([a, b, c, d]) => {
      const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib, ic, id] = await Promise.all([load(a), load(b), load(c), load(d)]);
      const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const grab = (img) => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, cv.width, cv.height).data; };
      const A = grab(ia), B = grab(ib), C = grab(ic), D = grab(id);
      const lum = (arr, i) => 0.2126 * arr[i] + 0.7152 * arr[i + 1] + 0.0722 * arr[i + 2];
      const diff = (X, Y) => {
        const mask = new Uint8Array(cv.width * cv.height); let n = 0, sum = 0, max = 0;
        for (let i = 0, px = 0; i < X.length; i += 4, px++) {
          const d = Math.abs(lum(X, i) - lum(Y, i));
          if (d > 2) { mask[px] = 1; n++; sum += d; max = Math.max(max, d); }
        }
        return { mask, n, sum, max };
      };
      const noise = diff(A, B), sig = diff(C, A), back2 = diff(D, A);
      // 连通块：笔触块的尺度（差分掩码上的块面积 → 等效边长）
      const comps = (mask) => {
        const seen = new Uint8Array(mask.length), areas = [];
        const W = cv.width, H = cv.height;
        for (let i = 0; i < mask.length; i++) {
          if (!mask[i] || seen[i]) continue;
          let area = 0; const st = [i]; seen[i] = 1;
          while (st.length) {
            const k = st.pop(); area++;
            const x = k % W, y = (k / W) | 0;
            if (x > 0 && mask[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; st.push(k - 1); }
            if (x < W - 1 && mask[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; st.push(k + 1); }
            if (y > 0 && mask[k - W] && !seen[k - W]) { seen[k - W] = 1; st.push(k - W); }
            if (y < H - 1 && mask[k + W] && !seen[k + W]) { seen[k + W] = 1; st.push(k + W); }
          }
          if (area >= 12) areas.push(area);
        }
        areas.sort((x, y) => x - y);
        const mean = areas.length ? areas.reduce((x, y) => x + y, 0) / areas.length : 0;
        return { n: areas.length, meanArea: +mean.toFixed(1), meanWidth: +Math.sqrt(mean).toFixed(2), p50Width: +(areas.length ? Math.sqrt(areas[areas.length >> 1]) : 0).toFixed(2), maxArea: areas[areas.length - 1] || 0 };
      };
      return {
        size: [cv.width, cv.height],
        noisePx: noise.n, noiseMean: noise.n ? +(noise.sum / noise.n).toFixed(3) : 0,
        signalPx: sig.n, signalMean: +(sig.sum / Math.max(1, sig.n)).toFixed(2), signalMax: +sig.max.toFixed(1),
        backPx: back2.n,
        patches: comps(sig.mask), signalShare: +(sig.n / (cv.width * cv.height)).toFixed(4),
      };
    }, [offA, offB, onA, back]);
    report.paintNormalView = { geometry: geom, ...pixel };
    await p.screenshot({ path: `${OUT}/lightbaker-r134-paintnormal.png` });
    await p.evaluate(() => window.rea.view.setDebug('paintnormal', true));
    await p.waitForTimeout(800);
    await p.locator('canvas').first().screenshot({ path: `${OUT}/lightbaker-r134-paintnormal-on.png` });
    await p.evaluate(() => window.rea.view.setDebug('paintnormal', false));
    await p.waitForTimeout(800);
    await p.locator('canvas').first().screenshot({ path: `${OUT}/lightbaker-r134-paintnormal-off.png` });
    await p.close();

    /* ---------- ②③ SDF(UV) → mega texture ↔ 六向光体积 ---------- */
    const q = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    q.on('pageerror', (e) => errors.push('mega: ' + e.message));
    await q.goto(url('megatexture-gi.html'), { waitUntil: 'domcontentloaded' });
    await q.waitForFunction(() => window.megaReview?.stats, null, { timeout: 180000, polling: 300 });
    const mega = await q.evaluate(() => window.megaReview.stats);
    report.mega = mega;

    // 三张画布真的画出了东西（不是空白），且互不相同
    const canvases = await q.evaluate(() => {
      const stats = {};
      for (const id of ['c-sdf', 'c-lv', 'c-mega']) {
        const c = document.getElementById(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const set = new Set(); let ink = 0;
        for (let i = 0; i < d.length; i += 4) { set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); if (d[i] + d[i + 1] + d[i + 2] > 24) ink++; }
        stats[id] = { w: c.width, h: c.height, colors: set.size, inkShare: +(ink / (c.width * c.height)).toFixed(3) };
      }
      return stats;
    });
    report.megaCanvases = canvases;
    await q.screenshot({ path: `${OUT}/lightbaker-r134-mega-three-maps.png`, clip: { x: 0, y: 0, width: 1280, height: 330 } });

    // 慢放：逐轮快照的出射光确有变化（mega texture 被光体积改写）
    const slow = await q.evaluate(async () => {
      const r = window.megaPage.view.megaGI;
      const n = r.snapshots?.length ?? 0;
      if (!n) return { snapshots: 0 };
      const energy = r.snapshots.map((s) => { let e = 0; for (let i = 0; i < s.exitance.length; i++) e += s.exitance[i]; return +e.toFixed(3); });
      return { snapshots: n, energy, monotone: energy.every((v, i) => i === 0 || v >= energy[i - 1]) };
    });
    report.megaSlow = slow;
    await q.close();

    /* ---------- 断言 ---------- */
    const fail = [];
    const m = report.paintNormalMap, v = report.paintNormalView, g = report.mega, cv = report.megaCanvases;
    if (m.distinctChunks !== m.chunks) fail.push(`块数 ${m.distinctChunks} != ${m.chunks}`);
    if (!(m.chunkWidthOverSize > 0.1 && m.chunkWidthOverSize < 0.3)) fail.push(`块宽/图宽 ${m.chunkWidthOverSize} 不在 0.1–0.3（大笔触而非细噪点）`);
    if (m.withinChunkSpreadP90P10 > 3) fail.push(`块内倾角离散 ${m.withinChunkSpreadP90P10}° 过大（应一块一倾角）`);
    if (v.noisePx !== 0) fail.push(`同状态噪声 ${v.noisePx}px（时间轴未冻住）`);
    if (!(v.signalPx > 2000)) fail.push(`开/关差分只有 ${v.signalPx}px`);
    if (v.backPx !== 0) fail.push(`关回后残留 ${v.backPx}px`);
    if (!(v.patches.n > 3 && v.patches.meanWidth > 6)) fail.push(`笔触块结构 ${JSON.stringify(v.patches)} 不像大块`);
    if (!(g.charts > 100 && g.texels > 1000)) fail.push(`mega texture 图集异常 charts=${g.charts} texels=${g.texels}`);
    if (!(g.uvMatchRate > 0.75)) fail.push(`SDF-UV 命中精确穿越面只有 ${(100 * g.uvMatchRate).toFixed(1)}%`);
    const bs = g.bounceStats || [];
    if (!(bs.length >= 3 && bs[1].relativeChange < bs[0].relativeChange && bs[2].relativeChange < bs[1].relativeChange)) fail.push(`反弹未单调衰减 ${JSON.stringify(bs)}`);
    for (const id of ['c-sdf', 'c-lv', 'c-mega']) if (!(cv[id].colors > 20 && cv[id].inkShare > 0.05)) fail.push(`${id} 近乎空白 ${JSON.stringify(cv[id])}`);
    if (errors.length) fail.push('pageerror: ' + errors.join(' | '));

    fs.writeFileSync(`${OUT}/lightbaker-textures-browser.json`, JSON.stringify({ report, errors, fail }, null, 2));
    if (fail.length) { console.error('FAIL\n - ' + fail.join('\n - ')); console.error(JSON.stringify(report, null, 1)); process.exitCode = 1; }
    else console.log('PASS ① 大笔触法线块宽/图宽 ' + m.chunkWidthOverSize + '（原片约 0.15）· 块内离散 ' + m.withinChunkSpreadP90P10 + '°\n'
      + '     View 像素 A/B：噪声 ' + v.noisePx + 'px · 差分 ' + v.signalPx + 'px（均值 ' + v.signalMean + ' 级，最大 ' + v.signalMax + '）· 回位 ' + v.backPx + 'px · 笔触块 ' + v.patches.n + ' 块/中位宽 ' + v.patches.p50Width + 'px\n'
      + '     ② SDF 切片 ' + cv['c-sdf'].colors + ' 色 · ③ 六向光 ' + cv['c-lv'].colors + ' 色 · mega texture ' + cv['c-mega'].colors + ' 色 / ' + g.charts + ' 片 ' + g.texels + ' 纹素\n'
      + '     SDF-UV 命中精确穿越面 ' + (100 * g.uvMatchRate).toFixed(1) + '%（' + g.uvMatch + '/' + g.uvHits + '）· 反弹相对变化 ' + bs.map((b) => (100 * b.relativeChange).toFixed(2) + '%').join(' → '));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
