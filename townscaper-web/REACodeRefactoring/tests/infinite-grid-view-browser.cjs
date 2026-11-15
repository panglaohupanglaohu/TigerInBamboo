// 1332410042784641026 · "The grid is made of Patches. Adjacent triplets form Clusters … Each Vert is a triangular interpolation"
// 验收：机制（块 + 簇各自松弛、块边界两侧表示一致）不变，且补齐片中的调试视图：点阵 + 单块高亮。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/grids.html');
    await p.waitForFunction(() => !!window.gridLab, null, { timeout: 30000 });

    const r = await p.evaluate(async () => {
      const cv = document.getElementById('c'), ctx = cv.getContext('2d');
      const grab = () => ctx.getImageData(0, 0, cv.width, cv.height).data;
      const countNear = (d, R, G, B, tol) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - R) <= tol && Math.abs(d[i + 1] - G) <= tol && Math.abs(d[i + 2] - B) <= tol) n++; return n; };
      const countDark = (d) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 30 && d[i + 1] < 32 && d[i + 2] < 38) n++; return n; };
      const click = (label) => { const bt = [...document.querySelectorAll('#sub button')].find((x) => x.textContent.startsWith(label)); if (!bt) throw new Error('no button ' + label); bt.click(); };

      window.gridLab.setTab('infinite');
      await new Promise((r) => setTimeout(r, 120));
      const review = window.gridLab.infiniteReview;
      const base = grab();
      const hlBase = countNear(base, 246, 242, 230, 4), darkBase = countDark(base);

      click('高亮');
      await new Promise((r) => setTimeout(r, 120));
      const withHl = grab();
      const hlOn = countNear(withHl, 246, 242, 230, 4);

      click('顶点圆点');
      await new Promise((r) => setTimeout(r, 120));
      const withDots = grab();
      const darkDots = countDark(withDots);
      const shot = document.getElementById('c').toDataURL('image/png').split(',')[1];
      return { review, hlBase, hlOn, darkBase, darkDots, shot, w: cv.width, h: cv.height };
    });

    fs.writeFileSync('artifacts/coverage/infinite-grid-1332410042784641026.png', Buffer.from(r.shot, 'base64'));

    // 机制没退步
    assert.ok(r.review, 'infiniteReview 应可读');
    assert.equal(r.review.patches, 19, `环 2 应是 19 块，实际 ${r.review.patches}`);
    assert.equal(r.review.clusters, 24, `19 块应组成 24 个簇，实际 ${r.review.clusters}`);
    assert.equal(r.review.report.flipped, 0, `不应有翻折格，实际 ${r.review.report.flipped}`);
    assert.ok(r.review.report.seam < 1e-9, `块边界两侧表示差应可忽略，实际 ${r.review.report.seam}`);

    // 视觉：高亮真的点亮一整块；点阵真的画出来了
    assert.ok(r.hlOn > r.hlBase + 3000, `高亮块应新增成片亮色像素：${r.hlBase} → ${r.hlOn}`);
    assert.ok(r.darkDots > r.darkBase + 800, `顶点圆点应新增大量深色像素：${r.darkBase} → ${r.darkDots}`);

    console.log(JSON.stringify({ patches: r.review.patches, clusters: r.review.clusters, flipped: r.review.report.flipped, seam: r.review.report.seam, maxStretch: r.review.report.maxStretch, hlBase: r.hlBase, hlOn: r.hlOn, darkBase: r.darkBase, darkDots: r.darkDots, canvas: [r.w, r.h] }, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS infinite-grid-view');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
