// 第 54 轮 · 886199305522085890：原片里通道点绕过屋檐就看不见了（建筑会挡）。
// 原来 heightRaster 只有地形顶面，房子根本没进栅格，所以挑檐后的点一直亮着、只有山脊能挡住它。
// 这里只验纯逻辑：roofs 能把某几格的顶面抬到实际屋顶高度，视线判定随之把它后面的点压下去。
import assert from 'node:assert/strict';
import { heightRaster, rasterAt, sightFade } from '../src/world/traffic.js';

const L = 0.5;
const cell = (id, cx, cz, top) => ({
  id, cx, cz, top, n: 4,
  pts: [{ x: cx - .5, z: cz - .5 }, { x: cx + .5, z: cz - .5 }, { x: cx + .5, z: cz + .5 }, { x: cx - .5, z: cz + .5 }],
});
// 平地 1 层，中间 x=4.5 那一格上压一栋房子（屋顶 3 层）
const cells = [];
for (let j = 0; j < 3; j++) for (let i = 0; i < 8; i++) cells.push(cell(j * 8 + i, i + .5, j + .5, 1));
const world = { cells, top: (c) => c.top };
const house = cells.find((c) => c.cx === 4.5 && c.cz === 1.5);
const roofs = [{ cell: house, y: 3 * L }];

const plain = heightRaster(world, { res: .1, levelHeight: L });
const withRoof = heightRaster(world, { res: .1, levelHeight: L, roofs });
assert.equal(rasterAt(plain, 4.5, 1.5), 1 * L, '不传 roofs 时房子不进栅格');
assert.equal(rasterAt(withRoof, 4.5, 1.5), 3 * L, 'roofs 把该格抬到屋顶高度');
assert.equal(rasterAt(withRoof, 2.5, 1.5), 1 * L, '没房子的格不受影响');

// 低机位、从 +x 侧平视：房子后面的点应该被屋顶压暗，没有屋顶时则完好。
const cam = { x: 8, y: 0.9, z: 1.5 };
const behind = { x: 2.0, y: 1 * L + .035, z: 1.5 };
const fPlain = sightFade(plain, cam, behind), fRoof = sightFade(withRoof, cam, behind);
assert.equal(fPlain, 1, '没有屋顶栅格时点全亮，got ' + fPlain);
assert.equal(fRoof, 0, '屋檐后的点应完全淡出，got ' + fRoof);

// 屋顶上方的点不能被自己那栋房子挡住（只看格顶，不看体积）。
const above = { x: 4.5, y: 3 * L + .04, z: 1.5 };
assert.equal(sightFade(withRoof, { x: 8, y: 2.6, z: 1.5 }, above), 1, '屋顶上的点可见');

console.log(JSON.stringify({ plain: rasterAt(plain, 4.5, 1.5), roof: rasterAt(withRoof, 4.5, 1.5), fPlain, fRoof }, null, 2));
console.log('PASS passage dots occluded by roofs');
