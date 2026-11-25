// 781957658597269506（109帧黄色薄平台，仅学习）残差收口：薄平台标记/生成 + 攀爬可达性。
//   ① thinAt/thinTops/thinLedges：合成条带世界上薄面标记、连片、挂壁；
//   ② ledgeSites/placeThinLedge/placeLedges：真实网格上岩壁腰贴单层悬空檐、拒绝语义；
//   ③ climbRoute：单位从 1 层地面 → 薄檐（rise 2，thinPlatform）→ 4 层台地，逐点 3D 轨迹；下爬反向；通道被堵报失败；
//   ④ NavLayer（实际消费者）与 ladderChannels 同一份诊断；
//   ⑤ mushroom-c04 叠层薄台：底层 → 顶片的攀爬路线（多条 rise=2 通道里有 thin）；
//   ⑥ generateTerrain ledges 选项：种子里放檐 + thinLedges 挂上；
//   ⑦ capabilities registry（terrain.ledge）matchAll/runPlan 真消费者：匹配出檐位、执行后出现薄面。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { buildMushroomStack } = await import('../src/terrain/mushroom-c04.js');
const { thinAt, thinTops, thinLedges, ledgeSites, placeThinLedge, placeLedges } = await import('../src/terrain/thin-platform.js');
const { buildNav, findNavPath } = await import('../src/world/navgraph.js');
const { ladderChannel, ladderChannels, channelBetween, climbRoute } = await import('../src/world/climb-route.js');
const { NavLayer } = await import('../src/world/navlayer.js');
const { matchAll, runPlan } = await import('../src/capabilities/registry.js');
const L = .5;
const out = {};

/** 8×4 条带格世界（tests/ladder-contact.mjs 的 block() 同构）。 */
function stripWorld(nx, nz) {
  const id = (x, z) => (x < 0 || z < 0 || x >= nx || z >= nz ? -1 : z * nx + x);
  const cells = Array.from({ length: nx * nz }, (_, k) => {
    const x = k % nx, z = (k / nx) | 0;
    return { id: k, n: 4, cx: x, cz: z, pts: [{ x: x - .5, z: z - .5 }, { x: x + .5, z: z - .5 }, { x: x + .5, z: z + .5 }, { x: x - .5, z: z + .5 }], edgeNeighbors: [id(x, z - 1), id(x + 1, z), id(x, z + 1), id(x - 1, z)] };
  });
  return { world: new World({ cells }), cells, at: id };
}

/* ---------- ① 标记 ---------- */
{
  const { world: w, at } = stripWorld(4, 1);
  for (const c of w.cells) w.fill(c, 1, { rock: true });
  w.fill(w.cells[at(3, 0)], 4, { rock: true });                    // 东头一根 4 层岩壁
  assert.ok(!thinAt(w, at(3, 0), 4) && !thinAt(w, at(0, 0), 1), '实心柱顶不算薄');
  placeThinLedge(w, [at(2, 0)], 3);                                // 壁腰贴一层悬空檐
  assert.ok(thinAt(w, at(2, 0), 3) && !thinAt(w, at(2, 0), 1), '檐格第 3 层薄、第 1 层不薄');
  const tops = thinTops(w);
  assert.equal(tops.length, 1); assert.deepEqual([tops[0].cell.id, tops[0].level, tops[0].gap], [at(2, 0), 3, 1]);
  const ledges = thinLedges(w);
  assert.equal(ledges.length, 1); assert.deepEqual(ledges[0].cells, [at(2, 0)]); assert.deepEqual(ledges[0].walls, [at(3, 0)], '檐挂在 4 层壁上');
  out.mark = { thin: tops.length, ledges: ledges.length, walls: ledges[0].walls.length };
}

/* ---------- ② 生成候选 + 写入 + 拒绝 ---------- */
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 8 })], ['mixed', buildMixedGrid({ radius: 8, seed: 3 })]]) {
  decorateCells(grid);
  const w = new World(grid);
  for (const c of w.cells) { const r = Math.hypot(c.cx, c.cz); if (r < 6.2) w.fill(c, r < 3 ? 4 : 1, { rock: true }); }
  w.touch();
  const sites = ledgeSites(w);
  assert.ok(sites.length > 5, '4 层台地边沿该有檐位 ' + sites.length);
  for (const s of sites) { assert.ok(s.level - 1 >= 2 && s.rise === 2 && s.drop >= 1); assert.ok(!w.isSolid(w.cells[s.cells[0]], s.level) && !w.isSolid(w.cells[s.cells[0]], s.level - 1), '檐位本层与下一层必须空'); }
  const s0 = sites[0], r = placeThinLedge(w, s0.cells, s0.level);
  assert.deepEqual(r.placed, s0.cells);
  assert.equal(placeThinLedge(w, s0.cells, s0.level).skipped[0].reason, 'occupied');
  assert.equal(placeThinLedge(w, s0.cells, 2).skipped[0].reason, 'not-thin');     // 第 2 层底下是实的：放上就是柱子不是檐
  assert.throws(() => placeThinLedge(w, s0.cells, 1), /level/);
  const batch = placeLedges(w, { seed: 5, count: 2 });
  assert.ok(batch.candidates > 0 && batch.ledges.length >= 1, '批量放檐');
  const comp = thinLedges(w).filter((g) => g.cells.includes(s0.cells[0]));
  assert.equal(comp.length, 1); assert.ok(comp[0].walls.length >= 1);
  out['site-' + name] = { sites: sites.length, batch: batch.ledges.length };
}

