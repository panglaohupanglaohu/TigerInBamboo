const { chromium } = require('playwright');
const path = require('path');

// 818857408848130048 / 832633189277409280：白模黏土岛在形态间"碎块崩解 → 重新拼合"。
// 页面侧验三件事：① 形态 A 有实体（白像素足够多）；② 过渡中段明显清空（白像素骤降）；
// ③ 形态 B 又长满；④ 两次截图里的等值面都是平滑的（灰阶层次多，不是纯色平面）。
(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1040, height: 760 } });
  const errors = [], rows = [];
  const out = path.resolve(__dirname, '../artifacts/coverage');
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  try {
    await p.goto('http://localhost:8769/field-surface.html');
    await p.waitForFunction(() => window.fsPage && window.fsPage.ready, { timeout: 20000 });

    const px = () => p.evaluate(() => {
      const cv = document.querySelector('#cv');
      const g2 = cv.getContext('2d');
      const d = g2.getImageData(0, 0, cv.width, cv.height).data;
      // 背景 #dfe6e7 与水面混合色 ≈(213,222,224)：都不是这两个色的像素 = 岛体
      const bg = [[223, 230, 231], [213, 222, 224]];
      const levels = new Set();
      let white = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], bl = d[i + 2];
        let close = false;
        for (const c of bg) {
          if (Math.abs(r - c[0]) <= 7 && Math.abs(g - c[1]) <= 7 && Math.abs(bl - c[2]) <= 7) { close = true; break; }
        }
        if (!close) { white++; if (r > 150) levels.add(r); }
      }
      return { white, levels: levels.size, px: cv.width * cv.height };
    });

    for (const t of [0, 0.34, 1]) {
      const st = await p.evaluate((v) => window.fsPage.set(v), t);
      await p.waitForTimeout(160);
      const q = await px();
      rows.push({ t, ...st, whitePx: q.white, greyLevels: q.levels });
      await p.screenshot({ path: path.join(out, `field-surface-t${String(t).replace('.', '')}.png`), fullPage: false });
    }

    const [a, mid, bb] = rows;
    if (!(a.whitePx > 20000)) throw new Error('形态 A 几乎没有实体：whitePx=' + a.whitePx);
    if (!(mid.whitePx < a.whitePx * 0.15)) throw new Error(`过渡中段没清空：${mid.whitePx} vs ${a.whitePx}`);
    if (!(bb.whitePx > 12000)) throw new Error('形态 B 没长出来：whitePx=' + bb.whitePx);
    if (!(mid.airborne > 0)) throw new Error('中段没有悬空碎块');
    if (!(a.greyLevels > 12 && bb.greyLevels > 12)) throw new Error(`等值面不是平滑着色：灰阶 ${a.greyLevels}/${bb.greyLevels}`);
    if (errors.length) throw new Error('页面报错：' + errors.join(' | '));

    console.log('t / 顶点 / 面 / 实心格 / 空中 / 白像素 / 灰阶');
    for (const r of rows) console.log(`${r.t}\t${r.verts}\t${r.faces}\t${r.solid}\t${r.airborne}\t${r.whitePx}\t${r.greyLevels}`);
    console.log('field-surface-browser PASS');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
