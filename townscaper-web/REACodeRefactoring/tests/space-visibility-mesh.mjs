// 第 57 批残差 · 798580832906739712「Some dirt cheap (and highly inaccurate) ray marching.
// Might use it for visibility when indoors」：
//   ① castMeshRay / sampleMeshVisibility —— 三角网格级"光学"开阔度（原片斜面/洞口在柱格上表达不出；
//      与固定步长不同，逐三角形求交永远不会漏薄墙）；
//   ② indoorAt —— 原文用途「室内可见度」的数据谓词（有顶 covered 或开阔度低于阈值）；
//   ③ 能力库消费者：layers-meta `world.openness`（layer3d:'rayvis'）+ layers.js rayvis 工厂，
//      真实消费路径 runPlan → 工坊执行 → createLayer 挂进宿主场景。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
globalThis.document = new Proxy({}, { get: () => () => ({ style: {}, getContext: () => null }) });
const THREE = await import('three');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { castMeshRay, sampleMeshVisibility, indoorAt } = await import('../src/core/space-visibility.js');
const { CAPABILITIES, matchAll, runPlan, getCapability } = await import('../src/capabilities/registry.js');
const { createLayer, LAYER_NAMES } = await import('../src/capabilities/layers.js');
const L = .5, out = {};

/* ---------- ① 三角网格级光学：斜面精确命中、封闭房间室内暗 ---------- */
{
  // 2×2 房间：地板 y=0，四面直墙，斜屋顶 y=2.4(x=0)→3.2(x=2)。柱格只能表达整层，斜面高度只能靠三角求交。
  const V = [];
  const quad = (a, b, c, d) => { V.push(...a, ...b, ...c, ...a, ...c, ...d); };
  quad([0, 0, 0], [0, 0, 2], [2, 0, 2], [2, 0, 0]);            // 地板
  quad([0, 0, 0], [0, 2.4, 0], [0, 2.4, 2], [0, 0, 2]);        // x=0 墙
  quad([2, 0, 0], [2, 0, 2], [2, 3.2, 2], [2, 3.2, 0]);        // x=2 墙
  quad([0, 0, 0], [2, 0, 0], [2, 3.2, 0], [0, 2.4, 0]);        // z=0 墙（顶边随坡）
  quad([0, 0, 2], [0, 2.4, 2], [2, 3.2, 2], [2, 0, 2]);        // z=2 墙
  quad([0, 2.4, 0], [0, 2.4, 2], [2, 3.2, 2], [2, 3.2, 0]);    // 斜屋顶 y=2.4+0.4x
  const P = new Float32Array(V), o = { x: 1, y: 1, z: 1 };
  const near = (a, b) => Math.abs(a - b) < 1e-6;   // Float32 存储位点，命中距离有 ~1e-7 量化差
  assert.ok(near(castMeshRay(P, o, { x: 0, y: 1, z: 0 }, { maxDist: 6 }), 1.8), '斜屋顶在 x=1 处高 2.8 → 距离 1.8');
  assert.ok(near(castMeshRay(P, o, { x: 1, y: 0, z: 0 }, { maxDist: 6 }), 1), '直墙 x=2 → 距离 1');
  assert.ok(near(castMeshRay(P, o, { x: 0, y: -1, z: 0 }, { maxDist: 6 }), 1), '地板 → 距离 1');
  assert.equal(castMeshRay(P, o, { x: 0, y: 1, z: 0 }, { maxDist: 6, indices: [0, 1, 2, 3, 4, 5] }), 6, '索引网格只给地板 → 向上不命中');
  // 归一化：非单位方向按单位向量算距离
  assert.ok(near(castMeshRay(P, o, { x: 2, y: 0, z: 0 }, { maxDist: 6 }), 1), '非单位方向归一');
  assert.throws(() => castMeshRay(P, o, { x: 0, y: 0, z: 0 }), /zero direction/);
  assert.throws(() => castMeshRay(new Float32Array(6), o, { x: 1, y: 0, z: 0 }), /triplets|triangle/);
  // 封闭房间：室内全部命中 → 开阔度远低于屋顶上方
  const inside = sampleMeshVisibility(P, o, { count: 48, maxDist: 6 });
  const above = sampleMeshVisibility(P, { x: 1, y: 4.2, z: 1 }, { count: 48, maxDist: 6 });
  assert.ok(inside.value < .4 && above.value > inside.value * 2, `室内近黑、屋顶近白 ${inside.value} vs ${above.value}`);
  assert.deepEqual(sampleMeshVisibility(P, o, { count: 48, maxDist: 6 }).value, inside.value, '确定性');
  assert.throws(() => sampleMeshVisibility(P, o, { count: 0 }), /direction count/);
  out.mesh = { inside: +inside.value.toFixed(3), above: +above.value.toFixed(3), slopedT: 1.8 };
}

