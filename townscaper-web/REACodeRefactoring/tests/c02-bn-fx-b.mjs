// 第 56 批 C02 · Bad North 特效 B + 生命 / 导航 / 水（battle-c02.js + island-caves.js + damage-numbers kick）。
// 912691357440978945 不规则血泊 + 焦痕；903647529203634176 飘字甩出 / 击杀上浮；902069261304287232 底网；901842167508992000 格面 + 图例；
// 870296307889573889 翻滚 / 扬尘 / 爬起；901469409579061248 战斗船迹；816748103193817088 导航面；959530111187013632 雨；
// 820977247083528192 挥砍弧；821321422140309504 小队轮廓；886199305522085890 点线世界尺寸；906416813810049025 / 906425294533394432 / 797119718477991936 洞穴岛多层导航。
import assert from 'node:assert/strict';
import { makeIsland, makeView, Battle, THREE, World } from './fixtures/g5-battle.mjs';
const { splatAlpha, tumbleMatrix, C02_FLAGS } = await import('../src/badnorth/battle-c02.js');
const { kickDamageNumber, stepDamageKick, addDamageNumber, stepDamageNumbers } = await import('../src/badnorth/damage-numbers.js');
const { generateBadNorth } = await import('../src/badnorth/island.js');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { BattleNavigation } = await import('../src/world/battle-navigation.js');
const out = {};
const run = (b, n, dt = 1 / 30) => { for (let k = 0; k < n; k++) b.update(dt); };

// ── 默认全关：不改血材质、不画任何东西
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); run(b, 60);
  assert.ok(C02_FLAGS.every((k) => b.c02.on[k] === false), '默认全关');
  assert.equal(b.blood.material.map, null); assert.equal(b.c02.scorch.count, 0); assert.equal(b.c02.stats.foam, 0);
  assert.equal(b.c02.gridLines.visible || b.c02.faces.visible || b.c02.navLines.visible || b.c02.rainLines.visible || b.c02.fpLines.visible, false);
}

// ── 912691：血斑贴图不规则（边界半径方差 + 卫星滴），新血泊旁卫星斑错开渗开、往外挪
{
  const S = 64, a = splatAlpha(S, { seed: 3 }); const radii = [];
  for (let k = 0; k < 72; k++) { const t = k / 72 * Math.PI * 2; let r = 0; for (let s = 0; s < 1; s += 1 / 64) { const i = Math.round(S / 2 + Math.cos(t) * s * S / 2 - .5), j = Math.round(S / 2 + Math.sin(t) * s * S / 2 - .5); if (i < 0 || j < 0 || i >= S || j >= S) break; if (a[j * S + i] > 127) r = s; else if (r > 0 && s - r > .08) break; } radii.push(r); }
  const mean = radii.reduce((x, y) => x + y) / radii.length, sd = Math.sqrt(radii.reduce((x, y) => x + (y - mean) ** 2, 0) / radii.length);
  assert.ok(sd / mean > .08, `边界起伏（变异系数 ${(sd / mean).toFixed(3)}）`);
  let islands = 0; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const r = Math.hypot(i - S / 2, j - S / 2) / (S / 2); if (r > .78 && a[j * S + i] > 127) islands++; }
  assert.ok(islands > 10, '主斑外有卫星滴');
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('bloodShape', true);
  assert.equal(b.blood.material.map, b.c02.splatTex, '血斑换成不规则贴图');
  const u = b.units.find((x) => x.team === 0); const foe = { ...u, uid: 999, x: u.x - .2, team: 1 };
  b.applyHit(u, foe); b.update(1 / 30);
  assert.ok(b.c02.stats.satellites >= 2, '新血泊旁 2–3 片卫星斑');
  const st = b.c02.satellites[0], m = new THREE.Matrix4(), p = new THREE.Vector3();
  const off = () => { b.blood.getMatrixAt(st.i, m); p.setFromMatrixPosition(m); return Math.hypot(p.x - st.x, p.z - st.z); };
  const scl = () => { b.blood.getMatrixAt(st.i, m); return new THREE.Vector3().setFromMatrixColumn(m, 0).length(); };
  run(b, 8); const o1 = off(), s1 = scl(); run(b, 60); const o2 = off(), s2 = scl();
  assert.ok(o2 > o1 && s2 > s1, `卫星斑边长边外移（off ${o1.toFixed(3)}→${o2.toFixed(3)}，size ${s1.toFixed(3)}→${s2.toFixed(3)}）`);
  out.blood = { cv: +(sd / mean).toFixed(3), satellites: b.c02.stats.satellites };
  b.c02.set('bloodShape', false); assert.equal(b.blood.material.map, null, '关掉恢复圆斑');
}

