// 第 56 批 C09-B：1795831296952041691 沿河导航 / 1769691526924292506 巨型河网 / 1708815475801505819 斜向崖脊 /
// 1447488323845509121 软坡+硬崖+侵蚀无洼 / 1671808851895627776 岩檐悬垂。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { World } = await import('../src/core/world.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { buildSphere, buildPlanet } = await import('../src/sphere/planet.js');
const { planetWorld } = await import('../src/sphere/planet-town.js');
const { collapseRiversFirst, riverCollapseStats } = await import('../src/terrain/river-collapse-c09.js');
const { buildNav } = await import('../src/world/navgraph.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { softCorners } = await import('../src/terrain/soft-tops.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { shapeTerrain } = await import('../src/terrain/shape.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { meshSlopeProfile } = await import('../src/core/terrace-profile.js');
const { rockTopology } = await import('../src/core/rock-topology.js');
const { localMinima } = await import('../src/core/depression-fill.js');
const { rockScene, capUndersideArea, overhangLevel } = await import('../src/terrain/rockforms-c09.js');
const out = {};
const L = 0.5;
const GRIDS = { quad: () => buildQuadGrid({ radius: 14, hexSize: 1 }), mixed: () => buildMixedGrid({ radius: 22, hexSize: 0.62 }) };

/* ---------- 1769691526924292506：河道 DFS 坍缩 → 其余 BFS 缓坡（星球 + 平面） ---------- */
const chord = (a, b) => Math.hypot(a.dir[0] - b.dir[0], a.dir[1] - b.dir[1], a.dir[2] - b.dir[2]);
function checkCollapse(w, res, tag, { minLongest }) {
  const st = riverCollapseStats(w, res);
  assert.equal(st.minima, 0, tag + ' 零局部洼地');
  assert.equal(st.undrained, 0, tag + ' 每个陆地格沿不升的边通到河/海');
  assert.equal(st.riverUphill, 0, tag + ' 河沿 flowTo 从不爬升');
  assert.equal(st.riverBroken, 0, tag + ' 每条河都流到海');
  assert.ok(st.confluences > 3, tag + ' 回溯长出支流 → 有汇流');
  assert.ok(st.longest >= minLongest, tag + ' 河“wiggle real far” longest=' + st.longest);
  assert.ok(Math.max(...st.tortuosity) > 1.6, tag + ' 曲流（弧长/弦长）');
  assert.ok(st.steepShare < 0.1 && st.steepEdges > 0, tag + ' 缓坡为主、偶有陡崖 steepShare=' + st.steepShare);
  // DFS 生长约束：河格只与自己的上下游相邻（河道单宽、彼此分开）
  for (const c of w.cells) if (w.river[c.id]) for (const o of c.edgeNeighbors) if (o >= 0 && w.river[o]) assert.ok(res.flowTo[c.id] === o || res.flowTo[o] === c.id, tag + ' 河道不并排');
  // BFS：非河陆地格高度 ≥ 父格（父链通到河/海）
  for (const c of w.cells) if (res.parent[c.id] >= 0) assert.ok(w.ground(c) >= Math.max(1, w.ground(w.cells[res.parent[c.id]])), tag + ' BFS 高度不低于父格');
  return st;
}
for (const seed of [3, 5]) {
  const planet = buildPlanet(buildSphere({ n: 2500, seed }), { L: 0.16 }), pw = planetWorld(planet);
  const res = collapseRiversFirst(pw, { seed, rivers: 16, run: 8 });
  out['planet' + seed] = checkCollapse(pw, res, 'planet' + seed, { minLongest: 25 });

  /* ---------- 1795831296952041691：同一星球上的沿河导航（复杂汇流 + 球面弦长） ---------- */
  const nav = buildNav(pw, { metric: chord, slopeStep: 1 });
  assert.equal(nav.flowSource, 'carve', '星球河网 flowTo 被 navgraph 读取');
  let down = 0, conf = 0;
  const kids = new Int32Array(pw.cells.length); for (const c of pw.cells) if (pw.river[c.id] && res.flowTo[c.id] >= 0) kids[res.flowTo[c.id]]++;
  for (const c of pw.cells) {
    const p = res.flowTo[c.id]; if (!pw.river[c.id] || p < 0) continue;
    const P = pw.cells[p];
    assert.ok(nav.riverDirection(c, P) > 0 && nav.riverDirection(P, c) < 0, '沿 flowTo = 顺流');
    const cd = nav.cost(c, P), cu = nav.cost(P, c);
    assert.ok(cd < cu && cu < chord(c, P), '顺流 < 逆流 < 步行');
    down++; if (kids[p] >= 2) conf++;
  }
  assert.ok(conf > 3, '汇流处的支流也按树方向判顺流');
  // 顺流整段比逆流整段快：主干源头 ↔ 河口
  const trunk = res.paths[0], src = pw.cells[trunk[trunk.length - 1]], mouth = pw.cells[trunk[0]];
  const tDown = buildNav(pw, { start: src, metric: chord, slopeStep: 1 }).tree.time[mouth.id];
  const tUp = buildNav(pw, { start: mouth, metric: chord, slopeStep: 1 }).tree.time[src.id];
  let walk = 0; for (let k = 1; k < trunk.length; k++) walk += chord(pw.cells[trunk[k]], pw.cells[trunk[k - 1]]);
  assert.ok(tDown < tUp && tUp < walk * 1.0001, `顺流 ${tDown.toFixed(3)} < 逆流 ${tUp.toFixed(3)} < 步行 ${walk.toFixed(3)}`);
  // 缓坡直走：slopeStep=1 时可达格远多于“每级都要楼梯”的默认
  // 缓坡直走：slopeStep=1 时不必绕到每对区域唯一的那架楼梯 → 平均到达时间更短，可达格不减少
  const reach = (nv) => { const t = [...nv.tree.time].filter(Number.isFinite); return [t.length, t.reduce((s, x) => s + x, 0) / t.length]; };
  const nav0 = buildNav(pw, { start: nav.start, metric: chord }), [r1, m1] = reach(nav), [r0, m0] = reach(nav0);
  assert.ok(r1 >= r0 && m1 < m0, `slopeStep 缓坡直走 mean ${m1.toFixed(3)} < ${m0.toFixed(3)}`);
  out['nav' + seed] = { riverEdges: down, confluenceEdges: conf, tDown: +tDown.toFixed(3), tUp: +tUp.toFixed(3), walk: +walk.toFixed(3), reachSlope: r1, reachStairs: r0, meanSlope: +m1.toFixed(3), meanStairs: +m0.toFixed(3) };
}
// 平面混合网格上同样成立
{
  const w = new World(decorateCells(GRIDS.mixed()));
  const land = Uint8Array.from(w.cells, (c) => (Math.hypot(c.cx, c.cz) < 11.5 ? 1 : 0));
  const target = Int32Array.from(w.cells, (c) => Math.round(8 * (1 - Math.hypot(c.cx, c.cz) / 12)));
  const res = collapseRiversFirst(w, { seed: 2, land, target, rivers: 10, run: 6 });
  out.flatMixed = checkCollapse(w, res, 'flat-mixed', { minLongest: 20 });
}
// 默认 buildNav 不变：显式传默认值与不传完全一致
{
  const w = new World(decorateCells(GRIDS.quad())); generateTerrain(w, { seed: 7 });
  const a = buildNav(w), b = buildNav(w, { metric: null, slopeStep: 0 });
  assert.deepEqual([...a.tree.time], [...b.tree.time]); assert.deepEqual([...a.region], [...b.region]);
}

/* ---------- 1447488323845509121：软坡 + 硬崖 + 侵蚀 + 无洼（最终画出的顶面上也无洼） ---------- */
for (const kind of ['mixed', 'quad']) for (const seed of [7, 11]) {
  const w = new World(decorateCells(GRIDS[kind]()));
  generateTerrain(w, { seed, softSlopes: true, riverRelax: true, lakes: true, basins: 1, erosion: { passes: 2 } });
  const H = w.cells.map((c) => (w.lakes?.level?.[c.id] ? Math.max(w.ground(c), w.lakes.level[c.id]) : w.ground(c)));
  assert.equal(localMinima(w.cells, H).length, 0, kind + seed + ' World 层（湖按水位）零局部极小');
  w.softTops = true; w.terrainCollide = true;
  const soft = softCorners(w, { L });
  assert.ok(soft.groups > 0, '软坡组存在');
  // 画出来的顶面：每格中心高度 = 角点（软坡角点或整层）的均值；陆地平凡格不能严格低于所有邻居
  const lakeIds = new Set((w.lakes?.lakes ?? []).flatMap((l) => l.cells));
  const centre = (c) => { const g = w.ground(c); if (!g) return 0; if (lakeIds.has(c.id)) return w.lakes.level[c.id] * L; return c.pts.reduce((s, p) => s + (soft.y(c.id, p.id) ?? g * L), 0) / c.n; };
  const Y = w.cells.map(centre);
  // 诊断（不作断言）：格心均值严格低于全部邻居的格数 —— 软角点取均值会让个别平台格心微凹，不代表积水
  let centrePits = 0;
  for (const c of w.cells) if (soft.plain[c.id] && c.edgeNeighbors.every((o) => o >= 0 && Y[o] > Y[c.id] + 1e-9)) centrePits++;
  // 断言：画出的顶面上水能流走 —— 每格的最低角点高度 m；从海/河/湖反向扩展，只往 m 不更低的邻格走；全部陆地都要被扩到
  const M = w.cells.map((c) => { const g = w.ground(c); if (!g) return 0; if (lakeIds.has(c.id)) return w.lakes.level[c.id] * L; return Math.min(...c.pts.map((p) => soft.y(c.id, p.id) ?? g * L)); });
  const ok = new Uint8Array(w.cells.length), q = [];
  for (const c of w.cells) if (!w.ground(c) || w.river[c.id] || lakeIds.has(c.id)) { ok[c.id] = 1; q.push(c.id); }
  for (let h = 0; h < q.length; h++) for (const o of w.cells[q[h]].edgeNeighbors) if (o >= 0 && !ok[o] && M[o] >= M[q[h]] - 1e-9) { ok[o] = 1; q.push(o); }
  const undrained = w.cells.filter((c) => w.ground(c) && !ok[c.id]).length;
  assert.equal(undrained, 0, kind + seed + ' 画出的软坡顶面：水沿最低角点都能流到海/河/湖');
  const m = new MeshWriter(); buildTerrain(m, w, { L, shape: shapeTerrain(w, {}) });
  const prof = meshSlopeProfile(w.terrainSurface);
  assert.ok(prof.top.soft > 0 && prof.wallArea > 0, '同一张网格里软坡与竖崖并存');
  out['soft-' + kind + seed] = { softGroups: soft.groups, undrained, centrePits, soft: +prof.top.soft.toFixed(1), steep: +prof.top.steep.toFixed(1), wall: +prof.wallArea.toFixed(1), lakes: w.lakes?.lakes.length ?? 0, eroded: w.drainage?.erosion?.lowered ?? 0 };
}

/* ---------- 1708815475801505819 斜脊 + 柱群；1671808851895627776 石桌岩盖 ---------- */
for (const kind of ['quad', 'mixed']) for (const scene of ['ridge', 'dolmen']) {
  const w = new World(decorateCells(GRIDS[kind]()));
  const rep = rockScene(w, { kind: scene, s: 1 });
  const topo = rockTopology(w);
  assert.equal(topo.unsupported, 0, '所有岩石都连到地面（岩盖由柱子撑着）');
  assert.ok(topo.undersides >= (scene === 'dolmen' ? 30 : 12), scene + ' 有悬空底面 ' + topo.undersides);
  assert.equal(rep.voidCells, w.cells.filter((c) => overhangLevel(w, c)).length);
  for (const id of rep.houses) { const c = w.cells[id]; assert.ok(w.isBuilt(c, w.top(c)) && w.isRock(c, w.ground(c)), '小屋坐在岩顶上'); }
  const guarded = capUndersideArea(w, shapeTerrain(w, {})), raw = capUndersideArea(w, shapeTerrain(w, { guardCells: false }));
  assert.ok(guarded.ratio > 0.9 && guarded.minRatio > 0.5, scene + kind + ' 厚岩盖形变后底面不收缩 ' + JSON.stringify(guarded));
  assert.ok(guarded.minRatio >= raw.minRatio - 1e-9, '面积保护只会改善最薄的格');
  w.softTops = true; w.terrainCollide = true;
  const m = new MeshWriter(); buildTerrain(m, w, { L, shape: shapeTerrain(w, {}) });
  const surf = w.terrainSurface;
  // 悬空岩盖的侧壁也进了碰撞面（悬空格的墙底高于地面）
  const hanging = new Set(w.cells.filter((c) => overhangLevel(w, c)).map((c) => c.id));
  const hangWalls = surf.walls.filter((q) => hanging.has(q.cell) && Math.min(...q.q.map((p) => p[1])) > L * 1.5).length;
  assert.ok(hangWalls > 0, '岩盖侧壁可碰');
  if (scene === 'ridge') {
    // 斜向：A→B 不沿网格轴；高度沿脊单调升；一层台阶被 softTops 连成斜面
    const ridgeCells = w.cells.filter((c) => !overhangLevel(w, c) && w.ground(c) >= 2 && w.ground(c) <= 9 && Math.abs((c.cx + 4.6) * 4.0 + (c.cz - 3.0) * 4.2) / Math.hypot(4.2, 4.0) < 1.0);
    const along = ridgeCells.map((c) => [((c.cx + 4.6) * 4.2 - (c.cz - 3.0) * 4.0) / Math.hypot(4.2, 4.0), w.ground(c)]).sort((a, b) => a[0] - b[0]);
    let drops = 0; for (let k = 1; k < along.length; k++) if (along[k][1] < along[k - 1][1] - 1) drops++;
    assert.ok(along.length > 20 && along.at(-1)[1] - along[0][1] >= 5 && drops <= 2, '岩脊沿对角线升高');
    const soft = softCorners(w, { L });
    const softOnRidge = ridgeCells.filter((c) => c.pts.some((p) => soft.has(c.id, p.id))).length;
    assert.ok(softOnRidge > ridgeCells.length * 0.3, '岩脊顶面是连续斜面（softTops）' + softOnRidge + '/' + ridgeCells.length);
    out['ridge-' + kind] = { ...rep.parts, voidCells: rep.voidCells, softOnRidge, ridgeCells: ridgeCells.length, capRatio: +guarded.ratio.toFixed(3), capMin: +guarded.minRatio.toFixed(3), rawMin: +raw.minRatio.toFixed(3), hangWalls };
  } else out['dolmen-' + kind] = { ...rep.parts, voidCells: rep.voidCells, undersides: topo.undersides, capRatio: +guarded.ratio.toFixed(3), capMin: +guarded.minRatio.toFixed(3), rawMin: +raw.minRatio.toFixed(3), hangWalls };
}
console.log(JSON.stringify(out));
console.log('PASS c09-terrain-b');
