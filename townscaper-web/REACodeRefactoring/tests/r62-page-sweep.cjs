// r62-page-sweep.cjs — 一次把 A+B 涉及的实验页全跑一遍，落截图 + 控制台错误 + 画布像素统计。
// 用途：给"有实现没跑过运行时"的条目补真实运行证据（不是只读代码）。
// 跑法：NODE_PATH=/tmp/pw-shim:<rea>/node_modules node tests/r62-page-sweep.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts/coverage/r62-pages');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://127.0.0.1:8769/';
const pages = JSON.parse(process.argv[2] || '[]');
const extra = ['index.html?scene=terrain', 'index.html?scene=battle'];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });
  const report = { at: new Date().toISOString(), base: BASE, pages: {} };
  const list = [...new Set([...pages, ...extra])];

  for (const rel of list) {
    const slug = rel.replace(/[^a-z0-9]+/gi, '_').replace(/_+$/, '');
    const rec = { url: rel, ok: false, errors: [], canvases: 0, shot: null };
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => rec.errors.push('pageerror: ' + String(e.message).slice(0, 200)));
    p.on('console', (m) => { if (m.type() === 'error') rec.errors.push('console: ' + m.text().slice(0, 200)); });
    try {
      const resp = await p.goto(BASE + rel, { waitUntil: 'load', timeout: 25000 });
      rec.status = resp && resp.status();
      await p.waitForTimeout(1500);
      rec.canvases = await p.evaluate(() => document.querySelectorAll('canvas').length);
      rec.title = await p.title();
      // 页面自己暴露的验收钩子（有就记下来，方便后续逐条跑）
      rec.hooks = await p.evaluate(() => Object.keys(window).filter((k) => /^[a-z][A-Za-z0-9]*$/.test(k))
        .filter((k) => window[k] && typeof window[k] === 'object' && !(window[k] instanceof Node))
        .slice(0, 24));
      const file = path.join(OUT, slug + '.png');
      await p.screenshot({ path: file });
      rec.shot = path.relative(ROOT, file);
      rec.ok = rec.status === 200;
    } catch (e) {
      rec.errors.push('nav: ' + String(e.message).slice(0, 200));
    }
    await ctx.close();
    report.pages[rel] = rec;
    const errTag = rec.errors.length ? ` err=${rec.errors.length}` : '';
    console.log(`${rec.ok ? 'ok ' : 'BAD'} ${rel} canvas=${rec.canvases}${errTag}`);
  }

  fs.writeFileSync(path.join(ROOT, 'artifacts/coverage/r62-pages.json'), JSON.stringify(report, null, 1));
  await browser.close();
  const bad = Object.entries(report.pages).filter(([, r]) => !r.ok || r.errors.length);
  console.log(`\n共 ${Object.keys(report.pages).length} 页，异常 ${bad.length}`);
  bad.forEach(([u, r]) => console.log(' -', u, (r.errors[0] || '').slice(0, 120)));
})();
