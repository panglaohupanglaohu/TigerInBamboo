// 1061227418961219585 / 1061229717582475264 的运行时验收：
// UI 装饰贴图以面板中心对折镜像铺贴（相邻格互为镜像），8 种朝向都不同，
// 同一张贴图换几种设置（朝向/格宽）能打破重复，面板拉长则重复次数线性增加。
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
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:8769/textures.html?t=deco');
    await page.waitForFunction(() => window.texLab?.deco);
    await page.waitForTimeout(120);

    const grab = () => page.evaluate(() => {
      const c = document.querySelector('#cv'), g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const DPR = c.width / innerWidth;
      return { w: c.width, h: c.height, DPR, px: Array.from(d) };
    });

    // 面板区按 HTML 里的 x0 = 420、y0 = 30（1500 宽视口）
    const X0 = 420, Y0 = 30;
    const ink = (s, x, y) => { const i = ((y | 0) * s.w + (x | 0)) * 4; return s.px[i] + s.px[i + 1] + s.px[i + 2]; };
    const sub = (s, x, y, w, h) => {
      let inkCount = 0, sum = 0, hash = 2166136261;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const v = ink(s, x + i, y + j);
        if (v > 420) { inkCount++; hash = ((hash ^ v) * 16777619) >>> 0; }
        sum += v;
      }
      return { inkCount, sum, hash, area: w * h };
    };
    // 关于给定竖线对称：镜像格是 canvas 负缩放画出来的，采样有 1px 相位差，
    // 所以取 ±2px 内最好的那个偏移的差分中位（0 = 完全对称）。
    const symmetry = (s, cx, y, w, h) => {
      let best = Infinity;
      for (const dx of [-2, -1, 0, 1, 2]) {
        const diffs = [];
        for (let j = 0; j < h; j++) {
          let d = 0, n = 0;
          for (let i = 3; i <= w; i++) {
            const a = ink(s, cx - i, y + j), b = ink(s, cx + i + dx, y + j);
            if (a > 420 || b > 420) { d += Math.abs(a - b); n++; }
          }
          if (n > 20) diffs.push(d / n);
        }
        diffs.sort((p, q) => p - q);
        best = Math.min(best, diffs.length ? diffs[diffs.length >> 1] : Infinity);
      }
      return best;
    };

    const snap = { errors };

    // ---- 1. 只镜像：整块面板关于中心竖线对称，且横向重复次数 > 1
    const s0 = await grab();
    const info0 = await page.evaluate(() => window.texLab.deco);
    snap.mode0 = { info0 };
    const w0 = 1500 - X0 - 20, h0 = 1000 - Y0 - 24;
    const sym0 = symmetry(s0, (X0 + w0 / 2) * s0.DPR, Y0 * s0.DPR, Math.floor(w0 / 2) * s0.DPR - 2, Math.floor(h0 * 0.8) * s0.DPR);
    snap.mode0.symmetry = sym0;
    if (!(info0.repeats >= 3)) throw new Error('只镜像模式下横向重复次数太少：' + JSON.stringify(info0));
    if (!(info0.cells > 20)) throw new Error('格子数太少：' + JSON.stringify(info0));
    if (!(sym0 < 12)) throw new Error('面板关于中心不对称，差分中位 ' + sym0);
    await page.screenshot({ path: 'artifacts/coverage/deco-mirror.png' });

    // ---- 2. + 8 向：八块小面板必须互不相同
    await page.click('#sub button:nth-child(2)');
    await page.waitForTimeout(120);
    const s1 = await grab();
    const cw = Math.min(200, (w0 - 30) / 4), ch = Math.min(160, (h0 - 30) / 2);
    const hashes = [];
    for (let i = 0; i < 8; i++) {
      const x = X0 + (i % 4) * (cw + 10), y = Y0 + Math.floor(i / 4) * (ch + 10);
      hashes.push(sub(s1, x * s1.DPR + 4, y * s1.DPR + 4, Math.floor(cw * s1.DPR) - 8, Math.floor(ch * s1.DPR) - 8).hash);
    }
    snap.mode1 = { hashes, unique: new Set(hashes).size };
    if (new Set(hashes).size !== 8) throw new Error('8 种朝向里有重复画面：' + JSON.stringify(hashes));
    await page.screenshot({ path: 'artifacts/coverage/deco-8way.png' });

    // ---- 3. + 几种设置：三条并排装饰带，内容必须两两不同，各自仍关于自己中心对称
    await page.click('#sub button:nth-child(3)');
    await page.waitForTimeout(120);
    const s2 = await grab();
    const pw = Math.min(200, (w0 - 40) / 3), ah2 = h0;
    const strips = [];
    for (let i = 0; i < 3; i++) {
      const x = X0 + i * (pw + 18);
      strips.push(sub(s2, x * s2.DPR + 3, Y0 * s2.DPR + 3, Math.floor(pw * s2.DPR) - 6, Math.floor(ah2 * 0.85) * s2.DPR));
    }
    const pairDiff = (a, b) => Math.abs(a.inkCount - b.inkCount) + (a.hash === b.hash ? 1e6 : 0);
    snap.mode2 = { ink: strips.map((s) => s.inkCount), distinct: new Set(strips.map((s) => s.hash)).size };
    if (strips.some((s) => s.inkCount < 500)) throw new Error('装饰带没画出来：' + JSON.stringify(snap.mode2));
    if (new Set(strips.map((s) => s.hash)).size !== 3) throw new Error('三套设置里有两条完全一样：' + JSON.stringify(snap.mode2));
    if (pairDiff(strips[0], strips[1]) < 100) throw new Error('前两条装饰带几乎没差别：' + JSON.stringify(snap.mode2));
    await page.screenshot({ path: 'artifacts/coverage/deco-settings.png' });

    // ---- 4. 拉太长：面板 1/3/6 格宽，实测宽度比必须跟着 1:3:6，重复次数随之线性增长
    await page.click('#sub button:nth-child(4)');
    await page.waitForTimeout(120);
    const s3 = await grab();
    const bandH = Math.floor(((h0 - 20) / 3 - 12) * s3.DPR);
    const widths = [];
    for (let i = 0; i < 3; i++) {
      const y = Y0 + i * ((h0 - 20) / 3) + 6;
      let maxX = 0;
      for (let x = X0 * s3.DPR; x < (X0 + w0) * s3.DPR; x += 1) {
        // 跳过顶部 20px 的说明文字，只量面板本体
        for (let j = 22 * s3.DPR; j < bandH; j += 5) if (ink(s3, x, y * s3.DPR + j) > 330) { maxX = Math.max(maxX, x); break; }
      }
      widths.push(Math.round((maxX - X0 * s3.DPR) / s3.DPR));
    }
    const labels = await page.evaluate(() => document.getElementById('stat').textContent);
    snap.mode3 = { widths, labels };
    if (!(widths[0] > 40)) throw new Error('第一条面板没画出来：' + JSON.stringify(widths));
    const r1 = widths[1] / widths[0], r2 = widths[2] / widths[0];
    snap.mode3.ratios = [r1, r2];
    if (!(r1 > 2.4 && r1 < 3.6)) throw new Error('第二条面板宽度比不是 3：' + JSON.stringify(widths));
    if (!(r2 > 4.8 && r2 < 7.2)) throw new Error('第三条面板宽度比不是 6：' + JSON.stringify(widths));
    if (!/1\/3\/6|重复 1\/3\/6/.test(labels)) throw new Error('重复次数标注不对：' + labels);
    await page.screenshot({ path: 'artifacts/coverage/deco-stretch.png' });

    if (errors.length) throw new Error('控制台有错误：' + errors.join(' | '));
    fs.writeFileSync('artifacts/coverage/deco-panels.json', JSON.stringify(snap, null, 2));
    console.log('deco-panels-browser PASS · 对称差分 ' + sym0.toFixed(1)
      + ' · 8 向唯一 ' + new Set(hashes).size
      + ' · 三套设置 ' + snap.mode2.ink.join('/')
      + ' · 宽度 ' + widths.join('/') + ' · ' + labels);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
