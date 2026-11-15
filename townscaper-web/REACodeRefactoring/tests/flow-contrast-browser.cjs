// 第 68 轮 · 902069261304287232 / 901842167508992000 流场调试的**对比度**缺口。
// 原片是调试透视：地形被压成深灰近单色（原尺寸实测地面 luma p50 65–101），流线满亮霓虹（169–207，对比 +104）。
// 本仓原来反过来：岛面 p50 173，流线再乘 fade 后比地面更暗（对比 −26）。
// 判据（全部从真渲染的像素里量，不看代码猜）：
//   A. 开流场调试后地面 p50 落在 55–115；
//   B. 高彩度流线像素的 p95 luma 比地面 p50 高出 ≥ 60（对比为正且明显）；
//   C. 关掉调试层后压暗层同帧消失（flowDim.visible === false）。
// 第 69 轮追加：
//   D. 压暗只作用于岛体 —— 画面左上角（岛外背景/天空）的 luma 在开/关调试层之间差 ≤ 8
//      （原片 901842167508992000 frame-0300 实测四角 rgb(126,150,154)/luma 145.5 保持浅灰绿，只有岛体中心到 83.6）；
//   E. 散须收敛到每格 ≤ 2 根（原片每格 2–4 根，本仓原来朝所有更近邻格拉须、六边格到 5 根）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

/** 在页面里解码截屏 → 2D canvas → 算地面 p50 / 线条 p95 / 对比 */
const measure = (page, b64) => page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const cv = document.createElement('canvas');
  const W = (cv.width = 720), H = (cv.height = 480);
  const ctx = cv.getContext('2d');
  // 取画面中部（避开顶部页签、右侧能力面板、左下调色板）
  ctx.drawImage(img, img.width * 0.15, img.height * 0.15, img.width * 0.43, img.height * 0.70, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const ground = [], line = [];
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), chroma = mx - mn;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (chroma < 14) ground.push(luma);
    else if (chroma > 55 && mx > 90) line.push(luma);
  }
  const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const g50 = q(ground, 0.5), l95 = q(line, 0.95);
  return { groundN: ground.length, lineN: line.length, groundP50: g50, lineP95: l95, contrast: (g50 != null && l95 != null) ? l95 - g50 : null };
}, b64);

