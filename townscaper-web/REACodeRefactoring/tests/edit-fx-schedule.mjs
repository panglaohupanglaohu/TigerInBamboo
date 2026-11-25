// 1260586697538113537 「动作特效」残差补全：撤销/重做/历史回放的帧内编辑特效错拍。
//   - planEditFx：变心径向波确定序（快照只有整笔颗粒度，笔内拖动顺序不可恢复 → 确定近似）
//   - EditFxQueue：到期才喂特效（灰尘/水花按 spawn 时刻生成），enabled=false 整层可关
//   - worldmesh.editFxLimit：默认 40 防批量载入爆量；回放帧=整笔快照可超限，回放期放宽
//   - 与回放状态机兼容：走 replaySnapshots 同一条路，finally 恢复最终态不受影响
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => new Proxy({}, { get: () => () => ({}) }) });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const { planEditFx, EditFxQueue } = await import('../src/core/edit-fx-schedule.js');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { PALETTES } = await import('../src/core/palette.js');
const { buildScene } = await import('../src/world/scenes.js');
const { WorldMesh } = await import('../src/world/worldmesh.js');
const { replaySnapshots } = await import('../src/core/snapshot-replay.js');
import { readFileSync } from 'node:fs';

/* ---- 纯数据层：确定序 + 时序界 ------------------------------------------ */
const cell = (id, cx, cz) => ({ id, cx, cz, minX: cx - .5, maxX: cx + .5, minZ: cz - .5, maxZ: cz + .5 });
const ring = [cell(1, 0, 0), cell(2, 2, 0), cell(3, -2, 0), cell(4, 0, 2), cell(5, 0, -2)]
  .map((c) => ({ cell: c, before: 0, after: 1 }));
const p1 = planEditFx(ring), p2 = planEditFx([...ring].reverse());
assert.deepEqual(p1.map((p) => p.cell.id), p2.map((p) => p.cell.id), '输入顺序无关：同一批 edit 排出同一径向波');
assert.equal(p1[0].cell.id, 1, '质心最近的先长');
for (const [k, p] of p1.entries()) {
  assert.ok(Math.abs(p.delay - k * p1[1].delay) < 1e-9);
  assert.ok(p.delay >= 0 && p.delay <= 1.4 + 1e-9);
}
assert.equal(planEditFx([ring[0]])[0].delay, 0, '单格不错拍（普通建造手感不变）');
assert.deepEqual(planEditFx([]), []);
assert.throws(() => planEditFx(null), TypeError);
assert.throws(() => planEditFx(ring, { step: -1 }), RangeError);
// 大批压缩间距：整体不拖过 maxSpan
const big = planEditFx(Array.from({ length: 200 }, (_, i) => ({ cell: cell(i, i % 20, (i / 20) | 0), before: 0, after: 1 })));
assert.ok(Math.abs(big.at(-1).delay - 1.4) < 1e-9, `大批排满 maxSpan，实际 ${big.at(-1).delay}`);
assert.ok(big.every((p, k) => !k || p.delay > big[k - 1].delay), 'delay 严格递增');

/* ---- 队列：到期触发 + 可关 -------------------------------------------- */
{
  const q = new EditFxQueue({ step: 0.1, maxSpan: 1 });
  assert.equal(q.push(ring, 10), 5);
  const fired = [];
  assert.equal(q.drain(10, (p) => fired.push(p)), 1, 't0 只有 delay=0 那格到期');
  q.drain(10.35, (p) => fired.push(p));
  assert.equal(fired.length, 4);
  q.drain(10.4, (p) => fired.push(p));
  assert.equal(fired.length, 5);
  assert.equal(q.fired, 5);
  assert.ok(fired.every((p, k) => !k || p.due >= fired[k - 1].due));
  // 关掉：进队直接丢，已排程的清掉
  q.enabled = false; q.clear();
  assert.equal(q.push(ring, 20), 0);
  assert.equal(q.dropped, 5);
  assert.equal(q.drain(99, () => { throw Error('不应触发'); }), 0);
  assert.throws(() => new EditFxQueue({ step: -1 }), RangeError);
}

