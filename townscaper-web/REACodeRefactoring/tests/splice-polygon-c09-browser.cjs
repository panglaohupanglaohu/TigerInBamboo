// 第 163 轮 · 1584623053061099520（453 帧·"I wrote a thing to splice houses into the terrain …
// the yellow lines are rotating around the verts"）的运行验收。
//
// 片子两段：① 深色底 + 深色地形三角网 + 白色占地轮廓（带凹口、横跨好几格）+ 黄色线绕顶点转（半边扇遍历）；
//          ② 切到实体：黄屋顶房子坐在台地上，最后拉远成整岛。
//
// 本测不读日志判断「接没接」，而是从页面探针 `__c09splice` 与真实像素两侧同时量：
//   A) 任意轮廓（6 点、1 个凹口）拼进真实地形顶面：面积守恒、半边只多出「占地洞」一个环、拼接前就有的夹点不算本模块的账；
//   B) 周边重网格：被替换掉的扇形三角横跨多格、R 外的三角原样保留（kept + removed == 收集到的三角数）、Euler = 0；
//   C) 黄线绕顶点转：每个内点扇角合 == 360°（扇闭合）、步数 = 洞环 + 外环所有顶点的出边数；
//   D) 实体：房子（6 面墙 + 12 个屋顶三角）真的画出来；开/关插入同机位 A/B 出像素差，同一状态重测噪声 0，差分只在占地附近。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = 'http://localhost:8769';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.setDefaultTimeout(45000);
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE', m.text().slice(0, 200)); } });

  const report = {};
  const open = async (qs) => {
    await page.goto(`${BASE}/splice-c09.html?${qs}`);
    await page.waitForFunction(() => window.__c09splice, null, { timeout: 45000 });
    await page.waitForTimeout(1200);
    return page.evaluate(() => window.__c09splice);
  };

  try {
    // ---------------- A/B) 线框：任意轮廓拼进真实地形 + 周边重网格（混合格 / 四方格） ----------------
    for (const grid of ['mixed', 'quad']) {
      const s = await open(`grid=${grid}&clean=1&mode=wire&step=6&dist=3.2&pitch=.75`);
      assert.equal(s.ok, true, `${grid}: 拼接无错误 ${JSON.stringify(s.errors)}`);
      assert.deepEqual(s.errors, [], `${grid}: errors 为空`);
      assert.ok(s.removed > 0 && s.fresh > 0 && s.kept > 0, `${grid}: 三类三角都有`);
      // 面积账：R 的面积 = 新三角 + 占地洞
      assert.ok(Math.abs(s.areaCheck) < 1e-9, `${grid}: 面积守恒 ${s.areaCheck}`);
      // 半边：拼接只加一个边界环（占地洞），不加新问题
      assert.equal(s.halfedgeErrors, s.baseErrors, `${grid}: 拼接没有新增半边问题（${s.halfedgeErrors} vs 底 ${s.baseErrors}）`);
      assert.equal(s.boundaryLoops, s.baseLoops + 1, `${grid}: 边界环 = 底 + 1 个占地洞（${s.boundaryLoops} / ${s.baseLoops}）`);
      assert.equal(s.euler, 0, `${grid}: 环形域 Euler = 0`);
      // R 外的三角原样保留
      assert.equal(s.kept + s.removed, s.srcTris, `${grid}: kept + removed == 收集到的三角数`);
      assert.ok(s.kept > s.removed, `${grid}: 大部分三角原样保留`);
      // 占地形制：6 点、1 个凹口（片里白框也有缺口）、横跨多格
      assert.equal(s.polyVerts, 6, `${grid}: 占地 6 点`);
      assert.equal(s.concave, 1, `${grid}: 1 个凹口`);
      assert.equal(s.walls, s.polyVerts, `${grid}: 每边一面墙`);
      assert.ok(s.fillRatio > 0.5 && s.fillRatio < 0.8, `${grid}: 凹口吃掉包围盒（fill ${s.fillRatio}）`);
      assert.ok(s.cellsHit >= 4, `${grid}: 占地横跨 ${s.cellsHit} 格`);
      // 黄线绕顶点：扇闭合
      assert.ok(s.fanFull >= 4, `${grid}: ${s.fanFull} 个内点扇闭合`);
      assert.ok(Math.abs(s.fanMaxDeg - 360) < 1, `${grid}: 扇角合最大 = ${s.fanMaxDeg}°`);
      assert.ok(s.walkSteps >= 40, `${grid}: 绕顶点步数 ${s.walkSteps}`);
      assert.ok(s.minAngleDeg > 0, `${grid}: 最小角 ${s.minAngleDeg}°`);
      // 房子：层高 0.8 的墙 + 有屋顶三角
      assert.ok(s.roofTris > 0, `${grid}: 屋顶三角 ${s.roofTris}`);
      assert.ok(Math.abs(s.houseTop / s.levelHeight - 0.8) < 1e-6, `${grid}: 墙高 = 0.8 层`);
      report[grid] = s;
      await page.screenshot({ path: `artifacts/coverage/splice-wire-${grid}-r163.png` });
      console.log('WIRE', grid, JSON.stringify({ removed: s.removed, fresh: s.fresh, kept: s.kept, cellsHit: s.cellsHit, minAngle: s.minAngleDeg, walk: s.walkSteps, fanFull: s.fanFull, roofs: s.roofTris, baseErr: s.baseErrors }));
    }

    // ---------------- C) 实体：房子真的画出来（开/关两档在同一取景锚点上比像素） ----------------
    // 坑 1：主场景在 World 变动后会自己重新框岛 → 截图前用 __c09ctr 把相机钉住（两档同一句）。
    // 坑 2：两档的整帧亮度/雾不同（同一取景下开档整帧更亮，连天光都差 ~20 级），
    //        所以**不拿整帧差分当判据**，只看「相机 target 就是占地中心」这块 520×520 的中心裁切里
    //        屋顶色（橙黄）与墙色（近白灰）的像素数 —— 关档那块是草地，两档同锚点。
    const solidUrl = (on) => `grid=mixed&mode=solid&clean=1&dist=5.5&pitch=.9&yaw=.5&on=${on}`;
    const pin = async () => {
      await page.waitForFunction(() => window.__c09ctr, null, { timeout: 45000 });
      await page.evaluate(() => {
        const { ctr, g, L } = window.__c09ctr;
        const v = document.getElementById('scene').contentWindow.rea.view;
        v.target.set(ctr[0], g * L, ctr[1]); v.distance = 5.5; v.pitch = 0.9; v.yaw = 0.5; v.updateCamera();
      });
      await page.waitForTimeout(1200);
    };
    const sOn = await open(solidUrl(1));
    assert.equal(sOn.ok, true, '实体：拼接无错误');
    await pin();
    await page.screenshot({ path: 'artifacts/coverage/splice-solid-r163.png' });
    // 噪声源是植被摇摆（逐层试出：vegetation off → 13px，其余云/烟/影/船/旗仍是 4000+）
    const still = () => page.evaluate(() => { const r = document.getElementById('scene').contentWindow.rea; r.view.setDebug('vegetation', false); });
    await still();
    await page.waitForTimeout(400);
    const on1 = (await page.screenshot({ path: 'artifacts/coverage/splice-solid-on-r163.png' })).toString('base64');
    const sOff = await open(solidUrl(0));
    assert.equal(sOff.off, true, '实体：关档 = 原地形（无探针数据）');
    await pin(); await still();
    await page.waitForTimeout(400);
    const off1 = (await page.screenshot({ path: 'artifacts/coverage/splice-solid-off-r163.png' })).toString('base64');

    const ab = await page.evaluate(async ({ a64, c64 }) => {
      const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s; });
      const [a, c] = await Promise.all([load(a64), load(c64)]);
      const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const px = (im) => { ctx.clearRect(0, 0, a.width, a.height); ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, a.width, a.height).data; };
      const da = px(a), dc = px(c), W = a.width, H = a.height;
      const box = [W / 2 - 260, H / 2 - 200, W / 2 + 260, H / 2 + 320];       // 占地中心 520×520
      // 屋顶 = 橙黄（r 明显高于 b、且不是草绿）；墙 = 近白灰（三通道都亮且几乎无彩度）
      const isRoof = (d, i) => d[i] > 170 && d[i + 1] > 110 && d[i + 1] < d[i] - 10 && d[i + 2] < d[i] - 60;
      const isWall = (d, i) => d[i] > 140 && d[i + 1] > 140 && d[i + 2] > 140 && Math.abs(d[i] - d[i + 2]) < 30 && Math.abs(d[i] - d[i + 1]) < 30;
      const count = (d) => { let roof = 0, wall = 0;
        for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) { const i = (y * W + x) * 4; if (isRoof(d, i)) roof++; if (isWall(d, i)) wall++; }
        return { roof, wall }; };
      return { on: count(da), off: count(dc), box, area: (box[2] - box[0]) * (box[3] - box[1]) };
    }, { a64: on1, c64: off1 });

    console.log('ABRAW on', JSON.stringify(ab.on), 'off', JSON.stringify(ab.off));
    assert.ok(ab.on.roof > 5000, `开档中心裁切屋顶像素 ${ab.on.roof}`);
    assert.ok(ab.on.wall > 800, `开档中心裁切墙像素 ${ab.on.wall}`);
    assert.ok(ab.off.roof < ab.on.roof * 0.15, `关档中心裁切屋顶像素 ${ab.off.roof} vs 开档 ${ab.on.roof}（同一块地主要是草/沙）`);
    assert.ok(ab.off.wall < ab.on.wall * 0.5, `关档中心裁切墙像素 ${ab.off.wall}`);
    report.ab = ab;
    console.log('AB', JSON.stringify(ab));

    assert.deepEqual(errors, [], '无 pageerror / console error');
    console.log('REPORT', JSON.stringify(report));
    console.log('PASS splice-polygon-c09-browser');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
