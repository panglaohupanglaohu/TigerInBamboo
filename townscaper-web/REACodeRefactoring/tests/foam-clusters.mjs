// 第 183 轮：946660607008403456（长船靠岸）—— 船外沿岸白泡沫带 + 白花簇
// 片子 frame-0250 的 3× 裁切：岸线一侧有一条**连续白带**（水线），带里是**离散白点簇**（簇内 3–6 点）。
// 连续带 = r56 的 buildFoamMask（距离场 × 暴露度），本轮补的是离散簇 foamClusters。
import assert from 'node:assert/strict';
import { rasterLand, buildFoamMask, foamClusters, sampleGrid } from '../src/water/foam-mask.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// 与 tests/foam-mask-c10.mjs 同一套夹具：U 形大岛（开口朝 +z 的窄湾）+ 远处独石
const cells = [];
const sq = (x, z) => ({ id: cells.length, pts: [{ x, z }, { x: x + 1, z }, { x: x + 1, z: z + 1 }, { x, z: z + 1 }] });
const landSet = new Set();
for (let x = 0; x < 7; x++) for (let z = 0; z < 6; z++) {
  const c = sq(x, z); cells.push(c);
  if (!(x === 3 && z >= 2)) landSet.add(c.id);
}
const rock = sq(11, 2.5); cells.push(rock); landSet.add(rock.id);
const R = rasterLand(cells, (c) => landSet.has(c.id), undefined, { res: 0.05, pad: 2 });
const M = buildFoamMask(R);

// ---------- 1. 簇只落在泡沫带内、且不在陆地上 ----------
{
  const F = foamClusters(M, { count: 80, inner: 0.06, outer: 0.6, minFoam: 0.25 });
  ok(F.clusters.length === 80, `按 count 出簇（${F.clusters.length}/80）`);
  ok(F.stats.candidates > 80, `候选格远多于簇数（${F.stats.candidates}）`);
  ok(F.clusters.every((c) => c.dist >= 0.06 - 1e-9 && c.dist <= 0.6 + 1e-9), '每个锚点的离岸距离都落在 band 内');
  ok(F.clusters.every((c) => sampleGrid(M, M.mask, c.x, c.z) === 0), '没有一簇落在陆地上');
  ok(F.clusters.every((c) => c.foam >= 0.25 - 1e-9), '锚点格的泡沫强度都 ≥ minFoam（簇长在带里最白的地方）');
  // 双线性采样在格心处会有插值误差，所以只用它验"附近确实是泡沫区"，阈值放宽
  ok(F.clusters.every((c) => sampleGrid(M, M.foam, c.x, c.z) > 0.15), '锚点附近的连续泡沫 > 0.15（不是撒在干净水面）');
  ok(Math.abs(F.stats.meanDist - F.clusters.reduce((s, c) => s + c.dist, 0) / F.clusters.length) < 1e-12, 'meanDist 与逐簇距离一致');
}

// ---------- 2. 簇内点数 / 散布半径 ----------
{
  const sp = 0.12;
  const F = foamClusters(M, { count: 40, specks: 4, spread: sp });
  ok(F.clusters.every((c) => c.specks.length === 5), '每簇 1 个锚点 + 4 个花点 = 5 点');
  ok(F.stats.specks === 40 * 5, `总点数 ${F.stats.specks} == 40×5`);
  const far = F.clusters.flatMap((c) => c.specks.map((p) => Math.hypot(p.x - c.x, p.z - c.z)));
  ok(Math.max(...far) <= sp + 1e-9, `花点都在 spread=${sp} 内（最远 ${Math.max(...far).toFixed(4)}）`);
  ok(F.clusters.every((c) => c.specks.every((p) => p.r > 0 && p.a > 0 && p.a <= 1)), '点径与透明度都是正的有效值');
}

// ---------- 3. 定种子可回放 ----------
{
  const a = foamClusters(M, { count: 50, seed: 5 });
  const b = foamClusters(M, { count: 50, seed: 5 });
  ok(JSON.stringify(a.clusters) === JSON.stringify(b.clusters), '同种子逐位相同（可回放）');
  const c = foamClusters(M, { count: 50, seed: 6 });
  ok(JSON.stringify(a.clusters) !== JSON.stringify(c.clusters), '换种子换位置');
  // 抽样分布应覆盖两岸/独石，不是全挤在一处：按 x 分四段都要有
  const q = [0, 0, 0, 0];
  for (const cl of a.clusters) q[Math.min(3, Math.max(0, Math.floor((cl.x - M.minX) / ((M.W * M.res) / 4))))]++;
  ok(q.every((n) => n > 0), `四段都有簇（${q.join('/')}）`);
}

// ---------- 4. 参数校验 ----------
{
  assert.throws(() => foamClusters(null), RangeError); checks++;
  assert.throws(() => foamClusters(M, { outer: 0.01, inner: 0.5 }), RangeError); checks++;
  assert.throws(() => foamClusters(M, { count: 0 }), RangeError); checks++;
  assert.throws(() => foamClusters(M, { specks: -1 }), RangeError); checks++;
  // band 完全落在深海里 → 0 候选，返回空而不炸
  const empty = foamClusters(M, { inner: 40, outer: 60 });
  ok(empty.clusters.length === 0 && empty.stats.candidates === 0, 'band 内无候选时返回空集（页面不必判空）');
}

console.log(`foam-clusters: ${checks} checks PASS · 簇只落在泡沫带内、定种子可回放`);
