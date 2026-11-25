// 第 192 轮 · 1246074663546916873「The props now animate when they appear and disappear.」
// 片内标定（33.0097 fps，306 帧）：出现一帧冲到稳定值的 1.372×、之后 4 帧回落；消失一帧塌掉、残影 3 帧。
// 这里在真实 Chrome + Canvas 里量：默认曲线档、出现峰值、消失帧数、槽位保留期、像素 A/B 与同状态噪声。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FRAME = 1 / 33.00970873786408;

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1100, height: 780 } });
  const errors = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const report = { problems: [] };
  const shot = async (name) => { fs.writeFileSync(path.join(out, name), await p.locator('#view').screenshot()); };
  const settle = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40)))));
  // 主画布是 WebGL（没有 2d 上下文）→ 用截图像素，在空白页里解码后逐像素比
  const h = await b.newPage();
  await h.goto('about:blank');
  const snap = async () => { await settle(); return p.locator('#view').screenshot(); };
  const diff = async (a, c) => h.evaluate(async ([a, c]) => {
    const load = (b64) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + b64; });
    const [ia, ic] = await Promise.all([load(a), load(c)]);
    const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, cv.width, cv.height).data;
    g.clearRect(0, 0, cv.width, cv.height); g.drawImage(ic, 0, 0); const dc = g.getImageData(0, 0, cv.width, cv.height).data;
    let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]) > 6) n++;
    return n;
  }, [a.toString('base64'), c.toString('base64')]);
  const setT = (t) => p.evaluate(async (t) => { window.__T = t; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40)))); }, t);
  const probe = () => p.evaluate(() => window.rea.yardAnim.probe());

  try {
    await p.goto('http://localhost:8769/index.html?scene=town&yardanim=1', { waitUntil: 'load' });
    await p.waitForFunction(() => window.rea && window.rea.yardAnim && window.rea.yardAnim.life, null, { timeout: 40000 });
    // 冻渲染（uTime 冻结）+ 冻道具时钟：之后唯一的变量是 World / 道具曲线
    await p.evaluate(() => {
      const v = rea.view, orig = v.render.bind(v); v.render = () => orig(0);
      window.__T = 100; rea.yardAnim.clock = () => window.__T;
      document.querySelector('#view').__p = true;
    });
    await setT(100);

    const p0 = await probe();
    report.curve = p0.curve; report.timing = p0.timing; report.outLife = p0.outLife;
    report.props = p0.props; report.live = p0.live; report.minScale = p0.minScale; report.maxScale = p0.maxScale;
    if (p0.curve !== 'clip') report.problems.push('默认曲线不是片内档：' + p0.curve);
    if (!(p0.props > 10)) report.problems.push('后院道具太少：' + p0.props);
    if (!(Math.abs(p0.maxScale - 1) < 1e-3 && Math.abs(p0.minScale - 1) < 1e-3)) report.problems.push(`静置缩放不是 1：${p0.minScale}..${p0.maxScale}`);
    const base = await snap(); await shot('propanim-clip-settled.png');
    const again = await snap();
    report.noise = await diff(base, again);
    if (report.noise !== 0) report.problems.push(`同状态噪声 ${report.noise}px`);

    // ---- 消失：抹掉一株树的格子 → 一帧塌到 0，槽位再留 3 帧后回收 ----
    const victim = await p.evaluate(() => {
      const L = rea.yardAnim, k = [...L.life.byKey.keys()].find((q) => /^tree:/.test(q)) ?? [...L.life.byKey.keys()][0];
      const e = L.life.byKey.get(k);
      const id = +k.split(':')[1]; window.__victim = { key: k, id, slot: L.life.slotOf(k) };
      window.__victimPos = { x: e.x, z: e.z };
      rea.world.fill(rea.world.cells[id], 0); rea.world.touch(); return window.__victim;
    });
    await setT(110);
    report.vanishAtStart = await p.evaluate((k) => window.rea.yardAnim.scaleOf(k), victim.key);
    await setT(110 + FRAME / 2);
    report.vanishMid = await p.evaluate((k) => window.rea.yardAnim.scaleOf(k), victim.key);
    await setT(110 + FRAME);
    report.vanishAfterFrame = await p.evaluate((k) => ({ s: window.rea.yardAnim.scaleOf(k), slot: window.rea.yardAnim.life.slotOf(k) }), victim.key);
    const gone = await snap(); await shot('propanim-clip-vanished.png');
    report.vanishPixels = await diff(base, gone);
    await setT(110 + 2 * FRAME);
    report.slotKept = await p.evaluate((k) => window.rea.yardAnim.life.slotOf(k), victim.key);
    await setT(110 + 3 * FRAME + 1e-4);
    report.slotAfterHold = await p.evaluate((k) => window.rea.yardAnim.life.slotOf(k), victim.key);

    if (!(report.vanishMid > .3 && report.vanishMid < 1)) report.problems.push('消失半帧读数不在收缩中：' + report.vanishMid);
    if (report.vanishAfterFrame.s !== 0) report.problems.push('一帧后没塌到 0：' + report.vanishAfterFrame.s);
    if (report.slotKept !== victim.slot) report.problems.push('残影期内槽位丢了');
    if (report.slotAfterHold !== -1) report.problems.push('0.091s 后槽位没回收');
    if (!(report.vanishPixels > 200)) report.problems.push('消失后画面没差：' + report.vanishPixels);

    // ---- 出现：把拆掉的格子补回去 → 同一 key 的树在原槽位重生，一帧后读到 1.372× ----
    // （镜头先压到那棵树上：系缆桩只有 0.05 宽，1.372× 在画面上补不到 30px，树才看得见）
    await p.evaluate(() => {
      const e = window.__victimPos;
      rea.view.target.set(e.x, .55, e.z); rea.view.distance = 4; if ('pitch' in rea.view) rea.view.pitch = .7; rea.view.updateCamera();
    });
    await setT(290); await settle();
    const before = await snap(); await shot('propanim-clip-focus-before.png');
    const back = await p.evaluate((v) => {
      const w = rea.world, c = w.cells[v.id];
      w.setSolid(c, 1, true); w.color[v.id] = 0; w.touch(); return v.id;
    }, victim);
    await setT(300);                        // 这一帧 refresh：重生的树 delay = 300 + stagger
    const born0 = await snap();
    await setT(300 + FRAME);                 // 一帧后：正在 1.372× 峰值
    const peak = await probe();
    const peakShot = await snap(); await shot('propanim-clip-appear.png');
    // 差异包围盒 → 裁一张放大图，1.372× 与稳态的差落在哪儿一目了然
    const bbox = async (a, c) => h.evaluate(async ([a, c]) => {
      const load = (b64) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + b64; });
      const [ia, ic] = await Promise.all([load(a), load(c)]);
      const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, cv.width, cv.height).data;
      g.clearRect(0, 0, cv.width, cv.height); g.drawImage(ic, 0, 0); const dc = g.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]) > 6) {
        n++; const x = (i / 4) % cv.width, y = Math.floor(i / 4 / cv.width);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return n ? { n, x0, y0, x1, y1 } : { n: 0 };
    }, [a.toString('base64'), c.toString('base64')]);
    const bb = await bbox(peakShot, peakShot);   // 自比恒 0，只为拿到尺寸占位
    report.bboxPeakVsSettled = await (async () => {
      await setT(300 + .6); await settle();
      const settledShot = await p.locator('#view').screenshot();
      const box = await bbox(peakShot, settledShot);
      if (box.n) {
        const pad = 40;
        const crop = { x: Math.max(0, box.x0 - pad), y: Math.max(0, box.y0 - pad), width: Math.min(420, box.x1 - box.x0 + 2 * pad), height: Math.min(420, box.y1 - box.y0 + 2 * pad) };
        fs.writeFileSync(path.join(out, 'propanim-clip-appear-zoom.png'), await p.screenshot({ clip: crop }));
        await setT(300 + .6); await settle();
        fs.writeFileSync(path.join(out, 'propanim-clip-settled-zoom.png'), await p.screenshot({ clip: crop }));
      }
      return { n: box.n, w: box.n ? box.x1 - box.x0 : 0, h: box.n ? box.y1 - box.y0 : 0 };
    })();
    report.zoomPixels = report.bboxPeakVsSettled.n;
    await setT(300 + FRAME); await settle();    await setT(300 + FRAME); await settle();
    report.bornPeak = { maxScale: peak.maxScale, appearing: peak.appearing, live: peak.live, restored: back };
    await setT(300 + .6);                    // 错峰 spread .35 + 收敛 .121 → 0.6s 时整批都该收在 1
    const settled2 = await probe();
    const settledShot = await snap(); await shot('propanim-clip-after.png');
    report.settledAfter = { maxScale: settled2.maxScale, appearing: settled2.appearing };
    report.appearPixels = await diff(peakShot, settledShot);
    report.bornPixels = await diff(before, settledShot);
    if (!(peak.maxScale > 1.36 && peak.maxScale < 1.38)) report.problems.push('出现峰值不是 1.372×：' + peak.maxScale);
    if (!(report.appearPixels > 30)) report.problems.push('峰值与稳态画面没差：' + report.appearPixels);
    if (!(report.bornPixels > 30)) report.problems.push('重生前后画面没差：' + report.bornPixels);
    if (!(settled2.maxScale < 1.001)) report.problems.push('0.6s 后没收到 1：' + settled2.maxScale);
    if (settled2.appearing !== 0) report.problems.push('0.6s 后还有在长：' + settled2.appearing);

    report.errors = errors.slice(0, 6);
    if (errors.length) report.problems.push('控制台错误 ' + errors.length);
  } catch (e) {
    report.problems.push('异常：' + e.message.split('\n')[0]);
  }
  await b.close();
  report.ok = report.problems.length === 0;
  console.log(JSON.stringify(report, null, 1).slice(0, 4000));
  process.exit(report.ok ? 0 : 1);
})();
