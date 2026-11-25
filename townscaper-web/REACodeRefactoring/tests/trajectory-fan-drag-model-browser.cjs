const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 816332161036984320 · 二次阻力档的页面运行验收：
// 同一起点/速度/阻力下切两档模型，扇面、查找表 solved 数与画布像素都必须真的变；
// 同一档重绘必须逐像素不变（噪声 0），否则读到的差异是抖动不是模型。
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const shot = (name) => p.screenshot({ path: path.join(out, name) });
  const canvasStats = () => p.evaluate(() => {
    const cv = document.querySelector('#fan');
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let teal = 0, white = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], bl = d[i + 2];
      if (g > 170 && bl > 160 && g - r > 45) teal++;
      if (r > 235 && g > 245 && bl > 240) white++;
      sum += r + g + bl;
    }
    return { teal, white, sum };
  });

  try {
    await p.goto('http://localhost:8769/trajectory-fan.html');
    await p.waitForFunction(() => window.fanPage && window.fanPage.stats());
    const lin = await p.evaluate(() => window.fanPage.stats());
    if (lin.model !== 'linear') throw Error('默认档应为线性：' + lin.model);
    if (lin.grid?.model !== 'linear') throw Error('查找表未吃到模型档：' + JSON.stringify(lin.grid));
    const linPx = await canvasStats();
    await shot('trajectory-fan-model-linear-r190.png');

    // 同一档重绘：像素必须逐位不变
    await p.evaluate(() => window.fanPage.redraw());
    const linPx2 = await canvasStats();
    if (linPx2.teal !== linPx.teal || linPx2.white !== linPx.white || linPx2.sum !== linPx.sum) {
      throw Error('同一档重绘噪声不为 0：' + JSON.stringify([linPx, linPx2]));
    }

    await p.evaluate(() => window.fanPage.setModel('quadratic'));
    await p.waitForFunction(() => window.fanPage.stats().model === 'quadratic', null, { timeout: 20000 });
    const quad = await p.evaluate(() => window.fanPage.stats());
    const quadPx = await canvasStats();
    await shot('trajectory-fan-model-quadratic-r190.png');

    const checks = [];
    const ok = (name, cond, detail) => {
      checks.push({ name, ok: !!cond, detail });
      if (!cond) throw Error(`${name} :: ${JSON.stringify(detail)}`);
    };
    ok('quad 档被页面采纳', quad.model === 'quadratic' && quad.grid?.model === 'quadratic', { model: quad.model, grid: quad.grid?.model });
    ok('quad 射程更短', quad.maxRange < lin.maxRange * 0.9, { quad: quad.maxRange, lin: lin.maxRange });
    ok('quad 有射程上界且有限', Number.isFinite(quad.reach) && quad.reach > 0, { reach: quad.reach });
    ok('linear 无射程上界', lin.reach === null, { reach: lin.reach });
    ok('quad 够不着的格点更多', quad.grid.unreachable > lin.grid.unreachable, { quad: quad.grid.unreachable, lin: lin.grid.unreachable });
    ok('quad 划线更少', quad.tickCount < lin.tickCount, { quad: quad.tickCount, lin: lin.tickCount });
    ok('画布青点真的少了', quadPx.teal < linPx.teal * 0.95, { quad: quadPx.teal, lin: linPx.teal });
    ok('画布白划线真的变了', Math.abs(quadPx.white - linPx.white) > linPx.white * 0.02, { quad: quadPx.white, lin: linPx.white });

    // URL 档：?model=quadratic 一进来就是二次阻力
    await p.goto('http://localhost:8769/trajectory-fan.html?model=quadratic');
    await p.waitForFunction(() => window.fanPage && window.fanPage.stats());
    const viaUrl = await p.evaluate(() => window.fanPage.stats());
    ok('?model=quadratic 生效', viaUrl.model === 'quadratic' && viaUrl.grid?.model === 'quadratic', viaUrl.model);

    // 回到线性档：像素必须回位（同一档两次读数差 0）
    await p.evaluate(() => window.fanPage.setModel('linear'));
    const backPx = await canvasStats();
    ok('切回线性像素回位', backPx.teal === linPx.teal && backPx.white === linPx.white, { back: backPx, lin: linPx });

    if (errors.length) throw Error('页面报错：' + errors.join(' | '));
    const report = { lin, quad, linPx, quadPx, backPx, checks };
    console.log('trajectory-fan-drag-model-browser PASS', JSON.stringify({ checks: checks.length, lin: { maxRange: lin.maxRange, solved: lin.grid.solved, teal: linPx.teal }, quad: { maxRange: quad.maxRange, solved: quad.grid.solved, unreach: quad.grid.unreachable, teal: quadPx.teal } }));
    fs.writeFileSync(path.join(out, 'trajectory-fan-drag-model-browser.json'), JSON.stringify(report, null, 2));
  } finally {
    await b.close();
  }
})();
