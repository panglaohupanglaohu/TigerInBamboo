// 1768627849529893109「put this on a sphere」残差：球面 World 的网格生成/编辑/保存恢复。
// 验收口径（队列 acceptance「相同输入比较平面/球面模块身份、接缝、岸线与重建；球面编辑与
// 保存恢复分别验收」）：
//   · 网格生成：真 cell 拓扑（共享角点 + edgeNeighbors/edgeTwins）不是姿态摆放；
//     球面角点逐位一致（接缝闭合）、全部落在球面半径上、确定性可复现；
//   · 编辑：球面 3D 点 → 落格 → 加点/删点/改层与平面 applyAt 同语义，编辑后邻接不变；
//   · 保存恢复：encode → decode 进同规格 World 后体素逐位相等、再编码逐字相等；
//     版本/mode/网格/patch 指纹不一致与坏串都拒绝且不动活数据。
// 纯 Node 单测（浏览器红线，本批不跑页面）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL } from '../src/core/world.js';
import {
  makeSpherePatch, mapPoint,
} from '../src/sphere/world-sphere.js';
import {
  makeSphereWorld, buildSphereWorld, sphereGrid,
  spherePick, sphereApply, sphereEdit,
  encodeSphereWorld, decodeSphereWorld, SPHERE_GRID_KINDS,
} from '../src/sphere/sphere-world.js';

const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('网格生成：真邻接拓扑 + 球面角点接缝闭合 + 全格落球 + 确定性', () => {
  const patch = makeSpherePatch({ R: 60, up: norm([0.2, 1, -0.3]) });
  for (const kind of SPHERE_GRID_KINDS) {
    const radius = kind === 'hex' ? 4 : 5;
    const ctx = makeSphereWorld(patch, { kind, radius, cellSize: 0.8, seed: 7 });
    const g = ctx.grid;
    assert.ok(g.cells.length > 10, `${kind} cells`);
    // 真 cell 拓扑：每条半边在邻居里有 twin 回指，边端点是同一顶点对象
    let edges = 0;
    for (const c of g.cells) for (let i = 0; i < c.n; i++) {
      const nb = c.edgeNeighbors[i];
      if (nb < 0) continue;
      edges++;
      const t = c.edgeTwins[i];
      const twin = g.cells[nb];
      assert.equal(twin.edgeNeighbors[t], c.id, `${kind} twin back-ref`);
      assert.equal(twin.edgeTwins[t], i, `${kind} twin slot`);
      // 同一条边：c.pts[i]→c.pts[i+1] 对 twin.pts[t+1]→twin.pts[t]（共享顶点对象）
      assert.equal(twin.pts[t], c.pts[(i + 1) % c.n], `${kind} shared corner object`);
      assert.equal(twin.pts[(t + 1) % twin.n], c.pts[i], `${kind} shared corner object`);
      // 贴球后逐位相同（接缝按构造闭合）
      assert.deepEqual(twin.pts3[t], c.pts3[(i + 1) % c.n], `${kind} seam corner`);
      assert.deepEqual(twin.pts3[(t + 1) % twin.n], c.pts3[i], `${kind} seam corner`);
    }
    assert.ok(edges > g.cells.length, `${kind} interior edges`);
    // 全部角点严格在球面半径上（'sphere' 模式 y=0）
    for (const c of g.cells) {
      assert.ok(close(len(c.pos), 60, 1e-9));
      for (const p of c.pts3) assert.ok(close(len(p), 60, 1e-9));
      assert.ok(c.inRange, `${kind} small patch fully in range`);
    }
    assert.equal(g.coverage.inRange, g.coverage.total);
    // 确定性：同参数再生成一遍逐位一致
    const again = sphereGrid(patch, { kind, radius, cellSize: 0.8, seed: 7 });
    assert.deepEqual(again.cells.map((c) => c.pts3), g.cells.map((c) => c.pts3));
    assert.deepEqual(again.cells.map((c) => c.edgeNeighbors), g.cells.map((c) => c.edgeNeighbors));
  }
  // 'bend' 模式也通：角点在抛物面上（y + d²/2R = 0 于锚点局部系）
  const ctx = makeSphereWorld(patch, { kind: 'square', radius: 4, cellSize: 1, mode: 'bend' });
  for (const c of ctx.grid.cells) for (const p of c.pts3) {
    const rel = [p[0] - patch.anchor[0], p[1] - patch.anchor[1], p[2] - patch.anchor[2]];
    const lx = rel[0] * patch.e1[0] + rel[1] * patch.e1[1] + rel[2] * patch.e1[2];
    const ly = rel[0] * patch.up[0] + rel[1] * patch.up[1] + rel[2] * patch.up[2];
    const lz = rel[0] * patch.e2[0] + rel[1] * patch.e2[1] + rel[2] * patch.e2[2];
    assert.ok(close(ly + (lx * lx + lz * lz) / (2 * 60), 0, 1e-9), 'on paraboloid');
  }
  assert.throws(() => sphereGrid(patch, { kind: 'bogus' }), RangeError);
});

