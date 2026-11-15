/**
 * field-plots-browser.cjs — 田块耕纹画布验收（1798310423554658732）
 *
 * 只看两件事：左栏「按地块共享主轴」画布真的画出来了，且异块边界确实改向；
 * 右栏「逐格随机角」作对照必须与原实现一致地乱。
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const p = await b.newPage({ viewport: { width: 1100, height: 1100 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://127.0.0.1:8769/fields.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.fieldPlotsDemo?.ready === true, null, { polling: 100 });

    const report = await p.evaluate(async () => {
      const demo = window.fieldPlotsDemo;
      const cvs = document.querySelector('#plots');
      const ctx = cvs.getContext('2d');
      const img = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
      // 画布非空：至少 3 种颜色、非背景像素占比 > 80%
      const seen = new Set();
      let body = 0;
      for (let i = 0; i < img.length; i += 4) {
        seen.add((img[i] >> 3) + ',' + (img[i + 1] >> 3) + ',' + (img[i + 2] >> 3));
        if (img[i] !== 231 || img[i + 1] !== 239) body++;
      }
      const ratio = body / (img.length / 4);
      if (seen.size < 8) throw Error('画布颜色过少 ' + seen.size);
      if (ratio < 0.85) throw Error('画布大片空白 ' + ratio.toFixed(3));
      // 左栏（按地块）在 y=中间一行上，同一地块内的垄沟周期应当连续；
      // 用色相跳变次数近似：左栏跳变次数必须明显少于右栏（右栏每格换向）
      const W = cvs.width, PW = 396, GAP = 44, H = cvs.height;
      // 两栏同样是 11x11 格、同样画垄沟，只是取向规则不同 → 必须明显不同
      let diff = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < PW; x++) {
        const a = (y * W + x) * 4, b = (y * W + PW + GAP + x) * 4;
        diff += Math.abs(img[a] - img[b]) + Math.abs(img[a + 1] - img[b + 1]) + Math.abs(img[a + 2] - img[b + 2]);
        n++;
      }
      const meanDiff = diff / (n * 3);
      if (meanDiff < 3) throw Error('左右两栏几乎一样，对照没生效 ' + meanDiff.toFixed(2));
      if (!demo.seam) throw Error('没找到块内接缝，无法验收连续性');
      const lumAt = (x, y) => { const o = ((y | 0) * W + (x | 0)) * 4; return img[o] * 0.3 + img[o + 1] * 0.59 + img[o + 2] * 0.11; };
      const sx = Math.round(demo.seam.px), sy = Math.round(demo.seam.py);
      const jumpAt = (x0) => Math.abs(lumAt(x0 + 3, sy) - lumAt(x0 - 3, sy));
      const seamLeft = jumpAt(sx), seamRight = jumpAt(PW + GAP + sx);
      if (seamLeft > 12) throw Error('块内接缝处左栏断开了 ' + seamLeft.toFixed(1));
      if (seamRight < seamLeft + 5) throw Error(`右栏接缝未断开 ${seamRight.toFixed(1)} vs 左${seamLeft.toFixed(1)}`);
      // 换 seed 重画
      const seedInput = document.querySelector('#seed');
      seedInput.value = '23';
      seedInput.dispatchEvent(new Event('input'));
      const second = window.fieldPlotsDemo;
      if (second.seed !== 23) throw Error('seed 未生效');
      if (second.borders === demo.borders && second.borderAngles.length === demo.borderAngles.length
        && JSON.stringify(second.borderAngles) === JSON.stringify(demo.borderAngles)) {
        throw Error('换 seed 后划分没变');
      }
      const angled = demo.borderAngles.filter((d) => d > 5).length / Math.max(1, demo.borderAngles.length);
      if (!(angled > 0.7)) throw Error('异块主轴差 >5° 的比例过低 ' + angled.toFixed(2));
      return {
        cells: demo.cells, plots: demo.plots, borders: demo.borders,
        borderEdges: demo.borderAngles.length, medianDeg: +demo.stats.median.toFixed(1),
        over5deg: +angled.toFixed(2), colors: seen.size, inkRatio: +ratio.toFixed(3),
        meanPanelDiff: +meanDiff.toFixed(2), seamLeft: +seamLeft.toFixed(1), seamRight: +seamRight.toFixed(1), seamCells: demo.seam.cells, seed2Plots: second.plots,
      };
    });

    await p.screenshot({ path: 'artifacts/coverage/field-plots.png', fullPage: true });
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/field-plots-browser.json', JSON.stringify({ report, errors }, null, 2));
    console.log('PASS field-plots 画布/地块主轴', report);
    await p.close();
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
