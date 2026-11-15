// 第 89 轮 · 837027901853810688 · 火光 × 烟体积耦合（运行验收）
//
// 目的不是「再测一遍曲线」（那个由 tests/fire-coupling.mjs 按实测点断言），而是验证
// **smoke.js 真的把曲线用上了**：点火后实例矩阵里的卡片尺寸要变粗、fireStats 要读得出，
// 而且默认关（不点火）时必须和原来一模一样（否则会污染 solid-base / lobe-size 两条回归）。
//
// 判据：
//   A 默认关：setFireCoupling(false) 时 smoke.fireStats === null、卡片均尺寸落在基线区间；
//   B 点火 0.18s：**卡片线性尺寸**均值 ≥1.30× 且 maxFm ≈1.49（1.494 = √2.30 的口径）。
//     注意：alpha 覆盖面积只涨到 1.40×，因为柱身卡片大量重叠、覆盖面积会几何饱和，
//     不是尺寸没长（scaleBase 0.434 → scale18 0.585 = 1.35× 线性 ⇒ 单卡面积 1.82×）。
//   F（第 90 轮新增）爆燃团：ignite() 当刻吐出的 burst 卡数 = 18，**alpha 覆盖面积 2.15–2.45×**（原片 2.30×）。
//     第 89 轮只靠柱身变粗最高 1.398×，剩下的那一截就是这团新烟。
//   C 时序：light 在 0.18s 处 0.55–0.62（原片 0.5814），0.39s 处 0.20–0.26（原片 0.2265）；
//   D 不回落：0.39s 的 meanFm 仍 ≥ 0.18s 的 0.95（原片火灭了烟不缩）；
//   E 关掉后回到常态：setFireCoupling(false) 再跑 40 帧，meanFm 回 1.000；
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const PROBE = `
import * as THREE from 'three';
import { makeRng } from './src/core/noise.js';
const REA = window.rea;
const W = 420, H = 420;
if (!window.__frozen) { window.__frozen = 1; REA.view.render = () => {}; }

function renderAlpha(smoke, cam) {
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
  let n = 0;
  for (let i = 0; i < W * H; i++) if (buf[i * 4 + 3] > 128) n++;
  return n;
}
function renderAlphaPng(smoke, cam) {
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
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const si = ((H - 1 - y) * W + x) * 4, di = (y * W + x) * 4;
    const a = buf[si + 3] > 128 ? 235 : 12;
    img.data[di] = a; img.data[di + 1] = a; img.data[di + 2] = a; img.data[di + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
function meanScale(smoke) {
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let sum = 0, n = 0;
  for (let i = 0; i < smoke.back.count; i++) { smoke.back.getMatrixAt(i, m); m.decompose(p, q, s); sum += s.x; n++; }
  return n ? sum / n : 0;
}
function setup() {
  const smoke = REA.view.smoke;
  smoke.setLobeStyle('fine'); smoke.setLobes(true); smoke.setSolidBase(true);
  smoke.setTopBreak(false); smoke.setHaze(false); smoke.setCrown(false);
  smoke.setFireCoupling(false);
  smoke.clear(); smoke.random = makeRng(11);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  return smoke;
}
const wind = new THREE.Vector3(1, 0, 0.2);
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
cam.position.set(2.45, 1.10, 5.35); cam.lookAt(1.15, 1.35, 0); cam.updateMatrixWorld();

window.__fireProbe = () => {
  const smoke = setup();
  for (let i = 0; i < 60; i++) smoke.update(0.05, wind, cam);          // 先长出一截常态柱
  const base = { px: renderAlpha(smoke, cam), scale: meanScale(smoke), stats: smoke.fireStats, cards: smoke.p.length,
    png: renderAlphaPng(smoke, cam) };
  // 点火：18 × 0.01 = 0.180s（与原片 0084→0090 同刻）
  smoke.setFireCoupling(true);
  const ig = smoke.ignite(0);
  for (let i = 0; i < 18; i++) smoke.update(0.01, wind, cam);
  const burstY = smoke.p.filter((q) => q.burst).map((q) => q.y);
  const t18png = renderAlphaPng(smoke, cam);
  const t18 = { px: renderAlpha(smoke, cam), scale: meanScale(smoke), stats: JSON.parse(JSON.stringify(smoke.fireStats)), cards: smoke.p.length,
    burstY: burstY.length ? { n: burstY.length, min: Math.min(...burstY), max: Math.max(...burstY),
      mean: burstY.reduce((a, b) => a + b, 0) / burstY.length } : null };
  // 再推到 0.390s（+21 × 0.01）
  for (let i = 0; i < 21; i++) smoke.update(0.01, wind, cam);
  const t39 = { px: renderAlpha(smoke, cam), scale: meanScale(smoke), stats: JSON.parse(JSON.stringify(smoke.fireStats)) };
  // 关掉耦合 + 再跑 40 帧（2s）：meanFm 必须回 1
  smoke.setFireCoupling(false);
  for (let i = 0; i < 40; i++) smoke.update(0.05, wind, cam);
  const off = { stats: smoke.fireStats, fm: smoke.p.map((p) => p.fm ?? 1) };
  const fmMax = off.fm.length ? Math.max(...off.fm) : 0;
  return { base, t18, t39, off: { stats: off.stats, fmMax }, ignite: ig, cards: smoke.p.length, png: { base: base.png, t18: t18png } };
};
`;

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  let rep = null;
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/smoke.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#scene')?.contentWindow?.rea?.view?.smoke?.p?.length > 10, null, { polling: 200, timeout: 90000 });
    const frame = page.frames().find((f) => f !== page.mainFrame() && /index\.html/.test(f.url()));
    if (!frame) throw new Error('找不到 #scene iframe');
    await frame.addScriptTag({ type: 'module', content: PROBE });
    await frame.waitForFunction(() => typeof window.__fireProbe === 'function', null, { timeout: 30000 });
    rep = await frame.evaluate(() => window.__fireProbe());
    const fs2 = require('fs');
    for (const k of ['base', 't18']) {
      const b64 = rep?.png?.[k];
      if (b64) fs2.writeFileSync(`${OUT}/fire-coupling-burst-${k}.png`, Buffer.from(b64.split(',')[1], 'base64'));
    }
    await page.screenshot({ path: `${OUT}/fire-coupling.png` });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const b = rep?.base, a = rep?.t18, c = rep?.t39;
  const area = b && a ? a.px / b.px : 0;
  const A = b && b.stats === null && b.cards > 10;
  const B = b && a && (a.scale / b.scale) >= 1.30 && a?.stats?.maxFm >= 1.44 && a?.stats?.maxFm <= 1.54;
  const C = a?.stats?.sources?.[0]?.light >= 0.55 && a?.stats?.sources?.[0]?.light <= 0.62
    && c?.stats?.sources?.[0]?.light >= 0.20 && c?.stats?.sources?.[0]?.light <= 0.26;
  const D = c && a ? c.stats.meanFm >= a.stats.meanFm * 0.95 : false;
  const E = rep?.off?.stats === null && rep?.off?.fmMax === 1;
  // F：爆燃团真的吐出来了（16 张 = 三组之和），且 alpha 覆盖面积到原片的 2.30× 附近（≥2.15 留 7% 容差）
  const F = a?.stats?.burstCards === 16 && area >= 2.15 && area <= 2.45;
  // G（第 91 轮）：这团烟必须**沿高度分层**——三组各出卡，且 burst 卡的 y 跨度 ≥1.0 世界单位
  //   （第 90 轮单层只有 0.5h 落差，画面上是柱脚一团胖蘑菇，证据 md 里记了）。
  const G = a?.stats?.burstLayers === 3 && (a?.burstY?.n ?? 0) === 16
    && (a.burstY.max - a.burstY.min) >= 1.0 && a.burstY.max >= 1.2;
  const ok = problems.length === 0 && A && B && C && D && E && F && G;
  console.log(JSON.stringify({
    areaCover: +area.toFixed(3), pxBase: b?.px, px18: a?.px, burstCards: a?.stats?.burstCards,
    scaleRatio: b && a ? +(a.scale / b.scale).toFixed(3) : 0,
    scaleBase: b && +b.scale.toFixed(3), scale18: a && +a.scale.toFixed(3),
    fm18: a?.stats?.meanFm, fm39: c?.stats?.meanFm, maxFm18: a?.stats?.maxFm,
    light18: a?.stats?.sources?.[0]?.light, light39: c?.stats?.sources?.[0]?.light,
    burstLayers: a?.stats?.burstLayers, burstY: a?.burstY ? {
      min: +a.burstY.min.toFixed(2), max: +a.burstY.max.toFixed(2), mean: +a.burstY.mean.toFixed(2) } : null,
    A, B, C, D, E, F, G, problems,
  }, null, 2));
  console.log(ok ? 'ALL PASS (fire-coupling browser)' : 'FAILED');
  process.exit(ok ? 0 : 1);
})();
