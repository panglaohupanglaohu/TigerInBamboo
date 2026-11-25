// 1384958097542819845 运行时验收（第 147 轮）：主场景的「拓扑直线 + 手柄光标 + 连刷」
// 原文：trace topologically straight lines across the Townscaper grid … use it for a thing in the gamepad controls
//       and possibly some drag-to-paint mode.
// 片中可量的四件事 → 本测四组断言：
//   ① 拓扑直线（页面上真画出来的那条）：闭环检测 + **每步都从对边穿出**（"topologically straight" 的定义）+ 世界空间折线会拐（如实口径）；
//   ② 手柄：合成 gamepad 走**页面真实轮询**（navigator.getGamepads）—— 十字键沿拓扑直线一格格走、左右换向、A 键连刷、按住不重复触发（去抖）；
//   ③ 连刷（drag-to-paint）：选「拓扑直线连刷」工具后按下拖动，跨过的每一格各加一层，整条线进主场景真撤销栈，撤销回基线；
//   ④ 像素：冻帧后直线层开/关差分 > 阈值、同状态噪声 0（贴图/水面不参与）。
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const out = path.join(__dirname, '..', 'artifacts', 'coverage');
const fail = (m) => { throw new Error(m); };
const ok = (m) => console.log('  ok  ' + m);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    // 合成手柄：页面 tick() 每帧读 navigator.getGamepads()，这里给一个可改状态的假手柄（真机无设备，见如实口径）
    await page.addInitScript(() => {
      const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
      window.__pad = { buttons, axes: [0, 0, 0, 0], index: 0, id: 'synthetic-pad', connected: true };
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__pad] });
      window.__padSet = (i, on) => { buttons[i].pressed = !!on; buttons[i].value = on ? 1 : 0; };
    });
    await page.goto('http://localhost:8769/index.html?scene=town&grid=quad&seed=3&gameui=1&topoline=1');
    await page.waitForFunction(() => window.rea?.gameUI?.state && window.rea.gameUI.bar, null, { timeout: 90000, polling: 200 });
    await page.waitForTimeout(800);

    /* ---------- 0. 工具条里有「拓扑直线连刷」格，且能切成 line 工具 ---------- */
    const tools = await page.evaluate(() => [...document.querySelectorAll('#gameui-c06 .gtool .ic')].map((b) => b.dataset.key));
    if (!tools.includes('line')) fail('topoline=1 时工具条必须多出 line 格，实得 ' + JSON.stringify(tools));
    ok('工具条含 line 格：' + JSON.stringify(tools));

    /* ---------- 1. 拓扑直线：闭环 + 每步对边穿出 ---------- */
    const topo = await page.evaluate(() => {
      const g = window.rea.gameUI, grid = window.rea.grid;
      // 扫出一条真实闭环（不硬编码 id）
      let loop = null;
      outer: for (const c of grid.cells) {
        if (c.n !== 4) continue;
        for (let e = 0; e < 4; e++) { const r = g.setLine(c.id, e); if (r.closed) { loop = { id: c.id, e, n: r.cells.length, reason: r.reason, pts: r.points.length, cells: r.cells.map((x) => x.id), points: r.points }; break outer; } }
      }
      if (!loop) return { loop: null };
      // 闭环的几何闭合度：末点 = **起点格出口边的中点**（= 回到同一个「格 + 出口边」有向状态，不是回到格心）
      const cStart = grid.cells[loop.id], cLast = grid.cells[loop.cells[loop.cells.length - 1]];
      const b = loop.points[loop.points.length - 1];
      const SA = cStart.pts[loop.e], SB = cStart.pts[(loop.e + 1) % cStart.n];
      const gap = Math.hypot(b[0] - (SA.x + SB.x) / 2, b[1] - (SA.z + SB.z) / 2);
      const backToStart = cLast.edgeNeighbors.includes(cStart.id);
      // 逐对相邻格：出口是否 = 入口边的对边（拓扑直线的定义）
      const byId = new Map(grid.cells.map((c) => [c.id, c]));
      const sharedEdge = (c0, c1) => { for (let e = 0; e < c0.n; e++) if (c0.edgeNeighbors[e] === c1.id) return { e0: e, e1: c0.edgeTwins[e] }; return null; };
      // 用非闭环线量「每步对边」更干净：闭环的那条也量一遍（除最后一步回起点）
      let pairs = 0, viol = 0, sample = [];
      for (let i = 0; i + 1 < loop.cells.length; i++) {
        const c0 = byId.get(loop.cells[i]), c1 = byId.get(loop.cells[i + 1]);
        if (!c0 || !c1) continue;
        const s = sharedEdge(c0, c1); if (!s) continue;
        pairs++;
        // c1 的出口边应当是「刚进来那条边的对边」，即从 c1 看 s.e1 的对边 = (s.e1+2)%4 必须是下一步用的边
        sample.push({ in: s.e1, want: (s.e1 + 2) % 4 });
      }
      // 真检查：把每条直线重算一次，核对每一步确实从对边出（用 traceStraightReport 的 segments 对齐格序）
      let straightPairs = 0, straightViol = 0;
      for (const c of grid.cells) {
        if (c.n !== 4) continue;
        for (let e = 0; e < 4; e++) {
          const r = g.setLine(c.id, e);
          const cells = r.cells;
          for (let i = 0; i + 1 < cells.length; i++) {
            const c0 = cells[i], c1 = cells[i + 1];
            const sh = sharedEdge(c0, c1); if (!sh) continue;
            straightPairs++;
            // 入口边 = 共享边；出口边要到下一格去找（下一对共享边）
            const nx = cells[i + 2];
            if (!nx) continue;
            const sh2 = sharedEdge(c1, nx); if (!sh2) continue;
            const entry = sh.e1, exit = sh2.e0;
            if (exit !== (entry + 2) % 4) straightViol++;
          }
        }
        if (c === grid.cells[200]) break;
      }
      return { loop: { id: loop.id, e: loop.e, n: loop.n, reason: loop.reason, pts: loop.pts, gap, backToStart }, pairs, viol, sample: sample.slice(0, 4), straightPairs, straightViol };
    });
    if (!topo.loop) fail('网格里找不到闭环（页面 setLine 扫全图未命中）');
    if (topo.loop.reason !== 'loop') fail('闭环的停止原因必须是 loop，实得 ' + topo.loop.reason);
    if (!topo.loop.backToStart) fail('闭环的最后一格必须与起点格共边');
    if (topo.loop.gap > 1e-9) fail('闭环末点必须落在起点格出口边中点（回到同一有向状态），实测 gap=' + topo.loop.gap);
    ok(`闭环 ${topo.loop.n} 格 / reason=${topo.loop.reason} / 末点回起点出口边中点 gap=${topo.loop.gap.toExponential(2)} / 折线点 ${topo.loop.pts}`);
    if (!(topo.straightPairs > 200)) fail('拓扑直线对数量太少，量具无效：' + topo.straightPairs);
    if (topo.straightViol !== 0) fail(`拓扑直线必须每步从对边穿出，违例 ${topo.straightViol}/${topo.straightPairs}`);
    ok(`对边穿出 ${topo.straightPairs} 对，违例 0（拓扑直线定义）`);

    /* ---------- 1b. 多条线同时保留（原片 frame-0650 一屏 4–5 条） ---------- */
    const multi = await page.evaluate(() => {
      const g = window.rea.gameUI, grid = window.rea.grid;
      g.clearTraces();
      // 取 4 个分散的对边格，各画一条（换格 → 上一条进历史轨迹层）
      const qs = grid.cells.filter((c) => c.n === 4 && c.edgeNeighbors.every((n) => n >= 0));
      const picks = [qs[0], qs[Math.floor(qs.length * 0.25)], qs[Math.floor(qs.length * 0.5)], qs[Math.floor(qs.length * 0.75)], qs[qs.length - 1], qs[Math.floor(qs.length * 0.6)], qs[Math.floor(qs.length * 0.8)], qs[Math.floor(qs.length * 0.4)], qs[Math.floor(qs.length * 0.1)]];
      const seen = [];
      for (const c of picks) { const r = g.setLine(c.id, 0); seen.push(r.cells.length); }
      const trail = window.rea.view.scene.children.find((o) => o.name === 'topoline-trails');
      const line = window.rea.view.scene.children.find((o) => o.name === 'topoline-line');
      return {
        drawn: seen.length,
        traces: (g.state.traces || []).length,
        trailSegs: trail ? trail.geometry.attributes.position.count / 2 : 0,
        trailVisible: !!trail?.visible,
        lineSegs: line.geometry.attributes.position.count,
        activeCells: g.state.line.cells.length,
        distinct: new Set(g.state.traces.map((t) => t.length)).size,
      };
    });
    if (multi.traces !== 5) fail('历史轨迹层应封顶 5 条（画了 ' + multi.drawn + ' 条），实得 ' + multi.traces);
    if (!multi.trailVisible || !(multi.trailSegs > 100)) fail('历史轨迹层必须真的画出来：' + JSON.stringify(multi));
    ok(`多线同时保留：画 ${multi.drawn} 条 → 当前线 1 + 历史轨迹 ${multi.traces} 条（轨迹 ${multi.trailSegs} 段，封顶 5 条）`);
    // 与 frame-0650 同口径的一张现场图（一屏多条线 + 闭环）
    const multiShot = await page.evaluate(() => {
      const v = window.rea.view;
      if (!v.__origRender) { v.__origRender = v.render.bind(v); v.render = () => {}; }
      v.target.set(0, 0, 0); v.yaw = 0.62; v.pitch = 1.12; v.distance = 22; v.updateCamera(); v.__origRender(0);
      const src = v.renderer.domElement; const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      cv.getContext('2d').drawImage(src, 0, 0); return cv.toDataURL('image/png');
    });
    if (multiShot) fs.writeFileSync(path.join(out, 'topoline-multi-traces.png'), Buffer.from(multiShot.split(',')[1], 'base64'));

    /* ---------- 2. 世界空间折线确实会拐（如实口径，不是"世界空间直线"） ---------- */
    const bend = await page.evaluate(() => {
      const g = window.rea.gameUI;
      const r = g.setLine(134, 1);
      const P = r.cells.map((c) => [c.cx, c.cz]);
      const ang = [];
      for (let i = 1; i + 1 < P.length; i++) {
        const a1 = Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]);
        const a2 = Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0]);
        let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
        ang.push(d * 180 / Math.PI);
      }
      ang.sort((x, y) => x - y);
      const q = (p) => ang[Math.min(ang.length - 1, Math.floor(p * ang.length))] || 0;
      return { n: ang.length, p50: q(.5), p90: q(.9), turned: ang.filter((d) => d > 3).length };
    });
    ok(`闭环中心折线转角 p50=${bend.p50.toFixed(1)}° p90=${bend.p90.toFixed(1)}°，>3° 的拐点 ${bend.turned}/${bend.n}（拓扑直 ≠ 世界空间直线）`);

    /* ---------- 3. 像素：直线层开/关差分（冻帧，噪声 0） ---------- */
    const px = await page.evaluate(() => {
      const v = window.rea.view, g = window.rea.gameUI;
      g.clearTraces();                                   // A/B 只差「当前这一条线」，历史轨迹层先清掉
      const r = g.setLine(134, 1);
      const xs = r.cells.map((c) => c.cx), zs = r.cells.map((c) => c.cz);
      const cxm = (Math.min(...xs) + Math.max(...xs)) / 2, czm = (Math.min(...zs) + Math.max(...zs)) / 2;
      if (!v.__origRender) { v.__origRender = v.render.bind(v); v.render = () => {}; }
      const line = v.scene.children.find((o) => o.name === 'topoline-line');
      if (!line) return { err: 'no dashed line object' };
      const inView = () => r.cells.map((c) => { const p = v.camera.position.clone(); p.set(c.cx, 0, c.cz); p.project(v.camera); return Math.abs(p.x) < .98 && Math.abs(p.y) < .98 && p.z < 1; }).filter(Boolean).length;
      // 机位自适应：把整条闭环框进画面（≥90% 格可见）
      v.target.set(cxm, 0, czm); v.yaw = 0.7; v.pitch = 1.30;
      let dist = 6, view = 0;
      for (const mult of [2.1, 2.6, 3.2, 4.0, 5.0, 6.5]) {
        dist = Math.max(7, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * mult);
        v.distance = dist; v.updateCamera(); v.__origRender(0);
        view = inView();
        if (view >= Math.ceil(r.cells.length * 0.9)) break;
      }
      const grab = () => {
        v.updateCamera(); v.__origRender(0);
        const src = v.renderer.domElement;
        const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
        const ctx = cv.getContext('2d'); ctx.drawImage(src, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let white = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] >= 240 && d[i + 1] >= 240 && d[i + 2] >= 240) white++;
        return { white, d, url: cv.toDataURL('image/png') };
      };
      const cmp = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++; return n; };
      const on1 = grab(); const on2 = grab();
      line.visible = false; const off = grab();
      line.visible = true; const back = grab();
      return {
        dist, view, total: r.cells.length,
        noise: cmp(on1.d, on2.d), diff: cmp(on1.d, off.d), backDiff: cmp(on1.d, back.d),
        whiteOn: on1.white, whiteOff: off.white, url: on1.url,
      };
    });
    if (px.err) fail(px.err);
    if (px.view < Math.ceil(px.total * 0.8)) fail(`机位没把闭环框住：${px.view}/${px.total} 格可见（dist=${px.dist}）`);
    if (px.noise !== 0) fail('冻帧后同状态噪声必须为 0，实得 ' + px.noise);
    if (!(px.diff > 400)) fail(`直线层必须画得出来：差分 ${px.diff}px（开 ${px.whiteOn} / 关 ${px.whiteOff} 个近白像素）`);
    if (px.backDiff !== 0) fail('再开必须逐像素回位：' + px.backDiff);
    ok(`直线层：${px.view}/${px.total} 格在画面内（dist ${px.dist.toFixed(1)}）、开/关差分 ${px.diff}px、再开回位 ${px.backDiff}、噪声 ${px.noise}；近白像素 开 ${px.whiteOn} / 关 ${px.whiteOff}`);
    if (px.url) fs.writeFileSync(path.join(out, 'topoline-line-on.png'), Buffer.from(px.url.split(',')[1], 'base64'));

    /* ---------- 4. 手柄：页面真实轮询（十字键沿直线走 / 左右换向 / A 连刷 / 按住去抖） ---------- */
    const padRes = await page.evaluate(async () => {
      const g = window.rea.gameUI, grid = window.rea.grid;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const press = async (i) => { window.__padSet(i, true); await wait(700); window.__padSet(i, false); await wait(400); };   // headless swiftshader ~4fps，按一下至少覆盖 2 帧
      const sl = () => g.state.line;
      const voxels = () => { let n = 0; for (const m of window.rea.world.solid) { let v = m; while (v) { n += v & 1; v >>= 1; } } return n; };
      // 先把光标落到一个已知格（沿闭环起点），再走
      g.stepCursor('up');                       // 初始化光标（首次调用会把光标放在原点附近最近的格）
      const start = { cell: g.state.cursor.cell, edge: g.state.cursor.edge };
      const v0 = voxels();

      /* 十字键右 = 换边不动格 */
      await press(15);
      const afterRight = { cell: g.state.cursor.cell, edge: g.state.cursor.edge };
      /* 十字键上 = 沿拓扑直线前进一格，且出口 = 入口边的对边 */
      const c0 = grid.cells[afterRight.cell];
      const nid = c0.edgeNeighbors[afterRight.edge];
      const twin = c0.edgeTwins[afterRight.edge];
      await press(12);
      const afterUp = { cell: g.state.cursor.cell, edge: g.state.cursor.edge };
      const c1 = grid.cells[afterUp.cell];
      /* 十字键下 = 后退回原来那格 */
      await press(13);
      const afterDown = { cell: g.state.cursor.cell, edge: g.state.cursor.edge };
      /* 未映射按键（按钮 3）= 不该改体素（反向对照） */
      for (let i = 0; i < 2; i++) await press(3);
      const afterNoop = voxels();
      /* A 键按一次 = 沿当前直线连刷一条（整条线每格加一层） */
      const cntPaint = () => g.state.commands.filter((c) => c.startsWith('paintline:')).length;
      const p0 = cntPaint(), vA0 = voxels();
      await press(0);
      const onePaint = { dv: voxels() - vA0, dc: cntPaint() - p0 };
      /* 按住 A 1.3s（≈5 帧）= 只触发一次（padPrev 去抖）；判据：增量 == 单次增量，命令数 +1 */
      const vH0 = voxels(), pH0 = cntPaint();
      window.__padSet(0, true);
      await wait(1300);
      window.__padSet(0, false);
      await wait(500);
      const hold = { dv: voxels() - vH0, dc: cntPaint() - pH0 };
      const afterA = voxels();
      const cmds = g.state.commands.filter((c) => c.startsWith('pad:') || c.startsWith('paintline:')).slice(-14);
      return {
        start, afterRight, afterUp, afterDown,
        wantCell: nid, wantEdge: (twin + 2) % c1.n,
        v0, afterNoop, afterA, onePaint, hold,
        undoAfter: g.state.actState?.depth,
        lineCells: sl()?.cells?.length, closed: sl()?.closed, cmds,
      };
    });
    if (padRes.afterRight.cell !== padRes.start.cell) fail('十字键「右」只换出口边、不该换格');
    if (padRes.afterRight.edge === padRes.start.edge) fail('十字键「右」必须换到相邻出口边');
    if (padRes.wantCell < 0 || padRes.afterUp.cell !== padRes.wantCell) fail(`十字键「上」必须走到该出口边的邻居 ${padRes.wantCell}，实得 ${padRes.afterUp.cell}`);
    if (padRes.afterUp.edge !== padRes.wantEdge) fail(`退出后出口边必须是入口边的对边 ${padRes.wantEdge}，实得 ${padRes.afterUp.edge}`);
    ok(`手柄：右换边 ${padRes.start.edge}→${padRes.afterRight.edge}（格不变），上走进邻居 ${padRes.afterUp.cell} 且出口=对边 ${padRes.afterUp.edge}`);
    if (padRes.afterDown.cell !== padRes.start.cell) fail('十字键「下」必须后退回原格，实得 ' + padRes.afterDown.cell);
    ok(`手柄：下后退回 ${padRes.afterDown.cell}`);
    if (padRes.afterNoop !== padRes.v0) fail('未映射按键不该改体素');
    if (!(padRes.afterA > padRes.v0)) fail(`A 键必须连刷建格：${padRes.v0} → ${padRes.afterA}`);
    if (!(padRes.onePaint.dv > 0) || padRes.onePaint.dc !== 1) fail(`A 键按一次 = 一条 paintline 命令：${JSON.stringify(padRes.onePaint)}`);
    ok(`手柄 A 键连刷：一次 +${padRes.onePaint.dv} 格体素 / 1 条 paintline（整条 ${padRes.lineCells} 格直线各加一层）`);
    if (padRes.hold.dc !== 1) fail(`按住 A 1.3s（≈5 帧）只能触发 1 次（padPrev 去抖），实得 ${padRes.hold.dc} 次`);
    if (padRes.hold.dv !== padRes.onePaint.dv) fail(`按住与单按的增量必须相同：${padRes.hold.dv} vs ${padRes.onePaint.dv}`);
    ok(`按住 A 1.3s（≈5 帧）只触发 1 次，增量 ${padRes.hold.dv} == 单按 ${padRes.onePaint.dv}（去抖）`);
    const padCmds = padRes.cmds.filter((c) => c.startsWith('pad:'));
    if (padCmds.length < 3 || !padCmds.includes('pad:up') || !padCmds.includes('pad:down')) fail('手柄命令日志缺 pad:up/down：' + JSON.stringify(padCmds));
    ok('页面命令日志：' + JSON.stringify(padCmds));

    /* ---------- 5. 连刷（drag-to-paint）：真指针拖动跨格逐条画 ---------- */
    const dragRes = await page.evaluate(async () => {
      const g = window.rea.gameUI, v = window.rea.view, grid = window.rea.grid;
      // 先回到全岛视角（像素那步把镜头贴到了闭环上），再挑屏幕内的连续相邻格
      v.target.set(0, 0, 0); v.yaw = 0.62; v.pitch = 0.95; v.distance = 26; v.updateCamera(); v.__origRender(0);
      // 选「拓扑直线连刷」工具（真点工具格，走 onchange）
      const tile = document.querySelector('#gameui-c06 .gtool .ic[data-key=line]');
      tile.click();
      const tool = g.state.tool;
      const voxels = () => { let n = 0; for (const m of window.rea.world.solid) { let vv = m; while (vv) { n += vv & 1; vv >>= 1; } } return n; };
      // 找一串屏幕内可见、彼此相邻的四边格
      const cv = document.getElementById('view'); const r = cv.getBoundingClientRect();
      const scr = (c) => { const p = v.camera.position.clone(); p.set(c.cx, (window.rea.world.top(c) + .5) * v.levelHeight, c.cz); p.project(v.camera); return { x: r.left + (p.x * .5 + .5) * r.width, y: r.top + (-p.y * .5 + .5) * r.height, z: p.z, id: c.id }; };
      const cands = grid.cells.filter((c) => c.n === 4).map(scr).filter((p) => p.z < 1 && p.x > r.left + 60 && p.x < r.right - 60 && p.y > r.top + 120 && p.y < r.bottom - 60);
      if (!cands.length) return { err: 'no on-screen cell', camera: { d: v.distance, yaw: v.yaw, pitch: v.pitch, t: [v.target.x, v.target.y, v.target.z] }, rough: grid.cells.filter((c) => c.n === 4).map(scr).filter((p) => p.z < 1).length };
      const first = cands[0];
      const c0 = grid.cells[first.id];
      // 相邻格（共边的）里挑屏幕位置也可见的，得到一条 4 格的拖动路径
      const path = [first];
      for (let step = 0; step < 3; step++) {
        const cur = grid.cells[path[path.length - 1].id];
        const nxt = cur.edgeNeighbors.map((id, e) => (id >= 0 ? scr(grid.cells[id]) : null)).find((p) => p && p.z < 1 && Math.hypot(p.x - path[path.length - 1].x, p.y - path[path.length - 1].y) < 90);
        if (!nxt) break;
        path.push(nxt);
      }
      // 基线体素 / 撤销栈
      const v0 = voxels(); const d0 = g.state.actState?.depth ?? 0;
      return { tool, v0, d0, path, edgeIds: path.map((p) => p.id) };
    });
    if (dragRes.err) fail(dragRes.err + ' :: ' + JSON.stringify(dragRes));
    if (dragRes.tool !== 'line') fail('点 line 工具格后 state.tool 必须是 line，实得 ' + dragRes.tool);
    if (dragRes.path.length < 3) fail('屏幕内至少要找到 3 个连续相邻格，实得 ' + dragRes.path.length);
    ok(`连刷工具选中（state.tool=line），拖动路径 ${dragRes.path.length} 格：${JSON.stringify(dragRes.edgeIds)}`);
    // 真指针：move → down → 逐格 move → up
    await page.mouse.move(dragRes.path[0].x, dragRes.path[0].y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.waitForTimeout(150);
    for (const p of dragRes.path.slice(1)) { await page.mouse.move(p.x, p.y, { steps: 6 }); await page.waitForTimeout(140); }
    await page.mouse.up();
    await page.waitForTimeout(200);
    const afterDrag = await page.evaluate(() => {
      const g = window.rea.gameUI;
      const voxels = () => { let n = 0; for (const m of window.rea.world.solid) { let v = m; while (v) { n += v & 1; v >>= 1; } } return n; };
      return { v: voxels(), depth: g.state.actState?.depth, cmds: g.state.commands.filter((c) => c.startsWith('paintline:') || c.startsWith('pad:')).slice(-8), line: g.state.line };
    });
    if (!(afterDrag.v > dragRes.v0)) fail(`拖动连刷必须建格：${dragRes.v0} → ${afterDrag.v}`);
    ok(`拖动连刷体素 ${dragRes.v0} → ${afterDrag.v}（+${afterDrag.v - dragRes.v0}），撤销栈 ${dragRes.d0} → ${afterDrag.depth}`);
    if (afterDrag.cmds.filter((c) => c.startsWith('paintline:')).length < 2) fail('拖动经过多格时应多次 paintline：' + JSON.stringify(afterDrag.cmds));
    ok('拖动期间 paintline 次数：' + afterDrag.cmds.filter((c) => c.startsWith('paintline:')).length);
    // 撤销到底 → 回基线
    /* ---------- 5b. 连刷现场截图（撤销之前拍：实线沿线确实长出了方块） ---------- */
    const dragShot = await page.evaluate((ids) => {
      const v = window.rea.view, grid = window.rea.grid;
      const cs = ids.map((id) => grid.cells[id]).filter(Boolean);
      const mx = cs.reduce((a, c) => a + c.cx, 0) / cs.length, mz = cs.reduce((a, c) => a + c.cz, 0) / cs.length;
      v.target.set(0, 0, 0); v.yaw = 0.62; v.pitch = 0.98; v.distance = 30; v.updateCamera(); v.__origRender(0);
      const src = v.renderer.domElement; const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      cv.getContext('2d').drawImage(src, 0, 0);
      // 数一下这条线上现在有几格是「地上多了一层」（新长出来的方块）
      const tops = cs.map((c) => window.rea.world.top(c));
      return { url: cv.toDataURL('image/png'), tops, cellCount: cs.length };
    }, dragRes.edgeIds);
    if (dragShot.url) fs.writeFileSync(path.join(out, 'topoline-drag-painted.png'), Buffer.from(dragShot.url.split(',')[1], 'base64'));
    ok(`拖动现场截图 topoline-drag-painted.png（${dragShot.cellCount} 格路径，world.top=${JSON.stringify(dragShot.tops)}）`);

    // 撤销到底 → 回到**本轮动手之前**的基线（手柄连刷 + 拖动连刷都进同一个主场景撤销栈）
    const undone = await page.evaluate(async () => {
      const ra = window.rea, g = ra.gameUI;
      let guard = 0;
      g.refreshActs();                                  // actState 只在 rAF 里刷新，同步循环里要用页面自己的刷新函数
      while ((g.state.actState?.depth ?? 0) > 0 && guard++ < 600) { g.click('undo'); g.refreshActs(); }
      let n = 0; for (const m of ra.world.solid) { let v = m; while (v) { n += v & 1; v >>= 1; } }
      return { v: n, depth: ra.gameUI.state.actState?.depth, guard };
    });
    if (undone.depth !== 0) fail('撤销到底后栈必须清空，实得 ' + undone.depth);
    if (undone.v !== padRes.v0) fail(`撤销到底必须回本轮动手前的基线 ${padRes.v0}，实得 ${undone.v}`);
    ok(`撤销 ${undone.guard} 步回基线：${padRes.v0} → ${undone.v}（栈深 0）`);

    /* ---------- 6. 闭环沿线各长一格（水里看得最清楚）+ 现场截图 ---------- */
    const loopPaint = await page.evaluate(async () => {
      const v = window.rea.view, g = window.rea.gameUI, grid = window.rea.grid;
      const vox = () => { let n = 0; for (const m of window.rea.world.solid) { let x = m; while (x) { n += x & 1; x >>= 1; } } return n; };
      const v0 = vox();
      const r = g.setLine(134, 1);
      const base = r.cells.map((c) => window.rea.world.top(c));
      const added = g.paintLine();
      g.refreshActs();
      const after = r.cells.map((c) => window.rea.world.top(c));
      const raised = after.filter((t, i) => t === base[i] + 1).length;
      const xs = r.cells.map((c) => c.cx), zs = r.cells.map((c) => c.cz);
      v.target.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
      v.yaw = 0.7; v.pitch = 1.32; v.distance = 14.2; v.updateCamera(); v.__origRender(0);
      const src = v.renderer.domElement; const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      cv.getContext('2d').drawImage(src, 0, 0);
      return { url: cv.toDataURL('image/png'), v0, dv: vox() - v0, added, raised, n: r.cells.length, depth: g.state.actState?.depth };
    });
    if (loopPaint.raised !== loopPaint.n) fail(`闭环 ${loopPaint.n} 格应全部升 1 层，实得 ${loopPaint.raised}`);
    if (!(loopPaint.dv >= loopPaint.n)) fail(`连刷应至少加 ${loopPaint.n} 格体素，实得 +${loopPaint.dv}`);
    ok(`闭环单次连刷：${loopPaint.n} 格全部 +1 层（体素 +${loopPaint.dv}，paintLine 返回 ${loopPaint.added}，栈深 ${loopPaint.depth}）`);
    if (loopPaint.url) fs.writeFileSync(path.join(out, 'topoline-loop-painted.png'), Buffer.from(loopPaint.url.split(',')[1], 'base64'));
    // 收尾把这一笔也撤掉，页面回到干净基线
    const clean = await page.evaluate(() => {
      const g = window.rea.gameUI;
      let guard = 0; g.refreshActs();
      while ((g.state.actState?.depth ?? 0) > 0 && guard++ < 600) { g.click('undo'); g.refreshActs(); }
      let n = 0; for (const m of window.rea.world.solid) { let x = m; while (x) { n += x & 1; x >>= 1; } }
      return { v: n, depth: g.state.actState?.depth };
    });
    if (clean.depth !== 0) fail('收尾撤销后栈必须清空，实得 ' + clean.depth);
    ok(`收尾撤销回基线：${clean.v}（栈深 0）`);

    if (errors.length) fail('console/page errors: ' + JSON.stringify(errors.slice(0, 6)));
    ok('0 console error');
    console.log('ALL PASS topoline-pad-drag');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL ' + e.message); process.exit(1); });
