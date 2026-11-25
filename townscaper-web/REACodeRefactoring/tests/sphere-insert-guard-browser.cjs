// 第 118 轮 [052]：球极投影页的运行验收 —— 极点守卫（良态 / 最北点被重合点占住 两档）、投影往返、重三角化收敛。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
const URL = 'http://localhost:8769/sphere-insert.html';
const ink = (page) => page.evaluate(() => { // 画布非空：白像素占比 + 唯一灰度级
  const cv = document.getElementById('c'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let white = 0, n = 0; const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 7) { n++; if (d[i] > 200) white++; seen.add(d[i] >> 3); }
  return { whiteRatio: +(white / n).toFixed(4), levels: seen.size, w: cv.width, h: cv.height };
});
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 760 } }), errors = [], out = {};
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    // ① 良态球（点集自带的极点不含重合点）：守卫必须零影响
    await p.goto(URL + '?n=200&t=0.35');
    await p.waitForFunction(() => window.sphereInsert);
    const good = await p.evaluate(() => window.sphereInsert);
    assert.equal(good.total, 199, '参与投影 = n−1'); assert.equal(good.liftFaces, 2 * 200 - 4, 'F=2n−4=396');
    assert.equal(good.closed, true); assert.equal(good.euler, 2);
    assert.ok(good.roundTrip < 1e-9, '投影往返 ' + good.roundTrip);
    assert.equal(good.guard.merged, 0, '良态点集不合并'); assert.equal(good.guard.rotated, false, '良态点集不换极点');
    assert.ok(good.guard.minSin > 1e-3, 'minSin ' + good.guard.minSin);
    assert.ok(good.retri.slice(-3).reduce((s, x) => s + x, 0) <= 2, '重三角化收敛 ' + good.retri.join(','));
    const inkGood = await ink(p); assert.ok(inkGood.whiteRatio > 0.002 && inkGood.levels > 3, '画面非空 ' + JSON.stringify(inkGood));
    await p.screenshot({ path: 'artifacts/coverage/sphere-insert-guard-good.png' });
    // 拖动插入进度：k 必须真的在变（超级三角 → 逐点插入 → 满格）
    const ks = [];
    for (const t of [0, 0.1, 0.5, 1]) ks.push((await p.evaluate((x) => window.sphereInsert.setT(x).k, t)));
    assert.ok(ks[0] === 0 && ks[3] === 199 && ks[0] < ks[1] && ks[1] < ks[2] && ks[2] < ks[3], '插入进度 ' + ks.join('→'));
    out.good = { ...good, ink: inkGood, ks };

    // ② 最北点被重合点占住（?fat=1）：旧路径 RangeError，守卫下合并后仍闭合
    await p.goto(URL + '?n=200&t=1&fat=1');
    await p.waitForFunction(() => window.sphereInsert);
    const fat = await p.evaluate(() => window.sphereInsert);
    assert.equal(fat.guard.merged, 1, '重合点合并 1 个');
    assert.equal(fat.total, 198, '合并后参与三角化 = n−2');
    assert.equal(fat.liftFaces, 2 * 199 - 4, 'F=2·neff−4=394');
    assert.equal(fat.closedEff, true, '有效图仍闭合（边界边 0 / Euler 2）'); assert.equal(fat.orphan, 1, '孤点 = 被合并的那 1 个'); assert.equal(fat.euler, 2, 'Euler 仍 2（唯一孤点=被合并的那个）');
    assert.ok(fat.roundTrip < 1e-9, '合并后投影往返 ' + fat.roundTrip);
    assert.ok(fat.guard.maxR < 20 && Number.isFinite(fat.guard.bound), '超级三角 bound 有限 ' + fat.guard.bound.toFixed(1));
    const inkFat = await ink(p); assert.ok(inkFat.whiteRatio > 0.002, '画面非空 ' + JSON.stringify(inkFat));
    await p.screenshot({ path: 'artifacts/coverage/sphere-insert-guard-fat.png' });
    out.fat = { ...fat, ink: inkFat };

    assert.deepEqual(errors, [], 'console 无错误');
    fs.writeFileSync('artifacts/coverage/sphere-insert-guard-browser.json', JSON.stringify({ out, errors }, null, 2));
    console.log(JSON.stringify({ good: { closed: out.good.closed, roundTrip: out.good.roundTrip, merged: out.good.guard.merged, minSin: out.good.guard.minSin, ks: out.good.ks, ink: out.good.ink }, fat: { merged: out.fat.guard.merged, liftFaces: out.fat.liftFaces, euler: out.fat.euler, bound: +out.fat.guard.bound.toFixed(1), ink: out.fat.ink } }));
    console.log('PASS sphere-insert-guard-browser');
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
