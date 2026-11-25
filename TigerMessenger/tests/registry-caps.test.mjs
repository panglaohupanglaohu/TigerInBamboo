// registry-caps.test.mjs — REACodeRefactoring 体素能力的真 match/run 单元测试。
// 合成 7×7 方格世界（n=4，edgeNeighbors 四邻，-1 出界），逐能力验证匹配→执行→世界状态改变。
import test from 'node:test';
import assert from 'node:assert/strict';
import { arch, overhang, seastack, tunnel, ledge } from '../../townscaper-web/REACodeRefactoring/src/capabilities/terrain.js';
import { lighthouse, assembly } from '../../townscaper-web/REACodeRefactoring/src/capabilities/build.js';
import { LAYER_CAPS } from '../../townscaper-web/REACodeRefactoring/src/capabilities/layers-meta.js';
import { top, ground, isSolid, isRock, setVoxel, cloneWorldData } from '../../townscaper-web/REACodeRefactoring/src/capabilities/ops.js';

const N = 7;
const cid = (x, y) => y * N + x;

function makeWorld() {
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const id = y * N + x;
    cells.push({ id, n: 4, cx: x + 0.5, cz: y + 0.5, edgeNeighbors: [x > 0 ? id - 1 : -1, y > 0 ? id - N : -1, x < N - 1 ? id + 1 : -1, y < N - 1 ? id + N : -1] });
  }
  const w = {
    cells, grid: { cells },
    solid: new Int32Array(N * N), rock: new Int32Array(N * N),
    color: new Int32Array(N * N), river: new Int32Array(N * N),
    touched: 0, touch() { this.touched++; },
  };
  // 装配路径走 world 方法面（tile-assembly/assembly-sequence 的口径，格对象入参）
  w.top = (c) => top(w, c.id);
  w.ground = (c) => ground(w, c.id);
  w.isSolid = (c, lv) => isSolid(w, c.id, lv);
  w.isRock = (c, lv) => isRock(w, c.id, lv);
  w.isBuilt = (c, lv) => isSolid(w, c.id, lv) && !isRock(w, c.id, lv);
  w.setSolid = (c, lv, on, o) => setVoxel(w, c.id, lv, on, o);
  w.neighbor = (c, e) => { const id = c.edgeNeighbors[e]; return id >= 0 ? cells[id] : null; };
  w.snapshot = () => cloneWorldData(w);
  w.restore = (s) => { w.solid.set(s.solid); w.rock.set(s.rock); w.color.set(s.color); w.river.set(s.river); };
  return w;
}
/** 实心柱：lv1..h 全部置位；rock=false 表示建筑（顶面非岩）。 */
const fill = (w, id, h, rock = true) => { for (let lv = 1; lv <= h; lv++) setVoxel(w, id, lv, true, { rock }); };

// ---------------------------------------------------------------- 注册面
// 字面能力清单：成熟度构建器按引用判定单测覆盖；此处同时断言 id↔meta 对应不错位。
const COVERED = {
  'terrain.arch': arch, 'terrain.overhang': overhang, 'terrain.seastack': seastack,
  'terrain.tunnel': tunnel, 'terrain.ledge': ledge,
  'build.lighthouse': lighthouse, 'build.assembly': assembly,
};
const EXEC_CAPS = Object.values(COVERED);
test('registry: 覆盖清单字面 id 与 meta.id 一一对应', () => {
  for (const [id, cap] of Object.entries(COVERED)) assert.equal(cap.meta.id, id);
  assert.deepEqual(LAYER_CAPS.map((c) => c.meta.id).sort(), [
    'build.lighthouse-light', 'effects.smoke', 'grid.contours',
    'terrain.shrub-texture', 'water.volume', 'world.openness',
  ]);
});
test('registry: 每个可执行能力都有 meta+match+run，参数默认值在范围内', () => {
  for (const cap of [...EXEC_CAPS, ...LAYER_CAPS]) {
    const m = cap.meta;
    assert.match(m.id, /^[a-z]+\.[a-z-]+$/);
    assert.ok(m.name && m.summary && m.sources?.length, `${m.id} 缺描述/来源`);
    assert.equal(typeof cap.match, 'function', `${m.id} 缺 match`);
    for (const [k, d] of Object.entries(m.params ?? {})) {
      if (d.min !== undefined) assert.ok(d.min <= d.default && d.default <= d.max, `${m.id}.${k} 默认值出界`);
    }
  }
  for (const cap of EXEC_CAPS) assert.equal(typeof cap.run, 'function', `${cap.meta.id} 缺 run`);
});

