// 906416813810049025（r214 残差收口；对照裁判库 REACode src/cavepath.js）：真实洞穴岛（generateBadNorth caves:?bncaves）——
// 裁判记录的三件事逐条锁：厚岩拱洞（穿山隧道）、多层可走面同格共存、多层战斗与船只。
//   · 穿山隧道在洞底层内部成链（相邻洞格 floor f 互通），两端各接一个洞外低地口；nav.plan 从洞口外侧格以 floor f
//     走进并穿过隧道内部格——单位真在洞里走，不是被单值高度场抬到板顶（world.top(洞格)-floor === 3，
//     即裁判 resample 里 naive 摆法错 3 层的同一现象在真实岛上复现）。
//   · 同一平面格两个可走面共存：洞底 floor f 节点 + 板顶节点；跨层不可近战（canMelee：Δy≥3 层超出门槛）。
//   · 真实 Battle：守军小队 squad.goal/goalFloor 下令到隧道远端格，队员真实走进洞格（floor f 层）；
//     维京长船在洞穴岛照常 planLanding 上岸卸人（state in→unload→crew 下船）。
//   · 裁判比例账：净空=洞格上挖 2 层（裁判 ZCROWN 1.80 = 2 层）、顶岩 ≥1 层（band 0.90 = 1 层）、
//     板顶高出洞底 ≥3 层（ZTOP 2.70 = 3 层）——对账一致；裁判拱跨 4 格对本仓 1 格宽体素洞记为口径差异（美术造型属卡点·B）。
import assert from 'node:assert/strict';
import { makeView, Battle, World } from './fixtures/g5-battle.mjs';
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { generateBadNorth } = await import('../src/badnorth/island.js');
const { BattleNavigation } = await import('../src/world/battle-navigation.js');
const L = .5;
const run = (b, n, dt = 1 / 30) => { for (let k = 0; k < n; k++) b.update(dt); };
const stats = {};
for (const kind of ['quad', 'mixed']) {
  const grid = (kind === 'mixed' ? buildMixedGrid : buildQuadGrid)({ radius: kind === 'mixed' ? 9 : 8, seed: 7 });
  decorateCells(grid);
  const world = new World(grid);
  generateBadNorth(world, 7, { caves: 3 });
  const index = buildCellIndex(grid);
  const nav = new BattleNavigation(world, index, { levelHeight: L }); nav.refresh();
  const through = world.bnCaves.filter((t) => t.through);
  assert.ok(through.length >= 1, `${kind} 至少一条穿山隧道`);
  const nodeId = (cell, floor) => nav.graph.at(world.cells[cell], floor);
  let deckChecks = 0, throughRoutes = 0;
  for (const tn of through) {
    const tset = new Set(tn.cells), f = tn.floor;
    // 裁判比例账：洞底实、上挖 2 层净空、顶岩 ≥1 层、板顶高出洞底 ≥3 层（=裁判 2/1/3 层）
    for (const id of tn.cells) {
      const c = world.cells[id];
      assert.ok(world.isSolid(c, f) && !world.isSolid(c, f + 1) && !world.isSolid(c, f + 2) && world.isSolid(c, f + 3), `洞格 ${id} 净空 2 层 + 顶岩`);
      assert.ok(world.top(c) - f >= 3, `板顶高出洞底 ≥3 层（实测 ${world.top(c) - f}）`);
    }
    // 洞底层内部成链：相邻洞格在 floor f 互通
    for (let k = 0; k + 1 < tn.cells.length; k++) {
      const a = nodeId(tn.cells[k], f), b = nodeId(tn.cells[k + 1], f);
      assert.ok(a >= 0 && b >= 0, '洞内相邻格各有洞底节点');
      assert.ok(nav.graph.adj[a].some((e) => e.to === b) && nav.graph.adj[b].some((e) => e.to === a), `洞格 ${tn.cells[k]}↔${tn.cells[k + 1]} 在 ${f} 层互通`);
    }
    // 两端洞口各接一块洞外低地（floor f），穿山路名副其实
    const mouths = [tn.cells[0], tn.cells[tn.cells.length - 1]].map((e) =>
      world.cells[e].edgeNeighbors.filter((o) => o >= 0 && !tset.has(o) && world.top(world.cells[o]) === f).map((o) => world.cells[o]));
    assert.ok(mouths[0].length && mouths[1].length, '两端洞口各接洞外低地');
    // 同格双层：洞底节点与板顶节点共存；跨层不可近战
    const c0 = world.cells[tn.cells[0]], deck = world.top(c0);
    assert.ok(nodeId(c0.id, f) >= 0 && nodeId(c0.id, deck) >= 0 && deck > f, `格 ${c0.id} 洞底 ${f} 层 + 板顶 ${deck} 层双节点`);
    const inCave = { x: c0.cx, y: f * L, z: c0.cz }, onDeck = { x: c0.cx, y: deck * L, z: c0.cz };
    assert.equal(nav.canMelee(inCave, onDeck), false, '同格跨 3 层不可近战'); deckChecks++;
    // nav.plan 以洞底层走进并穿过隧道内部格（不是绕到板顶）
    const u = { x: mouths[0][0].cx, z: mouths[0][0].cz, y: f * L, navFloor: f }, goal = world.cells[tn.cells[tn.cells.length - 1]];
    const route = [[mouths[0][0].id, f]]; let arrived = false;
    for (let k = 0; k < 80 && !arrived; k++) {
      const p = nav.plan(u, goal, f); assert.ok(p, '洞底路线可规划');
      if (p.arrived) { arrived = true; break; }
      u.x = p.next.cell.cx; u.z = p.next.cell.cz; u.y = p.next.floor * L; u.navFloor = p.next.floor; route.push([p.next.cell.id, p.next.floor]);
    }
    assert.ok(arrived, '洞底穿隧到达');
    assert.ok(route.every(([, fl]) => fl === f), '穿隧路线全程洞底层');
    assert.ok(route.some(([id]) => tset.has(id)), '路线真进洞格');
    throughRoutes++;
  }
  // 真实 Battle 多层下令：守军小队 goal=隧道远端格、goalFloor=洞底，队员真实进洞（floor f 层）
  const view = makeView(world, index), b = new Battle(view); b.start(world); b.nextWave = 1e9;   // 先别开波次，单独验穿洞
  const tn = through[0], tset = new Set(tn.cells), f = tn.floor;
  const end = world.cells[tn.cells[tn.cells.length - 1]];
  const sq = b.squads.find((s) => s.members.some((u) => !u.dead));
  assert.ok(sq, '有守军小队');
  const lead = sq.members.find((u) => !u.dead);
  const mouth = world.cells[tn.cells[0]].edgeNeighbors.filter((o) => o >= 0 && !tset.has(o) && world.top(world.cells[o]) === f).map((o) => world.cells[o])[0];
  lead.x = mouth.cx; lead.z = mouth.cz; lead.y = f * L; lead.navFloor = f;
  sq.goal = end; sq.goalFloor = f;
  let inCave = 0, atGoal = false;
  for (let k = 0; k < 1200 && !atGoal; k++) {
    b.update(1 / 30);
    for (const u of sq.members) if (!u.dead && !u.onBoat) { const c = index.cellAt(u.x, u.z); if (c && tset.has(c.id) && u.navFloor === f) inCave++; }
    const c = index.cellAt(lead.x, lead.z);
    if (c && c.id === end.id && lead.navFloor === f) atGoal = true;
  }
  assert.ok(inCave >= 1, `真实 Battle 守军走入洞格（floor ${f}，计数 ${inCave}）`);
  assert.ok(atGoal, '守军经洞底到达隧道远端格');
  assert.ok(b.units.every((u) => [u.x, u.y, u.z].every(Number.isFinite)), '多层战斗全程无 NaN');
  // 船只：洞穴岛照常上波次，长船 planLanding 靠岸、crew 卸人下船
  const b2 = new Battle(makeView(world, index)); b2.start(world); b2.nextWave = 0;
  let sawBoat = false, landed = 0;
  for (let k = 0; k < 1800 && !landed; k++) {
    b2.update(1 / 30);
    if (b2.boats.length) sawBoat = true;
    landed = b2.units.filter((u) => u.team === 1 && !u.dead && !u.onBoat && index.cellAt(u.x, u.z)).length;
  }
  assert.ok(sawBoat, '洞穴岛维京长船出场');
  assert.ok(landed >= 1, `长船靠岸卸人（登陆维京 ${landed}）`);
  stats[kind] = { tunnels: world.bnCaves.length, through: through.length, deckChecks, throughRoutes, landed };
}
console.log('PASS 洞穴岛穿山隧道·多层战斗·船只（真实岛验收）', JSON.stringify(stats));
