// R72 合成场地穿洞 / 会车行走实证（补学 #0·#1·#3 验收件）。
// nav-arch-through-browser 实测：实景四场景只有死角拱（几何限制，非代码缺口）。
// 这里在浏览器运行时里走 vendor 副本导航 + nav-lab 合成考场，产出「真走过去」的坐标轨迹：
//   A) ARCH_ISLAND：兵从拱南侧斜着进拱，逐帧轨迹证明真穿过拱柱格、开精细门户后零擦墙；关档对照有擦墙帧。
//   B) COURSE：两队（普通兵 + 大个子）在带弯带岔的一格窄道里对向会车，全体到达 + 最小间距 + 逐帧轨迹。
// 运行：cd TigerMessenger && $NODE tests/nav-through-synthetic-browser.mjs   （需要 8931 服务）
import { launch, expect, pageErrors, BASE } from './nav-e2e-lib.mjs';
const { report, page, shot, finish } = await launch('nav-through-synthetic', { capabilities: ['battle.navFinePortals', 'battle.navTraffic'] });
try {
  // 演示页本身就是 A 的现场：开/关精细门户各走一遍 ARCH_ISLAND，页面读数与 __navDemo 已挂在 window 上
  await page.goto(BASE + 'nav-arch-demo.html?static=1');
  await page.waitForFunction(() => globalThis.__navDemo?.done === true, {}, { timeout: 60000 });
  const demo = await page.evaluate(() => {
    const d = globalThis.__navDemo;
    return { unitHeight: d.unitHeight, arch: d.arch, on: d.on, off: d.off, stat: document.getElementById('stat-all')?.textContent };
  });
  report.steps.demoPage = demo;
  await shot('nav-arch-demo');

  // 合成考场行走：轨迹级证据（起点/终点分在拱两侧，逐帧坐标，真穿过拱柱格）
  report.steps.synthetic = await page.evaluate(async () => {
    const lab = await import('/TigerMessenger/src/system-workshop/battle/nav-lab.js');
    const { asciiWorld, ARCH_ISLAND, COURSE, makeNav, simulateWalk, meetingRun, corridorStats, BODY_RADIUS } = lab;

    /* ---- A) 穿拱轨迹（与演示页同一个考场、同一套 vendor 走法） ---- */
    const env = asciiWorld(ARCH_ISLAND);
    const on = makeNav(env, { finePortals: true, unitHeight: .34 });
    const off = makeNav(env, { finePortals: false, unitHeight: .34 });
    const archNode = on.graph.nodes.find((n) => on.fine.under[n.id]?.kind === 'arch');
    const A = archNode.cell, from = env.at(A.i, A.j - 1), to = env.at(A.i, A.j + 2);   // 拱南侧一格 → 拱北侧两格
    const track = (nav) => {
      const u = { x: from.cx + .45, z: from.cz + .2, navFloor: 1, radius: BODY_RADIUS, goal: to, goalFloor: 1 };
      const pts = []; let enteredArch = false, clipFrames = 0;
      const sim = simulateWalk(env, nav, [u], { frames: 600, lanes: false, separation: false, onFrame: (v, f) => {
        const node = on.unitNode(v), clip = !node || !on.discFits(node, v.x, v.z, BODY_RADIUS);
        if (node && node.id === archNode.id) enteredArch = true;
        if (clip) clipFrames++;
        if (f % 4 === 0 || clip) pts.push({ f, x: +v.x.toFixed(3), z: +v.z.toFixed(3), floor: v.navFloor, clip });
      } });
      return { start: { x: pts[0]?.x, z: pts[0]?.z }, end: { x: +u.x.toFixed(3), z: +u.z.toFixed(3) },
        arrived: u.arrived, arrivedAt: u.arrivedAt, frames: sim.frames, enteredArch, clipFrames, pts };
    };
    const arch = { archCell: { i: A.i, j: A.j, id: A.id, u0: +on.fine.under[archNode.id].u0.toFixed(3) },
      from: { i: from.i, j: from.j }, to: { i: to.i, j: to.j }, on: track(on), off: track(off) };

    /* ---- B) 窄道对向会车（COURSE：四弯一岔一格宽） ---- */
    const envT = asciiWorld(COURSE), navT = makeNav(envT, { finePortals: true, unitHeight: .34 });
    const cs = corridorStats(envT);
    const m = meetingRun(envT, navT, envT.at(1, 2), envT.at(11, 2), { squad: 3, heavyRadius: .12, frames: 3000 });
    // 两队共用的窄道格：会车真的发生在窄道里
    const east = m.units.filter((u) => u.goal === envT.at(11, 2)), west = m.units.filter((u) => u.goal === envT.at(1, 2));
    const shared = [...east[0].cells].filter((id) => cs.narrow[id] && west.some((w) => w.cells.has(id)));
    // 两个单位相向的最小间距 + 轨迹（一个东行一个西行）
    const u1 = { x: envT.at(1, 2).cx, z: envT.at(1, 2).cz, navFloor: envT.world.top(envT.at(1, 2)), radius: BODY_RADIUS, goal: envT.at(11, 2), goalFloor: envT.world.top(envT.at(11, 2)) };
    const u2 = { x: envT.at(11, 2).cx, z: envT.at(11, 2).cz, navFloor: envT.world.top(envT.at(11, 2)), radius: BODY_RADIUS, goal: envT.at(1, 2), goalFloor: envT.world.top(envT.at(1, 2)) };
    let minDist = Infinity; const t1 = [], t2 = [];
    const sim2 = simulateWalk(envT, navT, [u1, u2], { frames: 3000, onFrame: (v, f) => {
      const d = Math.hypot(u1.x - u2.x, u1.z - u2.z); if (d < minDist) minDist = d;
      if (f % 8 === 0) { const r = { f, x: +v.x.toFixed(3), z: +v.z.toFixed(3) }; (v === u1 ? t1 : t2).push(r); }
    } });
    const meeting = { corridors: cs.corridors, curves: cs.curves, forks: cs.forks,
      squadRun: { total: m.total, arrived: m.arrived, heavyArrived: m.heavyArrived, frames: m.frames, stuckMax: m.stuckMax, maxPenetration: m.maxPenetration, sharedNarrowCells: shared.length },
      pair: { arrived1: u1.arrived, arrived2: u2.arrived, minDist: +minDist.toFixed(3), frames: sim2.frames,
        start1: t1[0], end1: { x: +u1.x.toFixed(3), z: +u1.z.toFixed(3) }, start2: t2[0], end2: { x: +u2.x.toFixed(3), z: +u2.z.toFixed(3) }, t1, t2 } };

    return { arch, meeting };
  });

  const { arch, meeting } = report.steps.synthetic;
  /* A 组断言：真走过去（轨迹经过拱柱格）、开档零擦墙、关档有擦墙帧 */
  expect(demo.on.arrived === true && demo.on.clips === 0, '演示页开档没走完或擦墙 ' + JSON.stringify(demo));
  expect(demo.off.arrived === true && demo.off.clips > 0, '演示页关档应擦墙 ' + JSON.stringify(demo.off));
  expect(arch.on.arrived && arch.on.enteredArch, '合成场地开档没穿拱 ' + JSON.stringify({ arrived: arch.on.arrived, enteredArch: arch.on.enteredArch }));
  expect(arch.on.clipFrames === 0, `开档穿拱擦墙 ${arch.on.clipFrames} 帧`);
  expect(arch.off.arrived && arch.off.clipFrames > 0, '关档应能走但擦墙（旧行为对照）');
  expect(arch.on.end.z > arch.on.start.z, '轨迹方向不对（应从拱南到拱北）');
  /* B 组断言：两队对向互不卡死 */
  expect(meeting.squadRun.arrived === meeting.squadRun.total && meeting.squadRun.total === 8, '会车没全到 ' + JSON.stringify(meeting.squadRun));
  expect(meeting.squadRun.heavyArrived === 2, '大个子没到 ' + JSON.stringify(meeting.squadRun));
  expect(meeting.squadRun.sharedNarrowCells >= 5, '会车没发生在窄道里 ' + meeting.squadRun.sharedNarrowCells);
  expect(meeting.pair.arrived1 && meeting.pair.arrived2, '两单位对向会车有卡死 ' + JSON.stringify(meeting.pair));
  expect(meeting.pair.minDist > 0.005, '两单位几乎完全重叠（没有互让）' + meeting.pair.minDist);
  expect(pageErrors(report).length === 0, 'page errors: ' + pageErrors(report).join(' | '));
  report.pass = true;
} catch (e) { report.pass = false; report.failure = e.message; }
await finish();
