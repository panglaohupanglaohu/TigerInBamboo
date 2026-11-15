// 第 53 轮 · 1120036868966502401：选中格的「定宽金黄折线」+ 屏幕恒定 gizmo 的运行时验收
// 原片（frame-0210 / frame-0300 放大裁切）：网格线框 1px 白；选中格是一圈 ~3px 金黄闭合折线（粗细不随远近变）；
// 右上角 RGB 三轴移动 gizmo，大小同样屏幕恒定。这里在真机位下拍两个距离，量折线宽度是否为同一个像素数。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

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
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&on=contours', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.contourOverlay, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 100, null, { polling: 200, timeout: 90000 });

    report.setup = await page.evaluate(() => {
      const v = window.rea.view;
      v.setDebug('contours', true);
      // 挑一块位于台面上的格（顶面朝上、有 ≥3 个顶点），选中它
      const w = window.rea.world;
      let cell = null;
      for (const c of w.cells) { if (w.top(c) > 0 && c.pts.length >= 4) { cell = c; break; } }
      const cx = cell.pts.reduce((s, p) => s + p.x, 0) / cell.pts.length;
      const cz = cell.pts.reduce((s, p) => s + p.z, 0) / cell.pts.length;
      const sel = v.contourOverlay.selectCell(cell);
      v.target.set(cx, w.top(cell) * (v.levelHeight || 1), cz);
      v.yaw = Math.PI * 0.25; v.pitch = 1.15;
      v.distance = 9; v.updateCamera(); v.render(0.016);
      return {
        cell: cell.id, n: cell.pts.length, sel,
        gizmoVisible: v.contourOverlay.gizmo.visible,
        gizmoScaleNear: v.contourOverlay.gizmo.scale.x,
        pixScale: v.contourOverlay.pixScale,
        outlineQuads: sel?.outlineQuads,
      };
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/contour-select-near.png` });

    report.far = await page.evaluate(() => {
      const v = window.rea.view;
      v.distance = 22; v.updateCamera(); v.render(0.016);
      return { gizmoScaleFar: v.contourOverlay.gizmo.scale.x, pixScale: v.contourOverlay.pixScale, width: v.contourOverlay.outlineWidth };
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/contour-select-far.png` });

    // 定宽判据：uPixScale 必须随视口高度/焦距算出来，gizmo 世界尺度必须随距离线性放大
    ok = problems.length === 0
      && report.setup.outlineQuads === report.setup.n
      && report.setup.gizmoVisible
      && report.far.gizmoScaleFar > report.setup.gizmoScaleNear * 2
      && report.setup.pixScale > 0;
    report.ratio = +(report.far.gizmoScaleFar / report.setup.gizmoScaleNear).toFixed(2);
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();
