// nav-walk-browser.cjs — 917405214638006273 "a heuristic for deliberately generating navigable levels"
// 片子：灰模上叠一层统一黄色的可走图 —— 每个可走格一个点（格心），相邻格之间一根线；
//       塔身上那几根竖线就是跨台阶的那条边（两端各用自己的站立高度）。
// 验收：nav-walk.html 打开可走图后，线段颜色只有一种黄、点数＝可走格数、边数＝可走邻接边数、
//       跨台阶边 > 0；关掉后不可见；最短路树仍是另一套画法（切换不回退）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8769/nav-walk.html');
    await p.waitForFunction(() => window.navWalkReview?.api?.view?.navLayer?.nav, { timeout: 90000 });

    const read = () => p.evaluate(() => {
      const v = window.navWalkReview.api.view, nl = v.navLayer;
      const g = nl.lines.geometry, col = g.attributes.color?.array || [], pos = g.attributes.position?.array || [];
      const keys = new Set();
      for (let i = 0; i < col.length; i += 3) keys.add([col[i], col[i + 1], col[i + 2]].map((x) => Math.round(x * 1000) / 1000).join(','));
      // 每根线的两端各用自己的站立高度 → 跨台阶的线两端 y 不同
      let step = 0;
      for (let i = 0; i < pos.length; i += 6) if (Math.abs(pos[i + 1] - pos[i + 4]) > 1e-6) step++;
      return {
        walkGraph: nl.walkGraph, visible: nl.lines.visible && nl.nodes.visible,
        segments: pos.length / 6, nodeCount: nl.nodes.geometry.attributes.position.count,
        colors: [...keys], stats: nl.walkStats, stepSegments: step,
        debugState: { navwalk: v.debugState?.navwalk, nav: v.debugState?.nav },
      };
    });

    const tree = await read();                       // 默认：最短路树
    await p.locator('#walk').setChecked(true);   // 勾可走图（页面互斥：会把最短路树的勾自动放下）
    await p.waitForFunction(() => window.navWalkReview.api.view.navLayer.walkGraph === true);
    const walk = await read();
    await p.screenshot({ path: 'artifacts/coverage/nav-walk-graph.png' });

    // 相机拉到塔身上，拍跨台阶的竖线
    await p.evaluate(() => {
      const v = window.navWalkReview.api.view;
      v.target.set(0, 1.6, 0); v.distance = 14; v.pitch = 0.62; v.updateCamera();
    });
    await p.waitForTimeout(700);
    await p.screenshot({ path: 'artifacts/coverage/nav-walk-graph-wide.png' });

    await p.locator('#walk').setChecked(false);
    await p.waitForFunction(() => window.navWalkReview.api.view.navLayer.walkGraph === false);
    const off = await read();

    console.log(JSON.stringify({ tree: { ...tree, stats: undefined }, walk, off: { walkGraph: off.walkGraph, colors: off.colors } }, null, 2));
    assert.equal(tree.walkGraph, false, '默认应是最短路树');
    assert.ok(tree.colors.length > 1, '最短路树是按走过时间上色的（多色），实得 ' + tree.colors.length);
    assert.equal(walk.walkGraph, true, '勾上开关应切到可走图');
    assert.equal(walk.visible, true, '可走图应可见');
    assert.equal(walk.colors.length, 1, '可走图应只有一种颜色，实得 ' + walk.colors.join(' / '));
    assert.equal(walk.colors[0], '1,0.886,0.227', '可走图应为统一黄，实得 ' + walk.colors[0]);
    assert.equal(walk.nodeCount, walk.stats.cells, '点数应等于可走格数 ' + walk.stats.cells);
    assert.ok(walk.stats.edges > 0, '应有可走邻接边');
    assert.equal(walk.stepSegments, walk.stats.stepEdges, '跨台阶的线数应等于台账 stepEdges ' + walk.stats.stepEdges);
    assert.ok(walk.stepSegments > 0, '岛上一定有跨台阶的连线（片子里塔身上的竖线）');
    assert.equal(off.walkGraph, false, '关掉开关应切回最短路树');
    assert.ok(off.colors.length > 1, '关掉后回到多色的最短路树');
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/nav-walk-browser.json', JSON.stringify({ tree, walk, off, errors }, null, 2));
    console.log('PASS nav walk graph: ' + walk.stats.cells + ' 个可走格 / ' + walk.stats.edges + ' 条边（跨台阶 ' + walk.stepSegments + '）统一黄色，切回最短路树 ' + off.colors.length + ' 色');
  } finally { await browser.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
