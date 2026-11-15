// 占位场 → 等值面 + 碎块崩解重组（纯逻辑）
// 依据片：818857408848130048 / 832633189277409280
import assert from 'node:assert/strict';
import {
  makeField, rasterizeBoxes, blurField, surfaceNets, meshVolume, meshBounds,
  edgeManifold, normalTiltShare, chunkPlan, morphField, shrinkBoxes,
} from '../src/core/field-surface.js';

const BOX = { x: 2, y: 2, z: 2, w: 8, h: 6, d: 8 };
const build = (blur = 0) => {
  const f = makeField([20, 14, 20]);
  rasterizeBoxes(f, [BOX]);
  if (blur > 0) blurField(f, { passes: blur, radius: 1 });
  return f;
};

// 1. 闭合性：每条无向边恰好两个四边形共用；法线朝外（体积为正、量级对得上）
{
  const m = surfaceNets(build(0));
  const man = edgeManifold(m);
  assert.equal(man.openEdges, 0, '有开口边');
  assert.equal(man.nonManifold, 0, '有非流形边');
  const vol = meshVolume(m);
  assert.ok(vol > 0, '体积为负说明绕向反了');
  assert.ok(Math.abs(vol - 384) / 384 < 0.12, `体积应≈8×6×8=384，实测 ${vol.toFixed(1)}`);
  // 欧拉特征：闭合且亏格 0
  assert.equal(m.verts - man.edges + m.faces, 2, `欧拉特征不是 2：${m.verts}-${man.edges}+${m.faces}`);
  console.log(`✓ 闭合网格 ${m.verts} 顶点 / ${m.faces} 面 / 体积 ${vol.toFixed(1)}（理想 384）`);
}

// 2. 模糊 = 圆角：斜法线占比上升、体积/包围盒比下降（片子里的"柱顶半球、崖棱倒角"）
{
  const cells = [0, 2, 3].map((b) => surfaceNets(build(b)));
  const tilt = cells.map((m) => normalTiltShare(m, 30));
  assert.ok(tilt[1] > tilt[0] && tilt[2] > tilt[1], `斜法线占比没有随模糊上升：${tilt.map((v) => v.toFixed(3))}`);
  const fill = cells.map((m) => {
    const b = meshBounds(m);
    return meshVolume(m) / ((b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0));
  });
  assert.ok(fill[0] > 0.9, `未模糊时填充率应接近 1，实测 ${fill[0].toFixed(3)}`);
  assert.ok(fill[2] < 0.7, `模糊三遍后角被切掉、填充率应明显下降，实测 ${fill[2].toFixed(3)}`);
  assert.ok(fill[1] < fill[0] && fill[2] < fill[1], `填充率应单调下降：${fill.map((v) => v.toFixed(3))}`);
  console.log(`✓ 圆角：斜法线占比 ${tilt.map((v) => v.toFixed(3)).join(' → ')}，填充率 ${fill.map((v) => v.toFixed(3)).join(' → ')}`);
}

// 3. 收缩：s=1 原样、s=0 清空、中间保持中心不动
{
  const s = shrinkBoxes([{ x: 4, y: 0, z: 4, w: 8, h: 6, d: 8 }], 0.5);
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].w, s[0].h, s[0].d], [4, 3, 4]);
  assert.deepEqual([s[0].x, s[0].z], [6, 6], '收缩要绕自身中心');
  assert.equal(shrinkBoxes([BOX], 0).length, 0);
  assert.deepEqual(shrinkBoxes([BOX], 1)[0], BOX);
  console.log('✓ 收缩绕中心、s=0 清空');
}

// 4. 过渡：两端各自等同单一形态，中段明显清空且碎块悬空；区块划分定种子可复现
{
  const A = [{ x: 2, y: 0, z: 2, w: 8, h: 4, d: 8 }, { x: 4, y: 4, z: 5, w: 3, h: 6, d: 3 }];
  const B = [{ x: 12, y: 0, z: 2, w: 7, h: 7, d: 7 }, { x: 2, y: 0, z: 12, w: 5, h: 3, d: 5 }];
  const dims = [24, 18, 24];
  const plan = chunkPlan(A, B, { chunk: 4, seed: 3, dur: 0.55, gap: 0.4 });
  assert.deepEqual(plan.map((c) => c.key), chunkPlan(A, B, { chunk: 4, seed: 3, dur: 0.55, gap: 0.4 }).map((c) => c.key), '同种子应得到同样区块');

  const run = (t) => {
    const f = makeField(dims);
    const st = morphField(f, plan, t, { lift: 3 });
    const m = surfaceNets(f);
    return { st, m, top: m.verts ? meshBounds(m).y1 : 0 };
  };
  const t0 = run(0), t1 = run(1), mid = run(0.42);
  assert.equal(t0.st.oldChunks, plan.length, 't=0 应全部是旧形态');
  assert.equal(t1.st.newChunks, plan.length, 't=1 应全部是新形态');

  const count = (boxes) => { const f = makeField(dims); rasterizeBoxes(f, boxes); let n = 0; for (const v of f.data) if (v >= 0.5) n++; return n; };
  assert.equal(t0.st.solid, count(A), 't=0 实心格数应等于形态 A');
  assert.equal(t1.st.solid, count(B), 't=1 实心格数应等于形态 B');

  assert.ok(mid.st.solid < Math.min(t0.st.solid, t1.st.solid) * 0.5, `中段应明显清空：${mid.st.solid} vs ${t0.st.solid}/${t1.st.solid}`);
  assert.ok(mid.st.airborne > 0, '中段应有悬空碎块');
  assert.ok(mid.st.oldChunks > 0 && mid.st.newChunks > 0, '中段应同时存在旧块与新块');
  assert.ok(mid.st.airborne <= plan.length);
  console.log(`✓ 过渡：实心格 ${t0.st.solid} → ${mid.st.solid} → ${t1.st.solid}，中段空中 ${mid.st.airborne}/${plan.length} 块，旧 ${mid.st.oldChunks} 新 ${mid.st.newChunks}`);
}

// 5. 顶点落点：等值面顶点必须紧贴 0.5 等值面（格子代表点偏一格就全废）
{
  const f = build(1);
  const m = surfaceNets(f);
  const at = (x, y, z) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    const tx = x - x0, ty = y - y0, tz = z - z0;
    const g = (i, j, k) => f.data[(Math.min(f.nz - 1, Math.max(0, k)) * f.ny + Math.min(f.ny - 1, Math.max(0, j))) * f.nx + Math.min(f.nx - 1, Math.max(0, i))];
    const c00 = g(x0, y0, z0) * (1 - tx) + g(x0 + 1, y0, z0) * tx;
    const c10 = g(x0, y0 + 1, z0) * (1 - tx) + g(x0 + 1, y0 + 1, z0) * tx;
    const c01 = g(x0, y0, z0 + 1) * (1 - tx) + g(x0 + 1, y0, z0 + 1) * tx;
    const c11 = g(x0, y0 + 1, z0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1, z0 + 1) * tx;
    return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
  };
  let worst = 0;
  for (let i = 0; i < m.positions.length; i += 3) {
    worst = Math.max(worst, Math.abs(at(m.positions[i], m.positions[i + 1], m.positions[i + 2]) - 0.5));
  }
  assert.ok(worst < 0.2, `顶点偏离 0.5 等值面最远 ${worst.toFixed(3)} 格`);
  console.log(`✓ 顶点贴面：最大偏离 ${worst.toFixed(3)} 格`);
}

console.log('field-surface PASS');
