// 第 74 轮 · 1015142746372366336（303f）：关第 73 轮缺口 ①「big/fine 两套指标互相矛盾」。
// 第 72 轮记录「大瓣 4 个 / 瓣径 0.14–0.19 画面宽」，第 43/54 轮注释写「原片轮廓凸起 10–13」，
// 两者被当成互相打架。本轮把**同一帧**用两把尺子各量一次（原片 frame-0150/0160/0180/0250，460×460，
// 掩膜 S<85 & 25<V<165，PCA 主轴 64 箱，上/下缘分开数移动平均后的局部极大）：
//   · 细尺（k=5）：上缘 12 / 下缘 10  ←→ 正是旧注释的「10–13」
//   · 粗尺（k=15，prominence 2.0）：上缘 4 / 下缘 4  ←→ 正是第 72 轮的「大瓣 4」
// → 结论：两个数字都对，量的是同一根柱子的两级结构（4 个大瓣，每个瓣上约 3 个细凸起）。
//   所以「默认切 big 还是 fine」不是二选一：big 管瓣、fine 管瓣内细褶，两者必须同时存在。
// 本测试用**同一把尺子**量本仓离屏渲染（alpha 掩膜，64 箱，同样的 k 与 prominence）：
//   A. 本仓细尺上缘 >= 8（有细褶，不是光滑带）；
//   B. 本仓粗尺上缘在 3–6（大瓣数与原片同量级）；
//   C. 粗尺 < 细尺（两级结构确实不同，不是同一把尺量两次）；
//   D. 两档在物理量上可分（big 档发射间隔 0.24 vs fine 0.15 → 片数更少）。
//      注意：轮廓瓣数在两档上量出来一样（4/10）→ 瓣数分辨不出档位，档位是「片数 / 卡尺寸」档，不是「瓣数开关」；
//   E. 无 pageerror / console error。
const { chromium } = require('playwright');
const fs = require('fs');

const PROBE = `
import * as THREE from 'three';
const REA = window.rea;
const BINS = 64;
const smooth = (a, k) => { const o = new Float64Array(a.length); const h = (k - 1) / 2;
  for (let i = 0; i < a.length; i++) { let s = 0, n = 0; for (let j = -h; j <= h; j++) { const q = i + j; if (q >= 0 && q < a.length) { s += a[q]; n++; } } o[i] = s / n; } return o; };
const bumps = (arr, k, prom) => { const s = smooth(arr, k), w = Math.max(3, Math.round(2 * k)); let n = 0;
  for (let i = w; i < s.length - w; i++) { const v = s[i];
    if (v > s[i - w] && v >= s[i + w] && v - Math.min(s[i - w], s[i + w]) > prom) n++; } return n; };
window.__dsProbe = (lobes) => {
  const view = REA.view, smoke = view.smoke, renderer = view.renderer;
  smoke.setLobeStyle(lobes ? 'big' : 'fine');
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
  const pts = []; let cx = 0, cy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3] > 128) { pts.push([x, y]); cx += x; cy += y; }
  if (!pts.length) return { empty: true };
  cx /= pts.length; cy /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(th), ay = Math.sin(th);
  const ts = pts.map(([x, y]) => (x - cx) * ax + (y - cy) * ay);
  const ss = pts.map(([x, y]) => -(x - cx) * ay + (y - cy) * ax);
  const tMin = Math.min(...ts), span = Math.max(Math.max(...ts) - tMin, 1);
  const HI = new Float64Array(BINS).fill(-1e9), LO = new Float64Array(BINS).fill(1e9), seen = new Uint8Array(BINS);
  for (let i = 0; i < pts.length; i++) {
    const bi = Math.min(BINS - 1, Math.max(0, Math.floor((ts[i] - tMin) / span * BINS)));
    seen[bi] = 1;
    if (ss[i] > HI[bi]) HI[bi] = ss[i];
    if (ss[i] < LO[bi]) LO[bi] = ss[i];
  }
  const fill = (a) => { let last = 0, i = 0; while (i < a.length && !seen[i]) i++; last = i < a.length ? a[i] : 0;
    for (let j = 0; j < a.length; j++) { if (seen[j]) last = a[j]; else a[j] = last; } return a; };
  const hi = fill(HI), lo = fill(LO.map((v) => -v));
  return {
    lobes: !!lobes, particles: smoke.p.length, drawn: pts.length, axisDeg: Math.round(th * 180 / Math.PI),
    fineUp: bumps(hi, 5, 0.8), fineLo: bumps(lo, 5, 0.8),
    bigUp: bumps(hi, 15, 2.0), bigLo: bumps(lo, 15, 2.0),
  };
};
window.__dsReady = true;
`;

(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  const out = { ok: false, checks: {} };
  let ok = true;
  const check = (name, pass, detail) => { out.checks[name] = { pass: !!pass, detail }; if (!pass) ok = false; console.log(`${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`); };
  try {
    await p.goto('http://127.0.0.1:8769/smoke.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.smokeReview?.ready && document.querySelector('#scene').contentWindow.rea?.view?.smoke?.p.length > 10, {}, { timeout: 90000 });
    await p.evaluate((code) => {
      const f = document.querySelector('#scene'), doc = f.contentDocument;
      const s = doc.createElement('script'); s.type = 'module'; s.textContent = code; doc.head.appendChild(s);
    }, PROBE);
    await p.waitForFunction(() => document.querySelector('#scene').contentWindow.__dsReady, {}, { timeout: 30000 });
    const run = (flag) => p.evaluate((f) => document.querySelector('#scene').contentWindow.__dsProbe(f), flag);
    const on = await run(true), off = await run(false);
    out.on = on; out.off = off;
    out.filmTarget = { fineUp: 12, fineLo: 10, bigUp: 4, bigLo: 4, note: '原片 frame-0150/0160/0180/0250 同法测量' };
    check('A 细尺上缘 >= 8（有细褶）', on.fineUp >= 8, `fineUp=${on.fineUp} fineLo=${on.fineLo}`);
    check('B 粗尺上缘 3–6（与原片大瓣同量级）', on.bigUp >= 3 && on.bigUp <= 6, `bigUp=${on.bigUp} bigLo=${on.bigLo}`);
    check('C 粗尺 < 细尺（两级结构）', on.bigUp < on.fineUp, `big=${on.bigUp} < fine=${on.fineUp}`);
    check('D 两档在物理量上可分（big 间隔更长→片更少）', on.particles !== off.particles && on.particles < off.particles, `big=${on.particles} 片 / fine=${off.particles} 片`);
    out.styleNote = '两档的轮廓瓣数测量值相同（4/10）→ 瓣数分辨不出档位；档位差异体现在片数与卡尺寸，两档必须并存而非二选一';
    check('E 无运行时错误', errors.length === 0, errors.length ? errors.join(' | ') : 'clean');
    out.ok = ok;
    fs.writeFileSync('artifacts/coverage/smoke-double-scale-browser.json', JSON.stringify(out, null, 2));
    console.log(out.ok ? 'ALL PASS' : 'SOME FAIL');
    process.exitCode = out.ok ? 0 : 1;
  } catch (e) { console.error('ERR', e.message); process.exitCode = 1; } finally { await b.close(); }
})();
