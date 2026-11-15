/**
 * route-preview-browser.cjs — 移动路线预览画布验收（995043346778415104）
 *
 * 只看两件事：左栏「节点直连」确实把点串埋进崖体，右栏「落崖弧 + 圆角」一个点都不埋；
 * 两栏必须是同一组节点、同一间距（否则差异不是算法造成的）。
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
    const p = await b.newPage({ viewport: { width: 1080, height: 760 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto('http://127.0.0.1:8769/route-preview.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.routePreviewDemo?.ready === true, null, { polling: 100 });
    await p.waitForTimeout(1200);

    const s = await p.evaluate(() => {
      const d = window.routePreviewDemo;
      d.set({ radius: 0.35, spacing: 0.16 });
      const st = d.stats;
      return {
        buriedLeft: st.buriedLeft, buriedRight: st.buriedRight,
        arcs: st.arcs, hops: st.hops, corners: st.corners,
        nLeft: st.naive.length, nRight: st.fixed.length,
        lenLeft: st.lengthLeft, lenRight: st.lengthRight,
        // 两栏画布必须都真的画了东西
        ink: ['#left', '#right'].map((sel) => {
          const c = document.querySelector(sel), ctx = c.getContext('2d');
          const img = ctx.getImageData(0, 0, c.width, c.height).data;
          const seen = new Set(); let white = 0;
          for (let i = 0; i < img.length; i += 4) {
            seen.add((img[i] >> 4) + ',' + (img[i + 1] >> 4) + ',' + (img[i + 2] >> 4));
            if (img[i] > 228 && img[i + 1] > 228 && img[i + 2] > 228) white++;
          }
          return { colours: seen.size, white };
        }),
      };
    });

    if (s.buriedLeft < 20) throw Error('左栏本该有埋在崖体里的点，实际 ' + s.buriedLeft);
    if (s.buriedRight !== 0) throw Error('右栏不该有点埋进崖体，实际 ' + s.buriedRight);
    if (s.arcs !== 2 || s.hops !== 2) throw Error('落崖弧数不对 arcs=' + s.arcs + ' hops=' + s.hops);
    if (s.corners < 1) throw Error('应当有平地拐角被圆角，实际 ' + s.corners);
    if (s.nRight < s.nLeft) throw Error('改后点串反而变稀 ' + s.nRight + ' < ' + s.nLeft);
    if (!(s.lenRight > s.lenLeft)) throw Error('落崖弧应当让路径变长 ' + s.lenLeft + ' → ' + s.lenRight);
    for (const [i, k] of s.ink.entries()) {
      if (k.colours < 8) throw Error('第 ' + (i + 1) + ' 栏画布颜色过少 ' + k.colours);
      if (k.white < 100) throw Error('第 ' + (i + 1) + ' 栏白点太少 ' + k.white);
    }
    if (errors.length) throw Error('控制台报错：' + errors.join(' | '));

    const shot = 'artifacts/coverage/route-preview-995043346778415104.png';
    await p.screenshot({ path: shot, fullPage: true });
    console.log('PASS 左埋 ' + s.buriedLeft + ' 点 / 右埋 ' + s.buriedRight + ' 点，弧 ' + s.arcs + ' 圆角 ' + s.corners +
      '，点 ' + s.nLeft + '→' + s.nRight + '，长 ' + s.lenLeft.toFixed(2) + '→' + s.lenRight.toFixed(2) + '，截图 ' + shot);
    fs.writeFileSync('artifacts/coverage/route-preview-browser.log',
      `buriedLeft=${s.buriedLeft} buriedRight=${s.buriedRight} arcs=${s.arcs} hops=${s.hops} corners=${s.corners}\n` +
      `points ${s.nLeft} -> ${s.nRight}, length ${s.lenLeft.toFixed(3)} -> ${s.lenRight.toFixed(3)}\n`);
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });
