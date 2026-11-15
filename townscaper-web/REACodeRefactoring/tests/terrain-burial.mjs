// 1671840905957978113：抬地形吞掉建筑。
// 判据：不超过新地面的建筑层被换成岩石、其上的层保留；全埋时整列不再是"建筑顶"；
// 报告能分出「只露屋顶」和「整栋被埋」；邻格台地高度差算得出来；World.fill 的整列覆盖不会抹掉屋顶。
import assert from 'node:assert/strict';
import { World } from '../src/core/world.js';
import { buildSquareGrid } from '../src/core/grid.js';
import { buryColumn, raiseGround, burialReport, burialDepth, neighborShade } from '../src/core/terrain-burial.js';

const grid = buildSquareGrid({ radius: 3, cellSize: 1 });
const world = new World(grid);
const c = grid.cells[Math.floor(grid.cells.length / 2)];
const nb = (cell, i) => world.neighbor(cell, i);

// 1. 一栋 5 层的房子：1..5 层都是建筑
for (let lv = 1; lv <= 5; lv++) world.setSolid(c, lv, true);
assert.equal(world.top(c), 5);
assert.equal(world.ground(c), 0);
assert.ok(world.topIsBuilt(c), '地面为 0 时顶上当然是建筑');

// 2. 地面抬到 3：1..3 被吞、4..5 保留
const r1 = buryColumn(world, c, 3);
assert.deepEqual(r1.swallowed, [1, 2, 3]);
assert.deepEqual(r1.kept, [4, 5]);
assert.equal(world.ground(c), 3, '地面高度必须正好是 3');
assert.equal(world.top(c), 5, '屋顶不能被抹掉');
assert.ok(world.isRock(c, 1) && world.isRock(c, 2) && world.isRock(c, 3), '吞掉的层必须是岩石');
assert.ok(world.isBuilt(c, 4) && world.isBuilt(c, 5), '保留下来的层必须还是建筑');
assert.equal(burialDepth(world, c), 3, '被吞了 3 层');
assert.equal(world.topIsBuilt(c), true);

// 3. 再抬到 5：整栋被埋，顶上不再是建筑
const r2 = buryColumn(world, c, 5);
assert.deepEqual(r2.swallowed, [4, 5]);
assert.deepEqual(r2.kept, []);
assert.equal(world.topIsBuilt(c), false, '全埋之后这一格顶上应该是裸露的地形');
assert.equal(burialDepth(world, c), 0, '整栋被埋之后没有建筑顶可切，切深记 0');
assert.equal(world.top(c), 5);
assert.equal(world.ground(c), 5);

// 4. 重复调用幂等：同一高度再抬一次不改变任何层
const before = { solid: world.solid[c.id], rock: world.rock[c.id] };
buryColumn(world, c, 5);
assert.equal(world.solid[c.id], before.solid);
assert.equal(world.rock[c.id], before.rock);

// 5. "只露屋顶"：隔壁抬到 4，本格地面 1、房子 1..5 → 露 4 层屋顶，且被邻格遮挡 3 层
const w2 = new World(grid);
const house = grid.cells[0];
const upslope = nb(house, 0) || grid.cells[1];
for (let lv = 1; lv <= 5; lv++) w2.setSolid(house, lv, true);
buryColumn(w2, house, 1);
buryColumn(w2, upslope, 4);
assert.equal(burialDepth(w2, house), 1);
assert.equal(neighborShade(w2, house) >= 3, true, '邻格台地必须比本格高 3 层以上');
const rep = burialReport(w2);
assert.ok(rep.peeking >= 1, '必须数出「只露屋顶」的柱子');
assert.ok(rep.swallowedLevels >= 1, '必须数出被吞的层数');
assert.equal(rep.columns.every((col) => Number.isFinite(col.ground) && Number.isFinite(col.top)), true);

// 6. 批量抬地面：一次性刷一片，屋顶全在
const w3 = new World(grid);
const patch = grid.cells.slice(0, 9);
for (const cell of patch) for (let lv = 1; lv <= 4; lv++) w3.setSolid(cell, lv, true);
const batch = raiseGround(w3, patch.map((cell) => ({ cell, height: 2 })));
assert.equal(batch.length, patch.length);
for (const cell of patch) {
  assert.equal(w3.ground(cell), 2);
  assert.equal(w3.top(cell), 4, '屋顶必须还在');
  assert.equal(burialDepth(w3, cell), 2);
}

// 7. 全埋的情形：报告里的 blanketed 必须涨
const w4 = new World(grid);
for (const cell of patch) for (let lv = 1; lv <= 2; lv++) w4.setSolid(cell, lv, true);
raiseGround(w4, patch.map((cell) => ({ cell, height: 4 })));
const rep4 = burialReport(w4);
assert.equal(rep4.columns.filter((col) => col.built > 0).length, 0, '全埋之后没有哪一列的顶上是建筑');
assert.equal(w4.topIsBuilt(patch[0]), false);
assert.equal(rep4.ceiling, 4);

// 8. 参数卫生
assert.throws(() => buryColumn(world, null, 3), /cell/);
assert.throws(() => raiseGround(world, [{ height: 1 }]), /cell/);

console.log("terrain-burial PASS · 抬地面吞建筑：屋顶保留、地面以下的层换成岩石");
