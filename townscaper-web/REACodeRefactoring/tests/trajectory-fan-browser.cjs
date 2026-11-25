const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 816332161036984320：Unity「Trajectory Calculator」——同一 Speed/Drag 下一整排角度的弹道扇面，
// 每条弧上等弧长插白色方向划线，拖 Drag 时整片收缩。这里验页面真的在按阻力改扇面（不是只改数字）。
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const reports = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/trajectory-fan.html');
    await p.waitForFunction(() => window.fanPage && window.fanPage.stats());
    const base = await p.evaluate(() => window.fanPage.stats());
    if (base.arcs < 20) throw Error('角度条数不对：' + base.arcs);
    if (!(base.tickCount > 50)) throw Error('划线太少：' + base.tickCount);

    // 片中两个 Drag 读数：0.83 → 1.26，扇面必须整体收缩
    for (const drag of [0, 0.83, 1.26, 2]) {
      await p.evaluate((d) => window.fanPage.setDrag(d), drag);
      await p.waitForTimeout(80);
      const s = await p.evaluate(() => window.fanPage.stats());
      reports.push({ drag, ...s });
      await p.screenshot({ path: path.join(out, `trajectory-fan-drag-${String(drag).replace('.', '')}.png`) });
    }
    for (let i = 1; i < reports.length; i++) {
      if (!(reports[i].maxRange < reports[i - 1].maxRange)) {
        throw Error('阻力变大射程没有变短：' + JSON.stringify(reports));
      }
    }
    // drag=0 时射程应对得上「从 0 打到页面地面高度」的解析解：
    // 平地上是 v²sin2θ/g（45° 最大）；页面地面画在画布下沿（groundY<0），落点还多一段下落，
    // 最大射程 = (v/g)·√(v²+2g|groundY|)（发射角 <45°）。旧断言按平地 45° 解析射程比，口径错。
    const zero = reports[0];
    const drop = Math.abs(zero.groundY || 0);
    const v = zero.speed;
    const expected = (v / zero.gravity) * Math.sqrt(v * v + 2 * zero.gravity * drop);
    if (Math.abs(zero.maxRange - expected) > expected * 0.005) {
      throw Error(`drag=0 射程与「落到页面地面」的解析解不符：${zero.maxRange} vs ${expected.toFixed(4)}（groundY ${zero.groundY}）`);
    }
    // 片中 0.83 的扇面比无阻力小很多
    if (!(reports[1].maxRange < zero.maxRange * 0.85)) throw Error('0.83 阻力下扇面应明显收缩');

    // Speed 提高 → 扇面变大（划线数随弧长增长）
    await p.evaluate(() => { window.fanPage.setDrag(0.83); window.fanPage.setSpeed(10); });
    await p.waitForTimeout(80);
    const fast = await p.evaluate(() => window.fanPage.stats());
    if (!(fast.maxRange > reports[1].maxRange)) throw Error('提高初速射程应变远');
    if (!(fast.tickCount > reports[1].tickCount)) throw Error('弧变长后划线应更多');

    // 画布上确实有青点与白划线
    await p.evaluate(() => { window.fanPage.setSpeed(7.61); window.fanPage.setDrag(0.83); });
    await p.waitForTimeout(100);
    const canvas = await p.evaluate(() => {
      const cv = document.querySelector('#fan');
      const ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let teal = 0, white = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (g > 170 && b > 160 && g - r > 45) teal++;
        if (r > 235 && g > 245 && b > 240) white++;
      }
      return { teal, white };
    });
    if (canvas.teal < 3000) throw Error('青点弧线像素太少：' + canvas.teal);
    if (canvas.white < 500) throw Error('白色方向划线像素太少：' + canvas.white);
    await p.screenshot({ path: path.join(out, 'trajectory-fan-page.png') });

    if (errors.length) throw Error('页面报错：' + errors.join(' | '));
    console.log('trajectory-fan-browser PASS', JSON.stringify({ reports, fast, canvas }));
    fs.writeFileSync(path.join(out, 'trajectory-fan-browser.json'), JSON.stringify({ reports, fast, canvas }, null, 2));
  } finally {
    await b.close();
  }
})();
