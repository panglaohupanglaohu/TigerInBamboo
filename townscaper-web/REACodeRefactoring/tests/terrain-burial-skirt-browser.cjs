// 1671840905957978113 的运行验收（第 106 轮）：崖面墙裙残留 + 檐下缺口联动。
// 判据来自页面内部计数 + 真画布像素（#7a705f 的墙裙带必须真的画出来）。
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:8769/terrain-stages.html');
    await page.waitForFunction(() => window.terrainStages?.ready, null, { polling: 50 });
    await page.waitForTimeout(400);

    const sk = await page.evaluate(() => window.terrainStages.skirt());
    const burial = await page.evaluate(() => window.terrainStages.burial());
    const snap = { sk, burial, errors };
    const fail = (m) => { throw new Error(m + ' :: ' + JSON.stringify(snap)); };

    // 1. 规则层：真的算出了墙裙面，且与檐下缺口一一对应
    if (!(sk.faces > 0)) fail('崖面上必须算出墙裙面');
    if (sk.bands !== sk.faces) fail('bands 必须等于 faces');
    if (sk.notches !== sk.bands) fail('墙裙面与檐下缺口必须一一对应（联动）');
    if (!sk.linked) fail('存在配不到缺口配对的墙裙面');
    if (!(sk.buriedCells >= 1)) fail('台账里必须有被埋过的格子');
    if (sk.depth <= 0 || sk.inset <= 0) fail('墙裙深度/内缩必须为正');
    if (!(sk.setback > sk.inset)) fail('檐口必须比墙裙挑得更深');

    // 2. 绘制层：画出来的面数必须等于规则算出的面数
    if (!sk.painted) fail('画布没留下 painted 计数');
    if (sk.painted.skirtFaces !== sk.bands) fail('画出的墙裙面数不等于算出的面数');
    if (sk.painted.eaveNotches !== sk.notches) fail('画出的缺口数不等于算出的缺口数');
    if (!(sk.painted.roofs >= 1)) fail('必须还有露头的屋顶');

    // 3. 像素层：墙裙带（#7a705f = 122,112,95）必须真的出现在画布上
    const pix = await page.evaluate(() => {
      const c = document.querySelector('#bury');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let skirt = 0, skirtRows = new Set(), shadow = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (Math.abs(r - 122) < 12 && Math.abs(g - 112) < 12 && Math.abs(b - 95) < 12) {
          skirt++; skirtRows.add(Math.floor((i / 4 / c.width) / 4));
        }
        // 檐下暗带：墙侧色 (232,196,106) 压 24% 黑 → ~(177,149,81)
        if (Math.abs(r - 177) < 9 && Math.abs(g - 149) < 9 && Math.abs(b - 81) < 9) shadow++;
      }
      return { skirt, shadow, rows: skirtRows.size, total: d.length / 4 };
    });
    snap.pix = pix;
    if (!(pix.skirt > 150)) fail('画布上墙裙色像素太少，等于没画：' + JSON.stringify(pix));
    if (!(pix.rows >= 3)) fail('墙裙必须出现在多条水平带里（几面崖壁都有）：' + JSON.stringify(pix));
    if (!(pix.shadow > 80)) fail('檐下缺口必须画出来（岩石被压暗）：' + JSON.stringify(pix));

    // 4. 掩埋本身不能因此退化
    if (!(burial.peeking >= 1)) fail('只露屋顶的柱子消失了：' + JSON.stringify(burial));
    if (!(burial.swallowedLevels >= 1)) fail('被吞的层数没了');

    await page.locator('#bury').screenshot({ path: 'artifacts/coverage/terrain-burial-skirt-r106.png' });
    await page.screenshot({ path: 'artifacts/coverage/terrain-burial-skirt-page-r106.png', fullPage: true });
    if (errors.length) fail('控制台有错误：' + errors.join(' | '));

    console.log('terrain-burial-skirt-browser PASS · 墙裙面 ' + sk.bands
      + ' · 檐下缺口 ' + sk.notches + ' · 画布墙裙像素 ' + pix.skirt
      + ' · 墙裙带行数 ' + pix.rows + ' · 檐影像素 ' + pix.shadow);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