/* ---------- ③ 攀爬轨迹（合成场地：1 层地面 → 薄檐 3 → 台地 4） ---------- */
{
  const { world: w, cells, at } = stripWorld(8, 4);
  for (const c of cells) w.fill(c, 1, { rock: true });
  for (const z of [0, 1, 2, 3]) for (const x of [6, 7]) w.fill(w.cells[at(x, z)], 4, { rock: true });   // 东侧 4 层台地
  placeThinLedge(w, [at(5, 1), at(5, 2)], 3);                                                        // 台地西壁两片悬空檐
  const nav = buildNav(w);
  for (const id of [at(5, 1), at(5, 2)]) assert.ok(nav.walk[id] && nav.hgt[id] === 3, '薄檐格进可走图、站立高 3 层');
  const start = w.cells[at(0, 1)], goal = w.cells[at(7, 1)];
  const route = climbRoute(w, nav, start, goal, { L });
  assert.ok(route.ok, '路线得通 ' + JSON.stringify(route));
  assert.ok(route.climbs.length === 2 && route.climbs[0].rise === 2 && route.climbs[0].thin && route.climbs[0].supportDepth === 1, `第一把梯子 rise 2 且搭在薄台上 ${JSON.stringify(route.climbs)}`);
  assert.ok(route.climbs[1].rise === 1 && !route.climbs[1].thin, '第二把梯子 rise 1 在实壁上');
  const ys = route.points.map((p) => p.y);
  assert.ok(Math.abs(ys[0] - 1 * L) < 1e-9 && Math.abs(ys.at(-1) - 4 * L) < 1e-9, '轨迹从 1 层到 4 层');
  const climbPts = route.points.filter((p) => p.mode === 'climb');
  assert.ok(climbPts.length >= 2 * 4, '每把梯至少 4 个攀爬采样');
  for (const p of route.points) assert.ok([p.x, p.y, p.z].every(Number.isFinite), '轨迹点全有限');
  // 轨迹真过薄檐：攀爬段最高点落在檐高、且檐格被走过
  assert.ok(route.points.some((p) => p.cell === at(5, 1) || p.cell === at(5, 2)), '轨迹经过薄檐格');
  // 下爬：台地 → 地面，落差为负、轨迹降到 1 层
  const back = climbRoute(w, nav, goal, start, { L });
  assert.ok(back.ok && back.climbs.some((c) => c.rise === -2), '下爬也走薄檐');
  assert.ok(Math.abs(back.points.at(-1).y - 1 * L) < 1e-9);
  // 失败恢复：把两片薄檐体素拿掉 → 地面到台地唯一的通道消失 → 报 no-route，不留假轨迹
  w.setSolid(cells[at(5, 1)], 3, false); w.setSolid(cells[at(5, 2)], 3, false);
  const nav2 = buildNav(w), gone = climbRoute(w, nav2, start, goal, { L });
  assert.equal(gone.ok, false); assert.equal(gone.reason, 'no-route');
  assert.equal(gone.points.length, 0, '失败不留半截轨迹');
  // 不可达：四面围 4 层的孤台进不去 → no-route
  const { world: w2, at: at2 } = stripWorld(3, 3);
  for (const c of w2.cells) w2.fill(c, 1, { rock: true });
  w2.fill(w2.cells[at2(1, 1)], 6, { rock: true });
  const nav3 = buildNav(w2), dead = climbRoute(w2, nav3, w2.cells[at2(0, 0)], w2.cells[at2(1, 1)], { L });
  assert.equal(dead.ok, false); assert.equal(dead.reason, 'no-route');
  out.climb = { points: route.points.length, climbs: route.climbs.map((c) => `${c.rise}${c.thin ? '*' : ''}`), removedReason: gone.reason };
}

