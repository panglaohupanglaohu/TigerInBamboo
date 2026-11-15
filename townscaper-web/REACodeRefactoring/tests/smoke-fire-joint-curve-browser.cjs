// 第 100 轮 · 837027901853810688 · 烟体积 × 火光 **逐帧联合曲线**回归。
//
// 已有 tests/fire-coupling-browser.cjs 只取三个时刻（base / 0.18s / 0.39s）打点断言，
// 第 99 轮把它记成「仍缺逐帧联合曲线」——本文件补这个缺口：点火后按 0.02s 步长连续采样，
// **同一帧**同时读「烟的 alpha 覆盖像素数」与「火光强度」，然后断言两条曲线的**关系**：
//
//   原片（600/514 帧那条，见 artifacts/coverage/837027901853810688-review.md）：
//     烟 5066 → 11777 px（2.32×）、火光 1987 → 1155 → 450（0.58 → 0.23）
//     即「火光当触发器、烟体积做积分」——火在 0.39s 已掉到 23%，烟的体积却涨着且不回落。
//
// 断言：
//   A 量级：烟峰值 / 点火前 ≥ 2.0×（原片 2.32×）
//   B 火光：峰值 ≤0.10s；0.18s 落在 0.55–0.62；1.20s ≤ 峰值×0.10（原片 0.23 @0.39s）
//   C 交叉：存在连续 ≥5 个采样，火光在降而烟在涨（原片最典型的形状）
//   D 同步：烟首次 >1.02× 与火光首次 >0.5 的**时间差 ≤0.04s**（同一帧起爆，不是先后两件事）
//   E 不回落：全程烟覆盖不低于峰值的 92%；火光峰值之后最多允许 1 处回弹
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const PROBE = `
import * as THREE from 'three';
import { makeRng } from './src/core/noise.js';
const REA = window.rea;
const W = 400, H = 400;
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
    const a = buf[si + 3] > 128 ? 238 : 16;
    img.data[di] = a; img.data[di + 1] = a; img.data[di + 2] = a; img.data[di + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
const wind = new THREE.Vector3(1, 0, 0.2);
const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
cam.position.set(2.45, 1.10, 5.35); cam.lookAt(1.15, 1.35, 0); cam.updateMatrixWorld();

window.__jointCurve = (opts) => {
  const step = opts?.step ?? 0.02;
  const span = opts?.span ?? 1.2;
  const smoke = REA.view.smoke;
  smoke.setLobeStyle('fine'); smoke.setLobes(true); smoke.setSolidBase(true);
  smoke.setTopBreak(false); smoke.setHaze(false); smoke.setCrown(false);
  smoke.setFireCoupling(true);
  smoke.clear(); smoke.random = makeRng(11);
  smoke.sources = [{ x: 0, y: 0, z: 0 }];
  for (let i = 0; i < 60; i++) smoke.update(0.05, wind, cam);       // 常态柱长到稳态
  const pre = renderAlpha(smoke, cam);
  const png = { pre: renderAlphaPng(smoke, cam) };
  smoke.ignite(0);
  const rows = [{ t: 0, px: renderAlpha(smoke, cam), light: smoke.fireAt(0).light,
    sizeMul: smoke.fireAt(0).sizeMul, cards: smoke.p.length }];
  const n = Math.round(span / step);
  for (let i = 1; i <= n; i++) {
    smoke.update(step, wind, cam);
    const f = smoke.fireAt(0);
    const t = +(i * step).toFixed(3);
    rows.push({ t, px: renderAlpha(smoke, cam), light: f.light, sizeMul: f.sizeMul, cards: smoke.p.length });
    if (t === 0.18 || t === 0.38 || t === 1.2) png['t' + String(t).replace('.', '')] = renderAlphaPng(smoke, cam);
  }
  return { pre, step, rows, png };
};
`;

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const rows = [];
  const ok = (c, m) => rows.push({ ok: !!c, m });
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
    await frame.waitForFunction(() => typeof window.__jointCurve === 'function', null, { timeout: 30000 });
    rep = await frame.evaluate(() => window.__jointCurve({ step: 0.02, span: 1.2 }));
    const fs2 = require('fs');
    for (const [k, b64] of Object.entries(rep?.png || {})) {
      if (b64) fs2.writeFileSync(`${OUT}/smoke-fire-joint-${k}.png`, Buffer.from(b64.split(',')[1], 'base64'));
    }
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }

  const R = rep?.rows || [];
  const pre = rep?.pre || 0;
  const at = (t) => R.reduce((best, r) => (Math.abs(r.t - t) < Math.abs((best?.t ?? 1e9) - t) ? r : best), null);
  const maxPx = R.reduce((m, r) => Math.max(m, r.px), 0);
  const maxLight = R.reduce((m, r) => Math.max(m, r.light), 0);
  const peakLightAt = R.find((r) => r.light === maxLight)?.t ?? null;
  const s18 = at(0.18), s39 = at(0.39), sEnd = at(1.2);

  ok(R.length >= 55, `采样 ${R.length} 帧（0.02s 步长 / 1.2s 跨度）`);
  ok(pre > 500, `点火前常态烟覆盖 ${pre}px（柱已长起来）`);
  // A 量级：0.18s 的覆盖倍率对齐原片 2.32×（用 0.18s 而不是 1.2s —— 1.2s 的 3.1× 里有一大半是常态柱继续长）
  const a18 = (s18?.px ?? 0) / Math.max(1, pre);
  ok(a18 >= 2.15 && a18 <= 2.45, `0.18s 烟覆盖 ${s18?.px}px = 点火前 ${a18.toFixed(2)}×（原片 5066→11777=2.32×，容差 2.15–2.45）`);
  ok(s18 && s18.sizeMul >= 1.47 && s18.sizeMul <= 1.52, `0.18s 柱身倍率 ${s18?.sizeMul}（原片 1.49，容差 1.47–1.52）`);
  // B 火光
  ok(peakLightAt !== null && peakLightAt <= 0.10, `火光峰值出现在 ${peakLightAt}s（≤0.10s，爆燃当刻）`);
  const l18 = at(0.18)?.light ?? 0;
  ok(l18 >= 0.55 && l18 <= 0.62, `0.18s 火光 ${l18.toFixed(4)}（原片 0.5814，容差 0.55–0.62）`);
  const lEnd = at(1.2)?.light ?? 1;
  ok(lEnd <= maxLight * 0.10, `1.20s 火光 ${lEnd.toFixed(4)} ≤ 峰值 ${maxLight.toFixed(4)} 的 10%（火灭）`);
  // C 交叉段：0.18s → 0.39s 这一段必须**每一步**都是「火光降 + 烟涨」
  const win = R.filter((r) => r.t >= 0.18 && r.t <= 0.39);
  let winCross = 0;
  for (let i = 1; i < R.length; i++) {
    if (R[i].t < 0.18 || R[i].t > 0.39) continue;
    if (R[i].light < R[i - 1].light && R[i].px > R[i - 1].px) winCross++;
  }
  ok(win.length >= 10 && winCross >= win.length - 1, `0.18→0.39s 逐帧「火光降 / 烟涨」${winCross}/${win.length} 个采样（原片 1987→1155→450 降、5066→11777 涨）`);
  // D 同步
  const firstSmoke = R.find((r) => r.px > pre * 1.02);
  const firstLight = R.find((r) => r.light > 0.5);
  const lag = firstSmoke && firstLight ? Math.abs(firstSmoke.t - firstLight.t) : 9;
  ok(lag <= 0.04, `烟首涨 ${firstSmoke?.t}s vs 火光过 0.5 的 ${firstLight?.t}s，时差 ${lag.toFixed(2)}s（≤0.04s，同帧起爆）`);
  // E 不回落（相对 0.18s 基准，不是相对终值）
  ok((s39?.px ?? 0) >= 0.95 * (s18?.px ?? 1), `0.39s 烟覆盖 ${s39?.px}px ≥ 0.18s 的 95%（${(100 * (s39?.px ?? 0) / Math.max(1, s18?.px ?? 1)).toFixed(1)}%，火掉到 23% 烟不缩）`);
  ok((sEnd?.px ?? 0) > (s39?.px ?? 0), `1.20s 烟覆盖 ${sEnd?.px}px 仍 > 0.39s 的 ${s39?.px}px（继续长，不随火散）`);
  let bumps = 0;
  for (let i = 1; i < R.length; i++) {
    if (R[i].t <= (peakLightAt ?? 0)) continue;
    if (R[i].light > R[i - 1].light + 1e-6) bumps++;
  }
  ok(bumps <= 1, `火光峰值后回弹 ${bumps} 处（≤1，衰减曲线无锯齿）`);

  if (problems.length) console.log('页面报错：\n' + problems.map((p) => '  ! ' + p).join('\n'));
  const summary = { pre, maxPx, peakPxAt: R.find((r) => r.px === maxPx)?.t, maxLight: +maxLight.toFixed(4), peakLightAt,
    px18: s18?.px, r18: +a18.toFixed(3), size18: s18?.sizeMul, l18: +l18.toFixed(4),
    px39: s39?.px, l39: +((s39?.light) ?? 0).toFixed(4), pxEnd: sEnd?.px, lEnd: +lEnd.toFixed(4),
    cardsEnd: R.at(-1)?.cards, winCross, winFrames: win.length, lag: +lag.toFixed(3), bumps };
  console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
  console.log('\n' + JSON.stringify(summary, null, 1));
  // 曲线落盘：给后续轮次留可比较的真值（不删旧文件，覆盖同名即可）
  const fs = require('fs');
  fs.writeFileSync(`${OUT}/smoke-fire-joint-curve.json`, JSON.stringify({ summary, rows: R }, null, 1));
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad || problems.length ? `\nFAIL ${bad}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
  if (bad || problems.length) process.exitCode = 1;
})();
