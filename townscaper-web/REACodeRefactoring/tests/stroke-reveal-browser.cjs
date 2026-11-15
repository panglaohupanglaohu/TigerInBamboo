// 1448039167057879048 / 1447483550257799171 运行时验收：线稿逐笔描出。
// 判据来自真实画布像素：墨迹随进度单调增加、中途不是全白也不是全黑、画完等于整张图。
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

    await page.goto('http://127.0.0.1:8769/stroke-reveal.html');
    await page.waitForFunction(() => window.strokeReveal?.ready, null, { polling: 50 });

    const config = await page.evaluate(() => window.strokeReveal.config());
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify({ config, samples })); };

    const samples = [];
    for (const p of [0, 0.15, 0.35, 0.6, 0.85, 1]) {
      await page.evaluate((v) => window.strokeReveal.seek(v), p);
      samples.push({ p, ...(await page.evaluate(() => window.strokeReveal.stats())) });
    }

    for (let i = 1; i < samples.length; i++) {
      if (samples[i].drawnLength < samples[i - 1].drawnLength - 1e-9) fail(`p=${samples[i].p} 已描弧长回退`);
      if (samples[i].inkPixels < samples[i - 1].inkPixels - 40) fail(`p=${samples[i].p} 墨迹像素回退`);
    }
    if (samples[0].inkPixels !== 0) fail('p=0 时画布应当是空的');
    if (samples[1].inkPixels < 200) fail('p=0.15 时应当已经有明显墨迹');
    if (!(samples[1].ratio > 0.001 && samples[1].ratio < 0.9)) fail('p=0.15 应当是中途（既非 0 也非全满）');
    const last = samples[samples.length - 1];
    if (!last.done || Math.abs(last.ratio - 1) > 1e-9) fail('p=1 必须整张画完');
    if (last.finished !== last.strokes) fail('p=1 所有笔画都要 finished');
    if (last.inkPixels < samples[3].inkPixels + 500) fail('画完的墨迹应当明显多于 60% 时');
    if (last.time > last.endTime + 1e-6) fail('收尾时间超过了排期');

    // 三张快照：25% / 60% / 100%
    for (const [name, p] of [['25', .25], ['60', .6], ['100', 1]]) {
      await page.evaluate((v) => window.strokeReveal.seek(v), p);
      await page.locator('#c').screenshot({ path: `artifacts/coverage/stroke-reveal-${name}.png` });
    }

    // 真播放一遍：确认 rAF 会推进，且到点自己停
    await page.evaluate(() => { window.strokeReveal.seek(0); window.strokeReveal.play(); });
    await page.waitForFunction(() => window.strokeReveal.stats().done, null, { polling: 100, timeout: 15000 });
    await page.screenshot({ path: 'artifacts/coverage/stroke-reveal-grid.png', fullPage: true });

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    fs.writeFileSync('artifacts/coverage/stroke-reveal-browser.json', JSON.stringify({ config, samples, errors }, null, 2));
    console.log('PASS stroke-reveal page:', config.strokes, '笔 /', config.duration + 's，墨迹',
      samples.map((s) => s.inkPixels).join(' → '));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
