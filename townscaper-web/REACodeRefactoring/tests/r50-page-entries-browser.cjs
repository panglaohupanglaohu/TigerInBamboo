// 第 103 轮 · [010] 组的页面入口运行验收（第 50 轮迁入的 9 个模块原本只有 node 验收）
//   ① grids.html?t=infinite —— 平移窗口（origin 任意块中心）+ windowSeam 重叠顶点逐位一致（quadinf 1151137783785771008）
//   ② wfc.html —— diagnoseTiles 存活诊断面板（socketrock 1164926304640229376）
//   ③ navmesh-flow.html —— 漏斗路径：逐边中点 → funnelPath → shortcutPath（triflowfield 972829402873716737）
//   ④ ui.html —— 等墨量图标（icon-ink DEFAULT_ICONS 路径集经工具条反解线宽）（uidecor 1201179450668441600）
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.COVERAGE_BASE || 'http://localhost:8769';
const OUT = 'artifacts/coverage';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const out = {};
  try {
    /* ---------- ① grids.html 平移窗口 ---------- */
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}/grids.html?t=infinite`);
      await page.waitForFunction(() => window.gridLab?.infiniteReview, null, { timeout: 30000 });
      const start = await page.evaluate(() => gridLab.infiniteReview);
      assert.deepEqual(start.origin, [0, 0], '初始窗口在原块');
      assert.equal(start.report.flipped, 0); assert.equal(start.report.invalid, 0);
      const seams = [];
      for (let i = 0; i < 3; i++) {
        const r = await page.evaluate(() => { gridLab.panInfinite(0); return gridLab.infiniteReview; });
        seams.push({ origin: r.origin, compared: r.seam.compared, max: r.seam.max });
        assert.ok(r.seam.compared > 30, `平移 ${i + 1} 次后有足够重叠顶点（${r.seam.compared}）`);
        assert.ok(r.seam.max < 1e-9, `平移 ${i + 1} 次后重叠顶点位置一致（最大差 ${r.seam.max}）`);
        assert.equal(r.report.flipped, 0, '平移后不翻折'); assert.equal(r.report.invalid, 0, '平移后无非法格');
      }
      // 换一个方向再走一步（-dir），仍然逐位一致
      const r2 = await page.evaluate(() => { gridLab.panInfinite(3); return gridLab.infiniteReview; });
      assert.ok(r2.seam.max < 1e-9, '反方向平移同样无缝');
      const stat = await page.textContent('#stat');
      assert.ok(/窗口 origin \(16,-8\)/.test(stat) || /窗口 origin/.test(stat), '状态行显示当前窗口 origin');
      assert.ok(/平移接缝 [0-9]+ 顶点最大差/.test(stat), '状态行显示平移接缝的顶点数与最大差');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${OUT}/grids-infinite-pan.png` });
      out.grids = { start: start.origin, seams, back: { origin: r2.origin, max: r2.seam.max, compared: r2.seam.compared } };
      await page.close();
    }

    /* ---------- ② wfc.html 存活诊断 ---------- */
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}/wfc.html`);
      await page.waitForFunction(() => !!window.wfcReview, null, { timeout: 30000 });
      await page.click('#diag');
      const d = await page.evaluate(() => window.wfcDiagnostics);
      assert.ok(d.cells > 0, 'diagnoseTiles 覆盖真实格');
      const alive = Object.values(d.alive).filter((n) => n > 0).length;
      assert.ok(alive > 0, '有活 tile');
      assert.equal(d.dead.length, 0, '全接口集 + 无边界锁 → 没有死 tile');
      assert.equal(d.unpaired, 0, '没有无人接的接口');
      assert.equal(d.boundaryLocked, false);
      assert.equal(d.lockedDead.length, 0, '这套二进制接口集下锁边界没有额外剔除（如实记录，不硬造死 tile）');
      assert.equal(d.narrowDead, 1, '窄册（只给 3:0 三角）里那唯一一个 tile 被判死（四边形格无处可放 → 空域外溢）');
      assert.equal(d.narrowAlive, 0, '窄册里 3:0 的存活格数归零');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${OUT}/wfc-diagnose.png` });
      out.wfc = { cells: d.cells, alive, dead: d.dead.length, unpaired: d.unpaired, lockedAlive: d.lockedAlive, lockedDead: d.lockedDead.length, narrowDead: d.narrowDead, narrowAlive: d.narrowAlive };
      await page.close();
    }

    /* ---------- ③ navmesh-flow.html 漏斗路径 ---------- */
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}/navmesh-flow.html`);
      await page.waitForFunction(() => !!window.navmeshFlowFunnelReview, null, { timeout: 30000 });
      const f = await page.evaluate(() => {
        const r = window.navmeshFlowFunnelReview;
        return { corridor: r.corridor, mid: r.mid, funnel: r.funnel, shortcut: r.shortcut, inMesh: r.inMesh, drop: r.drop, heights: r.heights };
      });
      assert.ok(f.corridor >= 3, `走廊至少 3 个通口（${f.corridor}）`);
      assert.ok(f.mid.points > f.funnel.points, '漏斗后折点数下降');
      assert.ok(f.funnel.length <= f.mid.length + 1e-9, `拉直不更长（${f.mid.length.toFixed(2)} → ${f.funnel.length.toFixed(2)}）`);
      assert.ok(f.shortcut.length <= f.funnel.length + 1e-9, `视线捷径不更长（${f.shortcut.length.toFixed(2)}）`);
      assert.equal(f.inMesh, true, '整条路径都在导航面内');
      assert.ok(f.shortcut.turns <= f.mid.turns, '折角数不增加');
      assert.ok(f.heights.every((h) => h !== null), '每个点都在面内（高度可取值）');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${OUT}/navmesh-funnel.png` });
      out.funnel = { corridor: f.corridor, mid: +f.mid.length.toFixed(3), funnel: +f.funnel.length.toFixed(3), shortcut: +f.shortcut.length.toFixed(3), turns: [f.mid.turns, f.funnel.turns, f.shortcut.turns], drop: f.drop, points: f.shortcut.points };
      await page.close();
    }

    /* ---------- ④ ui.html 等墨量图标 ---------- */
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}/ui.html`);
      await page.waitForFunction(() => !!window.uiLab, null, { timeout: 30000 });
      await page.click('#tabs button[data-t="icons"]');
      await page.waitForFunction(() => window.inkReview && window.inkReview.buttons > 0, null, { timeout: 30000 });
      const k = await page.evaluate(() => window.inkReview);
      assert.ok(k.buttons >= 5, `等墨量图标至少 5 个（${k.buttons}）`);
      assert.equal(k.svgs, k.buttons, '每个按钮都拿到内联 SVG（路径集，不是位图）');
      for (const w of k.widths) assert.ok(w >= 1.55 && w <= 2.45, `线宽夹在上下限内（${w}）`);
      assert.ok(new Set(k.widths).size > 1, '线宽按路径长逐个反解（不是整组同一个数）');
      assert.ok(k.cvEq < k.cvFit && k.cvFit < k.cvRaw, `墨量离散度 ${k.cvRaw} → ${k.cvFit} → ${k.cvEq}`);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${OUT}/ui-ink.png` });
      out.ink = k;
      await page.close();
    }

    fs.writeFileSync(`${OUT}/r50-page-entries.json`, JSON.stringify(out, null, 2));
    console.log('ALL PASS');
    console.log(JSON.stringify(out));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
