// 816748103193817088 运行时验收：导航面流向「共边带混合」在真实浏览器页里的表现
// 量三件事：① 页面内探针跨共面边的方向差（关/开）；② 关闭后人群平均距离是否仍收敛；③ 截图（两态各一张）
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const problems = [];
  const page = await browser.newPage({ viewport: { width: 760, height: 560 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('http://127.0.0.1:8769/navmesh-flow.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.navmeshFlowReview && window.navmeshFlowStep, null, { polling: 150, timeout: 30000 });

  // ① 跨共面边：在页面里挑一条横向长边（z=3.5 一带、x≈7 的坡道口两侧），取边中点两侧各 1e-6 的方向
  const cross = await page.evaluate(() => ({ off: window.navmeshFlowEdgeGap(false), on: window.navmeshFlowEdgeGap(true) }));

  // ② 关闭共边带时人群是否照样收敛（模拟 6 秒）
  const converge = await page.evaluate(async () => {
    window.__noLoop = true;
    const before = window.navmeshFlowReview;
    const dOff = window.navmeshFlowStep(180);
    const dOff2 = window.navmeshFlowStep(180);
    document.querySelector('#blend').checked = false;
    const dOn = window.navmeshFlowStep(0);
    return { polys: before.polys, verts: before.verts, agents: before.agents, left: before.left, dOff, dOff2, dOn, blendFlag: before.blend };
  });
  await page.screenshot({ path: `${OUT}/navmesh-flow-blend-off.png` });

  const on = await page.evaluate(async () => {
    document.querySelector('#blend').checked = true;
    const d0 = window.navmeshFlowStep(0);
    const d1 = window.navmeshFlowStep(60);
    return { d0, d1, blend: window.navmeshFlowReview.blend };
  });
  await page.screenshot({ path: `${OUT}/navmesh-flow-blend-on.png` });

  const ok = problems.length === 0
    && cross.off && cross.on && cross.off.n > 100 && cross.on.p90 < 1.5 && cross.off.p90 > 5
    && converge.dOff2 < converge.dOff
    && on.d1 <= on.d0;
  console.log(JSON.stringify({ cross, converge, on, problems, ok }, null, 1));
  await browser.close();
  if (!ok) { console.error('FAIL 导航面共边带浏览器验收'); process.exit(1); }
  console.log('PASS 导航面共边带浏览器验收');
})();
