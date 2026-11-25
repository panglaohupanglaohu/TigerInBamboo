// bn-island-referee.mjs — 1579474420749725696「I'm back on the island generation」残差核销：裁判岛生成器对拍。
// 裁判 = 只读 ../REACode/engine/islands.js（Bad North 那一半引擎：高度场→台地量化→材质→可走→A*→几何）。
// 本侧 = src/terrain/bn-island-field.js：同式同序移植 + placeIslandHouses（裁判 mesa.js 平顶小屋规则的
// 同款实现）。噪声依赖 src/core/noise.js 与裁判 engine/noise.js 逐位一致，所以全部输出可逐位对拍。
// 「两组岛」= 同参数两个种子各跑一次：确定性重建、两组互不相同（片中 218 帧重置再生）。
import assert from 'node:assert/strict';
import test from 'node:test';
const REF = await import('../../REACode/engine/islands.js');
const L = await import('../src/terrain/bn-island-field.js');

const eq = (a, b, name) => {
  assert.equal(a.length, b.length, name + ' length');
  let d = 0, at = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { const dd = Math.abs(a[i] - b[i]); if (dd > d) { d = dd; at = i; } }
  assert.equal(d, 0, `${name} bitwise identical (first diff at ${at}: ${a[at]} vs ${b[at]})`);
};

const OPTS = [
  { size: 96, seed: 7, terraces: 7, roughness: 0.22, coast: 0.72 },   // engine/demo.html 的实参
  { size: 96, seed: 11, terraces: 7, roughness: 0.22, coast: 0.72 },
  { size: 96, seed: 23, terraces: 7, roughness: 0.22, coast: 0.72 },
  { size: 48, seed: 42, terraces: 5, roughness: 0.55, coast: 0.78 },  // 默认档
  { size: 24, seed: 3, terraces: 4, roughness: 0.9, coast: 0.6, waterLevel: 0.3 },
];

test('buildIsland 高度场/材质/坡度/可走格与裁判逐位一致', () => {
  for (const o of OPTS) {
    const r = REF.buildIsland(o), s = L.buildIsland(o);
    assert.equal(s.n, r.n); assert.equal(s.seed, r.seed); assert.equal(s.waterLevel, r.waterLevel);
    eq(s.h, r.h, `h seed=${o.seed}`);
    eq(s.mat, r.mat, `mat seed=${o.seed}`);
    eq(s.slope, r.slope, `slope seed=${o.seed}`);
    eq(s.walkable, r.walkable, `walkable seed=${o.seed}`);
    assert.equal(s.stats.walkableCount, r.stats.walkableCount);
    // 材质分类实际覆盖了片中的层：海/滩/草/草顶（高种种子还有岩面）
    const mats = new Set(s.mat);
    for (const m of [L.MATERIAL.SEA, L.MATERIAL.SAND, L.MATERIAL.GRASS, L.MATERIAL.GRASS_TOP]) assert.ok(mats.has(m), `seed ${o.seed} material ${m}`);
  }
});

test('两组岛：同参数两个种子确定性重建且互不相同（片中重置再生）', () => {
  const a1 = L.buildIsland({ size: 96, seed: 7, terraces: 7, roughness: 0.22, coast: 0.72 });
  const a2 = L.buildIsland({ size: 96, seed: 7, terraces: 7, roughness: 0.22, coast: 0.72 });
  const b = L.buildIsland({ size: 96, seed: 11, terraces: 7, roughness: 0.22, coast: 0.72 });
  eq(a1.h, a2.h, 'same seed rebuild'); eq(a1.mat, a2.mat, 'same seed mat');
  let diff = 0, land = 0;
  for (let i = 0; i < a1.h.length; i++) if (a1.h[i] > 0.02 || b.h[i] > 0.02) { land++; if (a1.h[i] !== b.h[i]) diff++; }
  assert.ok(land > 0 && diff > land * 0.8, `two seeds -> two islands, ${diff}/${land} land cells differ`);
});

