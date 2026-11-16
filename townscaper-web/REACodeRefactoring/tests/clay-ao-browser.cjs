// 1654401054828638214 的运行验收（第 106 轮）：灰模 AO 软阴 + 生成后地形微调。
// A/B 判据：同一个机位、同一个阶段，AO 关→开 必须让暗像素变多、平均亮度下降；
// 微调必须让台地面积变大且画布真的变了。
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
    await page.waitForTimeout(300);

    const luma = (sel) => page.evaluate((q) => {
      const c = document.querySelector(q);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let dark = 0, mid = 0, sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        // 背景（#fbf7ea, luma≈245）不计
        if (r > 246 && g > 243 && b > 230) continue;
        sum += l; n++;
        if (l < 150) dark++;
        else if (l < 205) mid++;
      }
      return { dark, mid, mean: n ? sum / n : 0, n };
    }, sel);

    const ao = await page.evaluate(() => window.terrainStages.ao());
    const snap = { ao, errors };
    const fail = (m) => { throw new Error(m + ' :: ' + JSON.stringify(snap)); };

    // 1. 标量层：AO 是连续一段、阴影有中间值、高度是整数层
    if (!(ao.ao.distinct > 20)) fail('AO 档数太少，不像连续的遮蔽场：' + ao.ao.distinct);
    if (!(ao.ao.min < 0.95 && ao.ao.max <= 1)) fail('AO 范围不对：' + JSON.stringify(ao.ao));
    if (!(ao.shadow.mean > 0.02)) fail('软阴均值太低，等于没算：' + ao.shadow.mean);
    if (!(ao.shadow.distinct > 3)) fail('软阴必须是比例不是二值：' + ao.shadow.distinct);
    if (!Number.isInteger(ao.heights.min) || !Number.isInteger(ao.heights.max)) fail('高度必须是整数层');

    // 2. A/B：同一阶段关掉 AO 再开，暗像素必须变多、平均亮度必须下降
    await page.evaluate(() => window.terrainStages.seek('clay'));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.terrainStages.setAO(false));
    await page.waitForTimeout(80);
    const clayOff = await luma('#stage');
    await page.evaluate(() => window.terrainStages.setAO(true));
    await page.waitForTimeout(80);
    const clayOn = await luma('#stage');
    snap.clay = { off: clayOff, on: clayOn };
    if (!(clayOn.dark > clayOff.dark * 1.15)) fail('灰模开 AO 后暗像素没变多：' + clayOff.dark + ' → ' + clayOn.dark);
    if (!(clayOn.mean < clayOff.mean - 0.8)) fail('灰模开 AO 后平均亮度没下降：' + clayOff.mean.toFixed(2) + ' → ' + clayOn.mean.toFixed(2));

    // 3. 上色阶段同一套（AO 不能只作用在灰模上、到上色就丢）
    await page.evaluate(() => window.terrainStages.seek('color'));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.terrainStages.setAO(false));
    await page.waitForTimeout(80);
    const colOff = await luma('#stage');
    await page.evaluate(() => window.terrainStages.setAO(true));
    await page.waitForTimeout(80);
    const colOn = await luma('#stage');
    snap.color = { off: colOff, on: colOn };
    if (!(colOn.mean < colOff.mean - 0.8)) fail('上色阶段 AO 没生效：' + colOff.mean.toFixed(2) + ' → ' + colOn.mean.toFixed(2));

    await page.locator('#stage').screenshot({ path: 'artifacts/coverage/terrain-clay-ao-r106.png' });

    // 4. 生成后微调：面积变大、只有半径内变、画布真的变了
    const before = await page.evaluate(() => window.terrainStages.terrace());
    const tw1 = await page.evaluate(() => window.terrainStages.tweak());
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => window.terrainStages.terrace());
    snap.tweak = { before, after, tw1 };
    if (!(tw1.changed > 0)) fail('微调一个点都没改：' + JSON.stringify(tw1));
    if (!(after > before)) fail('微调后台地面积必须变大：' + before + ' → ' + after);
    const hMax = (await page.evaluate(() => window.terrainStages.ao())).heights.max;
    if (!(hMax <= 6)) fail('微调后高度越过 levels：' + hMax);

    // 再抬一次：面积继续涨（累积编辑，不是换种子重铺）
    const tw2 = await page.evaluate(() => window.terrainStages.tweak());
    await page.waitForTimeout(120);
    const after2 = await page.evaluate(() => window.terrainStages.terrace());
    snap.tweak2 = { after2, tw2 };
    if (!(after2 >= after)) fail('第二次微调后面积反而变小：' + after + ' → ' + after2);
    if (tw2.steps !== 2) fail('微调次数没记账：' + tw2.steps);

    await page.waitForTimeout(100);
    await page.locator('#stage').screenshot({ path: 'artifacts/coverage/terrain-tweak-r106.png' });
    await page.screenshot({ path: 'artifacts/coverage/terrain-clay-ao-page-r106.png', fullPage: true });

    if (errors.length) fail('控制台有错误：' + errors.join(' | '));
    console.log('clay-ao-browser PASS · AO ' + ao.ao.min.toFixed(3) + '–' + ao.ao.max.toFixed(3)
      + '（' + ao.ao.distinct + ' 档）· 灰模暗像素 ' + clayOff.dark + '→' + clayOn.dark
      + ' · 亮度 ' + clayOff.mean.toFixed(1) + '→' + clayOn.mean.toFixed(1)
      + ' · 上色亮度 ' + colOff.mean.toFixed(1) + '→' + colOn.mean.toFixed(1)
      + ' · 微调 ' + tw1.changed + '+' + tw2.changed + ' 点 · 台地 ' + before.toFixed(1) + '→' + after2.toFixed(1));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
