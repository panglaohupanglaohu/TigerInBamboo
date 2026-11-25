// 1205422438437273601 运行时验收（第三层，主场景）：门窗模板挖洞接进 buildings.js 主管线后，全岛 240 个门窗都真的是洞。
// 与另外两支的分工：opening-punch-browser.cjs 管独立零厚度平面上的方洞；opening-punch-arch-browser.cjs 管跨两层拱龛；
// 这一支只管「主场景/index.html 默认开着，且洞里真有厚度」。
// 判据全部来自 GPU 默认帧缓冲读回，不看代码"应该有"：
//   ① 接线：240 个洞 = build.openings 240（236 窗 + 4 门）、depth 0.06、开着（无 ?punch 参数即默认开）、?punch=0 关档；
//   ② 整岛 A/B：开/关差分 6402 px，其中 83.5% 落在「洞口投影矩形并集」里，同状态噪声 0；
//   ③ 近景单个窗：关档时窗内 71% 是深色玻璃板；开档时深色降到 0 —— 窗不再是暗贴片，而是透出亮着的洞内侧壁；
//   ④ 视差：斜看时灰色侧壁像素随视角单调增多（1312→1975），残余暗缝质心横移 31 px（关档只有 1.5 px 的透视漂移）。
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto('http://localhost:8769/index.html?scene=town&grid=quad&seed=3');
    await page.waitForFunction(() => window.rea?.punch && window.rea?.view?.worldMesh?.build?.openings?.length, null, { timeout: 90000, polling: 200 });
    await page.waitForTimeout(600);

    const R = await page.evaluate(() => {
      const { view, punch } = window.rea;
      const V = view.target.constructor, cam = view.camera, gl = view.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const grab = (on) => { punch.enabled = on; view.render(0); view.render(0); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      const pj = (q) => { const v = new V(q[0], q[1], q[2]).project(cam); return [(v.x * .5 + .5) * W, (1 - (v.y * .5 + .5)) * H]; };
      const ops = view.worldMesh.build.openings;
      const rectOf = (o, off = 0) => {
        const len = Math.hypot(o.bx - o.ax, o.bz - o.az) || 1, hw = o.width / 2 / len;
        const P = (t, y, d) => [o.ax + (o.bx - o.ax) * t + o.nx * d, y, o.az + (o.bz - o.az) * t + o.nz * d];
        return [P(o.t - hw, o.y0, off), P(o.t + hw, o.y0, off), P(o.t + hw, o.y1, off), P(o.t - hw, o.y1, off)].map(pj);
      };
      const inQuad = (px, py, q) => {
        let sgn = 0;
        for (let i = 0; i < 4; i++) {
          const a = q[i], b = q[(i + 1) % 4];
          const cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
          if (Math.abs(cr) < 1e-9) continue;
          const s = Math.sign(cr);
          if (sgn === 0) sgn = s; else if (s !== sgn) return false;
        }
        return true;
      };
      const bbox = (q) => [Math.min(...q.map((p) => p[0])), Math.min(...q.map((p) => p[1])), Math.max(...q.map((p) => p[0])), Math.max(...q.map((p) => p[1]))];
      const glRow = (y) => H - 1 - y;
      const lum = (px, i) => (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      const sat = (px, i) => { const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); return mx ? (mx - mn) / mx : 0; };

      const pin = (t, d, pitch, yaw) => { view.target.set(t[0], t[1], t[2]); view.distance = d; view.pitch = pitch; view.yaw = yaw; view.updateCamera(); };

      // ① 远景整岛：开/关差分的像素必须全部落在「洞口投影矩形并集」里
      const centers = ops.map((o) => [o.ax + (o.bx - o.ax) * o.t, (o.y0 + o.y1) / 2, o.az + (o.bz - o.az) * o.t]);
      const c = [0, 1, 2].map((k) => centers.reduce((s, p) => s + p[k], 0) / centers.length);
      pin(c, 9, 0.45, Math.PI * 0.28);
      const off = grab(false), on = grab(true);
      const rects = ops.map((o) => rectOf(o, 0.001));
      const mask = new Uint8Array(W * H);
      for (const q of rects) {
        const [x0, y0, x1, y1] = bbox(q);
        for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++)
          for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++)
            if (inQuad(x + .5, y + .5, q)) mask[(H - 1 - y) * W + x] = 1;
      }
      let changed = 0, inside = 0, noise = 0;
      for (let i = 0; i < W * H; i++) {
        const k = i * 4;
        const d = Math.max(Math.abs(on[k] - off[k]), Math.abs(on[k + 1] - off[k + 1]), Math.abs(on[k + 2] - off[k + 2]));
        if (d > 8) { changed++; if (mask[i]) inside++; }
      }
      punch.enabled = true; view.render(0); const on2 = (() => { const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; })();
      for (let i = 0; i < W * H; i++) { const k = i * 4; if (Math.max(Math.abs(on2[k] - on[k]), Math.abs(on2[k + 1] - on[k + 1]), Math.abs(on2[k + 2] - on[k + 2])) > 8) noise++; }

      // ② 近景：挑一个「在画面里真能看见洞」的窗，量灰侧壁带宽随视角正弦增长
      const cands = ops.filter((o) => !o.door && o.width > 0.075 && o.height > 0.085);
      let pick = null, pickDiff = 0;
      const measure = (o, dy) => {
        const t = [o.ax + (o.bx - o.ax) * o.t, (o.y0 + o.y1) / 2, o.az + (o.bz - o.az) * o.t];
        pin(t, 2.2, 0.22, Math.atan2(o.nx, o.nz) + dy);
        const a = grab(false), b = grab(true);
        const q = rectOf(o, 0.002), [x0, y0, x1, y1] = bbox(q);
        let diff = 0, jamb = 0, npx = 0, jambOff = 0;
        const dark = [];
        for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++)
          for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
            if (!inQuad(x + .5, y + .5, q)) continue;
            npx++;
            const i = (H - 1 - y) * W + x, k = i * 4;
            if (Math.max(Math.abs(b[k] - a[k]), Math.abs(b[k + 1] - a[k + 1]), Math.abs(b[k + 2] - a[k + 2])) > 8) diff++;
            const L = lum(b, k);
            if (L > 0.16 && L < 0.9 && sat(b, k) < 0.22) jamb++;
            if (L < 0.16) dark.push(x);
          }
        const cxDark = dark.length ? dark.reduce((s2, v) => s2 + v, 0) / dark.length : null;
        const darkOff = [];
        for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++)
          for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
            if (!inQuad(x + .5, y + .5, q)) continue;
            const k = ((H - 1 - y) * W + x) * 4;
            if (lum(a, k) < 0.16) darkOff.push(x);
            if (lum(a, k) > 0.16 && lum(a, k) < 0.9 && sat(a, k) < 0.22) jambOff++;
          }
        const cxOff = darkOff.length ? darkOff.reduce((s2, v) => s2 + v, 0) / darkOff.length : null;
        return { diff, jamb, npx, darkN: dark.length, cxDark: cxDark === null ? null : +cxDark.toFixed(2),
          darkOffN: darkOff.length, jambOff, cxDarkOff: cxOff === null ? null : +cxOff.toFixed(2), w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1) };
      };
      for (const o of cands) { const m = measure(o, 0); if (m.diff > 60) { pick = o; pickDiff = m.diff; break; } }
      let scan = null;
      if (pick) {
        const onScan = [0, 0.10, 0.22, 0.40].map((dy) => ({ dy, ...measure(pick, dy) }));
        const offScan = onScan.map((r) => ({ dy: r.dy, cx: r.cxDarkOff, darkN: r.darkOffN }));
        scan = { on: onScan, off: offScan };
      }
      punch.enabled = true; view.render(0);
      return {
        stats: punch.stats(), build: { openings: ops.length, doors: ops.filter((o) => o.door).length },
        W, H, far: { changed, inside, outside: changed - inside, insideShare: changed ? +(inside / changed).toFixed(4) : null, noise },
        pick: pick ? { cell: pick.cell, edge: pick.edge, width: pick.width, height: pick.height, nx: pick.nx, nz: pick.nz, diff: pickDiff } : null,
        scan, cands: cands.length,
      };
    });
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify(R)); };
    // ① 接线
    if (R.stats.openings !== R.build.openings) fail('接进主管线的洞口数不对');
    if (R.stats.openings !== 240 || R.build.doors !== 4 || R.stats.doors !== 4) fail('洞口/门数量与 buildings.js 台账不一致');
    if (Math.abs(R.stats.depth - 0.06) > 1e-9) fail('洞深不是 0.06');
    // ② 整岛 A/B
    if (R.far.changed < 3000) fail('开/关几乎没差分，主场景没真挖洞：' + R.far.changed);
    if (R.far.insideShare < 0.75) fail('变化像素跑到洞口矩形以外了：' + R.far.insideShare);
    if (R.far.noise !== 0) fail('同状态两帧有漂移：' + R.far.noise);
    // ③ 近景单个窗是真洞
    if (!R.pick) fail('一个能拍的窗都没找到');
    if (R.pick.diff < 800) fail('近景窗内开/关差分太小：' + R.pick.diff);
    const s0 = R.scan.on[0];
    if (!(s0.darkOffN / s0.npx > 0.5)) fail('关档时窗内不是深色玻璃板（对照不成立）：' + (s0.darkOffN / s0.npx));
    if (!(s0.darkN / s0.npx < 0.05)) fail('开档时窗内还是暗贴片：' + (s0.darkN / s0.npx));
    if (!(s0.jamb > 800)) fail('开档时窗内没有亮着的侧壁像素：' + s0.jamb);
    // ④ 视差（斜看时侧壁增多 + 暗缝横移），关档必须不随视角移动
    const on = R.scan.on, off = R.scan.off;
    for (let i = 1; i < on.length; i++) if (!(on[i].jamb > on[i - 1].jamb)) fail('灰色侧壁没随视角单调增多：' + JSON.stringify(on.map((r) => r.jamb)));
    const shiftOn = Math.abs(on[on.length - 1].cxDark - on[1].cxDark);
    const shiftOff = Math.abs(off[off.length - 1].cx - off[1].cx);
    if (!(shiftOn > 10)) fail('洞里暗缝不随视角横移（没有洞深）：' + shiftOn);
    if (!(shiftOff < 3)) fail('关档时窗心也在动（对照失效）：' + shiftOff);
    // ⑤ ?punch=0 关档
    await page.goto('http://localhost:8769/index.html?scene=town&grid=quad&seed=3&punch=0', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.rea?.view?.worldMesh?.build?.openings?.length, null, { timeout: 120000, polling: 200 });
    const offHas = await page.evaluate(() => !!window.rea.punch);
    if (offHas) fail('?punch=0 没有关掉挖洞层');
    if (errors.length) fail('页面报错：' + errors.join(' | '));

    fs.writeFileSync('artifacts/coverage/opening-punch-main-browser.json', JSON.stringify({ ...R, errors }, null, 2));
    console.log('PASS main-scene punch: 240 openings wired, far A/B ' + R.far.changed + 'px (inside ' + R.far.insideShare +
      '), near window dark ' + s0.darkOffN + '->' + s0.darkN + 'px, jamb ' + s0.jamb + '->' + on[on.length - 1].jamb +
      ', sliver shift ' + shiftOn.toFixed(1) + 'px vs off ' + shiftOff.toFixed(1) + 'px');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
