// 886199305522085890 "Dotted lines to mark narrow passages" — 第 160 轮的收口验收：
// ① 点线不再只挂北境战斗（passages.html 是通用调试层入口，任意 World 都能开）；
// ② 点径改世界尺寸后，**近景/远景的点距:点径都应 ≈2**（旧口径 7px 屏幕点近景会显疏）。
// 本测试只读页面探针 + 真实像素，不看实现细节。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(buf) {
  let p = 8, w = 0, h = 0, ch = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ch = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0; if (!ch) throw Error('unsupported color type ' + data[9]); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ch, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), cur = out.subarray(y * stride, y * stride + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
const lum = (im, x, y) => { const i = (y * im.w + x) * im.ch; return 0.299 * im.data[i] + 0.587 * im.data[i + 1] + 0.114 * im.data[i + 2]; };
const diffPx = (a, b) => {
  let n = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    if (Math.abs(lum(a, x, y) - lum(b, x, y)) > 8) n++;
  }
  return n;
};
const BASE = process.env.REA_TEST_URL || 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // 本机 serve.py 对 favicon 回 404，且 console 文本里不带 URL（已逐个 curl 过模块 200）→ 只滤这一条。
    if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) errors.push(m.text());
  });
  const outDir = path.resolve(__dirname, '../artifacts/coverage') + path.sep;

  await page.goto(BASE + '/passages.html');
  await page.waitForFunction(() => window.passageReview?.last?.dots > 0, { timeout: 60000 });
  await page.waitForTimeout(600);

  const base = await page.evaluate(() => {
    const r = window.passageReview, ol = r.overlay, st = ol.stats();
    const pos = ol.points.geometry.getAttribute('position');
    // 每个点都应贴在该格顶面上（nav.hgt * 0.5 + 0.035），容差 1e-3
    let offGround = 0;
    const cells = r.world.cells;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      let c = null, best = 1e9;
      for (const cc of cells) { const d = (cc.cx - x) ** 2 + (cc.cz - z) ** 2; if (d < best) { best = d; c = cc; } }
      const want = r.nav.hgt[c.id] * 0.5 + 0.035;
      if (Math.abs(y - want) > 1e-3) offGround++;
    }
    // 点只在窄格 / 楼梯段上：每段至少一端是 narrow
    const narrow = r.nav && ol.markers.narrow;
    let segNotNarrow = 0;
    for (const s of ol.markers.segments) if (!narrow[s.a] && !narrow[s.b]) segNotNarrow++;
    return {
      ...st, offGround, segNotNarrow, walkable: r.nav.walk.reduce((a, b) => a + b, 0),
      cells: r.world.cells.length, measure: r.measure(),
    };
  });

  const near = await page.evaluate(() => { window.passageReview.setCamera({ angle: 0.9, pitch: 0.55, dist: 8 }); return window.passageReview.measure(); });
  await page.waitForTimeout(200);
  const nearShot = outDir + 'passages-near-r160.png'; await page.screenshot({ path: nearShot });
  const far = await page.evaluate(() => { window.passageReview.setCamera({ angle: 0.7, pitch: 1.02, dist: 16 }); return window.passageReview.measure(); });
  await page.waitForTimeout(200);
  const onShot = outDir + 'passages-on-r160.png'; await page.screenshot({ path: onShot });

  // 遮挡：低机位贴着台地（崖脊挡视线）vs 抬到高处（全可见）—— 逐点淡出必须真的在跑
  const occlLow = await page.evaluate(() => {
    const r = window.passageReview;
    r.setCamera({ angle: 0.7, pitch: 0.22, dist: 5.2 });
    for (let i = 0; i < 60; i++) r.overlay.update(r.camera, 0.05);
    return r.measure();
  });
  const occlHigh = await page.evaluate(() => {
    const r = window.passageReview;
    r.setCamera({ angle: 0.5, pitch: 1.32, dist: 18 });
    for (let i = 0; i < 40; i++) r.overlay.update(r.camera, 0.05);
    return r.measure();
  });

  const offShot = outDir + 'passages-off-r160.png';
  await page.evaluate(() => { document.querySelector('#dots').checked = false; document.querySelector('#dots').dispatchEvent(new Event('change')); });
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => window.passageReview.stats());
  await page.screenshot({ path: offShot });
  await page.evaluate(() => { document.querySelector('#dots').checked = true; document.querySelector('#dots').dispatchEvent(new Event('change')); });
  await page.waitForTimeout(300);

  // 屏幕点口径（旧）：近/远点径恒定，ratio 随距离变化 —— 反证「世界尺寸」不是靠调大点径糊过去
  const screenPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  screenPage.on('pageerror', (e) => errors.push(e.message));
  await screenPage.goto(BASE + '/passages.html?size=screen');
  await screenPage.waitForFunction(() => window.passageReview?.last?.dots > 0, { timeout: 60000 });
  const screenNear = await screenPage.evaluate(() => { window.passageReview.setCamera({ angle: 0.9, pitch: 0.55, dist: 8 }); return { m: window.passageReview.measure(), att: window.passageReview.overlay.material.sizeAttenuation }; });
  const screenFar = await screenPage.evaluate(() => { window.passageReview.setCamera({ angle: 0.7, pitch: 1.02, dist: 16 }); return window.passageReview.measure(); });

  // ?dots=0 不开层
  const zeroPage = await browser.newPage();
  await zeroPage.goto(BASE + '/passages.html?dots=0');
  await zeroPage.waitForFunction(() => window.passageReview?.last !== null, { timeout: 60000 });
  const zero = await zeroPage.evaluate(() => window.passageReview.stats());

  // 四方格同一套口径
  const quadPage = await browser.newPage();
  await quadPage.goto(BASE + '/passages.html?world=quad');
  await quadPage.waitForFunction(() => window.passageReview?.last?.dots > 0, { timeout: 60000 });
  const quad = await quadPage.evaluate(() => ({ st: window.passageReview.stats(), m: window.passageReview.measure() }));

  const imOn = decodePng(fs.readFileSync(onShot)), imOff = decodePng(fs.readFileSync(offShot)), imNear = decodePng(fs.readFileSync(nearShot));
  const ab = diffPx(imOn, imOff);
  // 点线像素：开层画面比关层多出来的白点（>200 亮度）
  let dotsPx = 0;
  for (let y = 0; y < imOn.h; y++) for (let x = 0; x < imOn.w; x++) {
    if (lum(imOn, x, y) > 200 && Math.abs(lum(imOn, x, y) - lum(imOff, x, y)) > 8) dotsPx++;
  }
  let nearWhite = 0;
  for (let y = 0; y < imNear.h; y++) for (let x = 0; x < imNear.w; x++) if (lum(imNear, x, y) > 200) nearWhite++;

  const res = {
    base, near, far, off: off.visible, screenNear, screenFar, zero: zero.visible, quad, ab, dotsPx, nearWhite, occlLow, occlHigh, errors,
  };
  fs.writeFileSync(outDir + 'passage-overlay-check.json', JSON.stringify(res, null, 2));
  await browser.close();
  if (errors.length) throw Error(errors.join('\n'));
  if (!(base.dots > 0)) throw Error('no dots on the generic page');
  if (!(base.narrow > 0)) throw Error('no narrow cells classified');
  if (base.segNotNarrow > 0) throw Error('segments without a narrow end: ' + base.segNotNarrow);
  if (base.offGround > 0) throw Error('dots not on cell tops: ' + base.offGround);
  if (base.sizeAttenuation !== true) throw Error('default should be world-size dots');
  for (const [tag, m] of [['near', near], ['far', far]]) {
    if (!(m.dotPx >= 4)) throw Error(tag + ' dot px below floor: ' + m.dotPx);
    // 世界尺寸点的口径是「点径 = 点距/2」，但实际点距 = 段长/ceil(段长/spacing) ≤ spacing，
    // 所以投影比落在 1.3–2.0 都算对；关键是**这个比与机位无关**（下面单独断言）。
    // 第 164 轮改口径：`measure()` 的点径公式去掉了 1/tan(fov/2)（three 的 sizeAttenuation 没有这一项，
    // r160 的 2.09/2.49 是**读数**虚高 2.14×，本轮按真公式重算后同一设置读数更大）。
    // 设计比值 = spacing/dotWorld = 0.28/0.13 = 2.15；实测按「段弦长/段内点数」算点距，
    // 短段只放 1–2 颗点时会偏粗 → 放 1.8–4.2；跨机位的**不变性**另由其后的 nearCommon/farCommon 断言把住。
    if (!(m.ratio >= 1.8 && m.ratio <= 4.2)) throw Error(tag + ' dot pitch/diameter out of range — ' + m.ratio);
  }
  // 世界尺寸：近景点更大（px），点距/点径不变；屏幕点：点径恒定、比例随距离掉
  if (!(near.dotPx > far.dotPx * 1.5)) throw Error('world-size dots should grow when close: ' + near.dotPx + ' vs ' + far.dotPx);
  // 距离不变性要用**同一批段**比：两个机位各自的中位数会落在不同段上（近景看得见短段）。
  const common = Object.keys(near.ratios).filter((k) => k in far.ratios);
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const nearCommon = med(common.map((k) => near.ratios[k])), farCommon = med(common.map((k) => far.ratios[k]));
  if (common.length < 5) throw Error('too few segments visible at both cameras: ' + common.length);
  // 「比值随距离不变」严格讲不成立（投影还有朝向压缩）；能立的断言是：世界尺寸点近/远比值**同量级**，
  // 而屏幕 7px 点近景会掉到 5 倍以上（dots 不跟着距离长大）。两条一起才排得掉「只是把点调大了」。
  if (!(nearCommon / farCommon <= 1.35)) throw Error('world-size ratio drifted with distance: ' + nearCommon + ' vs ' + farCommon);
  if (screenNear.att !== false) throw Error('screen mode must disable sizeAttenuation');
  if (!(Math.abs(screenNear.m.dotPx - screenFar.dotPx) < 0.01)) throw Error('screen dots must keep px size');
  if (!(screenNear.m.ratio > screenFar.ratio * 1.4)) throw Error('screen mode should read sparse when close: ' + screenNear.m.ratio + ' vs ' + screenFar.ratio);
  if (off.visible !== false) throw Error('dots toggle off failed');
  if (zero.visible !== false) throw Error('?dots=0 must not draw');
  if (!(ab > 300)) throw Error('dots layer leaves no pixels: ' + ab);
  if (!(dotsPx > 100)) throw Error('too few white dot pixels: ' + dotsPx);
  if (!(quad.st.dots > 0 && quad.st.narrow > 0)) throw Error('quad world found no narrow passages');
  // 遮挡淡出：两个机位的被遮点数必须不同，且至少有一个机位真的遮住了点
  if (occlLow.occluded === occlHigh.occluded) throw Error('sight fade never re-evaluates: ' + occlLow.occluded);
  if (!(Math.max(occlLow.occluded, occlHigh.occluded) > 0)) throw Error('no dot occluded at either camera');
  console.log('PASS generic passage-dot layer', JSON.stringify({ dots: base.dots, narrow: base.narrow, segments: base.segments, near: near.dotPx, nearRatio: near.ratio, far: far.dotPx, farRatio: far.ratio, screenNearRatio: screenNear.m.ratio, screenFarRatio: screenFar.ratio, commonRatioDelta: +(Math.abs(nearCommon - farCommon)).toFixed(3), ab, dotsPx, quadDots: quad.st.dots, occlLow: occlLow.occluded, occlHigh: occlHigh.occluded }));
})().catch((e) => { console.error(e); process.exit(1); });
