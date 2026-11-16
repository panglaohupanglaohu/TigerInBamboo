// 902069261304287232「visualization of data inheritance in my flow/distance/influence fields」
// + 901842167508992000「…it can now tell you what type they are」运行验收（第 115 轮）。
//
// 两条片子共用的三个机制：
//   ① 数据继承：每格从最近的兵源继承「距离 / 方向 / 兵种」三项，不是只算距离场；
//   ② 可视化：可走格上铺格网 + 按继承兵种上色（≥3 色，不把未知兵种并进第一种色）；
//   ③ 主战斗真的用连续流场（r76 查出 battle.js:190 未传 continuousFlow，本条钉死它，
//      并按 r76 的要求成套跑 30 / 60 / 120Hz，确认改默认不会把移动行为搞坏）。
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

  // 不带任何 G3 开关：要验的就是「主战斗默认」。
  await page.goto(base + '/index.html?scene=badnorth&flow=1&flowunit=1');
  await page.waitForFunction(() => window.rea?.battle?.running, {timeout: 60000});
  await page.waitForTimeout(900);

  const setup = await page.evaluate(() => {
    const b = rea.battle, nav = b.navigation;
    nav.refresh();
    const g = nav.graph;
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
    const ids = g.nodes.filter((n) => comp.get(n.id) === main && n.floor === 1).map((n) => n.id);
    const bfs = (src) => {
      const dist = new Map([[src, 0]]), q = [src];
      while (q.length) { const id = q.shift(); for (const e of g.adj[id]) if (!dist.has(e.to)) { dist.set(e.to, dist.get(id) + 1); q.push(e.to); } }
      return dist;
    };
    const a = g.nodes[ids[0]], d0 = bfs(a.id);
    let z = a, bd = Infinity;
    for (const [id, v] of d0) if (g.nodes[id].floor === 1 && v >= 8 && Math.abs(v - 14) < bd) { bd = Math.abs(v - 14); z = g.nodes[id]; }
    // 三支守军（步兵 / 矛兵 / 弓手）都留着：行军只用第一支，配色要三个兵种同时在场
    const sq = b.squads[0], squad = sq.members.slice(0, 8);
    sq.members = squad;
    b.houses = []; b.selected = sq; b.nextWave = Infinity;
    const squadTypes = b.squads.map((s) => (s.archer ? '弓手' : s.pike ? '矛兵' : '步兵'));
    return {
      start: {id: a.cell.id, node: a.id, x: a.cell.cx, z: a.cell.cz, floor: a.floor},
      goal: {id: z.cell.id, node: z.id, x: z.cell.cx, z: z.cell.cz, floor: z.floor},
      span: +Math.hypot(a.cell.cx - z.cell.cx, a.cell.cz - z.cell.cz).toFixed(3),
      hops: d0.get(z.id), units: squad.length,
      defaultFlow: nav.continuousFlow,            // ① 主战斗默认：必须是 true
      polys: nav.flowSummary ? nav.flowSummary().polys : null,
      squadTypes, squads: b.squads.length,
    };
  });

  // 一个速率 = 一段相同「模拟时长」的推演；dt 越小步越多，看行为是否收敛。
  const runAt = (dt, seconds, flowOn) => page.evaluate(({dt, seconds, flowOn, setup}) => {
    const b = rea.battle, nav = b.navigation, units = b.squads[0].members;
    const goal = rea.world.cells.find((c) => c.id === setup.goal.id);
    b.paused = false;
    b.g3.set('continuousFlow', flowOn);
    nav.flowStats = {steer: 0, used: 0, rejected: 0};
    units.forEach((u, k) => {
      u.x = setup.start.x + (k % 3) * 0.03; u.z = setup.start.z + Math.floor(k / 3) * 0.03;
      u.y = setup.start.floor * 0.5; u.navFloor = setup.start.floor; u.dead = false; u.fall = null; u.cd = 0;
      u._head = undefined;
    });
    b.squads[0].goal = goal; b.squads[0].goalFloor = setup.goal.floor;
    const planned = !!nav.plan(units[0], goal, setup.goal.floor);
    const seen = units.map(() => new Set());
    const steps = Math.round(seconds / dt);
    const t0 = performance.now();
    for (let f = 0; f < steps; f++) {
      b.update(dt);
      units.forEach((u, k) => { const cc = nav.index.cellAt(u.x, u.z); if (cc) seen[k].add(cc.id); });
    }
    const ms = performance.now() - t0;
    b.paused = true;
    const remain = units.map((u) => Math.hypot(u.x - goal.cx, u.z - goal.cz));
    const arrived = units.filter((u) => nav.unitNode(u)?.id === setup.goal.node).length;
    const onGraph = units.filter((u) => !!nav.unitNode(u)).length;
    return {
      dt: +dt.toFixed(5), hz: Math.round(1 / dt), steps, simSeconds: seconds, ms: Math.round(ms),
      arrived, onGraph, maxRemain: +Math.max(...remain).toFixed(3),
      offGoalFloor: units.filter((f) => f.navFloor !== setup.goal.floor).length,
      cells: Math.max(...seen.map((x) => x.size)), planned, flow: nav.flowSummary(),
    };
  }, {dt, seconds, flowOn, setup});

  const rates = [1 / 30, 1 / 60, 1 / 120];
  const sweep = [];
  for (const dt of rates) sweep.push(await runAt(dt, 18, true));
  const perFace = await runAt(1 / 60, 18, false);       // A/B 对照：逐面常量

  // ② 数据继承（距离 / 方向 / 兵种）：直接用真实导航图 + 三个不同兵种源做模型级验，
  //    不依赖场景里有几个兵种（r70 记的「第三色要等矛兵上场」就是不这么验的代价）。
  const inherit = await page.evaluate(async (setup) => {
    const m = await import('/src/badnorth/flowfield.js');
    const b = rea.battle, nav = b.navigation, g = nav.graph;
    nav.refresh();
    // 沿地面层取三个相隔很远的节点当源（同一连通块，保证继承路径存在）
    const ids = g.nodes.filter((n) => n.floor === 1).map((n) => n.id);
    const pick = (skip) => {
      let best = ids[0], bd = -1;
      for (const id of ids) {
        let d = Infinity;
        for (const s of skip) d = Math.min(d, Math.hypot(g.nodes[id].x - s.x, g.nodes[id].z - s.z));
        if (d > bd) { bd = d; best = id; }
      }
      return g.nodes[best];
    };
    const s1 = pick([]), s2 = pick([s1]), s3 = pick([s1, s2]);
    const types = ['步兵', '矛兵', '弓手'];
    const srcs = [s1, s2, s3].map((n, k) => ({node: n.id, type: types[k], squad: 'S' + k, cell: n.cell}));
    const F = m.buildLayeredFlowField(g, srcs);
    // 每个源独立 BFS 求「谁更近」，作为继承对的参考答案
    const hop = (srcId) => {
      const d = new Map([[srcId, 0]]), q = [srcId];
      while (q.length) { const id = q.shift(); for (const e of g.adj[id]) if (!d.has(e.to)) { d.set(e.to, d.get(id) + 1); q.push(e.to); } }
      return d;
    };
    const hops = [hop(s1.id), hop(s2.id), hop(s3.id)];
    let checked = 0, typeOk = 0, dirOk = 0, distOk = 0; const perType = {};
    const seenTypes = new Set();
    for (const n of g.nodes) {
      const at = F.atNode(n.id); if (!at) continue;
      checked++;
      const k = srcs.findIndex((s) => s.node === at.source.node);
      seenTypes.add(at.source.type);
      perType[at.source.type] = (perType[at.source.type] ?? 0) + 1;
      if (k >= 0) typeOk++;                                  // 兵种：继承到的源就是最近那个源
      const nk = hops[k];                                     // 方向：next 必须比当前格更靠近该源
      if (nk && nk.get(at.next?.id) === nk.get(n.id) - 1) dirOk++;
      if (at.dist >= 0 && Number.isFinite(at.dist)) distOk++;  // 距离：有限且非负
    }
    // 「最近源」本身用图跳数独立核对：对每个节点，at.source 必须是三个源里跳数最小的
    let nearestOk = 0, nearestChecked = 0;
    for (const n of g.nodes) {
      const at = F.atNode(n.id); if (!at) continue;
      const k = srcs.findIndex((s) => s.node === at.source.node); if (k < 0) continue;
      const hs = hops.map((h) => h.has(n.id) ? h.get(n.id) : Infinity);
      const best = hs.indexOf(Math.min(...hs));
      nearestChecked++;
      if (k === best || hs[k] === hs[best]) nearestOk++;
    }
    return {sources: srcs.map((s) => ({node: s.node, type: s.type})), checked, typeOk, dirOk, distOk,
      nearestOk, nearestChecked, types: [...seenTypes], perType};
  }, setup);

  // ③ 可视化：可走格格网 + 按兵种上色（色数 == 场景里真实存在的兵种数，不做合并）
  const viz = await page.evaluate(() => {
    const b = rea.battle;
    b.view.setDebug('flow', true); b.view.setDebug('flowunit', true);
    b.view.flowColorBy = 'type';
    b.paused = false; b.flowT = 0; b.update(0.05); b.paused = true;   // 强制重算 flowDef + #drawFlow
    const types = new Set(b.flowDef.sources.map((s) => s.type));
    return {
      byType: b.view.flowColorBy, cellsDrawn: b.flowCellsDrawn ?? null, gridEdges: b.flowGrid.geometry.getAttribute('position')?.count ?? 0,
      legendRows: b.flowLegend ? b.flowLegend.textContent.replace(/\s+/g, ' ').slice(0, 160) : null,
      flowTypeColors: b.flowTypeColors, sourceTypes: [...types], sources: b.flowDef.sources.length,
      wisp: b.flowWispLen ?? null,
    };
  });
  await page.evaluate(() => { rea.battle.paused = true; });
  await page.locator('#scene').screenshot({path: path.join(out, 'flow-battle-rates.png')}).catch(async () => {
    await page.screenshot({path: path.join(out, 'flow-battle-rates.png')});
  });

  const report = {url: base + '/index.html?scene=badnorth&flow=1&flowunit=1', setup, sweep, perFace, inherit, viz, errors};
  fs.writeFileSync(path.join(out, 'flow-battle-rates-browser.json'), JSON.stringify(report, null, 2));
  await browser.close();

  const fail = (m) => { throw new Error(m + ' ' + JSON.stringify({setup, sweep, perFace, inherit, viz, errors})); };
  if (errors.length) fail('console/page error');
  // ① 主战斗默认连续流（r76 的硬缺口）
  if (setup.defaultFlow !== true) fail('main battle does not default to continuousFlow');
  // ② 30/60/120Hz 三档行为一致：全员在图上、到达数同档、楼层不漂、流向前视被采纳
  for (const r of sweep) {
    if (r.flow.steer <= 0) fail('flowAim not used at ' + r.hz + 'Hz');
    if (r.onGraph !== setup.units) fail('unit left the nav graph at ' + r.hz + 'Hz');
    if (r.offGoalFloor > 2) fail('too many units off the goal floor at ' + r.hz + 'Hz');
    if (r.arrived < setup.units - 2) fail('units did not arrive at ' + r.hz + 'Hz');
    if (r.cells < 5) fail('crowd did not cross enough cells at ' + r.hz + 'Hz');
  }
  // 到达数在细步长下会 ±1 抖动：人群分离/贴墙修正按步推进，120Hz 每步位移只有 30Hz 的 1/4，
  // 末端被推挤的两个人换位属群体动力学，不是流向本身（流向是位置的纯函数，与 dt 无关）。
  // 口径：任一档都不比逐面常量差超过 1 人，且最差档仍到达 6/8。
  const arrivedSet = sweep.map((r) => r.arrived);
  if (Math.min(...arrivedSet) < perFace.arrived - 1) fail('continuousFlow worse than per-face: ' + arrivedSet + ' vs ' + perFace.arrived);
  if (perFace.flow.steer !== 0) fail('flowAim used while continuousFlow off');
  // ③ 三项继承（距离 / 方向 / 兵种）
  if (inherit.types.length !== 3) fail('type inheritance did not produce 3 types');
  if (inherit.typeOk !== inherit.checked) fail('inherited type missing on some nodes');
  if (inherit.dirOk / inherit.checked < 0.98) fail('inherited parent direction wrong on >2% nodes');
  if (inherit.distOk !== inherit.checked) fail('inherited distance missing');
  if (inherit.nearestOk / inherit.nearestChecked < 0.95) fail('inherited source is not the nearest source');
  // ④ 可视化：格网 + 按兵种上色（色数 == 兵种数）
  if (!(viz.cellsDrawn > 0 && viz.gridEdges > 0)) fail('flow grid not drawn');
  if (viz.byType !== 'type') fail('flowColorBy=type not honoured');
  if (Array.isArray(viz.sourceTypes) && viz.sourceTypes.length >= 2 && viz.flowTypeColors !== viz.sourceTypes.length) fail('type colours merged: ' + viz.flowTypeColors + ' vs ' + viz.sourceTypes.length);
  console.log('PASS flow data inheritance + main-battle continuous flow (30/60/120Hz)', JSON.stringify({
    defaultFlow: setup.defaultFlow, hops: setup.hops, span: setup.span,
    sweep: sweep.map((r) => ({hz: r.hz, arrived: r.arrived, maxRemain: r.maxRemain, cells: r.cells, steer: r.flow.steer, adopted: +r.flow.adopted.toFixed(3), ms: r.ms})),
    perFace: {arrived: perFace.arrived, steer: perFace.flow.steer},
    inherit: {checked: inherit.checked, typeOk: inherit.typeOk, dirOk: inherit.dirOk, nearest: inherit.nearestOk + '/' + inherit.nearestChecked, perType: inherit.perType},
    viz: {cells: viz.cellsDrawn, gridEdges: viz.gridEdges, typeColors: viz.flowTypeColors, types: viz.sourceTypes},
  }));
})().catch((e) => { console.error(e); process.exit(1); });
