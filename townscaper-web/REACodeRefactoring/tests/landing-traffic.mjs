// 974325184525201409 残差补齐：岸礁后两段（母船航线 corridorBlocked、离港段并入 seawayBox 至 19.94）
// + 动态避让 steerBoat（让行 + 侧让，本地近似非原片机制）+ battle.js 发船/每帧接线。
import assert from 'node:assert/strict';
import { makeIsland, stripWorld } from './fixtures/g5-battle.mjs';
import { corridorBox, corridorBlocked, seawayBlocked, steerBoat, berthBox, planLanding } from '../src/badnorth/landing-plan.js';
import { Battle } from './fixtures/g5-battle.mjs';

/* ① corridorBlocked：任意两点的走廊压陆地判定（母船航线用） */
{
  const S = stripWorld(20, 9);
  const rockA = S.at(10, 4); S.world.fill(rockA, 1, { rock: true });
  assert.equal(corridorBlocked(S.world, [8, 4], [12, 4]), true, '走廊横穿礁石');
  assert.equal(corridorBlocked(S.world, [8, 4], [12, 4], { except: [rockA] }), false, 'except 放行贴岸格');
  assert.equal(corridorBlocked(S.world, [8, 6], [12, 6]), false, '海面走廊干净');
  assert.equal(corridorBlocked(S.world, [8, 4], [8.5, 4.2], { except: [rockA] }), false, '零长度/短走廊不炸');
  assert.ok(corridorBox([0, 0], [2, 0], { pad: .5 }).e[0] > corridorBox([0, 0], [2, 0]).e[0], 'pad 只伸远端');
}

/* ② 离港段并入岸礁检测：14.74 以外的礁石现在也挡线（'out' 走到 ~19.2） */
{
  const S = stripWorld(30, 9);
  const land = S.at(2, 4); S.world.fill(land, 1, { rock: true });
  S.world.fill(S.at(19, 4), 1, { rock: true });   // 正东 ~16 格外的礁石：旧 seawayBox(到 14.74) 盖不到
  const stop = [3.25, 4], dir = [1, 0];
  assert.equal(seawayBlocked(S.world, stop, dir, { except: [land] }), true, '离港段礁石挡线');
  S.world.fill(S.at(19, 4), 0, { rock: true });
  assert.equal(seawayBlocked(S.world, stop, dir, { except: [land] }), false, '清礁后放行');
}

/* ③ steerBoat 纯逻辑：障碍序、侧偏、让行、地形侧偏 */
const mkBoat = (o) => ({ x: 0, z: 0, stop: [0, -5], dir: [0, -1], from: [0, 5], t: 0, state: 'in', crew: [], stains: [], trail: [], land: null, ...o });
{
  // 泊位船（unload）横在航线上 → 侧偏绕开；三面包围 → 停船等让
  const me = mkBoat({ x: 0, z: 0 });
  const berthed = mkBoat({ x: 0, z: -2.2, state: 'unload', stop: [0, -2.2], dir: [0, -1] });
  let st = steerBoat(me, [berthed, me], 1);
  assert.equal(st.hold, false); assert.ok(Math.abs(st.offset) > 0.3, `泊位船挡道 → 侧偏 ${st.offset}`);
  const left = mkBoat({ x: -1.15, z: -2.2, state: 'unload', stop: [0, -2.2] });
  const right = mkBoat({ x: 1.15, z: -2.2, state: 'unload', stop: [0, -2.2] });
  st = steerBoat(me, [berthed, left, right, me], 3);
  assert.equal(st.hold, true, '三面泊位船 → 停船等让');
  // 优先级：后进港的让先进港的；离港（out）先于进港；先进港的不受后发影响
  const early = mkBoat({ x: -0.2, z: -1, stop: [0, -6] }), late = mkBoat({ x: 0.2, z: -0.4, stop: [0, -6] });
  assert.equal(steerBoat(early, [early, late], 0).offset, 0, '先发船不把后发船当障碍');
  const out = mkBoat({ x: 0, z: -1.5, state: 'out', dir: [0, -1] });
  const inb = mkBoat({ x: 0, z: -0.5 });
  const si = steerBoat(inb, [out, inb], 1), so = steerBoat(out, [out, inb], 0);
  assert.ok(si.hold || si.offset !== 0, '进港让离港');
  assert.deepEqual({ o: so.offset, h: so.hold }, { o: 0, h: false }, '离港不让进港');
  // 地形侧偏：航线右侧（行进方向左手 +x）有礁石，只剩 -x 一侧干净
  const S = stripWorld(20, 9);
  for (const i of [5, 6]) S.world.fill(S.at(i, 4), 1, { rock: true });
  const me2 = mkBoat({ x: 4.5, z: 6.5, stop: [4.5, 4.6], dir: [0, -1] });
  const st2 = steerBoat(me2, [me2], 0, { world: S.world });
  assert.equal(st2.hold, false); assert.ok(st2.offset < 0, `航线压礁 → 侧偏向海 ${st2.offset}`);
  // 泊位跟前（rem ≤ 1.2）不查岸礁，贴岸角点不误杀成 hold
  const near = mkBoat({ x: 4.5, z: 5.4, stop: [4.5, 4.6], dir: [0, -1] });
  assert.equal(steerBoat(near, [near], 0, { world: S.world }).hold, false);
  assert.throws(() => corridorBlocked(null, [0, 0], [1, 0]), TypeError, 'world 缺失不是悄悄放行');
}

