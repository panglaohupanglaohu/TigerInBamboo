/**
 * grid-shared-edge-browser.cjs — 第 75 轮 · 1120036868966502401 缺口 ①「2748 段 vs 原片 5116 段是总量比」
 *
 * 原片证据（本轮新量）：frame-0455 原尺寸 460×460 的 3× 裁切（/tmp 留存，见 review md）
 *   —— 白色格线在**地平面**上是一条等距方格网，格距 ≈20px、线宽 ≈2px（JPEG 边缘算 1px，中位 2px，
 *      见第 73 轮顶帽+游程量法），**每条格边只有一条线**：相邻两格共享的那条边没有画两遍（没有 4px 双线）。
 *   所以「原片每格边段数」不是个独立参数，它就是 1.0 段/格边 —— 判据应当写成「共享边去重」，
 *   而不是拿总段数 2748 去比一个整层平面档的 5116。
 *
 * 判据（全部读活几何 + 独立从 town 重算，不看 exit code）：
 *   ① 贴面档生效（surface=true、cells>600）；
 *   ② 几何里的水平段数 **等于** 从 town 独立算出的唯一 (边@y) 数 → 共享边只画一次，无重复线；
 *   ③ 每格边段数落在 [2.0, 3.2]（三角-四边形混合网格的欧拉值），且与独立值逐位相等；
 *   ④ 竖边数 == 独立算出的「邻格更低」端点 (点@上y>下y) 去重数；
 *   ⑤ 同一格边两侧高度相同时**只有一条**水平段（直接反证双线）。
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (n, c, d) => { out.checks.push({ name: n, pass: !!c, detail: d }); if (!c) out.ok = false; console.log(`  ${c ? 'PASS' : 'FAIL'} ${n} — ${d}`); };

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=terrain', { waitUntil: 'load' });
    await page.waitForFunction(() => (window.rea?.world?.cells?.length || 0) > 200, null, { timeout: 90000 });
    await page.waitForFunction(() => window.rea?.view?.renderer?.info?.render?.calls > 0, null, { timeout: 90000 });

    const m = await page.evaluate(() => {
      const v = rea.view, town = v.town, L = v.levelHeight || 1;
      v.setDebug('grid', true);
      const st = v.setGridSurface(true);
      const p = v.gridLines.geometry.attributes.position.array;
      const segs = [];
      for (let i = 0; i < p.length; i += 6) segs.push({ ax: p[i], ay: p[i + 1], az: p[i + 2], bx: p[i + 3], by: p[i + 4], bz: p[i + 5] });

      // 独立重算：唯一 (边@y) 与唯一竖边
      const uniqH = new Set(), uniqV = new Set();
      const perEdge = new Map();          // 边(无序顶点 id) → 本帧被画了几次（同高度只应 1 次）
      let cellCount = 0, dropEdges = 0, sameHeightEdges = 0, dupSameHeight = 0;
      for (const c of town.cells) {
        if (!c.pts || c.n < 3) continue;
        const t = town.top(c); if (!(t > 0)) continue;
        cellCount++;
        const y = t * L + 0.015, yk = y.toFixed(3);
        for (let i = 0; i < c.n; i++) {
          const a = c.pts[i], b = c.pts[(i + 1) % c.n];
          const ek = (a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id);
          uniqH.add(ek + '@' + yk);
          const nb = town.neighbor(c, i);
          if (!nb) continue;
          const nt = town.top(nb);
          if (nt >= t) { sameHeightEdges++; perEdge.set(ek, (perEdge.get(ek) || 0) + 1); continue; }
          dropEdges++;
          const ny = nt * L + 0.015, nk = ny.toFixed(3);
          for (const q of [a, b]) uniqV.add(q.id + '@' + yk + '>' + nk);
        }
      }
      // 几何侧统计
      const geoH = new Set(), geoV = new Set();
      let horiz = 0, vert = 0, bad = 0;
      for (const s of segs) {
        if (Math.abs(s.ay - s.by) < 1e-6) {
          horiz++;
          geoH.add([s.ax, s.ay, s.az, s.bx, s.bz].map((x) => x.toFixed(3)).join(','));
        } else if (Math.abs(s.ax - s.bx) < 1e-6 && Math.abs(s.az - s.bz) < 1e-6) {
          vert++;
          geoV.add([s.ax, s.az, s.ay, s.by].map((x) => x.toFixed(3)).join(','));
        } else bad++;
      }
      return {
        st, horiz, vert, bad, cells: cellCount,
        uniqH: uniqH.size, uniqV: uniqV.size, dropEdges, sameHeightEdges,
        geoH: geoH.size, geoV: geoV.size,
        perCell: +(horiz / cellCount).toFixed(3),
        perCellRef: +(uniqH.size / cellCount).toFixed(3),
        // ⑤ 的两种量：① 被两侧格子各访问一次的**共享边**有多少条；② 几何里比唯一集多出来的**重复线**有多少条
        sharedEdges: [...perEdge.values()].filter((n) => n >= 2).length,
        dupLines: horiz - geoH.size,
      };
    });

    console.log('  量测：' + JSON.stringify(m));
    check('① 贴面档生效', m.st.surface === true && m.cells > 600, `surface=${m.st.surface} cells=${m.cells} maxY=${m.st.maxY}`);
    check('② 共享边只画一次（几何段数 == 独立唯一 (边@y) 数）',
      m.horiz === m.uniqH && m.geoH === m.uniqH, `几何水平段 ${m.horiz} / 唯一集 ${m.geoH} / 独立算 ${m.uniqH}`);
    check('③ 每格边段数在三角-四边形混合网格的欧拉区间 [2.0, 3.2]，且与独立值相等',
      m.perCell >= 2.0 && m.perCell <= 3.2 && Math.abs(m.perCell - m.perCellRef) < 1e-6, `实测 ${m.perCell} 段/格边（独立 ${m.perCellRef}）`);
    check('④ 竖边 == 独立唯一竖边数', m.vert === m.uniqV, `几何 ${m.vert} / 独立 ${m.uniqV}（跨层边 ${m.dropEdges}）`);
    check('⑤ 共享边无重复线（原片一格里每条边只有一条 2px 线）', m.dupLines === 0 && m.bad === 0 && m.sharedEdges > 500,
      `共享边 ${m.sharedEdges} 条被两侧各访问一次 → 几何重复线 ${m.dupLines}、异形段 ${m.bad}`);
    check('无页面错误', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
  } catch (e) {
    check('运行', false, e.message);
  } finally {
    await browser.close();
  }
  console.log(out.ok ? 'grid-shared-edge ALL PASS' : 'grid-shared-edge FAILED');
  console.log(JSON.stringify({ ok: out.ok, checks: out.checks }, null, 1));
  process.exit(out.ok ? 0 : 1);
})();
