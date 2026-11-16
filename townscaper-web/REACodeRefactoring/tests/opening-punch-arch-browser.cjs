// 1205422438437273601 运行时验收（第二层）：跨两层高拱龛的模板挖洞。
// 与 opening-punch-browser.cjs 的分工：那个管方洞（11 个门窗 vs 贴片），这个只管拱形跨层龛。
// 判据全部来自 GPU 读回，不看代码"应该有"：
//   ① 龛高 = 2 × 楼层高（跨两层），且解析面积对得上实测洞口像素；
//   ② 下层带与上层带各自都有 ≥97% 的像素透出室内 —— 一次挖穿两层，不是两层各挖一个方洞；
//   ③ 外包矩形内、半椭圆外的那圈拱肩像素，泄漏（= 参照的室内色）必须为 0 —— 挡模板用的是轮廓；
//   ④ 洞外墙面不变、同模式重复渲染零漂移。
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
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://localhost:8769/opening-punch.html');
    await page.waitForFunction(() => window.openingPunch?.ready && window.openingPunch.lastArch, null, { polling: 100 });

    const a = await page.evaluate(() => window.openingPunch.archRig.metrics());
    const m = await page.evaluate(() => window.openingPunch.metrics()); // 方洞那排不能被这次改动带坏
    const fail = (msg) => { throw new Error(msg + ' :: arch=' + JSON.stringify(a) + ' windows=' + JSON.stringify(m)); };

    if (a.arches !== 1) fail('拱龛数量不对（rise>0 的洞口应恰好 1 个）');
    if (Math.abs(a.archFloors - 2) > 1e-6) fail('龛高不是两层楼高：' + a.archFloors);
    if (Math.abs(a.holePixelsError) > 2) fail('洞口像素与解析（含半椭圆）面积偏差过大：' + a.holePixelsError + '%');
    if (a.archLowerShare < 0.97) fail('下层没有整片透出室内：' + a.archLowerShare);
    if (a.archUpperShare < 0.97) fail('上层没有整片透出室内：' + a.archUpperShare);
    if (a.archShoulderPixels < 200) fail('拱肩像素太少，判据不成立：' + a.archShoulderPixels);
    if (a.archShoulderLeak !== 0) fail('拱肩漏了（矩形挡模板会这样）：' + a.archShoulderLeak);
    if (a.interiorVisibleShareDecal > 0.02) fail('贴片方案也能透出室内（对照失效）');
    if (a.wallDriftPixels !== 0) fail('洞外墙面在两方案间不一致');
    if (a.repeatDriftPixels !== 0) fail('同模式重复渲染有漂移');
    // 方洞那排回归：数量与透出率不能被拱龛改造带跑
    if (m.openings !== 11 || m.doors !== 2) fail('方洞立面洞口数量被改坏了');
    if (m.interiorVisibleSharePunch < 0.97) fail('方洞那排的透出率掉了：' + m.interiorVisibleSharePunch);

    for (const mode of ['decal', 'punch', 'wallsOff']) {
      await page.evaluate((k) => window.openingPunch.archRig.redraw(k), mode);
      await page.locator('#fig-arch-' + (mode === 'wallsOff' ? 'off' : mode) + ' canvas')
        .screenshot({ path: `artifacts/coverage/opening-punch-arch-${{ decal: 'decal', punch: 'punch', wallsOff: 'off' }[mode]}.png` });
    }
    await page.click('#run');
    await page.waitForFunction(() => window.openingPunch.lastArch?.archFloors);
    await page.screenshot({ path: 'artifacts/coverage/opening-punch-arch-grid.png', fullPage: true });

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    fs.writeFileSync('artifacts/coverage/opening-punch-arch-browser.json', JSON.stringify({ arch: a, windows: m, errors }, null, 2));
    console.log('PASS cross-two-floor arch niche: lower/upper bands both punched, shoulder leak 0, wall untouched;',
      JSON.stringify({ archFloors: a.archFloors, rise: a.archRise, lower: a.archLowerShare, upper: a.archUpperShare, shoulder: a.archShoulderPixels, leak: a.archShoulderLeak, areaErr: a.holePixelsError }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
