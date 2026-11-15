// 第 69 轮 · 1015142746372366336（303f 烟柱）：补第 68 轮遗留缺口 ①「薄雾按片反标定」。
// 原片量法（frame-0100，400×400，天空 luma 158.8）：柱身中段 x=210…330 逐列取剖面，
//   强烟 = luma < 天空−45 的行、淡边 = 天空−45 < luma < 天空−8 的行；
//   强烟厚度均值 36.3 px、淡边 32.9 px → 雾厚/柱厚 = 0.91。（量法写进 src/life/smoke.js 的 HAZE_STYLE 注释）
// 本测在**同一机位**下离屏渲染两遍，用同一套像素口径复算：
//   A. 只渲主烟柱（薄雾关）→ 剪影中段平均横向宽度 colW（= 柱厚，像素）；
//   B. 只渲薄雾（两遍烟关）→ alpha 掩膜的包围盒高 bboxH（= 雾带厚）与宽 bboxW；
//   C. 雾厚/柱厚 = bboxH / colW，必须落在 0.65–1.25（原片 0.91）；
//   D. 薄雾必须「更宽」：bboxW ≥ 1.6 × colW，且整层没有硬边（alpha 峰值 ≤ 200）；
//   E. 关掉薄雾后 alpha 掩膜归零，且 hazeStats 报出标定后的尺寸区间（sx 4.6–8.0 / sy 0.55–0.90）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

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
// 主柱厚度：PCA 轴分 48 箱，取中段 60% 有像素箱的横向跨度均值
function colWidth(buf, W, H, thr) {
  const pts = []; let cx = 0, cy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3] > thr) { pts.push([x, y]); cx += x; cy += y; }
  if (pts.length < 50) return { n: pts.length, colW: 0 };
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
    cnt[bi]++; if (ss[i] > HI[bi]) HI[bi] = ss[i]; if (ss[i] < LO[bi]) LO[bi] = ss[i];
  }
  const ws = [];
  for (let b = Math.round(BINS * 0.2); b < Math.round(BINS * 0.8); b++) if (cnt[b]) ws.push(HI[b] - LO[b]);
  return { n: pts.length, colW: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0 };
}
function alphaBox(buf, W, H) {
  let any = 0, maxA = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = buf[(y * W + x) * 4 + 3];
    if (a > 6) { any++; if (a > maxA) maxA = a; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { any, maxA, bboxW: any ? x1 - x0 + 1 : 0, bboxH: any ? y1 - y0 + 1 : 0 };
}
window.__hazeProbe = () => {
  const smoke = REA.view.smoke;
  if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }
  smoke.setLobeStyle('fine'); smoke.setLobes(true); smoke.setSolidBase(true); smoke.setTopBreak(false);
  smoke.clear(); smoke.random = makeRng(7);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  const wind = new THREE.Vector3(1, 0, 0.2);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cam.position.set(2.35, 1.05, 5.15); cam.lookAt(1.05, 1.30, 0); cam.updateMatrixWorld();
  smoke.setHaze(true);
  for (let i = 0; i < 140; i++) smoke.update(0.05, wind, cam);
  const hazeStats = smoke.hazeStats ? { ...smoke.hazeStats } : null;
  // A：只主柱
  smoke.setPasses({ back: true, front: true });
  smoke.haze.visible = false;
  const band = colWidth(render(smoke, cam).buf, 360, 360, 128);
  // B：只薄雾
  smoke.setPasses({ back: false, front: false });
  smoke.haze.visible = true;
  smoke.hazeGroup.visible = true;
  const hz = alphaBox(render(smoke, cam).buf, 360, 360);
  // E：薄雾关
  smoke.setHaze(false);
  const none = alphaBox(render(smoke, cam).buf, 360, 360);
  smoke.setPasses({ back: true, front: true });
  return { band, haze: hz, none, hazeStats };
};
`;

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  let ok = false;
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    // smoke.html 把真实场景放在 #scene iframe 里（第 63 轮同款搭法），探针必须注入到那个 frame
    await page.goto('http://127.0.0.1:8769/smoke.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene')?.contentWindow?.rea?.view?.smoke?.p?.length > 10, null, { polling: 200, timeout: 90000 });
    const frame = page.frames().find((f) => f !== page.mainFrame() && /index\.html/.test(f.url()));
    if (!frame) throw new Error('找不到 #scene 的 iframe frame');
    await frame.addScriptTag({ type: 'module', content: PROBE });
    await frame.waitForFunction(() => typeof window.__hazeProbe === 'function', null, { timeout: 30000 });
    report.m = await frame.evaluate(() => window.__hazeProbe());
    await page.screenshot({ path: `${OUT}/smoke-haze-calib.png` });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const b = report.m?.band, h = report.m?.haze, n = report.m?.none, hs = report.m?.hazeStats;
  const ratio = (b?.colW > 0 && h?.bboxH != null) ? h.bboxH / b.colW : null;
  report.ratio = ratio != null ? +ratio.toFixed(2) : null;
  const A = b?.colW > 0;
  const B = h?.bboxW > 0 && h?.bboxH > 0;
  const C = ratio != null && ratio >= 0.65 && ratio <= 1.25;          // 原片 0.91
  const D = b?.colW > 0 && h?.bboxW >= 1.6 * b.colW && h?.maxA <= 200;
  const E = n?.any === 0 && hs?.sxMin === 4.6 && hs?.sxMax === 8 && hs?.syMin === 0.55 && hs?.syMax === 0.9;
  ok = problems.length === 0 && A && B && C && D && E;
  console.log(JSON.stringify({ ok, A_band: A, B_haze: B, C_thicknessRatio: C, D_widerAndSoft: D, E_toggleAndStats: E, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();