test('findPath 8 向 A* 与裁判逐格一致（可达/不可达同口径）', () => {
  for (const o of OPTS.slice(0, 4)) {
    const r = REF.buildIsland(o);
    const { n, walkable } = r;
    const ws = [];
    for (let k = 0; k < n * n; k++) if (walkable[k]) ws.push([k % n, (k / n) | 0]);
    // 取可走格里最远的一对（决定论）：曼哈顿距离最大
    let best = [ws[0], ws[0]], bd = -1;
    for (let i = 0; i < ws.length; i += 37) for (let j = 0; j < ws.length; j += 53) {
      const d = Math.abs(ws[i][0] - ws[j][0]) + Math.abs(ws[i][1] - ws[j][1]);
      if (d > bd) { bd = d; best = [ws[i], ws[j]]; }
    }
    const pr = REF.findPath(r, best[0], best[1]);
    const ps = L.findPath(L.buildIsland(o), best[0], best[1]);
    assert.deepEqual(ps, pr, `path seed=${o.seed}`);
    assert.ok(pr.length > 1, 'path crosses the island');
    // 不可达：海格 → []
    const sea = [];
    for (let k = 0; k < n * n; k++) if (!walkable[k]) sea.push([k % n, (k / n) | 0]);
    assert.deepEqual(L.findPath(L.buildIsland(o), sea[0], best[0]), REF.findPath(r, sea[0], best[0]));
    assert.deepEqual(L.findPath(L.buildIsland(o), sea[0], best[0]), []);
  }
});

test('buildIslandGeometry 顶面+崖裙几何与裁判逐位一致', () => {
  for (const o of OPTS) {
    const fr = REF.buildIsland(o), fs = L.buildIsland(o);
    for (const g of [{ cell: 0.3, heightScale: 0.95 }, {}]) {   // demo.html 实参 + 默认
      const gr = REF.buildIslandGeometry(fr, g), gs = L.buildIslandGeometry(fs, g);
      eq(gs.pos, gr.pos, `geo pos seed=${o.seed}`);
      eq(gs.col, gr.col, `geo col seed=${o.seed}`);
      assert.ok(gs.pos.length > 0 && gs.pos.length === gs.col.length, 'pos/col pair');
      // 崖裙存在：顶点 y 不全相同（落下崖面写入低邻居高度）
      const ys = new Set(); for (let i = 1; i < gs.pos.length; i += 3) ys.add(gs.pos[i]);
      assert.ok(ys.size > 2, 'cliff skirts present');
    }
  }
});

test('placeIslandHouses：与场同种子联合出屋 —— 平顶内部、间距、确定性、两组不同', () => {
  const f = L.buildIsland({ size: 96, seed: 7, terraces: 7, roughness: 0.22, coast: 0.72 });
  const { n, h, mat, slope, walkable } = f;
  const a = L.placeIslandHouses(f, { seed: 7, count: 4 });
  const b = L.placeIslandHouses(f, { seed: 7, count: 4 });
  assert.deepEqual(a, b, 'same seed -> same houses');
  assert.ok(a.candidates > 50, `flat-cap candidates ${a.candidates}`);
  assert.ok(a.houses.length >= 2 && a.houses.length <= 4, `houses ${a.houses.length}`);
  for (const p of a.houses) {
    const k = p.j * n + p.i;
    assert.ok(mat[k] === L.MATERIAL.GRASS || mat[k] === L.MATERIAL.GRASS_TOP, 'house stands on grass plateau');
    assert.ok(p.h >= 0.6 && slope[k] < 0.4 && walkable[k], 'flat walkable cap');
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      assert.ok(Math.abs(h[k] - h[(p.j + dj) * n + p.i + di]) <= 0.02, 'all 4 neighbours same terrace');
  }
  for (let i = 0; i < a.houses.length; i++) for (let j = i + 1; j < a.houses.length; j++)
    assert.ok(Math.hypot(a.houses[i].i - a.houses[j].i, a.houses[i].j - a.houses[j].j) >= 3, 'min separation (mesa rule)');
  // 联合生成：换种子 → 屋位/数量随之变（片中两组小屋布局不同）；count=0 出空
  const g2 = L.buildIsland({ size: 96, seed: 11, terraces: 7, roughness: 0.22, coast: 0.72 });
  const c = L.placeIslandHouses(g2, { seed: 11, count: 4 });
  assert.notDeepEqual(a.houses.map((p) => [p.i, p.j]), c.houses.map((p) => [p.i, p.j]), 'second group differs');
  assert.equal(L.placeIslandHouses(f, { seed: 7, count: 0 }).houses.length, 0);
  assert.throws(() => L.placeIslandHouses({ n: 1, h: new Float32Array(1), mat: new Uint8Array(1), slope: new Float32Array(1) }), RangeError);
});
