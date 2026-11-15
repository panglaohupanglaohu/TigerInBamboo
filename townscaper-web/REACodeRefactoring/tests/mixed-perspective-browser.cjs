// 1310503825510367232 运行时验收：混合透视（mixed perspective）。
// 判据就两句原文：「远处房子变小」+「竖线笔直平行」，全部从帧缓冲按颜色逐行量，不认解析值。
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
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://localhost:8769/mixed-perspective.html');
    await page.waitForFunction(() => window.mixedPerspective?.last, null, { polling: 100 });

    const k1 = await page.evaluate(() => window.mixedPerspective.last);
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify({ stock: k1.stock, mixed: k1.mixed })); };

    // 四块同尺寸标尺必须都完整落在画面里，否则量出来的宽度是残片
    if (k1.stock.probes !== 4 || k1.mixed.probes !== 4) fail('标尺没有全部进画面');
    if (k1.repeatDriftPx !== 0) fail('同一档重复渲染有漂移：' + k1.repeatDriftPx);

    // 近大远小：两种投影都必须保留（k=1 不能退化成正交）
    if (!k1.stock.monotonicDepth) fail('普通透视下远处标尺没有变小');
    if (!k1.mixed.monotonicDepth) fail('混合透视下远处标尺没有变小（退化成正交了）');

    // 竖线：普通透视必须可见地收，混合透视必须量不出收
    if (k1.stock.maxAbsSpreadPct < 3) fail('普通透视的竖线收得太轻，参照不成立：' + k1.stock.maxAbsSpreadPct + '%');
    if (k1.mixed.maxAbsSpreadPct > 0.5) fail('k=1 面板上沿/下沿仍不等宽：' + k1.mixed.maxAbsSpreadPct + '%');
    if (k1.stock.maxAbsCenterShiftPx < 3) fail('普通透视的竖边应当有可见横移：' + k1.stock.maxAbsCenterShiftPx + 'px');
    if (k1.mixed.maxAbsCenterShiftPx > 0.5) fail('k=1 竖边仍有横移：' + k1.mixed.maxAbsCenterShiftPx + 'px');

    // 像素账要跟解析账对上（差 2px 以上说明渲染没照矩阵走）
    k1.perProbeStock.forEach((r, i) => {
      const a = k1.analytic[i];
      const pxRow = a.widthNdcStock * a.pxPerNdc;
      if (Math.abs(r.widthBottomPx - pxRow) > 2) fail(`${r.name} 底边像素宽 ${r.widthBottomPx} 与解析 ${pxRow.toFixed(1)} 不符`);
      const pxRowM = a.widthNdcMixed * a.pxPerNdc;
      if (Math.abs(k1.perProbeMixed[i].widthBottomPx - pxRowM) > 2) fail(`${r.name} k=1 底边像素宽 ${k1.perProbeMixed[i].widthBottomPx} 与解析 ${pxRowM.toFixed(1)} 不符`);
    });

    // k 必须单调：0 收得最狠，1 完全不收；且 k=1 的竖边横移为 0（像素级，不是"差不多"）
    const sweep = [];
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const o = await page.evaluate((kk) => window.mixedPerspective.render(kk), k);
      sweep.push({ k, spread: o.mixed.maxAbsSpreadPct, shift: o.mixed.maxAbsCenterShiftPx });
    }
    for (let i = 1; i < sweep.length; i++) {
      if (sweep[i].spread > sweep[i - 1].spread + 0.01) fail('收敛量随 k 不单调：' + JSON.stringify(sweep));
    }
    if (Math.abs(sweep[0].spread - k1.stock.maxAbsSpreadPct) > 0.01) fail('k=0 必须与普通透视逐值相同：' + JSON.stringify(sweep[0]));
    if (sweep[sweep.length - 1].spread > 0.5) fail('k=1 仍有余收：' + sweep[sweep.length - 1].spread);

    // 截图：k=0 / k=0.5 / k=1 三档各一张，再截整页
    for (const [k, name] of [[0, 'k0'], [0.5, 'k05'], [1, 'k1']]) {
      await page.evaluate((kk) => window.mixedPerspective.render(kk), k);
      await page.locator('#fig-stock canvas').screenshot({ path: `artifacts/coverage/mixed-perspective-${name}-stock.png` });
      await page.locator('#fig-mixed canvas').screenshot({ path: `artifacts/coverage/mixed-perspective-${name}-mixed.png` });
    }
    await page.evaluate(() => window.mixedPerspective.render(1));
    await page.screenshot({ path: 'artifacts/coverage/mixed-perspective-grid.png', fullPage: true });

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    fs.writeFileSync(
      'artifacts/coverage/mixed-perspective-browser.json',
      JSON.stringify({ k1, sweep, errors }, null, 2),
    );
    console.log('PASS mixed perspective: k=1 竖边横移 0px / 上下沿等宽, k=0 与普通透视逐值相同, 近大远小保留, k 单调;',
      JSON.stringify({ stock: k1.stock, mixed: k1.mixed, sweep }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