// ── 912691：小屋失守 → 焦痕 + 余烬
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('scorch', true); b.nextWave = 1e9;
  b.houses[0].burn = 5; b.units.filter((u) => u.team === 0).forEach((u) => { u.dead = true; });
  b.houses[0].lost = true; run(b, 30);
  assert.ok(b.c02.scorch.count >= 2 && b.c02.stats.scorched === 1, '屋周焦痕');
  assert.ok(b.c02.stats.embers > 3, '余烬火星');
  const m = new THREE.Matrix4(); b.c02.scorch.getMatrixAt(0, m); const p = new THREE.Vector3().setFromMatrixPosition(m);
  assert.ok(Math.abs(p.y - world.ground(b.houses[0].cell) * b.L) < .02, '焦痕贴在屋基地面');
  out.scorch = { decals: b.c02.scorch.count, embers: b.c02.stats.embers };
}

// ── 903647：飘字沿受击方向甩出 + 阻尼抖动；击杀 +10 上浮更快
{
  const list = []; const d = addDamageNumber(list, { unitId: 1, x: 0, y: 0, z: 0, value: 4 }), k = addDamageNumber(list, { unitId: 1, x: 2, y: 0, z: 0, value: 10, kind: 'kill' });
  kickDamageNumber(d, 1, 0); let maxJ = 0;
  for (let i = 0; i < 20; i++) { stepDamageNumbers(list, 1 / 60); stepDamageKick(list, 1 / 60); maxJ = Math.max(maxJ, Math.abs(d.jx || 0)); }
  assert.ok(d.x > .05 && Math.abs(d.z) < 1e-9, `沿受击方向甩出 ${d.x.toFixed(3)}`);
  assert.ok(maxJ > .003, '阻尼抖动'); assert.ok(k.y - k.y0 > (d.y - d.y0) * 1.4, '击杀 +10 上浮更快');
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('dmgKick', true);
  const v = b.units.find((x) => x.team === 0), by = { ...v, uid: 998, x: v.x, z: v.z - .3, team: 1 };
  v.hp = 1; v.max = 3; const x0 = v.x, z0 = v.z; b.applyHit(v, by); run(b, 6);
  const dmg = b.damageNumbers.find((p) => p.kind === 'damage'), kill = b.damageNumbers.find((p) => p.kind === 'kill');
  assert.ok(dmg && kill, '伤害 + 击杀两条飘字');
  assert.ok(dmg.z - z0 > .05, `真实 Battle：数字被往 +z（远离攻击者）甩 ${(dmg.z - z0).toFixed(3)}`);
  assert.ok(kill.y - kill.y0 > (dmg.y - dmg.y0) * 1.3, '击杀上浮更快');
  out.kick = { dz: +(dmg.z - z0).toFixed(3), killLift: +(kill.y - kill.y0).toFixed(3), dmgLift: +(dmg.y - dmg.y0).toFixed(3) };
}

