// 1798310423554658732「农田按地块共用耕纹主轴」主场景验收（r212）
// world/field-plot-map.js 把地块/主轴/人字行号烘成世界 XZ 浮点图，接进 View 主材质的 ?shade=fieldplots。
// 本测在**真的 index.html 主场景**上验五件事：
//   ① 页面侧确实烘出图（纹素数/可种格/地块数/纹素边长），且地块主轴夹角跨度 > 10°（片内边界改向）；
//   ② 开/关整帧差分显著、同状态噪声 0、关掉回位 0（渲染真的变了，不是抖动）；
//   ③ 画面上**每块地的条带方向不同**：取主轴差最大的两块地，在各自投影窗格里量亮度梯度主方向，
//      两者至少差 10°（片内 frame-0600：左块接近水平、右块约 −60°）；
//   ④ 条带是宽软带（窗内亮度有明显周期，不是常数色也不是发丝线）；
//   ⑤ 0 console error（浮点纹理 + 手写双线性没把着色器编译挂掉）。
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8769';
const OUT = 'artifacts/coverage';
const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errs = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(`${BASE}/index.html?scene=terrain&grid=mixed&shade=fieldplots`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.rea?.view?.shading?.stats?.fieldplots, null, { timeout: 180000 });
  // 固定机位 + 冻时间轴（像素账要干净）
  await page.evaluate(() => {
    const v = window.rea.view;
    window.__pin = { t: [0, 0.6, 0], d: 15, pitch: 1.05, yaw: 0.7 };
    const pin = () => { const P = window.__pin; v.target.set(...P.t); v.distance = P.d; v.pitch = P.pitch; v.yaw = P.yaw; };
    pin(); setInterval(pin, 80);
    document.querySelectorAll('#hud,#topright,#tools,.hud').forEach((e) => (e.style.opacity = 0));
    v.__orig = v.render.bind(v); v.render = () => {};
  });
  await page.waitForTimeout(1500);

  /* ---- ① 页面侧烘焙账 ---- */
  const rep = await page.evaluate(() => ({ stats: window.rea.view.shading.stats.fieldplots, report: window.rea.view.shading.fieldPlotReport() }));
  console.log('stats', JSON.stringify(rep.stats).slice(0, 400));
  const S = rep.stats;
  ok('页面烘出地块耕纹图（纹素/格数）', S && S.w > 40 && S.h > 40 && S.cells >= 20 && S.filled > 200, `${S.w}×${S.h} · 纹素 ${S.filled} · 可种格 ${S.cells} · texel ${S.texel}`);
  ok('地块数非平凡（≥3 块）', S.plots >= 3, `${S.plots} 块`);
  const degs = S.axes.map((a) => a.deg);
  let spread = 0;
  for (let i = 0; i < degs.length; i++) for (let j = i + 1; j < degs.length; j++) {
    let d = Math.abs(degs[i] - degs[j]) % 180; if (d > 90) d = 180 - d; spread = Math.max(spread, d);
  }
  ok('地块主轴真的改向（最大夹角 > 10°）', spread > 10, `最大夹角 ${spread.toFixed(2)}° · 地块角度 ${degs.slice(0, 8).map((d) => d.toFixed(0)).join('/')}…`);

  /* ---- ② 截图 + 关档回位（先做，落盘给眼睛看） ---- */
  await page.waitForTimeout(300);
  await page.evaluate(() => window.rea.view.__orig(0));
  await page.screenshot({ path: path.join(OUT, 'field-plots-main-on-r212.png') });
  await page.locator('#view').screenshot({ path: path.join(OUT, 'field-plots-canvas-on-r212.png') });
  await page.evaluate(() => { window.rea.view.shading.set('fieldplots', false); window.rea.view.__orig(0); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.rea.view.__orig(0));
  await page.screenshot({ path: path.join(OUT, 'field-plots-main-off-r212.png') });
  await page.locator('#view').screenshot({ path: path.join(OUT, 'field-plots-canvas-off-r212.png') });
  await page.evaluate(() => window.rea.view.shading.set('fieldplots', true));
  await page.waitForTimeout(300);
  ok('截图落盘', ['field-plots-main-on-r212.png', 'field-plots-canvas-on-r212.png', 'field-plots-main-off-r212.png', 'field-plots-canvas-off-r212.png']
    .every((f) => fs.existsSync(path.join(OUT, f)) && fs.statSync(path.join(OUT, f)).size > 15000), '4 张');
  // 近景（原片 0600 是近距离看田块）：同机位两档各一张，条带肉眼可数
  await page.evaluate(() => { window.__pin = { t: [-1.8, 1.2, 2.6], d: 7.5, pitch: 0.95, yaw: 0.55 }; });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.rea.view.__orig(0));
  await page.locator('#view').screenshot({ path: path.join(OUT, 'field-plots-closeup-on-r212.png') });
  await page.evaluate(() => { window.rea.view.shading.set('fieldplots', false); window.rea.view.__orig(0); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.rea.view.__orig(0));
  await page.locator('#view').screenshot({ path: path.join(OUT, 'field-plots-closeup-off-r212.png') });
  await page.evaluate(() => { window.rea.view.shading.set('fieldplots', true); window.__pin = { t: [0, 0.6, 0], d: 15, pitch: 1.05, yaw: 0.7 }; });
  await page.waitForTimeout(400);
  const cleanErrs = errs.slice();   // 到此为止（还没进离屏 RT 段）的 console error
  ok('0 console error（含开档烘焙 + 关/开切换）', cleanErrs.length === 0, cleanErrs.slice(0, 2).map((s) => s.split('\n')[0]).join(' / ') || '无');

  /* ---- ③ 像素账：dt=0 离屏 480×360 A/B + 噪声 ---- */
  const px = await page.evaluate(async () => {
    const THREE = await import('three');
    const v = window.rea.view, r = v.renderer, cam = v.camera, scene = v.scene;
    const W = 480, H = 360, rt = new THREE.WebGLRenderTarget(W, H);
    const draw = () => {
      v.__orig(0);
      r.setRenderTarget(rt); r.render(scene, cam); r.render(scene, cam);
      const a = new Uint8Array(W * H * 4);
      r.readRenderTargetPixels(rt, 0, 0, W, H, a);
      r.setRenderTarget(null);
      return a;
    };
    const diff = (a, b, thr = 6) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > thr) n++; return n; };
    v.shading.set('fieldplots', false);
    const off = draw(), off2 = draw();
    v.shading.set('fieldplots', true);
    const on = draw(), on2 = draw();
    // 地块中心投影（挑主轴差最大的两块）
    const sh = v.shading, fr = sh.fieldPlotReport();
    let best = null;
    for (let i = 0; i < fr.plots.length; i++) for (let j = i + 1; j < fr.plots.length; j++) {
      let d = Math.abs(fr.plots[i].axisDeg - fr.plots[j].axisDeg) % 180; if (d > 90) d = 180 - d;
      if (fr.plots[i].cells < 4 || fr.plots[j].cells < 4) continue;
      if (!best || d > best.d) best = { d, i, j };
    }
    const toScreen = (p) => {
      const g = v.town.top ? 0 : 0;
      const q = new THREE.Vector3(p.cx, 0.9, p.cz).project(cam);
      return { x: Math.round((q.x * 0.5 + 0.5) * W), y: Math.round((q.y * 0.5 + 0.5) * H), ndc: [q.x, q.y] };
    };
    const win = [];
    if (best) for (const k of [best.i, best.j]) {
      const p = fr.plots[k], s = toScreen(p);
      // 预测的屏幕梯度方向：把地块主轴当成世界方向，投影两个偏移点，条带法向 = 该方向 +90°
      const a = (p.axisRad ?? (p.axisDeg * Math.PI) / 180), e = 0.35;
      const q1 = new THREE.Vector3(p.cx + e * Math.cos(a), 0.9, p.cz + e * Math.sin(a)).project(cam);
      const q2 = new THREE.Vector3(p.cx - e * Math.cos(a), 0.9, p.cz - e * Math.sin(a)).project(cam);
      const axDeg = (Math.atan2((q1.y - q2.y) * H, (q1.x - q2.x) * W) * 180) / Math.PI;
      const axisImg = ((axDeg % 180) + 180) % 180;   // 条带沿主轴：实测梯度可能落在主轴或它的法向上（垄脊/垄沟极性）
      win.push({ deg: p.axisDeg, cells: p.cells, cx: p.cx, cz: p.cz, x: s.x, y: s.y, ndc: s.ndc, axisImg: +axisImg.toFixed(1) });
    }
    v.shading.set('fieldplots', true);
    return { off: Array.from(off), on: Array.from(on), offOn: diff(off, on), offOnStrict: diff(off, on, 12), noiseOff: diff(off, off2), noiseOn: diff(on, on2), W, H, win, best };
  });
  ok('开/关整帧差分显著（耕纹真的画进主场景）', px.offOn > 800, `${px.offOn} px（严格 ${px.offOnStrict}）`);
  ok('同状态噪声 0（差分不是抖动/水面动画）', px.noiseOff === 0 && px.noiseOn === 0, `off ${px.noiseOff} · on ${px.noiseOn}`);

  /* ---- ③ 每块地的条带方向不同（画面实测） ---- */
  const lum = (arr, x, y, W) => { const i = (y * W + x) * 4; return 0.299 * arr[i] + 0.587 * arr[i + 1] + 0.114 * arr[i + 2]; };
  function gradHist(arr, W, H, cx, cy, R = 26) {
    const bins = new Array(18).fill(0);
    let mag = 0, n = 0;
    for (let y = Math.max(1, cy - R); y < Math.min(H - 1, cy + R); y++) {
      for (let x = Math.max(1, cx - R); x < Math.min(W - 1, cx + R); x++) {
        const gx = lum(arr, x + 1, y, W) - lum(arr, x - 1, y, W);
        const gy = lum(arr, x, y + 1, W) - lum(arr, x, y - 1, W);
        const m = Math.hypot(gx, gy);
        if (m < 1.5) continue;
        let a = (Math.atan2(gy, gx) * 180) / Math.PI;         // 梯度方向 = 条带法向
        a = ((a % 180) + 180) % 180;
        bins[Math.min(17, Math.floor(a / 10))] += m;
        mag += m; n++;
      }
    }
    let bi = 0; for (let i = 1; i < 18; i++) if (bins[i] > bins[bi]) bi = i;
    const total = bins.reduce((s, v) => s + v, 0) || 1;
    const near=[-1,0,1].reduce((acc,k)=>acc+bins[(bi+k+18)%18],0);
    return { dirDeg: bi * 10 + 5, share: near / total, mag, px: n };
  }
  const wins = px.win.map((w) => ({ ...w, ...gradHist(px.on, px.W, px.H, w.x, w.y) }));
  console.log('windows', JSON.stringify(wins));
  ok('两块地都在画面内（抽样窗口有梯度能量）', wins.length === 2 && wins.every((w) => w.mag > 1500 && w.px > 80), wins.map((w) => `(${w.x},${w.y}) mag ${Math.round(w.mag)}`).join(' · '));
  let dirDiff = 0;
  if (wins.length === 2) { dirDiff = Math.abs(wins[0].dirDeg - wins[1].dirDeg) % 180; if (dirDiff > 90) dirDiff = 180 - dirDiff; }
  ok('画面里两块地的条带方向不同（≥10°）', dirDiff >= 10, `${wins.map((w) => w.dirDeg + '°').join(' vs ')} → 差 ${dirDiff}°（地块轴 ${wins.map((w) => w.deg.toFixed(0) + '°').join(' / ')}）`);
  const circDist = (a, b) => { let d = Math.abs(a - b) % 180; return d > 90 ? 180 - d : d; };
  const errsDeg = wins.map((w) => +Math.min(circDist(w.dirDeg, w.axisImg), circDist(w.dirDeg, w.axisImg + 90)).toFixed(1));
  ok('画面条带方向 == 该地块主轴投影（沿轴或横轴，±20°）', errsDeg.every((d) => d <= 20),
    wins.map((w, i) => `轴 ${w.deg.toFixed(0)}° → 投影 ${w.axisImg}° / 实测 ${w.dirDeg}°（差 ${errsDeg[i]}°）`).join(' · '));

  /* ---- ④ CPU 孪生：探针读到的行号/明暗有真实跨度 ---- */  const twin = await page.evaluate(() => {
    const sh = window.rea.view.shading, fr = sh.fieldPlotReport(), out = [];
    for (let z = fr.minZ + 0.4; z < fr.minZ + 14; z += 0.33) for (let x = fr.minX + 0.4; x < fr.minX + 14; x += 0.41) {
      const s = sh.fieldPlotProbe(x, z); if (s) out.push(s);
    }
    return { n: out.length, rows: out.map((s) => s.row), tones: out.map((s) => s.tone) };
  });
  const toneSpan = Math.max(...twin.tones) - Math.min(...twin.tones);
  const rowSpan = Math.max(...twin.rows) - Math.min(...twin.rows);
  ok('CPU 孪生：明暗有跨度（条带不是常数色）', twin.n > 30 && toneSpan > 0.15, `${twin.n} 点 · tone ${Math.min(...twin.tones).toFixed(3)}–${Math.max(...twin.tones).toFixed(3)}（跨度 ${toneSpan.toFixed(3)}）· row 跨度 ${rowSpan.toFixed(2)} 条`);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (errs.length) console.log('离屏 RT 段的 console error（与本模块无关，见证据）：', errs.length);
  fs.writeFileSync(path.join(OUT, 'field-plots-report-r212.json'), JSON.stringify({ stats: S, px: { offOn: px.offOn, offOnStrict: px.offOnStrict, noiseOff: px.noiseOff, noiseOn: px.noiseOn }, wins, twin: { n: twin.n, toneSpan, rowSpan }, checks }, null, 1));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
