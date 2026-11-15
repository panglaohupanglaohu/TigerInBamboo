// 1015142746372366336 "two passes … crisp outline" — 原片烟柱的上边缘是 10–13 个各自鼓出的
// 圆弧瓣，瓣间有凹陷缺口；本仓所有烟团共用同一条轨迹与同一条 s=0.24+age*0.95 尺寸函数，
// 外边界是一条光滑带（第 43/54 轮实测）。这里把烟单独渲进一个离屏 RenderTarget，
// 按 alpha 取轮廓、逐列取上边界，数「凸起」与「凹陷缺口」的个数，lobes 开/关同机位对照。
const{chromium}=require('playwright'),fs=require('fs'),path=require('path');

const PROBE = `
import * as THREE from 'three';
const REA = window.rea;
window.__lobeProbe = (lobes) => {
  const view = REA.view, smoke = view.smoke, renderer = view.renderer;
  smoke.setLobes(!!lobes);
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
  // 烟柱是细长的斜柱：以质心为中心的径向轮廓只会得到「两端」两个极大值，量不到沿程的瓣。
  // 所以沿主轴（PCA）分箱，逐箱取两侧最外的垂距，数轮廓上的局部凸起 = 各自鼓出的圆弧瓣。
  let cx = 0, cy = 0, cn = 0;
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3] > 128) { pts.push([x, y]); cx += x; cy += y; cn++; }
  cx /= Math.max(cn, 1); cy /= Math.max(cn, 1);
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(th), ay = Math.sin(th);
  const BINS = 48, HI = new Float64Array(BINS).fill(-1e9), LO = new Float64Array(BINS).fill(1e9);
  let tMin = 1e9, tMax = -1e9;
  const ts = pts.map(([x, y]) => (x - cx) * ax + (y - cy) * ay), ss = pts.map(([x, y]) => -(x - cx) * ay + (y - cy) * ax);
  for (const t of ts) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
  const span = Math.max(tMax - tMin, 1);
  for (let i = 0; i < pts.length; i++) {
    const bi = Math.min(BINS - 1, Math.max(0, Math.floor((ts[i] - tMin) / span * BINS)));
    if (ss[i] > HI[bi]) HI[bi] = ss[i];
    if (ss[i] < LO[bi]) LO[bi] = ss[i];
  }
  const countPeaks = (arr, sign) => {
    let n = 0;
    for (let i = 2; i < BINS - 2; i++) {
      const v = sign * arr[i];
      const p1 = sign * arr[i - 1], p2 = sign * arr[i - 2], n1 = sign * arr[i + 1], n2 = sign * arr[i + 2];
      const hi = Math.max(p1, p2, v, n1, n2), lo = Math.min(p1, p2, v, n1, n2);
      if (v >= hi && v - lo >= 4 && v > p1 && v >= n1) n++;
    }
    return n;
  };
  const bulges = countPeaks(HI, 1) + countPeaks(LO, -1);
  let notches = 0;
  for (let i = 2; i < BINS - 2; i++) {
    const v = HI[i], p1 = HI[i - 1], n1 = HI[i + 1];
    const hi = Math.max(p1, HI[i - 2], v, n1, HI[i + 2]), lo = Math.min(p1, HI[i - 2], v, n1, HI[i + 2]);
    if (v <= lo && hi - v >= 4 && v < p1 && v <= n1) notches++;
  }
  const drawn = (() => { let n = 0; for (let i = 3; i < buf.length; i += 4) if (buf[i] > 128) n++; return n; })();
  // 把掩码画到页面上的 canvas，供截图肉眼核
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
  return { lobes: !!lobes, particles: smoke.p.length, drawn, bulges, notches, centroid: [Math.round(cx), Math.round(cy)], bins: BINS, axisDeg: Math.round(th * 180 / Math.PI) };
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
  for (const lobes of [true, false]) {
    const r = await p.evaluate((flag) => document.querySelector('#scene').contentWindow.__lobeProbe(flag), lobes);
    await p.locator('#scene').evaluate((f) => f.contentDocument.getElementById('__mask').scrollIntoView());
    const box = await p.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await p.screenshot({ path: out + 'smoke-lobes-' + (lobes ? 'on' : 'off') + '.png', clip: { x: box.x, y: box.y, width: 360, height: 360 } });
    report[lobes ? 'on' : 'off'] = r;
    console.log((lobes ? 'lobes=on ' : 'lobes=off') + ' ' + JSON.stringify(r));
  }
  // 页面开关与 API 互斥性
  const toggle = await p.evaluate((on) => { const w = window.smokeSetLobes(on), s = document.querySelector('#scene').contentWindow.rea.view.smoke; return { w, flag: s.lobes, uniform: s.back.material.uniforms.uLobe.value, box: document.querySelector('#lobes').checked }; }, false);
  report.toggle = toggle;
  fs.writeFileSync(out + 'smoke-lobes.json', JSON.stringify({ report, errors }, null, 2));
  await b.close();
  const { on, off } = report;
  if (errors.length) throw Error(errors.join('\n'));
  if (!on.drawn || !off.drawn) throw Error('smoke rendered nothing');
  if (toggle.uniform !== 0 || toggle.flag !== false || toggle.box !== false || !toggle.w) throw Error('lobe toggle not wired: ' + JSON.stringify(toggle));
  // 阈值先量后定：本仓原「光滑带」几乎无凸起，原片 10–13 个
  if (on.bulges < off.bulges + 4) throw Error('lobes did not add bulges: ' + JSON.stringify({ on, off }));
  if (on.bulges < 6) throw Error('too few bulges on contour: ' + on.bulges);
  console.log('PASS smoke contour lobes on/off', JSON.stringify({ onBulges: on.bulges, offBulges: off.bulges, onNotches: on.notches, offNotches: off.notches }));
})().catch(e => { console.error(e); process.exit(1); });
