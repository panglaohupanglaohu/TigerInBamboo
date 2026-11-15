// 第 59 轮 · 1120036868966502401：网格调试层的「格角小白点 + 格心彩色点」。
// 原片（frame-0130 / 0210 / 0300 / 0420 / 0450 放大复核）：
//   · 每个格角一颗小白点（相邻格共角只画一颗，所以点数远小于 4×格数）；
//   · 格心有一颗较大的彩色点：多数是黄，少数红 / 绿 / 蓝 / 紫；同高度层同色 → 沿等高线排成一条条「同色成列」；
//   · 两类点的屏幕尺寸都不随远近变（原片拉远拉近点还是那几个像素）。
// 本仓此前只在 docstring 里写着"格角上有小白点"，代码里一个点都没有（contour-overlay.js 只有线框/边界/选中格/gizmo）。
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
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });

  await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&on=contours', { waitUntil: 'load' });
  await page.waitForFunction(() => window.rea?.view?.contourOverlay, null, { polling: 200, timeout: 90000 });
  await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 100, null, { polling: 200, timeout: 90000 });

  report.setup = await page.evaluate(() => {
    const v = window.rea.view, w = window.rea.world, o = v.contourOverlay;
    v.setDebug('contours', true);
    let cell = null;
    for (const c of w.cells) { if (w.top(c) > 0 && c.pts.length >= 4) { cell = c; break; } }
    const cx = cell.pts.reduce((s, p) => s + p.x, 0) / cell.pts.length;
    const cz = cell.pts.reduce((s, p) => s + p.z, 0) / cell.pts.length;
    v.target.set(cx, w.top(cell) * (v.levelHeight || 1), cz);
    v.yaw = Math.PI * 0.25; v.pitch = 1.05; v.distance = 11; v.updateCamera(); v.render(0.016);
    const st = o.dotStats;
    const counts = st.colors;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return {
      cells: w.cells.length,
      dotStats: st,
      dominant: sorted[0][0],
      dominantShare: +(sorted[0][1] / Math.max(1, st.cells)).toFixed(3),
      nonYellowColors: Object.entries(counts).filter(([h, n]) => h !== '#ffd21a' && n > 0).length,
      // 去重有效性：每个格至少 3 个角，未去重时角点数 ≥ 3×格数
      cornerRatio: +(st.corners / Math.max(1, st.cells)).toFixed(2),
      attenuation: { corners: o.corners.material.sizeAttenuation, dots: o.dots.material.sizeAttenuation },
      sizes: { corners: o.corners.material.size, dots: o.dots.material.size },
      order: { corners: o.corners.renderOrder, dots: o.dots.renderOrder },
      visible: { corners: o.corners.visible, dots: o.dots.visible },
      // 第 66 轮：格角改成「深芯 + 亮边」小方块（原片 4× 放大 frame-0080/0120 复核），不是纯白圆点
      cornerMark: {
        hasMap: !!o.corners.material.map,
        mapSize: o.corners.material.map ? [o.corners.material.map.image.width, o.corners.material.map.image.height] : null,
        size: o.corners.material.size,
        toneMapped: o.corners.material.toneMapped,
        alphaTest: o.corners.material.alphaTest,
        // 贴图芯像素：应明显比边暗
        coreLum: (() => { const m = o.corners.material.map; if (!m) return null; const cv = m.image, g = cv.getContext('2d');
          const d = g.getImageData(8, 8, 1, 1).data, e = g.getImageData(0, 8, 1, 1).data;
          const lum = (q) => Math.round(0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]);
          return { core: lum(d), rim: lum(e) }; })(),
      },
    };
  });
  report.setup.cellCount = await page.evaluate(() => window.rea.world.cells.length);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/grid-debug-dots-on.png' });

  // 屏幕恒定：拉远 3 倍，material.size 不应变化（sizeAttenuation:false 时像素尺寸恒定）
  report.distance = await page.evaluate(() => {
    const v = window.rea.view, o = v.contourOverlay;
    v.distance = 33; v.updateCamera(); v.render(0.016);
    const far = { corner: o.corners.material.size, cell: o.dots.material.size };
    v.distance = 11; v.updateCamera(); v.render(0.016);
    return { far, near: { corner: o.corners.material.size, cell: o.dots.material.size } };
  });
  await page.waitForTimeout(200);

  // 关掉点标记 → 两张图应不同（由 ViewImage 复核）
  report.off = await page.evaluate(() => {
    const o = window.rea.view.contourOverlay;
    o.setDots(false);
    window.rea.view.render(0.016);
    return { corners: o.corners.visible, dots: o.dots.visible, stats: o.dotStats.on };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/grid-debug-dots-off.png' });
  report.back = await page.evaluate(() => {
    const o = window.rea.view.contourOverlay;
    o.setDots(true);
    window.rea.view.render(0.016);
    return { corners: o.corners.visible, dots: o.dots.visible, stats: o.dotStats.on };
  });

  await browser.close();
  report.problems = problems;
  require('fs').writeFileSync(OUT + '/grid-debug-dots.json', JSON.stringify(report, null, 2));

  const s = report.setup;
  const fail = [];
  if (problems.length) fail.push('page/console errors: ' + problems.join(' | '));
  if (!(s.dotStats.corners > 100)) fail.push('too few corner dots: ' + s.dotStats.corners);
  if (!(s.dotStats.cells > 100)) fail.push('too few cell dots: ' + s.dotStats.cells);
  if (s.dominant !== '#ffd21a') fail.push('dominant color is not yellow: ' + s.dominant);
  if (s.dominantShare < 0.5) fail.push('yellow not dominant enough: ' + s.dominantShare);
  if (s.nonYellowColors < 2) fail.push('missing secondary colors: ' + s.nonYellowColors);
  if (s.cornerRatio >= 3) fail.push('corners not deduped (ratio ' + s.cornerRatio + ')');
  if (s.attenuation.corners || s.attenuation.dots) fail.push('dots attenuate with distance');
  if (report.distance.far.cell !== report.distance.near.cell) fail.push('cell dot size changed with distance');
  if (report.off.corners || report.off.dots) fail.push('setDots(false) did not hide dots');
  if (!report.back.corners || !report.back.dots) fail.push('setDots(true) did not restore dots');
  // 第 66 轮：格角方块（深芯 + 亮边）
  const cm = s.cornerMark;
  if (!cm.hasMap) fail.push('corner marks lost their square texture');
  if (cm.mapSize && (cm.mapSize[0] < 8 || cm.mapSize[1] < 8)) fail.push('corner texture too small: ' + cm.mapSize);
  if (!(cm.size >= 6 && cm.size <= 9)) fail.push('corner mark size not 6–9px: ' + cm.size);
  if (cm.toneMapped) fail.push('corner mark is tone-mapped (dark core gets lifted)');
  if (!cm.coreLum || !(cm.coreLum.rim - cm.coreLum.core > 80)) fail.push('corner square has no dark core + light rim: ' + JSON.stringify(cm.coreLum));

  if (fail.length) { console.error('FAIL\n' + fail.join('\n')); console.error(JSON.stringify(s, null, 1)); process.exit(1); }
  console.log('PASS grid debug dots ' + JSON.stringify({
    corners: s.dotStats.corners, cells: s.dotStats.cells, cornerRatio: s.cornerRatio,
    dominant: s.dominant, dominantShare: s.dominantShare, nonYellow: s.nonYellowColors,
    colors: s.dotStats.colors, cornerSize: s.cornerMark.size, cornerLum: s.cornerMark.coreLum,
  }));
})().catch((e) => { console.error(e); process.exit(1); });
