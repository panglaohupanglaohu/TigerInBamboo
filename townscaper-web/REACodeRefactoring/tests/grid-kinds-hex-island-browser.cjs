/**
 * grid-kinds-hex-island-browser.cjs — 第 121 轮 · 1670790425232175108
 *   「I made my generator also output pure triangle/hex and square grids,
 *     to illustrate why I'm going for my mixed approach」
 *
 * 缺口史：note 连挂「独立六边地形/原模块仍缺」，r56 C08 已新建 src/core/grid-kinds-c08.js
 *   （PURE_GRIDS：共享 buildHexGrid / buildSquareGrid / buildMixedGrid mergeRate 0）+ app.js 一行挂钩
 *   `?grid=hex|square|tri`；但那批只出了 node 级测试（tests/grid-kinds-c08.mjs），**没有一支运行验收**，
 *   所以 learn/data.js 一直是 partial。本轮补的正是「从真实主场景页跑出来并量出来」。
 *
 * 判据（全部读活对象，不看 exit code）：
 *   ① 页面入口：主场景页 5 个网格按钮，`?grid=hex` 时「纯六边形」高亮；点「纯方格」换网格后**场景仍是地形**；
 *   ② 格型纯净：三种网格的每格边数分别恒为 6 / 4 / 3（无一例外）；
 *   ③ 晶格类型（几何判据，不看名字）：顶点被最多格共用的数量 = 3（六边）/ 4（方）/ 6（三角）——
 *      这是六边形铺砌与三角/方格铺砌的区别本身；V−E+F 都 = 1（圆盘拓扑）；
 *   ④ 六边岛真的被这条管线生成：陆地占比、台地层数、渲染提交数；
 *   ⑤ 格线层跟着晶格走：唯一格线段数 ÷ 陆地格数，六边 ≈8.3 / 方 ≈4.1 / 三角 ≈2.8（三档互不相同）；
 *   ⑥ 0 页面错误。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const KINDS = [
  { kind: 'hex', label: '纯六边形', n: 6, perVertex: 3, segLow: 7.4, segHigh: 9.2 },
  { kind: 'square', label: '纯方格', n: 4, perVertex: 4, segLow: 3.7, segHigh: 4.5 },
  { kind: 'tri', label: '纯三角', n: 3, perVertex: 6, segLow: 2.5, segHigh: 3.1 },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });

  const out = { ok: true, checks: [], kinds: {} };
  const check = (n, c, d) => { out.checks.push({ name: n, pass: !!c, detail: d }); if (!c) out.ok = false; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n} — ${d}`); };

  try {
    for (const k of KINDS) {
      await page.goto(`http://127.0.0.1:8769/index.html?grid=${k.kind}&scene=terrain`, { waitUntil: 'load' });
      await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 10 && window.rea.view.renderer.info.render.calls > 0, null, { timeout: 90000 });
      const m = await page.evaluate(() => {
        const g = rea.grid, w = rea.world, v = rea.view;
        // ③ 顶点/边关联直方图 → 晶格类型
        const byV = new Map(), byE = new Map();
        for (const c of g.cells) {
          for (const q of c.pts) byV.set(q.id, (byV.get(q.id) || 0) + 1);
          for (let i = 0; i < c.n; i++) {
            const a = c.pts[i].id, b = c.pts[(i + 1) % c.n].id;
            byE.set(a < b ? a + ':' + b : b + ':' + a, (byE.get(a < b ? a + ':' + b : b + ':' + a) || 0) + 1);
          }
        }
        const sides = {}; for (const c of g.cells) sides[c.n] = (sides[c.n] || 0) + 1;
        const levels = new Set(); let land = 0;
        for (const c of g.cells) { const t = w.top(c); if (t > 0) { land++; levels.add(+t.toFixed(3)); } }
        // 半边互反（六边铺砌的邻接契约与 quad/mixed 同一条）
        let reciprocalBad = 0, nbChecked = 0;
        for (const c of g.cells) c.edgeNeighbors.forEach((ni, ei) => {
          if (ni < 0) return; nbChecked++;
          const o = g.cells[ni], j = c.edgeTwins?.[ei] ?? o.edgeNeighbors.indexOf(c.id);
          if (o.edgeNeighbors[j] !== c.id) reciprocalBad++;
        });
        // ⑤ 格线层
        v.setDebug('grid', true);
        const st = v.setGridSurface ? v.setGridSurface(true) : null;
        const arr = v.gridLines.geometry.attributes.position.array;
        const uniq = new Set();
        for (let i = 0; i < arr.length; i += 6) {
          const a = [arr[i], arr[i + 1], arr[i + 2]].map((x) => x.toFixed(3)).join(',');
          const b = [arr[i + 3], arr[i + 4], arr[i + 5]].map((x) => x.toFixed(3)).join(',');
          uniq.add(a < b ? a + '|' + b : b + '|' + a);
        }
        const btns = [...document.querySelectorAll('.gridswitch button')].map((x) => ({ t: x.textContent, on: x.classList.contains('active') }));
        return {
          gridKind: rea.gridKind, cells: g.cells.length, sides,
          v: byV.size, e: byE.size, euler: byV.size - byE.size + g.cells.length,
          perVertex: Math.max(...byV.values()),
          vHist: Object.fromEntries([...new Set(byV.values())].sort((a, b) => a - b).map((n) => [n, [...byV.values()].filter((x) => x === n).length])),
          land, landRatio: +(land / g.cells.length).toFixed(4), terraces: levels.size, levels: [...levels].sort((a, b) => a - b),
          nbChecked, reciprocalBad, btns,
          calls: v.renderer.info.render.calls, tris: v.renderer.info.render.triangles,
          lineSegs: uniq.size, lineCells: st?.cells ?? null, segPerCell: st?.cells ? +(uniq.size / st.cells).toFixed(3) : null,
          url: location.search,
        };
      });
      out.kinds[k.kind] = m;
      console.log(`  [${k.kind}] ` + JSON.stringify({ cells: m.cells, sides: m.sides, land: m.land, terraces: m.terraces, perVertex: m.perVertex, euler: m.euler, segPerCell: m.segPerCell, tris: m.tris }));

      check(`①[${k.kind}] 页面按 ?grid=${k.kind} 选中「${k.label}」且是地形场景`,
        m.gridKind === k.kind && m.btns.length === 5 && m.btns.find((b) => b.on)?.t === k.label && /scene=terrain/.test(m.url),
        `gridKind=${m.gridKind} 高亮=${m.btns.find((b) => b.on)?.t} 按钮=${m.btns.map((b) => b.t).join('/')}`);
      check(`②[${k.kind}] 每格恒为 ${k.n} 边（纯净格型）`,
        Object.keys(m.sides).length === 1 && Number(Object.keys(m.sides)[0]) === k.n,
        JSON.stringify(m.sides));
      check(`③[${k.kind}] 顶点最多被 ${k.perVertex} 格共用 + V−E+F=1（晶格类型与圆盘拓扑）`,
        m.perVertex === k.perVertex && m.euler === 1 && m.reciprocalBad === 0,
        `perVertex=${m.perVertex} V=${m.v} E=${m.e} F=${m.cells} euler=${m.euler} 互反违例=${m.reciprocalBad}/${m.nbChecked}`);
      check(`④[${k.kind}] 同一套地形管线真的生成出岛（陆地占比 / 台地层数 / 渲染提交）`,
        m.landRatio > 0.15 && m.landRatio < 0.95 && m.terraces >= 3 && m.calls > 0 && m.tris > 1000,
        `陆地 ${m.land}/${m.cells}=${m.landRatio} 台地 ${m.terraces} 层 ${JSON.stringify(m.levels)} calls=${m.calls} tris=${m.tris}`);
      check(`⑤[${k.kind}] 格线层按晶格画（唯一段/陆地格 ≈${k.segLow}–${k.segHigh}）`,
        m.segPerCell >= k.segLow && m.segPerCell <= k.segHigh,
        `格线 ${m.lineSegs} 段 / 陆地格 ${m.lineCells} = ${m.segPerCell}`);

      await page.screenshot({ path: `artifacts/coverage/grid-kinds-${k.kind}-island.png` });
    }

    // ① 页面内换网格：hex → 点「纯方格」→ 换网格后场景仍是地形
    await page.goto('http://127.0.0.1:8769/index.html?grid=hex&scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 10, null, { timeout: 90000 });
    await page.getByRole('button', { name: '纯方格', exact: true }).click();
    await page.waitForURL(/grid=square/, { timeout: 60000 });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 10, null, { timeout: 120000 });
    const after = await page.evaluate(() => ({ url: location.search, kind: rea.gridKind, sides: rea.grid.cells.reduce((m, c) => (m[c.n] = (m[c.n] || 0) + 1, m), {}) }));
    check('① 页面内「纯六边形 → 纯方格」换网格后场景不丢',
      after.kind === 'square' && /grid=square/.test(after.url) && /scene=terrain/.test(after.url) && Object.keys(after.sides).join() === '4',
      `url=${after.url} kind=${after.kind} sides=${JSON.stringify(after.sides)}`);

    check('⑥ 0 页面/控制台错误', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
  } catch (e) {
    check('运行', false, e.message);
  } finally {
    await browser.close();
  }
  fs.writeFileSync('artifacts/coverage/grid-kinds-hex-island.json', JSON.stringify({ ok: out.ok, checks: out.checks, kinds: out.kinds }, null, 2));
  console.log(out.ok ? 'grid-kinds-hex-island ALL PASS' : 'grid-kinds-hex-island FAILED');
  process.exit(out.ok ? 0 : 1);
})();
