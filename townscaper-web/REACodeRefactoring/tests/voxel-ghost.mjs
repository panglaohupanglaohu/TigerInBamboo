import assert from 'node:assert/strict';
import {
  hash01, rasterizeBoxes, voxelOrder, previewState, phaseCounts,
  isoProject, depthOf, cubeFaces,
} from '../src/world/voxel-ghost.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// ---------- 1. 体素化：并集去重、空心壳 ----------
const solid = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 3, h: 2, d: 4 }]);
ok(solid.size === 24, `实心盒 3×2×4 = 24 格，实得 ${solid.size}`);
ok([...solid.values()].every((v) => Number.isInteger(v.x) && Number.isInteger(v.y) && Number.isInteger(v.z)), '坐标全为整数');

const shell = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 5, h: 5, d: 5, hollow: true }]);
ok(shell.size === 98, `空心 5×5×5 外壳 98 格（125−27），实得 ${shell.size}`);
ok(!shell.has('2,2,2'), '壳里没有最中心那格');
ok(shell.has('0,0,0') && shell.has('4,4,4'), '八个角都在');

const union = rasterizeBoxes([
  { x: 0, y: 0, z: 0, w: 4, h: 1, d: 4 },
  { x: 2, y: 0, z: 2, w: 4, h: 1, d: 4 },
]);
ok(union.size === 16 + 16 - 4, `重叠 2×2 只算一次：${union.size} 应为 28`);

assert.throws(() => rasterizeBoxes([]), RangeError); checks++;
assert.throws(() => rasterizeBoxes([{ w: 0, h: 1, d: 1 }]), RangeError); checks++;
assert.throws(() => rasterizeBoxes([{ w: 1.5, h: 1, d: 1 }]), RangeError); checks++;

// ---------- 2. 装配顺序 ----------
// 和片子同构的小塔：12×1 底板 + 空心中庭 + 顶板
const tower = rasterizeBoxes([
  { x: 0, y: 0, z: 0, w: 12, h: 1, d: 12 },
  { x: 2, y: 1, z: 2, w: 8, h: 8, d: 8, hollow: true },
  { x: 1, y: 9, z: 1, w: 10, h: 1, d: 10 },
]);
const scan = voxelOrder(tower, { mode: 'scan' });
ok(scan.length === tower.size, `序列长度 = 占位数（${scan.length}）`);
for (let i = 1; i < scan.length; i++) ok(scan[i].y >= scan[i - 1].y, 'scan 顺序 y 单调不减（自下而上）');
ok(scan[0].y === 0 && scan[scan.length - 1].y === 9, `先底板后顶板（${scan[0].y} → ${scan[scan.length - 1].y}）`);
ok(new Set(scan.map((v) => `${v.x},${v.y},${v.z}`)).size === scan.length, '序列无重复格');

const radial = voxelOrder(tower, { mode: 'radial' });
ok(radial.length === scan.length, 'radial 覆盖同一批格');
const rOf = (v) => Math.hypot(v.x + 0.5 - 5.5, v.z + 0.5 - 5.5);
for (let i = 1; i < radial.length; i++) ok(rOf(radial[i]) >= rOf(radial[i - 1]) - 1e-9, 'radial 顺序离轴距离单调不减');

const shufA = voxelOrder(tower, { mode: 'shuffle', seed: 3 });
const shufB = voxelOrder(tower, { mode: 'shuffle', seed: 3 });
ok(JSON.stringify(shufA) === JSON.stringify(shufB), 'shuffle 同种子可复现');
ok(new Set(shufA.map((v) => `${v.x},${v.y},${v.z}`)).size === shufA.length - 0, 'shuffle 不丢格');
ok(shufA.some((v, i) => v.x !== scan[i].x || v.z !== scan[i].z), 'shuffle 与 scan 顺序不同');

assert.throws(() => voxelOrder(tower, { mode: 'nope' }), RangeError); checks++;
assert.throws(() => voxelOrder([], {}), RangeError); checks++;

// ---------- 3. 三段时间线 ----------
const N = scan.length;
const t0 = previewState(scan, 0);
ok(t0.hidden === N && t0.points.length === 0 && t0.solid.length === 0, 't=0 全隐藏，一个点都没出');
ok(t0.phase === 'empty', 't=0 phase=empty');

const early = previewState(scan, 0.06);
ok(early.solid.length === 0 && early.ghost.length === 0, 't=0.06 还没有线框和实体');
ok(early.points.length > 0 && early.points.length < N, `t=0.06 点正在陆续出现（${early.points.length}/${N}）`);
ok(early.phase === 'scatter', 't=0.06 phase=scatter');

