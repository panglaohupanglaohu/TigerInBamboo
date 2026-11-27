/**
 * 906425294533394432 "It's like navigating a Swiss cheese" / 797119718477991936 "Got some basic navigation going"
 * 真实 Battle 的洞口排队验收（同一份 World，只改洞口净宽 / 体型 / 开关）：
 *   窄口（净宽 .34，容量 2）→ 成批过（2/2/2），有排队，全员到达；
 *   宽口（净宽 1.0，容量 8）→ 6 人同一拍过，零等待（不发明「所有门都单列」）；
 *   宽口 + 大体型（半径 .25，容量 1）→ 单列，排队，全员到达；
 *   关档（`?doors=0` 等价）→ 窄口也能挤成一团过（负对照：串行确实是闸口造成的）。
 * 运行：node tests/door-queue-battle.mjs
 */
import assert from 'node:assert/strict';
import { stripWorld, makeView, Battle } from './fixtures/g5-battle.mjs';
import { DoorOccupancy } from '../src/world/door-occupancy.js';

function run({ h = 1, n = 6, R = .055, doors = true } = {}) {
  const S = stripWorld(9, 3);
  for (const c of S.cells) S.world.fill(c, 1, { rock: true });
  for (const j of [0, 2]) for (const i of [3, 4, 5]) S.world.fill(S.at(i, j), 3, { rock: true });   // 隧道两侧实心墙
  for (const i of [3, 4, 5]) S.world.setSolid(S.at(i, 1), 3, true);                                  // 洞顶在第 3 层
  // 洞口收窄：x = 2.5 那条共边（只在 j = 1 这一行）
  if (h < 1) for (const c of S.cells) for (const p of c.pts) if (p.x === 2.5 && Math.abs(p.z - 1) < 1) p.z = p.z < 1 ? 1 - h : 1 + h;
  for (const c of S.cells) { c.cx = c.pts.reduce((a, p) => a + p.x, 0) / c.n; c.cz = c.pts.reduce((a, p) => a + p.z, 0) / c.n; }
  const index = { cellAt(x, z) { const i = Math.round(x), j = Math.round(z); if (Math.abs(x - i) > .5 || Math.abs(z - j) > .5) return null; return S.cells.find(c => c.id === j * 9 + i) ?? null; } };
  const b = new Battle(makeView(S.world, index));
  b.doorsOn = doors;
  b.start(S.world);
  b.nextWave = 1e9; b.units = []; b.squads = []; b.houses = [];
  const squad = { id: 0, members: [], alive: true, goal: S.at(7, 1), goalFloor: 1 };
  for (let k = 0; k < n; k++) {
    const u = { uid: k + 1, team: 0, squad, k, hp: 3, max: 3, x: 1 + (k % 2) * .12, z: 1 - (Math.floor(k / 2) - .5) * .16, y: .5, navFloor: 1, cd: 99, dead: false, onBoat: null, face: 0, soak: 0, radius: R, stunRemaining: 0 };
    squad.members.push(u); b.units.push(u);
  }
  const mouths = b.navigation.mouthStats();
  const from = b.navigation.graph.nodes.find((x) => x.cell.id === S.at(2, 1).id && x.floor === 1);
  const to = b.navigation.graph.nodes.find((x) => x.cell.id === S.at(3, 1).id && x.floor === 1);
  const mouth = b.navigation.mouth(from, to);
  assert.ok(mouth, '洞口应被识别（同层、一侧 covered）');
  const cap = DoorOccupancy.capacity(mouth.width, R);
  let insideMax = 0, maxHolders = 0, arrivedAt = null;
  const crossed = new Set(), crossAt = [];
  for (let t = 0; t < 60 * 30; t++) {
    b.update(1 / 30);
    for (const u of b.units) if (u.x > 3.2 && !crossed.has(u.uid)) { crossed.add(u.uid); crossAt.push(+(t / 30).toFixed(2)); }
    insideMax = Math.max(insideMax, b.units.filter((u) => Math.abs(u.x - 2.5) < .12).length);
    if (b.doors) maxHolders = Math.max(maxHolders, b.doors.holders(mouth.key));
    if (b.units.every((u) => Math.hypot(u.x - 7, u.z - 1) < .5)) { arrivedAt = +(t / 30).toFixed(2); break; }
  }
  assert.ok(arrivedAt !== null, `全员到达（无死锁，h=${h} R=${R} doors=${doors}）`);
  assert.equal(crossed.size, n, '每个人都跨过洞口');
  return { mouths, mouth, cap, insideMax, maxHolders, crossAt, arrivedAt, waits: b.doorStats.waits, waitFrames: b.doorStats.waitFrames, stalls: b.doorStats.stalls ?? 0, report: b.doorReport() };
}

// ① 窄口：净宽 .34 → 容量 2，成批过、有人等
const narrow = run({ h: .17 });
assert.equal(narrow.cap, 2, '窄口容量 2（净宽 .34 / 体径 .121）');
assert.ok(narrow.maxHolders <= narrow.cap, '占用表从不超过容量');
assert.ok(narrow.insideMax <= 2, '洞口里同时最多 2 个人');
assert.ok(narrow.waits >= 1 && narrow.waitFrames > 0, '有人被拒之门外（排队）');
assert.ok(narrow.arrivedAt > 5, '排队让整队变慢（实测 ' + narrow.arrivedAt + 's）');

// ② 宽口：容量 8 > 6 人 → 零等待，六个人同一拍过
const wide = run({ h: 1 });
assert.ok(wide.cap >= 6, '宽拱容量 ' + wide.cap + ' ≥ 6');
assert.equal(wide.waits, 0, '宽拱不排队（片子里的拱洞就是这一档）');
assert.equal(wide.insideMax, 6, '六个人同时过洞口');
assert.ok(wide.arrivedAt < narrow.arrivedAt, '宽口比窄口快');

// ③ 宽口 + 大体型：半径 .25 → 容量 1，单列
const big = run({ h: 1, R: .25 });
assert.equal(big.cap, 1, '大体型在 1.0 宽的洞口只剩 1 人');
assert.ok(big.waits >= 1, '大体型要排队');
assert.ok(big.maxHolders <= 1, '同一洞口最多 1 个大个子');
assert.ok(big.arrivedAt > wide.arrivedAt, '单列更慢');

// ④ 负对照：关掉占用表 → 窄口也不排队、挤成一团（串行是闸口造成的，不是速度）
const off = run({ h: .17, doors: false });
assert.equal(off.waits, 0, '关档不产生等待');
assert.ok(off.insideMax > narrow.insideMax, '关档时洞口里挤的人更多（' + off.insideMax + ' > ' + narrow.insideMax + '）');

console.log('PASS door-queue-battle', {
  narrow: { cap: narrow.cap, insideMax: narrow.insideMax, crossAt: narrow.crossAt, t: narrow.arrivedAt, waits: narrow.waits, waitFrames: narrow.waitFrames, stalls: narrow.stalls },
  wide: { cap: wide.cap, insideMax: wide.insideMax, crossAt: wide.crossAt, t: wide.arrivedAt, waits: wide.waits },
  big: { cap: big.cap, insideMax: big.insideMax, crossAt: big.crossAt, t: big.arrivedAt, waits: big.waits, maxHolders: big.maxHolders },
  off: { insideMax: off.insideMax, t: off.arrivedAt, waits: off.waits },
  mouths: narrow.mouths,
});
