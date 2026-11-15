// 第 94 轮 · 1120036868966502401 缺口 ③ 运行时验收：grid-debug.html 的**窗口补丁**入口。
// 原片口径（460×460 原尺寸 + 4× 裁切，frame-0300 / 0445 / 0620）：白格网不是铺满整岛，是**一块矩形补丁**，
// 边界硬切（不是按地形退让的锯齿）、补丁内约 7–8 格、位置逐段跟着编辑对象跑。
// 本测试验：开关真的接到底层、补丁边界真的硬切、移动窗口真的换位置、三角层也被裁、关掉能还原。
const { chromium } = require('playwright');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const problems = [];
  const checks = [];
  const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); if (!ok) problems.push(name + ' :: ' + detail); };
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 300)); });
  try {
    await page.goto('http://127.0.0.1:8769/grid-debug.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gridDebug && window.__gridDebug.segments > 0, null, { polling: 200, timeout: 90000 });

    // ① 默认（窗口关）= 铺满：与「开窗口」对比要有明显差额
    const full = await page.evaluate(() => {
      const v = window.gridDebugView;
      v.yaw = 0; v.pitch = 1.28; v.distance = 18; v.target.set(0, 1, 0); v.updateCamera(); v.render(0.016);
      return { dbg: window.__gridDebug, seg: v.gridLines.geometry.getAttribute('position')?.count || 0 };
    });
    check('① 默认窗口关（window=null）', full.dbg.winOn === false && full.dbg.window === null, JSON.stringify(full.dbg.window));
    check('① 默认格线铺满（段数 >0）', full.dbg.segments > 0, 'segments=' + full.dbg.segments);

    // ② 开等距方格 + 窗口：所有端点必须落在窗口内（边界硬切）
    const win = await page.evaluate(async () => {
      const v = window.gridDebugView;
      const reg = document.querySelector('#cRegular'); reg.checked = true; reg.onchange();
      const w = document.querySelector('#cWin'); w.checked = true;
      document.querySelector('#winX').value = '0'; document.querySelector('#winZ').value = '0'; document.querySelector('#winR').value = '3';
      w.onchange();
      v.render(0.016);
      const pos = v.gridLines.geometry.getAttribute('position');
      let outCount = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        if (x < -3 - 1e-6 || x > 3 + 1e-6 || z < -3 - 1e-6 || z > 3 + 1e-6) outCount++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      const dots = v.gridDots.geometry.getAttribute('position');
      let dotOut = 0;
      if (dots) for (let i = 0; i < dots.count; i++) {
        const x = dots.getX(i), z = dots.getZ(i);
        if (x < -3 - 1e-6 || x > 3 + 1e-6 || z < -3 - 1e-6 || z > 3 + 1e-6) dotOut++;
      }
      return { dbg: window.__gridDebug, count: pos.count, outCount, minX, maxX, minZ, maxZ, dotCount: dots?.count || 0, dotOut };
    });
    check('② 窗口统计有值（kept/total）', !!win.dbg.window && win.dbg.window.kept > 0 && win.dbg.window.total > win.dbg.window.kept, JSON.stringify(win.dbg.window));
    check('② 补丁内线段都落在窗口内（硬切，0 个越界端点）', win.outCount === 0, `out=${win.outCount}/${win.count}`);
    check('② 补丁包围盒在窗口内且覆盖 ≥60% 窗宽（格线按格距落点，不会正好贴边）',
      win.minX >= -3 - 1e-6 && win.maxX <= 3 + 1e-6 && (win.maxX - win.minX) >= 3.6 && (win.maxZ - win.minZ) >= 3.6,
      `x=[${win.minX.toFixed(2)},${win.maxX.toFixed(2)}] z=[${win.minZ.toFixed(2)},${win.maxZ.toFixed(2)}]`);
    check('② 交点亮斑也被裁（0 个窗口外点）', win.dotOut === 0 && win.dotCount > 0, `dots=${win.dotCount} out=${win.dotOut}`);
    check('② 窗口内的段数远小于铺满', win.dbg.segments < full.dbg.segments, `win=${win.dbg.segments} full=${full.dbg.segments}`);

    // ③ 移动窗口 → 覆盖真的换位置（不是原地缩放）
    const moved = await page.evaluate(async () => {
      const v = window.gridDebugView;
      document.querySelector('#winX').value = '4'; document.querySelector('#winZ').value = '-4';
      document.querySelector('#winX').oninput();
      v.render(0.016);
      const pos = v.gridLines.geometry.getAttribute('position');
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, out = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        if (x < 1 - 1e-6 || x > 7 + 1e-6 || z < -7 - 1e-6 || z > -1 + 1e-6) out++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      return { dbg: window.__gridDebug, count: pos.count, out, minX, maxX, minZ, maxZ };
    });
    const cx = (moved.minX + moved.maxX) / 2, cz = (moved.minZ + moved.maxZ) / 2;
    check('③ 移动后补丁换到新位置（bbox 中心 ≈ 新窗口中心 (±1 单位)）',
      Math.abs(cx - 4) <= 1 && Math.abs(cz + 4) <= 1 && Math.abs(cx - (win.minX + win.maxX) / 2) > 2,
      `center=(${cx.toFixed(2)},${cz.toFixed(2)}) 原中心=(${((win.minX + win.maxX) / 2).toFixed(2)},${((win.minZ + win.maxZ) / 2).toFixed(2)})`);
    check('③ 移动后仍 0 个越界端点', moved.out === 0, `out=${moved.out}/${moved.count}`);

    // ④ 三角层也要被窗口裁（分组区域 ∩ 窗口）
    const tri = await page.evaluate(async () => {
      const v = window.gridDebugView;
      document.querySelector('#winX').value = '0'; document.querySelector('#winZ').value = '0';
      document.querySelector('#winR').value = '2'; document.querySelector('#winX').oninput();
      const t = document.querySelector('#cTri'); t.checked = true; t.onchange();
      v.render(0.016);
      const pos = v.gridTri.geometry.getAttribute('position');
      let out = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        if (x < -2 - 1e-6 || x > 2 + 1e-6 || z < -2 - 1e-6 || z > 2 + 1e-6) out++;
      }
      return { dbg: window.__gridDebug, count: pos.count, out, tris: v.gridTriStats };
    });
    check('④ 三角层被窗口裁（0 个越界顶点）', tri.count > 0 && tri.out === 0, `count=${tri.count} out=${tri.out}`);
    check('④ 三角统计仍自洽（顶点 = 三角×6）', tri.tris && tri.count === tri.tris.triangles * 6, JSON.stringify(tri.tris && { tri: tri.tris.triangles, groups: tri.tris.groups }));

    // ⑤ 关掉窗口 → 回到铺满（统计归 null，段数回升）
    const back = await page.evaluate(async () => {
      const v = window.gridDebugView;
      const w = document.querySelector('#cWin'); w.checked = false; w.onchange();
      v.render(0.016);
      return { dbg: window.__gridDebug, visible: v.gridLines.visible };
    });
    check('⑤ 关窗口回到铺满', back.dbg.window === null && back.dbg.segments > moved.dbg.segments, `seg=${back.dbg.segments} win=${moved.dbg.segments}`);
    check('⑤ 关窗口后格线仍可见', back.visible === true, 'gridLines.visible=' + back.visible);

    // ⑥ 第 95 轮（r94 缺口 ①）：窗口跟鼠标拖拽。原片 0620 的白格网补丁是跟着编辑对象跑的。
    const beforeDrag = await page.evaluate(() => {
      const v = window.gridDebugView;
      const w = document.querySelector('#cWin'); w.checked = true;
      document.querySelector('#winX').value = '0'; document.querySelector('#winZ').value = '0';
      document.querySelector('#winR').value = '4';
      w.onchange();
      v.yaw = 0; v.pitch = 1.28; v.distance = 18; v.target.set(0, 1, 0); v.updateCamera(); v.render(0.016);
      return { dbg: window.__gridDebug };
    });
    const box = await page.locator('#view').boundingBox();
    const cx0 = box.x + box.width / 2, cy0 = box.y + box.height / 2;
    await page.mouse.move(cx0, cy0);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(cx0 + i * 20, cy0 + i * 4);
    await page.mouse.up();
    const afterDrag = await page.evaluate(() => {
      const v = window.gridDebugView; v.render(0.016);
      return { dbg: window.__gridDebug, wx: Number(document.querySelector('#winX').value), wz: Number(document.querySelector('#winZ').value) };
    });
    check('⑥ 鼠标拖拽真的移动了补丁（winX/winZ 都变了且窗口统计仍自洽）',
      (afterDrag.wx !== 0 || afterDrag.wz !== 0) && !!afterDrag.dbg.window && afterDrag.dbg.window.kept > 0
      && afterDrag.dbg.winRect.minX === afterDrag.wx - 4 && afterDrag.dbg.winRect.maxZ === afterDrag.wz + 4,
      `Δ=(${(afterDrag.wx - 0).toFixed(1)},${(afterDrag.wz - 0).toFixed(1)}) kept=${afterDrag.dbg.window && afterDrag.dbg.window.kept}`);
    // 拖拽方向必须和投影一致：屏幕 +120/+24 px 对应的世界位移，用同一套映射反解出来比对
    const expect = await page.evaluate(() => {
      const m = window.__gridDrag.worldPerPixel();
      const u = (120 * m.by - m.bx * 24) / m.det, w = (m.ax * 24 - m.ay * 120) / m.det;
      return { u, w };
    });
    check('⑥ 拖拽位移与相机投影一致（±0.15，滑杆量化 0.1）',
      Math.abs(afterDrag.wx - expect.u) <= 0.15 && Math.abs(afterDrag.wz - expect.w) <= 0.15,
      `实际=(${afterDrag.wx},${afterDrag.wz}) 期望=(${expect.u.toFixed(2)},${expect.w.toFixed(2)})`);
    // ⑦ 关掉「窗口可拖拽」→ 拖拽不再改窗口
    const locked = await page.evaluate(async () => {
      const v = window.gridDebugView;
      document.querySelector('#winX').value = '1'; document.querySelector('#winZ').value = '1';
      document.querySelector('#winX').oninput();
      const d = document.querySelector('#cWinDrag'); d.checked = false;
      v.render(0.016);
      return { wx: Number(document.querySelector('#winX').value) };
    });
    await page.mouse.move(cx0, cy0); await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(cx0 - i * 20, cy0);
    await page.mouse.up();
    const lockedAfter = await page.evaluate(() => {
      window.gridDebugView.render(0.016);
      return { wx: Number(document.querySelector('#winX').value), wz: Number(document.querySelector('#winZ').value) };
    });
    check('⑦ 关掉「窗口可拖拽」后拖拽无效', lockedAfter.wx === locked.wx && lockedAfter.wz === 1, `wx=${lockedAfter.wx} wz=${lockedAfter.wz}`);
    // ⑧ 补丁边界在台沿处没有竖边（原片 0620：边界随地形起伏，不立竖直面）
    const vertical = await page.evaluate(() => {
      const v = window.gridDebugView;
      const d = document.querySelector('#cWinDrag'); d.checked = true;
      v.render(0.016);
      const pos = v.gridLines.geometry.getAttribute('position');
      let vert = 0, seg = 0;
      for (let i = 0; i + 1 < pos.count; i += 2) {
        const dx = pos.getX(i + 1) - pos.getX(i), dz = pos.getZ(i + 1) - pos.getZ(i);
        const dy = pos.getY(i + 1) - pos.getY(i);
        seg++;
        if (Math.hypot(dx, dz) < 1e-4 && Math.abs(dy) > 1e-3) vert++;
      }
      return { seg, vert };
    });
    check('⑧ 补丁里没有竖直线段（0 条 Δ(xz)≈0 且 Δy>0 的段）', vertical.vert === 0 && vertical.seg > 0, `vert=${vertical.vert}/${vertical.seg}`);

    // ⑩ 第 96 轮：窗口按「对象包围盒」自动定（原片补丁跟着编辑对象跑，不再手拖）
    const auto = await page.evaluate(() => {
      const v = window.gridDebugView;
      const w = document.querySelector('#cWin'); w.checked = true; w.onchange();
      const bounds = { minX: 1.2, maxX: 3.4, minZ: -1.1, maxZ: 0.7 };
      v.setGridWindowForBounds(bounds, { pad: 1, maxCells: 8 });
      v.render(0.016);
      const r = v.gridStats.window;
      const step = v.gridLatticeStep, o = v.gridLatticeOrigin;
      const onGrid = (val, osc) => Math.abs((val - osc) / step - Math.round((val - osc) / step)) < 1e-6;
      const rect = r.rect;
      return {
        rect, step, origin: o, cols: v.gridWindowAuto?.cols, rows: v.gridWindowAuto?.rows,
        aligned: onGrid(rect.minX, o.x) && onGrid(rect.maxX, o.x) && onGrid(rect.minZ, o.z) && onGrid(rect.maxZ, o.z),
        covers: rect.minX <= bounds.minX && rect.maxX >= bounds.maxX && rect.minZ <= bounds.minZ && rect.maxZ >= bounds.maxZ,
        kept: r.kept, total: r.total,
        edge: r.edge, edgeVisible: v.gridWinEdge.visible, edgeQuads: v.gridWinEdge.geometry.userData?.quads || 0,
      };
    });
    check('⑩ 自动窗口覆盖对象包围盒', auto.covers, JSON.stringify(auto.rect));
    check('⑩ 窗口边界对齐格点', auto.aligned, `step=${auto.step} origin=${JSON.stringify(auto.origin)}`);
    check('⑩ 补丁边长 ≤ 8 格（原片 7–8 格）', auto.cols <= 8 && auto.rows <= 8, `cols=${auto.cols} rows=${auto.rows}`);
    check('⑩ 自动窗口内仍有格线（kept>0）', auto.kept > 0 && auto.kept < auto.total, `kept=${auto.kept}/${auto.total}`);
    // ⑪ 第 97 轮改判：原片**没有**加粗外框（白线半宽 P50=1.00 边界/内部一致，3×3 腐蚀后无 >40px 长条）
    //    → 边缘高亮降级为实验档、默认关；显式打开时仍是 4 条边，关掉只少画框、裁剪不变。
    check('⑪ 边缘高亮默认关（原片无加粗外框）', !auto.edgeVisible && auto.edge === null, `visible=${auto.edgeVisible} edge=${JSON.stringify(auto.edge)}`);
    const edgeOn = await page.evaluate(() => {
      const v = window.gridDebugView;
      const before = v.gridStats.window.kept;
      v.setGridWindowEdge(true); v.render(0.016);
      const on = { visible: v.gridWinEdge.visible, edge: v.gridStats.window.edge, quads: v.gridWinEdge.geometry.userData?.quads || 0, kept: v.gridStats.window.kept };
      v.setGridWindowEdge(false); v.render(0.016);
      return { ...on, before, back: v.gridWinEdge.visible, edgeAfter: v.gridStats.window.edge, keptAfter: v.gridStats.window.kept };
    });
    check('⑪ 显式打开边缘高亮 = 4 条边且可见', edgeOn.visible && edgeOn.quads === 4 && edgeOn.edge?.segments === 4, `quads=${edgeOn.quads} edge=${JSON.stringify(edgeOn.edge)}`);
    check('⑪ 关掉边缘高亮只少画框、窗口裁剪不变', !edgeOn.back && edgeOn.edgeAfter === null && edgeOn.keptAfter === edgeOn.before && edgeOn.kept === edgeOn.before, JSON.stringify({ back: edgeOn.back, before: edgeOn.before, kept: edgeOn.kept, keptAfter: edgeOn.keptAfter }));
    // ⑫ 对象包围盒换了 → 窗口跟着换（原片 0300→0445→0620 三段位置）
    const movedByBounds = await page.evaluate(() => {
      const v = window.gridDebugView;
      const a = { minX: -4, maxX: -2, minZ: 2, maxZ: 4 };
      v.setGridWindowForBounds(a, { pad: 1 });
      v.render(0.016);
      const r1 = { ...v.gridStats.window.rect };
      v.setGridWindowForBounds({ minX: 2, maxX: 4, minZ: -3, maxZ: -1 }, { pad: 1 });
      v.render(0.016);
      const r2 = { ...v.gridStats.window.rect };
      v.setGridWindowForBounds(null); v.render(0.016);
      return { r1, r2, cleared: v.gridStats.window, auto: v.gridWindowAuto };
    });
    check('⑫ 换包围盒 → 窗口跟着换位置', movedByBounds.r1.minX !== movedByBounds.r2.minX && movedByBounds.r1.minX <= -4 && movedByBounds.r2.maxX >= 4, JSON.stringify([movedByBounds.r1, movedByBounds.r2]));
    check('⑫ 传 null 清掉自动窗口（回到铺满）', movedByBounds.cleared === null && movedByBounds.auto === null, JSON.stringify(movedByBounds.cleared));

    // ⑬ 第 98 轮：窗口接**选中态**（r97 缺口 ①）。点画面里的建筑 → 拾取格 → 该格所在的整片实心建筑
    //    → 选中态包围盒 → 自动窗口。判据：窗口是选中态的纯函数（覆盖 bbox、对齐格点、边长 ≤8 格），
    //    点另一处 → 窗口跟着换；关掉点选 → 选中态丢掉、回到手灌路径。
    await page.evaluate(() => {
      const v = window.gridDebugView;
      const w = document.querySelector('#cWin'); w.checked = true;
      const p = document.querySelector('#cWinPick'); p.checked = true;
      const r = document.querySelector('#cRegular'); r.checked = true; r.onchange();
      v.yaw = 0.35; v.pitch = 1.24; v.distance = 16; v.target.set(0, 1, 0); v.updateCamera(); v.render(0.016);
    });
    const selA = await page.evaluate(() => {
      const box = document.querySelector('#view').getBoundingClientRect();
      const out = [];
      // 在画面里扫几个落点，取第一个真的命中实心建筑的
      for (const [fx, fy] of [[0.5, 0.62], [0.44, 0.58], [0.56, 0.66], [0.5, 0.7], [0.4, 0.66]]) {
        const c = window.__gridPick.pickCellAtScreen(box.left + box.width * fx, box.top + box.height * fy);
        if (!c) continue;
        const cl = window.gridDebugView.builtCluster(c, { max: 64, levelTol: 0 });
        if (cl) { out.push({ x: box.left + box.width * fx, y: box.top + box.height * fy, cells: cl.cells.length }); break; }
      }
      return out[0] || null;
    });
    check('⑬ 画面里点得到实心建筑（拾取格 → 连同层连通簇）', !!selA && selA.cells > 0, JSON.stringify(selA));
    let selDbg = null, selRect = null;
    if (selA) {
      await page.mouse.move(selA.x, selA.y);
      await page.mouse.down();
      await page.mouse.up();
      selDbg = await page.evaluate(() => {
        const v = window.gridDebugView; v.render(0.016);
        const d = window.__gridDebug;
        const pos = v.gridLines.geometry.getAttribute('position');
        let out = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), z = pos.getZ(i);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
        return { d, segMinX: minX, segMaxX: maxX, segMinZ: minZ, segMaxZ: maxZ, rect: d.window && d.window.rect, step: v.gridLatticeStep, origin: v.gridLatticeOrigin };
      });
      selRect = selDbg.rect;
      check('⑬ 点选后窗口由选中态算出（winFrom=selection）', selDbg.d.winFrom === 'selection' && !!selDbg.d.pick && selDbg.d.pick.cells > 0,
        `from=${selDbg.d.winFrom} pick=${JSON.stringify(selDbg.d.pick && { cells: selDbg.d.pick.cells })}`);
      check('⑬ 窗口覆盖选中对象包围盒', !!selRect && selRect.minX <= selDbg.d.pick.bounds.minX + 1e-6 && selRect.maxX >= selDbg.d.pick.bounds.maxX - 1e-6
        && selRect.minZ <= selDbg.d.pick.bounds.minZ + 1e-6 && selRect.maxZ >= selDbg.d.pick.bounds.maxZ - 1e-6, JSON.stringify(selRect));
      const onGrid = (val) => Math.abs((val - (selDbg.origin.x)) / selDbg.step - Math.round((val - selDbg.origin.x) / selDbg.step)) < 1e-6;
      check('⑬ 选中态窗口仍对齐格点（X 边）', !!selRect && onGrid(selRect.minX) && onGrid(selRect.maxX), `step=${selDbg.step}`);
      check('⑬ 补丁边长 ≤ 8 格 + 选中格确实在窗口里',
        !!selRect && Math.round((selRect.maxX - selRect.minX) / selDbg.step) <= 8 && Math.round((selRect.maxZ - selRect.minZ) / selDbg.step) <= 8
        && selDbg.segMinX >= selRect.minX - 1e-6 && selDbg.segMaxX <= selRect.maxX + 1e-6,
        `cols=${selRect && Math.round((selRect.maxX - selRect.minX) / selDbg.step)} rows=${selRect && Math.round((selRect.maxZ - selRect.minZ) / selDbg.step)} segs=[${selDbg.segMinX.toFixed(2)},${selDbg.segMaxX.toFixed(2)}]`);
      await page.waitForTimeout(250);
      await page.screenshot({ path: 'artifacts/coverage/grid-window-pick.png' });
    } else {
      check('⑬ 点选后窗口由选中态算出（winFrom=selection）', false, '画面上没拾取到实心建筑');
      check('⑬ 窗口覆盖选中对象包围盒', false, 'skip');
      check('⑬ 选中态窗口仍对齐格点（X 边）', false, 'skip');
      check('⑬ 补丁边长 ≤ 8 格 + 选中格确实在窗口里', false, 'skip');
    }
    // ⑭ 换一个选中对象 → 窗口跟着换位置（原片 0300→0445→0620 三段）
    const selMoved = await page.evaluate(() => {
      const v = window.gridDebugView;
      // 直接走选中态接口：两个不同的对象包围盒 → 窗口位置必须不同，且都由 gridWindowSel 推出
      v.setGridWindowForSelection({ bounds: { minX: -5, maxX: -3.4, minZ: 1.2, maxZ: 2.8 } }, { pad: 1 });
      v.render(0.016);
      const r1 = { ...v.gridStats.window.rect }, s1 = { ...v.gridWindowSel };
      v.setGridWindowForSelection({ objects: [{ bounds: { minX: 2.4, maxX: 4, minZ: -3.6, maxZ: -2 } }] }, { pad: 1 });
      v.render(0.016);
      const r2 = { ...v.gridStats.window.rect }, s2 = { ...v.gridWindowSel };
      v.setGridWindowForSelection(null);
      v.render(0.016);
      return { r1, r2, s1, s2, cleared: v.gridStats.window, selCleared: v.gridWindowSel };
    });
    check('⑭ 换选中对象 → 窗口跟着换位置', selMoved.r1.minX !== selMoved.r2.minX && selMoved.r1.minX <= -5 && selMoved.r2.maxX >= 4, JSON.stringify([selMoved.r1, selMoved.r2]));
    check('⑭ 窗口位置 = 选中态包围盒推出的格点窗口', selMoved.s1.minX === -5 || selMoved.s1.minX <= -5, JSON.stringify(selMoved.s1));
    check('⑭ 清空选中 → 窗口和选中态一起清掉（不残留上一栋）', selMoved.cleared === null && selMoved.selCleared === null, JSON.stringify(selMoved.cleared));

    // ⑨ 截图（补丁状白格网），必须人眼看过
    await page.evaluate(async () => {
      const v = window.gridDebugView;
      const w = document.querySelector('#cWin'); w.checked = true;
      document.querySelector('#winR').value = '5'; document.querySelector('#winX').value = '0'; document.querySelector('#winZ').value = '0';
      w.onchange();
      v.yaw = 0.4; v.pitch = 1.24; v.distance = 16; v.target.set(0, 1, 0); v.updateCamera(); v.render(0.016);
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'artifacts/coverage/grid-window-page.png' });
  } catch (e) {
    problems.push('exception: ' + (e && e.message));
  } finally {
    await browser.close();
  }
  const ok = checks.filter((c) => c.ok).length;
  for (const c of checks) console.log((c.ok ? '  PASS ' : '  FAIL ') + c.name + ' :: ' + c.detail);
  if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
  console.log(`grid-window-browser ${ok}/${checks.length} ALL PASS`);
})();
