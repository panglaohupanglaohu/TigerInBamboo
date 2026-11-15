// 第 53 批 G5 · REACode/src/blobshadow.js（820977247083528192 / 821321422140309504 / 821680056514781186：脚下软圆斑、只贴自己脚下那块地、
// 不甩到下面的低台）。补：光向偏移、坡向椭圆（面积守恒）、跨格连续（同层相邻格拼起来，不再在格边被切半）、逐顶点贴楼梯踏面。
import assert from 'node:assert/strict';
import { makeIsland, Battle, stripWorld } from './fixtures/g5-battle.mjs';
import { unitShadow, shadowArea, measure, LIGHT_DIR } from '../src/core/unit-shadow.js';
// ① 原版指标表
const m = measure();
assert.ok(Math.abs(m.stretch - 1 / Math.cos(26 * Math.PI / 180)) < 1e-12 && Math.abs(m.squash - Math.cos(26 * Math.PI / 180)) < 1e-12);
assert.ok(Math.abs(m.areaRatio - 1) < 1e-9, `坡上拉长×压短面积守恒 ${m.areaRatio}`);
assert.ok(m.rows[0].off === 0 && m.rows[1].off > 0 && m.rows[2].off > m.rows[1].off, '站地不偏、越高越偏');
assert.ok(m.rows[2].alpha < m.rows[1].alpha && m.rows[1].alpha < m.rows[0].alpha && m.rows[2].r > m.rows[0].r);
const off = unitShadow({ x: 0, z: 0, footY: .5, groundY: 0, footprint: [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }], light: LIGHT_DIR });
assert.ok(off.center[0] > 0 && off.center[1] > 0 && Math.abs(Math.atan2(off.center[1], off.center[0]) - Math.atan2(LIGHT_DIR[1], LIGHT_DIR[0])) < 1e-12, '沿主光方向');
// ② 跨格连续：两格同层，单位站在共享边上
const A = [{ x: -1, z: -.5 }, { x: 0, z: -.5 }, { x: 0, z: .5 }, { x: -1, z: .5 }], B = [{ x: 0, z: -.5 }, { x: 1, z: -.5 }, { x: 1, z: .5 }, { x: 0, z: .5 }];
const one = unitShadow({ x: 0, z: 0, footY: 0, groundY: 0, footprint: A, segments: 64 }), both = unitShadow({ x: 0, z: 0, footY: 0, groundY: 0, footprints: [A, B], segments: 64 });
const disc = shadowArea(unitShadow({ x: -.5, z: 0, footY: 0, groundY: 0, footprint: A, segments: 64 }));
assert.ok(Math.abs(shadowArea(one) / disc - .5) < .01, '只裁自己格：格边上被切掉一半');
assert.ok(Math.abs(shadowArea(both) / disc - 1) < 1e-9 && both.pieces === 2, '两格拼起来：完整的盘');
// ③ 真实 Battle：开阴影，派人上楼梯；双网格
const report = {};
for (const kind of ['quad', 'mixed']) {
  const { world, view } = makeIsland(kind, 7);
  const b = new Battle(view); b.start(world); b.nextWave = 1e9; b.unitShadows.enabled = true;
  const nav = b.navigation; nav.refresh();
  for (const sq of b.squads) { const lead = sq.members[0], here = nav.unitNode(lead); let best = null; for (const n of nav.graph.nodes) { if (n.floor === here.floor || n.floor !== world.top(n.cell)) continue; const p = nav.plan(lead, n.cell, n.floor); if (p && (!best || p.distance > best.d)) best = { n, d: p.distance }; } sq.goal = best.n.cell; sq.goalFloor = best.n.floor; }
  let multi = 0, stairs = 0, checked = 0, stairChecked = 0;
  for (let i = 0; i < 600; i++) {
    b.update(1 / 30); multi += b.unitShadows.stats.multiCell; stairs += b.unitShadows.stats.onStairs;
    if (i % 30 === 0) {   // 抽查每个人的影子：平地上整块在本层水平面（不甩到低台）；楼梯上在上下两层之间、沿坡单调
      const P = b.unitShadows.geometry.attributes.position.array;
      for (const r of b.unitShadows.ranges) {
        const ys = []; for (let k = r.start; k < r.start + r.count; k++) ys.push(P[k * 3 + 1]);
        if (!r.stair) assert.ok(ys.every((y) => Math.abs(y - (r.floor * .5 + .008)) < 1e-6), '平地：整块影子在本层');
        else { assert.ok(ys.every((y) => y >= r.floor * .5 + .008 - 1e-6 && y <= (r.floor + 2) * .5 + .008 + 1e-6), '楼梯：夹在上下层之间'); stairChecked++; }
        checked++;
      }
    }
  }
  assert.ok(multi > 0, `${kind}: 跨格拼接发生过 ${multi}`);
  assert.ok(stairs > 0, `${kind}: 楼梯上的人影子沿坡拉长 ${stairs}`);
  report[kind] = { multiCellUnitFrames: multi, stairUnitFrames: stairs, checkedShadows: checked, stairShadows: stairChecked };
}
console.log('PASS 原版指标表（偏移/浓度/半径、坡向拉长压短面积守恒）、跨格拼接完整盘、真实 Battle 阴影跨格 + 楼梯贴平均坡面 + 平地不甩到低台', JSON.stringify(report));
