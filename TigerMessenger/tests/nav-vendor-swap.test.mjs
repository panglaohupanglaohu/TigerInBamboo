// R33 回归：vendor 副本的导航小组换成最新库之后，战役行为不能变坏。
//   ① 换进来的文件确实是新版（有 finePortals / stats / 体型重路由 / 脚高），旧件快照在 tests/fixtures/vendor-nav-legacy/；
//   ② 实景那种实心柱世界上（没有洞道 / 拱下节点），新旧 BattleNavigation 的路线（代价 + 下一步）逐对相同；同层的转向目标相同；
//      旧版能走的一步新版也能走、落点相同（新版只多放行「贴脚一挪只判终点」）；
//   ③ 有拱的世界：新版 doorCost=1 时路线代价与旧版相同；默认 doorCost 1.35 只会让穿洞更贵、不会更便宜；
//   ④ 真实 vendor Battle（view 用桩，three 指向 TigerMessenger/vendor/three.module.js）在同一座岛上跑 30 秒：新旧导航都不出 NaN、
//      地面上的人都在导航图上、维京人登陆后朝小屋走。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/nav-vendor-swap.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)), TM = join(here, '..'), ROOT = join(TM, '..');
const VENDOR = join(TM, 'src/vendor/townscaper-rea-refactoring/src'), LIB = join(ROOT, 'townscaper-web/REACodeRefactoring/src');
const GROUP = ['world/battle-navigation.js', 'world/fine-portals.js', 'world/navmesh-flow.js', 'world/layerednav.js', 'world/navgraph.js', 'core/arch-floor-budget.js', 'core/path-samples.js'];
const { BattleNavigation } = await import('../src/vendor/townscaper-rea-refactoring/src/world/battle-navigation.js');
const { BattleNavigation: LegacyNavigation } = await import('./fixtures/vendor-nav-legacy/src/world/battle-navigation.js');
const { buildQuadGrid } = await import('../src/vendor/townscaper-rea-refactoring/src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/vendor/townscaper-rea-refactoring/src/core/spatial.js');
const { World } = await import('../src/vendor/townscaper-rea-refactoring/src/core/world.js');
const { asciiWorld, ARCH_ISLAND } = await import('../src/system-workshop/battle/nav-lab.js');

