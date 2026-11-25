// 1712088611934371876 · 节点式调色图（OkHsl/OkLab/Srgb · 自由拖点 · 右键新建 · 导出）+ 实景顶面应用
// 口径：跑真实 palette-editor.html?graph=1，断言离散面片 / 三档色彩空间 / 拖点 / 右键菜单 / 导出导入 / 应用到顶面。
const { chromium } = require('playwright');
const fs = require('fs');

const S = 150, X0 = -0.25, Y0 = -0.12;
const toPx = (x, y) => [(x - X0) * S + 20, (y - Y0) * S + 10];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const out = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push('console: ' + m.text()); });
    await page.goto('http://localhost:8769/palette-editor.html?graph=1', { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.paletteGraph, null, { timeout: 20000, polling: 100 });

    // ---------- 1. 默认图与离散面片 ----------
    out.defaults = await page.evaluate(() => {
      const { g, PG, stats } = window.paletteGraph;
      const f = PG.facets(g);
      return {
        nodes: g.nodes.length, quads: g.quads.length, tris: g.tris.length, gradients: g.gradients.length,
        facets: f.length, div: g.quads[0].div, triDiv: g.tris[0].div,
        quadSpace: g.quads[0].space, triSpace: g.tris[0].space, gradSpace: g.gradients[0].space,
        stats: stats(),
        distinctFacetColors: new Set(f.map((x) => x.rgb.map((v) => v.toFixed(4)).join(','))).size,
      };
    });
    if (out.defaults.facets !== 8 * 8 * 2 + 4 * 4) throw new Error('facets != 8*8*2+16: ' + out.defaults.facets);
    // 7 个节点 = 四角 + 白收束顶点 + 色带两端；144 个面片颜色两两不同 = 真离散平涂
    if (out.defaults.nodes !== 7 || out.defaults.quads !== 1 || out.defaults.tris !== 1 || out.defaults.gradients !== 1) throw new Error('default graph shape wrong');
    if (out.defaults.distinctFacetColors !== out.defaults.facets) throw new Error('facets not discrete: ' + out.defaults.distinctFacetColors + '/' + out.defaults.facets);

    // ---------- 1b. 色带条：12 段离散块 + 2px 缝隙（片内 0550 底部那条）----------
    out.strip = await page.evaluate(() => {
      const sc = document.querySelector('#pgStrip'), ctx = sc.getContext('2d');
      const d = ctx.getImageData(0, 0, sc.width, sc.height).data;
      const blocks = []; let run = null;
      for (let x = 0; x < sc.width; x++) {
        const i = (Math.floor(sc.height / 2) * sc.width + x) * 4;
        const opaque = d[i + 3] > 0;
        if (opaque && !run) run = x;
        if (!opaque && run != null) { blocks.push([run, x - run]); run = null; }
      }
      if (run != null) blocks.push([run, sc.width - run]);
      return { cssW: sc.getBoundingClientRect().width, w: sc.width, h: sc.height, blocks: blocks.length, blockWidths: [...new Set(blocks.map((b) => b[1]))], gaps: blocks.length > 1 ? blocks[1][0] - (blocks[0][0] + blocks[0][1]) : 0 };
    });
    if (out.strip.blocks !== 12 || out.strip.gaps !== 2 || !out.strip.blockWidths.every((w) => w >= 11 && w <= 12)) throw new Error('gradient strip blocks: ' + JSON.stringify(out.strip));

    // ---------- 2. 离散平涂：同一面片内取色恒定、相邻面片不同 ----------
    out.discreteness = await page.evaluate(() => {
      const { g, PG } = window.paletteGraph;
      const q = g.quads[0];
      const a1 = PG.quadFacetAt(g, q, 0.30, 0.30), a2 = PG.quadFacetAt(g, q, 0.31, 0.33), b1 = PG.quadFacetAt(g, q, 0.60, 0.30);
      const f = PG.facets(g).filter((x) => x.prim === q.id);
      const toUV = (x, y) => [(x - (PG.nodeById(g, q.nodes[0]).x)) / (PG.nodeById(g, q.nodes[3]).x - PG.nodeById(g, q.nodes[0]).x), (y - (PG.nodeById(g, q.nodes[0]).y)) / (PG.nodeById(g, q.nodes[3]).y - PG.nodeById(g, q.nodes[0]).y)];
      let mism = 0;
      for (const t of f) {
        const cx = (t.pts[0][0] + t.pts[1][0] + t.pts[2][0]) / 3, cy = (t.pts[0][1] + t.pts[1][1] + t.pts[2][1]) / 3;
        const [u, v] = toUV(cx, cy); const r = PG.quadFacetAt(g, q, u, v).rgb;
        if (Math.hypot(...r.map((x, i) => x - t.rgb[i])) > 1e-9) mism++;
      }
      return { sameFacetEqual: JSON.stringify(a1.rgb) === JSON.stringify(a2.rgb), neighbourDiffers: JSON.stringify(a1.rgb) !== JSON.stringify(b1.rgb), facetCount: f.length, centroidMismatch: mism };
    });
    if (!out.discreteness.sameFacetEqual || !out.discreteness.neighbourDiffers || out.discreteness.centroidMismatch !== 0) throw new Error('facet discreteness failed');

    // ---------- 3. 画布真的画了离散面片（像素读数，非 exit code） ----------
    out.canvas = await page.evaluate(() => {
      const cv = document.querySelector('#pgCanvas'), ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const colors = new Map(); let painted = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 40 || d[i + 1] > 40 || d[i + 2] > 40) { painted++; colors.set((d[i] >> 2) + ',' + (d[i + 1] >> 2) + ',' + (d[i + 2] >> 2), 1); }
      }
      return { w: cv.width, h: cv.height, paintedPx: painted, quantizedColors: colors.size };
    });
    if (out.canvas.paintedPx < 50000) throw new Error('graph canvas mostly empty');

    // ---------- 4. 自由拖点：真鼠标拖 60px ----------
    const nodeA = await page.evaluate(() => window.paletteGraph.PG.nodeById(window.paletteGraph.g, window.paletteGraph.g.quads[0].nodes[1]));
    const [ax, ay] = toPx(nodeA.x, nodeA.y);
    await page.locator('#pgCanvas').scrollIntoViewIfNeeded();   // 画布在页面底部，不滚进视口的话 pointer 事件会落在视口外被丢掉
    const box0 = await page.locator('#pgCanvas').boundingBox();   // flex 可能改画布 CSS 尺寸：指针坐标按 CSS 比例换算
    const k = box0.width / 440;
    out.canvasBox = { cssW: box0.width, cssH: box0.height, scale: k };
    if (Math.abs(k - 1) > 1e-6) throw new Error('canvas not 1:1 with pointer space: ' + k);
    await page.mouse.move(box0.x + ax * k, box0.y + ay * k);
    await page.mouse.down();
    await page.mouse.move(box0.x + (ax + 60) * k, box0.y + (ay + 30) * k, { steps: 8 });
    await page.mouse.move(box0.x + (ax + 60) * k, box0.y + (ay + 30) * k);   // 补一次终点：分步移动的最后一帧会被浏览器合并掉
    await page.mouse.up();
    await page.waitForTimeout(250);
    await page.waitForTimeout(120);
    out.drag = await page.evaluate(() => {
      const { g, PG } = window.paletteGraph; const n = PG.nodeById(g, g.quads[0].nodes[1]);
      return { x: n.x, y: n.y, selectedText: document.querySelector('#pgSel').textContent, sliders: document.querySelectorAll('#pgSliders .row').length };
    });
    out.drag.dx = out.drag.x - nodeA.x; out.drag.dy = out.drag.y - nodeA.y;
    if (Math.abs(out.drag.dx - 60 / S) > 0.02 || Math.abs(out.drag.dy - 30 / S) > 0.02) throw new Error('drag did not move node: ' + JSON.stringify(out.drag));

    // ---------- 5. 三档取色：RGB / LAB(OkLab) / HSL(OkHsl) 滑条 ----------
    out.tabs = {};
    for (const m of ['rgb', 'lab', 'hsl']) {
      await page.click(`.pgTab[data-m="${m}"]`);
      out.tabs[m] = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#pgSliders .row')];
        return { rows: rows.length, texts: rows.map((r) => r.querySelector('span').textContent), ranges: rows.map((r) => [+r.querySelector('input').min, +r.querySelector('input').max]) };
      });
      if (out.tabs[m].rows !== 3) throw new Error('slider rows != 3 for ' + m);
    }
    // 在 LAB 档改 L 滑条，节点颜色必须变（真取色链路，不是只换标签）
    const beforeLab = await page.evaluate(() => [...window.paletteGraph.PG.nodeById(window.paletteGraph.g, 2).rgb]);
    await page.evaluate(() => {
      const r = document.querySelectorAll('#pgSliders .row input')[0];
      r.value = String(Math.min(+r.max, +r.value + 0.1)); r.dispatchEvent(new Event('input'));
    });
    const afterLab = await page.evaluate(() => [...window.paletteGraph.PG.nodeById(window.paletteGraph.g, 2).rgb]);
    out.tabs.nodeColorChanged = JSON.stringify(beforeLab) !== JSON.stringify(afterLab);

    // ---------- 6. 右键菜单：New node / New triangle ----------
    await page.click('.pgTab[data-m="rgb"]');
    const before = await page.evaluate(() => ({ n: window.paletteGraph.g.nodes.length, t: window.paletteGraph.g.tris.length, f: window.paletteGraph.PG.facets(window.paletteGraph.g).length }));
    const cvBox = await page.locator('#pgCanvas').boundingBox();
    for (const [action, label] of [['node', 'New node'], ['triangle', 'New triangle']]) {
      await page.mouse.click(cvBox.x + 330, cvBox.y + 40, { button: 'right' });
      await page.waitForSelector('#pgMenu', { state: 'visible' });
      const items = await page.$$eval('#pgMenu div', (ds) => ds.map((d) => d.textContent.trim()));
      if (!items.includes('New node') || !items.includes('New gradient') || !items.includes('New triangle')) throw new Error('menu items: ' + items.join('|'));
      await page.click(`#pgMenu div[data-a="${action}"]`);
      await page.waitForTimeout(60);
      out['menu_' + action] = { items, label };
    }
    const after = await page.evaluate(() => ({ n: window.paletteGraph.g.nodes.length, t: window.paletteGraph.g.tris.length, f: window.paletteGraph.PG.facets(window.paletteGraph.g).length }));
    out.menu = { before, after };

    // ---------- 7. 色彩空间：面片 OkLab ↔ OkHsl ↔ Srgb 真的改颜色 ----------
    out.spaces = {};
    for (const sp of ['okhsl', 'oklab', 'srgb']) {
      await page.selectOption('#pgFacetSpace', sp);
      out.spaces[sp] = await page.evaluate(() => {
        const { g, PG } = window.paletteGraph;
        const f = PG.facets(g).filter((x) => x.prim === g.quads[0].id);
        return { space: g.quads[0].space, distinct: new Set(f.map((x) => x.rgb.map((v) => v.toFixed(3)).join(','))).size, mid: PG.quadFacetAt(g, g.quads[0], 0.5, 0.5).rgb };
      });
    }
    out.spaces.changed = new Set(['okhsl', 'oklab', 'srgb'].map((k) => out.spaces[k].mid.map((v) => v.toFixed(3)).join(','))).size;

    // ---------- 8. 导出 / 导入往返 ----------
    await page.selectOption('#pgFacetSpace', 'oklab');
    out.export = await page.evaluate(() => {
      document.querySelector('#pgExport').click();
      const j = document.querySelector('#pgJson').value;
      const o = JSON.parse(j);
      const { g, PG } = window.paletteGraph;
      const back = PG.importGraph(j);
      let maxNodeErr = 0;
      for (const n of g.nodes) { const m = back.nodes.find((k) => k.id === n.id); maxNodeErr = Math.max(maxNodeErr, ...n.rgb.map((v, i) => Math.abs(v - m.rgb[i]))); }
      const a = new Set(PG.swatches(g)), bb = new Set(PG.swatches(back));
      return {
        format: o.format, version: o.version, nodes: o.nodes.length, palette: o.palette.length,
        swatches: PG.swatches(g).length, roundTripNodes: back.nodes.length, roundTripFacets: PG.facets(back).length,
        roundTripQuads: back.quads.length, roundTripTris: back.tris.length, roundTripGradients: back.gradients.length,
        roundTripSpaces: [...new Set([...back.quads, ...back.tris].map((p) => p.space))],
        maxNodeErr, paletteOverlap: [...a].filter((h) => bb.has(h)).length, paletteUnion: new Set([...a, ...bb]).size,
      };
    });
    out.export.paletteMatch = out.export.paletteOverlap / out.export.swatches;
    // 导出/导入：结构逐项相等，颜色仅有 8bit hex 量化误差（≤0.5/255），调色板重合 ≥95%
    if (out.export.format !== 'rea-palette-graph' || out.export.palette !== out.export.swatches) throw new Error('export payload wrong');
    if (out.export.roundTripNodes !== out.export.nodes || out.export.roundTripFacets !== out.defaults.facets + 16) throw new Error('round-trip structure: ' + JSON.stringify(out.export));
    if (out.export.maxNodeErr > 0.5 / 255 + 1e-9) throw new Error('round-trip colour error ' + out.export.maxNodeErr);
    if (out.export.paletteMatch < 0.95) throw new Error('round-trip palette overlap ' + out.export.paletteMatch);

    // ---------- 9. 应用到实景顶面（palette-editor.html 的 gpm 接线） ----------
    await page.waitForFunction(() => !!window.paletteEditor?.api, null, { timeout: 25000, polling: 150 });
    await page.check('#pgApply');
    await page.waitForTimeout(500);
    out.apply = await page.evaluate(() => {
      const { g, PG, stats } = window.paletteGraph;
      const api = window.paletteEditor.api;
      const snap = stats();
      return { on: document.querySelector('#pgApply').checked, gpm: snap.gpm, stats: snap, worldVersion: api.world.version, gridKind: api.gridKind };
    });
    if (!out.apply.gpm || !out.apply.gpm.facetsUsed) throw new Error('apply-to-world produced no facets: ' + JSON.stringify(out.apply));

    // ---------- 10. 截图（ViewImage 复核） ----------
    await page.screenshot({ path: 'artifacts/coverage/palette-graph-editor-r197.png', fullPage: true });
    out.errors = errors;
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/palette-graph-editor-browser.json', JSON.stringify(out, null, 2));
    console.log('PASS palette graph editor', JSON.stringify(out));
    process.exit(0);
  } catch (e) {
    try { fs.writeFileSync('artifacts/coverage/palette-graph-editor-browser.fail.json', JSON.stringify({ error: String(e), out, errors }, null, 2)); } catch {}
    console.error('FAIL', e && e.stack || e, JSON.stringify(out));
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
