// 886199305522085890 · 第 164 轮：北境战斗**默认**窄道点线的口径验收。
//
// 片子里的点在近景/远景都保持「点距 : 点径 ≈ 2.2」（一颗颗分开、近看也没变稀）。两种旧做法各错一半：
//   - 固定 7px 屏幕点（旧默认）：远近一样大 → 近景点距/点径 3.3，显疏；
//   - 纯世界尺寸点：近端对，远端缩到 3–4px → 看不见（r160 试翻默认正是掉在这里）。
// 本轮默认 = 世界尺寸 + **物理像素下限**（着色器里逐点 max(gl_PointSize, minPx·dpr)）。
//
// 本测用真实像素回答四问：
//   A 默认是不是世界尺寸档、下限是不是 7 CSS px；
//   B 近景的点真的比远景大（世界尺寸），且全岛机位不小于旧 7px 口径（下限真的生效，不是读数骗人）；
//   C 可读性没掉档（中位对比度 ≥35、可判读占比 ≥0.65，且不差于旧 7px 对照）；
//   D devicePixelRatio=2 时下限翻倍（7 CSS px → 14 物理 px）。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(buf) {
  let p = 8, w = 0, h = 0, ch = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8) throw Error('expect 8-bit'); ch = data[9] === 6 ? 4 : (data[9] === 2 ? 3 : 0); if (!ch) throw Error('unsupported color type ' + data[9]); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ch, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), cur = out.subarray(y * stride, y * stride + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = (x >= bpp && y) ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
const lum = (im, x, y) => { const i = (y * im.w + x) * im.ch; return 0.299 * im.data[i] + 0.587 * im.data[i + 1] + 0.114 * im.data[i + 2]; };
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

/** 冻住时间轴（r119 的做法）：`render(0)` 后水面/云/相机阻尼全停，差分里只剩点。 */
async function freeze(page) {
  await page.evaluate(() => {
    if (window.__frozenRender) return;
    const v = rea.view, o = v.render.bind(v);
    v.render = () => o(0);
    window.__frozenRender = true;
  });
}

/** 差分掩码 → 8 邻域连通块。块面积换等效圆直径 d = 2√(A/π)（点是圆点，面积比外接框稳）。 */
function blobs(on, off) {
  const W = on.w, H = on.h, seen = new Uint8Array(W * H), out = [];
  const hit = (x, y) => Math.abs(lum(on, x, y) - lum(off, x, y)) > 18;
  for (let y0 = 1; y0 < H - 1; y0++) for (let x0 = 1; x0 < W - 1; x0++) {
    const i0 = y0 * W + x0;
    if (seen[i0] || !hit(x0, y0)) continue;
    const st = [i0]; seen[i0] = 1; let area = 0, x1 = 1e9, x2 = -1, y1 = 1e9, y2 = -1;
    while (st.length) {
      const i = st.pop(), x = i % W, y = (i / W) | 0;
      area++; if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
        const j = ny * W + nx; if (seen[j] || !hit(nx, ny)) continue; seen[j] = 1; st.push(j);
      }
    }
    if (area >= 5) out.push({ area, w: x2 - x1 + 1, h: y2 - y1 + 1 });
  }
  return out;
}

/** 一个机位下「点层」在屏幕上画成什么样：块数 / 等效直径中位 / P90 / CV（图内像素 ÷ scale = CSS px）。 */
async function measureLayer(page, { scale = 1 } = {}) {
  await freeze(page);
  await page.evaluate(() => { rea.battle.passageDots.visible = true; });
  await page.waitForTimeout(150);
  const on = decodePng(await page.screenshot());
  await page.evaluate(() => { rea.battle.passageDots.visible = false; });
  await page.waitForTimeout(150);
  const off = decodePng(await page.screenshot());
  await page.evaluate(() => { rea.battle.passageDots.visible = true; });
  const list = blobs(on, off);
  const diam = list.map((b) => 2 * Math.sqrt(b.area / Math.PI) / scale);
  const box = list.map((b) => (b.w + b.h) / 2 / scale);
  const m = med(diam), sd = Math.sqrt(diam.reduce((s, d) => s + (d - m) ** 2, 0) / Math.max(1, diam.length));
  const st = await page.evaluate(() => ({ px: rea.battle.passageDotPx(), style: { ...rea.battle.passageDotStyle } }));
  const srt = diam.slice().sort((a, b) => a - b);
  return { blobs: list.length, diamMed: +m.toFixed(2), diamP90: +(srt[Math.floor(srt.length * 0.9)] || 0).toFixed(2), diamMin: +(srt[0] || 0).toFixed(2), diamMax: +(srt[srt.length - 1] || 0).toFixed(2), boxMed: +med(box).toFixed(2), cv: +(sd / Math.max(0.01, m)).toFixed(3), px: st.px, mode: st.style.mode };
}

