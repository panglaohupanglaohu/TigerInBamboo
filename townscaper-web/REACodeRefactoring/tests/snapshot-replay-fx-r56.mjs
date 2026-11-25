// 第 56 批 C05：1260586697538113537 撤销栈回放会逐步触发原生建造反馈（弹出 / 落水水花 / 拆除灰尘）。
// 不另存"动作元数据"：回放每帧 restore 后 WorldMesh 增量重建按体素差分出 edits，View 正是把 edits 喂给
// effects.onEdit / sound.onEdit（view.js render 里同一行）。这里用真 WorldMesh 跑 replaySnapshots，统计每帧 edits。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => new Proxy({}, { get: () => () => ({}) }) });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const { buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { PALETTES } = await import('../src/core/palette.js');
const { buildScene } = await import('../src/world/scenes.js');
const { WorldMesh } = await import('../src/world/worldmesh.js');
const { replaySnapshots, replayDelay } = await import('../src/core/snapshot-replay.js');
import { readFileSync } from 'node:fs';

const grid = decorateCells(buildQuadGrid({ radius: 14, hexSize: 1 }));
const world = new World(grid); world.palette = PALETTES.town; buildScene(world, 'town', 7);
const wm = new WorldMesh(world, { levelHeight: 0.5 }); wm.bake = false; wm.rebuild();
// 模拟玩家：岸边 4 个海格，每格一笔（= 一条撤销记录），先落水再叠两层，最后拆掉一格顶层
const sea = grid.cells.filter((c) => world.top(c) === 0 && c.edgeNeighbors.some((i) => i >= 0 && world.top(grid.cells[i]) > 0)).slice(0, 4);
const undo = [];
const stroke = (fn) => { undo.push(world.snapshot()); fn(); wm.rebuild(); };
for (let k = 1; k <= 3; k++) for (const c of sea) stroke(() => world.setSolid(c, k, true));
stroke(() => world.setSolid(sea[0], 3, false));
const final = world.snapshot();
const frames = undo.concat([final]);
const fx = { pop: 0, splash: 0, dust: 0, perFrame: [] };
const r = await replaySnapshots(world, frames, {
  apply: () => { wm.rebuild(); const e = wm.edits; fx.perFrame.push(e.length);
    for (const { before, after } of e) { if (after > before) { fx.pop++; if (before === 0) fx.splash++; } else if (after < before) { fx.dust++; if (after === 0) fx.splash++; } } },
  wait: () => Promise.resolve(),
});
assert.equal(r.shown, frames.length);
// 帧 0 = 第一笔之前（4 格回到海面：从最终态拆除 → 灰尘 + 水花）；之后每帧恰 1 格变化
assert.equal(fx.perFrame[0], 4); assert.ok(fx.perFrame.slice(1, frames.length).every((n) => n === 1), JSON.stringify(fx.perFrame));
assert.equal(fx.perFrame.at(-1), 0, 'finally 恢复最终态：与最后一帧相同，不重复触发反馈');
assert.equal(fx.pop, 12, '12 笔建造逐笔弹出');
assert.ok(fx.splash >= 4 + 4, '4 格首块落水 + 起始帧回海面');
assert.ok(fx.dust >= 5, '起始帧 4 格 + 最后一笔拆顶');
for (const k of ['solid', 'color', 'rock', 'river']) assert.deepEqual(Array.from(world[k]), Array.from(final[k]));
// 节奏：replayDelay 校验 + app.js 的 ?replayMs= 挂钩在
assert.throws(() => replayDelay(-1), RangeError);
const t0 = Date.now(); await replayDelay(60); assert.ok(Date.now() - t0 >= 50);
assert.match(readFileSync(join(root, 'src/world/app.js'), 'utf8'), /replayDelay\(\+\(params\.get\('replayMs'\) \?\? 380\) \|\| 380/);
// 第 N 轮起 edits 先过 view.editFx 错拍队列（core/edit-fx-schedule.js 径向波确定序），到期仍喂同一对 onEdit
const viewSrc = readFileSync(join(root, 'src/world/view.js'), 'utf8');
assert.match(viewSrc, /this\.editFx\.push\(this\.worldMesh\.edits, this\.waterUniforms\.uTime\.value\)/, 'View 把 edits 排进错拍队列');
assert.match(viewSrc, /this\.editFx\.drain\(this\.waterUniforms\.uTime\.value, \(e\) => \{ this\.effects\.onEdit\(e\.cell, e\.before, e\.after, this\.levelHeight\); this\.sound\.onEdit\(/, '到期仍喂 effects/sound');
console.log(`PASS snapshot-replay-fx r56: ${frames.length} 帧回放 → 弹出 ${fx.pop} / 水花 ${fx.splash} / 灰尘 ${fx.dust}，每帧 edits ${JSON.stringify(fx.perFrame)}；结束恢复最终态；?replayMs 挂钩在`);
