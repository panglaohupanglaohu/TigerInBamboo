// 第 55 批 G3 · Battle 扩展（battle-g3.js）：squadbanner / combatfx / terraceladder / blobshadow / uikit 的 Battle 接线。
// 827216768783495168 竖旗横杆 + 盾面徽记；1022573208590057472 近战手感（扫掠 / 盾推 / 遮挡）；781957658597269506 / 1669315384619540487 梯子；
// 820977247083528192 / 821321422140309504 / 821680056514781186 软影贴地；1242824460325052417 / 1016680972610359298 / 1024679338292256769 / 1201179450668441600 俏皮 UI。
import assert from 'node:assert/strict';
import { makeIsland, stripWorld, makeView, Battle, THREE } from './fixtures/g5-battle.mjs';
const { bakeStandardImage, bakeShieldImage, buildStandardMesh, orientStandard, STANDARD, ARMY_HUE } = await import('../src/badnorth/squad-standard.js');
const { beginSweep, stepSweep, shieldBlock, angleInSweep } = await import('../src/core/melee-sweep.js');
const { BattleNavigation } = await import('../src/world/battle-navigation.js');
const { squadRolePalette } = await import('../src/core/banner.js');
const out = {};

// ── squadbanner：旗面徽记 = 图集格逐像素；金边；三队同一族色；竖旗结构
const imgs = [0, 1, 2].map((k) => bakeStandardImage(k));
for (const im of imgs) { assert.equal(im.ink, im.atlasInk, `${im.emblem}：旗面墨量 = 图集格墨量`); assert.ok(im.gold > 40 && im.ink > 30); }
assert.deepEqual(imgs[0].field, imgs[1].field); assert.deepEqual(imgs[1].field, imgs[2].field);
assert.deepEqual(new Set(imgs.map((i) => i.emblem)), new Set(['skull', 'sword', 'trident']));
const shields = [0, 1, 2].map((k) => bakeShieldImage(k));
for (const s of shields) { assert.ok(s.rimShare > .2 && s.rimShare < .5, '金饰外圈 + 内金线'); assert.ok(s.ink > 20); assert.deepEqual(s.shield, squadRolePalette(ARMY_HUE).shield); }
const g = buildStandardMesh(1), { pivot, cloth } = g.userData;
const box = new THREE.Box3().setFromObject(cloth); g.updateMatrixWorld(true); box.setFromObject(cloth);
assert.ok(box.max.y <= STANDARD.barY + 1e-6 && box.min.y < STANDARD.barY - STANDARD.bannerH * .9, '旗面挂在横杆下（竖旗）');
assert.ok(g.children.some((c) => c.geometry?.type === 'SphereGeometry' && c.position.y > STANDARD.barY + .03), '杆顶金属球高于横杆');
const cam = new THREE.PerspectiveCamera(); cam.position.set(5, 3, 0);
const bb = orientStandard(g, cam, { baseYaw: 0 }); assert.ok(bb.clamped && Math.abs(bb.yaw) === 40 && Math.abs(bb.widthRatio - Math.cos(40 * Math.PI / 180)) < 1e-12, '公告板偏航夹 ±40°');
out.banner = { ink: imgs.map((i) => i.ink), gold: imgs.map((i) => i.gold), rimShare: +shields[0].rimShare.toFixed(3) };

