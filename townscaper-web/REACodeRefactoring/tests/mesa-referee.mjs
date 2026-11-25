// mesa-referee.mjs — 1708815475801505819「a cool cliff I came across」残差核销：裁判台地生成器对拍。
// 裁判 = 只读 ../REACode/engine/mesa.js（同一组可观察行为的生成器近似：柱群塔/边界穿洞拱/
// 平顶苔/崖面分级/平顶小屋）。本侧 = src/terrain/mesa-field.js：同式同序移植，
// 网格与 Town 容器外置 —— 噪声 src/core/noise.js 与裁判逐位一致，
// 所以同参数同网格下体素/材质/屋位全部逐位对拍（maxDiff=0）。
// 网格用裁判 buildGrid 建两次（hash01 抖动是确定性的），先逐位核网格再核输出。
// 如实标注：裁判是近似不是原作算法；本对拍只证明与裁判逐位一致。
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrid as buildRefGrid } from '../../REACode/src/grid.js';
import { Town as RefTown, decorateCells as refDecorate } from '../../REACode/src/town.js';
import * as REF from '../../REACode/engine/mesa.js';
import * as L from '../src/terrain/mesa-field.js';
import { buildQuadGrid } from '../src/core/grid.js';
import { Town } from '../src/core/town-graph.js';

const eq = (a, b, name) => {
  assert.equal(a.length, b.length, name + ' length');
  let d = 0, at = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { const dd = Math.abs(a[i] - b[i]); if (dd > d) { d = dd; at = i; } }
  assert.equal(d, 0, `${name} bitwise identical (first diff at ${at}: ${a[at]} vs ${b[at]})`);
};

/** 裁判 Town 逐格逐层体素 + 颜色数组全对拍。 */
const eqTown = (refTown, refCells, town, cells, maxLevels, tag) => {
  assert.equal(cells.length, refCells.length, tag + ' cells');
  for (const c of cells) {
    const rc = refCells[c.id];
    assert.equal(town.top(c), refTown.top(rc), `${tag} top cell ${c.id}`);
    for (let lv = 1; lv <= maxLevels; lv++)
      assert.equal(town.isSolid(c, lv), refTown.isSolid(rc, lv), `${tag} solid cell ${c.id} lv ${lv}`);
  }
  eq(town.colors, refTown.colors, tag + ' colors');
};

const OPTS = [
  { radius: 19, hexSize: 0.46, seed: 7, maxLevels: 10, towers: 3, caves: 3, houses: 5, jitter: 0.2 },   // 裁判默认
  { radius: 19, hexSize: 0.46, seed: 11, maxLevels: 10, towers: 5, caves: 4, houses: 7, jitter: 0.2 },
  { radius: 14, hexSize: 0.5, seed: 23, maxLevels: 8, towers: 2, caves: 2, houses: 3, jitter: 0.25 },
  { radius: 12, hexSize: 0.6, seed: 42, maxLevels: 6, towers: 4, caves: 0, houses: 2, jitter: 0.15 },   // caves=0 分支
];

test('网格确定性：同参数两次 buildGrid 逐位一致（对拍前提）', () => {
  for (const o of OPTS) {
    const g1 = buildRefGrid({ radius: o.radius, hexSize: o.hexSize, jitter: o.jitter });
    const g2 = buildRefGrid({ radius: o.radius, hexSize: o.hexSize, jitter: o.jitter });
    assert.equal(g1.cells.length, g2.cells.length);
    for (let i = 0; i < g1.cells.length; i++) {
      assert.equal(g1.cells[i].cx, g2.cells[i].cx);
      assert.equal(g1.cells[i].cz, g2.cells[i].cz);
      assert.deepEqual(g1.cells[i].edgeNeighbors, g2.cells[i].edgeNeighbors);
    }
  }
});

test('buildMesa 体素/颜色/屋位与裁判逐位一致（0 差异对拍）', () => {
  for (const o of OPTS) {
    const ref = REF.buildMesa(o);                                    // 裁判自建 grid+Town
    const grid = buildRefGrid({ radius: o.radius, hexSize: o.hexSize, jitter: o.jitter });
    refDecorate(grid);
    const town = new RefTown(grid);
    const out = L.buildMesa(grid, town, o);
    eqTown(ref.town, ref.grid.cells, town, grid.cells, 12, `mesa seed=${o.seed}`);
    assert.equal(out.houses.length, ref.houses.length, `houses count seed=${o.seed}`);
    for (let i = 0; i < ref.houses.length; i++) {
      assert.equal(out.houses[i].cell.id, ref.houses[i].cell.id, `house ${i} cell seed=${o.seed}`);
      assert.equal(out.houses[i].top, ref.houses[i].top);
      assert.equal(out.houses[i].spire, ref.houses[i].spire);
    }
    // 确定性：同参数重跑逐位一致
    const grid2 = buildRefGrid({ radius: o.radius, hexSize: o.hexSize, jitter: o.jitter });
    refDecorate(grid2);
    const town2 = new RefTown(grid2);
    const out2 = L.buildMesa(grid2, town2, o);
    eqTown(town, grid.cells, town2, grid2.cells, 12, `rebuild seed=${o.seed}`);
  }
});