// t=0.16：所有格都至少到了"点"，最早那批（ghostAt 从 0.10 起）已经套上框 —— 片子里点与框是同时在的
const dot = previewState(scan, 0.16);
ok(dot.points.length + dot.ghost.length === N, `t=0.16 整片格都进了画面（点 ${dot.points.length} + 框 ${dot.ghost.length}）`);
ok(dot.solid.length === 0, 't=0.16 还没有实体格');
ok(dot.points.length >= N * 0.9, `t=0.16 绝大多数还是点（${dot.points.length}/${N}）`);

const wire = previewState(scan, 0.27);
ok(wire.solid.length === 0 && wire.ghost.length > 0, 't=0.27 线框套上、还没实体');
ok(wire.ghost.length + wire.points.length === N, '线框期点/框两态之和 = 总格数');

const mid = previewState(scan, 0.55);
ok(mid.solid.length > 0 && mid.solid.length < N, `t=0.55 已实心一部分（${mid.solid.length}/${N}）`);
ok(mid.phase === 'fill', 't=0.55 phase=fill');

const done = previewState(scan, 1);
ok(done.solid.length === N && done.ghost.length === 0 && done.points.length === 0, 't=1 全部实心');
ok(done.phase === 'done', 't=1 phase=done');

// 三态互斥且恒覆盖全部格
for (const t of [0, 0.05, 0.12, 0.25, 0.4, 0.62, 0.88, 1]) {
  const s = previewState(scan, t);
  ok(s.hidden + s.points.length + s.ghost.length + s.solid.length === N, `t=${t} 四态计数之和 = ${N}`);
  const keys = [...s.points, ...s.ghost, ...s.solid].map((v) => `${v.x},${v.y},${v.z}`);
  ok(new Set(keys).size === keys.length, `t=${t} 同一格不落在两个桶里`);
}

// 实体化严格按装配序 → 任何 t 下已实心都是前缀
const orderIdx = new Map(scan.map((v, i) => [`${v.x},${v.y},${v.z}`, i]));
for (const t of [0.25, 0.32, 0.45, 0.7, 0.95]) {
  const s = previewState(scan, t);
  ok(s.solid.every((v, i) => orderIdx.get(`${v.x},${v.y},${v.z}`) === i), `t=${t} 已实心格是装配序前缀（${s.solid.length} 格）`);
}

// 单调：每格状态只能往前走
const rank = { hidden: 0, points: 1, ghost: 2, solid: 3 };
const stageAt = new Map();
const stamp = (s, t) => {
  for (const v of s.points) stageAt.set(`${v.x},${v.y},${v.z}`, ['points', t]);
  for (const v of s.ghost) stageAt.set(`${v.x},${v.y},${v.z}`, ['ghost', t]);
  for (const v of s.solid) stageAt.set(`${v.x},${v.y},${v.z}`, ['solid', t]);
};
for (let t = 0.02; t <= 1.0001; t += 0.02) {
  const s = previewState(scan, +t.toFixed(2));
  const seen = [];
  for (const v of s.points) seen.push(['points', `${v.x},${v.y},${v.z}`]);
  for (const v of s.ghost) seen.push(['ghost', `${v.x},${v.y},${v.z}`]);
  for (const v of s.solid) seen.push(['solid', `${v.x},${v.y},${v.z}`]);
  for (const [stage, k] of seen) {
    const prev = stageAt.get(k);
    if (prev) ok(rank[stage] >= rank[prev[0]], `格 ${k} 状态不倒退（${prev[0]} → ${stage}）`);
  }
  stamp(s, +t.toFixed(2));
}

// 抖动用散列：同 i 同 seed 稳定，不同 seed 不同
ok(hash01(7, 3) === hash01(7, 3), 'hash01 可复现');
ok(hash01(7, 3) !== hash01(7, 4), '换种子值不同');
ok(hash01(0, 0) >= 0 && hash01(0, 0) < 1, 'hash01 落在 [0,1)');
const dotA = previewState(scan, 0.2, { seed: 11 }), dotB = previewState(scan, 0.2, { seed: 12 });
ok(JSON.stringify(dotA.points) !== JSON.stringify(dotB.points), '换 seed 点的出现顺序变了');

assert.throws(() => previewState(scan, -0.1), RangeError); checks++;
assert.throws(() => previewState(scan, 1.1), RangeError); checks++;
assert.throws(() => previewState([], 0.5), RangeError); checks++;

