// 1459169210752507904「And another」补丁层验收（第 116 轮）。
// 片子里的着色不是"按面型"，是**按补丁**：同一块补丁的方格朝向完全一致、同片同色，补丁之间是品红缝，
// 三角格填绿。判据全部落在页面真实画布像素 + patchLayout 的计数上：
//   1. 四边格能干净地落进 0°/30°/60° 三族（生成期晶格只有这 3 个方向）；
//   2. 补丁划分覆盖每一个四边格、每块补丁同色、补丁缝 > 0；
//   3. 画布上真的有 >=3 种补丁色 + 品红缝 + 绿色三角格；
//   4. 逐格轴向抖动要如实报出来（本仓是逐格拟合正方格，抖动远大于原片的 0°）——
//      这是"补丁级刚性仍缺"的量化证据，本测试**不断言它小**，只断言它被量到。
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://127.0.0.1:8769/grid-graph.html?mode=patch');
    await page.waitForFunction(() => window.gridGraph?.ready, null, { polling: 50 });
    await page.waitForTimeout(400);

    const stats = await page.evaluate(() => window.gridGraph.stats());
    const snap = { stats, errors };
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify(snap)); };

    // 1. 三族齐全、四边格全部有归属
    if (stats.mode !== 'patch') fail('页面没有按补丁着色');
    if (stats.families.length !== 3) fail('四边格应当只落在 0/30/60 三族：' + JSON.stringify(stats.families));
    const famSum = stats.families.reduce((s, f) => s + f.cells, 0);
    if (famSum !== stats.quads) fail('每块四边格都必须落进一个族：' + famSum + ' != ' + stats.quads);
    for (const f of stats.families) if (!(f.cells > 50)) fail('某个族的格子太少：' + JSON.stringify(f));

    // 2. 补丁划分
    if (!(stats.patchCount > 0)) fail('必须切出补丁');
    if (!(stats.largestPatch > 5)) fail('最大补丁太小，补丁划分没意义：' + stats.largestPatch);
    if (!(stats.patchEdgeKinds.patchRim > 0)) fail('补丁之间必须有缝（patchRim 边）');
    const sideSum = stats.patchEdgeKinds.inner + stats.patchEdgeKinds.patchRim + stats.patchEdgeKinds.seam
      + stats.patchEdgeKinds.tri + stats.patchEdgeKinds.rim;
    if (sideSum !== stats.edges) fail('补丁层五类边之和必须等于边总数：' + sideSum + ' != ' + stats.edges);
    if (!(stats.maxSpreadDeg > 0)) fail('轴向抖动必须被量到（本仓逐格拟合，抖动不该是 0）');

    // 3. 画布像素分类
    const pix = await page.evaluate(() => {
      const c = document.querySelector('#wire');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0, tri = 0, magenta = 0, green = 0;
      const hues = new Set();
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r + gg + b > 90) ink++;
        if (r > 150 && b > 150 && gg < 140) magenta++;        // 品红补丁缝
        if (gg > 150 && r < 130 && b < 160) green++;          // 绿色三角格
        if (r > 150 && gg > 90 && gg < 190 && b < 110) tri++; // 橙色补丁
        if (r + gg + b > 150) hues.add(`${r >> 5}|${gg >> 5}|${b >> 5}`);
      }
      return { total: d.length / 4, ink, tri, magenta, green, hueBuckets: hues.size };
    });
    if (pix.ink < 4000) fail('线框画布几乎是空的：' + JSON.stringify(pix));
    if (pix.magenta < 300) fail('没画出品红补丁缝：' + JSON.stringify(pix));
    if (pix.green < 200) fail('没画出绿色三角格：' + JSON.stringify(pix));
    if (pix.hueBuckets < 3) fail('补丁色不够多，看着不像按补丁着色：' + JSON.stringify(pix));

    await page.locator('#wire').screenshot({ path: 'artifacts/coverage/grid-patch-families.png' });
    await page.screenshot({ path: 'artifacts/coverage/grid-patch-families-page.png', fullPage: true });

    // 4. 换种子：族数仍 3，补丁数跟着变（不是死数据）
    const rerolled = await page.evaluate(() => window.gridGraph.reroll(4242));
    await page.waitForTimeout(300);
    if (rerolled.families.length !== 3) fail('换种子后族数应当仍是 3');
    if (rerolled.patchCount === stats.patchCount && rerolled.largestPatch === stats.largestPatch) {
      fail('换种子后补丁划分应当变化');
    }
    const rerollPix = await page.evaluate(() => {
      const c = document.querySelector('#wire');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 90) ink++;
      return ink;
    });
    if (Math.abs(rerollPix - pix.ink) < 200) fail('换种子后画面几乎没变：' + pix.ink + ' → ' + rerollPix);

    // 5. 切回按面型：老口径不能破（同一张页面两种着色都要能画）
    const backToType = await page.evaluate(() => window.gridGraph.setMode('type'));
    if (backToType.mode !== 'type') fail('切回按面型失败');
    const typePix = await page.evaluate(() => {
      const c = document.querySelector('#wire');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let orange = 0, cyan = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r > 150 && gg > 80 && gg < 190 && b < 120) orange++;
        if (gg > 140 && b > 140 && r < 130) cyan++;
      }
      return { orange, cyan };
    });
    if (typePix.orange < 800 || typePix.cyan < 300) fail('按面型着色退化：' + JSON.stringify(typePix));

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    fs.writeFileSync('artifacts/coverage/grid-patch-families.json',
      JSON.stringify({ ...snap, pix, rerolled: { patchCount: rerolled.patchCount, largestPatch: rerolled.largestPatch, maxSpreadDeg: rerolled.maxSpreadDeg, families: rerolled.families }, rerollPix, typePix }, null, 2));
    console.log('PASS grid patch families:',
      stats.quads, '四边格 →', stats.families.map((f) => `${f.family}°:${f.cells}`).join(' '),
      '/ 补丁', stats.patchCount, '块（最大', stats.largestPatch, '格）',
      '/ 补丁缝', stats.patchEdgeKinds.patchRim, '边 / 轴向抖动 max', stats.maxSpreadDeg.toFixed(2), '°',
      '/ 画布 品红', pix.magenta, '绿三角', pix.green, '色桶', pix.hueBuckets,
      '/ 换种子补丁', rerolled.patchCount, '块');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
