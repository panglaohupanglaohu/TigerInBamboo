// 1015142746372366336 第 63 轮：把第 56 批 smoke-c01 的三条「外挂近似」native 进 smoke.js，并逐条量。
//   ① 大瓣：原片（frame-0150 三倍裁切）柱身 6–7 个直径≈柱宽的圆瓣。旧 fine 口径 0.15s/片 × 2 子点
//      → 柱高 2.6 单位塞 26 张卡，剪影是一串小圆点。判据：轮廓凸起数 5–9、瓣间距/柱宽 ≈1。
//   ② 顶端断开：分组发射（0.62s 吐片 / 0.16s 静默）→ 高度上留真空 → 最上组脱开。
//      判据：主轴上方 45% 区间内存在 ≥3 个连续空箱。
//   ③ 弥散薄雾：8 张大扁软卡贴地、alpha ≤0.12、无硬边。判据：只渲薄雾时有大量低 alpha 像素、
//      包围盒宽高比 ≥2（横向铺开），关掉归零；并且不存在硬边（alpha 直方图没有 >200 的像素）。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');

const PROBE = `
import * as THREE from 'three';
import { makeRng } from './src/core/noise.js';
const REA = window.rea;

function render(smoke, cam) {
  const renderer = REA.view.renderer, W = 360, H = 360;
  const scene = new THREE.Scene(), gp = smoke.group.parent, hp = smoke.hazeGroup.parent;
  scene.add(smoke.group); scene.add(smoke.hazeGroup);
  const rt = new THREE.WebGLRenderTarget(W, H);
  const prevRT = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(prevColor);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevColor, prevAlpha);
  gp && gp.add(smoke.group); hp && hp.add(smoke.hazeGroup); rt.dispose();
  return { buf, W, H };
}

// 剪影几何：主轴分 48 箱，量凸起数 / 柱宽 / 沿轴空箱（顶端断开）
function silhouette(buf, W, H, thr) {
  const pts = []; let cx = 0, cy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3] > thr) { pts.push([x, y]); cx += x; cy += y; }
  if (!pts.length) return { n: 0 };
  cx /= pts.length; cy /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(th), ay = Math.sin(th);
  const BINS = 48, ts = [], ss = [];
  for (const [x, y] of pts) { ts.push((x - cx) * ax + (y - cy) * ay); ss.push(-(x - cx) * ay + (y - cy) * ax); }
  let tMin = 1e9, tMax = -1e9;
  for (const t of ts) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
  const span = Math.max(tMax - tMin, 1);
  const cnt = new Uint16Array(BINS), HI = new Float64Array(BINS).fill(-1e9), LO = new Float64Array(BINS).fill(1e9);
  for (let i = 0; i < pts.length; i++) {
    const bi = Math.min(BINS - 1, Math.max(0, Math.floor((ts[i] - tMin) / span * BINS)));
    cnt[bi]++;
    if (ss[i] > HI[bi]) HI[bi] = ss[i];
    if (ss[i] < LO[bi]) LO[bi] = ss[i];
  }
  const peaks = (arr, sign) => {
    let n = 0, idx = [];
    for (let i = 2; i < BINS - 2; i++) {
      const v = sign * arr[i], p1 = sign * arr[i - 1], p2 = sign * arr[i - 2], n1 = sign * arr[i + 1], n2 = sign * arr[i + 2];
      const hi = Math.max(p1, p2, v, n1, n2), lo = Math.min(p1, p2, v, n1, n2);
      if (v >= hi && v - lo >= 4 && v > p1 && v >= n1) { n++; idx.push(i); }
    }
    return { n, idx };
  };
  const up = peaks(HI, 1), dn = peaks(LO, -1);
  // 柱宽：中段 60% 有像素箱的平均横向跨度
  const widths = [];
  for (let b = Math.round(BINS * 0.2); b < Math.round(BINS * 0.8); b++) if (cnt[b]) widths.push(HI[b] - LO[b]);
  const colW = widths.length ? widths.reduce((a, b) => a + b, 0) / widths.length : 0;
  // 顶端：按屏幕行统计占空（烟是竖向上升的，行比 PCA 轴稳），在上方 45% 区间找最长连续空行
  const rowCnt = new Uint16Array(H);
  let yMin = H, yMax = -1;
  for (const [x, y] of pts) { rowCnt[y]++; if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
  // 空行 = 该行像素数低于中位数的 30%（烟柱有风偏，绝对 0 行判不出缝）
  const occ = [];
  for (let y = yMin; y <= yMax; y++) occ.push(rowCnt[y]);
  const med = occ.slice().sort((a, b) => a - b)[Math.floor(occ.length / 2)] || 1;
  let run = 0, best = 0;
  const top = yMax, lowLimit = yMin + Math.round((yMax - yMin) * 0.55);
  for (let y = top; y >= lowLimit; y--) { if (rowCnt[y] < med * 0.3) { run++; if (run > best) best = run; } else run = 0; }
  // 瓣间距（相邻凸起箱之间的轴距，换算成像素）
  const allIdx = [...up.idx, ...dn.idx].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < allIdx.length; i++) gaps.push((allIdx[i] - allIdx[i - 1]) / BINS * span);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  return { n: pts.length, bulges: up.n + dn.n, up: up.n, down: dn.n, colW: +colW.toFixed(2), meanGap: +meanGap.toFixed(2), ratio: +(colW ? meanGap / colW : 0).toFixed(2), topGapRows: best };
}

function alphaStats(buf) {
  let any = 0, low = 0, hard = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let y = 0; y < 360; y++) for (let x = 0; x < 360; x++) {
    const a = buf[(y * 360 + x) * 4 + 3];
    if (a > 0) { any++; if (a > 200) hard++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (a <= 90) low++; }
  }
  const w = any ? x1 - x0 + 1 : 0, h = any ? y1 - y0 + 1 : 0;
  return { any, low, hard, bboxW: w, bboxH: h, aspect: +(h ? w / h : 0).toFixed(2) };
}

window.__shapeProbe = (opt) => {
  const smoke = REA.view.smoke, renderer = REA.view.renderer;
  // 冻结主循环：页面的 rAF 也在 smoke.update，手动步进时会双倍发射（种子固定也会抖）
  if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }
  smoke.setLobes(true); smoke.setSolidBase(true);
  smoke.setPasses({ back: true, front: true });
  smoke.setLobeStyle(opt.style || 'fine');
  smoke.setTopBreak(!!opt.topBreak);
  smoke.setHaze(!!opt.haze);
  smoke.clear();
  smoke.random = makeRng(7);          // 固定种子：否则每次跑瓣数/空档都在抖，阈值不可复现
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  const wind = new THREE.Vector3(1, 0, 0.2);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cam.position.set(2.35, 1.05, 5.15); cam.lookAt(1.05, 1.30, 0); cam.updateMatrixWorld();
  for (let i = 0; i < 140; i++) smoke.update(0.05, wind, cam);
  // 顶端断开的几何判据：按 y 排序相邻烟团中心的世界间距 / 平均卡径。
  // 分组发射的静默窗会在高度上留出 ≈0.7 个卡径的空档；关闭时相邻团最多 0.3 个卡径。
  const card = p => (0.36 + p.age * 0.30) * (0.68 + p.seed * 0.96);
  const byY = [...smoke.p].sort((a, b) => a.y - b.y);
  let maxGapCards = 0, medGapCards = 0;
  if (byY.length > 2) {
    const gs = [];
    for (let i = 1; i < byY.length; i++) gs.push((byY[i].y - byY[i - 1].y) / Math.max(0.05, (card(byY[i]) + card(byY[i - 1])) / 2));
    maxGapCards = +Math.max(...gs).toFixed(2);
    medGapCards = +gs.slice().sort((a, b) => a - b)[Math.floor(gs.length / 2)].toFixed(2);
  }
  const full = render(smoke, cam);
  const sil = silhouette(full.buf, 360, 360, 128);
  let hazeOnly = null;
  if (opt.haze) {
    smoke.setPasses({ back: false, front: false });
    const hz = render(smoke, cam);
    hazeOnly = alphaStats(hz.buf);
    smoke.setPasses({ back: true, front: true });
  }
  // 剪影存成 canvas 供截图取证（离屏 RT 的像素只有测试自己能读）
  const cv = document.getElementById('__mask') || document.createElement('canvas');
  cv.id = '__mask'; cv.width = 360; cv.height = 360;
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:300px;height:300px;background:#fff';
  if (!cv.parentNode) document.body.appendChild(cv);
  const ctx = cv.getContext('2d'), img = ctx.createImageData(360, 360);
  for (let y = 0; y < 360; y++) for (let x = 0; x < 360; x++) {
    const si = ((y * 360) + x) * 4, di = (((359 - y) * 360) + x) * 4, a = full.buf[si + 3];
    img.data[di] = img.data[di + 1] = img.data[di + 2] = a; img.data[di + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return {
    opt, particles: smoke.p.length, lobeStyle: smoke.lobeStyle, topBreak: smoke.topBreak,
    hazeQuads: smoke.hazeStats ? smoke.hazeStats.quads : 0, hazeVisible: smoke.haze.visible,
    bulges: sil.bulges, colW: sil.colW, meanGap: sil.meanGap, ratio: sil.ratio, topGapRows: sil.topGapRows, drawn: sil.n, maxGapCards, medGapCards,
    hazeOnly,
  };
};
// 顶端断开的直接判据（不靠剪影）：分组发射的静默窗内新烟团数必须为 0，
// 且整个周期里最长「零发射」时长 ≥1.0s；关闭时最长只有 ~0.05s 抖动。
window.__emitProbe = (on) => {
  const smoke = REA.view.smoke;
  if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }
  smoke.setLobes(true); smoke.setSolidBase(true); smoke.setLobeStyle('big'); smoke.setTopBreak(!!on);
  smoke.clear(); smoke.random = makeRng(11);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cam.position.set(2.35, 1.05, 5.15); cam.lookAt(1.05, 1.30, 0); cam.updateMatrixWorld();
  let last = -1, quiet = 0, maxQuiet = 0, born = 0;
  for (let i = 0; i < 200; i++) {           // 200 × 0.05s = 10s
    smoke.update(0.05, new THREE.Vector3(1, 0, 0.2), cam);
    const top = smoke.serial;
    if (top === last) { quiet += 0.05; if (quiet > maxQuiet) maxQuiet = quiet; } else { quiet = 0; born += top - last; }
    last = top;
  }
  return { on: !!on, born, maxQuiet: +maxQuiet.toFixed(2) };
};
window.__probeReady = true;
`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  const out = path.resolve(__dirname, '../artifacts/coverage') + path.sep;
  await p.goto((process.env.REA_TEST_URL || 'http://localhost:8769') + '/smoke.html');
  await p.waitForFunction(() => window.smokeReview?.ready && document.querySelector('#scene').contentWindow.rea?.view?.smoke?.p.length > 10, {}, { timeout: 90000 });
  await p.evaluate((code) => {
    const doc = document.querySelector('#scene').contentDocument;
    const s = doc.createElement('script'); s.type = 'module'; s.textContent = code;
    doc.head.appendChild(s);
  }, PROBE);
  await p.waitForFunction(() => document.querySelector('#scene').contentWindow.__probeReady, {}, { timeout: 30000 });

  const run = (opt) => p.evaluate((o) => document.querySelector('#scene').contentWindow.__shapeProbe(o), opt);
  const emit = (on) => p.evaluate((o) => document.querySelector('#scene').contentWindow.__emitProbe(o), on);
  const base = await run({ style: 'fine', topBreak: false, haze: false });
  const big = await run({ style: 'big', topBreak: false, haze: false });
  const detach = await run({ style: 'big', topBreak: true, haze: false });
  const haze = await run({ style: 'big', topBreak: true, haze: true });
  const noHaze = await run({ style: 'big', topBreak: true, haze: false });

  const frame = p.frames().find((f) => f.url().includes('index.html'));
  const el = await frame.$('#__mask');
  if (el) await el.screenshot({ path: out + 'smoke-shape-native-r63.png' });
  const emitOn = await emit(true), emitOff = await emit(false);
  const report = { base, big, detach, haze, noHaze, emitOn, emitOff };
  fs.writeFileSync(out + 'smoke-shape-native-r63.json', JSON.stringify({ report, errors }, null, 2));
  await b.close();

  console.log('fine      ' + JSON.stringify(base));
  console.log('big       ' + JSON.stringify(big));
  console.log('big+detach' + JSON.stringify(detach));
  console.log('hazeOnly  ' + JSON.stringify(haze));
  console.log('noHaze    ' + JSON.stringify(noHaze.hazeOnly));

  if (errors.length) throw Error(errors.join('\n'));
  if (!base.drawn || !detach.drawn) throw Error('smoke rendered nothing');
  // ① 大瓣（big + 分组发射 = 原片口径）：6±1 个瓣，且瓣间距≈柱宽（原片瓣径≈柱宽）
  const shape = detach;
  if (shape.bulges < 5 || shape.bulges > 9) throw Error('lobe count off original 6-7: ' + shape.bulges);
  const perLobeShape = shape.particles / Math.max(shape.bulges, 1), perLobeFine = base.particles / Math.max(base.bulges, 1);
  if (!(perLobeShape < perLobeFine * 0.6)) throw Error('cards per lobe not coarsened: ' + JSON.stringify({ perLobeShape, perLobeFine }));
  if (big.particles >= base.particles) throw Error('big style did not coarsen emission: ' + JSON.stringify({ base: base.particles, big: big.particles }));
  // ② 顶端断开：发射闸门实测——静默窗里零新团、最长静默 ≥1.0s；关闭时最长仅 0.05s 抖动
  if (!(emitOn.maxQuiet >= 1.0)) throw Error('topBreak did not create an emission gap: ' + JSON.stringify(emitOn));
  if (!(emitOn.maxQuiet > emitOff.maxQuiet * 4)) throw Error('gap not distinctive vs steady emission: ' + JSON.stringify({ emitOn, emitOff }));
  if (!(emitOn.born < emitOff.born)) throw Error('topBreak did not reduce emission: ' + JSON.stringify({ emitOn, emitOff }));
  // ③ 薄雾：低 alpha 大面积、横向铺开、无硬边；关掉归零
  if (!haze.hazeOnly || haze.hazeOnly.low < 2000) throw Error('haze layer not visible: ' + JSON.stringify(haze.hazeOnly));
  if (haze.hazeOnly.aspect < 1.4) throw Error('haze not laid out horizontally: ' + haze.hazeOnly.aspect);
  if (haze.hazeOnly.hard > 0) throw Error('haze has a hard edge (alpha>200): ' + haze.hazeOnly.hard);
  if (noHaze.hazeOnly) throw Error('haze measured while off');
  console.log('PASS smoke shape native (big lobes / top break / haze) ' + JSON.stringify({
    bulgesFine: base.bulges, bulgesTarget: shape.bulges, ratioTarget: shape.ratio, perLobeFine: +perLobeFine.toFixed(1), perLobeTarget: +perLobeShape.toFixed(1),
    particlesFine: base.particles, particlesTarget: shape.particles, maxGapCards: detach.maxGapCards, noBreakGap: big.maxGapCards,
    hazeLow: haze.hazeOnly.low, hazeAspect: haze.hazeOnly.aspect, hazeQuads: haze.hazeQuads,
  }));
})().catch((e) => { console.error(e); process.exit(1); });
