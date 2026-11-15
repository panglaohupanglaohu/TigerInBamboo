// 第 53 批 G5 · 798580832906739712「Some dirt cheap (and highly inaccurate) ray marching. Might use it for visibility when indoors」。
// 对照 REACode/src/rayvis.js：斐波那契方向、命中即停、整楼灰度场（室内近黑/室外近白）、粗步长漏光要量出来。
// 补：共享 World 上的逐格穿行（exact，不漏薄墙/格角）、整楼烘焙 + 叠加层灰点；双网格真实岛 + 带屋顶房间的手工城堡。
import assert from 'node:assert/strict';
import { stripWorld, makeIsland, THREE } from './fixtures/g5-battle.mjs';
import { castWorldRay, sampleWorldVisibility, sampleWorldVisibilityExact, bakeWorldVisibility } from '../src/core/space-visibility.js';
const { SpaceVisibilityOverlay } = await import('../src/world/space-visibility.js');
const L = .5;
// ① 单射线：水平穿过 3 格后撞到 3 格外的墙（墙厚一格）；竖直向上撞屋顶；斜穿格角
const S = stripWorld(9, 3); for (const c of S.cells) S.world.fill(c, 1, { rock: true });
for (let j = 0; j < 3; j++) S.world.fill(S.at(5, j), 3, { rock: true });
const o = { x: 1, y: .7, z: 1 };
assert.ok(Math.abs(castWorldRay(S.world, S.index, o, { x: 1, y: 0, z: 0 }, { maxDist: 8 }) - 3.5) < 1e-9, '撞到墙面 x=4.5');
assert.equal(castWorldRay(S.world, S.index, o, { x: -1, y: 0, z: 0 }, { maxDist: 8 }), 8, '出了网格 = 天空');
S.world.setSolid(S.at(1, 1), 4, true, { rock: true });
assert.ok(Math.abs(castWorldRay(S.world, S.index, o, { x: 0, y: 1, z: 0 }, { maxDist: 8 }) - (1.5 - .7)) < 1e-9, '竖直撞屋顶底面 y=1.5');
const dg = Math.SQRT1_2, t = castWorldRay(S.world, S.index, { x: 3.2, y: .7, z: .2 }, { x: dg, y: 0, z: dg }, { maxDist: 8 });
assert.ok(t > 0 && t < 2, '斜穿也撞墙');
// ② 薄墙漏光：0.06 宽的墙格（窄条格），固定 0.2 步长会跨过去，逐格穿行不会
const T = stripWorld(3, 1); for (const c of T.cells) T.world.fill(c, 1, { rock: true });
const mid = T.at(1, 0); for (const c of [T.at(0, 0), mid]) for (const p of c.pts) if (p.x > .4 && p.x < .6) p.x = .47;
for (const c of [mid, T.at(2, 0)]) for (const p of c.pts) if (p.x > 1.4 && p.x < 1.6) p.x = .53;
T.world.fill(mid, 4, { rock: true });
const inside = (c, x, z) => { let s = 0; for (let i = 0; i < c.n; i++) { const a = c.pts[i], b = c.pts[(i + 1) % c.n], k = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x); if (Math.abs(k) < 1e-12) continue; if (s && Math.sign(k) !== s) return false; s = Math.sign(k); } return true; };
const tIndex = { cellAt: (x, z) => T.cells.find((c) => inside(c, x, z)) ?? null };
const from = { x: 0, y: .9, z: 0 };
const coarse = sampleWorldVisibility(T.world, tIndex, from, { count: 1, maxDist: 2, step: .2 }), exact = sampleWorldVisibilityExact(T.world, tIndex, from, { count: 1, maxDist: 2 });
const ray = castWorldRay(T.world, tIndex, from, { x: 1, y: 0, z: 0 }, { maxDist: 2 });
assert.ok(Math.abs(ray - .47) < 1e-9, `逐格穿行撞到 0.06 宽薄墙 ${ray}`);
const coarseRay = sampleWorldVisibility(T.world, tIndex, from, { count: 1, maxDist: 2, step: .2 });
// fibonacci(1) 方向是竖直的，单独测水平射线：手工步进 0.2
let leak = true; for (let s = .2; s <= 2; s += .2) { const c = tIndex.cellAt(s, 0); if (c && T.world.isSolid(c, Math.floor(.9 / L) + 1)) { leak = false; break; } }
assert.ok(leak, '固定 0.2 步长从 0.47–0.53 的薄墙里跨过去（原版说的 highly inaccurate）');
// ③ 带屋顶的房间：室内暗、室外亮（整楼烘焙）
const C = stripWorld(9, 9); for (const c of C.cells) C.world.fill(c, 1, { rock: true });
for (let i = 2; i <= 6; i++) for (let j = 2; j <= 6; j++) { const c = C.at(i, j), wall = i === 2 || i === 6 || j === 2 || j === 6; for (let lv = 2; lv <= 3; lv++) if (wall && !(i === 4 && j === 2 && lv === 2)) C.world.setSolid(c, lv, true, { rock: true }); C.world.setSolid(c, 4, true, { rock: true }); }
const bake = bakeWorldVisibility(C.world, C.index, { count: 48, maxDist: 4 });
assert.ok(bake.stats.indoor === 10 && bake.stats.outdoor > 40, JSON.stringify(bake.stats));   // 屋里 9 格 + 门洞（门楣下）1 格
// 地面采样点有一半方向朝下（马上撞地），所以露天上限约 0.5
assert.ok(bake.stats.indoorMean < .3 && bake.stats.outdoorMean > .45 && bake.stats.contrast > 2, `室内近黑、室外近白 ${JSON.stringify(bake.stats)}`);
const door = bake.samples.find((s) => s.indoor && s.cell === C.at(4, 3).id), back = bake.samples.find((s) => s.indoor && s.cell === C.at(4, 5).id);
assert.ok(door.value > back.value, '门口比屋里深处亮');
// ④ 真实岛双网格 + 叠加层灰点
const report = {};
for (const kind of ['quad', 'mixed']) {
  const { world, index } = makeIsland(kind, 7);
  const ov = new SpaceVisibilityOverlay(world, index, { levelHeight: L });
  const st = ov.bake({ count: 24, maxDist: 3 });
  assert.ok(st.samples > 100 && ov.field.geometry.getAttribute('color').count === st.samples);
  const v = ov.baked.samples.map((s) => s.value);
  assert.ok(Math.min(...v) < Math.max(...v) - .2, '岛上有明有暗（崖脚 vs 台顶）');
  ov.setFieldVisible(true); assert.ok(ov.field.visible && ov.group.visible);
  report[kind] = { samples: st.samples, min: +Math.min(...v).toFixed(3), max: +Math.max(...v).toFixed(3) };
}
console.log('PASS 逐格穿行（墙面/天空/屋顶/斜穿）、薄墙固定步长漏光 vs 逐格不漏、带顶房间室内暗室外亮、门口比深处亮、真实岛双网格灰度场叠加层', JSON.stringify({ room: bake.stats, report }));
