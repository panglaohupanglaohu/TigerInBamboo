// 第 77 轮 · 1120036868966502401 quad-regular 档运行时验收。
// 原片 frame-0330：等距方格、每格边一条线、格内无对角线、交点 2–3px 亮斑。
// 这里在真机位（近俯视、同一目标点）下分别拍「贴面混合网格」与「quad-regular 档」两态，
// 由 tests/quad-lattice-measure.py 量白色格线的行内间距与线宽，看规整度是否真的变成等距。
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = { ok: false };
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&on=grid', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.gridLines, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 100, null, { polling: 200, timeout: 90000 });

    report.mixed = await page.evaluate(() => {
      const v = window.rea.view;
      const hud = document.querySelector('#hud'); if (hud) hud.style.display = 'none';   // 能力面板会压住画面中心
      v.setDebug('grid', true);
      v.setGridRegular(false);
      v.yaw = 0; v.pitch = 1.32; v.distance = 26;
      v.target.set(0, 1.2, 0); v.updateCamera(); v.render(0.016);
      return { stats: v.gridStats, dotsVisible: v.gridDots.visible, lines: v.gridLines.visible };
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/quad-lattice-mixed.png` });

    report.regular = await page.evaluate(() => {
      const v = window.rea.view;
      v.setGridRegular(true);
      v.setDebug('grid', true);
      v.yaw = 0; v.pitch = 1.32; v.distance = 26;
      v.target.set(0, 1.2, 0); v.updateCamera(); v.render(0.016);
      return {
        stats: v.gridStats, dotsVisible: v.gridDots.visible, rimVisible: v.gridRim.visible,
        dots: v.gridDots.geometry.getAttribute('position')?.count || 0,
        rims: v.gridRim.geometry.getAttribute('position')?.count || 0,
        dotsSize: v.gridDots.material.size, rimSize: v.gridRim.material.size,
        px: { ...v.gridPx },
        lineSegments: v.gridLines.geometry.getAttribute('position')?.count / 2 || 0,
      };
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/quad-lattice-regular.png` });

    // 第 79 轮：同一机位把视口高改回原片的 460，量「线宽/点径随视口折算」。
    // 走真实路径：先让渲染器按新尺寸重建缓冲区，再 render 一次 → onBeforeRender 读 domElement.height → applyGridPx
    await page.setViewportSize({ width: 1000, height: 460 });
    await page.waitForTimeout(250);
    report.small = await page.evaluate(() => {
      const v = window.rea.view;
      v.renderer.setSize(1000, 460, false);
      v.camera.aspect = 1000 / 460; v.camera.updateProjectionMatrix();
      v.render(0.016);
      return { px: { ...v.gridPx }, dotsSize: v.gridDots.material.size, rimSize: v.gridRim.material.size };
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/quad-lattice-regular-460.png` });

    // 对照档：跨层 pair（第 71 轮旧观感）在同一场景下重新出一次，确认开关真的改段数
    report.pairMode = await page.evaluate(() => {
      const v = window.rea.view;
      const before = v.gridStats.segments;
      v.setGridBreakMode('pair');
      const after = v.gridStats.segments;
      v.setGridBreakMode('none');
      return { before, after, restored: v.gridStats.segments, vertical: v.gridStats.drape?.vertical ?? null };
    });

    // 第 81 轮：交点「亮点」层默认关（断面量测见 view.js 注释），只有显式 setGridDotSize 才出现。
    report.dotOptIn = await page.evaluate(() => {
      const v = window.rea.view;
      const off = { visible: v.gridDots.visible, size: v.gridDots.material.size };
      v.setGridDotSize(3);
      const on = { visible: v.gridDots.visible, size: v.gridDots.material.size };
      v.setGridDotSize(0);
      const back = { visible: v.gridDots.visible, size: v.gridDots.material.size };
      v.render(0.016);
      return { off, on, back };
    });

    const s = report.regular.stats?.lattice || {};
    const d = report.regular.stats?.drape || {};
    const pxBig = report.regular.px || {};
    const pxSmall = report.small?.px || {};
    report.checks = {
      regular: s.regular === true,
      diagonalsZero: s.diagonals === 0,
      spacingSpreadZero: s.spacing?.spread === 0,
      // 第 78 轮起等距格默认贴面 + 按轮廓裁；第 79 轮起跨层不画竖线（breakMode=none）
      oneLinePerEdge: report.regular.lineSegments === (d.drawn + d.vertical),
      dotsAtEveryCorner: report.regular.dots === d.corners,
      drapeOn: d.drape === true,
      drapeClipsFootprint: d.dropped > 0,
      drapeLiftsOffPlane: d.yFlat > 0,
      // 第 81 轮：交点不补亮斑 —— 断面量测（frame-0340/0480/0510）白线半宽 P50=1.00 / P99=2.20 / max=3.00，
      // 全帧只有一个 3×3 夹角块，没有比线更粗的独立点。所以点层默认关，只有 setGridDotSize(>0) 才出现在平面格网上。
      dotsOffByDefault: report.regular.dotsVisible === false && report.regular.dotsSize === 0,
      dotOptIn: report.dotOptIn.on.visible === true && report.dotOptIn.on.size > 0
        && report.dotOptIn.back.visible === false && report.dotOptIn.back.size === 0,
      // 贴面档本来就不该有点层（原片的点只可能出现在平面格网上）
      surfaceHasNoDots: report.mixed.dotsVisible === false,
      // 第 79 轮：跨层默认不画竖线、外缘顶点单独一层黑方块
      breakModeNone: d.breakMode === 'none' && d.vertical === 0 && d.skipped > 0,
      rimMarked: report.regular.rims > 0 && report.regular.rims < report.regular.dots,
      rimLayerVisible: report.regular.rimVisible === true,
      rimBiggerThanDot: report.regular.rimSize > report.regular.dotsSize,
      // 线宽 = 原片基准 × (视口高/460)：760 高 ≈1.65×，460 高 =1.00×；点径基准 0（第 81 轮关掉）
      pxScaledToViewport: Math.abs(pxBig.line - 2 * pxBig.scale) < 0.02 && pxBig.dot === 0
        && pxBig.scale > 1.6 && pxBig.scale < 1.7,
      pxBackToOriginalAt460: Math.abs(pxSmall.line - 2) < 0.02 && Math.abs(pxSmall.scale - 1) < 0.01,
      breakModeSwitches: report.pairMode.after > report.pairMode.before && report.pairMode.restored === report.pairMode.before,
    };
    report.ok = Object.values(report.checks).every(Boolean) && problems.length === 0;
    report.problems = problems;
    fs.writeFileSync(`${OUT}/quad-lattice-report.json`, JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report.checks));
    console.log('mixedSegments=' + report.mixed.stats?.segments + ' regularSegments=' + report.regular.stats?.segments +
      ' drape(drawn=' + d.drawn + ' vertical=' + d.vertical + ' dropped=' + d.dropped + ' yFlat=' + d.yFlat + ') spacing=' + s.spacing?.median);
  } catch (e) {
    report.error = String(e && e.message || e);
    report.problems = problems;
    fs.writeFileSync(`${OUT}/quad-lattice-report.json`, JSON.stringify(report, null, 1));
    console.log('FAIL ' + report.error);
  } finally {
    await browser.close();
  }
  if (!report.ok) process.exit(1);
})();
