/**
 * module-catalog-parts-browser.cjs —— 1279107097108635649（256 帧 / 10.23fps / 25.0s
 * "Here's a tour of the puzzle pieces that make up #Townscaper. To date, there are 545 of them."）
 * 在真目录页 module-catalog-r56.html 上的运行验收。
 *
 * 片里平铺的"拼图块"不是只有墙身一种颜色：基座/铺地是绿/棕/青、屋顶是绿/暗红、白细边不上色；
 * 同一种部位签名同色。旧实现只有墙身吃调试色（底座/屋顶仍走调色板）→ 本轮给 base/roof 两族各一套签名色。
 * 这里只认页面真实读数 + 截图 PNG 解回来的像素差，不信 exit code。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.slice(q, q + stride); q += stride;
    const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
function imgDiff(A, B) {
  let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let px = 0; px < A.w * A.h; px++) {
    const i = px * A.bpp, j = px * B.bpp;
    if (Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]) <= 6) continue;
    n++;
    const x = px % A.w, y = Math.floor(px / A.w);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { n, bbox: n ? [x0, y0, x1, y1] : null };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  let ok = 0;
  const check = (name, cond, detail) => {
    if (!cond) throw new Error(`FAIL ${name}: ${detail}`);
    ok++;
    console.log(`  PASS ${name} — ${detail}`);
  };
  p.on('pageerror', (e) => errors.push(e.message));
  const dir = path.resolve(__dirname, '../artifacts/coverage');

  const boot = async (url) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      try { await p.waitForFunction(() => window.r56cat?.pieces > 0, null, { timeout: 90000 }); return; } catch (e) {
        if (attempt === 2) throw e;
        console.log('  retry boot ' + (attempt + 1));
      }
    }
  };
  // 固定镜头时刻 + 等两帧，截图才稳（GPU 后端会读到半更新缓冲）
  const settle = async () => { await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await p.waitForTimeout(250); };
  const shot = async () => decodePng(await p.screenshot({ type: 'png' }));

  const base = 'http://127.0.0.1:8769/module-catalog-r56.html?mode=used&t=20.4&clean=1';

  // ---- 开档 ----
  await boot(base);
  await settle();
  const cat = await p.evaluate(() => window.r56cat);
  const s1 = await shot(); await settle(); const s2 = await shot();
  fs.writeFileSync(path.join(dir, 'module-catalog-parts-r189.png'), await p.screenshot({ type: 'png' }));

  check('页面读到目录', cat.pieces > 20, `${cat.pieces} 块 / ${cat.families} 族 / tris ${cat.tris}`);
  check('部位分色默认开', cat.partsOn === true, `partsOn=${cat.partsOn}`);
  const sp = cat.scenePartColors, pp = cat.piecePartColors;
  check('墙身族覆盖全部模块签名', sp.wall >= cat.sceneModulesStat, `wall ${sp.wall} ≥ modules ${cat.sceneModulesStat}`);
  check('屋顶族拿到多种签名色', sp.roof >= 2, `roof ${sp.roof} 色 / ${sp.quads.roof} 片屋顶（场景级）`);
  check('基座族拿到多种签名色', sp.base >= 2, `base ${sp.base} 色 / ${sp.quads.base} 面基座（场景级）`);
  check('每块拼图都带上了屋顶与基座分色', pp.roof >= 2 && pp.base >= 2, `piece ${pp.wall}/${pp.roof}/${pp.base}`);
  check('签名复原零错位', cat.sigMismatch === 0, `sigMismatch=${cat.sigMismatch}`);
  check('同状态两张截图逐字节相同（噪声 0）', Buffer.compare(s1.data, s2.data) === 0 || imgDiff(s1, s2).n === 0,
    `diff ${imgDiff(s1, s2).n}px`);

  // ---- ?parts=0 关档（只给墙身分色，回到旧口径）----
  await boot(base + '&parts=0');
  await settle();
  const cat0 = await p.evaluate(() => window.r56cat);
  const s3 = await shot();
  fs.writeFileSync(path.join(dir, 'module-catalog-wall-only-r189.png'), await p.screenshot({ type: 'png' }));
  check('关档读数归零', cat0.partsOn === false && cat0.scenePartColors.roof === 0 && cat0.scenePartColors.base === 0,
    `partsOn=${cat0.partsOn} roof=${cat0.scenePartColors.roof} base=${cat0.scenePartColors.base}`);
  check('关档仍保留墙身分色', cat0.scenePartColors.wall >= cat0.sceneModulesStat, `wall ${cat0.scenePartColors.wall}`);
  const d = imgDiff(s1, s3);
  check('开/关差分在画面上（屋顶+基座真的变彩）', d.n > 4000, `${d.n}px bbox ${JSON.stringify(d.bbox)}`);

  check('0 页面错误', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  console.log(`PASS module-catalog-parts-browser ${ok} checks`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
