// r159 · 1714613599035863191 · 田纹第三档「宽软带」（uFields=3）+ 整场景剪影 + 裸顶面
// 口径（三件事都要有数，不能只看截图）：
//   ① 剪影是**整场景** overrideMaterial：片中 0138 是整岛连树/灌丛一起黑 —— 取「光照段是绿色植被」的像素，
//      在剪影段必须 < 24；且海面在剪影段被藏掉（原片剪影帧没有海面），切回后必须复原。
//   ② 宽软带 vs 0.18 细线（同一台相机、同一格）：占空比 ≈1:1、边沿明显更软、对比度更高。
//      取样**不出格**（沿该三角自己的 u 轴，长度 = 内切半径×0.9）—— r158 的 64px 取样跨到邻格，读数不可信。
//   ③ 关掉植被/瀑布/云/船（`?veg=0`）后顶面才是裸的：岛内「绿像素」占比必须掉到接近 0（原片顶面是裸浅黄）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');
const OUT = 'artifacts/coverage';

const stat = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (t) => s[Math.min(s.length - 1, Math.floor(t * s.length))] ?? 0;
  return { n: s.length, p50: +q(.5).toFixed(3), p90: +q(.9).toFixed(3), min: +(s[0] ?? 0).toFixed(3), max: +(s[s.length - 1] ?? 0).toFixed(3) };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const errors = [];
  try {
    const URL = 'http://127.0.0.1:8769/fields.html?stage=fields&fields=bands&veg=0';
    let p = null, ready = false;
    for (let attempt = 0; attempt < 3 && !ready; attempt++) {
      if (p) await p.close().catch(() => {});
      p = await b.newPage({ viewport: { width: 1280, height: 900 } });
      p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico')) errors.push('console: ' + m.text()); });
      try { await p.goto(URL, { waitUntil: 'load', timeout: 90000 }); } catch (e) { continue; }
      for (let i = 0; i < 70; i++) { await p.waitForTimeout(1000); ready = await p.evaluate(() => !!window.fieldReview?.api).catch(() => false); if (ready) break; }
    }
    if (!ready) throw new Error('fields.html 未就绪 errors=' + JSON.stringify(errors));
    await p.waitForTimeout(1200);

    // 冻帧（app.js 自己 rAF；不冻帧噪声会盖过条纹信号）
    await p.evaluate(() => { const v = window.fieldReview.api.view; v.__orig = v.render.bind(v); v.render = () => {}; });

    // ── 素材①：整岛 A/B（裸顶面 vs 有植被）+ 四段
    const shotFrame = async (fn) => (await p.locator('#scene').screenshot()).toString('base64');
    const render = async () => { await p.evaluate(() => window.fieldReview.api.view.__orig(0)); await p.waitForTimeout(260); };

    const islandShots = {};
    for (const veg of [true, false]) {
      await p.evaluate((v) => window.fieldReview.setVeg(v), veg);
      await render();
      islandShots[veg ? 'vegOn' : 'vegOff'] = await shotFrame();
    }
    // 四段（裸顶面）：fields(bands) / lit / unlit / shape
    await p.evaluate(() => window.fieldReview.setStage('fields'));
    await render(); islandShots.bands = await shotFrame();
    await p.evaluate(() => window.fieldReview.setStage('lit'));
    await render(); islandShots.lit = await shotFrame();
    await p.evaluate(() => window.fieldReview.setStage('unlit'));
    await render(); islandShots.unlit = await shotFrame();
    await p.evaluate(() => window.fieldReview.setStage('shape'));
    const shapeState = await p.evaluate(() => { window.fieldReview.api.view.__orig(0); const v = window.fieldReview.api.view; return { waves: v.waves?.visible, skirt: v.skirt?.visible, override: !!v.scene.overrideMaterial }; });
    await p.waitForTimeout(260);
    islandShots.shape = await shotFrame();
    await p.evaluate(() => window.fieldReview.setStage('fields'));
    const restoreState = await p.evaluate(() => { const v = window.fieldReview.api.view; return { waves: v.waves?.visible, skirt: v.skirt?.visible, override: !!v.scene.overrideMaterial }; });

    // ── 素材②：近景 A/B（同一格，bands vs stripes）
    const cellList = await p.evaluate(() => {
      const cs = window.fieldReview.cells().filter((x) => x.r > .09);
      cs.sort((a, b) => b.r - a.r);
      const pick = [];
      for (const c of cs) { if (pick.some((q) => Math.hypot(q.c[0] - c.c[0], q.c[2] - c.c[2]) < 3)) continue; if (pick.length >= 6) break; pick.push(c); }
      return pick;
    });
    assert.ok(cellList.length >= 4, '样本格太少：' + cellList.length);
    const closeups = [];
    for (const cell of cellList) {
      for (const mode of ['stripes', 'bands']) {
        const seg = await p.evaluate(({ c, mode }) => {
          window.fieldReview.setBands(mode === 'bands');
          window.fieldReview.look(c.c, 2.4, 1.35, 0);
          const v = window.fieldReview.api.view; v.__orig(0);
          const P = (q) => window.fieldReview.project(q);
          const ctr = P(c.c);
          const ux = c.ux;
          // 一个周期（0.2 世界单位）在该机位下的屏幕长度：用来判「一个 240px 补丁里有几个周期」
          const p2 = P([c.c[0] + .2 * ux[0], c.c[1], c.c[2] + .2 * ux[1]]);
          // 该三角三个顶点的屏幕坐标：分析时按重心坐标只取**这个三角面内**的像素，
          // 保证读数不掺邻格/崖壁/背景（r158 的取样线上跨格就是这个坑）
          const tri = (c.p3 || []).map(P);
          return { ctr, tri, periodPx: ctr && p2 ? +Math.hypot(p2[0] - ctr[0], p2[1] - ctr[1]).toFixed(1) : null, uFields: v.fieldOn.value };
        }, { c: cell, mode });
        await p.waitForTimeout(220);
        const img = await shotFrame();
        closeups.push({ cell, mode, seg, img });
      }
    }
    // 复原到整岛视角
    await p.evaluate(() => { const v = window.fieldReview.api.view; v.target.set(0, 1.2, 0); v.distance = 30; v.pitch = .62; v.yaw = Math.PI * .28; v.updateCamera(); v.__orig(0); });

    // ── 页面内解码 + 全部读数（整幅 ImageData 不过 CDP，r149 教训）
    const res = await p.evaluate(async ({ islandShots, closeups }) => {
      const dec = async (s) => { const r = await fetch('data:image/png;base64,' + s); const bm = await createImageBitmap(await r.blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height); };
      const lumAt = (X, i) => .299 * X.data[i] + .587 * X.data[i + 1] + .114 * X.data[i + 2];
      const lum = (X) => { let s = 0, n = 0, dark = 0; for (let i = 0; i < X.data.length; i += 4) { const l = lumAt(X, i); s += l; n++; if (l < 24) dark++; } return { mean: +(s / n).toFixed(2), darkShare: +(dark / n).toFixed(3), n }; };
      const green = (X, mask) => { let n = 0, g = 0; for (let i = 0, j = 0; i < X.data.length; i += 4, j++) { if (mask && !mask[j]) continue; n++; const r = X.data[i], gg = X.data[i + 1], bb = X.data[i + 2]; if (gg > r + 10 && gg > bb + 6) g++; } return { n, greenShare: +(g / Math.max(1, n)).toFixed(3) }; };
      const diff = (X, Y, mask) => { let n = 0; for (let i = 0, j = 0; i < X.data.length; i += 4, j++) { if (mask && !mask[j]) continue; const d = Math.abs(X.data[i] - Y.data[i]) + Math.abs(X.data[i + 1] - Y.data[i + 1]) + Math.abs(X.data[i + 2] - Y.data[i + 2]); if (d > 12) n++; } return n; };

      const V = {}, Sh = {}, Li = {}, Un = {}, Bd = {};
      for (const [k, s] of Object.entries(islandShots)) { const X = await dec(s); if (k === 'vegOn') V.on = X; else if (k === 'vegOff') V.off = X; else if (k === 'shape') Sh.x = X; else if (k === 'lit') Li.x = X; else if (k === 'unlit') Un.x = X; else if (k === 'bands') Bd.x = X; }
      // 岛掩码 = 剪影段的暗像素（整场景剪影后，这个掩码就是「岛含植被」的完整轮廓）
      const mask = new Uint8Array(Sh.x.width * Sh.x.height);
      let mn = 0;
      for (let i = 0, j = 0; i < Sh.x.data.length; i += 4, j++) { mask[j] = lumAt(Sh.x, i) < 24 ? 1 : 0; if (mask[j]) mn++; }
      // 植被像素：光照段里「绿」的岛内像素（树/灌丛/草）
      const veg = new Uint8Array(mask.length); let vn = 0;
      for (let i = 0, j = 0; i < Li.x.data.length; i += 4, j++) {
        if (!mask[j]) continue;
        const r = Li.x.data[i], g = Li.x.data[i + 1], b = Li.x.data[i + 2];
        if (g > r + 10 && g > b + 6) { veg[j] = 1; vn++; }
      }
      let vegDark = 0;
      for (let i = 0, j = 0; i < Sh.x.data.length; i += 4, j++) if (veg[j] && lumAt(Sh.x, i) >= 24) vegDark++;
      const island = {
        maskPx: mn, maskShare: +(mn / (Sh.x.width * Sh.x.height)).toFixed(3),
        lumShape: lum(Sh.x), lumLitOverIsland: { n: mn, mean: +((() => { let s = 0; for (let i = 0, j = 0; i < Li.x.data.length; i += 4, j++) if (mask[j]) s += lumAt(Li.x, i); return s / Math.max(1, mn); })()).toFixed(2) },
        vegPx: vn, vegStillLitInShape: vegDark,
        diffBandsVsLit: diff(Bd.x, Li.x, mask), diffUnlitVsLit: diff(Un.x, Li.x, mask), diffShapeVsLit: diff(Sh.x, Li.x, mask),
        greenInsideIsland: { vegOn: green(V.on, mask), vegOff: green(V.off, mask) },
        diffVegOnOff: diff(V.on, V.off, mask),
      };

      // 近景：240×240 补丁 → 高频（减 41px 盒均值）读数
      //   · 一个补丁里含 1.5–2 个周期（periodPx 由该机位投影算出，不是拍的脑袋）
      //   · duty       = 高频 > 0 的像素占比（宽软带 ≈ 0.5；细线是亮底 + 窄暗线，占比偏低）
      //   · transShare = |高频| 落在 15%–85% 幅度之间的像素占比 → 边沿越软越大
      //   · sdHp       = 高频标准差 → 对比度
      const boxMean = (Lp, w, h, r) => {
        const sat = new Float64Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += Lp[y * w + x]; sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row; } }
        const out = new Float64Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w - 1, x + r), y1 = Math.min(h - 1, y + r);
          const S = sat[(y1 + 1) * (w + 1) + x1 + 1] - sat[y0 * (w + 1) + x1 + 1] - sat[(y1 + 1) * (w + 1) + x0] + sat[y0 * (w + 1) + x0];
          out[y * w + x] = S / ((x1 - x0 + 1) * (y1 - y0 + 1));
        }
        return out;
      };
      const per = [];
      const PW = 240;
      for (const c of closeups) {
        const X = await dec(c.img);
        const ctr = c.seg.ctr;
        if (!ctr) { per.push({ mode: c.mode, bad: 'no-ctr' }); continue; }
        const x0 = Math.round(ctr[0] - PW / 2), y0 = Math.round(ctr[1] - PW / 2);
        if (x0 < 0 || y0 < 0 || x0 + PW > X.width || y0 + PW > X.height) { per.push({ mode: c.mode, bad: 'out-of-frame' }); continue; }
        const Lp = new Float64Array(PW * PW);
        for (let y = 0; y < PW; y++) for (let x = 0; x < PW; x++) Lp[y * PW + x] = lumAt(X, ((y0 + y) * X.width + x0 + x) * 4);
        const bg = boxMean(Lp, PW, PW, 41);
        // 三角掩码（向重心收 12%，避开 AA 边与相邻面）
        let T = c.seg.tri;
        if (!T || T.length !== 3 || T.some((q) => !q)) { per.push({ mode: c.mode, bad: 'no-tri' }); continue; }
        const G = [(T[0][0] + T[1][0] + T[2][0]) / 3, (T[0][1] + T[1][1] + T[2][1]) / 3];
        T = T.map((q) => [G[0] + (q[0] - G[0]) * .88, G[1] + (q[1] - G[1]) * .88]);
        const inTri = (px, py) => {
          const sgn = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
          const d1 = sgn(px, py, T[0][0], T[0][1], T[1][0], T[1][1]), d2 = sgn(px, py, T[1][0], T[1][1], T[2][0], T[2][1]), d3 = sgn(px, py, T[2][0], T[2][1], T[0][0], T[0][1]);
          const neg = (d1 < 0) || (d2 < 0) || (d3 < 0), posi = (d1 > 0) || (d2 > 0) || (d3 > 0);
          return !(neg && posi);
        };
        const vals = [];
        for (let y = 0; y < PW; y++) for (let x = 0; x < PW; x++) if (inTri(x0 + x, y0 + y)) vals.push(Lp[y * PW + x] - bg[y * PW + x]);
        if (vals.length < 2000) { per.push({ mode: c.mode, bad: 'mask-too-small', n: vals.length }); continue; }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
        const abs = vals.map((v) => Math.abs(v - mean)).sort((a, b) => a - b);
        const amp = abs[(abs.length * .9) | 0] || 1e-6;
        let pos = 0, trans = 0;
        for (const v of vals) { const d = v - mean; if (d > 0) pos++; const a = Math.abs(d) / amp; if (a > .2 && a < .8) trans++; }
        per.push({ mode: c.mode, cell: c.cell.c, deg: c.cell.deg, periodPx: c.seg.periodPx, patchPx: vals.length, sdHp: +sd.toFixed(2), amp: +amp.toFixed(2), duty: +(pos / vals.length).toFixed(3), transShare: +(trans / vals.length).toFixed(3), uFields: c.seg.uFields });
      }
      return { island, per };
    }, { islandShots, closeups });

    const I = res.island, per = res.per;
    console.log('RAW', JSON.stringify({ island: I, per: per.map((x) => ({ m: x.mode, sd: x.sdHp, duty: x.duty, trans: x.transShare, per: x.periodPx, bad: x.bad })) }));
    // ── ① 剪影：整场景
    assert.ok(shapeState.override, '剪影段没有设 scene.overrideMaterial');
    assert.equal(shapeState.waves, false, '剪影段海面没藏起来');
    assert.equal(restoreState.waves, true, '切回后海面没复原');
    assert.equal(restoreState.override, false, '切回后 overrideMaterial 没清');
    assert.ok(I.maskPx > 30000, '剪影岛掩码太小：' + I.maskPx);
    assert.ok(I.vegPx > 3000, '光照段岛内绿色像素太少（植被没上画？）：' + I.vegPx);
    assert.equal(I.vegStillLitInShape, 0, '剪影段有 ' + I.vegStillLitInShape + ' 个植被像素仍是亮的（树/灌丛没被盖黑）');

    // ── ③ 裸顶面
    // 关植被后岛内绿像素减半（剩下的绿是地形顶点色里本来就偏绿的格子，不是植被层）——见证据 r159
    const gOn = I.greenInsideIsland.vegOn.greenShare, gOff = I.greenInsideIsland.vegOff.greenShare;
    assert.ok(gOn > .05, '开植被时岛内绿像素太少（植被没上画？）：' + JSON.stringify(I.greenInsideIsland.vegOn));
    assert.ok(gOff < gOn * .55 && gOff < .08, '关植被后顶面还是绿的：' + JSON.stringify(I.greenInsideIsland));
    assert.ok(I.diffVegOnOff > 20000, '植被开关整帧几乎没变：' + I.diffVegOnOff);

    // 田纹本身在整岛上确实改了画面（bands 有作用）
    assert.ok(I.diffBandsVsLit > 20000, 'bands 与光照段几乎一样：' + I.diffBandsVsLit);

    // ── ② 近景：bands vs stripes
    const ok = per.filter((x) => !x.bad);
    const bs = ok.filter((x) => x.mode === 'bands'), ss = ok.filter((x) => x.mode === 'stripes');
    assert.ok(bs.length >= 4 && ss.length >= 4, '近景样本不足：' + JSON.stringify(per.map((x) => x.mode + '/' + (x.bad || ''))));
    assert.ok(bs.every((x) => x.periodPx > 20), '近景取样太短（相机没推进去）：' + JSON.stringify(bs.map((x) => x.periodPx)));
    const avg = (a, k) => a.reduce((x, y) => x + y[k], 0) / a.length;
    const dB = avg(bs, 'duty'), dS = avg(ss, 'duty');
    assert.ok(dB > .44 && dB < .56, '带的占空比离 1:1 太远：' + dB.toFixed(3));
    assert.ok(dB > dS + .02, '带上亮区占比没有比细线大（带没变宽）：' + [dB.toFixed(3), dS.toFixed(3)]);
    // 逐格配对：同一格同一机位，bands 的高频幅度应普遍高于 stripes（5/6 及以上）
    let pairs = 0, sdUp = 0;
    for (const c of cellList) {
      const same = (x) => x.cell && Math.hypot(x.cell[0] - c.c[0], x.cell[1] - c.c[1], x.cell[2] - c.c[2]) < 1e-6;
      const a = ok.find((x) => x.mode === 'bands' && same(x)), z = ok.find((x) => x.mode === 'stripes' && same(x));
      if (!a || !z) continue;
      pairs++; if (a.sdHp > z.sdHp) sdUp++;
    }
    assert.ok(pairs >= 4 && sdUp >= pairs - 1, '带的对比度没有普遍高于细线：' + sdUp + '/' + pairs);
    // 截图落盘（ViewImage 必须真看过）
    for (const [name, data] of Object.entries({ 'field-bands-island-r159': islandShots.bands, 'field-bands-shape-r159': islandShots.shape, 'field-bands-vegOn-r159': islandShots.vegOn, 'field-bands-vegOff-r159': islandShots.vegOff })) {
      fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
    }
    closeups.slice(0, 6).forEach((c, i) => fs.writeFileSync(`${OUT}/field-bands-closeup-${i}-${c.mode}-r159.png`, Buffer.from(c.img, 'base64')));

    const out = {
      id: '1714613599035863191', round: 'r159',
      island: I, silhouette: { shapeState, restoreState },
      closeups: per,
      summary: { patches: ok.length, dutyBands: +avg(bs, 'duty').toFixed(3), dutyStripes: +avg(ss, 'duty').toFixed(3), sdBands: +avg(bs, 'sdHp').toFixed(2), sdStripes: +avg(ss, 'sdHp').toFixed(2), sdPairsUp: sdUp, sdPairs: pairs, transBands: +avg(bs, 'transShare').toFixed(3), transStripes: +avg(ss, 'transShare').toFixed(3), periodPx: bs.map((x) => x.periodPx) },
      consoleErrors: errors,
    };
    fs.writeFileSync(`${OUT}/field-pattern-bands-browser.json`, JSON.stringify(out, null, 2));
    console.log('PASS field-pattern-bands', JSON.stringify({ summary: out.summary, island: { maskPx: I.maskPx, maskShare: I.maskShare, vegPx: I.vegPx, vegStillLit: I.vegStillLitInShape, green: I.greenInsideIsland, diff: { bands: I.diffBandsVsLit, unlit: I.diffUnlitVsLit, veg: I.diffVegOnOff } }, cells: ok.length, errors: errors.length }));
    assert.equal(errors.length, 0, '控制台有错：' + errors.join(' | '));
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
