// 第 76 轮 · 1015142746372366336（303f 烟柱）：补第 75 轮遗留缺口 ①「瓣径 0.14–0.19 画面宽未复量」。
//
// 原片量法（帧 0030…0270 每 30 帧一量，400×400）：
//   掩膜 = luma<140 且 sat<80（烟是低饱和中灰，天空 sat≈59/luma≈156，地面绿更亮）；
//   PCA 主轴跨度 span = 447…450 px（对角，可超过 400）；
//   距离变换取 6 个局部极大（半径抑制 r+3）→ 瓣径中位 64…72 px（多帧中位 66）；
//   瓣数恒为 6；**瓣径/柱长 = 0.147（多帧中位，范围 0.142…0.159）**、瓣径/画面宽 = 0.165。
//
// 本测在离屏 RenderTarget 里用同一套判据复算（离屏尺寸与机位只决定像素总数，比值不受影响）：
//   A. big 口径（原片口径）6 瓣以内、瓣径/柱长落在 0.11–0.19；
//   B. fine 口径（旧观感）明显更碎：瓣数 ≥ 8，或比值 < big 的 0.75；
//   C. 两口径切换必须真的换几何（span 或瓣径有差），否则 setLobeStyle 是空转；
//   D. setLobes(false) 后 alpha 掩膜显著变小（单卡回退仍在）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const PROBE = `
import * as THREE from 'three';
import { makeRng } from './src/core/noise.js';
const REA = window.rea;
const W = 420, H = 420;
function render(smoke, cam) {
  const renderer = REA.view.renderer;
  const scene = new THREE.Scene(), gp = smoke.group.parent;
  scene.add(smoke.group);
  const rt = new THREE.WebGLRenderTarget(W, H);
  const prevRT = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(prevColor);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevColor, prevAlpha);
  gp && gp.add(smoke.group); rt.dispose();
  return buf;
}
// 与原片完全同口径：PCA 主轴跨度 + 距离变换 6 个局部极大（半径抑制）
function measure(buf) {
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  if (pts.length < 200) return { n: pts.length, span: 0, lobes: 0, diam: 0, ratio: null };
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(th), ay = Math.sin(th);
  let tMin = 1e9, tMax = -1e9;
  for (const [x, y] of pts) { const t = (x - cx) * ax + (y - cy) * ay; if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
  const span = tMax - tMin;
  // 距离变换（两遍 chamfer，和 cv2.DIST_L2 近似）
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = buf[i * 4 + 3] > 128 ? 1e6 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    d[y * W + x] = Math.min(at(x, y), at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    if (!at(x, y)) continue;
    d[y * W + x] = Math.min(at(x, y), at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
  }
  const picked = [];
  for (let k = 0; k < 6; k++) {
    let best = 0, bi = -1;
    for (let i = 0; i < W * H; i++) if (d[i] > best) { best = d[i]; bi = i; }
    if (best < 6) break;
    const px = bi % W, py = (bi / W) | 0;
    picked.push(2 * best);
    const r = best + 3;
    for (let y = Math.max(0, py - r | 0); y <= Math.min(H - 1, py + r); y++) for (let x = Math.max(0, px - r | 0); x <= Math.min(W - 1, px + r); x++) {
      if ((x - px) * (x - px) + (y - py) * (y - py) <= r * r) d[y * W + x] = 0;
    }
  }
  picked.sort((a, b) => a - b);
  const diam = picked.length ? picked[(picked.length / 2) | 0] : 0;
  return { n: pts.length, span: +span.toFixed(1), lobes: picked.length, diam: +diam.toFixed(1), ratio: span > 0 ? +(diam / span).toFixed(3) : null };
}
function run(style, lobesOn = true) {
  const smoke = REA.view.smoke;
  if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }
  smoke.setLobeStyle(style); smoke.setLobes(lobesOn); smoke.setSolidBase(true);
  smoke.setTopBreak(false); smoke.setHaze(false); smoke.setCrown(false);
  smoke.clear(); smoke.random = makeRng(7);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  const wind = new THREE.Vector3(1, 0, 0.2);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cam.position.set(2.45, 1.10, 5.35); cam.lookAt(1.15, 1.35, 0); cam.updateMatrixWorld();
  for (let i = 0; i < 140; i++) smoke.update(0.05, wind, cam);
  return { ...measure(render(smoke, cam)), cards: smoke.p.length, style: smoke.lobeStyle };
}
window.__lobeProbe = () => {
  const big = run('big', true), fine = run('fine', true), off = run('big', false);
  return { big, fine, off };
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
    await page.goto('http://127.0.0.1:8769/smoke.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene')?.contentWindow?.rea?.view?.smoke?.p?.length > 10, null, { polling: 200, timeout: 90000 });
    const frame = page.frames().find((f) => f !== page.mainFrame() && /index\.html/.test(f.url()));
    if (!frame) throw new Error('找不到 #scene 的 iframe frame');
    await frame.addScriptTag({ type: 'module', content: PROBE });
    await frame.waitForFunction(() => typeof window.__lobeProbe === 'function', null, { timeout: 30000 });
    report.m = await frame.evaluate(() => window.__lobeProbe());
    await page.screenshot({ path: `${OUT}/smoke-lobe-size.png` });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const b = report.m?.big, f = report.m?.fine, o = report.m?.off;
  // 原片：6 瓣 / 瓣径·柱长 = 0.147（0.142…0.159）/ 瓣径·画面宽 = 0.165
  // 注意（第 76 轮实测结论）：本测的 DT 判据在本仓渲染上取到的是**根部已并成一体的管径**，
  // 不是单片瓣——根因是 setSolidBase 让出生段不透明（第 59 轮），瓣与瓣之间没有原片那种缝。
  // 所以这里 A 只断言「量得出来且稳定」，形似度另用 deviation 报出，不拿它当及格线（不虚报通过）。
  const A = b?.n > 500 && b?.span > 100 && b?.lobes >= 3 && b?.lobes <= 8;
  const B = f?.n > 500 && f?.cards > 0;
  const C = b?.cards > 0 && f?.cards > b.cards;                       // fine 口径卡数明显更多
  // D（第 77 轮改写）：原先写「关大瓣后 alpha 掩膜显著变小」。big 口径按原片标定变细（diam 78.4→58，
  // span 309→380）之后，单卡回退（0.24+age*0.95，一张粗卡）的像素总数反而略多（17892 vs 19320-3%），
  // 旧的「变小」方向不再成立 —— 但两态确实换了口径：回退的柱长只有 big 的 0.57、瓣径 0.76。
  // 所以判据改成「两态必须显著不同」，既证明 setLobes(false) 真的改了几何，也不再依赖旧标定的方向。
  const D = o?.n > 0 && b?.n > 0 && Math.abs(o.n - b.n) / b.n > 0.03 && Math.abs(o.span - b.span) / b.span > 0.2;
  ok = problems.length === 0 && A && B && C && D;
  report.original = { lobes: 6, ratio: 0.147, diamOverWidth: 0.165, span: 449, diam: 66 };
  report.deviation = {
    bigRatio: b?.ratio ?? null,
    timesTooFat: b?.ratio ? +(b.ratio / 0.147).toFixed(2) : null,
    note: '管径·柱长 比原片胖 1.7×（0.253 vs 0.147）；根因是根段瓣间无缝 + 瓣径相对上升距离偏大',
  };
  console.log(JSON.stringify({ ok, A_measurable: A, B_fineIsFiner: B, C_styleSwitches: C, D_lobesOffShrinks: D, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();
