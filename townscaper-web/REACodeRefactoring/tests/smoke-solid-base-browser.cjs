// 1015142746372366336 第 59 轮：原片烟柱「根部是一整块近不透光的团」。4 倍放大 frame-0250 可见
// 贴建筑那团剪影完全闭合、里面透不出背景；本仓旧口径新生儿只有 0.11（约 1/4 个烟团），
// 沿程又立刻拉稀 → 整条柱读成「一串互不相连的小圆点」（见 smoke-lobes-*.png 掩码）。
// 这里把烟单独渲进离屏 RenderTarget，沿 PCA 主轴分箱，量根部带（前 40% 轴长）的：
//   emptyBins  —— 完全空掉的箱数（小圆点链会有缝，实心团没有）
//   gapBins    —— 箱内垂向被烟包住但中间透空的箱数（空心 / 透底）
//   baseFill   —— 根部带填充率 = 实有像素 / 各箱垂向跨度之和
// solidBase 开/关同机位对照，并要求凸起（瓣数）不因填实而塌掉。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');

const PROBE = `
import * as THREE from 'three';
const REA = window.rea;
window.__solidProbe = (solid) => {
  const view = REA.view, smoke = view.smoke, renderer = view.renderer;
  smoke.setLobes(true);
  smoke.setSolidBase(!!solid);
  smoke.clear();
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  const wind = new THREE.Vector3(1, 0, 0.2);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cam.position.set(2.35, 1.05, 5.15); cam.lookAt(1.05, 1.30, 0); cam.updateMatrixWorld();
  for (let i = 0; i < 120; i++) smoke.update(0.05, wind, cam);
  const W = 360, H = 360;
  const scene = new THREE.Scene(), parent = smoke.group.parent;
  scene.add(smoke.group);
  const rt = new THREE.WebGLRenderTarget(W, H);
  const prevRT = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(prevColor);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevColor, prevAlpha);
  parent.add(smoke.group); rt.dispose();

  let cx = 0, cy = 0, cn = 0; const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3] > 128) { pts.push([x, y]); cx += x; cy += y; cn++; }
  cx /= Math.max(cn, 1); cy /= Math.max(cn, 1);
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(th), ay = Math.sin(th);
  const BINS = 48;
  const ts = [], ss = [];
  for (const [x, y] of pts) { ts.push((x - cx) * ax + (y - cy) * ay); ss.push(-(x - cx) * ay + (y - cy) * ax); }
  let tMin = 1e9, tMax = -1e9;
  for (const t of ts) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
  const span = Math.max(tMax - tMin, 1);
  // 箱 × 垂向整数桶的占据图
  let sMin = 1e9, sMax = -1e9;
  for (const s of ss) { if (s < sMin) sMin = s; if (s > sMax) sMax = s; }
  const PERP = Math.ceil(sMax - sMin) + 3, off = 1 - Math.floor(sMin);
  const grid = new Uint8Array(BINS * PERP);
  const HI = new Float64Array(BINS).fill(-1e9), LO = new Float64Array(BINS).fill(1e9);
  for (let i = 0; i < pts.length; i++) {
    const bi = Math.min(BINS - 1, Math.max(0, Math.floor((ts[i] - tMin) / span * BINS)));
    if (ss[i] > HI[bi]) HI[bi] = ss[i];
    if (ss[i] < LO[bi]) LO[bi] = ss[i];
    grid[bi * PERP + Math.round(ss[i]) + off] = 1;
  }
  // 根部带 = 轴上前 40%（原点即发射点，ts 最小端）
  const baseBins = Math.max(4, Math.round(BINS * 0.4));
  let emptyBins = 0, gapBins = 0, filled = 0, envelope = 0;
  for (let b = 0; b < baseBins; b++) {
    let lo = -1, hi = -1, c = 0;
    for (let p = 0; p < PERP; p++) if (grid[b * PERP + p]) { if (lo < 0) lo = p; hi = p; c++; }
    if (lo < 0) { emptyBins++; continue; }
    envelope += hi - lo + 1; filled += c;
    if (hi - lo + 1 - c >= 2) gapBins++;
  }
  const countPeaks = (arr, sign) => {
    let n = 0;
    for (let i = 2; i < BINS - 2; i++) {
      const v = sign * arr[i], p1 = sign * arr[i - 1], p2 = sign * arr[i - 2], n1 = sign * arr[i + 1], n2 = sign * arr[i + 2];
      const hi = Math.max(p1, p2, v, n1, n2), lo = Math.min(p1, p2, v, n1, n2);
      if (v >= hi && v - lo >= 4 && v > p1 && v >= n1) n++;
    }
    return n;
  };
  const bulges = countPeaks(HI, 1) + countPeaks(LO, -1);
  let drawn = 0; for (let i = 3; i < buf.length; i += 4) if (buf[i] > 128) drawn++;

  const doc = document, cv = doc.getElementById('__mask') || doc.createElement('canvas');
  cv.id = '__mask'; cv.width = W; cv.height = H;
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:360px;height:360px;background:#fff';
  if (!cv.parentNode) doc.body.appendChild(cv);
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const si = ((y * W) + x) * 4, di = (((H - 1 - y) * W) + x) * 4, a = buf[si + 3];
    img.data[di] = img.data[di + 1] = img.data[di + 2] = a; img.data[di + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { solid: !!solid, particles: smoke.p.length, drawn, bulges, emptyBins, gapBins, baseBins,
    baseFill: envelope ? +(filled / envelope).toFixed(3) : 0, core: smoke.core, axisDeg: Math.round(th * 180 / Math.PI) };
};
window.__probeReady = true;
`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  const out = path.resolve(__dirname, '../artifacts/coverage') + path.sep;
  await p.goto((process.env.REA_TEST_URL || 'http://localhost:8769') + '/smoke.html');
  await p.waitForFunction(() => window.smokeReview?.ready && document.querySelector('#scene').contentWindow.rea?.view?.smoke?.p.length > 10, {}, { timeout: 90000 });
  await p.evaluate((code) => {
    const f = document.querySelector('#scene'), doc = f.contentDocument;
    const s = doc.createElement('script'); s.type = 'module'; s.textContent = code;
    doc.head.appendChild(s);
  }, PROBE);
  await p.waitForFunction(() => document.querySelector('#scene').contentWindow.__probeReady, {}, { timeout: 30000 });

  const report = {};
  for (const solid of [true, false]) {
    const r = await p.evaluate((flag) => document.querySelector('#scene').contentWindow.__solidProbe(flag), solid);
    const box = await p.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await p.screenshot({ path: out + 'smoke-solid-base-' + (solid ? 'on' : 'off') + '.png', clip: { x: box.x, y: box.y, width: 360, height: 360 } });
    report[solid ? 'on' : 'off'] = r;
    console.log((solid ? 'solidBase=on ' : 'solidBase=off') + ' ' + JSON.stringify(r));
  }
  // 开关必须真的换到 shader uniform 与尺寸分支
  const toggle = await p.evaluate(() => {
    const s = document.querySelector('#scene').contentWindow.rea.view.smoke;
    s.setSolidBase(false); const a = { core: s.core, u: s.back.material.uniforms.uCore.value, flag: s.solidBase };
    s.setSolidBase(true); const b2 = { core: s.core, u: s.back.material.uniforms.uCore.value, flag: s.solidBase };
    return { off: a, on: b2 };
  });
  report.toggle = toggle;
  fs.writeFileSync(out + 'smoke-solid-base.json', JSON.stringify({ report, errors }, null, 2));
  await b.close();

  const { on, off } = report;
  if (errors.length) throw Error(errors.join('\n'));
  if (!on.drawn || !off.drawn) throw Error('smoke rendered nothing');
  if (off.core !== 0.55 || on.core !== 0.76) throw Error('core uniform not wired: ' + JSON.stringify(toggle));
  if (toggle.off.u === toggle.on.u) throw Error('uCore did not change');
  // 判据先量后定：旧口径根部有明显的空箱与箱内透空；实心根部应把两者都压下去
  if (on.emptyBins > off.emptyBins) throw Error('solid base added empty bins: ' + JSON.stringify({ on: on.emptyBins, off: off.emptyBins }));
  if (on.emptyBins > 0) throw Error('solid base still has empty bins in base band: ' + on.emptyBins);
  if (on.baseFill < off.baseFill + 0.05) throw Error('solid base did not fill the base: ' + JSON.stringify({ on: on.baseFill, off: off.baseFill }));
  // 填实不许把瓣抹平：原片 6–10 个
  if (on.bulges < 6) throw Error('bulges collapsed: ' + on.bulges);
  console.log('PASS smoke solid base ' + JSON.stringify({ onEmpty: on.emptyBins, offEmpty: off.emptyBins, onGap: on.gapBins, offGap: off.gapBins, onFill: on.baseFill, offFill: off.baseFill, bulges: on.bulges }));
})().catch(e => { console.error(e); process.exit(1); });
