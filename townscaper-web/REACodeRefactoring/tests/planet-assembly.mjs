import assert from 'node:assert/strict';
import { buildSphere, buildPlanet, cornerPositions, planetMesh, assemblyOrder, assemblySlice } from '../src/sphere/planet.js';

// 784847933686575104 / 784847588893814785：球壳从一小片沿前沿铺满整球。
// 这里只验装配顺序的连通性 / 确定性 / 与前缀网格的一致性，不验原作的美术表现。
for (const n of [180, 300]) {
  const planet = buildPlanet(buildSphere({ n, spacing: 4, relax: 4 }), { R: 2.2, L: 0.36 });
  const land = planet.cells.filter((c) => planet.H[c.id] > 0).map((c) => c.id);
  const order = assemblyOrder(planet, { mode: 'frontier', seed: 7 });
  assert.equal(order.length, land.length, '装配序列必须覆盖所有陆地格');
  assert.equal(new Set(order).size, order.length, '装配序列不许重复');
  assert.ok(order.every((id) => planet.H[id] > 0), '海面格不进装配序列');

  // 前沿生长：每一格（除新岛起点）都必须已有邻居在序列里；
  // 起点数必须正好等于陆地连通块数，多一个就说明算法在乱序铺
  const comp = new Map();
  for (const id of land) {
    if (comp.has(id)) continue;
    const stack = [id], cid = id;
    comp.set(id, cid);
    while (stack.length) for (const nb of planet.cells[stack.pop()].nb) if (nb >= 0 && planet.H[nb] > 0 && !comp.has(nb)) { comp.set(nb, cid); stack.push(nb); }
  }
  const components = new Set(comp.values()).size;
  const seen = new Set([order[0]]);
  const starts = [order[0]];
  for (let i = 1; i < order.length; i++) {
    const id = order[i];
    const touches = planet.cells[id].nb.some((nb) => nb >= 0 && seen.has(nb));
    if (!touches) starts.push(id);
    else assert.ok(touches, '每一格必须接已出现的前沿');
    seen.add(id);
  }
  assert.equal(starts.length, components, `新岛起点数 ${starts.length} 应等于陆地连通块数 ${components}`);

  // 确定性：同种子同序、异种子异序
  assert.deepEqual(assemblyOrder(planet, { mode: 'frontier', seed: 7 }), order);
  assert.notDeepEqual(assemblyOrder(planet, { mode: 'frontier', seed: 99 }), order);
  assert.notDeepEqual(assemblyOrder(planet, { mode: 'shuffle', seed: 7 }), order);

  // r216 起点可指定：任意陆地格作 root → 它必须是序列第一格，且仍覆盖全部陆地（784847933686575104 残差核销）
  for (const root of [land[0], land[land.length >> 1], land[land.length - 1]]) {
    const routed = assemblyOrder(planet, { mode: 'frontier', seed: 7, root });
    assert.equal(routed[0], root, '指定起点必须是装配序列第一格');
    assert.equal(new Set(routed).size, land.length, '指定起点仍铺满全部陆地');
  }
  const byHeight = assemblyOrder(planet, { mode: 'height', seed: 7 });
  for (let i = 1; i < byHeight.length; i++) assert.ok(planet.H[byHeight[i]] >= planet.H[byHeight[i - 1]], 'height 模式按层升序');

  // 前缀网格：空 → 半程 → 全量。顶点数在前 3/4 段单调增长；
  // 最后一段会回落——前沿那些"一路落到 0 层"的断口侧壁在被填满后消失，这是装配本身的行为，不是错。
  const at = cornerPositions(planet, { relax: true });
  const full = planetMesh(planet, at);
  const counts = [];
  for (const t of [0, 0.05, 0.25, 0.5, 0.75, 1]) {
    const only = assemblySlice(planet, order, t);
    const m = planetMesh(planet, at, { only });
    assert.ok(m.position.every(Number.isFinite) && m.normal.length === m.position.length, '网格数值必须是有限值');
    counts.push({ t, cells: only.size, verts: m.position.length / 3 });
  }
  for (let i = 1; i < counts.length - 1; i++) assert.ok(counts[i].verts > counts[i - 1].verts, '装配中顶点数随进度增长');
  assert.equal(counts[0].verts, 0, '装配 0 不出任何面');
  assert.ok(counts.at(-1).verts < counts.at(-2).verts, '铺满后断口侧壁消失，顶点数回落');
  assert.deepEqual(planetMesh(planet, at, { only: new Set(order) }), full, '全量前缀必须与整球网格逐值相同');
  assert.equal(counts.at(-1).verts, full.position.length / 3);

  // 前沿断口：只放一格时，它的侧壁必须一路落到 0 层（半径 = R），片子里的断口就是这样
  const one = planetMesh(planet, at, { only: new Set([order[0]]) });
  const radii = [];
  for (let i = 0; i < one.position.length; i += 3) radii.push(Math.hypot(one.position[i], one.position[i + 1], one.position[i + 2]));
  const h0 = planet.H[order[0]];
  assert.ok(Math.abs(Math.min(...radii) - planet.R) < 1e-9, '断口侧壁落到海平面高度');
  assert.ok(Math.abs(Math.max(...radii) - (planet.R + h0 * planet.L)) < 1e-9, '顶面停在本身层高');

  // 参数校验
  for (const bad of [{ mode: 'x' }, { seed: NaN }, { root: -1 }, { root: 999999 }]) assert.throws(() => assemblyOrder(planet, bad));
  assert.throws(() => assemblySlice(planet, order, 1.5));
  assert.throws(() => assemblySlice(planet, [0.5], 0.5));
  assert.throws(() => planetMesh(planet, at, { only: [planet.cells.length] }));
  console.log({ n, land: land.length, heights: Math.max(...planet.H), counts, starts: starts.length });
}

