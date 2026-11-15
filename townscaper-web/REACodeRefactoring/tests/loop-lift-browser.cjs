// loop-lift-browser.cjs — 1313837640366596096
// "You can now build flying towns (if you find any of the perfect loops I've scattered across the grid)"
// 片子：整块城镇离开水面悬空，底面亮黄船壳，几根极细的腿直落到水面（腿脚一圈涟漪）。转台，岛不建不拆。
// 验收：页面用真实网格跑 findLoops → liftField → supportLegs，三档 peak / 两档 leg spacing 必须在画布上真的变：
//       抬升档越高，岛体像素的竖向跨度越大；腿距变小，画布上深色腿像素数量变多；环内格数与平面着色一致。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  });
  const p = await browser.newPage({ viewport: { width: 1160, height: 760 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await p.goto('http://127.0.0.1:8769/loop-lift.html');
    await p.waitForFunction(() => window.loopLiftReview?.stats?.cells > 0, { timeout: 30000 });
    const base = await p.evaluate(() => window.loopLiftReview);
    assert.ok(base.loops >= 3, `完美环数量不合理：${base.loops}`);
    assert.ok(base.stats.cells >= 20, `环内格太少：${base.stats.cells}`);
    assert.ok(base.stats.legs >= 3, `腿太少：${base.stats.legs}`);
    assert.ok(base.paint === base.stats.cells, '平面着色的格数应等于环内格数');
    assert.equal(base.stats.peak, 2.4, '默认抬升峰值应回传到页面');

    // 腿等弧长：相邻腿间距相对标准差应很小
    const gaps = base.legGaps;
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    assert.ok(sd / mean < 0.2, `腿间距离散度太大：${(sd / mean).toFixed(3)}`);

    // 量像素：船壳亮黄带 + 深色腿。分别取两档参数对比。
    const measure = async (peak, spacing) => {
      await p.evaluate(([pk, sp]) => {
        const pv = document.querySelector('#peak'), sv = document.querySelector('#spacing');
        pv.value = String(pk); sv.value = String(sp);
        pv.dispatchEvent(new Event('input')); sv.dispatchEvent(new Event('input'));
      }, [peak, spacing]);
      await p.waitForTimeout(120);
      return p.evaluate(() => {
        const cv = document.querySelector('#cv');
        const g = cv.getContext('2d');
        const { width: W, height: H } = cv;
        const d = g.getImageData(0, 0, W, H).data;
        let hull = 0, dark = 0, island = 0, minY = 1e9, maxY = -1;
        // 只量右半幅（侧视剖面），左半幅是平面图，竖向跨度跟 peak 无关
        const x0 = Math.round(W * 0.55);
        for (let y = 0; y < H; y++) for (let x = x0; x < W; x++) {
          const i = (y * W + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
          // 船壳/岛体暖色（R 明显大于 B）
          if (r > 120 && r - b > 45 && gg > 60) { island++; if (y < minY) minY = y; if (y > maxY) maxY = y; }
          // 亮黄船壳带
          if (r > 180 && gg > 150 && b < 110) hull++;
          // 深色腿（近 #2b3f47）
          if (r < 80 && gg < 90 && b > 50 && b < 110 && Math.abs(gg - b) < 30) dark++;
        }
        return { hull, dark, island, span: maxY - minY, stats: window.loopLiftReview.stats };
      });
    };

    const low = await measure(1.0, 1.1);
    const high = await measure(3.6, 1.1);
    const dense = await measure(3.6, 0.7);
    assert.ok(low.stats.peak === 1 && high.stats.peak === 3.6, 'peak 应透传到 stats');
    assert.ok(high.span > low.span * 1.15, `抬得更高，岛体竖向跨度应变大：${low.span} → ${high.span}`);
    assert.ok(high.hull > 200, `船壳亮黄带没画出来：${high.hull}`);
    assert.ok(dense.dark > high.dark * 1.1, `腿变密应多出腿像素：${high.dark} → ${dense.dark}`);

    await p.evaluate(() => { const pv = document.querySelector('#peak'); pv.value = '2.4'; pv.dispatchEvent(new Event('input')); });
    await p.waitForTimeout(150);
    fs.mkdirSync('artifacts/coverage', { recursive: true });
    await p.locator('#cv').screenshot({ path: 'artifacts/coverage/1313837640366596096-loop-lift.png' });
    assert.deepEqual(errors, [], '页面不应有 console/page 错误');
    console.log('PASS 飞岛页：', JSON.stringify({ loops: base.loops, cells: base.stats.cells, legs: base.stats.legs, area: base.stats.area,
      spanLow: low.span, spanHigh: high.span, hull: high.hull, darkHigh: high.dark, darkDense: dense.dark }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
