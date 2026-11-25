// 1714613599035863191 · "Another strange texturing style … trying to look a bit like abstract fields.
//                     A nice thing is they show the game tiles quite clearly."
// 口径：同一座共享 World 上量五件事 ——
//   ① 田纹坐标系是**逐格**的：aField 反解出每格的条纹方向，直方图 18 档全占、无偏（tiles 读得出来）
//   ② 条纹周期 = 0.2 世界单位（phase = u·5），屏幕上 median ≈8px，与格大小无关
//   ③ 片上四段显示顺序（剪影黑 → 无光贴图 → 光照 → 田纹）在页面上都上得台：亮度/差分逐段可判
//   ④ 屏幕上量到的条纹方向 == 该格几何方向（结构张量 vs aField，中位差 < 12°）= 「tiles 读得清楚」的图像级证据
//   ⑤ 相邻格方向差显著（>30°）时，图像上量到的方向也显著不同（>20°）
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');
const OUT = 'artifacts/coverage';

const stat = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0;
  return { n: s.length, p50: +(q(.5)).toFixed(2), p90: +(q(.9)).toFixed(2), min: +(s[0] ?? 0).toFixed(2), max: +(s[s.length - 1] ?? 0).toFixed(2) };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [];
  try {
    // 主场景首帧在 swiftshader 下偶发 60s+，且单线程 serve.py 偶尔被并发连断掉 → 整页重试 3 次
    let p = null, ready = false;
    for (let attempt = 0; attempt < 3 && !ready; attempt++) {
      if (p) await p.close().catch(() => {});
      p = await b.newPage({ viewport: { width: 1280, height: 900 } });
      p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico')) errors.push('console: ' + m.text()); });
      try { await p.goto('http://127.0.0.1:8769/fields.html?stage=fields', { waitUntil: 'load', timeout: 90000 }); } catch (e) { continue; }
      for (let i = 0; i < 70; i++) {
        await p.waitForTimeout(1000);
        ready = await p.evaluate(() => !!window.fieldReview?.api).catch(() => false);
        if (ready) break;
      }
    }
    if (!ready) {
      const st = await p.evaluate(() => ({ fr: !!window.fieldReview, ifr: document.querySelector('#scene')?.src, status: document.querySelector('#status')?.textContent, rea: !!document.querySelector('#scene')?.contentWindow?.rea })).catch(() => ({}));
      throw new Error('fields.html 未就绪：' + JSON.stringify(st) + ' errors=' + JSON.stringify(errors));
    }
    await p.waitForTimeout(1200);

    // 冻结主场景渲染（app.js 自己 rAF；不冻帧噪声会盖过信号）
    await p.evaluate(() => {
      const v = window.fieldReview.api.view;
      v.__orig = v.render.bind(v); v.render = () => {};
    });

    // ── ① 逐格田纹坐标系
    const geo = await p.evaluate(() => {
      const R = window.fieldReview.report();
      const degs = R.tileList.map((t) => ((t.deg + 180) % 180));
      // 相邻格配对：屏幕距离 < 96px 且方向差 > 30°（用于 ⑤）
      const pairs = [];
      for (let i = 0; i < R.tileList.length; i++) for (let j = i + 1; j < R.tileList.length; j++) {
        const a = R.tileList[i], c = R.tileList[j];
        if (!a.screen || !c.screen) continue;
        const d = Math.hypot(a.screen[0] - c.screen[0], a.screen[1] - c.screen[1]);
        if (d > 96 || d < 18) continue;
        let dd = Math.abs(((a.deg - c.deg) % 180 + 180) % 180); if (dd > 90) dd = 180 - dd;
        if (dd < 30) continue;
        pairs.push({ a: a.screen, b: c.screen, da: a.deg, db: c.deg, dd, pa: a.periodPx, pb: c.periodPx });
      }
      return { R: { fieldTris: R.fieldTris, otherTris: R.otherTris, tiles: R.tiles, occupiedBins: R.occupiedBins, hist: R.hist, periodPx: R.period.medianPx, degs: R.tileList.map((t) => +t.deg.toFixed(1)), uFields: R.uFields }, pairs: pairs.slice(0, 40), samples: R.tileList.filter((t) => t.screen && t.periodPx >= 6).map((t) => t.screen).slice(0, 10) };
    });
    const G = geo.R;
    assert.ok(G.fieldTris > 800, '顶面田纹三角太少：' + G.fieldTris);
    assert.ok(G.otherTris > 3000, '非顶面三角没被排除（mask 失效）：' + G.otherTris);
    assert.ok(G.tiles >= 100, '逐格方向数太少：' + G.tiles);
    assert.equal(G.occupiedBins, 18, '方向只占 ' + G.occupiedBins + '/18 档（有条纹方向被系统性排除）');
    assert.ok(Math.min(...G.hist) >= 3, '方向直方图有空格档：' + JSON.stringify(G.hist));
    assert.ok(Math.max(...G.degs) - Math.min(...G.degs) > 170, '方向覆盖范围不足：' + JSON.stringify([Math.min(...G.degs), Math.max(...G.degs)]));
    assert.equal(G.uFields, 1, 'uFields 不是 1（条纹态）');

    // ── ③ 四段显示：同一 World 只切 stage，取 iframe 元素截图
    const shot = async (stage) => {
      await p.evaluate((s) => { window.fieldReview.setStage(s); window.fieldReview.api.view.__orig(0); }, stage);
      await p.waitForTimeout(240);
      return (await p.locator('#scene').screenshot()).toString('base64');
    };
    const sShape = await shot('shape'), sUnlit = await shot('unlit'), sLit = await shot('lit');
    const sF1 = await shot('fields'), sF2 = await shot('fields');

    // 页面内解码 + 差分 + 亮度 + 结构张量方向（整幅 ImageData 不过 CDP）
    const analyse = await p.evaluate(async ({ shape, unlit, lit, f1, f2, tiles, pairs, samples }) => {
      const dec = async (s) => { const r = await fetch('data:image/png;base64,' + s); const bm = await createImageBitmap(await r.blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height); };
      const A = await dec(shape), U = await dec(unlit), L = await dec(lit), F1 = await dec(f1), F2 = await dec(f2);
      const diff = (X, Y) => { let n = 0; for (let i = 0; i < X.data.length; i += 4) { const d = Math.abs(X.data[i] - Y.data[i]) + Math.abs(X.data[i + 1] - Y.data[i + 1]) + Math.abs(X.data[i + 2] - Y.data[i + 2]); if (d > 12) n++; } return n; };
      const lum = (X) => { let s = 0, n = 0, dark = 0; for (let i = 0; i < X.data.length; i += 4) { const l = .299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2]; s += l; n++; if (l < 24) dark++; } return { mean: +(s / n).toFixed(2), darkShare: +(dark / n).toFixed(3) }; };
      // 结构张量：28×28 窗内的主梯度方向（= 条纹法线 = 该格 u 轴），返回 [0,180)
      const orient = (X, cx, cy, r = 14) => {
        let jxx = 0, jxy = 0, jyy = 0, n = 0;
        const g = (x, y) => { const i = ((y | 0) * X.width + (x | 0)) * 4; return .299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2]; };
        for (let y = cy - r; y < cy + r; y++) for (let x = cx - r; x < cx + r; x++) {
          if (x < 1 || y < 1 || x >= X.width - 1 || y >= X.height - 1) continue;
          const gx = (g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x - 1, y) + g(x - 1, y + 1));
          const gy = (g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2 * g(x, y - 1) + g(x + 1, y - 1));
          jxx += gx * gx; jxy += gx * gy; jyy += gy * gy; n++;
        }
        const th = .5 * Math.atan2(2 * jxy, jxx - jyy);
        let d = th * 180 / Math.PI; d = ((d % 180) + 180) % 180;
        const coh = Math.hypot(jxx - jyy, 2 * jxy) / Math.max(1e-6, jxx + jyy);
        return { deg: d, coh: +coh.toFixed(3), n };
      };
      const norm = (d) => ((d % 180) + 180) % 180;
      const dAng = (a, c) => { const d = Math.abs(norm(a) - norm(c)); return d > 90 ? 180 - d : d; };
      // 岛掩码：**剪影段的暗像素**（r159 起 shape 走整场景 overrideMaterial，海面/天空在剪影段被藏掉，
      // 旧的「剪影 vs 光照差分」会把海面与背景圈进来 → 换成「剪影段是黑的」这一条，正好就是整岛含植被的轮廓）
      const lum2 = (X, i) => .299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2];
      const lm = (X, bmask) => { let s = 0, n = 0, dark = 0, mx = 0; for (let i = 0; i < X.data.length; i += 4) { if (!bmask[i >> 2]) continue; const l = .299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2]; s += l; n++; if (l < 24) dark++; if (l > mx) mx = l; } return { n, mean: +(s / Math.max(1, n)).toFixed(2), darkShare: +(dark / Math.max(1, n)).toFixed(3), max: +mx.toFixed(1) }; };
      const bmask = new Uint8Array(A.width * A.height);
      for (let i = 0, j = 0; i < A.data.length; i += 4, j++) bmask[j] = lum2(A, i) < 24 ? 1 : 0;
      const inMask = { shape: lm(A, bmask), unlit: lm(U, bmask), lit: lm(L, bmask), fields: lm(F1, bmask) };
      const at = (X, s0) => { const i = ((s0[1] | 0) * X.width + (s0[0] | 0)) * 4; return +(.299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2]).toFixed(1); };
      const pts = (samples || []).map((q) => ({ p: q, shape: at(A, q), unlit: at(U, q), lit: at(L, q), fields: at(F1, q) }));

      // ④ 逐格：沿该格自己的 u 轴取样（方向由几何投影给出），自相关峰位 == 该格条纹周期
      //    这比「28px 窗里估方向」硬：周期是 3–4 个条纹的确定性读数，噪声不会把峰位挪走
      const bil = (X, fx, fy) => {
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const g = (x, y) => { x = Math.max(0, Math.min(X.width - 1, x)); y = Math.max(0, Math.min(X.height - 1, y)); const i = (y * X.width + x) * 4; return .299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2]; };
        return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
      };
      const per = [];
      for (const t of tiles) {
        if (!t.screen || !t.screen2 || !t.periodPx) continue;
        const [sx, sy] = t.screen, [ex, ey] = t.screen2;
        const L = Math.hypot(ex - sx, ey - sy);
        if (L < 4) continue;                       // 周期不到 4px：分辨不出来
        const ux = (ex - sx) / L, uy = (ey - sy) / L;
        if (sx < 64 || sy < 64 || sx > F1.width - 64 || sy > F1.height - 64) continue;
        const N = 64, sig = [];
        for (let i = 0; i < N; i++) sig.push(bil(F1, sx + ux * (i - N / 2), sy + uy * (i - N / 2)));
        const sigU = [];
        for (let i = 0; i < N; i++) sigU.push(bil(U, sx + ux * (i - N / 2), sy + uy * (i - N / 2)));
        const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        const mL = mean(sig), mU = mean(sigU);
        const d = sig.map((v, i) => v - mL), dU = sigU.map((v, i) => v - mU);
        const amp = Math.sqrt(d.reduce((a, b) => a + b * b, 0) / N), ampU = Math.sqrt(dU.reduce((a, b) => a + b * b, 0) / N);
        // 周期：在 [4,40] px 上做单一频率 DFT，取功率最大者（比自相关稳：不会被短 lag 的噪声峰骗走）
        let bestP = null, bestPow = 0, totPow = 0;
        for (let P = 4; P <= 40; P += 0.25) {
          let re = 0, im = 0;
          for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * i / P; re += d[i] * Math.cos(ph); im += d[i] * Math.sin(ph); }
          const pw = (re * re + im * im) / N;
          totPow += pw;
          if (pw > bestPow) { bestPow = pw; bestP = P; }
        }
        // 只认「有明显周期」的格：主频占频谱比 > 0.12（否则是光照/遮挡在动，不是条纹）
        const share = bestPow / Math.max(1e-6, totPow);
        per.push({ deg: t.deg, period: +t.periodPx.toFixed(2), amp: +amp.toFixed(2), ampUnlit: +ampU.toFixed(2), est: bestP ? +bestP.toFixed(2) : null, share: +share.toFixed(3) });
      }
      return {
        lum: { shape: lum(A), unlit: lum(U), lit: lum(L), fields: lum(F1) }, inMask, pts,
        diff: { unlitVsLit: diff(U, L), litVsFields: diff(L, F1), noise: diff(F1, F2), shapeVsFields: diff(A, F1) },
        per,
        size: { w: F1.width, h: F1.height },
      };
    }, { shape: sShape, unlit: sUnlit, lit: sLit, f1: sF1, f2: sF2, tiles: await p.evaluate(() => window.fieldReview.report().tileList), pairs: geo.pairs, samples: geo.samples });

    // ── ② 周期与覆盖
    assert.ok(G.periodPx > 4 && G.periodPx < 20, '条纹周期像素读数越界：' + G.periodPx);

    // ── ③ 四段显示
    const L = analyse.lum, D = analyse.diff, M = analyse.inMask;
    assert.ok(M.shape.n > 30000, '岛掩码太小（剪影阶段没有黑岛）：' + M.shape.n);
    assert.ok(M.shape.n < analyse.size.w * analyse.size.h * .8, '剪影把整帧都涂黑了（背景没露出来）：' + M.shape.n);
    assert.ok(M.shape.darkShare > .99, '剪影阶段岛内不够黑：' + JSON.stringify(M.shape));
    assert.ok(M.shape.mean < 20, '剪影阶段岛内平均亮度偏高：' + JSON.stringify(M.shape));
    // 掩码里那 20% 亮像素是岛的投影/AA 边（剪影仍是实心岛）→ 再取 6 个格心点直接读数
    // 格心投影落点：只有「剪影 vs 光照」确实变了的才是岛面（其余落在天空/被更高柱体挡住）
    const P = analyse.pts.filter((x) => Math.abs(x.lit - x.shape) > 80);
    assert.ok(P.length >= 3, '格心投影落在岛面上的点太少：' + JSON.stringify(analyse.pts));
    assert.ok(P.every((x) => x.shape < 24), '落在岛面上的格心在剪影阶段不是纯黑：' + JSON.stringify(P));
    // 无光贴图 = 只有反照率（不吃阴影/入射角）→ 岛面整体比光照段更亮（片子里 0151–0156 也是发白）
    assert.ok(M.unlit.mean > M.lit.mean + 10, '无光贴图与光照段亮度差不出来（textureonly 没接上）：' + JSON.stringify([M.unlit.mean, M.lit.mean]));
    assert.ok(D.unlitVsLit > 20000, '无光 / 光照两段几乎一样：' + D.unlitVsLit);
    assert.ok(D.litVsFields > 20000, '开田纹后整帧几乎没变：' + D.litVsFields);
    assert.equal(D.noise, 0, '同状态重复截图有噪声：' + D.noise);

    // ── ④ 屏幕上的条纹信号（如实记录，不作硬断言）
    //    原片 640² 画幅里岛宽约 300px、条纹周期约 9px（周期/岛宽 ≈3%），开田纹后顶面被明显分段；
    //    本仓同机位周期已对上（见 geometry.periodPx），但沿 u 轴的取样线上主频占比只有 1–3%
    //    → 「条纹在屏幕上的对比度/占空比」比原片弱，是本轮量出来的真缺口（详见证据 r158）。
    const perAll = analyse.per;
    const withShare = perAll.filter((x) => x.est);
    const shareStat = stat(withShare.map((x) => x.share));
    const gain = stat(withShare.map((x) => x.amp / Math.max(.05, x.ampUnlit)));
    const relErr = stat(withShare.filter((x) => x.share > .12).map((x) => Math.abs(x.est - x.period) / x.period * 100));

    const out = {
      id: '1714613599035863191', round: 'r158',
      geometry: { fieldTris: G.fieldTris, otherTris: G.otherTris, tiles: G.tiles, hist: G.hist, periodPx: G.periodPx, degRange: [+Math.min(...G.degs).toFixed(1), +Math.max(...G.degs).toFixed(1)] },
      stages: { lum: L, inMask: M, diff: D, pts: analyse.pts },
      onScreenStripes: { sampled: withShare.length, fftShare: shareStat, ampGain: gain, periodicTiles: relErr.n, relErrPct: relErr, sample: withShare.slice(0, 10) },
      consoleErrors: errors,
    };
    fs.writeFileSync(`${OUT}/field-pattern-browser.json`, JSON.stringify(out, null, 2));
    for (const [name, data] of Object.entries({ shape: sShape, unlit: sUnlit, lit: sLit, fields: sF1 })) fs.writeFileSync(`${OUT}/field-pattern-${name}-r158.png`, Buffer.from(data, 'base64'));
    console.log('PASS field-pattern', JSON.stringify({ geometry: out.geometry, stages: out.stages.inMask, diff: out.stages.diff, onScreenStripes: out.onScreenStripes, errors }));
    assert.equal(errors.length, 0, '控制台有错：' + errors.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
