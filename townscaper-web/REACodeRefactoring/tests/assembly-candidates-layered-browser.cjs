// 第 72 轮 · 1120036868966502401（703f）：补第 71 轮遗留缺口 ①
//   「棋盘候选上到建筑层 —— 原片 frame-0490+ 建筑顶面有黑白格，setCandidates 仍按 world.top 铺在地面层格」。
// 证据：联系表 sheet-00 frame-0162…0169（屋顶体块顶面各一块棋盘）、sheet-05 frame-0540…0550（同一栋多层，
//   每层顶面各一块、上下两块不重叠）→ 口径是「一格一层一块，y=(site.ground+level-1)·levelHeight」。
// 判据（全部读运行时几何与 stats，不看代码猜）：
//   A. fort 场景里分层模式同时在 >=2 层出现（levels>=2）且 roof>0；
//   B. white+black+converged === 层格总数（没有凭空造格）；
//   C. 几何里 >=2 个互不相同的 y，最高 y 明显高于最低 y（真的按层高叠上去）；
//   D. 同一帧切回「只地面层」（layered=false）：roof=0、y 只有一层/零层 → 两种模式确实不同；
//   E. 该帧黑白双色都出现（奇偶由 domain 大小决定）；
//   F. ruin 默认场景分层模式仍能画地面候选（ground>0、roof=0、单一 y）→ 分层没有把地面走坏。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'artifacts/coverage';

const probeFn = ([i, layered]) => {
  const tf = document.querySelector('#tf');
  const lv = document.querySelector('#candLv');
  lv.checked = layered; tf.value = i; tf.oninput();
  const ov = window.assemblyView.contourOverlay, st = window.__assemblyCandidates;
  const pos = ov.candidates.geometry?.attributes?.position;
  const ys = new Set();
  if (pos) for (let k = 1; k < pos.count; k += 3) ys.add(+pos.array[k].toFixed(3));
  return {
    layered: !!st?.layered, levels: st?.levels ?? 1, levelList: st?.levelList ?? [1],
    ground: st?.ground ?? 0, roof: st?.roof ?? 0,
    white: st?.white ?? 0, black: st?.black ?? 0, converged: st?.converged ?? 0,
    cells: st?.cells ?? 0, visible: !!ov.candidates.visible,
    yCount: ys.size, yMin: ys.size ? Math.min(...ys) : null, yMax: ys.size ? Math.max(...ys) : null,
    triVerts: pos ? pos.count : 0,
  };
};

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const report = {};
  let ok = false;
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
    await page.goto('http://127.0.0.1:8769/assembly.html?play=0' + q, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__assembly?.ok === true, null, { polling: 200, timeout: 60000 });
    await page.evaluate(() => { document.querySelector('#cand').checked = true; document.querySelector('#cand').onchange(); });
    return page;
  };
  try {
    // ---- 场景 1：fort（上两层保留多候选格 → 屋顶棋盘）
    const pf = await open('&tileset=fort&seed=2');
    report.fortFrames = await pf.evaluate(() => document.querySelector('#tf').max | 0);
    let best = null, mid = 0;
    for (let i = 0; i <= report.fortFrames; i++) {
      const st = await pf.evaluate(probeFn, [i, true]);
      if (!best) best = st;
      if (st.roof > 0 && st.levels >= 2 && st.white > 0 && st.black > 0) { best = st; mid = i; break; }
    }
    report.layered = best; report.midFrame = mid;
    report.groundOnly = await pf.evaluate(probeFn, [mid, false]);
    await pf.evaluate((i) => {
      const tf = document.querySelector('#tf');
      document.querySelector('#candLv').checked = true;
      tf.value = i; tf.oninput();
      const v = window.assemblyView; v.distance = 5.5; v.pitch = 0.85; v.render(0.016);
    }, mid);
    await pf.waitForTimeout(400);
    await pf.screenshot({ path: `${OUT}/assembly-candidates-layered.png` });
    await pf.close();

    // ---- 场景 2：ruin（默认，地面候选还在 → 分层没走坏地面）
    const pr = await open('');
    report.ruin = await pr.evaluate(probeFn, [0, true]);
    await pr.evaluate(() => {
      document.querySelector('#candLv').checked = true;
      window.assemblyView.render(0.016);
    });
    await pr.waitForTimeout(300);
    await pr.screenshot({ path: `${OUT}/assembly-candidates-layered-ruin.png` });
    await pr.close();
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  const L = report.layered || {}, G = report.groundOnly || {}, R = report.ruin || {};
  const A = L.layered === true && L.levels >= 2 && L.roof > 0;
  const B = L.white + L.black + L.converged === L.cells && L.cells > 0;
  const C = L.yCount >= 2 && (L.yMax - L.yMin) > 0.3;
  const D = (G.roof ?? 1) === 0 && (G.yCount ?? 9) <= 1 && (G.white + G.black) < (L.white + L.black);
  const E = L.white > 0 && L.black > 0;
  const F = R.layered === true && R.ground > 0 && R.roof === 0 && R.yCount === 1 && R.visible === true;
  ok = problems.length === 0 && A && B && C && D && E && F;
  console.log(JSON.stringify({
    ok, A_levels: A, B_noPhantomCells: B, C_multiY: C, D_groundOnlyDiffers: D, E_twoColors: E, F_ruinGroundKept: F,
    problems, report,
  }, null, 1));
  if (!ok) process.exitCode = 1;
})();
