// 第 56 批 C10：1849732997945110651 全局水面泡沫遮罩 + 1664565063552847873 绕岛障碍染料流（纯 CPU，node 直接跑）
import assert from 'node:assert/strict';
import { rasterLand, buildFoamMask, sampleGrid, ObstacleFlow, chamferDistance } from '../src/water/foam-mask.js';

// 单位方格网：U 形大岛（开口朝 +z 的深湾）+ 远处单格独石
const cells = [];
const sq = (x, z) => ({ id: cells.length, pts: [{ x, z }, { x: x + 1, z }, { x: x + 1, z: z + 1 }, { x, z: z + 1 }] });
const landSet = new Set();
for (let x = 0; x < 7; x++) for (let z = 0; z < 6; z++) {
  const c = sq(x, z); cells.push(c);
  const inBay = x === 3 && z >= 2;     // 窄湾：宽 1、深 4
  if (!inBay) landSet.add(c.id);
}
const rock = sq(11, 2.5); cells.push(rock); landSet.add(rock.id);
const R = rasterLand(cells, (c) => landSet.has(c.id), undefined, { res: 0.05, pad: 2 });
assert.ok(R && R.W > 100 && R.H > 60, '栅格化');
const M = buildFoamMask(R);
const at = (x, z) => sampleGrid(M, M.foam, x, z);
const rockFoam = at(12.15, 3), coastFoam = at(-0.15, 3), bayFoam = at(3.15, 4.5);
console.log({ rockFoam, coastFoam, bayFoam, far: at(9, -1.5), stats: M.stats });
assert.ok(rockFoam > coastFoam * 1.2, `独石周围泡沫多于直岸 ${rockFoam} > ${coastFoam}`);
assert.ok(coastFoam > bayFoam * 1.2, `直岸多于深湾 ${coastFoam} > ${bayFoam}`);
assert.ok(at(9, -1.8) < 0.02, '远海无泡沫');
assert.equal(sampleGrid(M, M.foam, 1.5, 1.5), 0, '陆地内 0');
for (const v of M.foam) assert.ok(v >= 0 && v <= 1);
// 距离场：陆地 0、离岸单调
const d = chamferDistance(R); assert.ok(sampleGrid(R, d, -1, 3) > sampleGrid(R, d, -0.3, 3));

