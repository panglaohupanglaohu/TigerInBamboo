// 1459169210752507904 / 1490068909042642944 运行时验收：线框按面型着色 + 极坐标邻接图。
// 判据来自真实画布像素与页面内部计数——两侧画布都必须真的画出东西，
// 三角带必须存在且长，邻接图的环/分支/跨环边都要算出来，换种子后画面真的变。
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

    await page.goto('http://127.0.0.1:8769/grid-graph.html');
    await page.waitForFunction(() => window.gridGraph?.ready, null, { polling: 50 });
    await page.waitForTimeout(400);

    const stats = await page.evaluate(() => window.gridGraph.stats());
    const config = await page.evaluate(() => window.gridGraph.config());
    const snapshot = { config, stats, errors };
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify(snapshot)); };

    // 1. 线框侧：四边格为主、三角残余存在、每条边归类唯一、流形
    if (!(stats.quads > stats.tris)) fail('四边格必须多于三角格');
    if (stats.tris < 20) fail('合并率 0.85 时三角格不该这么少');
    const sum = stats.counts.quad + stats.counts.tri + stats.counts.seam + stats.counts.rim + stats.counts.other;
    if (sum !== stats.edges) fail('四类边之和必须等于边总数');
    if (!stats.manifold) fail('网格必须流形');
    if (!(stats.bands > 0)) fail('必须能串出三角带');
    if (!(stats.bandLongest >= 8)) fail('最长三角带必须是横穿整片的长条');
    if (stats.bandEdges !== stats.counts.seam) fail('三角带必须覆盖全部 seam 边');

    // 2. 邻接图侧：环数、分支、跨环边都要有
    if (!(stats.nodes > 100)) fail('邻接图节点数太少');
    if (!(stats.rings >= 4)) fail('同心环太少');
    if (!(stats.branches >= 2)) fail('至少要分两个根分支');
    if (!(stats.edgeKinds.adjacent > 0)) fail('必须有跨环边');
    if (!(stats.edgeKinds.long === 0)) fail('面邻接图不该出现跳环边');
    if (stats.components !== 1) fail('这座岛应当是单连通分量');

    // 3. 画布像素：不是空白，也不是一片纯色
    const inkOf = (sel) => page.evaluate((s) => {
      const c = document.querySelector(s);
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0, orange = 0, cyan = 0, bright = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r + gg + b > 90) ink++;
        if (r > 150 && gg > 80 && gg < 190 && b < 120) orange++;
        if (gg > 140 && b > 140 && r < 130) cyan++;
        if (r > 200 && gg > 200 && b > 200) bright++;
      }
      return { total: d.length / 4, ink, orange, cyan, bright };
    }, sel);

    const wirePix = await inkOf('#wire');
    const radialPix = await inkOf('#radial');
    if (wirePix.ink < 4000) fail('线框画布几乎是空的：' + JSON.stringify(wirePix));
    if (wirePix.orange < 800) fail('线框没画出橙色四边格边：' + JSON.stringify(wirePix));
    if (wirePix.cyan < 300) fail('线框没画出青色三角边：' + JSON.stringify(wirePix));
    if (radialPix.ink < 4000) fail('邻接图画布几乎是空的：' + JSON.stringify(radialPix));

    await page.locator('#wire').screenshot({ path: 'artifacts/coverage/grid-graph-wire.png' });
    await page.locator('#radial').screenshot({ path: 'artifacts/coverage/grid-graph-radial.png' });
    await page.screenshot({ path: 'artifacts/coverage/grid-graph-page.png', fullPage: true });

    // 4. 换种子：拓扑与画面都要真的换一套（片子里每 40–60 帧重铺一次）
    const rerolled = await page.evaluate(() => window.gridGraph.reroll(4242));
    await page.waitForTimeout(300);
    if (rerolled.cells === stats.cells && rerolled.counts.seam === stats.counts.seam) {
      fail('换种子后格子与三角带应当变化');
    }
    const rerollPix = await inkOf('#wire');
    if (Math.abs(rerollPix.ink - wirePix.ink) < 200) fail('换种子后线框画面几乎没变：' + JSON.stringify({ before: wirePix.ink, after: rerollPix.ink }));
    await page.locator('#wire').screenshot({ path: 'artifacts/coverage/grid-graph-wire-seed4242.png' });

    // 5. 换根节点：根变了，环分布跟着变，但不能报错
    const reRooted = await page.evaluate(() => window.gridGraph.setRoot(window.gridGraph.stats().root + 25));
    if (reRooted.root === rerolled.root) fail('换根节点没有生效');
    if (!(reRooted.rings >= 3)) fail('换根后环数异常');

    if (errors.length) fail('页面报错：' + errors.join(' | '));
    fs.writeFileSync('artifacts/coverage/grid-graph-browser.json',
      JSON.stringify({ ...snapshot, wirePix, radialPix, rerolled, reRooted }, null, 2));
    console.log('PASS grid-graph page:', stats.cells, '格 /', stats.quads, '四边 +', stats.tris,
      '三角 / 三角带', stats.bands, '条（最长', stats.bandLongest, '段）/',
      stats.nodes, '节点', stats.rings, '环', stats.branches, '分支；线框墨迹', wirePix.ink, '→', rerollPix.ink);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
