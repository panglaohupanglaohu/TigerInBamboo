// cave-light.mjs — 906416813810049025 的「洞内光照」层（src/light/cave-light.js）。
// 真岛（generateBadNorth caves:3）上验四件事：
//   ① 洞口 factor≈1、洞身最暗处 = 1−strength（暗一档，不是全黑）；
//   ② 从洞口往里是**渐变**（相邻采样无硬边），两端洞口的穿山拱在中点最暗、左右对称；
//   ③ 洞外/洞顶上方/横向洞壁之外一律 1（不能把台面一起压暗）；
//   ④ applyCaveLight 真按顶点坐标乘色（顶点数与系数一致，且不动 pos）。
import assert from 'node:assert/strict';
const { World } = await import('./fixtures/g5-battle.mjs');
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { generateBadNorth } = await import('../src/badnorth/island.js');
const { planCaveLight, caveShadeAt, applyCaveLight, caveLightReport, insideTunnel } = await import('../src/light/cave-light.js');
const L = 0.5;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const out = {};

for (const kind of ['quad', 'mixed']) {
  let done = 0;
  for (const seed of [7, 11, 5, 21, 33]) {
    const grid = (kind === 'mixed' ? buildMixedGrid : buildQuadGrid)({ radius: kind === 'mixed' ? 9 : 8, seed });
    decorateCells(grid);
    const world = new World(grid);
    generateBadNorth(world, seed, { caves: 3 });
    // 洞穴变体不是每个 seed 都挖得出来（岸上要有「高台紧邻低地」的崖脚），挖不出的跳过不计
    if (!world.bnCaves?.length) continue;
    done++;
    const plan = world.caveLight;
    assert.ok(plan && plan.tunnels.length, `${kind}/${seed} 生成时挂上 world.caveLight`);
    const rep = caveLightReport(plan);
    const tag = `${kind}/${seed}`;

    for (const t of plan.tunnels) {
      const yMid = (t.floor + 0.5) * L;
      const head = t.poly[0];
      const tail = t.poly[t.poly.length - 1];
      const atMouth = caveShadeAt(plan, head.x, yMid, head.z);
      assert.ok(atMouth > 0.995, `${tag} 洞口 factor≈1（${atMouth}）`);
      // 沿**洞轴折线**采样（隧道会拐弯，不能拿首尾直线当轴）：单调不增或先减后增，且无硬跳
      const N = 60, f = [];
      const along = (s) => {
        let i = 1;
        while (i < t.poly.length - 1 && t.cum[i] < s) i++;
        const seg = Math.max(1e-6, t.cum[i] - t.cum[i - 1]), u = Math.max(0, Math.min(1, (s - t.cum[i - 1]) / seg));
        return { x: t.poly[i - 1].x + (t.poly[i].x - t.poly[i - 1].x) * u, z: t.poly[i - 1].z + (t.poly[i].z - t.poly[i - 1].z) * u };
      };
      for (let i = 0; i <= N; i++) {
        const p = along((t.len * i) / N);
        f.push(caveShadeAt(plan, p.x, yMid, p.z));
      }
      let maxStep = 0;
      for (let i = 1; i <= N; i++) maxStep = Math.max(maxStep, Math.abs(f[i] - f[i - 1]));
      assert.ok(maxStep < 0.06, `${tag} 洞口渐变无硬边（最大步进 ${maxStep.toFixed(4)}）`);
      const midF = f[(N / 2) | 0];
      if (t.mouthCount >= 2) {
        assert.ok(near(f[0], f[N], 0.02), `${tag} 两端对称（${f[0].toFixed(3)} vs ${f[N].toFixed(3)}）`);
        assert.ok(midF < f[0] - 0.2, `${tag} 中点明显更暗（${f[0].toFixed(3)}→${midF.toFixed(3)}）`);
        assert.ok(near(midF, 1 - t.strength, 0.02), `${tag} 最暗处 = 1−strength（${midF.toFixed(3)} vs ${(1 - t.strength).toFixed(3)}）`);
      } else {
        assert.ok(f[N] < f[0] - 0.2, `${tag} 单口洞往里更暗`);
      }
      // 洞顶上方 / 洞口横向之外 / 地板以下：都不许被压暗
      assert.equal(caveShadeAt(plan, head.x, (t.floor + 3) * L + 0.3, head.z), 1, `${tag} 洞顶上方不压暗`);
      assert.equal(caveShadeAt(plan, head.x, t.floor * L - 0.3, head.z), 1, `${tag} 地板以下不压暗`);
      assert.equal(caveShadeAt(plan, head.x + 4.5, yMid, head.z + 4.5), 1, `${tag} 洞外横向不压暗`);
      // 竖剖面：洞底正上方越往上越暗（顶岩挡光），但顶面以上回到 1
      const inside = caveShadeAt(plan, head.x, t.floor * L + 0.05, head.z);
      const ceiling = caveShadeAt(plan, head.x, (t.floor + 2) * L - 0.05, head.z);
      assert.ok(inside > 0 && ceiling > 0 && inside <= 1 && ceiling <= 1, `${tag} 洞内上下都在 0..1`);
    }

    // —— 第 241 轮：面朝向判据（r240 的像素账：只按柱体判据会把洞口外立面一起压暗）——
    // 洞内表面（侧壁朝轴）压暗；同一位置但法线朝洞外 → 一律 1。
    const t2 = plan.tunnels[0];
    const tm = (() => {
      if (t2.poly.length === 1) return t2.poly[0];
      const s = t2.len / 2;
      for (let i = 1; i < t2.poly.length; i++) {
        if (t2.cum[i] >= s || i === t2.poly.length - 1) {
          const seg = Math.max(1e-6, t2.cum[i] - t2.cum[i - 1]), u = Math.max(0, Math.min(1, (s - t2.cum[i - 1]) / seg));
          return { x: t2.poly[i - 1].x + (t2.poly[i].x - t2.poly[i - 1].x) * u, z: t2.poly[i - 1].z + (t2.poly[i].z - t2.poly[i - 1].z) * u };
        }
      }
      return t2.poly[0];
    })();
    // 洞轴方向 → 侧向单位向量（洞内壁法线 = ±侧向；地板/洞顶 = ±y）
    const axx = t2.poly[t2.poly.length - 1].x - t2.poly[0].x, axz = t2.poly[t2.poly.length - 1].z - t2.poly[0].z;
    const axl = Math.hypot(axx, axz) || 1, lx = -axz / axl, lz = axx / axl;
    // 洞内壁的顶点在**格边界**上（不是洞轴中心）—— 先沿侧向走出洞体格矩形，再退回 2%
    let dOut = 0;
    while (dOut < 0.6 && insideTunnel(plan, tm.x + lx * (dOut + 0.005), tm.z + lz * (dOut + 0.005))) dOut += 0.005;
    const wx = tm.x + lx * dOut * 0.98, wz = tm.z + lz * dOut * 0.98;
    const yMid0 = (t2.floor + 0.5) * L;
    const wallF = caveShadeAt(plan, wx, yMid0, wz, [-lx, 0, -lz]);   // 朝轴 = 洞内壁
    const wallB = caveShadeAt(plan, wx, yMid0, wz, [lx, 0, lz]);     // 背轴 = 外立面
    assert.ok(wallF < 0.999, `${tag} 洞内壁（法线朝轴）压暗（${wallF.toFixed(3)}，离轴 ${dOut.toFixed(3)}）`);
    assert.equal(wallB, 1, `${tag} 同一位置法线朝洞外 → 不压暗（外立面，${wallB}）`);
    assert.equal(caveShadeAt(plan, wx, yMid0, wz), wallF, `${tag} 不给法线时退回柱体口径`);
    const floorF = caveShadeAt(plan, tm.x, t2.floor * L + 0.02, tm.z, [0, 1, 0]);
    const ceilF = caveShadeAt(plan, tm.x, (t2.floor + 2) * L - 0.02, tm.z, [0, -1, 0]);
    assert.ok(floorF < 0.999 && ceilF < 0.999, `${tag} 地板/洞顶（法线竖直）仍压暗（${floorF.toFixed(3)} / ${ceilF.toFixed(3)}）`);
    // 洞顶**上表面**（屋顶地面，y 正好在带的上沿、法线也朝上）不许压暗 —— r240 被误压的 24 个顶点就是这种
    const roofY = (t2.floor + 2) * L;
    assert.equal(caveShadeAt(plan, tm.x, roofY, tm.z, [0, 1, 0]), 1, `${tag} 洞顶上表面（法线朝上）不压暗`);
    assert.ok(caveShadeAt(plan, tm.x, roofY, tm.z, [0, -1, 0]) < 0.999, `${tag} 洞顶内表面（法线朝下）压暗`);
    assert.ok(insideTunnel(plan, tm.x, tm.z), `${tag} 洞轴中点落在洞体格矩形里`);

    // applyCaveLight 带法线：内壁顶点压暗、同点朝外的顶点被挡掉并计入 stats
    {
      const pos = [wx, yMid0, wz, wx, yMid0, wz], col = [1, 1, 1, 1, 1, 1];
      const nor = [-lx, 0, -lz, lx, 0, lz];
      const stats = { rejected: 0, shaded: 0 };
      const nn = applyCaveLight({ pos, col, normal: nor }, plan, nor, stats);
      assert.equal(nn, 1, `${tag} 带法线时只压暗朝内的那一个顶点（实 ${nn}）`);
      assert.equal(stats.rejected, 1, `${tag} 朝外的顶点计入 rejected（实 ${stats.rejected}）`);
      assert.deepEqual(col.slice(3), [1, 1, 1], `${tag} 朝外顶点颜色不动`);
    }

    const t0 = plan.tunnels.find((t) => t.mouthCount >= 2) || plan.tunnels[0];
    const yIn = (t0.floor + 1) * L;
    const pos = [], col = [];
    const pushV = (x, y, z) => { pos.push(x, y, z); col.push(1, 1, 1); };
    const mx = (t0.poly[0].x + t0.poly[t0.poly.length - 1].x) / 2, mz = (t0.poly[0].z + t0.poly[t0.poly.length - 1].z) / 2;
    pushV(mx, yIn, mz);                        // 洞身中段 → 最暗
    pushV(t0.poly[0].x, yIn, t0.poly[0].z);    // 洞口 → 1
    pushV(mx, (t0.floor + 3) * L + 0.4, mz);   // 洞顶上方 → 1
    pushV(mx + 5, yIn, mz + 5);                // 洞外 → 1
    const w = { pos, col };
    const n = applyCaveLight(w, plan);
    assert.equal(n, 1, `${tag} 只有洞身那一个顶点被压暗（实 ${n}）`);
    assert.ok(near(col[0], caveShadeAt(plan, mx, yIn, mz), 1e-6), `${tag} 乘色系数==caveShadeAt`);
    assert.deepEqual([col[3], col[6], col[9]], [1, 1, 1], `${tag} 其余顶点不动`);
    // 位置数组不许被改（只乘色）
    assert.deepEqual(pos, [mx, yIn, mz, t0.poly[0].x, yIn, t0.poly[0].z, mx, (t0.floor + 3) * L + 0.4, mz, mx + 5, yIn, mz + 5]);
    out[tag] = { tunnels: rep.tunnels, cells: rep.cells, dark: 1 - t0.strength, mid: rep.ts[0].atMid, mouths: rep.ts.map((x) => x.mouths) };
    if (done >= 2) break;
  }
  assert.ok(done >= 1, `${kind} 至少一个 seed 挖出洞穴（已验 ${done}）`);
}

// 没有洞 → 计划为 null，applyCaveLight 空转
const grid = buildQuadGrid({ radius: 6, seed: 3 }); decorateCells(grid);
const w2 = new World(grid); generateBadNorth(w2, 3, { caves: 0 });
assert.equal(w2.caveLight, null, '无洞时 world.caveLight 为 null');
assert.equal(planCaveLight({ bnCaves: null }), null, '无洞时 planCaveLight 返回 null');
assert.equal(applyCaveLight({ pos: [0, 1, 0], col: [1, 1, 1] }, null), 0, 'null 计划不改色');
assert.throws(() => planCaveLight({ bnCaves: [{ cells: [0], floor: 1 }] }, { strength: 2 }), RangeError, '强度越界报错');

console.log('PASS cave-light', JSON.stringify(out));
