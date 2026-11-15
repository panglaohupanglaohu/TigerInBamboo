// 886199305522085890：点的「遮挡淡出」必须真的走 GPU（aFade 属性 → 片元 alpha），
// 而不是只在 JS 里算了个数字。做法：先量一批点的渲染峰值亮度，再把其中一部分的
// aFade 压到 0.15 重新渲染，同一批点的亮度必须明显下降。
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
const lum = (im, x, y) => { const i = (y * im.w + x) * im.ch; return .299 * im.data[i] + .587 * im.data[i + 1] + .114 * im.data[i + 2]; };
const peakIn = (im, x, y) => { let c = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) c = Math.max(c, lum(im, x + dx, y + dy)); return c; };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const r = path.resolve(__dirname, '../artifacts/coverage') + path.sep;
  await p.goto((process.env.REA_TEST_URL || 'http://localhost:8769') + '/index.html?scene=badnorth');
  await p.waitForFunction(() => window.rea?.battle?.running && rea.battle.passageStats?.dots > 0, { timeout: 60000 });
  await p.waitForTimeout(1200);
  // 缓动必须真的收敛（不是只在 stats 里记了一个 occluded 数字）
  await p.waitForFunction(() => Math.min(...rea.battle.passageFade) < 0.5, { timeout: 20000 });
  await p.evaluate(() => { rea.battle.paused = true; });

  const base = await p.evaluate(async () => {
    const THREE = await import('three');
    const dots = rea.battle.passageDots; dots.updateMatrixWorld(true);
    const cam = rea.view.camera; cam.updateMatrixWorld(true);
    const pos = dots.geometry.getAttribute('position');
    const fade = dots.geometry.getAttribute('aFade');
    if (!fade) throw Error('aFade attribute missing — shader fade not wired');
    const v = new THREE.Vector3(); const pts = []; let minF = 1, maxF = 0, hidden = 0;
    for (let i = 0; i < pos.count; i++) {
      const f = fade.getX(i); minF = Math.min(minF, f); maxF = Math.max(maxF, f); if (f < 0.5) hidden++;
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(dots.matrixWorld).project(cam);
      if (v.z > 1) continue;
      const x = Math.round((v.x * .5 + .5) * 1440), y = Math.round((-v.y * .5 + .5) * 1000);
      if (x < 14 || y < 14 || x >= 1426 || y >= 986) continue;
      pts.push([x, y, i]);
    }
    return { pts: pts.slice(0, 60), minF: +minF.toFixed(3), maxF: +maxF.toFixed(3), hidden, occluded: rea.battle.passageStats.occluded, alphaTest: dots.material.alphaTest, stats: rea.battle.passageStats };
  });

  const shotA = r + 'traffic-fade-a.png'; await p.screenshot({ path: shotA });
  // 把前 20 个点的 aFade 压到 0（=完全被挡），模拟山脊遮挡
  const dimmed = await p.evaluate((idx) => {
    const dots = rea.battle.passageDots, f = dots.geometry.getAttribute('aFade');
    rea.battle._fadeTarget = rea.battle._fadeTarget || new Float32Array(f.count).fill(1);
    rea.battle._fadeTarget.fill(1);
    for (const i of idx) { f.setX(i, 0); rea.battle._fadeTarget[i] = 0; }
    f.needsUpdate = true; rea.battle.passageFade = f.array;
    return idx.length;
  }, base.pts.slice(0, 20).map((q) => q[2]));
  await p.waitForTimeout(200);
  const shotB = r + 'traffic-fade-b.png'; await p.screenshot({ path: shotB });

  const imA = decodePng(fs.readFileSync(shotA)), imB = decodePng(fs.readFileSync(shotB));
  const dim = base.pts.slice(0, 20), keep = base.pts.slice(20, 60);
  // 亮底上「变暗多少」不好定阈值（背景本身就 ~200），改判「还是不是一颗白点」：
  // composer 把白压到 ≈226，所以峰值 >212 才算看见点。
  const WHITE = 212;
  const white = (pts, im) => pts.filter(([x, y]) => peakIn(im, x, y) > WHITE).length / pts.length;
  const dimBeforeW = white(dim, imA), dimAfterW = white(dim, imB), keepBeforeW = white(keep, imA), keepAfterW = white(keep, imB);
  const db = dim.reduce((a, [x, y]) => a + peakIn(imA, x, y), 0) / dim.length;
  const da = dim.reduce((a, [x, y]) => a + peakIn(imB, x, y), 0) / dim.length;
  const kb = keep.reduce((a, [x, y]) => a + peakIn(imA, x, y), 0) / keep.length;
  const ka = keep.reduce((a, [x, y]) => a + peakIn(imB, x, y), 0) / keep.length;
  const out = {
    ...base, dimmed, occludedReported: base.occluded,
    fadeRange: [base.minF, base.maxF], dimPeakBefore: +db.toFixed(1), dimPeakAfter: +da.toFixed(1),
    dimensioned: [dim.length, keep.length],
    whiteShareDimmed: [+dimBeforeW.toFixed(3), +dimAfterW.toFixed(3)],
    whiteShareKept: [+keepBeforeW.toFixed(3), +keepAfterW.toFixed(3)],
    keepPeakBefore: +kb.toFixed(1), keepPeakAfter: +ka.toFixed(1), errors,
  };
  fs.writeFileSync(r + 'traffic-fade-check.json', JSON.stringify(out, null, 2));
  await b.close();
  if (errors.length) throw Error(errors.join('\n'));
  if (base.alphaTest !== 0) throw Error('alphaTest must be 0 so occlusion can fade instead of hard-clip: ' + base.alphaTest);
  if (!(base.minF >= 0 && base.maxF <= 1)) throw Error('fade out of range ' + base.minF + '..' + base.maxF);
  if (!(base.hidden >= 5)) throw Error('eased fade never reached the occluded dots: hidden=' + base.hidden);
  if (!(dimBeforeW >= 0.5)) throw Error('baseline dots are not white enough to measure: ' + dimBeforeW.toFixed(2));
  if (!(dimAfterW <= 0.4 * dimBeforeW)) throw Error('aFade did not fade the rendered dots: white share ' + dimBeforeW.toFixed(2) + ' → ' + dimAfterW.toFixed(2));
  if (!(keepAfterW >= 0.7 * keepBeforeW)) throw Error('untouched dots faded too: white share ' + keepBeforeW.toFixed(2) + ' → ' + keepAfterW.toFixed(2));
  console.log('PASS passage occlusion fade', JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