/* ---- WorldMesh 真差分：默认 40 上限吞大批、editFxLimit 放开 ------------- */
const grid = decorateCells(buildQuadGrid({ radius: 14, hexSize: 1 }));
const world = new World(grid); world.palette = PALETTES.town; buildScene(world, 'town', 7);
const wm = new WorldMesh(world, { levelHeight: 0.5 }); wm.bake = false; wm.rebuild();
const sea = grid.cells.filter((c) => world.top(c) === 0 && c.edgeNeighbors.some((i) => i >= 0 && world.top(grid.cells[i]) > 0)).slice(0, 50);
assert.ok(sea.length >= 50 && sea.length <= grid.cells.length * 0.3, `50 格海笔：${sea.length}`);
{
  const snap0 = world.snapshot();
  for (const c of sea) world.setSolid(c, 1, true);
  wm.rebuild();
  assert.equal(wm.edits.length, 0, '默认 40 上限：50 格一笔 → edits 静默为空（这就是旧行为吞特效的点）');
  wm.editFxLimit = 600;
  world.restore(snap0); wm.rebuild();           // 拆掉 → 50 个拆除 edit
  assert.equal(wm.edits.length, 50, '放宽后 50 格差分全发');
  assert.ok(wm.edits.every((e) => e.before === 1 && e.after === 0));
  world.restore(snap0); wm.rebuild();           // 回到空岛，别让差分污染下一段
  assert.equal(wm.edits.length, 0);
}

/* ---- 与回放状态机兼容：replaySnapshots 同路 + finally 恢复 --------------- */
const undo = [];
const stroke = (fn) => { undo.push(world.snapshot()); fn(); wm.rebuild(); };
for (let k = 1; k <= 2; k++) for (const c of sea.slice(0, 30)) stroke(() => world.setSolid(c, k, true));
const final = world.snapshot();
const frames = undo.concat([final]);
const q = new EditFxQueue();
let t = 0, pop = 0, splash = 0, dust = 0;
const fire = (e) => { if (e.after > e.before) { pop++; if (e.before === 0) splash++; } else if (e.after < e.before) { dust++; if (e.after === 0) splash++; } };
const r = await replaySnapshots(world, frames, {
  apply: () => { wm.rebuild(); q.push(wm.edits, t); },
  wait: () => { for (let k = 0; k < 40; k++) { t += 0.05; q.drain(t, fire); } return Promise.resolve(); },
});
assert.equal(r.shown, frames.length);
assert.equal(q.pending.length, 0, '回放节奏内全部错拍发完');
assert.equal(pop, 60, '30 格 × 2 层逐格弹出');
assert.equal(splash, 30 + 30, '30 格首块落水 × 回放正向一遍 + 倒带拆掉一遍');
assert.equal(dust, 30, '倒带到第一帧：30 格拆回海面');
for (const k of ['solid', 'color', 'rock', 'river']) assert.deepEqual(Array.from(world[k]), Array.from(final[k]), '回放结束恢复最终态');

/* ---- 接线核查 ---------------------------------------------------------- */
const appSrc = readFileSync(join(root, 'src/world/app.js'), 'utf8');
const viewSrc = readFileSync(join(root, 'src/world/view.js'), 'utf8');
assert.match(appSrc, /view\.worldMesh\.editFxLimit = Math\.max\(fxLimit0 \|\| 0, 600\)/, '回放期放宽差分上限');
assert.match(appSrc, /view\.worldMesh\.editFxLimit = fxLimit0/, '回放结束恢复原上限');
assert.match(appSrc, /params\.get\('editfx'\) === '0'\) view\.setDebug\('editfx', false\)/, '?editfx=0 整层可关');
assert.match(viewSrc, /this\.editFx\.push\(this\.worldMesh\.edits, this\.waterUniforms\.uTime\.value\)/, 'edits 进错拍队列');
assert.match(viewSrc, /this\.editFx\.drain\(this\.waterUniforms\.uTime\.value/, '到期统一喂 effects/sound');
assert.match(viewSrc, /case 'editfx':/, 'setDebug 开关在');
assert.match(readFileSync(join(root, 'src/world/worldmesh.js'), 'utf8'), /this\.editFxLimit \?\? 40/, '差分上限可配');
console.log(`PASS edit-fx-schedule：径向波确定序 ${p1.map((p) => p.cell.id)}，大批压缩到 maxSpan；默认40吞/放宽600全发；回放 60弹出/${splash}水花/${dust}灰尘，finally 恢复最终态；?editfx=0 可关`);