test('球面编辑：加点/删点/改层经球面坐标落到同一 cell，邻接拓扑不变', () => {
  const patch = makeSpherePatch({ R: 80 });
  const ctx = makeSphereWorld(patch, { kind: 'square', radius: 5, cellSize: 1 });
  const { world } = ctx;
  // 锚点附近 (0.2, 0.3) 海平面点 → 落格
  const hit = spherePick(ctx, mapPoint(patch, 0.2, 0.3));
  assert.ok(hit?.cell, 'pick lands on a cell');
  assert.equal(hit.level, 1);
  const cell = hit.cell;
  const nbBefore = cell.edgeNeighbors.slice();
  // 加点：空柱点 lv1 → 填 lv1
  assert.equal(sphereApply(ctx, hit, 'build').changed, true);
  assert.equal(world.top(cell), 1);
  // 再点 y=1.5（第 2 层面）→ 叠 lv2
  const r2 = sphereEdit(ctx, mapPoint(patch, 0.2, 0.3, { y: 1.5 }), 'build');
  assert.equal(r2.changed, true);
  assert.equal(world.top(cell), 2);
  // 改层：整列填到 4 层
  assert.equal(sphereApply(ctx, spherePick(ctx, mapPoint(patch, 0.2, 0.3)), 'level', { level: 4 }).changed, true);
  assert.equal(world.top(cell), 4);
  // 地形抬升 → rock 层
  assert.equal(sphereApply(ctx, spherePick(ctx, mapPoint(patch, 0.2, 0.3)), 'raise').changed, true);
  assert.equal(world.top(cell), 5);
  assert.ok(world.isRock(cell, 5));
  // 下挖 → 回 4
  assert.equal(sphereApply(ctx, spherePick(ctx, mapPoint(patch, 0.2, 0.3)), 'dig').changed, true);
  assert.equal(world.top(cell), 4);
  // 删点：点 lv2（实心）→ 只扣 lv2，lv3/lv4 悬空保留（与平面 erase 同语义）
  const er = sphereEdit(ctx, mapPoint(patch, 0.2, 0.3, { y: 1.5 }), 'erase');
  assert.equal(er.target, 2);
  assert.ok(!world.isSolid(cell, 2) && world.isSolid(cell, 3));
  // 点空层（柱顶之上）erase → 扣柱顶
  const er2 = sphereEdit(ctx, mapPoint(patch, 0.2, 0.3, { y: 7.5 }), 'erase');
  assert.equal(er2.target, 4);
  assert.equal(world.top(cell), 3);
  // 换色
  assert.equal(sphereApply(ctx, spherePick(ctx, mapPoint(patch, 0.2, 0.3)), 'paint', { color: 5 }).changed, true);
  assert.equal(world.color[cell.id], 5);
  // 点空处（贴片外）→ null，什么都不动
  const far = mapPoint(patch, 200, 200);
  assert.equal(spherePick(ctx, far), null);
  assert.equal(sphereEdit(ctx, far, 'build'), null);
  // 编辑后邻接拓扑逐位不变（拓扑静态、体素可变）
  assert.deepEqual(cell.edgeNeighbors, nbBefore);
  for (const c of ctx.grid.cells) for (let i = 0; i < c.n; i++) {
    const nb = c.edgeNeighbors[i];
    if (nb < 0) continue;
    assert.equal(ctx.grid.cells[nb].edgeNeighbors[c.edgeTwins[i]], c.id, 'adjacency intact after edits');
  }
});