// ── combatfx：扫掠连续判定一扫多人 + 墙挡刃 + 盾格挡推开
{
  const u = { x: 0, z: 0, y: .5, uid: 1 }, foes = [-.9, 0, .9].map((a, i) => ({ x: Math.sin(a) * .25, z: Math.cos(a) * .25, y: .5, team: 1, uid: 10 + i })), behind = { x: 0, z: -.25, y: .5, team: 1, uid: 20 };
  const sw = beginSweep(u, 0, { reach: .3, arc: Math.PI * .8, duration: .24 }); let hits = [];
  for (let k = 0; k < 4; k++) hits.push(...stepSweep(sw, [...foes, behind], 1 / 15));   // 15 fps：每帧转 ~36°，靠扇形连续判定不漏
  assert.equal(hits.length, 3, '一次挥砍扫到前方弧上 3 人，各一次'); assert.ok(!hits.includes(behind), '背后的人不在扫掠弧里');
  assert.ok(angleInSweep(0, -1, 1, 1) && !angleInSweep(2, -1, 1, 1) && angleInSweep(-3.1, 3, 3.5, 1), '扇形跨 ±π 也正确');
  // 墙：x>0.1 一侧是实心 → 刃转到墙就停（clang），右侧的人不挨
  const sw2 = beginSweep(u, 0, { reach: .3, arc: Math.PI * .8, duration: .24, side: 1 }), wallClear = (a, c) => Math.max(a.x, c.x) < .1;
  const h2 = []; for (let k = 0; k < 6; k++) h2.push(...stepSweep(sw2, foes, 1 / 30, { clear: wallClear }));
  assert.ok(sw2.blockedAt !== null && !h2.includes(foes[2]), '3D 接触遮挡：刃碰墙停住，墙后的人不被扫到');
  // 盾：正面挡、背面不挡；冷却内第二下不挡
  const d = { x: 0, z: 0, face: 0, hasShield: true }, front = { x: 0, z: .2 }, back = { x: 0, z: -.2 };
  const blk = shieldBlock(d, front, { now: 0 }); assert.ok(blk && blk.nz > .99, '正面格挡，推开方向朝攻击者');
  assert.equal(shieldBlock(d, front, { now: .1 }), null, '盾冷却中');
  assert.equal(shieldBlock({ ...d, shieldReadyAt: -1 }, back, { now: 5 }), null, '背后挡不住');
}
// 真实 Battle：meleeFx 开 → 扫掠 / 盾格挡真的发生；关 → 一次都没有
for (const on of [false, true]) {
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.g3.set('meleeFx', on);
  b.nextWave = .5; for (let k = 0; k < 1200 && !b.units.some((u) => u.team === 1 && !u.onBoat && !u.dead); k++) b.update(1 / 30);
  // 把登陆的维京人挪到步兵队（0 队：非矛非弓）身边，保证近战在测试窗口里发生
  const inf = b.squads[0].members.filter((u) => !u.dead), viks = b.units.filter((u) => u.team === 1 && !u.dead && !u.onBoat && !u.fall);
  viks.forEach((v, i) => { const d = inf[i % inf.length], a = i * 2.4; v.x = d.x + Math.sin(a) * .2; v.z = d.z + Math.cos(a) * .2; v.y = d.y; v.navFloor = d.navFloor; });
  for (let k = 0; k < 600; k++) b.update(1 / 30);
  const st = { ...b.g3.stats };
  if (on) { assert.ok(st.sweeps >= 2 && st.sweepHits > 0 && st.shieldBlocks > 0, '开：' + JSON.stringify(st)); out.meleeOn = st; }
  else { assert.equal(st.sweeps + st.shieldBlocks, 0); out.meleeOffDeaths = b.units.filter((u) => u.dead).length; }
  assert.ok(b.units.every((u) => [u.x, u.y, u.z].every(Number.isFinite)));
}

// ── squadbanner 接线：standards 开 → Bezier 旗隐藏，竖旗跟队，盾面数 = 在场守军数
{
  const { world, view } = makeIsland('mixed', 7), b = new Battle(view); b.start(world); b.g3.set('standards', true);
  for (let k = 0; k < 30; k++) b.update(1 / 30);
  const alive = b.units.filter((u) => u.team === 0 && !u.dead && !u.onBoat && !u.fall).length;
  assert.equal(b.g3.shieldFaces.count, alive, '每个守军一张金饰盾面');
  assert.ok(b.squads.every((s) => !s.flag.visible && !s.flag.userData.cloth.visible), 'Bezier 飘带旗被替换');
  assert.equal(b.g3.standards.size, 3);
  b.g3.set('standards', false); b.update(1 / 30); assert.ok(b.squads.every((s) => s.flag.visible) && b.g3.shieldFaces.count === 0, '关掉：恢复原旗');
  out.standards = { shieldFaces: alive };
}

