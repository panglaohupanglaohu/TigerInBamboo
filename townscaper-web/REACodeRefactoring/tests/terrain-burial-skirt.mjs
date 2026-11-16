// 1671840905957978113：被吞的墙在崖面上留下的「墙裙残留」与「悬檐联动」。
// 判据（一一对应，不是各画各的）：
//   1. 墙裙只出在「露在崖上的面」×「头顶还有屋顶的列」的交集上；
//   2. 每个墙裙面必有一个檐下缺口（notches.length === bands.length，cell/face 相同）；
//   3. 檐口比墙裙缩得更深（setback > inset），缺口从 cut 层跨到屋顶层；
//   4. 没被刷过地、被整栋埋掉、邻格同高这三种情况都不许出墙裙（否则就是全崖一圈深色）。
import assert from 'node:assert/strict';
import { World } from '../src/core/world.js';
import { buildSquareGrid } from '../src/core/grid.js';
import {
  buryColumn, cliffSkirt, skirtSegment, SKIRT_DEPTH, SKIRT_INSET, EAVE_SETBACK, EAVE_SHADOW,
} from '../src/core/terrain-burial.js';

const grid = buildSquareGrid({ radius: 3, cellSize: 1 });
const mid = grid.cells[Math.floor(grid.cells.length / 2)];

// ---- 1. 一栋 5 层的房子、地面抬到 3：四张露出来的面都留墙裙 ----
const w = new World(grid);
for (let lv = 1; lv <= 5; lv++) w.setSolid(mid, lv, true);
w.color[mid.id] = 7;
buryColumn(w, mid, 3);
let sk = cliffSkirt(w);
assert.ok(sk.bands.length >= 4, '抬到 3 层之后四面崖壁都要有墙裙，实际 ' + sk.bands.length);
assert.equal(sk.faces, sk.bands.length, 'faces 就是 band 数');
assert.equal(sk.buriedCells, 1, '台账里只该有这一列');
for (const b of sk.bands) {
  assert.equal(b.cell, mid.id);
  assert.equal(b.level, 3, '墙裙贴在 cut 层（= 地面高度）');
  assert.equal(b.y0, 3 - SKIRT_DEPTH, '墙裙深度取 SKIRT_DEPTH');
  assert.equal(b.y1, 3);
  assert.equal(b.inset, SKIRT_INSET, '墙裙必须内缩：墙皮在格内、不在格边');
  assert.ok(b.inset > 0 && b.inset < 0.5);
  assert.equal(b.wall, 7, '墙裙应当带原建筑的墙色');
  assert.ok(b.face >= 0 && b.face < mid.n);
}

// ---- 2. 联动：每个墙裙面正好一个檐下缺口，檐口比墙裙缩得更深 ----
assert.equal(sk.notches.length, sk.bands.length, '墙裙与檐口必须一一对应（这就是联动）');
for (let i = 0; i < sk.bands.length; i++) {
  const b = sk.bands[i], n = sk.notches[i];
  assert.equal(n.cell, b.cell);
  assert.equal(n.face, b.face);
  assert.equal(n.y0, b.level, '缺口从 cut 层起');
  assert.equal(n.y1, 3 + EAVE_SHADOW, '缺口在墙头上压一段（不越过屋顶）');
  assert.equal(n.setback, SKIRT_INSET + EAVE_SETBACK);
  assert.ok(n.setback > b.inset, '檐口要比墙裙挑得更深，否则屋顶压不住墙面');
  assert.equal(n.skirt, true);
}

// ---- 3. 邻格抬到同高：那张面不再露在崖上，墙裙必须消失 ----
const w2 = new World(grid);
for (let lv = 1; lv <= 5; lv++) w2.setSolid(mid, lv, true);
const nb0 = w2.neighbor(mid, 0);
assert.ok(nb0, '中间格的第 0 条边必须有邻居');
for (let lv = 1; lv <= 5; lv++) w2.setSolid(nb0, lv, true);
buryColumn(w2, mid, 3);
buryColumn(w2, nb0, 3);
const sk2 = cliffSkirt(w2);
const shared = sk2.bands.filter((b) => b.cell === mid.id && b.face === 0);
assert.equal(shared.length, 0, '邻格同高时那条面不是崖面，不该有墙裙');
assert.ok(sk2.bands.length >= 6, '其余三面 + 邻格自己的三面仍要有墙裙');
const midFaces = new Set(sk2.bands.filter((b) => b.cell === mid.id).map((b) => b.face));
assert.equal(midFaces.size, mid.n - 1, '中间格只剩 3 张崖面');

// ---- 4. 整栋被埋：没有屋顶悬在头上，崖面上什么都不留 ----
const w3 = new World(grid);
for (let lv = 1; lv <= 3; lv++) w3.setSolid(mid, lv, true);
buryColumn(w3, mid, 4);
assert.equal(w3.topIsBuilt(mid), false);
assert.equal(w3.ground(mid), 4);
const sk3 = cliffSkirt(w3);
assert.equal(sk3.bands.length, 0, '整栋被埋的列不该留墙裙');
assert.equal(sk3.notches.length, 0);
assert.equal(sk3.buriedCells, 1, '台账仍然记得这一列被埋过（只是不留墙裙）');

// ---- 5. 没被刷过地的建筑：一条墙裙都不许有 ----
const w4 = new World(grid);
for (let lv = 1; lv <= 4; lv++) w4.setSolid(mid, lv, true);
assert.equal(cliffSkirt(w4).bands.length, 0, '没掩埋就没有墙裙（不许对全崖撒谎）');
assert.equal(cliffSkirt(new World(grid)).bands.length, 0, '空世界更不该有');

// ---- 6. 网格边界也算崖面（外圈格子没有邻居） ----
const w5 = new World(grid);
const edgeCell = grid.cells.find((c) => c.edgeNeighbors.includes(-1));
assert.ok(edgeCell, '方形网格外圈必有开边');
for (let lv = 1; lv <= 5; lv++) w5.setSolid(edgeCell, lv, true);
buryColumn(w5, edgeCell, 2);
const openFaces = edgeCell.edgeNeighbors.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
const sk5 = cliffSkirt(w5);
for (const f of openFaces) {
  assert.ok(sk5.bands.some((b) => b.cell === edgeCell.id && b.face === f),
    '开边那一面是崖面，必须有墙裙（face ' + f + '）');
}

// ---- 7. 幂等 + skirtSegment 的内缩方向 ----
const again = cliffSkirt(w);
assert.deepEqual(again, sk, '同一份 World 重复求值必须一致');
const cell = mid;
const [a, b2] = skirtSegment(cell, 0, SKIRT_INSET);
const p0 = cell.pts[0], p1 = cell.pts[1];
const along = (a.x - p0.x) * (p1.x - p0.x) + (a.z - p0.z) * (p1.z - p0.z);
assert.ok(along > 0, '内缩必须沿边朝 p1 方向');
const d0 = Math.hypot(a.x - cell.cx, a.z - cell.cz);
const d1 = Math.hypot(p0.x - cell.cx, p0.z - cell.cz);
assert.ok(d0 < d1, '内缩之后离格心更近');
assert.ok(Math.abs((d1 - d0) - SKIRT_INSET) < 1e-9, '内缩量必须正好是 inset');

console.log('terrain-burial-skirt PASS · 墙裙面 ' + sk.bands.length + ' / 檐下缺口 ' + sk.notches.length
  + ' · 邻格同高后中间格剩余崖面 ' + midFaces.size + ' · 整栋被埋墙裙 0 · 开边补 ' + openFaces.length);
