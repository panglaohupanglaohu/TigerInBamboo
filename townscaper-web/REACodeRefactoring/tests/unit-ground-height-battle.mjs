// 828984794407170048 坡地战斗 · 逐人层高缓动 —— 真实 Battle + 真分层导航的 Node 集成证明。
// 纯函数 30/60/120Hz 解析一致由 tests/unit-ground-height.mjs 覆盖；本文件证明：
//  ① 真 Battle 双楼层、无移动目标时也按同一解析曲线收敛（待命分支此前 continue 跳过缓动，y 会冻在半空）；
//  ② 近战缠斗分支（fd<reach → continue）里 x/z 不动但 y 仍在缓动；
//  ③ 眩晕分支同理；
//  ④ 与战斗语义兼容：缓动只写 u.y，不改 navFloor/x/z，落地单位脚高有界、数值有限；
//  ⑤ 同种子两次完整跑结果逐位一致（确定性）。
import assert from 'node:assert/strict';
import { makeIsland, Battle } from './fixtures/g5-battle.mjs';

// 战斗里有 Math.random（出手冷却/血滴/击退），固定种子让断言可复现（与 battle-c01.mjs 同法）
const reseed = (a = 20561) => { let s = a; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
reseed();
const out = {};

/** 真岛 + 真 Battle + 真分层导航里挑「与地面齐平、四邻同层」的两个不同楼层可站节点（浏览器验收 unit-ground-height-browser.cjs 同口径）。 */
function flatNodes(b) {
  const w = b.world;
  b.navigation.refresh();
  const nodes = b.navigation.graph.nodes.filter((n) => n.floor > 0 && n.floor === w.ground(n.cell)
    && n.cell.edgeNeighbors.every((id) => id >= 0 && w.ground(w.cells[id]) === n.floor));
  const first = nodes[0], second = nodes.find((n) => n.floor !== first.floor);
  assert.ok(first && second, '岛上要有两个真实楼层');
  return [first, second];
}
const flatNode = (b) => flatNodes(b)[0];
/** 单人守军：清空其它单位、squad 只留自己，便于逐帧归因。goal=null → 老代码在「无目标」分支 continue，不会走到缓动。 */
function solo(b, u) {
  b.units = [u];
  u.squad.members = [u];
  u.squad.goal = null; u.squad.goalFloor = null;
  u.cd = 100; u.stunRemaining = 0; u.dead = false; u.fall = null; u.onBoat = null;
  return u;
}

// ── ① 待命（无目标）+ 真双楼层：30/60/120Hz 解析一致 ─────────────────────
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.nextWave = 1e9;
  const [na, nb] = flatNodes(b), ua = b.squads[0].members[0], ub = b.squads[1].members[0];
  b.units = [ua, ub];
  for (const [u, n] of [[ua, na], [ub, nb]]) {
    u.squad.members = [u]; u.squad.goal = null; u.squad.goalFloor = null;
    u.cd = 100; u.stunRemaining = 0; u.dead = false; u.fall = null; u.onBoat = null;
    u.x = n.cell.cx; u.z = n.cell.cz; u.navFloor = n.floor;
  }
  const feet = [na, nb].map((n, i) => b.navigation.footHeight([ua, ub][i]));
  feet.forEach((f, i) => assert.equal(f, [na, nb][i].floor * b.L, '平层平台脚高 = 层高×楼层'));
  const ys = {};
  for (const hz of [30, 60, 120]) {
    for (const [u, n, f] of [[ua, na, feet[0]], [ub, nb, feet[1]]]) { u.y = f - 0.1; u.navFloor = n.floor; u.x = n.cell.cx; u.z = n.cell.cz; }
    for (let i = 0; i < hz; i++) b.update(1 / hz);
    for (const [i, u, f] of [[0, ua, feet[0]], [1, ub, feet[1]]]) {
      const expected = f - 0.1 * Math.exp(-10);
      assert.ok(Math.abs(u.y - expected) < 1e-10, `待命分支 ${hz}Hz 楼层${[na, nb][i].floor} 1秒收敛到解析值 ${u.y} vs ${expected}`);
    }
    ys[hz] = [ua.y, ub.y];
    assert.equal(ua.navFloor, na.floor, '缓动不改 navFloor');
    assert.equal(ua.x, na.cell.cx, '待命不动 x');
  }
  out.idle = { floors: [na.floor, nb.floor], feet, ys };
}