/* ---------- ② indoorAt：有顶 covered 或低开阔度 → indoor ---------- */
{
  const g = buildQuadGrid({ radius: 6 }); decorateCells(g);
  const world = new World(g), index = buildCellIndex(g);
  for (const c of world.cells) world.fill(c, 1, { rock: true });
  const room = world.cells.reduce((a, b) => (Math.hypot(b.cx, b.cz) < Math.hypot(a.cx, a.cz) ? b : a));
  world.fill(room, 4, { rock: true });                                        // 整格实心到 4 层 = 有顶的"屋"（点在 lv2）
  const inside = indoorAt(world, index, { x: room.cx, y: 1 * L + .12, z: room.cz });
  // 点在 lv2 空气里但头顶 lv3/4 实心 → covered；射线四面八方撞岩 → 开阔度也低
  assert.ok(inside.covered && inside.indoor && inside.value < .35, `室内点 ${JSON.stringify(inside)}`);
  const far = world.cells.reduce((a, b) => (Math.hypot(b.cx - room.cx, b.cz - room.cz) > Math.hypot(a.cx - room.cx, a.cz - room.cz) ? b : a));
  const outside = indoorAt(world, index, { x: far.cx, y: L + .12, z: far.cz });
  assert.ok(!outside.covered && !outside.indoor && outside.value > .35, `露天点 ${JSON.stringify(outside)}`);
  // 悬空桥底：lv1 地面 + lv4 单独一块实心，点走 lv2 空气层 → covered（头顶有盖）
  world.setSolid(far, 4, true, { rock: true });
  const under = indoorAt(world, index, { x: far.cx, y: L + .12, z: far.cz });
  assert.ok(under.covered && under.indoor, `桥底有顶 ${JSON.stringify(under)}`);
  world.setSolid(far, 4, false);
  // 阈值语义：threshold=0 只看 covered；threshold=1 全算 indoor
  assert.equal(indoorAt(world, index, { x: far.cx, y: L + .12, z: far.cz }, { threshold: 0 }).indoor, false, 'threshold=0 露天不 indoor');
  assert.equal(indoorAt(world, index, { x: far.cx, y: L + .12, z: far.cz }, { threshold: 1 }).indoor, true, 'threshold=1 全 indoor');
  assert.throws(() => indoorAt(world, index, { x: 0, y: NaN, z: 0 }), /indoor settings/);
  assert.throws(() => indoorAt(world, index, { x: 0, y: 1, z: 0 }, { threshold: 1.5 }), /indoor settings/);
  out.indoor = { inside: +inside.value.toFixed(3), outside: +outside.value.toFixed(3) };
}

/* ---------- ③ 能力库消费者：world.openness → runPlan 'layer' → rayvis 工厂 ---------- */
{
  const cap = getCapability('world.openness');
  assert.ok(cap && cap.meta.kind2 === 'layer' && cap.meta.layer3d === 'rayvis', '能力登记');
  assert.deepEqual(cap.meta.sources, ['798580832906739712'], '来源剪辑');
  assert.ok(LAYER_NAMES.includes('rayvis'), 'layers.js 有 rayvis 工厂');
  // 有被覆盖地面的世界 → matchAll 命中
  const g = buildQuadGrid({ radius: 5 }); decorateCells(g);
  const world = new World(g), index = buildCellIndex(g);
  for (const c of world.cells) world.fill(c, 1, { rock: true });
  const room = world.cells.reduce((a, b) => (Math.hypot(b.cx, b.cz) < Math.hypot(a.cx, a.cz) ? b : a));
  world.fill(room, 4, { rock: true });
  const m = matchAll(world).find((r) => r.id === 'world.openness');
  assert.ok(m && m.count === 1 && m.targets[0].cells.includes(room.id), `匹配到被覆盖格 ${JSON.stringify(m?.targets?.[0]?.reason)}`);
  const rep = runPlan(world, [{ id: 'world.openness' }]);
  assert.deepEqual([rep[0].status, rep[0].layer3d], ['layer', 'rayvis'], 'runPlan 交给显示层');
  // 全空世界 → 没有可匹配目标
  const g0 = buildQuadGrid({ radius: 3 }); decorateCells(g0);
  const w0 = new World(g0);
  assert.equal(matchAll(w0).find((r) => r.id === 'world.openness').count, 0, '空世界无目标');
  // 真实工厂：宿主 world/index/scene 与游戏侧同型（World 类 + buildCellIndex + three Group）
  const scene = new THREE.Group(), layer = createLayer('rayvis', { scene, world, index, levelHeight: L });
  layer.refresh(world);
  assert.ok(layer.count > 0 && scene.children.length === 1, `挂上射线+灰度场 count=${layer.count}`);
  const baked = scene.children[0].children.find((o) => o.isPoints);
  assert.ok(baked && baked.geometry.getAttribute('color').count > 0, '灰度场点已烘');
  layer.update(0); layer.dispose();
  assert.equal(scene.children.length, 0, 'dispose 摘除');
  out.capability = { matched: m.targets[0].cells.length, layerCount: layer.count };
}

console.log(JSON.stringify(out), 'PASS mesh-optical openness + indoorAt + world.openness capability layer');
