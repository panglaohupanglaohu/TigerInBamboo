// 第 162 轮 · 837027901853810688 · 爆燃「三组高度」在曲线上可测（运行验收）
//
// r100–r161 的结论一直挂着一条：**爆燃三层高度在曲线上测不到** —— 点火当刻只有
// `burstStats.layers`（三组的 dy/sizeMul）与 `burstY`（boom 卡的 y 跨度）两个静态快照，
// 而 `tests/stain-joint-curve-browser.cjs` / `smoke-fire-joint-curve-browser.cjs` 两条曲线
// 都只数**整屏** alpha 像素，分不出「哪一层在长、长到多高」。
//
// 本轮把分层做成时间轴上的读数：`smoke.tierStats()`（只读，新增）逐帧给三组的世界高度区间、
// 卡片数、组间净空；本测试按 12 个时间点把曲线走一遍，并做两件事：
//   ① 三层在**世界高度**上真的分开（净空 > 0），且上升速度不同（顶层快、底层慢 = 原片「整柱在高度上膨开」）；
//   ② 分层的**画面后果**可量：分层版点火后烟团上沿被顶上去了（top 168→123px），
//      去掉 layers（单层版，同一种子同一相机）上沿几乎不动 → 顶上去的那一截就是顶层 roll 那组。
//
// 原片对照（frame-0083/0084/0086 实测，见证据 md）：爆燃团 bbox 69×67px（x298–366 / y21–87），
// 内部两个亮心在 y≈41–44 与 y≈52–60，下沿再拖到 y≈87 → 三组高度上是叠住的三个团。
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';
const W = 420, H = 420;
const SAMPLES = [2, 5, 8, 12, 16, 20, 26, 32, 39, 50, 70, 100];   // ×0.01s

