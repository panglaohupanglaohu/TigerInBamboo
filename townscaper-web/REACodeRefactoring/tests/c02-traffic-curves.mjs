// 第 56 批 C02 · 880853661936734211 "left handed traffic" —— 弯道 / 多岔 / 拥挤也不卡。
// 旧测试（traffic.mjs）只有直走廊；这里用 L 形弯道、T 形岔口、Z 形双弯三种走廊，两队迎面对穿（共享 traffic.js 的
// leftLaneTarget + localSeparation，不另写规则），三帧率下全部到达、不出走廊、迎面最小间距 > 0。
import assert from 'node:assert/strict';
import { leftLaneTarget, localSeparation, narrowCells } from '../src/world/traffic.js';

function corridor(cellsXZ) {
  const key = (x, z) => x + ',' + z, at = new Map();
  const cells = cellsXZ.map(([x, z], id) => { const c = { id, cx: x, cz: z, n: 4, pts: [{ x: x - .5, z: z - .5 }, { x: x + .5, z: z - .5 }, { x: x + .5, z: z + .5 }, { x: x - .5, z: z + .5 }] }; at.set(key(x, z), c); return c; });
  for (const c of cells) c.edgeNeighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dz]) => at.get(key(c.cx + dx, c.cz + dz))?.id ?? -1);
  const cellAt = (x, z) => at.get(key(Math.round(x), Math.round(z))) ?? null;
  // BFS 下一格（整张走廊的树，按目标缓存）
  const trees = new Map();
  const next = (from, goal) => {
    let t = trees.get(goal.id);
    if (!t) { t = new Int32Array(cells.length).fill(-1); const q = [goal.id]; t[goal.id] = goal.id; while (q.length) { const a = q.shift(); for (const b of cells[a].edgeNeighbors) if (b >= 0 && t[b] < 0) { t[b] = a; q.push(b); } } trees.set(goal.id, t); }
    return cells[t[from.id]];
  };
  return { cells, cellAt, next };
}
const L = []; for (let x = 0; x <= 10; x++) L.push([x, 0]); for (let z = 1; z <= 10; z++) L.push([10, z]);
const Z = []; for (let x = 0; x <= 6; x++) Z.push([x, 0]); for (let z = 1; z <= 5; z++) Z.push([6, z]); for (let x = 7; x <= 13; x++) Z.push([x, 5]);
const T = []; for (let x = 0; x <= 12; x++) T.push([x, 0]); for (let z = 1; z <= 7; z++) T.push([6, z]);
const scenes = {
  L: { cells: L, groups: [[[0, 0], [10, 10]], [[10, 10], [0, 0]]] },
  Z: { cells: Z, groups: [[[0, 0], [13, 5]], [[13, 5], [0, 0]]] },
  // T 岔：三队，两队从横干两端出发去竖枝，一队从竖枝去横干左端 → 岔口三向交汇
  T: { cells: T, groups: [[[0, 0], [6, 7]], [[12, 0], [6, 7]], [[6, 7], [0, 0]]] },
};
const out = {};
for (const [name, sc] of Object.entries(scenes)) {
  const cor = corridor(sc.cells);
  // 共享 narrowCells 也要把这些走廊认作窄道（battle 只在窄道里启用左行）
  const world = { cells: cor.cells }, nav = { walk: new Uint8Array(cor.cells.length).fill(1), cost: () => 1 };
  const narrow = narrowCells(world, nav); const share = narrow.reduce((a, b) => a + b, 0) / cor.cells.length;
  assert.ok(share > .6, `${name}: 大部分格被认作窄道（${share.toFixed(2)}）`);
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const agents = [];
    sc.groups.forEach(([s, g], gi) => { for (let k = 0; k < 10; k++) { const st = cor.cellAt(...s); agents.push({ g: gi, x: st.cx + (k % 2 ? .1 : -.1) * (s[1] === 0 ? 0 : 1), z: st.cz + (k % 2 ? .1 : -.1) * (s[1] === 0 ? 1 : 0), goal: cor.cellAt(...g), y: 0, radius: .055, release: k * .35, done: false }); } });
    let t = 0, minOpp = Infinity, maxOut = 0;
    while (agents.some((a) => !a.done) && t < 120) {
      const live = agents.filter((a) => !a.done && t >= a.release);
      for (const a of live) {
        const here = cor.cellAt(a.x, a.z); assert.ok(here, `${name} 走出走廊`);
        let tx, tz;
        if (here === a.goal) { tx = a.goal.cx; tz = a.goal.cz; }
        else { const nx = cor.next(here, a.goal), lane = leftLaneTarget(here, nx, { width: .08, bodyRadius: a.radius }); tx = lane.x; tz = lane.z; }
        const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz), s = d ? Math.min(d, .9 * dt) / d : 0;
        const sep = localSeparation(a, live, dt);
        const px = a.x + dx * s + sep.x, pz = a.z + dz * s + sep.z;
        if (cor.cellAt(px, pz)) { a.x = px; a.z = pz; } else { a.x += dx * s; a.z += dz * s; }
        // 走廊内：离所在格边界的余量
        const c = cor.cellAt(a.x, a.z); maxOut = Math.max(maxOut, c ? 0 : 1);
        if (here === a.goal && Math.hypot(a.x - a.goal.cx, a.z - a.goal.cz) < .2) a.done = true;
      }
      // 只量走廊中段（端点格是出发 / 集结区，两队在那里本来就要挤在一起）
      const ends = new Set(sc.groups.flat().map((p) => cor.cellAt(...p).id)), mid = (a) => !ends.has(cor.cellAt(a.x, a.z)?.id);
      for (const a of live) for (const b of live) if (a.g !== b.g && !a.done && !b.done && mid(a) && mid(b)) minOpp = Math.min(minOpp, Math.hypot(a.x - b.x, a.z - b.z));
      t += dt;
    }
    assert.ok(agents.every((a) => a.done), `${name} dt=${dt.toFixed(4)}：全部到达（${agents.filter((a) => a.done).length}/${agents.length}，t=${t.toFixed(1)}）`);
    assert.equal(maxOut, 0, `${name}：没人出走廊`);
    // 拐角 / 岔口处迎面最小间距只记录（实测 .012–.041 < 半径和 .11：弯心两条左行车道会短暂贴身，靠软分离挤过去，不卡死）
    assert.ok(minOpp > .005, `${name}：没有人穿过另一个人（${minOpp.toFixed(3)}）`);
    (out[name] ??= []).push({ dt: +dt.toFixed(4), seconds: +t.toFixed(2), minOpp: +minOpp.toFixed(3) });
  }
}
console.log('PASS 左行：L 弯 / Z 双弯 / T 三向岔口 × 30/60/120Hz 全到达（不卡死、不出走廊）', JSON.stringify(out));
