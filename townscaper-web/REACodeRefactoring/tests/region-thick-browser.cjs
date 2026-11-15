// 1120036868966502401（703 帧，2018-06 网格调试层）：
//   原片 460×460，区域边界红线横截面实测中位 2px（p75 5px 是斜线走的台阶）。
//   本仓区域边界一直是 LineBasicMaterial（恒 1 设备像素），投影到 1440 宽只有 0.3% 视宽 → 细一圈。
//   第 67 轮改成「屏幕定宽四边形」：每段一个 quad，半宽 uWidth px（总宽 2×uWidth），颜色逐顶点来自 aColor。
//   本测试只认两件事：① 几何真的按段生成（quads = 段数、vertices = 4×段数、index = 6×段数）；
//   ② 真的走了 GPU —— 同一机位把 regionWidth 1 → 2，画面里「红系像素」必须涨到约 2 倍（不是只改了个数字）。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(buf) {
  let p = 8, w = 0, h = 0, ch = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8) throw Error('expect 8-bit'); ch = data[9] === 6 ? 4 : (data[9] === 2 ? 3 : 0); if (!ch) throw Error('unsupported color type ' + data[9]); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const bpp = ch, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride); const cur = out.subarray(y * stride, y * stride + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = (x >= bpp && y) ? out[(y - 1) * stride + x - bpp] : 0; let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
// 区域边界调色板都是「红/粉/紫/蓝/橙/青」里偏红的那几档：只数明显偏红、且饱和的像素
const reddish = (im, x, y) => { const i = (y * im.w + x) * im.ch, r = im.data[i], g = im.data[i + 1], b = im.data[i + 2]; return r > 110 && r - g > 45 && r - b > 35; };
const countRed = (im) => { let n = 0; for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (reddish(im, x, y)) n++; return n; };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const out = path.resolve(__dirname, '../artifacts/coverage') + path.sep;
  await p.goto((process.env.REA_TEST_URL || 'http://localhost:8769') + '/index.html?scene=terrain');
  await p.waitForFunction(() => window.rea?.view?.contourOverlay, null, { polling: 200, timeout: 90000 });
  await p.waitForTimeout(600);
  const geo = await p.evaluate(() => {
    const v = rea.view, o = v.contourOverlay;
    v.setDebug('contours', true);
    o.refresh();
    const segs = o.regionStats.reduce((s, r) => s + r.segments, 0);
    const g = o.regionsThick.geometry;
    const pos = g.getAttribute('position'), side = g.getAttribute('aSide'), col = g.getAttribute('aColor');
    return {
      visible: o.regionsThick.visible, layers: o.regionStats.length, segments: segs,
      quads: g.userData.quads, vertices: pos.count, sideCount: side.count, colorCount: col.count,
      indexCount: g.getIndex().count, totalWidth: o.setRegionWidth(1) * 1, halfWidth: o.regionWidth,
      lineStillThere: !!o.regions.visible, lineColors: o.regions.material.vertexColors,
    };
  });
  // 地形本身有橙红色块，绝对量会被污染 → 先拍一张「两层都藏起来」的底片，再按增量比。
  const shots = {};
  const shoot = async (tag) => { await p.waitForTimeout(450); const f = out + 'region-thick-' + tag + '.png'; await p.screenshot({ path: f }); shots[tag] = countRed(decodePng(fs.readFileSync(f))); return shots[tag]; };
  await p.evaluate(() => { const o = rea.view.contourOverlay; o.regions.visible = false; o.regionsThick.visible = false; });
  const base = await shoot('off');
  await p.evaluate(() => { const o = rea.view.contourOverlay; o.regions.visible = true; o.regionsThick.visible = true; o.setRegionWidth(1); });
  const w1 = await shoot('w1');
  await p.evaluate(() => { rea.view.contourOverlay.setRegionWidth(2); });
  const w2 = await shoot('w2');
  const d1 = w1 - base, d2 = w2 - base;
  const ratio = d2 / Math.max(1, d1);
  const report = { geo, shots: { ...shots, base, d1, d2 }, ratio: +ratio.toFixed(2), errors };
  fs.writeFileSync(out + 'region-thick-browser.json', JSON.stringify(report, null, 2));
  await b.close();
  const ok = !errors.length && geo.visible
    && geo.quads === geo.segments && geo.vertices === 4 * geo.quads && geo.colorCount === geo.vertices && geo.indexCount === 6 * geo.quads
    && geo.totalWidth === 2 && geo.lineColors === true
    && d1 > 800 && ratio > 1.6 && ratio < 2.5;
  console.log(JSON.stringify(report, null, 1));
  if (!ok) { console.error('FAIL region thick'); process.exit(1); }
  console.log('PASS 区域边界屏幕定宽 2px：quad=段数、1px→2px 红像素 ×' + ratio.toFixed(2));
})().catch((e) => { console.error(e); process.exit(1); });