/** 画面左上角（岛外背景/天空）的平均 luma：压暗层如果还是整屏，这里会明显变暗。 */
const bgLuma = (page, b64) => page.evaluate(async (b64) => {  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const cv = document.createElement('canvas');
  const W = (cv.width = 180), H = (cv.height = 120);
  const ctx = cv.getContext('2d');
  // 左上 18% × 22%：badnorth 场景在这个视角下是天空/海面，没有岛体
  ctx.drawImage(img, 0, 0, img.width * 0.18, img.height * 0.22, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  let s = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
  return +(s / n).toFixed(2);
}, b64);

/** 岛体中心一小块的 luma p50（整屏统计会被岛外背景淹没，所以单独量这块）。
 *  原片 901842167508992000 frame-0300：岛心 120×120 是 luma 83.6，四角背景 145.5（比值 0.575）。 */
const islandP50 = (page, b64) => page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const cv = document.createElement('canvas');
  const W = (cv.width = 200), H = (cv.height = 140);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, img.width * 0.38, img.height * 0.40, img.width * 0.20, img.height * 0.18, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data, ls = [];
  for (let i = 0; i < d.length; i += 4) ls.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
  ls.sort((a, b2) => a - b2);
  return +ls[Math.floor(ls.length / 2)].toFixed(2);
}, b64);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 90000 });
    await page.evaluate(() => {
      const b = window.rea.battle;
      b.paused = false; b.wave = 2; b.t = 0; b.nextWave = 999;
      b.update(0);
      b.view.flowColorBy = 'unit';
      b.view.setDebug('flow', true);
      b.flowT = 0; b.update(1 / 120);
    });
    await page.evaluate(() => window.rea.view.render(0.016));
    await page.waitForTimeout(400);
    report.srcStats = await page.evaluate(() => {
      const b = window.rea.battle;
      const col = b.flowLines.geometry.attributes.color.array;
      let mx = 0, zeroA = 0, litA = 0;
      for (let i = 0; i < col.length; i += 4) { mx = Math.max(mx, col[i], col[i + 1], col[i + 2]); if (col[i + 3] === 0) zeroA++; else litA++; }
      return { dimVisible: !!b.flowDim?.visible, dimOpacity: (b.flowDim?.material?.uniforms?.uOpacity?.value ?? b.flowDim?.material?.opacity), colorMax: +mx.toFixed(3), zeroAlpha: zeroA, litAlpha: litA, segments: b.flowLines.geometry.attributes.position.count / 2,
        wisps: b.flowWispStats ?? null, dim: b.flowDimStats ?? null,
        wispLen: b.flowWispLen ?? null, typeColors: b.flowTypeColors ?? null };
    });
    // 第 70 轮：按兵种上色时，未知兵种不再被并进第一种颜色 —— 原片一条街上就有青/粉/黄绿三色
    report.typeColored = await page.evaluate(() => {
      const b = window.rea.battle;
      b.view.flowColorBy = 'type';
      b.flowT = 0; b.update(1 / 120);
      const col = b.flowLines.geometry.attributes.color.array;
      const set = new Set();
      for (let i = 0; i < col.length; i += 4) set.add([col[i], col[i + 1], col[i + 2]].map((v) => v.toFixed(2)).join(','));
      b.view.flowColorBy = 'unit';
      b.flowT = 0; b.update(1 / 120);
      return { colors: set.size, listed: b.flowTypeColors ?? null };
    });
    const on = await page.screenshot({ path: `${OUT}/flow-contrast-on.png` });
    report.on = await measure(page, on.toString('base64'));
    report.on.bg = await bgLuma(page, on.toString('base64'));
    report.on.island = await islandP50(page, on.toString('base64'));

    await page.evaluate(() => { const b = window.rea.battle; b.view.setDebug('flow', false); b.update(1 / 120); b.view.render(0.016); });
    await page.waitForTimeout(400);
    report.off = { dimVisible: await page.evaluate(() => !!window.rea.battle.flowDim?.visible) };
    const offShot = await page.screenshot({ path: `${OUT}/flow-contrast-off.png` });
    report.off.pix = await measure(page, offShot.toString('base64'));
    report.off.bg = await bgLuma(page, offShot.toString('base64'));
    report.off.island = await islandP50(page, offShot.toString('base64'));
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  // A/B 改成按**岛心**量：整屏统计里岛外背景（luma 183）占多数，会把中位拉到背景上去。
  // 原片岛心 83.6、四角背景 145.5（比值 0.575）→ 这里要求岛心在压暗后落到 45–140，且比未压暗时至少暗 25%。
  const A = report.on?.island != null && report.on.island >= 45 && report.on.island <= 140
    && report.off?.island != null && report.on.island <= report.off.island * 0.75;
  const contrast = (report.on?.lineP95 != null && report.on?.island != null) ? report.on.lineP95 - report.on.island : null;
  const B = contrast != null && contrast >= 60;
  const C = report.srcStats?.dimVisible === true && report.off?.dimVisible === false;
  // D：岛外背景在开/关压暗层之间几乎不变（整屏压暗层会让它掉 20+）
  const D = report.on?.bg != null && report.off?.bg != null && Math.abs(report.on.bg - report.off.bg) <= 8;
  // E：散须每格 ≤ 2
  const E = report.srcStats?.wisps != null && report.srcStats.wisps.maxPerCell <= 2 && report.srcStats.wisps.wisps > 0;
  // F（第 70 轮）：散须长度随离源距离增长 —— 近源一批明显短于远端一批（原片接近源头那几格只探出一点头）
  const wl = report.srcStats?.wispLen;
  const F = wl != null && wl.near != null && wl.far != null && wl.far > wl.near * 1.35;
  // G（第 70 轮）：按兵种上色时画面里出现 ≥2 种颜色的线（未知兵种不再全并成第一种）
  const G = (report.typeColored?.colors || 0) >= 2;
  const ok = problems.length === 0 && A && B && C && D && E && F && G;
  console.log(JSON.stringify({ ok, A_islandDim: A, B_contrast: B, C_dimToggle: C, D_bgUntouched: D, E_wisps: E, F_wispLen: F, G_typeColors: G, contrast, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();