/* ④ battle.js 接线：母船航线岸礁检测 + 动态让行进真实 update */
{
  const { world, view } = makeIsland('quad', 7);
  // 负例：母船坐标压在陆地格上 → 全部候选航线不干净 → 退回标准走廊并计数
  const landCell = world.cells.find((c) => world.top(c) > 0);
  view.boatOrigins = () => [{ x: landCell.cx, z: landCell.cz }];
  const b = new Battle(view); b.start(world);
  const savedRandom = Math.random; Math.random = () => 0;   // planLanding 起点确定 → 十次采样同一候选
  try {
    b.nextWave = 0; b.update(1 / 30);
    assert.equal(b.boats.length, 1);
    const boat = b.boats[0];
    assert.equal(b.trafficStats.originBlocked, 1, '母船在陆地上 → 计一次退回');
    assert.ok(Math.abs(boat.from[0] - (boat.stop[0] + boat.dir[0] * 14)) < 1e-9 && Math.abs(boat.from[1] - (boat.stop[1] + boat.dir[1] * 14)) < 1e-9, '退回标准直线走廊');
    // 正例：母船放在该波走廊末端（planLanding 同一随机序列）→ 采用母船航线
    const b2 = new Battle(view); b2.start(world);
    const p0 = planLanding(world, [], { random: () => 0 });
    view.boatOrigins = () => [{ x: p0.stop[0] + p0.dir[0] * 13, z: p0.stop[1] + p0.dir[1] * 13 }];
    b2.nextWave = 0; b2.update(1 / 30);
    const boat2 = b2.boats[0];
    assert.equal(b2.trafficStats.originBlocked, 0, '航线干净 → 采用母船出发');
    assert.ok(Math.hypot(boat2.from[0] - (p0.stop[0] + p0.dir[0] * 13), boat2.from[1] - (p0.stop[1] + p0.dir[1] * 13)) < 1e-9, 'from = 母船');
    assert.ok(!corridorBlocked(world, [boat2.stop[0] + boat2.dir[0] * .8, boat2.stop[1] + boat2.dir[1] * .8], boat2.from, { except: [boat2.land] }), '实际航线不压陆地');
    // 动态让行进真实 update：泊位船三面包围进场船 → 进场船停住不前进；撤墙放行。
    // 进场船放在 boat2 的真实干净走廊上（剩余路径不压陆地，撤墙后地形检查不误伤）。
    const wf = [boat2.stop[0] - boat2.from[0], boat2.stop[1] - boat2.from[1]], wl = Math.hypot(...wf); wf[0] /= wl; wf[1] /= wl;
    const perp = [-wf[1], wf[0]];
    const fake = (o) => ({ x: 0, z: 0, stop: [0, -5], dir: [0, -1], from: [0, 5], t: 0, state: 'unload', wait: 0, crew: [], stains: [], trail: [], land: null,
      mesh: { position: { set() {} }, rotation: { set() {} }, updateMatrixWorld() {}, matrix: { elements: new Array(16).fill(0) }, userData: { wake: { geometry: { setAttribute() {} } } } }, ...o });
    const ax = boat2.from[0] + wf[0] * 4.2, az = boat2.from[1] + wf[1] * 4.2;   // 墙横在走廊 4.2 处
    const wall = [fake({ x: ax, z: az, dir: boat2.dir }), fake({ x: ax + perp[0] * 1.15, z: az + perp[1] * 1.15, dir: boat2.dir }), fake({ x: ax - perp[0] * 1.15, z: az - perp[1] * 1.15, dir: boat2.dir })];
    const inbound = fake({ x: boat2.from[0] + wf[0] * 2, z: boat2.from[1] + wf[1] * 2, stop: boat2.stop, dir: boat2.dir, from: boat2.from, t: .2, state: 'in', inDur: 9, land: boat2.land });
    b2.boats.length = 0; b2.boats.push(...wall, inbound);   // 清掉 wave 1 的船，只剩三面包围场景
    const t0 = inbound.t;
    for (let k = 0; k < 30; k++) b2.update(1 / 30);
    assert.equal(inbound.t, t0, '被三艘泊位船封死 → t 不前进');
    assert.equal(inbound.hold, true, 'hold 标记置位');
    assert.ok(b2.trafficStats.holdFrames > 0);
    b2.boats.splice(0, 3);   // 撤墙 → 放行
    b2.update(1 / 30); b2.update(1 / 30);
    assert.ok(inbound.t > t0, '障碍离开后放行');
  } finally { Math.random = savedRandom; }
  console.log('PASS battle wiring: origin terrain check + hold/sidestep in update');
}
console.log('PASS landing-traffic：母船航线/离港岸礁 + steerBoat 侧让/让行/优先级/地形侧偏');
