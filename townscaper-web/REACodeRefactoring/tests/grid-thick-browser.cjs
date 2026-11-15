// 第 68 轮 · 1120036868966502401 白色格线框定宽。
// 原片（460 宽）实测：frame-0060 n=94 median=2px mode=2；frame-0065 n=108 median=2 mode=2。
// 本仓原来用 LineSegments（WebGL lineWidth 恒 1px）→ 只有 1px。现在每段套一层屏幕定宽四边形。
// 判据：俯视截图里白色格线沿扫描行的 run 中位 = 2px（±0.5），且四边形数 = 线段数。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const measureRuns = (page, b64) => page.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
  const cv = document.createElement('canvas');
  const W = (cv.width = 600), H = (cv.height = 600);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, img.width * 0.2, img.height * 0.22, img.width * 0.5, img.height * 0.5, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const runs = [];
  for (let y = 8; y < H - 8; y += 5) {
    // 基色取该行中位亮度的灰度当作地面
    const rowL = [];
    for (let x = 0; x < W; x++) { const [r, g, b] = at(x, y); rowL.push(0.2126 * r + 0.7152 * g + 0.0722 * b); }
    const base = [...rowL].sort((a, b) => a - b)[Math.floor(W * 0.5)];
    let x = 0;
    while (x < W) {
      if (rowL[x] > base + 12) { const s = x; while (x < W && rowL[x] > base + 12) x++; if (x - s <= 5) runs.push(x - s); }
      else x++;
    }
  }
  runs.sort((a, b) => a - b);
  const med = runs.length ? runs[Math.floor(runs.length / 2)] : null;
  const hist = {};
  for (const r of runs) hist[r] = (hist[r] || 0) + 1;
  return { runs: runs.length, median: med, hist };
}, b64);

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { polling: 200, timeout: 90000 });
    report.geo = await page.evaluate(() => {
      const { view } = window.rea;
      view.setDebug('grid', true);
      const lines = view.gridLines.geometry.attributes.position.count / 2;
      const quads = view.gridThick.geometry.userData?.quads ?? null;
      view.pitch = 1.15; view.distance = 14; view.updateCamera(); view.render(0.016);
      return { lines, quads, thickVisible: view.gridThick.visible, thickWidthPx: view.setGridWidth(1) };
    });
    await page.waitForTimeout(400);
    const shot = await page.screenshot({ path: `${OUT}/grid-thick-2px.png` });
    report.px = await measureRuns(page, shot.toString('base64'));
    // 关掉再量一次：应当没有格线 run
    await page.evaluate(() => { const v = window.rea.view; v.setDebug('grid', false); v.render(0.016); });
    await page.waitForTimeout(300);
    const off = await page.screenshot({ path: `${OUT}/grid-thick-off.png` });
    report.offPx = await measureRuns(page, off.toString('base64'));
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const geoOk = report.geo?.quads === report.geo?.lines && report.geo.lines > 0 && report.geo.thickVisible === true;
  const pxOk = report.px?.median === 2;
  // 关掉后仍会有建筑/水面的亮边，只要求「明显变少」（< 开时的 55%）
  const offOk = (report.offPx?.runs || 0) < (report.px?.runs || 0) * 0.55;
  const ok = problems.length === 0 && geoOk && pxOk && offOk;
  console.log(JSON.stringify({ ok, geoOk, pxOk, offOk, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();