// ── 902069 / 901842：底网（四边形 + 对角线）+ 圆角格面 + 图例
for (const kind of ['quad', 'mixed']) {
  const { world, view } = makeIsland(kind, 7), b = new Battle(view); b.start(world); view.flowDebug = true;
  b.c02.set('flowGrid', true); b.c02.set('flowFaces', true); run(b, 12);
  const land = world.cells.filter((c) => world.top(c) > 0);
  const expect = land.reduce((s, c) => s + c.pts.length + (c.pts.length === 4 ? 1 : 0), 0);
  assert.equal(b.c02.stats.gridSegs, expect, '每个陆地格轮廓 + 四边形对角线');
  const covered = b.flowDef.nodes.filter((_, id) => b.flowDef.src[id] >= 0 && Number.isFinite(b.flowDef.dist[id])).length;
  assert.equal(b.c02.stats.faces, covered, '每个被源覆盖的可走节点一块格面');
  assert.ok(b.c02.stats.faces < b.flowDef.nodes.length + 1 && b.c02.stats.faces > 20);
  view.flowColorBy = 'type'; b.c02._flowSeen = null; b.flowT = 0; run(b, 2);
  assert.equal(b.c02.legendRows, 3, '兵种色卡三行');
  // 格面颜色 = #drawFlow 的兵种色（取第一块格面）
  const col = b.c02.faces.geometry.getAttribute('color'); const c0 = [col.getX(0), col.getY(0), col.getZ(0)];
  const ratio = (a) => a.map((x) => x / Math.max(...a));
  const cand = [[0.95, 0.35, 0.75], [0.72, 0.95, 0.2], [0.2, 0.85, 1.0]].map(ratio);
  assert.ok(cand.some((c) => c.every((x, i) => Math.abs(x - ratio(c0)[i]) < 1e-3)), '格面色属于兵种三色');
  view.flowDebug = false; run(b, 1); assert.ok(!b.c02.gridLines.visible && !b.c02.faces.visible, '关调试层即隐藏');
  out['flow_' + kind] = { gridSegs: b.c02.stats.gridSegs, faces: b.c02.stats.faces };
}

// ── 870296：翻滚矩阵 + 真实落崖 → 姿态倾斜、落地扬尘、存活者爬起
{
  const u = { x: 0, y: 1, z: 0, face: 0, fall: { vx: 1, vz: 0 } }, m = tumbleMatrix(u, Math.PI / 2), up = new THREE.Vector3(0, 1, 0).transformDirection(m);
  assert.ok(Math.abs(up.y) < 1e-6 && up.x > .99, '绕垂直于下落方向的水平轴翻 90° → 头朝下落方向');
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('tumble', true); b.nextWave = 1e9;
  // 找一个高台崖边：格 top ≥ 4 且有一个邻格 top ≤ top-2
  let edge = null;
  for (const c of world.cells) { const t = world.top(c); if (t < 4) continue; for (const id of c.edgeNeighbors) { if (id < 0) continue; const o = world.cells[id]; if (world.top(o) > 0 && world.top(o) <= t - 2) { edge = [c, o]; break; } } if (edge) break; }
  assert.ok(edge, '岛上有崖');
  const [hi, lo] = edge, dx = lo.cx - hi.cx, dz = lo.cz - hi.cz, l = Math.hypot(dx, dz);
  const v = b.units.find((x) => x.team === 0); v.x = hi.cx + dx * .35; v.z = hi.cz + dz * .35; v.y = world.top(hi) * b.L; v.navFloor = world.top(hi); v.hp = 99; v.max = 99;
  v.fall = { vx: dx / l * 1.2, vz: dz / l * 1.2, vy: .25, from: world.top(hi) };
  let maxTilt = 0;
  for (let k = 0; k < 120 && (v.fall || b.c02.stats.dust + b.c02.stats.splashes === 0); k++) {
    b.update(1 / 30);
    if (v.fall) { const i = b.units.filter((x) => !(x.dead && view.goreOff)).indexOf(v), mm = new THREE.Matrix4(); b.mBody.getMatrixAt(i, mm); const ax = new THREE.Vector3(0, 1, 0).transformDirection(mm); maxTilt = Math.max(maxTilt, Math.acos(Math.min(1, ax.y)) * 180 / Math.PI); }
  }
  assert.ok(maxTilt > 30, `下落中身体翻滚（最大倾角 ${maxTilt.toFixed(1)}°）`);
  assert.ok(b.c02.stats.dust + b.c02.stats.splashes >= 1, '落地扬尘 / 水花');
  assert.ok(b.c02.dust.count > 0, '尘团实例在画');
  out.tumble = { maxTilt: +maxTilt.toFixed(1), maxTumbleDeg: +b.c02.stats.maxTumbleDeg.toFixed(0), dust: b.c02.stats.dust, splashes: b.c02.stats.splashes, dead: v.dead };
  if (!v.dead) { assert.ok(v._getUp > 0 || b.c02.stats.gettingUp > 0, '存活者从躺倒爬起'); run(b, 30); assert.equal(v._getUp, 0, '0.7 s 内爬起'); }
}

