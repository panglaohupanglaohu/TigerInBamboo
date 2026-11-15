// 1205422438437273601 运行时验收：模板缓冲挖洞 vs 贴片假窗。
// 判据全部来自 GPU 读回：洞里看到的是室内（与"关墙参照"逐像素相同），
// 洞外墙面不受影响，同一模式重复渲染零漂移。
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://localhost:8769/opening-punch.html');
    await page.waitForFunction(() => window.openingPunch?.ready && window.openingPunch.last, null, { polling: 100 });

    const m = await page.evaluate(() => window.openingPunch.metrics());

    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify(m)); };
    if (m.openings !== 11 || m.doors !== 2) fail('立面洞口数量不对');
    if (Math.abs(m.holePixelsError) > 2) fail('洞口像素与解析面积偏差过大：' + m.holePixelsError + '%');
    if (m.interiorVisibleSharePunch < 0.97) fail('挖洞后洞里没有透出室内');
    if (m.interiorVisibleShareDecal > 0.02) fail('贴片方案竟然也能透出室内（对照失效）');
    if (m.wallDriftPixels !== 0) fail('洞外墙面在两个方案间不一致');
    if (m.repeatDriftPixels !== 0) fail('同模式重复渲染有漂移');
    if (!(Math.abs(m.meanLumaPunch - m.meanLumaDecal) > 1)) fail('两种方案的画面应当明显不同');

    // 三种模式各存一张，再截整页（页面上并排给了对照条）
    for (const mode of ['decal', 'punch', 'wallsOff']) {
      await page.evaluate((k) => window.openingPunch.redraw(k), mode);
      await page.locator('#fig-' + (mode === 'wallsOff' ? 'off' : mode) + ' canvas').screenshot({ path: `artifacts/coverage/opening-punch-${mode}.png` });
    }
    await page.click('#run');
    await page.waitForFunction(() => window.openingPunch.last?.mode);
    const shown = await page.evaluate(() => window.openingPunch.last);
    await page.screenshot({ path: 'artifacts/coverage/opening-punch-grid.png', fullPage: true });

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    fs.writeFileSync('artifacts/coverage/opening-punch-browser.json', JSON.stringify({ metrics: m, shown, errors }, null, 2));
    console.log('PASS stencil-punched openings vs decal: interior visible through holes, wall untouched, deterministic;', JSON.stringify(m));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
