/**
 * column-march-browser.cjs — 816743289500106752 在主战场里的运行验收（第 173 轮）。
 *
 * 片里的四件事（431 帧 / 5 张联系表全看 + 0120·0240·0340·0430 原尺寸）：
 *   ① 成列行军：一队人排队沿同一条路走，前后**等距**（不是一坨）；
 *   ② 跨台阶：队列自然拉成竖列（水平几乎重合、逐级向下）；
 *   ③ 到达后展开成 3–4 排方块（朝向 = 行军方向）；
 *   ④ 路上有等弧长白色引导点（`?c01=routePreview` 那层常驻点串）；
 *   ⑤ 拐角处整列**收拢**：转角越大、离拐点越近（内圈）降得越多 —— 本轮补的机制。
 *
 * 只看真跑起来的战斗：位置/转角/速度倍率全部从 `battle.c01.columnStats()` 读，
 * 引导点是真几何（`b.commandPathSamples`），另外落两张截图（中途 / 到位）。
 *
 * 跑法：
 *   NODE_PATH=/tmp/pw-shim:/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules \
 *     node tests/column-march-browser.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = 'artifacts/coverage';
const pct = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r3 = (x) => (x == null ? null : +x.toFixed(3));

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  let ok = 0;
  const check = (name, cond, detail) => {
    if (!cond) throw new Error(`FAIL ${name}: ${detail}`);
    ok++; console.log(`  PASS ${name} — ${detail}`);
  };
  p.on('pageerror', (e) => errors.push(e.message));

  try {
    // 主场景在 swiftshader 下首帧偶尔 60s+，给两次重试（r171 的坑）
    for (let attempt = 0; attempt < 3; attempt++) {
      await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad&c01=column,routePreview', { waitUntil: 'domcontentloaded' });
      try { await p.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 90000 }); break; } catch (e) { if (attempt === 2) throw e; console.log('  retry boot ' + (attempt + 1)); }
    }

    // ── ① URL 入口：本片之前只能从控制台开（全仓没有一处解析 `?c01=`） ─────────────
    const url = await p.evaluate(() => ({ param: rea.battle.c01Param, applied: rea.battle.c01ParamApplied ?? 0, column: rea.battle.c01.on.column, route: rea.battle.c01.on.routePreview, houseChar: rea.battle.c01.on.houseChar }));
    check('url c01=column', url.column === true && url.applied >= 2, `param="${url.param}" applied=${url.applied} column=${url.column} routePreview=${url.route}`);
    // 不得把默认档冲掉：houseChar 默认开，没写 `-houseChar` 就该还在
    check('url 不动默认档', url.houseChar === true, `houseChar=${url.houseChar}`);

    // ── ② 夹具：8 人齐放在同一台地格，目标取「走得最远 + 至少 4 个节点」的格 ──────
    const fix = await p.evaluate(() => {
      const b = rea.battle, w = b.world, L = b.L;
      b.paused = false; b.scale = 1; b.nextWave = 1e9; b.wave = 1; b.t = 40;
      for (const u of b.units) if (u.team === 1) u.dead = true;    // 维京人清场：只量行军，不量打架
      const sq = b.squads.find((s) => s.alive && s.members.length >= 8) || b.squads[0];
      const men = sq.members.filter((u) => !u.dead);
      men.forEach((u) => { u.dead = false; u.onBoat = null; u.fall = false; u.hp = u.max = 3; u.cd = 1e6; });
      const start = w.cells.find((c) => w.top(c) >= 2) || w.cells[0];
      men.forEach((u, i) => { const a = i * 0.785; u.x = start.cx + Math.cos(a) * 0.03; u.z = start.cz + Math.sin(a) * 0.03; u.y = w.top(start) * L; u.navFloor = w.top(start); });
      // 目标：同/异层都行，取导航树里节点数最多的那个（= 路上真有拐点）
      let best = null;
      for (const c of w.cells) {
        if (w.top(c) < 1 || c === start) continue;
        const pl = b.navigation.plan(men[0], c, w.top(c));
        if (!pl || !Number.isFinite(pl.tree.distance[pl.from.id] ?? 0)) continue;
        const n = Object.keys(pl.tree.next || {}).length || 0;
        const d = Math.hypot(c.cx - start.cx, c.cz - start.cz);
        if (d < 0.8) continue;
        const score = n * 10 + d;
        if (!best || score > best.score) best = { cell: c, score, n, d, floor: w.top(c) };
      }
      if (!best) throw Error('找不到可达的远目标格');
      sq.goal = best.cell; sq.goalFloor = best.floor;
      // 同一条真实下令路径（onPointer → #drawPath + c01.onMove），不手搓内部状态
      b.selected = sq;
      b.onPointer({ cell: best.cell, point: { x: best.cell.cx, y: best.floor * L + 0.1, z: best.cell.cz } });
      window.__colFix = { sq, best, start };
      return { squad: sq.id, n: men.length, start: [start.cx, start.cz], startTop: w.top(start), goal: [best.cell.cx, best.cell.cz], goalFloor: best.floor, nodes: best.n, dist: +best.d.toFixed(3), L };
    });
    check('夹具就绪', fix.nodes >= 4 && fix.n >= 6, `squad=${fix.squad} n=${fix.n} start=${fix.startTop}层 goal=${fix.goalFloor}层 距离=${fix.dist} 节点=${fix.nodes}`);

    // ── ③ 跑：每 3 帧取一次列队读数 ────────────────────────────────────────────────
    const trace = await p.evaluate(() => {
      const b = rea.battle, best = window.__colFix.best, sq = window.__colFix.sq;
      const rows = [];
      const snap = (f) => { const st = b.c01.columnStats(); if (!st) return null; return { f, t: +b.t.toFixed(2), feet: +(Math.max(...sq.members.filter((u) => !u.dead).map((u) => Math.abs(u.y - b.navigation.footHeight(u))), 0)).toFixed(4), waits: b.c01.stats.waits, slotted: b.c01.stats.slotted, cornerTurns: b.c01.stats.cornerTurns, cornerSlows: b.c01.stats.cornerSlows, minK: +b.c01.stats.minSpeedK.toFixed(3), men: st.men.map((m) => ({ r: m.r, x: +m.x.toFixed(4), z: +m.z.toFixed(4), y: +m.y.toFixed(4), fl: m.floor, w: m.waiting, k: +m.speedK.toFixed(3), turn: +m.turn.toFixed(3), piv: m.pivot == null ? null : +m.pivot.toFixed(3), slot: m.slot.map((v) => +v.toFixed(4)), cols: m.cols, rows: m.rows })) }; };
      for (let f = 0; f < 2400; f++) {
        if (f % 3 === 0) { const s = snap(f); if (s) rows.push(s); }
        b.update(1 / 60);
        const s = b.c01.columnStats();
        // 判据是 0.06，但循环跑到全员 <0.03 才停：这样「末帧」记的是**稳定态**，而不是刚擦过阈值那一帧
        if (s && s.men.length && s.men.every((m) => Math.hypot(m.x - m.slot[0], m.z - m.slot[1]) < 0.03)) { rows.push({ ...snap(f), arrived: true }); break; }
      }
      const path = b.commandPathSamples;
      const sp = [];
      if (path?.points?.length > 1) for (let i = 1; i < path.points.length; i++) { const a = path.points[i - 1], c = path.points[i]; sp.push(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2])); }
      const cs = b.c01.columnStats();
      return { crawls: cs?.crawls ?? 0, slides: cs?.slides ?? 0, stuck: cs?.stuck ?? 0, rows, path: { n: path?.points?.length ?? 0, spacing: sp, arcs: b.c01.stats.routeArcs, corners: b.c01.stats.routeCorners }, stats: { ...b.c01.stats }, goal: [best.cell.cx, best.cell.cz] };
    });

    // ── ④ 判 ① 成列等距 ───────────────────────────────────────────────────────────
    const gaps = [], straightK = [], cornerK = [], cornerPairs = [], vertCols = [];
    let cornerFrames = 0, straightFrames = 0;
    for (const row of trace.rows) {
      if (!row.men) continue;
      const ms = row.men.slice().sort((a, b) => a.r - b.r);
      for (let i = 1; i < ms.length; i++) {
        const a = ms[i - 1], b = ms[i];
        if (a.w || b.w) continue;
        if (a.fl !== b.fl) { if (Math.hypot(a.x - b.x, a.z - b.z) < 0.32) vertCols.push({ h: Math.hypot(a.x - b.x, a.z - b.z), dy: Math.abs(a.y - b.y), afl: a.fl, bfl: b.fl, ay: a.y, by: b.y, f: row.f }); continue; }
        gaps.push(Math.hypot(a.x - b.x, a.z - b.z));
      }
      let anyCorner = false;
      for (const m of ms) {
        if (m.turn < 0.1) straightK.push(m.k);
        if (m.turn > 0.4 && m.piv != null && m.piv < 0.45) { anyCorner = true; cornerK.push(m.k); cornerPairs.push({ piv: m.piv, k: m.k, turn: m.turn }); }
      }
      if (anyCorner) cornerFrames++; else straightFrames++;
    }
    const gP50 = pct(gaps, 0.5), gP90 = pct(gaps, 0.9);
    check('成列等距（同层相邻名次）', gP50 != null && gP50 > 0.08 && gP50 < 0.26 && gP90 < 0.45,
      `gap p50=${r3(gP50)} p90=${r3(gP90)} 样本=${gaps.length}（列队 spacing=0.15，含局部排斥后放宽到 0.08–0.26）`);

    // ── ⑤ 判 ② 跨台阶拉成竖列 ────────────────────────────────────────────────────
    const dyL = vertCols.filter((v) => v.dy > fix.L * 0.4).length;
    const dyMax = vertCols.length ? Math.max(...vertCols.map((v) => v.dy)) : 0;
    const feetMax = Math.max(...trace.rows.filter((r) => r.feet != null).map((r) => r.feet));
    check('跨台阶竖列（平面重合 + 楼层不同）', vertCols.length > 0 && pct(vertCols.map((v) => v.h), 0.5) < 0.32,
      `异层相邻对=${vertCols.length} 水平 p50=${r3(pct(vertCols.map((v) => v.h), 0.5))}（<0.32 = 俯视看是一条线）；y 差 max=${r3(dyMax)}（只在下落那几帧分开，≥0.4L 的帧=${dyL}）`);

    // ── ⑥ 判 ⑤ 拐角减速（转角两轴 + 内圈更慢） ─────────────────────────────────
    check('直线段不降速', straightK.length > 100 && mean(straightK) > 0.995,
      `直线样本=${straightK.length} 均值=${r3(mean(straightK))}`);
    check('拐角处降速', cornerK.length > 20 && mean(cornerK) < 0.92 && Math.min(...cornerK) < 0.75,
      `拐角样本=${cornerK.length} 均值=${r3(mean(cornerK))} 最小=${r3(Math.min(...cornerK))}`);
    // 单调性：转角越大越慢（原片只有**单列**长蛇，没有内/外两条线，「内圈」在本仓只能当 shaping 项；
    // 可证的是「转角 ↑ ⇒ 速度 ↓」，按转角三分位比）
    const byTurn = cornerPairs.slice().sort((a, b) => a.turn - b.turn);
    const cut = Math.max(5, Math.floor(byTurn.length / 3));
    const softK = byTurn.slice(0, cut).map((c) => c.k), hardK = byTurn.slice(-cut).map((c) => c.k);
    check('转角越大越慢（单调）', softK.length >= 5 && hardK.length >= 5 && mean(hardK) < mean(softK) - 0.02,
      `小转角(p50 turn=${r3(byTurn[cut - 1]?.turn)}) ${softK.length} 帧均值 ${r3(mean(softK))} vs 大转角(≥${r3(byTurn[byTurn.length - cut]?.turn)}) ${hardK.length} 帧均值 ${r3(mean(hardK))}`);
    check('stats 记账', trace.stats.cornerTurns > 0 && trace.stats.cornerSlows > 0 && trace.stats.minSpeedK < 1 && trace.stats.waits > 0,
      `cornerTurns=${trace.stats.cornerTurns} cornerSlows=${trace.stats.cornerSlows} minSpeedK=${r3(trace.stats.minSpeedK)} waits=${trace.stats.waits} slotted=${trace.stats.slotted}`);

    // ── ⑦ 判 ④ 等弧长白色引导点 ──────────────────────────────────────────────────
    const dP50 = pct(trace.path.spacing, 0.5), dP90 = pct(trace.path.spacing, 0.9);
    check('引导点等弧长', trace.path.n > 12 && dP50 > 0.10 && dP50 < 0.20 && dP90 < 0.26,
      `点=${trace.path.n} 间距 p50=${r3(dP50)} p90=${r3(dP90)} 落崖弧=${trace.path.arcs} 圆角=${trace.path.corners}`);

    // ── ⑧ 判 ③ 到位展开成方块 ────────────────────────────────────────────────────
    const last = [...trace.rows].reverse().find((r) => r.men);
    const arrived = last.men.every((m) => Math.hypot(m.x - m.slot[0], m.z - m.slot[1]) < 0.06);
    const errs = last.men.map((m) => Math.hypot(m.x - m.slot[0], m.z - m.slot[1]));
    const cols = last.men[0].cols, rows = last.men[0].rows;
    const xs = last.men.map((m) => m.x), zs = last.men.map((m) => m.z);
    check('到位落格', arrived, `n=${last.men.length} 最大偏差=${r3(Math.max(...errs))} cols=${cols} rows=${rows} 账面 ${cols}×${rows}；逐人 ${errs.map((e, i) => i + ':' + r3(e)).join(' ')}；末帧 ${last.men.map((m) => '(' + r3(m.x) + ',' + r3(m.z) + '→' + r3(m.slot[0]) + ',' + r3(m.slot[1]) + ')').join(' ')}`);
    check('方块 4 列布局', cols >= 4 && rows === Math.ceil(last.men.length / cols) && Math.max(...errs) < 0.06,
      `cols=${cols} rows=${rows} n=${last.men.length}（原片 3–4 排方块）`);
    // 第 174 轮：到位卡死的真因是「推进全有或全无」——贴到格子拐角后每帧都被拒。
    // 新路径（侧滑 ±45/±90 + 逐级缩步）必须在这次运行里真的被用到，否则说明夹具没压到那个拐角。
    check('卡点恢复生效（侧滑/缩步真的跑过）', trace.slides + trace.crawls > 0 && trace.slides > 0,
      `侧滑 ${trace.slides} 次 / 缩步 ${trace.crawls} 次 / 缩到 1/16 仍被拒 ${trace.stuck} 帧（后者是排队等前一个的帧，不是卡死：到位偏差见下条）`);
    check('到位脚贴地', last.feet != null && last.feet < 0.02, `到位时 |y − footHeight| 最大=${r3(last.feet)}（行进中因落地缓动 rate=10 会有 0.1–0.5 的过渡差，属既有平滑，不是悬空）`);
    check('方块真的铺开（不是一坨）', (Math.max(...xs) - Math.min(...xs) > 0.25 || Math.max(...zs) - Math.min(...zs) > 0.25),
      `跨度 x=${r3(Math.max(...xs) - Math.min(...xs))} z=${r3(Math.max(...zs) - Math.min(...zs))}`);

    // ── ⑨ 截图：中途一帧（改相机盯住小队质心）+ 到位一帧 ───────────────────────
    await p.evaluate(() => {
      const b = rea.battle, sq = window.__colFix.sq;
      const alive = sq.members.filter((u) => !u.dead);
      const cx = alive.reduce((s, u) => s + u.x, 0) / alive.length, cz = alive.reduce((s, u) => s + u.z, 0) / alive.length;
      rea.view.target.set(cx, b.world.top(window.__colFix.best.cell) * b.L, cz);
      rea.view.distance = 9; rea.view.pitch = 1.12; rea.view.updateCamera();
    });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/column-arrive-r174.png` });

    // 中途：重跑一次并在队伍走到一半时截图
    await p.evaluate(() => {
      const b = rea.battle, sq = window.__colFix.sq, w = b.world, L = b.L, start = window.__colFix.start;
      const men = sq.members.filter((u) => !u.dead);
      men.forEach((u, i) => { const a = i * 0.785; u.x = start.cx + Math.cos(a) * 0.03; u.z = start.cz + Math.sin(a) * 0.03; u.y = w.top(start) * L; u.navFloor = w.top(start); });
      sq.goal = window.__colFix.best.cell; sq.goalFloor = window.__colFix.best.floor; sq.c01 = null;
      b.c01.stats.waits = 0; b.c01.stats.cornerTurns = 0; b.c01.stats.cornerSlows = 0; b.c01.stats.minSpeedK = 1;
      b.selected = sq;
      b.onPointer({ cell: sq.goal, point: { x: sq.goal.cx, y: sq.goalFloor * L + 0.1, z: sq.goal.cz } });
      for (let f = 0; f < 150; f++) b.update(1 / 60);
      const cx = men.reduce((s, u) => s + u.x, 0) / men.length, cz = men.reduce((s, u) => s + u.z, 0) / men.length;
      rea.view.target.set(cx, w.top(start) * L, cz);
      rea.view.distance = 7.5; rea.view.pitch = 1.18; rea.view.updateCamera();
    });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/column-march-r174.png` });

    check('无 console error', errors.length === 0, `${errors.length} 条 ${errors.slice(0, 2).join(' | ')}`);

    const summary = {
      ok, url, fix, gaps: { p50: r3(gP50), p90: r3(gP90), n: gaps.length }, vertCols: vertCols.length,
      straight: { n: straightK.length, mean: r3(mean(straightK)) },
      corner: { n: cornerK.length, mean: r3(mean(cornerK)), min: r3(Math.min(...cornerK)), frames: cornerFrames, straightFrames },
      soft: { n: softK.length, mean: r3(mean(softK)) }, hard: { n: hardK.length, mean: r3(mean(hardK)) },
      path: { n: trace.path.n, p50: r3(dP50), p90: r3(dP90), arcs: trace.path.arcs, corners: trace.path.corners },
      arrive: { cols, rows, maxErr: r3(Math.max(...errs)), n: last.men.length },
      recovery: { slides: trace.slides, crawls: trace.crawls, stuck: trace.stuck },
      stats: { waits: trace.stats.waits, slotted: trace.stats.slotted, cornerTurns: trace.stats.cornerTurns, cornerSlows: trace.stats.cornerSlows, minSpeedK: r3(trace.stats.minSpeedK) },
      shots: [`${OUT}/column-march-r174.png`, `${OUT}/column-arrive-r174.png`],
    };
    fs.writeFileSync(`${OUT}/column-march-r174.json`, JSON.stringify(summary, null, 1));
    console.log('\ncolumn-march PASS', ok, 'checks');
    console.log(JSON.stringify(summary, null, 1));
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