// ── 901469：战斗长船 Kelvin 泡沫 + 喷溅；靠岸后停发
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('wakes', true); b.nextWave = 0;
  run(b, 90);
  const boat = b.boats[0]; assert.ok(boat && boat.state === 'in', '长船在进港');
  assert.ok(b.c02.stats.foam > 40 && b.c02.stats.spray > 0, `泡沫 ${b.c02.stats.foam} / 喷溅 ${b.c02.stats.spray}`);
  assert.equal(boat.mesh.userData.wake.visible, false, '旧白点尾迹让位');
  // 泡沫在船后方、两侧张开
  const h = [Math.cos(boat.mesh.rotation.y), -Math.sin(boat.mesh.rotation.y)];
  const behind = b.c02.wake.foam.filter((p) => !p.veil && ((p.x - boat.mesh.position.x) * (boat.stop[0] - boat.from[0]) + (p.z - boat.mesh.position.z) * (boat.stop[1] - boat.from[1])) < 0).length;
  const share = behind / b.c02.wake.foam.filter((p) => !p.veil).length; assert.ok(share > .8, '舷侧泡沫留在船后');
  run(b, 300); const unloading = b.boats.find((x) => x.state === 'unload');
  const emitted0 = b.c02.wake.emitted; run(b, 30);
  if (unloading && b.boats.every((x) => x.state === 'unload')) assert.equal(b.c02.wake.emitted, emitted0, '靠岸停住后不再发泡沫');
  out.wakes = { foam: b.c02.stats.foam, spray: b.c02.stats.spray, behindShare: +share.toFixed(2) };
}

// ── 816748：共享 World 分层图自动生成导航面，黑线 + 红顶点
{
  const { world, view } = makeIsland('mixed', 7), b = new Battle(view); b.start(world); b.c02.set('navmesh', true); run(b, 3);
  const mesh = b.navigation.flowMesh; assert.ok(mesh && mesh.polys.length === b.navigation.graph.nodes.length, '一节点一面');
  assert.ok(b.c02.stats.navEdges > mesh.polys.length && b.c02.stats.navVerts === mesh.verts.length);
  assert.ok(b.c02.navLines.visible && b.c02.navDots.visible);
  out.navmesh = { polys: mesh.polys.length, edges: b.c02.stats.navEdges, verts: b.c02.stats.navVerts };
}

// ── 959530：雨丝落到地面后回收、溅点、雨云
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('rain', true); run(b, 60);
  assert.equal(b.c02.stats.rainDrops, 1600); assert.equal(b.c02.stats.clouds, 4); assert.ok(b.c02.stats.splats > 0, '雨点落地溅起');
  const P = b.c02.rainLines.geometry.attributes.position.array; let slant = 0;
  for (let i = 0; i < 1600; i++) { assert.ok(P[i * 6 + 1] >= -0.01, '雨丝不穿到水下'); slant += (P[i * 6 + 3] - P[i * 6]); }
  assert.ok(slant < 0, '斜雨（风向 +x，丝尾在上风侧）');
  out.rain = { drops: 1600, splats: b.c02.stats.splats, clouds: 4 };
}

// ── 820977：挥砍弧（G3 扫掠 + 直砍补短弧）
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('swingArc', true);
  const u = b.squads[0].members[0], v = b.units.find((x) => x.squad === b.squads[1]);
  b.applyHit(v, u); b.update(1 / 60);
  assert.ok(b.c02.stats.arcsNow >= 1 && b.c02.arcMesh.visible, '直砍出一条弧');
  run(b, 20, 1 / 60); assert.equal(b.c02.transientArcs.length, 0, '0.22 s 后弧消失');
  b.g3.set('meleeFx', true); u.sweep = (await import('../src/core/melee-sweep.js')).beginSweep(u, 0, { reach: .3 }); u.sweep.angle = u.sweep.a0 + 1;
  b.paused = true; b.update(0); assert.ok(b.c02.stats.arcsNow >= 1, '扫掠中按 a0→当前角铺扇带');
  out.swing = { arcs: b.c02.stats.arcs };
}

