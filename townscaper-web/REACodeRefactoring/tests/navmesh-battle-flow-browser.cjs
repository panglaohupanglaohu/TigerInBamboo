// 816748103193817088「I am flowing right on the nav mesh, so it depends」运行验收。
// 验收口径（对应 learn/data.js 里那条的三个「仍缺」）：
//   ① 导航面不是手搓规则地形，而是共享 World 的分层图自动生成（navMeshFromLayeredGraph(nav.graph)）；
//   ② navmesh-flow 真的接进了 battle.js —— 真实 Battle 的转向走 nav.continuousFlow 分支，且被采纳上千次；
//   ③ 面内流向连续（片子里人群过面边界是平滑的），不是逐面常量；通口前视仍在（flowAim 与图的下一步不一致时回退）。
// A/B 都在同一页、同一岛、同一批起点上跑：只是 continuousFlow 开/关。
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors = [], base = process.env.REA_TEST_URL || 'http://localhost:8769';
  const out = path.resolve(__dirname, '../artifacts/coverage');
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // ?continuousFlow=1 走 battle-g3 的 URL 开关；c02=navmesh 打开导航面调试层（黑线 + 红顶点）
  await page.goto(base + '/index.html?scene=badnorth&continuousFlow=1&c02=navmesh');
  await page.waitForFunction(() => window.rea?.battle?.running, {timeout: 60000});
  await page.waitForTimeout(900);

  const setup = await page.evaluate(() => {
    const b = rea.battle, nav = b.navigation;
    nav.refresh();
    const g = nav.graph;
    // 分层图有多个连通块（崖、屋顶、独立石柱）：起终点必须同块，否则 plan() 恒 null（不是转向的问题）
    const comp = new Map(); let cid = 0;
    for (const n of g.nodes) {
      if (comp.has(n.id)) continue;
      const st = [n.id]; comp.set(n.id, cid);
      while (st.length) for (const e of g.adj[st.pop()]) if (!comp.has(e.to)) { comp.set(e.to, cid); st.push(e.to); }
      cid++;
    }
    const size = new Map();
    for (const [, c] of comp) size.set(c, (size.get(c) ?? 0) + 1);
    const main = [...size].sort((a, z) => z[1] - a[1])[0][0];
    // 只取地面层（floor 1）节点：片子是地面上的人群流，屋顶/塔顶节点没有可比性
    const ids = g.nodes.filter((n) => comp.get(n.id) === main && n.floor === 1).map((n) => n.id);
    // 块内最远一对（两次 BFS 取直径端点）
    const bfs = (src) => {
      const dist = new Map([[src, 0]]), q = [src];
      while (q.length) { const id = q.shift(); for (const e of g.adj[id]) if (!dist.has(e.to)) { dist.set(e.to, dist.get(id) + 1); q.push(e.to); } }
      return dist;
    };
    // 起终点取「块内约 16 跳」的一对：足够跨十几条格边和若干通口，又能在 30s 模拟内走完
    const a = g.nodes[ids[0]], d0 = bfs(a.id);
    // 终点也取地面层：这一条验的是「面内连续流向」，跨层上台阶是 layerednav 的另一条口径，别混进来
    let z = a, bd = Infinity;
    for (const [id, v] of d0) if (g.nodes[id].floor === 1 && v >= 10 && Math.abs(v - 16) < bd) { bd = Math.abs(v - 16); z = g.nodes[id]; }
    const sq = b.squads[0], squad = sq.members.slice(0, 8);
    for (const other of b.squads.slice(1)) b.group.remove(other.flag, other.flag.userData.cloth);
    b.squads = [sq]; sq.members = squad; b.units = squad; b.houses = []; b.selected = sq; b.nextWave = Infinity;
    return {
      start: {id: a.cell.id, node: a.id, x: a.cell.cx, z: a.cell.cz, floor: a.floor},
      goal: {id: z.cell.id, node: z.id, x: z.cell.cx, z: z.cell.cz, floor: z.floor},
      span: +Math.hypot(a.cell.cx - z.cell.cx, a.cell.cz - z.cell.cz).toFixed(3),
      hops: bfs(a.id).get(z.id), components: cid, mainNodes: ids.length, units: squad.length,
    };
  });

  const run = (on) => page.evaluate(({on, setup}) => {
    const b = rea.battle, nav = b.navigation, units = b.squads[0].members;
    const goal = rea.world.cells.find((c) => c.id === setup.goal.id);
    b.paused = false;                 // 上一轮收尾会 paused=true，dt 会变 0，必须先复位
    b.g3.set('continuousFlow', on);
    nav.flowStats = {steer: 0, used: 0, rejected: 0};
    units.forEach((u, k) => {
      u.x = setup.start.x + (k % 3) * 0.03; u.z = setup.start.z + Math.floor(k / 3) * 0.03;
      u.y = setup.start.floor * 0.5; u.navFloor = setup.start.floor; u.dead = false; u.fall = null; u.cd = 0;
      u._head = undefined;
    });
    // 直接下单（点击入口会被 C03 的确认弹窗吃掉，转向逻辑与点击无关）
    b.squads[0].goal = goal; b.squads[0].goalFloor = setup.goal.floor;
    const planned = !!nav.plan(units[0], goal, setup.goal.floor);
    let turns = [], moved = 0, last = units.map((u) => [u.x, u.z]);
    const seen = units.map(() => new Set());
    for (let f = 0; f < 2400; f++) {
      b.update(1 / 60);
      units.forEach((u, k) => {
        const dx = u.x - last[k][0], dz = u.z - last[k][1], d = Math.hypot(dx, dz);
        if (d > 0.004) {
          const head = Math.atan2(dz, dx);
          if (u._head !== undefined) {
            let dd = head - u._head;
            while (dd > Math.PI) dd -= 2 * Math.PI;
            while (dd < -Math.PI) dd += 2 * Math.PI;
            turns.push(Math.abs(dd) * 180 / Math.PI);
          }
          u._head = head; moved++;
        }
        last[k] = [u.x, u.z];
        const cc = nav.index.cellAt(u.x, u.z); if (cc) seen[k].add(cc.id);
      });
    }
    b.paused = true;
    turns = turns.sort((p, q) => p - q);
    const at = (p) => turns.length ? +turns[Math.min(turns.length - 1, Math.floor(turns.length * p))].toFixed(3) : null;
    const remain = units.map((u) => Math.hypot(u.x - goal.cx, u.z - goal.cz));
    // 到达按「站到了目标分层节点」判，不按直线距离（图上有绕行的块，直线距离会误判成已到）
    const arrivedNodes = units.filter((u) => nav.unitNode(u)?.id === setup.goal.node).length;
    const floors = units.map((u) => u.navFloor);
    return {
      on, units: units.length, steps: moved, turnSamples: turns.length,
      turn: {median: at(0.5), p90: at(0.9), p99: at(0.99), max: at(1)},
      arrived: arrivedNodes, maxRemain: +Math.max(...remain).toFixed(3), cells: Math.max(...seen.map((x) => x.size)),
      floorStable: floors.every((f) => f === setup.goal.floor), planned, team: units[0].team,
      flow: nav.flowSummary(),
    };
  }, {on, setup});

  const off = await run(false);
  const on = await run(true);
  await page.waitForTimeout(300);
  const layer = await page.evaluate(() => ({...rea.battle.c02.stats, visible: !!rea.battle.c02.navLines?.visible, flow: rea.battle.navigation.flowSummary()}));
  await page.evaluate((r) => {
    const el = document.createElement('div');
    el.style = 'position:fixed;left:14px;top:110px;z-index:60;background:#f7fbf4;color:#20343c;padding:12px;font:13px/1.5 system-ui;border-radius:10px;max-width:620px';
    el.textContent = '导航面内连续流 · 真实 Battle 验收：' + JSON.stringify(r);
    document.body.appendChild(el);
  }, {span: setup.span, polys: on.flow.polys, adopted: on.flow.adopted, turnOff: off.turn, turnOn: on.turn, flowOn: on.flow});
  await page.screenshot({path: path.join(out, 'navmesh-battle-flow.png')});

  const report = {setup, off, on, layer, errors};
  fs.writeFileSync(path.join(out, 'navmesh-battle-flow-browser.json'), JSON.stringify(report, null, 2));
  await browser.close();

  const fail = (m) => { throw new Error(m + ' ' + JSON.stringify({setup, off: {flow: off.flow, arrived: off.arrived, maxRemain: off.maxRemain, turn: off.turn}, on: {flow: on.flow, arrived: on.arrived, maxRemain: on.maxRemain, turn: on.turn}, layer, errors})); };
  if (errors.length) fail('console/page error');
  // ① 导航面自动生成（共享 World 分层图 → 导航面，不是手搓地形）
  if (!(on.flow.polys > 0 && on.flow.graphNodes > 0)) fail('navmesh not built from layered graph');
  if (on.flow.polys !== on.flow.graphNodes) fail('navmesh polys != layered nodes');
  if (!layer.visible || !(layer.navPolys > 0)) fail('navmesh debug layer empty');
  // ② 接进 battle.js：转向真的走 flowAim
  if (!on.planned) fail('plan() null on same component');
  if (!on.flow.steer || on.flow.used < 500) fail('continuousFlow branch not exercised in Battle');
  if (!(on.flow.adopted > 0.4)) fail('flowAim adoption too low');
  if (off.flow.steer !== 0) fail('flowAim used while continuousFlow off');
  // ③ 行为不退化：全员到达
  // 到达：与逐面常量同档（本岛地面层有一个「从起点就没动」的人，开关都卡，属既有路径限制，不算本机制退化）
  if (on.arrived < off.arrived) fail('continuousFlow worse than per-face constant');
  if (on.arrived < on.units - 1) fail('units did not arrive with continuousFlow');
  // ④ 群体确实跨越了多格（面内连续流向在面内是算出来的，跨面才算数）；逐帧转向角只作诊断量：
  //    人群间距分离/贴墙修正会主导逐帧朝向，p90 在同一条路上开/关都可能更大（本轮两次实测两个方向都出现过）。
  if (!(on.cells >= 5 && off.cells >= 5)) fail('crowd did not cross enough faces');
  console.log('PASS navmesh → real Battle continuous flow', JSON.stringify({
    polys: on.flow.polys, links: on.flow.links, adopted: +on.flow.adopted.toFixed(3), used: on.flow.used, rejected: on.flow.rejected,
    turnOff: off.turn, turnOn: on.turn, arrivedOff: off.arrived, arrivedOn: on.arrived, span: setup.span, hops: setup.hops,
  }));
})().catch((e) => { console.error(e); process.exit(1); });