// 染料流：斜向均匀来流（0.6 rad）→ MAC 投影成绕岛无散度流
const F = new ObstacleFlow(R, { speed: 0.8, angle: 0.6 });
console.log(F.stats);
assert.equal(F.stats.wallFlux, 0, '陆地面通量恒为 0（固壁不可穿透）');
assert.ok(F.stats.divAfter < F.stats.divBefore * 0.05, `投影后散度大幅下降 ${F.stats.divBefore} → ${F.stats.divAfter}`);
const k = (x, z) => Math.round((z - R.minZ) / R.res) * R.W + Math.round((x - R.minX) / R.res);
// 岛西岸迎流面贴岸：法向（x）分量被压掉、沿岸（z）分量占主导
const kWest = k(-0.03, 1.0);
assert.ok(Math.abs(F.vx[kWest]) < 0.5 * Math.abs(F.vz[kWest]) && F.vz[kWest] > 0, `迎流面贴岸转向 vx=${F.vx[kWest]} vz=${F.vz[kWest]}`);
// 相对来流方向的两侧（垂线 ±4.3）绕流加速；正前方驻点减速
const spd = (x, z) => Math.hypot(F.vx[k(x, z)], F.vz[k(x, z)]);
const sideA = spd(1.1, 6.4), sideB = spd(5.9, -0.4), front = spd(-0.15, -0.15);
console.log({ sideA, sideB, front });
assert.ok(sideA > 0.85 && sideB > 0.85, `两侧加速 ${sideA} ${sideB}`);
assert.ok(front < 0.6, `迎流角驻点减速 ${front}`);
const kFar = k(-1.9, -1.9); assert.ok(Math.abs(Math.hypot(F.vx[kFar], F.vz[kFar]) - 0.8) < 0.2, '远处接近来流');
const landK = k(1.5, 1.5), before = [...F.dye.slice(landK * 3, landK * 3 + 3)];
const dye0 = F.dye.slice();
for (let i = 0; i < 40; i++) F.step(1 / 20);
assert.deepEqual([...F.dye.slice(landK * 3, landK * 3 + 3)], before, '陆地不被染料改写');
// 色带平行于来流：远海（均匀流）色带不动；近岸被岸线拨弯 → 颜色明显改变
let nearMax = 0, farMax = 0;
for (let q = 0; q < R.W * R.H; q++) {
  if (R.mask[q]) continue;
  const ch = Math.hypot(F.dye[q * 3] - dye0[q * 3], F.dye[q * 3 + 1] - dye0[q * 3 + 1], F.dye[q * 3 + 2] - dye0[q * 3 + 2]);
  const i = q % R.W, j = (q / R.W) | 0, edge = Math.min(i, j, R.W - 1 - i, R.H - 1 - j) * R.res;
  const along = (R.minX + i * R.res) * Math.cos(0.6) + (R.minZ + j * R.res) * Math.sin(0.6);   // 岛最上游点 along=0
  if (F.dist[q] < 1) nearMax = Math.max(nearMax, ch); else if (along < -1.2 && F.dist[q] > 1.5 && ch > farMax) { farMax = ch; globalThis.farAt = [R.minX + i * R.res, R.minZ + j * R.res, F.vx[q], F.vz[q], F.dist[q]]; }
}
console.log({ nearMax, farMax, at: globalThis.farAt });
assert.ok(nearMax > 0.3, '近岸色带被拨弯');
assert.ok(farMax < nearMax / 3, '上游远处色带变化远小于近岸（势流分流 + 双线性数值扩散）');
for (const v of F.dye) assert.ok(Number.isFinite(v) && v >= -1e-6 && v <= 1 + 1e-6);
// 存储精度：f16 与 f64 参考的偏差可量出来，且很小
const ref = new ObstacleFlow(R, { speed: 0.8, angle: 0.6, storage: 'f64' }), h = new ObstacleFlow(R, { speed: 0.8, angle: 0.6, storage: 'f16' });
for (let i = 0; i < 20; i++) { ref.step(1 / 20); h.step(1 / 20); }
let maxErr = 0; for (let i = 0; i < ref.dye.length; i++) maxErr = Math.max(maxErr, Math.abs(ref.dye[i] - h.dye[i]));
console.log({ f16MaxErr: maxErr });
assert.ok(maxErr > 0 && maxErr < 0.02, 'f16 存储误差可测且有界');
assert.throws(() => new ObstacleFlow(R, { storage: 'u8' }), RangeError);
console.log('foam-mask-c10 ok');
// 浪带路径穿岸审计：一条正常（海里 → 岸边）一条穿过独石
{
  const { auditWavePaths } = await import('../src/water/foam-mask.js');
  const ok = auditWavePaths(R, [-0.05, 3], [-1.0, 3]);
  assert.equal(ok.crossing, 0, '正常浪带不穿岸');
  const bad = auditWavePaths(R, [10.9, 3], [12.5, 3]);   // 从独石西岸穿过独石到东侧
  assert.equal(bad.crossing, 1); assert.ok(bad.worst > 0.3);
}
console.log('audit ok');
// 防穿岸修复：穿过独石的路径被收回到碰陆前，aIn/aOut 同比缩放，修复后审计为 0
{
  const { auditWavePaths, clampWavePaths } = await import('../src/water/foam-mask.js');
  const shore = [10.9, 3, -0.05, 3], sea = [12.5, 3, -1.0, 3], inc = [1.6, 0, -0.95, 0], out = [-1.6, 0.2, 0.95, 0];
  const n = clampWavePaths(R, shore, sea, inc, out);
  assert.equal(n, 1, '只收回穿岸那一条');
  assert.ok(sea[0] > 10.9 && sea[0] < 11.0 + R.res, `蓝线点收回到独石西岸前 ${sea[0]}`);
  const k = inc[0] / 1.6; assert.ok(Math.abs(out[0] / -1.6 - k) < 1e-9 && Math.abs(out[1] / 0.2 - k) < 1e-9, 'aOut 同比缩放');
  assert.deepEqual([sea[2], inc[2], out[2]], [-1.0, -0.95, 0.95], '正常路径不动');
  assert.equal(auditWavePaths(R, shore, sea).crossing, 0, '修复后不穿岸');
}
console.log('clamp ok');
