// 1120036868966502401 缺口 ②（第 161 轮）· 运行时验收：主场景编辑器的「选中 / 多选 / 撤销联动」。
//
// 片内口径（703 帧 / 14.63fps·"It's marching squares on irregular quadrilateral grids"，已全片核过 15 轮）：
// frame-0300 / 0445 / 0620 里那块白格网补丁**只画在正在编辑的对象上**，位置逐段跟着被编辑的岛体跑；
// 画面里同时有红色（跨多格）与蓝色（单格）两种选择轮廓 —— 也就是编辑器有「选中 / 多选」这件事。
// 第 94–98 轮已经把「选中态 → 包围盒 → 补丁窗口」做在 quad-lattice.js#selectionBounds / view.setGridWindowForSelection，
// 但选中态一直靠外部手灌（测试里写死 id），note 挂了几轮的「仍缺与真编辑器撤销/多选联动」= 这一层。
//
// 本轮验收（全部走真实指针/键盘/按钮，不调内部函数造状态）：
//   ① HUD 有「选择」格、点了能切成选择工具；
//   ② 真实点击 = 单格选中 → 补丁窗口按该格包围盒出现（kept < total，边界对齐格点）；
//   ③ Shift 点第二格 = 多选 → 包围盒变大、窗口跟着变大且同时包住两格；
//   ④ Esc = 取消 → 窗口清掉、格线回到铺满；
//   ⑤ 撤销/重做**逐条带回选中态**：选中 A → 建造（A 长高）→ Esc 清选中 → Z 撤销 → 选中 A 回来且窗口回来 → Y 重做 → 回到撤销时的空选中；
//   ⑥ 清空按钮（世界重置）→ 选中被 prune 掉、窗口跟着清空（不是留着指向不存在的格子）。
const { chromium } = require('playwright');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shot = path.join(__dirname, '..', 'artifacts', 'coverage', 'grid-window-editor.png');
const problems = [];
const check = (name, ok, detail) => {
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${d ? ' :: ' + d : ''}`);
  if (!ok) problems.push(name + ' :: ' + d);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=town&grid=quad&seed=3&gridwin=1', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.selection && window.reaView?.gridStats?.regular, null, { polling: 200, timeout: 90000 });
    await page.waitForTimeout(600);

    /* ---------- ① 工具格入口 ---------- */
    const hasSelect = await page.$eval('[data-tool="select"]', (b) => b.title).catch(() => null);
    check('① HUD 有「选择」格', !!hasSelect, hasSelect || '缺按钮');
    await page.click('[data-tool="select"]');
    const active = await page.$eval('[data-tool="select"]', (b) => b.classList.contains('active'));
    check('① 点一下切成选择工具（按钮高亮）', active, { active });

    const full = await page.evaluate(() => {
      const v = window.reaView;
      return { total: v.gridStats.segments, win: v.gridStats.window, regular: !!v.gridStats.regular, step: v.gridLatticeStep, linesVisible: v.gridLines.visible, dbg: v.debugState?.grid };
    });
    check('① 等距格已就位（有格距可对齐）', full.regular && full.step > 0, full);
    // 坑（本轮实测）：面板挂载时会重放 setDebug，`?gridwin=1` 若在面板之前打开，格线可见性会被改回 false ——
    // 几何在、画面一根线都没有。所以「开档」必须断言到**可见性**，不能只看 gridStats。
    check('① 格线真的可见（不是几何在、visible=false）', full.linesVisible === true && full.dbg === true, { linesVisible: full.linesVisible, dbg: full.dbg });
    check('① 初始没有窗口（铺满）', full.win === null, full.win);

    /* ---------- 找两格真实可点的建筑格（不硬编码 id） ---------- */
    const picks = await page.evaluate(() => {
      const v = window.reaView, w = window.rea.world, grid = window.rea.grid;
      const V = v.camera.position.constructor;
      // 真实指针坐标要从 **canvas 的 rect** 换算（页面纳 NDC 用的就是它），不能用 innerWidth
      const r = document.getElementById('view').getBoundingClientRect();
      const out = [];
      for (const c of grid.cells) {
        const top = w.top(c);
        if (!(top > 0)) continue;
        const p = new V(c.cx, top * v.levelHeight + 0.06, c.cz).project(v.camera);
        if (!(Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.8)) continue;
        const hit = v.pick(p.x, p.y);                 // pick 吃 NDC
        if (!hit || hit.cell.id !== c.id) continue;   // 只留「点下去真的能点到它」的格
        const sx = r.left + (p.x * 0.5 + 0.5) * r.width, sy = r.top + (-p.y * 0.5 + 0.5) * r.height;
        // HUD 面板压在上面的位置真人也点不到（工具条/进度面板/学习面板），排除掉
        if (document.elementFromPoint(sx, sy)?.id !== 'view') continue;
        out.push({ id: c.id, top, cx: c.cx, cz: c.cz, ndc: [p.x, p.y], sx, sy });
      }
      return out;
    });
    check('前置：能找到可点中的建筑格', picks.length >= 2, { n: picks.length });
    if (picks.length < 2) throw new Error('可用建筑格不足 2 个，无法验多选');
    // 选一对「隔 2–3 格、彼此最远」的：包围盒要明显变大，但补丁最多 8 格（原片 frame-0300 的补丁边长），
    // 太远会被 maxCells 裁掉 —— 那部分由 grid-window-browser.cjs 的窗口口径覆盖，这里要的是「多选 → 更大补丁」。
    let A = picks[0], B = picks[1], best = -1;
    for (const a of picks) for (const b of picks) {
      const d = Math.hypot(a.cx - b.cx, a.cz - b.cz);
      if (d > 1.2 && d < 3.0 && d > best) { best = d; A = a; B = b; }
    }
    check('前置：两格间距合适（包围盒会变大、又不会被 8 格上限裁掉）', best > 1.2, { A: A.id, B: B.id, dist: +best.toFixed(3) });

    /* ---------- ② 真实点击 = 单格选中 → 补丁窗口 ---------- */
    await page.mouse.click(A.sx, A.sy);
    await page.waitForTimeout(150);
    const one = await page.evaluate(() => {
      const v = window.reaView, s = window.rea.selection;
      return { ids: s.ids(), size: s.size, win: s.window(), bounds: s.bounds(), stats: v.gridStats.window, seg: v.gridStats.segments, total: v.gridStats.regularSegments ?? null };
    });
    check('② 点选 = 只选中这一格', one.ids.length === 1 && one.ids[0] === A.id, one.ids);
    check('② 补丁窗口出现', !!one.win, one.win);
    check('② 窗口按「选中格包围盒」算（未铺满）', !!one.stats && one.stats.kept > 0 && one.stats.kept < one.stats.total, one.stats);
    check('② 该格落在窗口内', !!one.win && one.win.minX <= A.cx && A.cx <= one.win.maxX && one.win.minZ <= A.cz && A.cz <= one.win.maxZ, { win: one.win, cell: [A.cx, A.cz] });
    const w1 = one.win;

    /* ---------- ③ Shift 点第二格 = 多选 → 包围盒/窗口同时变大 ---------- */
    await page.keyboard.down('Shift');
    await page.mouse.click(B.sx, B.sy);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(150);
    const two = await page.evaluate(() => {
      const v = window.reaView, s = window.rea.selection;
      return { ids: s.ids(), win: s.window(), bounds: s.bounds(), stats: v.gridStats.window };
    });
    check('③ Shift 点 = 加选（不是替换）', two.ids.length === 2 && two.ids.includes(A.id) && two.ids.includes(B.id), two.ids);
    const grew = two.win && (two.win.maxX - two.win.minX) * (two.win.maxZ - two.win.minZ) > (w1.maxX - w1.minX) * (w1.maxZ - w1.minZ) + 1e-6;
    check('③ 窗口面积随多选变大', !!grew, { before: w1, after: two.win });
    check('③ 两格都在窗口内', !!two.win && [A, B].every((c) => two.win.minX - 1e-6 <= c.cx && c.cx <= two.win.maxX + 1e-6 && two.win.minZ - 1e-6 <= c.cz && c.cz <= two.win.maxZ + 1e-6), two.win);
    check('③ 包围盒 = 两格并集（x/z 都覆盖）', two.bounds && two.bounds.minX <= Math.min(A.cx, B.cx) && two.bounds.maxX >= Math.max(A.cx, B.cx), two.bounds);
    await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1000, height: 760 } });
    // 近景：窗口补丁只有 2 格宽（原片 7–8 格口径另由 grid-window-browser 覆盖），全屏图上白格线太细，
    // 这里按两格的屏幕包围盒裁一张近景，供人工核对「补丁真的画在这两格上」。
    const cx = (A.sx + B.sx) / 2, cy = (A.sy + B.sy) / 2;
    const w = Math.min(1000, Math.abs(A.sx - B.sx) + 320), h = Math.min(760, Math.abs(A.sy - B.sy) + 320);
    await page.screenshot({
      path: path.join(__dirname, '..', 'artifacts', 'coverage', 'grid-window-editor-closeup.png'),
      clip: { x: Math.max(0, Math.min(1000 - w, cx - w / 2)), y: Math.max(0, Math.min(760 - h, cy - h / 2)), width: w, height: h },
    });
    console.log('  …截图 ' + shot + ' + grid-window-editor-closeup.png');

    /* ---------- ④ Esc = 取消 → 窗口清掉、格线回铺满 ---------- */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const cleared = await page.evaluate(() => {
      const v = window.reaView, s = window.rea.selection;
      return { ids: s.ids(), win: s.window(), stats: v.gridStats.window, seg: v.gridStats.segments };
    });
    check('④ Esc 清空选中', cleared.ids.length === 0, cleared.ids);
    check('④ 窗口清掉（回到 null）', cleared.win === null && cleared.stats === null, { win: cleared.win, stats: cleared.stats });
    check('④ 格线回到铺满（段数 > 窗口态）', cleared.seg > one.seg, { winSeg: one.seg, fullSeg: cleared.seg });

    /* ---------- ⑤ 撤销 / 重做逐条带回选中态 ---------- */
    await page.mouse.click(A.sx, A.sy);                       // 选择工具仍开着：选 A
    await page.waitForTimeout(120);
    const top0 = await page.evaluate((id) => window.rea.world.top(window.rea.grid.cells[id]), A.id);
    await page.keyboard.press('b');                            // 切回建造
    await page.mouse.click(A.sx, A.sy);                        // 在 A 上叠一层
    await page.waitForTimeout(200);
    const built = await page.evaluate((id) => {
      const w = window.rea.world, c = window.rea.grid.cells[id];
      return { top: w.top(c), depth: window.rea.selection.stats().undoDepth, ids: window.rea.selection.ids() };
    }, A.id);
    check('⑤ 建造真的长高了一层', built.top === top0 + 1, { before: top0, after: built.top });
    check('⑤ 进撤销栈的那一笔也记下了选中态', built.depth > 0 && built.ids.includes(A.id), built);

    await page.keyboard.press('Escape');                       // 清掉选中（此时窗口 null）
    await page.waitForTimeout(120);
    await page.keyboard.press('z');                            // 撤销
    await page.waitForTimeout(250);
    const undone = await page.evaluate((id) => {
      const v = window.reaView, s = window.rea.selection, w = window.rea.world, c = window.rea.grid.cells[id];
      return { ids: s.ids(), win: s.window(), top: w.top(c), stats: s.stats() };
    }, A.id);
    check('⑤ 撤销把世界退回（层数回到原值）', undone.top === top0, { top: undone.top, want: top0 });
    check('⑤ 撤销把「当时选中的 A」带回选中态', undone.ids.length === 1 && undone.ids[0] === A.id, undone.ids);
    check('⑤ 补丁窗口跟着回来', !!undone.win, undone.win);
    check('⑤ 记了一次撤销回位', undone.stats.undoRestores >= 1, undone.stats);

    await page.keyboard.press('y');                            // 重做
    await page.waitForTimeout(250);
    const redone = await page.evaluate((id) => {
      const w = window.rea.world, c = window.rea.grid.cells[id], s = window.rea.selection;
      return { top: w.top(c), ids: s.ids(), win: s.window() };
    }, A.id);
    check('⑤ 重做把层数加回', redone.top === top0 + 1, { top: redone.top });
    check('⑤ 重做带回的是「撤销那一刻」的选中态（空）', redone.ids.length === 0 && redone.win === null, redone);

    /* ---------- ⑥ 清空世界 → 选中被 prune ---------- */
    await page.keyboard.press('s');                             // 回到选择工具（⑤ 里切成了建造）
    await page.mouse.click(A.sx, A.sy);                        // 选 A（现在能点）
    await page.waitForTimeout(120);
    const beforeClear = await page.evaluate(() => ({ ids: window.rea.selection.ids(), win: window.rea.selection.window() }));
    // 走键盘 C（HUD 上「清空 (C)」的等价入口；右上角按钮被 #scenes 面板压住，真人点不到，不属于本轮改动面）
    await page.keyboard.press('c');
    await page.waitForTimeout(400);
    const afterClear = await page.evaluate(() => {
      const s = window.rea.selection, v = window.reaView;
      return { ids: s.ids(), win: s.window(), stats: s.stats(), seg: v.gridStats.segments };
    });
    check('⑥ 清空前确实选中了一格', beforeClear.ids.length === 1 && !!beforeClear.win, beforeClear);
    check('⑥ 世界清空后选中被 prune 掉', afterClear.ids.length === 0, afterClear.ids);
    check('⑥ 窗口跟着清空', afterClear.win === null, afterClear.win);
    check('⑥ prune 记了账（不是静默吞掉）', afterClear.stats.prunedCells >= 1, afterClear.stats);

    await page.screenshot({ path: path.join(__dirname, '..', 'artifacts', 'coverage', 'grid-window-editor-cleared.png') });
  } catch (err) {
    problems.push('异常：' + err.message);
  } finally {
    await browser.close();
  }
  if (problems.length) { console.error('\nFAIL\n' + problems.join('\n')); process.exit(1); }
  console.log('\ngrid-window-editor-browser: ALL PASS');
})();