// ── terraceladder：梯子模式 寻路避薄悬平台 + 攀爬按横档量化
{
  // 地形场景（generateTerrain，ladder-contact.mjs 同口径）里真有搭在薄悬平台上的梯子：上层只有一块浮岩，梯子没有墙可靠
  const { buildQuadGrid } = await import('../src/core/grid.js'), { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
  const { World } = await import('../src/core/world.js'), { generateTerrain } = await import('../src/terrain/generate.js');
  const grid = buildQuadGrid({ radius: 9, seed: 7 }); decorateCells(grid); const tw = new World(grid); generateTerrain(tw, { seed: 7 });
  const tn = new BattleNavigation(tw, buildCellIndex(grid), { levelHeight: .5 }); tn.refresh();
  const edgeOf = (key) => { const [lo, hi] = key.split(':').map(Number); return tn.graph.adj.some((list, from) => list.some((e) => { const a = tn.graph.nodes[from], c = tn.graph.nodes[e.to]; return a.floor !== c.floor && ((a.cell.id === lo && c.cell.id === hi) || (a.cell.id === hi && c.cell.id === lo)); })); };
  tn.avoidThinLadders = true; tn.refresh(); const thinKeys = [...tn.thinLadders];
  assert.ok(thinKeys.length >= 1, '识别出搭在薄悬平台上的梯子');
  tn.avoidThinLadders = false; tn.refresh(); const before = thinKeys.filter(edgeOf).length;
  tn.avoidThinLadders = true; tn.refresh(); const after = thinKeys.filter(edgeOf).length;
  assert.ok(before === thinKeys.length && after === 0, `梯子模式：薄平台梯子 ${before} → ${after} 条进图`);
  // 其余梯子照常
  const ok = tn.stairs.filter((s) => !tn.thinLadders.has(s.low.id + ':' + s.high.id)).filter((s) => edgeOf(s.low.id + ':' + s.high.id)).length;
  assert.ok(ok > 10, '其余梯子照常进图 ' + ok);
  const nav = tn; out.thinLadders = { thin: thinKeys.length, otherLadders: ok };
  const S = stripWorld(4, 1); for (const c of S.cells) S.world.fill(c, 1, { rock: true }); S.world.fill(S.at(2, 0), 2, { rock: true }); S.world.fill(S.at(3, 0), 2, { rock: true });
  const sn = new BattleNavigation(S.world, S.index, { levelHeight: .5 }); sn.ladderMode = true; sn.refresh();
  // 实心台 (2,0)：梯子在 (1,0) 一侧，脚高沿横档一级一级量化
  const low = S.at(1, 0), node = sn.graph.nodes[sn.graph.at(low, 1)], ys = [];
  assert.ok(sn.stairs.length >= 1, '条带上有一把梯子');
  for (let x = 1.0; x <= 1.5; x += .005) { const st = sn.stairAt(x, 0, node); if (st?.ladder) ys.push(st.tread); }
  assert.ok(ys.length > 20, '梯子范围内');
  const uniq = [...new Set(ys.map((y) => y.toFixed(3)))].length, mono = ys.every((y, i) => !i || y >= ys[i - 1] - 1e-9);
  assert.ok(mono && Math.max(...ys) > .5 + .45 && uniq > 8, `攀爬高度单调、到顶（${Math.max(...ys).toFixed(3)}），按横档分级`);
  // 横档处平台段：相邻横档之间 smoothstep → 中点斜率大、横档处斜率≈0
  out.ladder = { samples: ys.length, levels: uniq, top: +Math.max(...ys).toFixed(3) };
}
// 真实岛 + woodLadders：单位真的上梯（u.climb）且姿态面朝墙
{
  const { world, view } = makeIsland('quad', 7); view.navLayer = { woodLadders: true, stairs: new THREE.Mesh(new THREE.BufferGeometry()) }; const b = new Battle(view); b.start(world); b.nextWave = 1e9;
  const nav = b.navigation; nav.refresh();
  // 给每队一个更高 / 更低台地上的目标，迫使换层
  for (const sq of b.squads) { const lead = sq.members[0], here = nav.unitNode(lead); let best = null; for (const n of nav.graph.nodes) { if (n.floor === here.floor || n.floor !== world.top(n.cell)) continue; const p = nav.plan(lead, n.cell, n.floor); if (p && (!best || p.distance < best.d) && p.distance > 2) best = { n, d: p.distance }; } if (best) { sq.goal = best.n.cell; sq.goalFloor = best.n.floor; } }
  let maxStep = 0, prev = new Map(b.units.map((u) => [u, u.y]));
  for (let k = 0; k < 600; k++) { b.update(1 / 30); for (const u of b.units) { if (u.fall || u.dead) continue; maxStep = Math.max(maxStep, Math.abs(u.y - prev.get(u))); prev.set(u, u.y); } }
  assert.ok(nav.ladderMode && b.g3.stats.maxClimbing > 0, '有人在梯子上（攀爬姿态）' + JSON.stringify(b.g3.stats));
  assert.ok(maxStep < .3, '单帧高度变化 < .3（不瞬移）' + maxStep);
  out.climb = { maxClimbing: b.g3.stats.maxClimbing, maxStep: +maxStep.toFixed(3) };
}

// ── blobshadow：影子贴合形变斜面（射线采样渲染网格）
{
  const { world, view, index } = makeIsland('quad', 7);
  const b = new Battle(view); b.start(world); b.nextWave = 1e9; b.update(1 / 30);
  const u = b.units.find((x) => x.team === 0), node = b.navigation.unitNode(u), y0 = node.floor * .5;
  // 用一块 12° 斜面当「形变后的渲染地面」，过单位脚下
  const tilt = 12 * Math.PI / 180, plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2).rotateZ(tilt), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  plane.position.set(u.x, u.y, u.z); plane.updateMatrixWorld(true); view.mesh = plane;
  b.g3.set('shadowFit', true); b.unitShadows.update(world, [u], b.navigation, .5);
  const r = b.unitShadows.ranges[0]; assert.ok(r?.fit && Math.abs(r.slopeDeg - 12) < .5, '影子平面拟合出 12° 斜面：' + JSON.stringify(r && { fit: r.fit, deg: r.slopeDeg }));
  const P = b.unitShadows.geometry.attributes.position.array; let maxErr = 0;
  for (let i = r.start; i < r.start + r.count; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], want = u.y + Math.tan(tilt) * (x - u.x); maxErr = Math.max(maxErr, Math.abs(y - .008 - want)); }
  assert.ok(maxErr < .01, '每个顶点贴在斜面上（误差 ' + maxErr.toFixed(4) + '）');
  b.g3.set('shadowFit', false); b.unitShadows.update(world, [u], b.navigation, .5); assert.ok(!b.unitShadows.ranges[0]?.fit, '关掉：回到旧的楼层平面');
  out.shadow = { slopeDeg: +r.slopeDeg.toFixed(2), maxErr: +maxErr.toFixed(4) };
}