const PROBE = `
import * as THREE from 'three';
import { makeRng } from './src/core/noise.js';
const REA = window.rea;
const W = ${W}, H = ${H};
if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }

function renderRT(smoke, cam, clear) {
  const renderer = REA.view.renderer;
  const scene = new THREE.Scene(), gp = smoke.group.parent;
  scene.add(smoke.group);
  const rt = new THREE.WebGLRenderTarget(W, H);
  const prevRT = renderer.getRenderTarget(), prevColor = new THREE.Color(), prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(prevColor);
  renderer.setRenderTarget(rt); renderer.setClearColor(clear, clear === 0xffffff ? 1 : 0); renderer.clear();
  renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prevRT); renderer.setClearColor(prevColor, prevAlpha);
  gp && gp.add(smoke.group); rt.dispose();
  return buf;
}
// 行索引一律「屏幕行（上=0）」，RT 是下起，这里翻一次
function rowsOf(buf, isAlpha) {
  const rows = new Array(H).fill(0);
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = buf[((H - 1 - y) * W + x) * 4 + 3];
    if (isAlpha) { if (a > 128) { rows[y]++; n++; } }
    else if (a > 128) { rows[y]++; n++; }
  }
  return { rows, n };
}
function maskPng(buf) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = buf[((H - 1 - y) * W + x) * 4 + 3] > 128 ? 235 : 14;
    const di = (y * W + x) * 4;
    img.data[di] = a; img.data[di + 1] = a; img.data[di + 2] = a; img.data[di + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
function colorPng(buf, bg) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const si = ((H - 1 - y) * W + x) * 4, di = (y * W + x) * 4;
    const a = buf[si + 3] / 255;
    for (let c = 0; c < 3; c++) img.data[di + c] = Math.round(buf[si + c] * a + bg[c] * (1 - a));
    img.data[di + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
const wind = new THREE.Vector3(1, 0, 0.2);
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
cam.position.set(2.45, 1.10, 5.35); cam.lookAt(1.15, 1.35, 0); cam.updateMatrixWorld();

function setup() {
  const smoke = REA.view.smoke;
  smoke.setLobeStyle('fine'); smoke.setLobes(true); smoke.setSolidBase(true);
  smoke.setTopBreak(false); smoke.setHaze(false); smoke.setCrown(false);
  smoke.setFireCoupling(false); smoke.setFireBurst(null);   // 回到默认三组
  smoke.clear(); smoke.random = makeRng(11);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  return smoke;
}
function snap(smoke, t) {
  const buf = renderRT(smoke, cam, 0);
  const { rows, n } = rowsOf(buf, true);
  const nz = rows.map((c, y) => [y, c]).filter((q) => q[1] > 0);
  const tiers = smoke.tierStats();
  const pk = rows.reduce((best, c, y) => (c > rows[best] ? y : best), 0);
  return { t: t == null ? -1 : +t.toFixed(3), px: n, top: nz.length ? nz[0][0] : null,
    bottom: nz.length ? nz[nz.length - 1][0] : null, peakRow: nz.length ? pk : null,
    tierCount: tiers.tiers.length, tiers: tiers.tiers, gaps: tiers.gaps, span: tiers.span,
    floor: tiers.floor, topY: tiers.top, plan: tiers.plan };
}

window.__tierCurve = (mode) => {
  const smoke = setup();
  if (mode === 'single') smoke.setFireBurst({ count: 16, sizeMul: 2.80, radius: 0.46, lift: 0.30, lifeMul: 0.55, riseMul: 0.65, layers: null });
  for (let i = 0; i < 60; i++) smoke.update(0.05, wind, cam);
  const pre = snap(smoke, null);
  const prePng = maskPng(renderRT(smoke, cam, 0));
  smoke.setFireCoupling(true);
  smoke.ignite(0);
  const curve = [];
  let done = 0;
  for (const s of ${JSON.stringify(SAMPLES)}) {
    while (done < s) { smoke.update(0.01, wind, cam); done++; }
    curve.push(snap(smoke, s * 0.01));
  }
  const at18 = curve.find((c) => Math.abs(c.t - 0.18) < 1e-6) ?? curve[Math.min(5, curve.length - 1)];
  const buf18 = renderRT(smoke, cam, 0);
  const png18 = maskPng(buf18);
  return { mode: mode || 'layered', pre, prePng, png18, curve,
    burstLayers: smoke.burstStats?.layers ?? null, cards: smoke.p.length };
};

window.__tierShot = () => {
  const smoke = setup();
  for (let i = 0; i < 60; i++) smoke.update(0.05, wind, cam);
  smoke.setFireCoupling(true); smoke.ignite(0);
  for (let i = 0; i < 18; i++) smoke.update(0.01, wind, cam);
  const buf = renderRT(smoke, cam, 0);
  return { png: colorPng(buf, [214, 222, 226]), tiers: smoke.tierStats() };
};
`;

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  let rep = null, single = null, shot = null;
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/smoke.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene')?.contentWindow?.rea?.view?.smoke?.p?.length > 10, null, { polling: 200, timeout: 90000 });
    const frame = page.frames().find((f) => f !== page.mainFrame() && /index\.html/.test(f.url()));
    if (!frame) throw new Error('找不到 #scene iframe');
    await frame.addScriptTag({ type: 'module', content: PROBE });
    await frame.waitForFunction(() => typeof window.__tierCurve === 'function', null, { timeout: 30000 });
    rep = await frame.evaluate(() => window.__tierCurve('layered'));
    single = await frame.evaluate(() => window.__tierCurve('single'));
    shot = await frame.evaluate(() => window.__tierShot());
    for (const [name, b64] of [['fire-burst-tiers-pre', rep?.prePng], ['fire-burst-tiers-t018', rep?.png18], ['fire-burst-tiers-color', shot?.png]]) {
      if (b64) fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(b64.split(',')[1], 'base64'));
    }
    await page.screenshot({ path: `${OUT}/fire-burst-tiers-page.png` });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }

  const pre = rep?.pre, curve = rep?.curve ?? [], sgl = single?.curve ?? [];
  const at = (t) => curve.find((c) => Math.abs(c.t - t) < 1e-6);
  const c18 = at(0.18) ?? curve[5], c39 = at(0.39) ?? curve[8], c100 = at(1.0) ?? curve[curve.length - 1];
  // A 三组齐备（默认 plan 就是 base/shaft/roll）
  const A = !!c18 && c18.tierCount === 3 && c18.plan.join(',') === 'base,shaft,roll'
    && c18.tiers.map((t) => t.cards).join(',') === '7,5,4';
  // B 三组在世界高度上分开且有序（净空 > 0，均值递增）
  const B = !!c18 && c18.gaps.length === 2 && c18.gaps.every((g) => g > 0)
    && c18.tiers[0].yMean < c18.tiers[1].yMean && c18.tiers[1].yMean < c18.tiers[2].yMean
    && (c18.tiers[2].yMean - c18.tiers[0].yMean) >= 0.9;
  // C 曲线上三组各自在长，且上升速度不同（顶层 riseMul 0.95 > 底层 0.62）
  const dTop = curve.length && c39 ? c39.tiers.map((t, i) => +(t.yMax - c18.tiers[i].yMax).toFixed(4)) : null;
  const C = !!c39 && dTop && dTop.every((d) => d > 0) && dTop[2] > dTop[0] * 1.2;
  // D 画面后果：分层版上沿被顶上去，且多出来的像素落在原柱顶之上
  const rise = pre && c18 ? pre.top - c18.top : 0;
  const D = !!pre && !!c39 && rise >= 25 && pre.top - c39.top >= 35;
  // E 单层对照：同一相机同一时间只有一组；单层也会把烟团撑大（大卡），但分层版上沿再高 ≥40%
  const rise1 = single ? single.pre.top - (sgl.find((c) => Math.abs(c.t - 0.18) < 1e-6) ?? sgl[5]).top : 0;
  const E = !!single && sgl.length > 0 && sgl[5].tierCount === 1 && rise >= rise1 * 1.4 && rise > rise1;
  // F 曲线全程不断层（点火后每一档都能读到 3 组，不是只在当刻有）
  const F = curve.length === 12 && curve.filter((c) => c.t > 0.02).every((c) => c.tierCount === 3);

  const ok = problems.length === 0 && A && B && C && D && E && F;
  console.log(JSON.stringify({
    pre: pre && { px: pre.px, top: pre.top, bottom: pre.bottom },
    t018: c18 && { px: c18.px, top: c18.top, gap: c18.gaps, tiers: c18.tiers.map((t) => ({ n: t.name, cards: t.cards, yMin: t.yMin, yMax: t.yMax, yMean: t.yMean })) },
    t039: c39 && { px: c39.px, top: c39.top, span: c39.span, tiers: c39.tiers.map((t) => ({ n: t.name, yMax: t.yMax })) },
    t100: c100 && { px: c100.px, top: c100.top, tierCount: c100.tierCount, tiers: c100.tiers.map((t) => ({ n: t.name, cards: t.cards, yMax: t.yMax })) },
    curveTop: curve.map((c) => [c.t, c.top, c.tierCount, +c.span.toFixed(2)]),
    dTop18to39: dTop, topRise: rise, singleRise: rise1, singleTiers: sgl[5]?.tierCount,
    A, B, C, D, E, F, problems,
  }, null, 2));
  console.log(ok ? 'ALL PASS (fire-burst-tiers)' : 'FAILED');
  process.exit(ok ? 0 : 1);
})();
