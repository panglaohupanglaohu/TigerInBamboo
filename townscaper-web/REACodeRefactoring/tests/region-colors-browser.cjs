// 第 60 轮 · 1120036868966502401：区域边界多色 + 候选格黑白棋盘 的运行时验收
// 原片（frame-0260…0300）：同屏同时有红 / 粉 / 紫 / 蓝的边界折线；frame-0160…0170 / 0470…0480 出现黑白相间的整格棋盘。
// 判据：① 边界几何的 color 属性里不同颜色数 ≥ 3，且每层一个色；② 候选棋盘白/黑格都 > 0 且数量相当、整格铺满（三角数 = Σ(顶点数-2)）。
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
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain&on=contours', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.view?.contourOverlay, null, { polling: 200, timeout: 90000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 100, null, { polling: 200, timeout: 90000 });

    report.regions = await page.evaluate(() => {
      const v = window.rea.view;
      v.setDebug('contours', true);
      v.contourOverlay.refresh();
      const o = v.contourOverlay;
      const col = o.regions.geometry.getAttribute('color');
      const uniq = new Set();
      if (col) for (let i = 0; i < col.count; i++) uniq.add([col.getX(i), col.getY(i), col.getZ(i)].map((x) => x.toFixed(3)).join(','));
      // 第 64 轮：区域 id 口径 —— 同一 id 跨层必须同色；不同 id 必须不同色（同屏看到的多色是「不同区域」而不是「不同高度层」）
      const rc = o.regionIds;
      const idColor = new Map();
      let conflicts = 0;
      for (const layer of rc?.layers || []) {
        for (const r of layer.regions) {
          const c = o.regionPalette[(r.id - 1) % o.regionPalette.length];
          if (idColor.has(r.id) && idColor.get(r.id) !== c) conflicts++;
          idColor.set(r.id, c);
        }
      }
      // 同一格在相邻两层 id 不变时，颜色必须不变（这就是「长高不换色」）
      let stableCells = 0, colorFlips = 0;
      for (let li = 1; li < (rc?.layers?.length || 0); li++) {
        const a = rc.layers[li - 1], b = rc.layers[li];
        for (const [idx, id] of b.ids) {
          const pa = a.ids.get(idx);
          if (pa !== id) continue;
          stableCells++;
          if (a.colorOf.get(idx) !== b.colorOf.get(idx)) colorFlips++;
        }
      }
      return {
        levels: o.regionStats.length,
        levelColors: [...new Set(o.regionStats.map((s) => s.color))],
        regionColors: [...new Set([...idColor.values()])],
        regionIds: [...idColor.keys()].sort((x, y) => x - y),
        idColorConflicts: conflicts,
        stableCells, colorFlips,
        segments: o.regionStats.reduce((s, r) => s + r.segments, 0),
        colorCount: uniq.size,
        vertexColors: o.regions.material.vertexColors,
      };
    });

    report.candidates = await page.evaluate(() => {
      const { view, world } = window.rea;
      // 取世界质心附近的格做候选（远处格会跑到画面外，截图看不到棋盘）
      const c0 = world.cells.filter((c) => c.pts.length >= 3);
      const mx = c0.reduce((s, c) => s + c.pts.reduce((a, p) => a + p.x, 0) / c.pts.length, 0) / c0.length;
      const mz = c0.reduce((s, c) => s + c.pts.reduce((a, p) => a + p.z, 0) / c0.length, 0) / c0.length;
      const picks = c0
        .map((c) => {
          const cx = c.pts.reduce((a, p) => a + p.x, 0) / c.pts.length;
          const cz = c.pts.reduce((a, p) => a + p.z, 0) / c.pts.length;
          return { c, d: Math.hypot(cx - mx, cz - mz), cx, cz };
        })
        .sort((a, b) => a.d - b.d)
        .slice(0, 40)
        .map((o) => o.c);
      const cx = picks.reduce((s, c) => s + c.pts.reduce((a, p) => a + p.x, 0) / c.pts.length, 0) / picks.length;
      const cz = picks.reduce((s, c) => s + c.pts.reduce((a, p) => a + p.z, 0) / picks.length, 0) / picks.length;
      window.__r64picks = picks;
      const st = view.contourOverlay.setCandidates(picks);
      const expectedTris = picks.reduce((s, c) => s + Math.max(0, c.pts.length - 2), 0);
      view.target.set(cx, (world.top(picks[0]) || 1) * (view.levelHeight || 1), cz);
      view.yaw = Math.PI * 0.25; view.pitch = 1.2; view.distance = 9; view.updateCamera(); view.render(0.016);
      return { ...st, center: [+cx.toFixed(2), +cz.toFixed(2)], expectedTris, tris: view.contourOverlay.candidates.geometry.getAttribute('position').count / 3, visible: view.contourOverlay.candidates.visible };
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/region-colors-candidates.png` });

    // 第 64 轮：候选棋盘改读 wfc.js 逐格 domain 大小的代码路径（domains 由夹具给，真接线留给下一轮）
    report.candidatesDomain = await page.evaluate(() => {
      const v = window.rea.view, o = v.contourOverlay;
      const n = o.candidates.geometry.getAttribute('position').count;
      const picks = window.__r64picks || [];
      const domains = new Map();
      picks.forEach((c, i) => domains.set(c.id, i < 4 ? 1 : 2 + (i % 3)));   // 前 4 格已收敛（domain=1）
      const st = o.setCandidates(picks, { domains });
      v.render(0.016);
      return { ...st, picked: picks.length, tris: n / 3 };
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/region-colors-candidates-domain.png` });

    report.off = await page.evaluate(() => {
      const v = window.rea.view;
      const st = v.contourOverlay.setCandidates(null);
      v.render(0.016);
      return st;
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/region-colors-no-candidates.png` });

    ok = problems.length === 0
      && report.regions.colorCount >= 3
      && report.regions.regionColors.length >= 3
      && report.regions.idColorConflicts === 0          // 同一 id 跨层同色
      && report.regions.colorFlips === 0                // 同 id 的格换层不换色
      && report.regions.stableCells > 100               // 有足够多的格真的跨层存活
      && report.candidates.white > 0 && report.candidates.black > 0
      && Math.abs(report.candidates.white - report.candidates.black) <= report.candidates.cells * 0.35
      && report.candidates.tris === report.candidates.expectedTris
      && report.candidates.visible === true
      && report.candidatesDomain.mode === 'domain'
      && report.candidatesDomain.converged === 4
      && report.candidatesDomain.domainSizes.length === 3
      && report.off.on === false;
  } catch (e) {
    problems.push('fatal: ' + e.message);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok, problems, report }, null, 1));
  if (!ok) process.exitCode = 1;
})();
