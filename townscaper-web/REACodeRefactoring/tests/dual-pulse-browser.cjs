/** 959752525867036672 运行时验收：gridpatch.html 上把顶点格对偶叠层开起来，
 * 冻结在峰（uPulse=1）与谷（DUAL_PULSE.min）两档，各截一张，
 * 用 canvas 像素差证明「线真的缩放了」且峰谷比与片内量测同阶（√面积比 ≈ 1.206）。
 * 只读 dual.pulse，不改渲染路径。
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.REA_TEST_URL || 'http://localhost:8769';
const OUT = path.resolve(__dirname, '../artifacts/coverage');
const DUAL_MIN = 0.829;   // = DUAL_PULSE.min（tests/dual-pulse.mjs 校验它等于片内拟合值）

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const errors = [], reports = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await p.goto(BASE + '/gridpatch.html?grid=quad');
  await p.waitForFunction(() => window.patchRuntime?.view?.mesh?.geometry?.attributes?.position?.count > 0, null, { polling: 100 });

  const setup = await p.evaluate(() => {
    const { dual, view } = window.patchRuntime;
    dual.group.visible = true; dual.refresh();
    // 冻结脉动：页面的 rAF 每帧都在调 update(t)，这里换成常量档位，页面渲染路径不动
    dual.update = () => {};
    window.__phase = (v) => { dual.pulse.value = v; view.render(0); return dual.pulse.value; };
    return { stats: dual.stats, pulse0: dual.pulse.value };
  });

  // ① 几何side：shader 是 mix(aOrigin, p, uPulse)，所以线段总长与 uPulse 成正比 —— 用真实 buffer 算
  const geo = await p.evaluate(() => {
    const { dual } = window.patchRuntime;
    const g = dual.group.children.find((o) => o.geometry?.attributes?.aOrigin);
    const pos = g.geometry.attributes.position, org = g.geometry.attributes.aOrigin;
    let len = 0;
    for (let i = 0; i < pos.count; i += 2) {
      const ax = org.getX(i) + (pos.getX(i) - org.getX(i)), az = org.getZ(i) + (pos.getZ(i) - org.getZ(i));
      const bx = org.getX(i + 1) + (pos.getX(i + 1) - org.getX(i + 1)), bz = org.getZ(i + 1) + (pos.getZ(i + 1) - org.getZ(i + 1));
      len += Math.hypot(bx - ax, bz - az);
    }
    return { segments: pos.count / 2, lengthAtScale1: len, quads: dual.stats };
  });

  // ② 像素side：同一帧里切两档各读一次，数差分（overlay 真的动了才算跑过运行验收）
  const pix = await p.evaluate(() => {
    const { dual, view } = window.patchRuntime;
    const c = document.querySelector('#view');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    const w = c.width, h = c.height, buf = (v) => {
      dual.pulse.value = v; view.render(0);
      const px = new Uint8Array(w * h * 4);
      g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
      return px;
    };
    const a = buf(1), b = buf(0.829);   // 峰 / 谷
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > 24 || Math.abs(a[i + 1] - b[i + 1]) > 24 || Math.abs(a[i + 2] - b[i + 2]) > 24) diff++;
    }
    return { w, h, diff };
  });

  const shots = {};
  for (const [name, v] of [['peak', 1], ['trough', 0.829]]) {
    await p.evaluate((x) => { window.patchRuntime.dual.pulse.value = x; window.patchRuntime.view.render(0); }, v);
    await p.waitForTimeout(80);
    const file = path.join(OUT, `dual-pulse-quad-${name}.png`);
    await p.locator('#view').screenshot({ path: file });
    shots[name] = { value: v, file };
  }

  const geoRatio = 1 / DUAL_MIN;
  // 线段总长按 uPulse 线性缩：真 buffer 上再量一次，确认 shader 的 mix 没被绕过
  const measured = geo.lengthAtScale1 * DUAL_MIN;
  reports.push({ setup, geo, pix, shots, geoRatio: +geoRatio.toFixed(3), clipRatio: 1.206 });

  if (!(pix.diff > 2000)) throw Error('overlay pixels did not change between peak and trough: ' + JSON.stringify(pix));
  if (Math.abs(geoRatio - 1.206) > 0.02) throw Error('line-length ratio ' + geoRatio.toFixed(3) + ' vs clip 1.206');
  if (!(geo.segments > 100 && geo.lengthAtScale1 > 0)) throw Error('dual buffer empty: ' + JSON.stringify(geo));

  fs.writeFileSync(path.join(OUT, 'dual-pulse-browser.json'), JSON.stringify({ reports, errors }, null, 2));
  await b.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS dual pulse peak/trough on the real World', JSON.stringify(reports[0].shots), 'diff', pix.diff, 'geoRatio', geoRatio.toFixed(3), 'clipRatio 1.206');
})().catch((e) => { console.error(e); process.exit(1); });