// ---------- 4. 等轴测投影 ----------
const s1 = 1;
const p0 = isoProject({ x: 0, y: 0, z: 0 }, { scale: s1 });
ok(Math.abs(p0[0]) < 1e-12 && Math.abs(p0[1]) < 1e-12, '原点投到 (0,0)');
const px = isoProject({ x: 1, y: 0, z: 0 }, { scale: s1 });
ok(Math.abs(px[0] - 0.8660254) < 1e-6, `+x 每格右移 0.866（${px[0].toFixed(4)}）`);
ok(Math.abs(px[1] - 0.5) < 1e-6, `+x 每格下移 0.5（${px[1].toFixed(4)}）`);
const pz = isoProject({ x: 0, y: 0, z: 1 }, { scale: s1 });
ok(Math.abs(pz[0] + 0.8660254) < 1e-6, '+z 每格左移 0.866');
const py = isoProject({ x: 0, y: 1, z: 0 }, { scale: s1 });
ok(Math.abs(py[1] + 1) < 1e-9 && Math.abs(py[0]) < 1e-12, '+y 每格上移 1（竖直，不横移）');
const big = isoProject({ x: 1, y: 1, z: 1 }, { scale: 2, tilt: 0.5 });
ok(Math.abs(big[0]) < 1e-9 && Math.abs(big[1] - (2 - 2)) < 1e-9, 'scale 缩放整幅投影');

ok(depthOf({ x: 0, y: 0, z: 0 }) < depthOf({ x: 1, y: 0, z: 0 }), '画家序：远处先画');
ok(depthOf({ x: 3, y: 0, z: 3 }) > depthOf({ x: 3, y: 0, z: 2 }), '同一列靠前的后画');

const faces = cubeFaces({ x: 0, y: 0, z: 0 }, { scale: 1 });
ok(Object.keys(faces).length === 3, '立方体三个可见面');
ok(['top', 'right', 'left'].every((k) => faces[k].length === 4), '每面四个角');
// 三个面的有向面积都不为 0（是可填充多边形），且顶面整体压在两个侧面之上、左右分明
const shoelace = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const b = pts[(i + 1) % pts.length];
    a += pts[i][0] * b[1] - b[0] * pts[i][1];
  }
  return a / 2;
};
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
ok(Math.abs(shoelace(faces.top)) > 0.1 && Math.abs(shoelace(faces.right)) > 0.1 && Math.abs(shoelace(faces.left)) > 0.1, '三面面积都不为 0');
ok(Math.abs(Math.abs(shoelace(faces.top)) - 0.8660254) < 1e-6, `顶面是菱形、面积 = 2·(0.866·0.5)（${Math.abs(shoelace(faces.top)).toFixed(4)}）`);
const cTop = centroid(faces.top), cRight = centroid(faces.right), cLeft = centroid(faces.left);
ok(cTop[1] < cRight[1] - 0.3 && cTop[1] < cLeft[1] - 0.3, '顶面整体在两个侧面之上');
ok(cRight[0] > cLeft[0] + 0.3, '右面在左面右边（+x 朝右、+z 朝左）');

assert.throws(() => isoProject({ x: 0, y: 0, z: 0 }, { scale: NaN }), RangeError); checks++;

// ---------- 5. 计数助手 ----------
const counts = phaseCounts(previewState(scan, 0.55));
ok(counts.points + counts.ghost + counts.solid + counts.hidden === N, 'phaseCounts 求和 = 总格数');
ok(counts.phase === 'fill', 'phaseCounts 带 phase');

// ---------- 6. 点出现顺序：scatter（整片一起）vs order（沿装配序）----------
const idxOf = new Map(scan.map((v, i) => [`${v.x},${v.y},${v.z}`, i]));
const byOrder = previewState(scan, 0.06, { pointMode: 'order' });
ok(byOrder.points.length > 0 && byOrder.points.length < N, `order 模式 t=0.06 只出了一部分点（${byOrder.points.length}/${N}）`);
ok(byOrder.points.every((v, i) => idxOf.get(`${v.x},${v.y},${v.z}`) === i), 'order 模式的点恰好是装配序前缀（一根根长出来）');
const scattered = previewState(scan, 0.06, { pointMode: 'scatter' });
ok(JSON.stringify(byOrder.points) !== JSON.stringify(scattered.points), '同 t 下两种点序不同');
const late = previewState(scan, 0.15, { pointMode: 'order' });
ok(late.points.length + late.ghost.length === N, 'order 模式 t=0.15 也已铺满整片（点+框）');
assert.throws(() => previewState(scan, 0.5, { pointMode: 'nope' }), RangeError); checks++;

console.log(`voxel-ghost: ${checks} checks PASS · 塔 ${N} 格 · t0.55 实心 ${counts.solid} 线框 ${counts.ghost} 点 ${counts.points}`);