// ---------------------------------------------------------------- terrain.overhang 悬崖外伸
test('terrain.overhang: 高岩崖旁空格匹配出外伸位，run 在崖顶层补岩', () => {
  const w = makeWorld();
  fill(w, cid(3, 3), 5);            // 全岩崖柱 top=ground=5
  fill(w, cid(4, 3), 1);            // 邻格低岩 g=1 ≤ 5-3
  const targets = overhang.match(w, {});
  const t = targets.find((x) => x.cells[0] === cid(4, 3));
  assert.ok(t, `(4,3) 没被匹配；got: ${targets.map((x) => x.id)}`);
  assert.equal(t.level, 5);
  const r = overhang.run(w, { targets: [t] });
  assert.deepEqual(r.applied, [t.id]);
  assert.ok(isSolid(w, cid(4, 3), 5) && isRock(w, cid(4, 3), 5), '崖顶层没补上岩');
});

// ---------------------------------------------------------------- terrain.seastack 海中石柱
test('terrain.seastack: 离岸两格的全水内格立石柱+帽环', () => {
  const w = makeWorld();
  fill(w, cid(3, 3), 2);            // 小岛
  const targets = seastack.match(w, {});
  assert.ok(targets.length >= 4, `水格候选太少: ${targets.length}`);
  const t = targets.find((x) => x.cells[0] === cid(1, 3));
  assert.ok(t, '离岸两格的 (1,3) 应被匹配');
  const r = seastack.run(w, { targets: [t], params: { height: 5 } });
  assert.deepEqual(r.applied, [t.id]);
  assert.equal(top(w, cid(1, 3)), 5, '石柱没到 5 层');
  assert.ok(isRock(w, cid(1, 3), 5));
  for (const n of t.cap) assert.equal(top(w, n), 5, `帽环格 ${n} 没压上帽`);
});

// ---------------------------------------------------------------- terrain.tunnel 穿山隧道
test('terrain.tunnel: 同高地隔着更高岩体打洞，挖空地面上一层', () => {
  const w = makeWorld();
  fill(w, cid(1, 4), 1);            // 西口地
  fill(w, cid(2, 4), 3);            // 中间岩体
  fill(w, cid(3, 4), 1);            // 东口地
  const targets = tunnel.match(w, {});
  const t = targets.find((x) => x.id === 'tunnel:29-31');
  assert.ok(t, `没匹配到隧道，got: ${targets.map((x) => x.id)}`);
  assert.deepEqual(t.cells, [cid(2, 4)]);
  assert.equal(t.floor, 1);
  const r = tunnel.run(w, { targets: [t] });
  assert.deepEqual(r.applied, [t.id]);
  assert.ok(!isSolid(w, cid(2, 4), 2), '洞位第 2 层还封着');
  assert.ok(isSolid(w, cid(2, 4), 1), '洞底被挖穿了');
  assert.ok(isRock(w, cid(2, 4), 3), '洞顶岩被掀了');
});