/** 可读性：每颗点投影中心处 9×9 峰值 vs 外环中位的亮度差（与 traffic-dots 同口径）。 */
async function readability(page) {
  await freeze(page);
  await page.evaluate(() => { rea.battle.passageDots.visible = true; });
  await page.waitForTimeout(150);
  const im = decodePng(await page.screenshot());
  const pts = await page.evaluate(async () => {
    const THREE = await import('three'), b = rea.battle, dots = b.passageDots; dots.updateMatrixWorld(true);
    const cam = rea.view.camera; cam.updateMatrixWorld(true);
    const arr = dots.geometry.getAttribute('position').array, v = new THREE.Vector3(), out = [];
    for (let i = 0; i < arr.length; i += 3) {
      v.set(arr[i], arr[i + 1], arr[i + 2]).applyMatrix4(dots.matrixWorld).project(cam);
      if (v.z > 1) continue;
      out.push([Math.round((v.x * .5 + .5) * innerWidth), Math.round((-v.y * .5 + .5) * innerHeight)]);
    }
    return out;
  });
  const deltas = [], peaks = [];
  for (const [x, y] of pts) {
    if (x < 14 || y < 14 || x >= im.w - 14 || y >= im.h - 14) continue;
    let c = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) c = Math.max(c, lum(im, x + dx, y + dy));
    const ring = [];
    for (let dy = -13; dy <= -8; dy++) for (let dx = -13; dx <= 13; dx++) ring.push(lum(im, x + dx, y + dy));
    for (let dy = 8; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) ring.push(lum(im, x + dx, y + dy));
    for (const dy of [-7, 0, 7]) for (const dx of [-13, -12, -11, 11, 12, 13]) ring.push(lum(im, x + dx, y + dy));
    ring.sort((a, b) => a - b); peaks.push(c); deltas.push(c - ring[ring.length >> 1]);
  }
  return { measured: deltas.length, medianContrast: +med(deltas).toFixed(1), readableShare: +(deltas.filter((d) => d > 20).length / Math.max(1, deltas.length)).toFixed(3), peakMedian: +med(peaks).toFixed(1) };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const out = {}, errors = [];
  const shotDir = path.resolve(__dirname, '../artifacts/coverage') + path.sep;
  const url = (process.env.REA_TEST_URL || 'http://localhost:8769') + '/index.html?scene=badnorth';

  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(url);
  await p.waitForFunction(() => window.rea?.battle?.running && rea.battle.passageStats?.dots > 0, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { rea.battle.paused = true; });
  const cam0 = await p.evaluate(() => ({ d: rea.view.distance, p: rea.view.pitch, y: rea.view.yaw, t: rea.view.target.toArray() }));

  // 全岛机位（片子 0000–0099 / 0600+）
  const wide = await measureLayer(p);
  const wideRead = await readability(p);
  await p.screenshot({ path: shotDir + 'passage-dots-world-r164.png' });

  // 近景（片子 0300–0399 压到地面看）
  await p.evaluate(() => { const v = rea.view; v.distance = 7.5; v.pitch = 0.95; v.updateCamera(); });
  await p.waitForTimeout(350);
  const near = await measureLayer(p);
  await p.screenshot({ path: shotDir + 'passage-dots-close-r164.png' });

  // 点距 : 点径 的口径已由 traffic-dots-browser（同机位 spacingRatio 2.21）单独断言；
  // 这里只管「点径随距离长大 + 远端托底」，两组读数都落在 1.4–1.5×，与公式 rawNear/rawFar 一致。
  out.pitch = { note: '见 traffic-dots-browser.cjs 的 spacingRatio（2.21 = 片子口径）', rawNear: near.px.nearPx, rawFar: near.px.farPx };

  // 旧口径对照（同一机位、同一帧）：固定 7px 屏幕点
  await p.evaluate((c) => { const v = rea.view; v.distance = c.d; v.pitch = c.p; v.yaw = c.y; v.target.fromArray(c.t); v.updateCamera(); }, cam0);
  await p.waitForTimeout(300);
  await p.evaluate(() => rea.battle.c02.set('passageScreen', true));
  await p.waitForTimeout(250);
  const screenWide = await measureLayer(p);
  const screenRead = await readability(p);
  await p.screenshot({ path: shotDir + 'passage-dots-screen-r164.png' });
  await p.evaluate(() => rea.battle.c02.set('passageScreen', false));
  await p.close();

  // devicePixelRatio = 2（同一套代码，只是下限按物理像素翻倍）
  const p2 = await b.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
  await p2.goto(url);
  await p2.waitForFunction(() => window.rea?.battle?.running && rea.battle.passageStats?.dots > 0, null, { timeout: 90000 });
  await p2.waitForTimeout(1200);
  await p2.evaluate(() => { rea.battle.paused = true; });
  const hi = await measureLayer(p2);   // 不归一到 CSS：要比的是**物理像素**（DPR2 下限 = 14 物理 px）
  await p2.screenshot({ path: shotDir + 'passage-dots-dpr2-r164.png' });
  await p2.close();

  out.wide = { mode: wide.mode, floorCss: wide.px.floorCss, floorPx: wide.px.floorPx, pixelRatio: wide.px.pixelRatio, clampedShare: wide.px.clampedShare, rawNear: wide.px.nearPx, rawFar: wide.px.farPx, dots: wide.px.dots, blobs: wide.blobs, diamMed: wide.diamMed, diamP90: wide.diamP90, diamMax: wide.diamMax, cv: wide.cv, read: wideRead };
  out.near = { mode: near.mode, clampedShare: near.px.clampedShare, rawNear: near.px.nearPx, rawFar: near.px.farPx, blobs: near.blobs, diamMed: near.diamMed, diamP90: near.diamP90, diamMax: near.diamMax, cv: near.cv };
  out.screen = { mode: screenWide.mode, rawNear: screenWide.px.nearPx, blobs: screenWide.blobs, diamMed: screenWide.diamMed, diamP90: screenWide.diamP90, cv: screenWide.cv, read: screenRead };
  out.dpr2 = { pixelRatio: hi.px.pixelRatio, floorCss: hi.px.floorCss, floorPx: hi.px.floorPx, blobs: hi.blobs, diamMed: hi.diamMed, overWide: +(hi.diamMed / Math.max(0.01, wide.diamMed)).toFixed(2) };
  fs.writeFileSync(shotDir + 'passage-dots-world-check.json', JSON.stringify(out, null, 2));
  await b.close();
  if (errors.length) throw Error(errors.join('\n'));

  if (out.wide.mode !== 'world') throw Error('默认不是世界尺寸档：' + out.wide.mode);
  if (out.wide.floorCss !== 7 || out.wide.floorPx !== 7) throw Error('DPR1 下限应为 7 CSS px / 7 物理 px：' + JSON.stringify([out.wide.floorCss, out.wide.floorPx]));
  if (!(out.wide.clampedShare > 0.2)) throw Error('全岛机位应有点被下限托住：' + out.wide.clampedShare);
  if (!(out.near.clampedShare < out.wide.clampedShare)) throw Error('近景被托住的点应更少：' + JSON.stringify([out.near.clampedShare, out.wide.clampedShare]));
  if (!(out.near.diamMed >= out.wide.diamMed * 1.25)) throw Error('近景点径没有变大（世界尺寸没生效）：' + out.near.diamMed + ' vs ' + out.wide.diamMed);
  if (!(Math.abs(out.wide.diamMed / out.screen.diamMed - 1) <= 0.12)) throw Error('全岛机位下限直径应与旧 7px 一致：' + out.wide.diamMed + ' vs ' + out.screen.diamMed);
  if (!(out.screen.cv <= 0.28)) throw Error('旧口径该是恒定直径：CV ' + out.screen.cv);
  if (!(out.wide.read.medianContrast >= 35)) throw Error('对比度不达标：' + out.wide.read.medianContrast);
  if (!(out.wide.read.readableShare >= 0.65)) throw Error('可判读占比不达标：' + out.wide.read.readableShare);
  if (!(out.wide.read.readableShare >= out.screen.read.readableShare - 0.02)) throw Error('比旧 7px 档更差：' + JSON.stringify([out.wide.read.readableShare, out.screen.read.readableShare]));
  if (out.dpr2.pixelRatio !== 2 || out.dpr2.floorPx !== 14) throw Error('DPR2 下限应为 14 物理 px：' + JSON.stringify(out.dpr2));
  if (!(out.dpr2.overWide >= 1.7 && out.dpr2.overWide <= 2.3)) throw Error('DPR2 下限直径没有翻倍：' + out.dpr2.overWide);
  console.log('PASS passage dots world-size + physical-px floor', JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
