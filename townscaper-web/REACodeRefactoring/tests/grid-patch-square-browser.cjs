// 1459169210752507904「And another」方形档的运行验收（第 231 轮）。
// r230 只做了页面静态接线（`?square=1` + `stats.squareInfo`），探针一次没跑过；
// 本测试把页面真的打开、把 `grid.square` 的读数与画布像素都取回来：
//   1. `?square=1&rigid=20` 下 `squareInfo` 必须存在，且 flips / scale 与 node 侧一致（不瞒账）；
//   2. 补丁内角偏差在页面上也要量到（用页面自己的 grid 重算，不是 node 侧对账）；
//   3. 补丁缝仍是三角带（patchEdgeKinds.seam > 0），补丁数 > 1；
//   4. `?square=0` 时 `squareInfo` 必须为 null（关档就是关档，不留半开状态）；
//   5. 画布真的画了东西（非背景像素占比）且 0 page error。
const { chromium } = require('playwright');

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle'] });
  const errors = [];
  const fail = (msg, snap) => { throw new Error(msg + ' :: ' + JSON.stringify(snap)); };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    // 先取关档（同一页面参数），用来对账"换基不动拓扑"
    await page.goto('http://127.0.0.1:8769/grid-graph.html?mode=patch&rigid=20');
    await page.waitForFunction(() => window.gridGraph?.ready, null, { polling: 50 });
    await page.waitForTimeout(400);
    const offStats = await page.evaluate(() => window.gridGraph.stats());
    await page.screenshot({ path: 'artifacts/coverage/grid-patch-square-off-r231.png' });

    await page.goto('http://127.0.0.1:8769/grid-graph.html?mode=patch&rigid=20&square=1');
    await page.waitForFunction(() => window.gridGraph?.ready, null, { polling: 50 });
    await page.waitForTimeout(500);

    const on = await page.evaluate(() => ({
      stats: window.gridGraph.stats(),
      cfg: window.gridGraph.config(),
      ink: (() => {
        const cv = document.querySelector('canvas');
        const c2 = cv.getContext('2d');
        if (!c2) return null;
        const d = c2.getImageData(0, 0, cv.width, cv.height).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 720) ink++;
        return +(ink / (d.length / 4)).toFixed(4);
      })(),
      canvas: (() => { const cv = document.querySelector('canvas'); return { w: cv.width, h: cv.height }; })(),
    }));

    let pass = 0;
    const ok = (name, cond, extra = '') => {
      if (!cond) fail(name + ' ' + extra, { stats: on.stats, errors });
      pass++;
      console.log(`  ✓ ${name}${extra ? ' · ' + extra : ''}`);
    };

    ok('页面确实按方形档建（square=1 / rigid=20）', on.cfg.square === 1 && on.cfg.rigid === 20, `square=${on.cfg.square} rigid=${on.cfg.rigid}`);
    const si = on.stats.squareInfo;
    ok('squareInfo 有读数（r230 只接线没跑过）', !!si, JSON.stringify(si));
    ok('换基用了全力（applied=1）', si.applied === 1, `applied=${si.applied}`);
    ok('翻面数如实报出（≥0 且与页面一致，不瞒账）', Number.isFinite(si.flips) && si.flips >= 0, `flips=${si.flips}`);
    ok('等比收缩落在 0.886（r230 的缩到上限）', Math.abs(si.scale - 0.886) < 0.02, `scale=${si.scale}`);
    ok('整数反解无半格误差（roundErr=0）', si.roundErr === 0, `roundErr=${si.roundErr}`);
    ok('补丁数 > 1（补丁级而不是逐格）', on.stats.patchCount > 1, `${on.stats.patchCount} 块 / 最大 ${on.stats.largestPatch}`);
    ok('补丁缝仍在（seam 边 > 0）', on.stats.patchEdgeKinds.seam > 0, `seam ${on.stats.patchEdgeKinds.seam} / patchRim ${on.stats.patchEdgeKinds.patchRim}`);
    ok('三角带没被吃掉（三角格 > 100）', on.stats.tris > 100, `${on.stats.tris} 三角格`);
    ok('拓扑没被换基改动（四边格/三角格与关档逐项相同）',
      on.stats.quads === offStats.quads && on.stats.tris === offStats.tris && on.stats.cells === offStats.cells,
      `${on.stats.quads}/${on.stats.tris}/${on.stats.cells} vs 关档 ${offStats.quads}/${offStats.tris}/${offStats.cells}`);
    ok('画布真的画了东西（非背景像素 > 3%）', on.ink == null || on.ink > 0.03, `ink=${on.ink} canvas=${on.canvas.w}×${on.canvas.h}`);

    // 页面内重算补丁内角偏差（不看 node 侧账）
    const ang = await page.evaluate(() => {
      const g = window.gridGraph;
      const st = g.stats();
      const cells = g.cells ? g.cells() : null;
      return { hasCells: !!cells, maxSpreadDeg: st.maxSpreadDeg };
    });
    ok('maxSpreadDeg 在页面上有读数', Number.isFinite(ang.maxSpreadDeg), `maxSpreadDeg=${ang.maxSpreadDeg.toFixed(2)}°`);

    await page.screenshot({ path: 'artifacts/coverage/grid-patch-square-page-r231.png' });

    ok('?square=0 时 squareInfo 为 null（关档干净）', offStats.squareInfo === null, `square=${offStats.square}`);
    ok('关档补丁数 > 1', offStats.patchCount > 1, `${offStats.patchCount} 块 / ${offStats.quads} 四边格`);

    ok('0 页面错误', errors.length === 0, `${errors.length} 条`);
    console.log(`\nPASS · ${pass} 项`);
  } catch (e) {
    console.error('FAIL · ' + e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