test('保存恢复：encode → decode 体素逐位相等、再编码逐字相等', () => {
  const patch = makeSpherePatch({ R: 70, up: norm([0.1, 1, 0.2]) });
  const spec = { kind: 'mixed', radius: 4, cellSize: 0.7, seed: 42 };
  const a = makeSphereWorld(patch, spec);
  // 混合体素状态：地形/建筑/颜色/河道/悬空层
  for (const c of a.grid.cells) {
    const h = c.id % 6;
    a.world.fill(c, h, { rock: c.id % 2 === 0 });
    if (c.id % 3 === 0) a.world.color[c.id] = c.id % 9;
  }
  a.world.setSolid(a.grid.cells[3], 8, true);          // 悬空块（erase 留洞的那种）
  a.world.river[5] = 1;
  const s = encodeSphereWorld(a);
  const b = makeSphereWorld(patch, spec);
  assert.equal(decodeSphereWorld(s, b), b.spec);
  for (const f of ['solid', 'rock', 'color', 'river']) {
    assert.deepEqual([...b.world[f]], [...a.world[f]], f);
  }
  assert.equal(encodeSphereWorld(b), s, 're-encode identical');
  // 恢复后继续编辑一致（存档不是终态）
  const pos = mapPoint(patch, 0.5, -0.5);
  assert.equal(sphereEdit(b, pos, 'build')?.changed !== null, true);
});

test('保存恢复：坏串与规格/patch 不一致都拒绝，活数据不动', () => {
  const patch = makeSpherePatch({ R: 70 });
  const spec = { kind: 'square', radius: 4, cellSize: 1, seed: 1 };
  const a = makeSphereWorld(patch, spec);
  a.world.fill(a.grid.cells[0], 3, { rock: true });
  const s = encodeSphereWorld(a);
  // 不同 patch 指纹
  const other = makeSphereWorld(makeSpherePatch({ R: 71 }), spec);
  assert.throws(() => decodeSphereWorld(s, other), /球面贴片不一致/);
  assert.equal(other.world.top(other.grid.cells[0]), 0, 'rejected save did not touch live state');
  // 不同网格参数
  for (const s2 of [
    { kind: 'hex', radius: 4, cellSize: 1, seed: 1 },
    { kind: 'square', radius: 5, cellSize: 1, seed: 1 },
    { kind: 'square', radius: 4, cellSize: 1.5, seed: 1 },
    { kind: 'square', radius: 4, cellSize: 1, seed: 2 },
  ]) {
    assert.throws(() => decodeSphereWorld(s, makeSphereWorld(patch, s2)), /不一致/);
  }
  // 不同 mode
  const bend = makeSphereWorld(patch, { ...spec, mode: 'bend' });
  assert.throws(() => decodeSphereWorld(s, bend), /贴球模式不一致/);
  // 截断 / 未知字符 / 尾巴数据
  assert.throws(() => decodeSphereWorld(s.slice(0, 5), a), /被截断/);
  assert.throws(() => decodeSphereWorld(s + '!', a), /未知字符/);
  assert.throws(() => decodeSphereWorld(s + 'Z', a), /多余数据|被截断/);
  // 版本位不对
  assert.throws(() => decodeSphereWorld('f' + s.slice(1), a), /版本不对|被截断|不一致/);
});

test('buildSphereWorld 便捷入口 + 边界不炸', () => {
  const ctx = buildSphereWorld({ R: 45, up: [0.3, 1, -0.2] }, { kind: 'quad', radius: 4, cellSize: 0.9, seed: 3 });
  assert.ok(ctx.patch.anchor.every(Number.isFinite));
  assert.ok(ctx.grid.cells.length > 0);
  // 对蹠方向拾取 → null（不抛错）
  assert.equal(spherePick(ctx, ctx.patch.up.map((v) => -v * 45)), null);
  assert.throws(() => buildSphereWorld({ R: -1 }), RangeError);
  assert.throws(() => sphereApply(ctx, spherePick(ctx, mapPoint(ctx.patch, 0, 0)), 'bogus'), RangeError);
});