/** 实景舞台那种岛：reaBattleStage 的采样是 world.fill（实心柱），一圈 1 层滩、中间 2 层台地（buildNav 会放楼梯） */
function quadIsland(radius = 8) {
  const grid = decorateCells(buildQuadGrid({ radius, hexSize: 1 })), index = buildCellIndex(grid), world = new World(grid);
  for (const c of grid.cells) { const r = Math.hypot(c.cx, c.cz); if (r < radius * .7) world.fill(c, r < radius * .35 ? 2 : 1, { rock: true }); }
  world.bnHouses = [grid.cells.reduce((a, c) => (Math.hypot(c.cx, c.cz) < Math.hypot(a.cx, a.cz) ? c : a))];
  world.touch();
  return { grid, index, world };
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('换件：vendor 导航小组是新版（旧件快照还在）', (t) => {
  for (const f of GROUP) {
    assert.ok(fs.existsSync(join(VENDOR, f)), 'vendor 里缺 ' + f);
    if (fs.existsSync(join(LIB, f)) && fs.readFileSync(join(VENDOR, f), 'utf8') !== fs.readFileSync(join(LIB, f), 'utf8')) t.diagnostic(`最新库的 ${f} 在 R33 之后又改了（vendor 仍是 R33 拷进来的那份），要不要再同步另记`);
  }
  const src = fs.readFileSync(join(VENDOR, 'world/battle-navigation.js'), 'utf8');
  for (const k of ['finePortals', 'footHeight', 'measureFooting', 'stairAt', 'buildFinePortals']) assert.ok(src.includes(k), 'battle-navigation 缺 ' + k);
  assert.match(fs.readFileSync(join(VENDOR, 'world/layerednav.js'), 'utf8'), /function stats\(\)/);
  assert.match(fs.readFileSync(join(VENDOR, 'world/layerednav.js'), 'utf8'), /treeTo\(goal,\{allow=null\}=\{\}\)/);
  for (const f of ['world/battle-navigation.js', 'world/layerednav.js', 'world/navgraph.js', 'core/path-samples.js', 'core/minheap.js', 'core/portal-aim.js', 'core/world.js'])
    assert.ok(fs.existsSync(join(here, 'fixtures/vendor-nav-legacy/src', f)), '旧件快照缺 ' + f);
  // world.js 后来已随嵌入房/多格实例快照特性同步过（splicedHouses/houseInstances 入快照），要求与最新库逐字一致；battle.js / traffic.js 的换批另记
  assert.equal(fs.readFileSync(join(VENDOR, 'core/world.js'), 'utf8'), fs.readFileSync(join(LIB, 'core/world.js'), 'utf8'), 'vendor core/world.js 与最新库不一致');
  assert.match(fs.readFileSync(join(VENDOR, 'core/world.js'), 'utf8'), /splicedHouses/);
});

test('实心柱世界：新旧导航路线逐对相同（代价 + 下一步）', () => {
  const { index, world } = quadIsland(8);
  const a = new LegacyNavigation(world, index, { levelHeight: .5 }), b = new BattleNavigation(world, index, { levelHeight: .5 });
  a.refresh(); b.refresh();
  assert.equal(a.graph.nodes.length, b.graph.nodes.length);
  assert.equal(b.graph.stats().covered, 0, '实心柱世界没有被覆盖节点');
  const nodes = b.graph.nodes, goals = nodes.filter((_, i) => i % Math.max(1, Math.floor(nodes.length / 12)) === 0);
  let pairs = 0;
  for (const g of goals) for (const s of nodes) {
    const u = { x: s.x, z: s.z, navFloor: s.floor }, pa = a.plan(u, g.cell, g.floor), pb = b.plan(u, g.cell, g.floor);
    assert.equal(!!pa, !!pb, `可达性不同：${s.id} → ${g.id}`);
    if (!pa) continue; pairs++;
    assert.ok(Math.abs(pa.distance - pb.distance) < 1e-9, `代价不同：${s.id} → ${g.id}：${pa.distance} / ${pb.distance}`);
    assert.equal(pa.next.id, pb.next.id, `下一步不同：${s.id} → ${g.id}`);
    if (!pa.arrived && pa.from.floor === pa.next.floor) {
      const ta = a.steerTarget(u, pa), tb = b.steerTarget(u, pb);
      assert.ok(Math.abs(ta.x - tb.x) < 1e-12 && Math.abs(ta.z - tb.z) < 1e-12, `同层转向目标不同：${s.id} → ${g.id}`);
    } else if (!pa.arrived) {
      // 换层：新版瞄准楼梯中线（片子里一列人沿台阶上去），旧版瞄准下一格格心；只要求新目标落在这两格里
      const tb = b.steerTarget(u, pb), c = index.cellAt(tb.x, tb.z);
      assert.ok(c && (c.id === pb.from.cell.id || c.id === pb.next.cell.id), `换层目标跑出了两格：${s.id} → ${g.id}`);
    }
  }
  assert.ok(pairs > 200, '比较的起终点对太少：' + pairs);
});

test('实心柱世界：旧版能走的一步新版也能走、落点相同', () => {
  const { index, world } = quadIsland(8), a = new LegacyNavigation(world, index, { levelHeight: .5 }), b = new BattleNavigation(world, index, { levelHeight: .5 });
  a.refresh(); b.refresh();
  const rnd = rng(5), nodes = b.graph.nodes; let tried = 0, legacyOk = 0;
  for (let k = 0; k < 600; k++) {
    const s = nodes[(rnd() * nodes.length) | 0], g = nodes[(rnd() * nodes.length) | 0];
    const base = { x: s.x + (rnd() - .5) * .2, z: s.z + (rnd() - .5) * .2, navFloor: s.floor, radius: .055 };
    if (index.cellAt(base.x, base.z)?.id !== s.cell.id) continue;
    const pa = a.plan({ ...base }, g.cell, g.floor), pb = b.plan({ ...base }, g.cell, g.floor); if (!pa || !pb || pa.arrived) continue;
    const ang = rnd() * Math.PI * 2, len = rnd() * .25, x = base.x + Math.cos(ang) * len, z = base.z + Math.sin(ang) * len;
    const ua = { ...base }, ub = { ...base }; tried++;
    const oka = a.move(ua, x, z, pa), okb = b.move(ub, x, z, pb);
    if (oka) { legacyOk++; assert.ok(okb, `旧版能走、新版不能：${JSON.stringify(base)} → ${x},${z}`); assert.deepEqual([ub.x, ub.z, ub.navFloor], [ua.x, ua.z, ua.navFloor]); }
  }
  assert.ok(tried > 100 && legacyOk > 30, `样本太少 tried=${tried} ok=${legacyOk}`);
});

test('有拱的世界：doorCost=1 与旧版代价相同；默认 1.35 只会更贵', () => {
  const env = asciiWorld(ARCH_ISLAND), { world, index } = env;
  const a = new LegacyNavigation(world, index, { levelHeight: .5 }), one = new BattleNavigation(world, index, { levelHeight: .5, doorCost: 1 }), def = new BattleNavigation(world, index, { levelHeight: .5 });
  a.refresh(); one.refresh(); def.refresh();
  assert.ok(def.graph.stats().covered >= 2, '两个拱下节点');
  const south = env.at(4, 1), north = env.at(4, 5), u = { x: south.cx, z: south.cz, navFloor: 1 };
  const pa = a.plan(u, north, 1), p1 = one.plan(u, north, 1), pd = def.plan(u, north, 1);
  assert.ok(pa && p1 && pd, '南北两半只能穿拱，必须走得通');
  assert.ok(Math.abs(pa.distance - p1.distance) < 1e-9, `doorCost=1 应与旧版相同：${pa.distance} / ${p1.distance}`);
  assert.ok(pd.distance > pa.distance + 1e-9, '默认 doorCost 让穿拱更贵');
});

test('真实 vendor Battle：新旧导航各跑 30 秒都不出 NaN、地上的人都在图上、维京人朝小屋走', async () => {
  register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(TM, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
  const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 }) : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => ((t[k] = v), true) });
  const el = () => ({ style: {}, appendChild() {}, append() {}, remove() {}, addEventListener() {}, setAttribute() {}, getContext: () => ctx2d, width: 0, height: 0, classList: { add() {}, remove() {}, toggle() {} }, set innerHTML(v) {}, set textContent(v) {} });
  globalThis.document ??= new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => (k in t ? t[k] : () => el()) });
  const THREE = await import('three');
  const { Battle } = await import('../src/vendor/townscaper-rea-refactoring/src/badnorth/battle.js');
  const run = (legacy) => {
    const { index, world } = quadIsland(9);
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, .1, 200); camera.position.set(0, 14, 14); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const view = { scene: new THREE.Group(), levelHeight: .5, index, mesh: new THREE.Mesh(new THREE.BufferGeometry()), worldMesh: { chimneys: [], builtVersion: world.version }, navLayer: null,
      effects: { fireSources: [], showFire() {} }, smoke: { sources: [], setFireCoupling() {}, ignite() {} }, atmosphere: { sample: () => new THREE.Vector3(1, 0, 0) }, camera, debugState: {}, goreOff: false };
    const saved = Math.random; Math.random = rng(42);
    try {
      const b = new Battle(view); b.start(world);
      if (legacy) b.navigation = new LegacyNavigation(world, index, { levelHeight: .5 });
      const house = world.bnHouses[0]; let landedDist = null;
      for (let k = 0; k < 900; k++) {
        b.update(1 / 30);
        const vik = b.units.filter((u) => u.team === 1 && !u.dead && !u.onBoat && !u.fall);
        if (vik.length && landedDist === null) landedDist = vik.reduce((s, u) => s + Math.hypot(u.x - house.cx, u.z - house.cz), 0) / vik.length;
      }
      const ground = b.units.filter((u) => !u.dead && !u.onBoat && !u.fall && !u.drown);
      const vik = ground.filter((u) => u.team === 1);
      return { units: b.units.length, finite: b.units.every((u) => [u.x, u.y, u.z].every(Number.isFinite)), offGraph: ground.filter((u) => !b.navigation.unitNode(u)).length, ground: ground.length,
        landedDist, vikDist: vik.length ? vik.reduce((s, u) => s + Math.hypot(u.x - house.cx, u.z - house.cz), 0) / vik.length : null, waves: b.wave };
    } finally { Math.random = saved; }
  };
  for (const legacy of [false, true]) {
    const r = run(legacy), tag = legacy ? '旧导航' : '新导航';
    assert.ok(r.finite, tag + '：出现 NaN');
    assert.ok(r.units >= 24, tag + '：守军没有生成 ' + JSON.stringify(r));
    // 刚登陆 / 刚被击退的人可能有一两帧落在格边上：允许至多 5%，多了就是导航图和移动不一致
    assert.ok(r.offGraph <= Math.ceil(r.ground * .05), tag + '：站在导航图外的人太多 ' + JSON.stringify(r));
    if (r.landedDist !== null && r.vikDist !== null) assert.ok(r.vikDist < r.landedDist + 1e-6, tag + '：维京人登陆后没有朝小屋走 ' + JSON.stringify(r));
  }
});
