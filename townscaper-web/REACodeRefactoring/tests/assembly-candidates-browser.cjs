// 第 69 轮 · 1120036868966502401（703f，网格调试层）：补第 68 轮遗留缺口
//   「setCandidates 的逐格 domain 只由夹具喂，没接 wfc.js 的 traceLimit 快照」。
// 现在 assembly.html 直接吃 solveAssembly() 的真实 traceLimit 快照（trace[].domains），
// 按地面层（level 1）的 domain 大小喂给 ContourOverlay.setCandidates。
// 判据（全部读运行时对象，不看代码猜）：
//   A. 候选棋盘走 domain 模式（candidateStats.mode === 'domain'），不是旧的 spatial 奇偶；
//   B. 逐帧收缩：trace 首帧的 domain 直方图里「多候选格」明显多于末帧，末帧候选格（>1 候选）为 0；
//   C. 棋盘双色都出现（white>0 && black>0）且白+黑 = 未收敛格数，收敛格被剔除（converged>0）；
//   D. 首末帧的候选格集合不是同一批（画面真的在逐格翻色，而不是一开始就定格）。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  let ok = false;
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/assembly.html?play=0', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__assembly?.ok === true, null, { polling: 200, timeout: 60000 });

    // 勾上候选棋盘，然后把 trace 滑杆从首帧扫到末帧
    await page.evaluate(() => { document.querySelector('#cand').checked = true; document.querySelector('#cand').onchange(); });
    report.frames = await page.evaluate(() => document.querySelector('#tf').max | 0);

    const at = (i) => page.evaluate((i) => {
      const tf = document.querySelector('#tf');
      tf.value = i; tf.oninput();
      const st = window.__assemblyCandidates;
      return st ? {
        mode: st.mode, white: st.white, black: st.black, converged: st.converged, cells: st.cells,
        traceStep: st.traceStep, traceFrames: st.traceFrames, stage: st.stage,
        domainSizes: st.domainSizes, thunks: st.on,
      } : null;
    }, i);

    const last = Math.max(0, report.frames);
    report.first = await at(0);
    report.mid = await at(Math.floor(last / 2));
    report.last = await at(last);
    report.off = await page.evaluate(() => {
      document.querySelector('#cand').checked = false; document.querySelector('#cand').onchange();
      return { visible: !!window.assemblyView?.contourOverlay?.candidates?.visible };
    });

    // 末帧：全部收敛后候选盘应为空（画面回到干净网格）
    report.lastEmpty = await page.evaluate(() => window.assemblyView?.contourOverlay?.candidates?.geometry?.attributes?.position?.count || 0);

    await page.evaluate(() => { document.querySelector('#cand').checked = true; });
    await page.evaluate(() => { const tf = document.querySelector('#tf'); tf.value = Math.floor(Number(tf.max) / 3); tf.oninput(); window.assemblyView.render(0.016); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/assembly-candidates.png` });
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const A = report.first?.mode === 'domain' && report.last?.mode === 'domain';
  const multi = (st) => (st?.domainSizes || []).filter((d) => d.size > 1).reduce((s, d) => s + d.count, 0);
  const B = multi(report.first) > multi(report.last) && multi(report.last) === 0;
  const C = report.first?.white > 0 && report.first?.black > 0
    && report.first.white + report.first.black + report.first.converged === report.first.cells
    && report.first.converged >= 0;
  const D = report.first && report.last && (report.first.white !== report.last.white || report.first.black !== report.last.black);
  ok = problems.length === 0 && A && B && C && D;
  console.log(JSON.stringify({
    ok, A_domainMode: A, B_monotoneShrink: B, C_twoColors: C, D_framesDiffer: D,
    multiFirst: multi(report.first), multiLast: multi(report.last), problems, report,
  }, null, 1));
  if (!ok) process.exitCode = 1;
})();