// ── uikit：指令条（layoutList，倾斜不重叠）+ 单一 Move 目标 + 地面标记 + 指令真的改目标
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.nextWave = 1e9; b.g3.set('commands', true);
  const sq = b.squads[0], nav = b.navigation; nav.refresh();
  const targets = nav.graph.nodes.filter((n) => n.floor === world.top(n.cell) && nav.plan(sq.members[0], n.cell, n.floor)).slice(0, 40);
  b.g3.onMove(sq, { cell: targets[5].cell, floor: targets[5].floor }); b.g3.onMove(sq, { cell: targets[30].cell, floor: targets[30].floor });
  const markersOfSq = [...b.g3.group.children].filter((c) => c === b.g3.markers.get(sq));
  assert.equal(b.g3.markers.size, 1, '同一队连下两次令：只有一个 Move 标记'); assert.equal(markersOfSq.length, 1);
  const mk = b.g3.markers.get(sq); assert.ok(Math.hypot(mk.position.x - targets[30].cell.cx, mk.position.z - targets[30].cell.cz) < 1e-9, '标记挪到新目标');
  b.update(1 / 30); assert.ok(b.g3.layout && b.g3.layout.overlaps === 0 && b.g3.layout.maxRotDeg > .3, '指令条：倾斜但不重叠 ' + JSON.stringify({ o: b.g3.layout?.overlaps, r: b.g3.layout?.maxRotDeg }));
  b.selected = sq; const lead = sq.members[0], here = nav.unitNode(lead);
  assert.ok(b.g3.command('hold') && sq.goal === here.cell && b.selected === null, '原地坚守：目标 = 脚下');
  b.selected = sq; assert.ok(b.g3.command('retreat') && b.houses.some((h) => h.door === sq.goal), '退回小屋：目标 = 最近小屋门口');
  assert.ok(b.g3.markers.get(sq).visible);
  out.ui = { overlaps: b.g3.layout.overlaps, maxRot: +b.g3.layout.maxRotDeg.toFixed(2), commands: b.g3.stats.commands };
}
console.log('battle-g3: PASS', JSON.stringify(out));