/* ---------- ④ NavLayer 消费者共用通道 ---------- */
for (const [name, grid] of [['mixed', buildMixedGrid({ radius: 9, seed: 7 })], ['quad', buildQuadGrid({ radius: 9, seed: 7 })]]) {
  decorateCells(grid);
  const w = new World(grid); generateTerrain(w, { seed: 7 });
  const shape = shapeTerrain(w), at = (p, s) => shape.at(p, s), nav = buildNav(w);
  const layer = new NavLayer({ scene: new THREE.Scene(), levelHeight: L });
  layer.woodLadders = true; layer.refresh(w, shape);
  const chans = ladderChannels(w, nav, { at, L });
  assert.equal(layer.ladderDiagnostics.length, chans.filter((c) => c.profile).length, '诊断条数 = 通道条数');
  for (const d of layer.ladderDiagnostics) assert.ok(d.contact?.footOnTop && d.contact.columnClear && d.contact.lipOnTop, '每把梯接触全过');
  const anchored = chans.filter((c) => c.anchors);
  assert.ok(anchored.every((c) => c.usable), '有锚点的通道接触全过');
  out['layer-' + name] = { channels: chans.length, noAnchors: chans.length - anchored.length, thin: chans.filter((c) => c.contact?.thinPlatform).length };
}

/* ---------- ⑤ mushroom 叠层薄台：底 → 第 1 片（3 层）攀爬；更高片之间的连通如实记 ---------- */
for (const build of [buildQuadGrid, buildMixedGrid]) {
  const g = build({}); decorateCells(g);
  const w = new World(g);
  const b = buildMushroomStack(w);
  const marks = thinLedges(w);
  assert.ok(marks.length >= 4, `蘑菇片标记 ≥4 ${marks.length}`);
  const nav = buildNav(w);
  // caps[i] 记的是半径内全部格（含被更高片/柱覆盖的），挑顶面就是该片层的格做目标
  const cap0 = w.cells[b.caps[0].find((id) => nav.walk[id] && nav.hgt[id] === 3)];
  let route = null, from = null;
  for (const c of w.cells) {
    if (!nav.walk[c.id] || nav.hgt[c.id] !== 1) continue;
    const r = climbRoute(w, nav, c, cap0, { L });
    if (r.ok) { route = r; from = c; break; }
  }
  assert.ok(route, '底座存在能爬到第一片薄台的格');
  assert.ok(route.climbs.length === 1 && route.climbs[0].rise === 2 && route.climbs[0].thin, '一把 rise=2 的薄台梯');
  // 如实记录：片与片之间并非都连着（C04 叠层自身的连通上限）
  const toTop = climbRoute(w, nav, from, w.cells[b.caps[3][0]], { L });
  out['mushroom-' + (build === buildQuadGrid ? 'quad' : 'mixed')] = { marks: marks.length, climb: route.climbs.map((c) => `${c.rise}${c.thin ? '*' : ''}`), toTop: toTop.ok ? toTop.climbs.length : toTop.reason };
}

/* ---------- ⑥ generateTerrain ledges 选项 ---------- */
{
  const g = buildQuadGrid({ radius: 9 }); decorateCells(g);
  const w = new World(g);
  const r = generateTerrain(w, { seed: 7, ledges: 3 });
  assert.ok(r.ledges.ledges.length >= 1, '生成时放下檐 ' + JSON.stringify(r.ledges));
  assert.ok(w.thinLedges?.length >= 1, 'world.thinLedges 挂上');
  for (const lg of w.thinLedges) for (const id of lg.cells) assert.ok(thinAt(w, id, lg.level), '挂出的每格都是真薄面');
  const w2 = new World(g); generateTerrain(w2, { seed: 7 });
  assert.equal(w2.ledgeReport, null); assert.equal(w2.thinLedges, undefined);
  out.generate = { placed: r.ledges.ledges.length, components: w.thinLedges.length };
}

/* ---------- ⑦ capabilities 消费者 ---------- */
{
  const g = buildQuadGrid({ radius: 8 }); decorateCells(g);
  const w = new World(g);
  for (const c of w.cells) { const r = Math.hypot(c.cx, c.cz); if (r < 6.2) w.fill(c, r < 3 ? 4 : 1, { rock: true }); }
  w.touch();
  const m = matchAll(w, {}).find((x) => x.id === 'terrain.ledge');
  assert.ok(m && m.count > 0, 'terrain.ledge 匹配出檐位 ' + JSON.stringify(m));
  assert.equal(thinTops(w).length, 0);
  const rep = runPlan(w, [{ id: 'terrain.ledge', params: { count: 2 } }]);
  assert.equal(rep[0].status, 'applied');
  assert.ok(thinTops(w).length >= rep[0].applied.length, '执行后出现薄面');
  out.capability = { matched: m.count, applied: rep[0].applied.length, thin: thinTops(w).length };
}

console.log(JSON.stringify(out), 'PASS thin-platform-climb');