// ── ② 近战缠斗分支：x/z 全程不动，y 仍在缓动 ─────────────────────────────
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.nextWave = 1e9;
  const n = flatNode(b), u = solo(b, b.squads[0].members[0]), foot = n.floor * b.L;
  u.x = n.cell.cx; u.z = n.cell.cz; u.navFloor = n.floor; u.y = foot - 0.1;
  // 手搓一个贴脸维京人：cd 拉满不攻击，但 fd<reach 让两人每一帧都走进战 continue —— 老代码在这里不缓动
  const v = { uid: 9001, team: 1, squad: null, k: 0, hp: 2, max: 2, x: u.x + 0.15, z: u.z, y: foot + 0.1, navFloor: n.floor, cd: 100, dead: false, onBoat: null, face: 0, soak: 0, radius: 0.055 };
  b.units.push(v);
  const reach = 0.28, fd = Math.hypot(v.x - u.x, v.z - u.z);
  assert.ok(fd < reach && b.navigation.canMelee(u, v) && b.navigation.canMelee(v, u), '必须真落在近战判定里，才能证明走的是缠斗分支');
  const [x0, z0, vx0, vz0] = [u.x, u.z, v.x, v.z];
  for (let i = 0; i < 30; i++) b.update(1 / 30);
  assert.equal(u.x, x0); assert.equal(u.z, z0);           // x/z 一帧没动 → 没走走路分支
  assert.equal(v.x, vx0); assert.equal(v.z, vz0);
  assert.ok(Math.abs(u.y - (foot - 0.1 * Math.exp(-10))) < 1e-10, '守军缠斗中 y 仍按解析曲线收敛 ' + u.y);
  assert.ok(Math.abs(v.y - (foot + 0.1 * Math.exp(-10))) < 1e-10, '维京人缠斗中同样收敛 ' + v.y);
  out.melee = { uY: u.y, vY: v.y, foot };
}

// ── ③ 眩晕分支：stun 期间也在缓动，不是冻结 ──────────────────────────────
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.nextWave = 1e9;
  const n = flatNode(b), u = solo(b, b.squads[0].members[0]), foot = n.floor * b.L;
  u.x = n.cell.cx; u.z = n.cell.cz; u.navFloor = n.floor; u.y = foot - 0.1; u.stunRemaining = 0.5;
  const mark = [];
  for (let i = 0; i < 15; i++) { b.update(1 / 30); mark.push([u.stunRemaining, u.y]); }
  assert.ok(mark.every(([r]) => r >= 0), '眩晕计时递减');
  assert.ok(mark[10][0] > 0, '中段还在眩晕里');
  assert.ok(Math.abs(mark[10][1] - (foot - 0.1 * Math.exp(-10 * (11 / 30)))) < 1e-10, '眩晕中的 y 已按曲线走到 11/30 秒处 ' + mark[10][1]);
  for (let i = 0; i < 30; i++) b.update(1 / 30);
  assert.ok(Math.abs(u.y - foot) < 1e-4, '眩晕结束后继续收敛到脚高 ' + u.y);
  out.stun = { midY: mark[10][1], endY: u.y };
}

// ── ④ 兼容：整队真跑一段，接地单位脚高有限有界、寻路照常 ──────────────────
{
  const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.nextWave = 1e9;
  for (let k = 0; k < 300; k++) b.update(1 / 30);
  const grounded = b.units.filter((u) => !u.dead && !u.onBoat && !u.fall);
  assert.ok(grounded.length > 10, '小队还活着 ' + grounded.length);
  for (const u of grounded) {
    assert.ok([u.x, u.y, u.z].every(Number.isFinite), '坐标有限');
    const d = Math.abs(u.y - b.navigation.footHeight(u));
    assert.ok(d < b.L, '接地单位离脚高一层的界内（缓动中也算贴地）' + d);
  }
  const m = b.navigation.measureFooting(grounded);
  assert.ok(m.units === grounded.length && Number.isFinite(m.maxGap), 'unitsnap.measure 口径照常工作 ' + JSON.stringify(m));
  out.compat = { units: grounded.length, ...m };
}

// ── ⑤ 确定性：同种子、同岛、同操作两次，y 序列逐位一致 ───────────────────
{
  const run = () => {
    reseed();
    const { world, view } = makeIsland('quad', 7), b = new Battle(view); b.start(world); b.nextWave = 1e9;
    const n = flatNode(b), u = solo(b, b.squads[0].members[0]);
    u.x = n.cell.cx; u.z = n.cell.cz; u.navFloor = n.floor; u.y = n.floor * b.L - 0.1;
    const s = []; for (let i = 0; i < 60; i++) { b.update(1 / 30); s.push(u.y); }
    return s;
  };
  assert.deepEqual(run(), run(), '同种子两次跑 y 序列逐位一致');
}

console.log('unit-ground-height-battle PASS', JSON.stringify(out));