// 断口侧壁最小用例：两格同高，只放其中一格时四条边都必须落到 0 层；两格都放时不该有墙。
{
  const R = 2, L = 0.5, H = [3, 3];
  const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]];
  const planet = {
    R, L, H,
    cells: [
      { id: 0, c: dirs[0], ring: [0, 1, 2], nb: [1, 1, 1] },
      { id: 1, c: dirs[3], ring: [3, 4, 5], nb: [0, 0, 0] },
    ],
    corners: dirs,
  };
  const at = (k, l) => dirs[k].map((x) => x * (R + l * L));
  const solid = planetMesh(planet, at);
  const cut = planetMesh(planet, at, { only: new Set([0]) });
  const rmax = (m) => m.position.reduce((a, _, i, arr) => (i % 3 ? a : Math.max(a, Math.hypot(arr[i], arr[i + 1], arr[i + 2]))), 0);
  const rmin = (m) => m.position.reduce((a, _, i, arr) => (i % 3 ? a : Math.min(a, Math.hypot(arr[i], arr[i + 1], arr[i + 2]))), Infinity);
  assert.ok(rmin(solid) > R + 1e-6, '同高相邻格之间没有墙（最低点仍在海平面之上）');
  assert.ok(Math.abs(rmax(solid) - (R + 3 * L)) < 1e-9, '顶面在原层');
  assert.ok(Math.abs(rmin(cut) - R) < 1e-9, '被隐藏的邻居 → 侧壁落到海平面');
  assert.ok(Math.abs(rmax(cut) - (R + 3 * L)) < 1e-9, '断口格顶面仍在原层');
  assert.ok(cut.position.length > solid.position.length, '断口侧壁让面数变多');
  console.log({ cutVerts: cut.position.length / 3, solidVerts: solid.position.length / 3, cutMin: rmin(cut), solidMin: rmin(solid) });
}
console.log('PASS assembly order is contiguous, deterministic, covers land, prefixes grow, full slice equals whole mesh, cut edge drops to sea level');
