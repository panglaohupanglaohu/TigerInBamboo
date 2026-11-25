/**
 * route-preview-battle-browser.cjs — 995043346778415104 在**主战场**里的运行验收（第 175 轮）。
 *
 * 片子（386 帧 / 4 张联系表全看 + 0035·0065·0129·0385 原尺寸）：
 *   ① 下令后地上出一串**白色小圆点**，等弧长（约 0.12 世界单位）；
 *   ② 点串不是起点到终点的直线：先沿台地横走 → 到崖沿**向外抛出去**落到下层 → 再沿下层横走；
 *   ③ 平地拐角是**圆角**，不是尖折；
 *   ④ 点永远浮在地表上，**一个都不埋进崖体**（直线连点会把中段埋进岩壁）；
 *   ⑤ 点串在小队**走完之前常驻**，走过的部分逐段消失（不是 2.5s 淡出的一次性点串）。
 *
 * 这五条在主战场里一次量清：
 *   `?c01=routePreview` → `battle.onPointer` 真下令 → 读 `b.c01.stats` / `b.path.geometry` /
 *   `b.c01.route`（常驻对象）/ `b.pathT`（淡出计时），并用 `view.index.cellAt + world.top` 数「埋点」。
 *
 * 跑法：
 *   NODE_PATH=/tmp/pw-shim:/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules \
 *     node tests/route-preview-battle-browser.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const OUT = path.resolve(__dirname, '../artifacts/coverage');
const BASE = process.env.REA_TEST_URL || 'http://127.0.0.1:8769';
const pct = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r3 = (x) => (x == null ? null : +x.toFixed(3));

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const report = {};
  let ok = 0;
  const check = (name, cond, detail) => {
    if (!cond) throw new Error(`FAIL ${name}: ${detail}`);
    ok++; console.log(`  PASS ${name} — ${detail}`);
  };
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); });

  try {
    /* ---------------- ① 起页（swiftshader 首帧偶发 60s+，重试） ---------------- */
    for (let attempt = 0; attempt < 3; attempt++) {
      await p.goto(BASE + '/index.html?scene=badnorth&grid=quad&c01=routePreview', { waitUntil: 'domcontentloaded' });
      try { await p.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 90000 }); break; } catch (e) { if (attempt === 2) throw e; console.log('  retry boot ' + (attempt + 1)); }
    }
    await p.waitForTimeout(1500);
    // 停掉自动推进：所有读数都从「手动喂 dt」的确定性时间轴里取
    await p.evaluate(() => { window.__origFrame = rea.view.onFrame; rea.view.onFrame = null; });

    /* ---------------- ② URL 入口：本片之前只能从控制台开 ---------------- */
    const url = await p.evaluate(() => ({ param: rea.battle.c01Param, applied: rea.battle.c01ParamApplied ?? 0, route: rea.battle.c01.on.routePreview, houseChar: rea.battle.c01.on.houseChar, column: rea.battle.c01.on.column }));
    check('URL 入口 ?c01=routePreview', url.route === true && url.applied >= 1 && url.param === 'routePreview',
      `param="${url.param}" applied=${url.applied} routePreview=${url.route}`);
    check('URL 不动其它默认档', url.houseChar === true && url.column === false, `houseChar=${url.houseChar} column=${url.column}`);

    /* ---------------- ③ 夹具：一队人站在上层台地，目标取「下层 + 节点多 + 够远」 ---------------- */
    const fix = await p.evaluate(() => {
      const b = rea.battle, w = b.world, L = b.L;
      b.paused = false; b.scale = 1; b.nextWave = 1e9; b.wave = 1; b.t = 40;
      for (const u of b.units) if (u.team === 1) u.dead = true;                    // 只量行军，不量打架
      const sq = b.squads.find((s) => s.alive && s.members.filter((u) => !u.dead).length >= 4) || b.squads[0];
      const men = sq.members.filter((u) => !u.dead);
      men.forEach((u) => { u.onBoat = null; u.fall = false; u.hp = u.max = 3; u.cd = 1e6; });
      // 起格取「顶层」：顶层上方无遮挡，下层目标一定跨崖
      const cands = w.cells.filter((c) => w.top(c) >= 2 && c.area > 0.3);
      let start = cands[0] || w.cells[0];
      const place = (c) => men.forEach((u, i) => { const a = i * 0.785; u.x = c.cx + Math.cos(a) * 0.03; u.z = c.cz + Math.sin(a) * 0.03; u.y = w.top(c) * L; u.navFloor = w.top(c); });
      place(start);
      let best = null;
      for (const c of w.cells) {
        if (w.top(c) < 1 || w.top(c) >= w.top(start)) continue;                     // 必须往**下**走
        const pl = b.navigation.plan(men[0], c, w.top(c));
        if (!pl) continue;
        const n = Object.keys(pl.tree.next || {}).length || 0;
        const d = Math.hypot(c.cx - start.cx, c.cz - start.cz);
        if (d < 1.2 || n < 4) continue;
        const score = n * 6 + d + (w.top(start) - w.top(c)) * 4;
        if (!best || score > best.score) best = { cell: c, score, n, d, floor: w.top(c) };
      }
      if (!best) throw Error('找不到「下层 + 多节点」的目标格');
      sq.goal = best.cell; sq.goalFloor = best.floor; sq.c01 = null;
      window.__fix = { sq, men, start, best, place: null };
      // 真下令路径：battle.onPointer（内部 #drawPath → g3.onMove → c01.onMove）
      b.selected = sq;
      b.onPointer({ cell: best.cell, point: { x: best.cell.cx, y: best.floor * L + 0.1, z: best.cell.cz } });
      window.__fix.place = place;
      return { squad: sq.id, n: men.length, startTop: w.top(start), startY: +(w.top(start) * L).toFixed(3), goalFloor: best.floor, dist: +best.d.toFixed(3), nodes: best.n, L };
    });
    check('夹具就绪（跨崖 + 多节点）', fix.nodes >= 4 && fix.startTop > fix.goalFloor && fix.n >= 4,
      `squad=${fix.squad} n=${fix.n} 起 ${fix.startTop} 层 → 目标 ${fix.goalFloor} 层，距离 ${fix.dist}，导航节点 ${fix.nodes}，L=${fix.L}`);

    /* ---------------- ④ 几何：等弧长 / 落崖弧 / 圆角 / 真的不埋点 ---------------- */
    const geo = await p.evaluate(() => {
      const b = rea.battle, L = b.L, w = b.world, idx = rea.view.index;
      const st = b.c01.stats, samples = b.commandPathSamples, pts = samples?.points || [];
      const pos = b.path.geometry.attributes.position;
      const q = (arr, f) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
      // 间距
      const sp = [];
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], c = pts[i]; sp.push(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2])); }
      // 埋点：点比该处地块顶面低 0.02 以上就算埋住（battle 自己的 #groundY 同一口径）
      const buried = (arr) => {
        const hit = [];
        for (let i = 0; i < arr.length; i++) {
          const q = arr[i], c = idx.cellAt(q[0], q[2]);
          if (!c) continue;
          const g = w.top(c) * L;
          if (q[1] < g - 0.02) hit.push(i);
        }
        return hit;
      };
      // 直线连点对照：同一串导航节点、同一间距，但不做落崖弧（= 旧 #drawPath 那种斜插）
      const lead = window.__fix.men.find((u) => !u.dead);
      const plan = b.navigation.plan(lead, window.__fix.best.cell, window.__fix.best.floor);
      const graph = b.navigation.graph, nodes = [[lead.x, lead.y + 0.05, lead.z]];
      for (let id = plan.from.id, k = 0; id >= 0 && k < graph.nodes.length; k++) { const a = graph.nodes[id]; nodes.push([a.x, a.floor * L + 0.05, a.z]); const nx = plan.tree.next[id]; if (nx < 0) break; id = nx; }
      const naive = [nodes[0]];
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1], c = nodes[i], n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / 0.12));
        for (let k = 1; k <= n; k++) naive.push([a[0] + (c[0] - a[0]) * k / n, a[1] + (c[1] - a[1]) * k / n, a[2] + (c[2] - a[2]) * k / n]);
      }
      // 跨层跳数（节点层高变化）+ 最陡段（落崖弧应当是陡的）
      let hops = 0;
      for (let i = 1; i < nodes.length; i++) if (Math.abs(nodes[i][1] - nodes[i - 1][1]) >= L * 0.9) hops++;
      let steepest = 0, midPoints = 0;
      const yMin = Math.min(...nodes.map((n) => n[1])), yMax = Math.max(...nodes.map((n) => n[1]));
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], c = pts[i], len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
        if (len > 1e-9) steepest = Math.max(steepest, Math.abs(c[1] - a[1]) / len);
        if (c[1] > yMin + 1e-6 && c[1] < yMax - 1e-6) midPoints++;
      }
      // 路线长度 vs 三维直线距离（点串不是起点→终点的直线）
      const straight = Math.hypot(
        window.__fix.best.cell.cx - lead.x,
        window.__fix.best.floor * L - lead.y,
        window.__fix.best.cell.cz - lead.z);
      return {
        stats: { samples: st.routeSamples, arcs: st.routeArcs, corners: st.routeCorners, trimmed: st.routeTrimmed ?? 0 },
        geoCount: pos.count, pts: pts.length, hops, steepest: +steepest.toFixed(3), midPoints,
        spacing: { p50: +q(sp, 0.5).toFixed(4), p90: +q(sp, 0.9).toFixed(4), min: +Math.min(...sp).toFixed(4), max: +Math.max(...sp).toFixed(4) },
        buried: buried(pts).length, buriedNaive: buried(naive).length, naivePts: naive.length,
        len: +samples.length.toFixed(3), straight: +straight.toFixed(3),
        straightRatio: +(samples.length / Math.max(1e-6, straight)).toFixed(3),
      };
    });
    report.geo = geo;
    check('预览点串已接管主战场几何', geo.stats.samples > 12 && geo.geoCount === geo.stats.samples,
      `b.c01.stats.routeSamples=${geo.stats.samples}，b.path.geometry.count=${geo.geoCount}（同一串；commandPathSamples=${geo.pts}）`);
    check('等弧长（约 0.12）', geo.spacing.p50 > 0.10 && geo.spacing.p50 < 0.15 && geo.spacing.p90 < 0.20,
      `间距 p50=${geo.spacing.p50} p90=${geo.spacing.p90} min=${geo.spacing.min} max=${geo.spacing.max}`);
    check('落崖弧（跨层段换成弧，不是斜插）', geo.stats.arcs >= 1 && geo.stats.arcs === geo.hops && geo.midPoints > 0,
      `弧=${geo.stats.arcs} == 跨层跳数=${geo.hops}；楼层之间的过渡点=${geo.midPoints}；最陡段斜率=${geo.steepest}`);
    check('平地圆角（不是尖折）', geo.stats.corners >= 1, `圆角=${geo.stats.corners}`);
    check('一个点都不埋进崖体（直线连点会埋）', geo.buried === 0 && geo.buriedNaive > 0,
      `弧版埋点 ${geo.buried}/${geo.pts}；直线连点 ${geo.buriedNaive}/${geo.naivePts}`);
    check('点串不是起点→终点直线', geo.straightRatio > 1.1, `路线长 ${geo.len} vs 直线 ${geo.straight}（×${geo.straightRatio}）`);

    /* ---------------- ⑤ 常驻：走完之前不清、走过的逐段消失 ---------------- */
    const walk = await p.evaluate(() => {
      const b = rea.battle, rows = [];
      const snap = (f) => ({ f, t: +b.t.toFixed(2), alive: !!b.c01.route, pathT: +b.pathT.toFixed(3), count: b.path.geometry.attributes.position.count, trimmed: b.c01.stats.routeTrimmed ?? 0, arrived: b.c01.route ? false : null });
      for (let f = 0; f < 1800; f++) {
        if (f % 10 === 0) rows.push(snap(f));
        b.update(1 / 60);
      }
      rows.push(snap(1800));
      return rows;
    });
    report.walk = walk;
    const after3s = walk.filter((r) => r.t >= 42.5 && r.t <= 44.5);       // 下令 2.5s 之后（旧档此时已经淡完）
    const alive3s = after3s.filter((r) => r.alive && r.count > 0);
    const firstTrim = walk.find((r) => r.trimmed > 0);
    const lastRow = walk.at(-1);
    check('走完之前常驻（>2.5s 仍在）', alive3s.length >= 5 && alive3s.every((r) => r.pathT >= 1.1),
      `${after3s.length} 帧落在下令后 2.5–4.5s：仍常驻 ${alive3s.length} 帧，pathT ≥ ${alive3s.length ? Math.min(...alive3s.map((r) => r.pathT)) : 'n/a'}（每帧先抬到 1.2 再减一格 0.0167，故稳定在 1.18；旧档 2.5s 就该归零）`);
    check('走过的部分逐段消失', !!firstTrim && firstTrim.count < walk[0].count,
      firstTrim ? `t=${firstTrim.t}s 起逐段裁切：点 ${walk[0].count} → ${firstTrim.count}（先到 ${firstTrim.trimmed}）` : '从未裁切');
    const counts = walk.filter((r) => r.alive).map((r) => r.count);
    let mono = true;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[i - 1] + 1) mono = false;
    check('裁切单调（只减不增）', mono && counts.length > 2, `常驻期间点数的 ${counts.length} 个采样单调不增：${counts.slice(0, 6).join('→')}…${counts.at(-1)}`);
    check('走到后交回淡出', lastRow.alive === false || lastRow.count === 0, `1800 帧后 route=${lastRow.alive} count=${lastRow.count} pathT=${lastRow.pathT}（走完 → 交回 battle 的淡出）`);

    /* ---------------- ⑥ 对照：关掉该层就是「2.5s 淡出的一次性点串」 ---------------- */
    const base = await p.evaluate(() => {
      const b = rea.battle, F = window.__fix;
      b.c01.set('routePreview', false);
      b.c01.route = null; b.c01.stats.routeTrimmed = 0;
      F.place(F.start); F.sq.c01 = null; F.sq.goal = F.best.cell; F.sq.goalFloor = F.best.floor;
      b.selected = F.sq;
      b.onPointer({ cell: F.best.cell, point: { x: F.best.cell.cx, y: F.best.floor * b.L + 0.1, z: F.best.cell.cz } });
      const rows = [{ t: +b.t.toFixed(2), pathT: +b.pathT.toFixed(3), count: b.path.geometry.attributes.position.count, walking: F.sq.alive && !F.sq.arrived }];
      for (let f = 0; f < 240; f++) { b.update(1 / 60); if (f % 15 === 0 || f === 239) rows.push({ t: +b.t.toFixed(2), pathT: +b.pathT.toFixed(3), count: b.path.geometry.attributes.position.count, walking: F.sq.alive && !F.sq.arrived }); }
      const late = rows.filter((r) => r.t - rows[0].t >= 2.6);
      return { rows, late: late.slice(-2), stillWalking: late.some((r) => r.walking) };
    });
    report.base = base;
    check('对照档：2.5s 后点串已清空（小队还在走）', base.late.length > 0 && base.late.every((r) => r.count === 0) && base.stillWalking,
      `关掉 routePreview 后 ${base.late.map((r) => `t+${r.t}s count=${r.count} pathT=${r.pathT}`).join('；')}；此时小队仍在行军=${base.stillWalking}`);

    /* ---------------- ⑦ 像素 A/B：同机位同位置，开/关各一张 ---------------- */
    await p.evaluate(() => {
      const b = rea.battle, v = rea.view;
      document.getElementById('hud')?.style.setProperty('display', 'none');
      document.querySelectorAll('[data-progress-badge]').forEach((n) => { n.closest('div').style.display = 'none'; });
      const F = window.__fix, L = b.L;
      // 机位取「整条点串的包围盒」：能同时看到台地、崖沿、下层（片子是俯视全景）
      const pts = b.commandPathSamples?.points || [];
      const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[2]), ys = pts.map((q) => q[1]);
      const c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
      const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      v.target.set(c[0], c[1], c[2]); v.distance = Math.max(6, ext * 1.5); v.pitch = 1.12; v.yaw = Math.PI * 0.12;
      v.updateCamera();
      // 相机锁死：pin 定时器（app 会在世界异步生成后再 fit 一次）+ 关掉 updateCamera 的缓动漂移，
      // 否则两次截图会差一个亚像素的全屏位移（r175 第一版 985px 的假差分就是这么来的）
      window.__camSave = { p: v.camera.position.clone(), q: v.camera.quaternion.clone() };
      const lockCam = () => { v.target.set(c[0], c[1], c[2]); v.distance = Math.max(6, ext * 1.5); v.pitch = 1.12; v.yaw = Math.PI * 0.12; v.updateCamera(); };
      window.__pin = lockCam;
      if (!window.__pinT) window.__pinT = setInterval(lockCam, 100);
      v.updateCamera = () => { v.camera.position.copy(window.__camSave.p); v.camera.quaternion.copy(window.__camSave.q); v.camera.updateMatrixWorld(); };
      const orig = v.render.bind(v);
      window.__origRender = orig;
      v.render = () => { orig(0); };
      b.paused = true;   // 位置冻住：两次截图必须是同一批人站在同一格上
    });
    const order = async (on) => {
      await p.evaluate((v) => {
        const b = rea.battle, F = window.__fix;
        // 12 帧 update 里有 Math.random（烟尘/血迹抖动）：固定种子，让「开→关→开」能逐像素回位
        let sd = 20261122; Math.random = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
        b.c01.set('routePreview', v);
        b.c01.route = null; b.c01.stats.routeTrimmed = 0;
        F.place(F.start); F.sq.c01 = null; F.sq.goal = F.best.cell; F.sq.goalFloor = F.best.floor;
        b.paused = false; b.selected = F.sq;
        b.t = 40;          // 单位待机动作按 b.t 走相位：两次截图必须同一时刻，否则差在人物身上（本轮实测 1234px）
        // 下令之后**一帧都不推进**：三种状态的单位站位逐字相同，差分里只剩点串这一层
        b.paused = true;
        b.onPointer({ cell: F.best.cell, point: { x: F.best.cell.cx, y: F.best.floor * b.L + 0.1, z: F.best.cell.cz } });
        window.__pin(); rea.view.render(0);
      }, on);
      await p.waitForTimeout(420);
    };
    const snap = async (name) => {
      const buf = await p.locator('canvas').screenshot({ path: path.join(OUT, name) });
      const st = await p.evaluate(() => ({ count: rea.battle.path.geometry.attributes.position.count, arcs: rea.battle.c01.stats.routeArcs, route: !!rea.battle.c01.route }));
      return { buf, ...st };
    };
    // 两次「开」之间**什么都不动**（噪声底），所以 on2 只截图不重新下令
    await order(true);
    const on1 = await snap('route-preview-battle-r175-on.png');
    const on2 = await snap('route-preview-battle-r175-on2.png');
    await order(false);
    const off = await snap('route-preview-battle-r175-off.png');
    await order(true);
    const back = await snap('route-preview-battle-r175-back.png');
    report.shot = { on: on1.count, onArcs: on1.arcs, onRoute: on1.route, off: off.count };
    check('截图时两种状态都真有几何', on1.count > 12 && off.count > 0 && off.count !== on1.count,
      `开=${on1.count} 点（弧 ${on1.arcs}）/ 关=${off.count} 点（直线连点一档）`);

    const cmpPng = (bufA, bufB) => p.evaluate(async ([A, B]) => {
      const load = async (b64) => { const blob = await (await fetch('data:image/png;base64,' + b64)).blob(); return createImageBitmap(blob); };
      const ia = await load(A), ib = await load(B), w = ia.width, h = ia.height;
      const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
      const grab = async (img) => { g.clearRect(0, 0, w, h); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const da = await grab(ia), db = await grab(ib);
      let n = 0;
      for (let i = 0; i < da.length; i += 4) {
        const la = 0.299 * da[i] + 0.587 * da[i + 1] + 0.114 * da[i + 2];
        const lb = 0.299 * db[i] + 0.587 * db[i + 1] + 0.114 * db[i + 2];
        if (Math.abs(la - lb) > 8) n++;
      }
      return { w, h, diffPx: n };
    }, [bufA.toString('base64'), bufB.toString('base64')]);
    report.pixels = {
      noise: await cmpPng(on1.buf, on2.buf),
      onOff: await cmpPng(on1.buf, off.buf),
      restored: await cmpPng(on1.buf, back.buf),
    };
    check('同状态噪声 0', report.pixels.noise.diffPx === 0, `${report.pixels.noise.diffPx} px`);
    check('落崖弧版与直线版在画面上可分', report.pixels.onOff.diffPx > 300, `开/关差分 ${report.pixels.onOff.diffPx} px（${report.pixels.onOff.w}×${report.pixels.onOff.h}）`);
    check('开→关→开 回位', report.pixels.restored.diffPx === 0, `${report.pixels.restored.diffPx} px`);

    // 还原现场
    await p.evaluate(() => { clearInterval(window.__pinT); if (window.__origRender) rea.view.render = window.__origRender; rea.battle.paused = false; rea.view.onFrame = window.__origFrame; });

    check('无 console error', errors.length === 0, `${errors.length} 条 ${errors.slice(0, 2).join(' | ')}`);
    report.errors = errors;
    fs.writeFileSync(path.join(OUT, 'route-preview-battle-r175.json'), JSON.stringify(report, null, 1));
    console.log(`\nPASS route-preview-battle（r175）${ok} 项`);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('\nFAIL ' + err.message);
    try { fs.writeFileSync(path.join(OUT, 'route-preview-battle-r175.json'), JSON.stringify({ report, error: err.message }, null, 1)); } catch {}
    await browser.close();
    process.exit(1);
  }
})();
