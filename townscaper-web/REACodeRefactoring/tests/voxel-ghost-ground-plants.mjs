// 第 187 轮：794993371261665280（158 帧·2016-11 体素塔）
// 口径来源：frame-0060 / frame-0150 原尺寸 —— 树**不在**露台/屋顶，而是沿塔基在底板广场上排成一列
// （7–9 棵、树冠等大、间距 1–2 格、每棵脚下有花池）。r183 记的「露台灌木/花盆」是误判，本轮纠正。
import assert from 'node:assert/strict';
import { rasterizeBoxes, groundPlants, plantStats, roofProps } from '../src/world/voxel-ghost.js';

const key = (x, y, z) => `${x},${y},${z}`;

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// 与页面同构的夹具：14×14 底板 + 一圈墙 + 顶层塔身（塔身占地 3..12 / 1..11）
const BOXES = [
  { x: 0, y: 0, z: 0, w: 14, h: 1, d: 14 },
  { x: 3, y: 1, z: 0, w: 9, h: 10, d: 1 },
  { x: 3, y: 1, z: 1, w: 1, h: 10, d: 10 },
  { x: 11, y: 1, z: 1, w: 1, h: 10, d: 10 },
  { x: 3, y: 1, z: 11, w: 3, h: 10, d: 1 },
  { x: 9, y: 1, z: 11, w: 3, h: 10, d: 1 },
  { x: 5, y: 12, z: 4, w: 5, h: 4, d: 5, hollow: true },
];
const voxels = rasterizeBoxes(BOXES);

// ---------- 1. 落点：底板格、上方空、不悬空不被埋 ----------
{
  const S = plantStats(voxels, { count: 9, gap: 1.7, clear: 1.45 });
  ok(S.plants === 9, `按 count 出 9 棵（${S.plants}）`);
  ok(S.buried === 0, '没有一棵上方被实体压住（buried 0）');
  ok(S.floating === 0, '没有一棵悬空（基格都是真底板格）');
  ok(S.tree === S.plants, 'counts.tree 与 plants 一致');
  // 14×14 = 196 格底板，y=1 的墙体占 35 格（后墙 9 + 左右各 10 + 前垛 3+3）→ 上方空的 161 格
  ok(S.plateCells === 161, `底板可用格 = 196 − 35 墙体（${S.plateCells}）`);
  ok(S.candidates > 0 && S.candidates <= S.plateCells, `候选 ${S.candidates} 落在 0..底板格`);

  const P = groundPlants(voxels, { count: 9, gap: 1.7, clear: 1.45 });
  ok(P.plants.every((p) => p.kind === 'tree'), '全是 tree');
  ok(P.plants.every((p) => p.cell.y === 0), '基格全在 y=0 底板层');
  ok(P.plants.every((p) => p.y === p.cell.y + 1), '树根落在底板顶面（y = 基格 + 1）');
  ok(P.plants.every((p) => p.bed === true), '每棵都带花池标记（原片每棵脚下都有圈）');
  ok(P.plants.every((p) => Math.abs(p.x - (p.cell.x + 0.5)) < 1e-12 && Math.abs(p.z - (p.cell.z + 0.5)) < 1e-12), '都站在格心');
  ok(P.plants.every((p) => p.s >= 1.55 && p.s <= 1.85), '尺寸 1.55–1.85（约 1.5–2 格高，树冠等大）');
}

// ---------- 2. 间距与离墙距离 ----------
{
  const P = groundPlants(voxels, { count: 9, gap: 1.7, clear: 1.45 }).plants;
  let minGap = Infinity, minClear = Infinity;
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) minGap = Math.min(minGap, Math.hypot(P[i].cell.x - P[j].cell.x, P[i].cell.z - P[j].cell.z));
    for (const v of voxels.values()) {
      if (v.y === 0) continue;
      const dx = Math.max(0, Math.abs(v.x - P[i].cell.x) - 0.5), dz = Math.max(0, Math.abs(v.z - P[i].cell.z) - 0.5);
      minClear = Math.min(minClear, Math.hypot(dx, dz));
    }
  }
  ok(minGap >= 1.7 - 1e-9, `两棵之间最小间距 ${minGap.toFixed(3)} ≥ 1.7`);
  ok(minClear >= 1.45 - 1e-9, `离塔身最小距离 ${minClear.toFixed(3)} ≥ 1.45（树冠不穿墙）`);
}

// ---------- 3. 与屋顶小件分离：基座小树不会长到屋顶上 ----------
{
  const P = groundPlants(voxels, { count: 9 }).plants;
  const R = roofProps(voxels, { seed: 31, maxTrees: 2 }).props.filter((p) => p.kind === 'tree');
  ok(R.length <= 2, `屋顶树 ≤ 2 棵（${R.length}）`);
  const overlap = P.filter((p) => R.some((r) => r.cell.x === p.cell.x && r.cell.y === p.cell.y && r.cell.z === p.cell.z));
  ok(overlap.length === 0, '屋顶树与基座树没有一格重复（两层各管各的）');
  ok(R.every((r) => r.cell.y >= 2), '屋顶树的基格在 y ≥ 2');
  ok(P.every((p) => p.cell.y === 0), '基座树的基格恒在 y = 0');
}

// ---------- 4. 定种子可复现 ----------
{
  const a = groundPlants(voxels, { seed: 41, count: 8 }).plants;
  const b = groundPlants(voxels, { seed: 41, count: 8 }).plants;
  ok(JSON.stringify(a) === JSON.stringify(b), '同种子两次逐字段相同');
  const c = groundPlants(voxels, { seed: 42, count: 8 }).plants;
  ok(JSON.stringify(a) !== JSON.stringify(c), '换种子换落点');
  ok(a.length === 8 && c.length === 8, '换种子不改件数');
}

// ---------- 5. 退化与参数校验 ----------
{
  const plateOnly = rasterizeBoxes([{ x: 0, y: 0, z: 0, w: 4, h: 1, d: 4 }]);
  const r = groundPlants(plateOnly);
  ok(r.plants.length === 0, '只有底板、没有上层实体时不出树（没有塔就没有广场）');
  assert.throws(() => groundPlants([]), RangeError); checks++;
  assert.throws(() => groundPlants(voxels, { count: -1 }), RangeError); checks++;
  assert.throws(() => groundPlants(voxels, { gap: 0.2 }), RangeError); checks++;
  const zero = groundPlants(voxels, { count: 0 });
  ok(zero.plants.length === 0, 'count 0 → 0 棵');
  ok(plantStats(voxels, { count: 0 }).buried === 0, 'count 0 时统计不报错');
}

// ---------- 6. 不等宽底板：树只在真的空场上 ----------
{
  // 底板 10 宽、塔身占 2..8：只剩边上一圈，count 给 20 也只能收到能被间距容纳的棵数
  const narrow = rasterizeBoxes([
    { x: 0, y: 0, z: 0, w: 10, h: 1, d: 10 },
    { x: 2, y: 1, z: 2, w: 6, h: 6, d: 6 },
  ]);
  const r = groundPlants(narrow, { count: 20, gap: 1.7 });
  ok(r.plants.length > 0 && r.plants.length <= 20, `窄底板出 ${r.plants.length} 棵（≤ 20）`);
  const solid = new Set([...narrow.values()].map((v) => key(v.x, v.y, v.z)));
  ok(r.plants.every((p) => !solid.has(key(p.cell.x, p.cell.y + 1, p.cell.z))), '每棵上方都不是墙');
}

console.log(`voxel-ghost-ground-plants: ${checks} checks PASS`);
