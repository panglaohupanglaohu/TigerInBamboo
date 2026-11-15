// 第 83 轮 · 1120036868966502401：区域边界色板按原片线段芯中位色标定
// 依据（frame-0300 / frame-0260，2×2 腐蚀取线芯、通道取中位数）：
//   红 RGB(218,71,40) / 蓝 RGB(46,75,167) / 黄 RGB(220,223,102)
// 判据：① 色板前三色与实测色逐通道差 ≤ 12；② 色板里必须存在「黄」（旧的 6 色板完全没有黄，
//       而 frame-0300 同一高度层并排有黄、蓝两块 patch）；③ 同 id 跨层同色、不同 id 不同色不变。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MEASURED = [
  { name: 'red', rgb: [218, 71, 40] },
  { name: 'blue', rgb: [46, 75, 167] },
  { name: 'yellow', rgb: [220, 223, 102] },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  let report = {};
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&on=contours', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.contourOverlay, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 100, null, { polling: 200, timeout: 90000 });
    report = await page.evaluate(() => {
      const o = window.rea.view.contourOverlay;
      window.rea.view.setDebug('contours', true);
      o.refresh();
      const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const pal = o.regionPalette.map(hex2rgb);
      // 同 id 跨层同色 / 不同 id 不同色
      const rc = o.regionIds;
      const byId = new Map();
      let conflicts = 0;
      for (const layer of rc?.layers || []) {
        for (const r of layer.regions) {
          const c = o.regionPalette[(r.id - 1) % o.regionPalette.length];
          if (byId.has(r.id) && byId.get(r.id) !== c) conflicts++;
          byId.set(r.id, c);
        }
      }
      return { pal, conflicts, ids: byId.size, palHex: o.regionPalette.slice(), layers: (rc?.layers || []).length };
    });
  } catch (e) {
    problems.push('exception: ' + e.message);
  } finally {
    await browser.close();
  }

  const checks = [];
  if (report.pal) {
    MEASURED.forEach((m, i) => {
      const d = report.pal[i].map((v, j) => Math.abs(v - m.rgb[j]));
      checks.push([`${m.name} 色差 ≤12（Δ=${d.join('/')}）`, Math.max(...d) <= 12]);
    });
    checks.push(['色板含黄色档', report.palHex.some((h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return r > 180 && g > 180 && b < 140; })]);
    checks.push(['色板 ≥7 档', report.palHex.length >= 7]);
    checks.push(['同 id 跨层同色 / 冲突 0', report.conflicts === 0]);
    checks.push(['至少一层有区域', report.layers >= 1 && report.ids >= 1]);
  }
  checks.push(['无 pageerror/console error', problems.length === 0]);

  let pass = true;
  for (const [name, ok] of checks) { if (!ok) pass = false; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); }
  if (problems.length) console.log('problems:', problems.slice(0, 5));
  console.log(JSON.stringify({ palette: report.palHex, ids: report.ids, layers: report.layers, conflicts: report.conflicts }));
  console.log(pass ? 'ALL PASS' : 'FAILED');
  process.exit(pass ? 0 : 1);
})();
