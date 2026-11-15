// 1654401054828638214 / 1670064751181791233 / 1671840905957978113 的运行时验收：
// 分阶段慢放 + 真 World 掩埋。判据来自真实画布像素与页面内部计数。
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
    const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://127.0.0.1:8769/terrain-stages.html');
    await page.waitForFunction(() => window.terrainStages?.ready, null, { polling: 50 });
    await page.waitForTimeout(300);

    const stats = page.evaluate(() => window.terrainStages.stats());
    const snap = { stats: await stats, errors };
    const fail = (msg) => { throw new Error(msg + ' :: ' + JSON.stringify(snap)); };

    // 1. 网格本身是真的：Delaunay 零违例、边数够、面积像圆盘
    const s = await stats;
    if (!(s.tris > 150)) fail('三角形太少：' + s.tris);
    if (s.violations !== 0) fail('Delaunay 有违例');
    if (s.nonManifold !== 0) fail('非流形边');
    if (!(s.boundaryEdges > 8)) fail('圆盘必须有边界边');
    if (!(s.area > 200 && s.area < 340)) fail('面积不像是半径 10 的圆盘：' + s.area);

    // 2. 慢放：真实 dt 再大，一个 tick 只推 budget
    const t1 = await page.evaluate(() => window.terrainStages.tick(1000));
    if (t1.elapsed !== 16) fail('budget=16 时 tick(1000) 只能推进 16ms，实际 ' + t1.elapsed);
    if (t1.stage !== 'seed') fail('16ms 还在 seed 段');
    const t2 = await page.evaluate(() => window.terrainStages.tick(1000));
    if (t2.elapsed !== 32) fail('第二个 tick 应该到 32ms');

    // 3. 阶段推进：seek 到各段，主画布必须画出对应的东西
    const inkOf = (sel) => page.evaluate((q) => {
      const c = document.querySelector(q);
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0, yellow = 0, green = 0, sand = 0, grey = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r + gg + b > 120 && !(r > 246 && gg > 243 && b > 232)) ink++;
        if (r > 170 && gg > 150 && b < 110) yellow++;
        if (gg > r + 8 && gg > b + 20 && gg > 110) green++;
        if (r > 185 && gg > 165 && b > 130 && b < 205 && r > b + 20) sand++;
        if (Math.abs(r - gg) < 14 && Math.abs(gg - b) < 16 && r > 140 && r < 215) grey++;
      }
      return { total: d.length / 4, ink, yellow, green, sand, grey };
    }, sel);

    const seen = {};
    for (const stage of ['seed', 'triangulate', 'lift', 'clay', 'color']) {
      await page.evaluate((st) => window.terrainStages.seek(st), stage);
      await page.waitForTimeout(80);
      seen[stage] = await inkOf('#stage');
    }
    snap.seen = seen;
    if (seen.triangulate.yellow < 400) fail('三角化阶段必须画出一片黄绿线框：' + JSON.stringify(seen.triangulate));
    if (!(seen.clay.grey > seen.triangulate.grey * 2)) fail('灰模阶段必须比线框阶段多出大量灰面：' + JSON.stringify({ clay: seen.clay, tri: seen.triangulate }));
    if (!(seen.color.green > 1500)) fail('上色阶段必须有草绿：' + JSON.stringify(seen.color));
    if (!(seen.color.sand > 800)) fail('上色阶段必须有沙色：' + JSON.stringify(seen.color));
    if (!(seen.color.ink > seen.triangulate.ink)) fail('上色的面积必须比线框大');
    if (!(seen.lift.green < 600 && seen.color.green > 1500)) fail('抬起来阶段不该有草绿、上色阶段必须有：' + JSON.stringify({ lift: seen.lift.green, color: seen.color.green }));

    // 4. 四张缩略图必须互不相同（分阶段真的分开了）
    const thumbs = {};
    for (const st of ['triangulate', 'lift', 'clay', 'color']) thumbs[st] = await inkOf('#thumb-' + st);
    snap.thumbs = thumbs;
    if (!(thumbs.color.green > 400)) fail('缩略图上色必须有草绿：' + JSON.stringify(thumbs.color));
    if (!(thumbs.clay.grey > 400)) fail('缩略图灰模必须有灰面：' + JSON.stringify(thumbs.clay));
    if (!(thumbs.triangulate.ink < thumbs.color.ink)) fail('线框缩略图不该比上色缩略图更满');
    if (!(thumbs.lift.green < 300 && thumbs.color.green > 400)) fail('抬起来/上色两张缩略图必须真的分开：' + JSON.stringify({ lift: thumbs.lift.green, color: thumbs.color.green }));

    // 5. 掩埋：真 World 里必须有"只露屋顶"的柱子
    const burial = await page.evaluate(() => window.terrainStages.burial());
    snap.burial = burial;
    if (!(burial.peeking >= 1)) fail('必须至少有一座只露屋顶的房子：' + JSON.stringify(burial));
    if (!(burial.swallowedLevels >= 1)) fail('必须有被吞掉的楼层');
    if (burial.ceiling !== 4) fail('最高地面应该是 4 层：' + burial.ceiling);
    const buryPix = await page.evaluate(() => {
      const c = document.querySelector('#bury');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let built = 0, rock = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (r > 220 && gg > 185 && b < 140) built++;
        if (r > 180 && r < 225 && gg > 170 && b > 150 && b < 200) rock++;
      }
      return { built, rock };
    });
    snap.buryPix = buryPix;
    if (!(buryPix.built > 800)) fail('掩埋画布必须画出露头的屋顶：' + JSON.stringify(buryPix));
    if (!(buryPix.rock > 2000)) fail('掩埋画布必须画出抬起来的台地：' + JSON.stringify(buryPix));

    await page.locator('#stage').screenshot({ path: 'artifacts/coverage/terrain-stages-stage.png' });
    await page.locator('#bury').screenshot({ path: 'artifacts/coverage/terrain-stages-bury.png' });
    await page.screenshot({ path: 'artifacts/coverage/terrain-stages-page.png', fullPage: true });

    // 6. 换岛：拓扑与画面都要变
    const before = await page.evaluate(() => window.terrainStages.stats());
    const after = await page.evaluate(() => window.terrainStages.reroll(4242));
    await page.waitForTimeout(150);
    if (after.tris === before.tris && after.area === before.area) fail('换种子后网格应当变化');
    const colorAfter = await (async () => { await page.evaluate(() => window.terrainStages.seek('color')); return inkOf('#stage'); })();
    if (Math.abs(colorAfter.ink - seen.color.ink) < 300) fail('换种子后画面几乎没变：' + JSON.stringify({ before: seen.color.ink, after: colorAfter.ink }));

    if (errors.length) fail('控制台有错误：' + errors.join(' | '));
    console.log('terrain-stages-browser PASS · tris ' + s.tris + ' · 掩埋 peeking ' + burial.peeking
      + ' · 屋顶像素 ' + buryPix.built + ' · 台地像素 ' + buryPix.rock);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
