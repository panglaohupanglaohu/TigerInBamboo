// 能力库 grid.contours（网格能力线的第一项可执行能力，1120036868966502401）：
// registry 能匹配真实生成地形；显示层在没有 top() 的宿主 World 上也画出逐层区域边界；体素变化后刷新；dispose 清干净。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { describeCapabilities, matchAll, runPlan, getCapability } = await import('../src/capabilities/registry.js');
const { createLayer, LAYER_NAMES } = await import('../src/capabilities/layers.js');
const { top } = await import('../src/capabilities/ops.js');

const meta = describeCapabilities().find((c) => c.id === 'grid.contours');
assert.ok(meta && meta.kind2 === 'layer' && meta.layer3d === 'contours' && meta.sources.includes('1120036868966502401'), '登记了 meta 与来源');
assert.ok(LAYER_NAMES.includes('contours'), '显示层工厂已登记');
assert.equal(getCapability('grid.contours').run, undefined, '显示层不改体素');

const world = new World(decorateCells(buildMixedGrid({ radius: 14 }))); generateTerrain(world, { seed: 7, rivers: 0, caves: 0 });
const before = Array.from(world.solid);
const match = matchAll(world).find((m) => m.id === 'grid.contours');
assert.equal(match.count, 1); assert.ok(match.targets[0].cells.length > 50 && /高度层/.test(match.targets[0].reason));
const report = runPlan(world, [{ id: 'grid.contours' }]);
assert.deepEqual([report[0]?.status ?? report.report?.[0]?.status, report[0]?.layer3d ?? report.report?.[0]?.layer3d], ['layer', 'contours']);
assert.deepEqual(Array.from(world.solid), before, '计划执行不改体素');

// 宿主：模拟游戏里没有 top() 的旧 World 副本
const legacy = { grid: world.grid, solid: world.solid, get cells() { return world.grid.cells; }, version: 1, isLand: (c) => world.isLand(c) };
const scene = new THREE.Scene(), host = { scene, world: legacy, levelHeight: 0.5 };
const layer = createLayer('contours', host); layer.refresh(legacy);
const mesh = scene.getObjectByName('grid-contour-layer'); assert.ok(mesh, '加进场景');
const levels = new Set(world.grid.cells.map((c) => top(world, c.id)).filter(Boolean));
assert.ok(levels.size >= 3, '测试地形有多层');
const first = layer.count; assert.ok(first > 100, '画出区域边界段：' + first);
let regions = null; mesh.traverse((o) => { if (o.isLineSegments && o.geometry.getAttribute('color')) regions = o; });
const ys = new Set(); const pos = regions.geometry.getAttribute('position'); for (let i = 0; i < pos.count; i++) ys.add(Math.round((pos.getY(i) - 0.04) / 0.5));
assert.ok(ys.size >= 3, '按体素位图取到多个高度层，而不是只有一层：' + [...ys]);
// 体素变化：抬高一格 → 刷新后段数变化
const cell = world.grid.cells.find((c) => top(world, c.id) === 1); world.solid[cell.id] |= 0b110; legacy.version++;
layer.update(0); assert.notEqual(layer.count, first, '体素变化后刷新');
layer.dispose(); assert.equal(scene.getObjectByName('grid-contour-layer'), undefined, 'dispose 后移出场景');
console.log(JSON.stringify({ ok: true, segments: first, levels: [...ys].sort() }));
