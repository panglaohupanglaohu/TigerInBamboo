// 第 194 轮 · 1178731576982724611（"I made some grassy plots. I'm real happy with the shapes they make."）
// 缺口（r193 挂下）：地块尺度 —— 片子里同一座岛上是「一块 10+ 格的大田 + 若干 2–5 格小块」，
// 本仓 `planGardenC07` 一律按 maxPlot=5 切，形制偏碎；且 1 格孤立小块的出现在片里找不到对应。
// 本测在合成院子上（纯几何，无 THREE）量四件事：
//   ① 大田触发条件：草格 ≥ 2×bigMin 才切，切出来恰好一块、格数落在 [bigMin, bigMax]；
//   ② 余下小块仍 ≤ maxPlot；整院草格守恒（plotOf.size == 草格数）；
//   ③ 单格草台保留（片 0095 里确有单格圆角草台），地块格数只受 maxPlot 上限约束；
//   ④ A/B（bigField=0）退回旧形制；同输入两次跑逐格一致（确定性）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// 与 tests/c07-look.mjs 同款：把裸 'three' 指到 vendor/three.module.js（本仓没有 node_modules）
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { planGardenC07, growBigField } = await import('../src/build/garden-plots-c07.js');

function yard(W, H) {
  const cells = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) cells.push({ id: j * W + i, n: 4, cx: i, cz: j });
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? null : cells[j * W + i]);
  const nbr = (c, k) => [at(c.cx + 1, c.cz), at(c.cx, c.cz + 1), at(c.cx - 1, c.cz), at(c.cx, c.cz - 1)][k];
  return { world: { cells }, comps: [cells.slice()], door: new Map(), nbr, path: new Uint8Array(cells.length), cells };
}

/** 地块连通性：同块格必须在草格邻接图上连通（大田不能是几片拼起来的） */
function connected(ids, cells, nbr, allLawn) {
  const set = new Set(ids), seen = new Set([ids[0]]), q = [ids[0]];
  for (let i = 0; i < q.length; i++) {
    const c = cells[q[i]];
    for (let e = 0; e < c.n; e++) { const o = nbr(c, e); if (o && set.has(o.id) && !seen.has(o.id)) { seen.add(o.id); q.push(o.id); } }
  }
  return seen.size === ids.length;
}

// ---- ① 5×6 = 30 格院子（够大）----
const A = yard(5, 6);
const on = planGardenC07(A.world, A.comps, A.door, A.nbr, A.path, {});
const lawnOn = on.plotOf.size;
const sizesOn = on.stats.plotSizes;
assert.equal(on.stats.bigPlots, 1, `大院子应切出 1 块大田（实际 ${on.stats.bigPlots}）`);
const big = on.plots.find((p) => p.big);
assert.ok(big, '必须有一块 big 标记的地块');
assert.ok(big.cells.length >= 9 && big.cells.length <= 16, `大田格数应在 [9,16]（实际 ${big.cells.length}）`);
assert.ok(connected(big.cells, A.cells, A.nbr), '大田必须是连成一片的（不能是两块拼起来）');
const small = on.plots.filter((p) => !p.big).map((p) => p.cells.length);
assert.ok(small.length >= 2, `大田之外应还有若干小块（实际 ${small.length} 块）`);
assert.ok(Math.max(...small) <= 5, `小块仍受 maxPlot=5 约束（实际最大 ${Math.max(...small)}）`);
assert.ok(Math.min(...sizesOn) >= 1, `地块格数下限只到 1 格（最小 ${Math.min(...sizesOn)}）——片 0095 有单格圆角草台`);
assert.equal(lawnOn, [...on.plots].reduce((s, p) => s + p.cells.length, 0), '草格守恒（plotOf 与 plots 一致）');
assert.ok(lawnOn > 0 && lawnOn < 30, `院子有小径格，草格应少于整院（${lawnOn}/30）`);

// ---- ② 大田占比 ≈ bigField，且不越过上限 ----
const ratio = big.cells.length / lawnOn;
assert.ok(ratio > 0.35 && ratio <= 0.75, `大田占草格比例应落在 0.35–0.75（实际 ${ratio.toFixed(3)}）`);

// ---- ③ A/B：bigField=0 退回「全部 ≤5 格」的旧形制 ----
const B = yard(5, 6);
const off = planGardenC07(B.world, B.comps, B.door, B.nbr, B.path, { bigField: 0 });
assert.equal(off.stats.bigPlots, 0, '关档时不应有大田');
assert.ok(Math.max(...off.stats.plotSizes) <= 5, `关档时所有地块 ≤5（实际 ${Math.max(...off.stats.plotSizes)}）`);
assert.equal(off.plotOf.size, on.plotOf.size, '开/关档草格总数应相同（只改切法，不改覆盖面）');
assert.ok(off.stats.plotSizes.length > on.stats.plotSizes.length, `关档更碎（${off.stats.plotSizes.length} 块 vs 开档 ${on.stats.plotSizes.length} 块）`);

// ---- ④ 小院子：草格不足 2×bigMin 时不出大田 ----
const C = yard(6, 6);
// 只给 4×3=12 格的院子（其余格子不进 comps）
const sub = C.cells.filter((c) => c.cx >= 1 && c.cx <= 4 && c.cz >= 1 && c.cz <= 3);
const Cs = { world: C.world, comps: [sub], door: new Map(), nbr: C.nbr, path: new Uint8Array(C.cells.length) };
const smallYard = planGardenC07(Cs.world, Cs.comps, Cs.door, Cs.nbr, Cs.path, {});
assert.equal(smallYard.stats.bigPlots, 0, `小院子（12 格）不该出大田（实际 ${smallYard.stats.bigPlots}）`);
assert.ok(Math.max(...smallYard.stats.plotSizes) <= 5, '小院子仍按 2–5 格切');

// ---- ⑤ growBigField 本身：目标格数、连通、无随机 ----
const lawn = A.cells.slice();
const lawnIds = new Set(lawn.map((c) => c.id));
const ln = (c) => { const o = []; for (let e = 0; e < c.n; e++) { const b = A.nbr(c, e); if (b && lawnIds.has(b.id)) o.push(b); } return o; };
const g12 = growBigField(lawn, ln, 12);
assert.equal(g12.size, 12, `growBigField 应长到目标 12 格（实际 ${g12.size}）`);
assert.ok(connected([...g12], A.cells, A.nbr), 'growBigField 结果必须连通');
const g12b = growBigField(lawn, ln, 12);
assert.deepEqual([...g12b].sort((x, y) => x - y), [...g12].sort((x, y) => x - y), '同输入两次结果逐格一致');

// ---- ⑥ 确定性：整条规划两次跑逐格一致 ----
const A2 = yard(5, 6);
const again = planGardenC07(A2.world, A2.comps, A2.door, A2.nbr, A2.path, {});
assert.deepEqual(again.stats.plotSizes, on.stats.plotSizes, '同输入两次规划的地块尺寸序列一致');
assert.deepEqual(again.plots.map((p) => p.cells.slice().sort((x, y) => x - y)), on.plots.map((p) => p.cells.slice().sort((x, y) => x - y)), '同输入两次规划的地块成员一致');

console.log('PASS garden big plot', JSON.stringify({
  lawn: lawnOn, on: sizesOn, off: off.stats.plotSizes,
  bigCells: big.cells.length, ratio: +ratio.toFixed(3),
  smallYard: smallYard.stats.plotSizes,
}));