// ── 821321：小队地面轮廓（三队各一圈，包住所有成员）
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.c02.set('footprint', true); run(b, 10);
  assert.equal(b.c02.stats.footprints, 3);
  const pos = b.c02.fpLines.geometry.attributes.position; assert.ok(pos.count > 3 * 2 * 4);
  out.footprint = { squads: 3, segs: pos.count / 2 };
}

// ── 886199：点线世界尺寸，关掉恢复
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world);
  const m = b.passageDots.material, s0 = m.size, a0 = m.sizeAttenuation;
  b.c02.set('passageWorld', true); b.update(1 / 30); assert.ok(m.sizeAttenuation && m.size >= .14, '世界尺寸点径');
  assert.ok(b.c02.stats.passagePx >= 4);
  b.c02.set('passageWorld', false); assert.equal(m.size, s0); assert.equal(m.sizeAttenuation, a0);
}

// ── 906416 / 906425 / 797119：洞穴岛 → 同一格两层可走面（洞底 + 洞顶），Battle 能从洞底穿过去
for (const kind of ['quad', 'mixed']) {
  const grid = (kind === 'mixed' ? buildMixedGrid : buildQuadGrid)({ radius: kind === 'mixed' ? 9 : 8, seed: 7 }); decorateCells(grid);
  const world = new World(grid); generateBadNorth(world, 7, { caves: 3 }); const index = buildCellIndex(grid);
  const plain = new World(grid); generateBadNorth(plain, 7);
  assert.ok(world.bnCaves.length >= 1, '挖出洞');
  for (const t of world.bnCaves) for (const id of t.cells) { const c = world.cells[id], f = t.floor; assert.ok(world.isSolid(c, f) && !world.isSolid(c, f + 1) && !world.isSolid(c, f + 2) && world.isSolid(c, f + 3), '洞底 f 层 + 净空 2 层 + 洞顶'); }
  for (const t of world.bnCaves) assert.ok(world.cells[t.cells[0]].edgeNeighbors.some((o) => o >= 0 && world.top(world.cells[o]) === t.floor), '洞口与洞外低地平接');
  assert.equal(plain.bnCaves, null, '默认不挖');
  const nav = new BattleNavigation(world, index, { levelHeight: .5 }); nav.refresh();
  const byCell = new Map(); for (const n of nav.graph.nodes) byCell.set(n.cell.id, (byCell.get(n.cell.id) || 0) + 1);
  const caveCells = world.bnCaves.flatMap((t) => t.cells), stacked = caveCells.filter((id) => (byCell.get(id) || 0) >= 2).length;
  assert.ok(stacked >= 1, `洞格上下两层节点（${stacked}/${caveCells.length}）`);
  // 洞底节点与洞外低地连通（能走进洞）
  const floorOf = new Map(world.bnCaves.flatMap((t) => t.cells.map((id) => [id, t.floor]))), bottom = nav.graph.nodes.filter((n) => caveCells.includes(n.cell.id) && n.floor === floorOf.get(n.cell.id));
  assert.ok(bottom.some((n) => nav.graph.adj[n.id].some((e) => !caveCells.includes(nav.graph.nodes[e.to].cell.id))), '洞底连到洞外');
  const view = makeView(world, index), b = new Battle(view); b.start(world); b.nextWave = 0; run(b, 900);
  assert.ok(b.units.every((u) => [u.x, u.y, u.z].every(Number.isFinite)), '洞穴岛战斗无 NaN');
  out['caves_' + kind] = { tunnels: world.bnCaves.length, through: world.bnCaves.filter((t) => t.through).length, caveCells: caveCells.length, stacked, nodes: nav.graph.nodes.length };
}

console.log('PASS c02 bn-fx-b', JSON.stringify(out));