// ---------------------------------------------------------------- terrain.ledge 沿墙薄檐
test('terrain.ledge: 高 ≥3 岩壁腰上贴悬空薄檐（单层、底下留空）', () => {
  const w = makeWorld();
  fill(w, cid(2, 3), 2);            // 低地 top=2
  fill(w, cid(3, 3), 5);            // 岩壁 top=5 ≥ 2+3
  const targets = ledge.match(w, {});
  const t = targets.find((x) => x.cells[0] === cid(2, 3));
  assert.ok(t, '低地格没匹配到檐位');
  assert.equal(t.level, 4);
  assert.equal(t.rise, 2);
  const r = ledge.run(w, { targets: [t] });
  assert.deepEqual(r.applied, [t.id]);
  assert.ok(isSolid(w, cid(2, 3), 4) && !isSolid(w, cid(2, 3), 3), '檐不是悬空单层');
  assert.ok(w.touched > 0, 'world.touch 没回调');
});

// ---------------------------------------------------------------- terrain.arch 石拱
test('terrain.arch: 两根高柱隔 1–3 格低处架拱，下面留空能穿行', () => {
  const w = makeWorld();
  fill(w, cid(1, 6), 5);            // 西柱（边界行但格存在）
  fill(w, cid(4, 6), 5);            // 东柱
  const targets = arch.match(w, {}, { count: 2, minHeight: 4 });
  const t = targets.find((x) => x.cells.includes(cid(2, 6)) && x.cells.includes(cid(3, 6)));
  assert.ok(t, `没匹配到拱，got: ${targets.map((x) => x.id)}`);
  assert.deepEqual(t.ends.sort((a, b) => a - b), [cid(1, 6), cid(4, 6)].sort((a, b) => a - b));
  const r = arch.run(w, { targets: [t] });
  assert.deepEqual(r.applied, [t.id]);
  assert.ok(isSolid(w, cid(2, 6), t.level) && isSolid(w, cid(3, 6), t.level), '拱面没架上');
  assert.ok(!isSolid(w, cid(2, 6), t.level - 2), '拱下没留穿行空');
});

// ---------------------------------------------------------------- build.lighthouse 海边灯塔
test('build.lighthouse: 临水矮楼加高到 ≥5 层塔', () => {
  const w = makeWorld();
  fill(w, cid(5, 5), 1, false);     // 一层小楼（非岩）
  const targets = lighthouse.match(w, {});
  const t = targets.find((x) => x.cells[0] === cid(5, 5));
  assert.ok(t, '临水小楼没匹配');
  assert.equal(t.height, 6);
  const r = lighthouse.run(w, { targets: [t] });
  assert.deepEqual(r.applied, [t.id]);
  assert.equal(top(w, cid(5, 5)), 6);
  assert.ok(!isRock(w, cid(5, 5), 6), '灯塔层被写成岩了');
});

// ---------------------------------------------------------------- build.assembly 围合庭院
test('build.assembly: 3×3 铺地块内院匹配+逐块拼装落地', () => {
  const w = makeWorld();
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) fill(w, cid(x, y), 1, false);
  const targets = assembly.match(w, {}, { kind: 'court' });
  const t = targets.find((x) => x.kind === 'court');
  assert.ok(t, `没匹配到内院，got: ${targets.map((x) => x.id)}`);
  assert.deepEqual(t.interior, [cid(3, 3)]);
  const r = assembly.run(w, { targets: [t], params: { wallLevels: 2, seed: 7 } });
  assert.equal(t.fail, undefined, `拼装被拒: ${t.fail}`);
  assert.deepEqual(r.applied, [t.id]);
  assert.ok(top(w, cid(3, 3)) >= 2, '院里立柱没起来');
});

// ---------------------------------------------------------------- 显示层能力（match 可执行）
test('LAYER_CAPS: 显示层能力 meta+match 在合成世界上可执行', () => {
  const w = makeWorld();
  fill(w, cid(3, 3), 3);
  fill(w, cid(5, 5), 1, false);
  for (const cap of LAYER_CAPS) {
    const targets = cap.match(w, {});
    assert.ok(Array.isArray(targets), `${cap.meta.id} match 没返回数组`);
    for (const t of targets) assert.ok(t.id && t.reason, `${cap.meta.id} 目标缺 id/reason`);
  }
});