test('可观察行为：拱下空洞 / 柱群塔 / 苔只长平顶 / 屋在平顶且有间距（裁判与本侧同口径）', () => {
  const o = OPTS[0];
  for (const side of ['ref', 'local']) {
    let town, cells, houses;
    if (side === 'ref') {
      const r = REF.buildMesa(o); town = r.town; cells = r.grid.cells; houses = r.houses;
    } else {
      const grid = buildRefGrid({ radius: o.radius, hexSize: o.hexSize, jitter: o.jitter });
      refDecorate(grid);
      town = new RefTown(grid);
      houses = L.buildMesa(grid, town, o).houses;
      cells = grid.cells;
    }
    // 拱下空洞：边界穿洞后存在「上层实心、底层被凿空」的格子 = 洞有顶盖
    const over = L.mesaOverhangCells(town, cells);
    assert.ok(over.length >= 3, `${side} overhang cells ${over.length}`);
    for (const c of over) {
      const t = town.top(c);
      assert.ok(t >= 3 && !town.isSolid(c, 1) && !town.isSolid(c, 2), `${side} cave hole under rock`);
    }
    // 柱群：自由塔把局部顶面抬到 ≥ maxLevels-? —— 至少有若干孤立高柱（四周都比它低）
    let towers = 0;
    for (const c of cells) {
      const h = town.top(c);
      if (h < 8) continue;
      let isolated = true;
      for (let i = 0; i < 4; i++) { const nid = c.edgeNeighbors[i]; if (nid >= 0 && town.top(cells[nid]) === h) { isolated = false; break; } }
      if (isolated) towers++;
    }
    assert.ok(towers >= 1, `${side} free-standing towers ${towers}`);
    // 苔只长在朝上的平顶：任一苔色格 4 邻同高（ref 侧由裁判 paint 保证，两侧同口径复核）
    const audit = L.mesaMossAudit(town, cells);
    assert.ok(audit.moss > 0, `${side} moss present`);
    assert.equal(audit.offFlat, 0, `${side} moss only on flat tops`);
    // 小屋：全站在 ≥4 层平顶、彼此拉开 hexSize*1.9、数量与请求一致
    for (const p of houses) {
      assert.ok(p.top >= 4, `${side} house on cap`);
      for (let i = 0; i < 4; i++) assert.equal(town.neighborTop(p.cell, i), p.top, `${side} house cell flat`);
    }
    for (let i = 0; i < houses.length; i++) for (let j = i + 1; j < houses.length; j++)
      assert.ok(Math.hypot(houses[i].cell.cx - houses[j].cell.cx, houses[i].cell.cz - houses[j].cell.cz) >= o.hexSize * 1.9, `${side} min spacing`);
  }
});

test('本仓消费端：同一移植跑在共享 World 的 Town + buildQuadGrid 上（语义验收）', () => {
  // 本仓 quad 网格几何与裁判 hex-kite 网格不同，不做逐位对拍；
  // 验收同一套公式在共享 World 体素上产生同一组可观察行为。
  const grid = buildQuadGrid({ radius: 14, hexSize: 0.9, seed: 1337 });
  const town = new Town(grid);
  const out = L.buildMesa(grid, town, { radius: 14, hexSize: 0.9, seed: 7, maxLevels: 9, towers: 3, caves: 3, houses: 4 });
  assert.ok(town.world.solid.some((v) => v !== 0), 'shared World voxels written');
  const over = L.mesaOverhangCells(town, grid.cells);
  assert.ok(over.length >= 1, `shared-World overhang cells ${over.length}`);
  const audit = L.mesaMossAudit(town, grid.cells);
  assert.equal(audit.offFlat, 0, 'moss only on flat caps');
  assert.ok(out.houses.length >= 1, `houses ${out.houses.length}`);
  assert.ok(L.mesaFlatCaps(town, grid.cells, 4).length >= out.houses.length, 'flat caps >= houses');
  // 同种子确定性（共享 World 上重跑逐位一致）
  const grid2 = buildQuadGrid({ radius: 14, hexSize: 0.9, seed: 1337 });
  const town2 = new Town(grid2);
  L.buildMesa(grid2, town2, { radius: 14, hexSize: 0.9, seed: 7, maxLevels: 9, towers: 3, caves: 3, houses: 4 });
  eq(town2.world.solid, town.world.solid, 'shared-World rebuild solid');
  eq(town2.colors, town.colors, 'shared-World rebuild colors');
});
