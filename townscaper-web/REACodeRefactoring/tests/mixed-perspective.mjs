import assert from 'node:assert/strict';
import {
  perspectiveMatrix, viewMatrix, multiply, invert, withVerticalParallel,
  projectPoint, verticalEdge, quadWidths, compareProjection, projectionForRenderer,
} from '../src/core/mixed-perspective.js';

// 1310503825510367232 混合透视：远处变小(保留) + 竖线平行(新增)。
// 判据就是原文那两句话，别的一概不算。

const EYE = [0, 9, 13];
const TARGET = [0, 1.2, 0];
const FOV = 30;
const BASE = { eye: EYE, target: TARGET, fov: FOV, aspect: 1.6, near: 0.1, far: 500 };

// 1) 矩阵约定：P·V 必须把 target 送到画面中心，且与 three 的列主序一致
{
  const { stock, view } = compareProjection({ ...BASE, k: 0 });
  const c = projectPoint(stock, ...TARGET);
  assert.ok(c, 'target 应该可见');
  assert.ok(Math.abs(c.x) < 1e-6, 'target 应在画面水平中心：' + c.x);
  assert.ok(Math.abs(c.y) < 1e-6, 'target 应在画面垂直中心：' + c.y);

  // view 是正交矩阵：V⁻¹ = Vᵀ，用它反查 P·V 的构造没写反
  const inv = invert(view);
  assert.ok(inv, 'view 必须可逆');
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(multiply(view, inv)[i] - (i % 5 === 0 ? 1 : 0)) < 1e-9, 'V·V⁻¹ = I @' + i);
  const p = [0.7, 3.1, -2.4];
  const a = projectPoint(stock, ...p);
  const b = projectPoint(multiply(perspectiveMatrix(FOV, 1.6, 0.1, 500), view), ...p);
  assert.ok(Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12, 'compareProjection 与手搓乘积必须一致');
}

// 2) 原片症状：普通透视下竖线是收敛的（不设这条断言，"修好了"就没参照）
{
  const { stock } = compareProjection({ ...BASE, k: 0 });
  const near = verticalEdge(stock, 1.2, 4, 0, 3);
  assert.ok(near.driftNdc > 0.005, '普通透视的近处竖线应当可见地收敛，实测 ' + near.driftNdc);
  assert.ok(Math.abs(near.wRatio - 1) > 0.05, '普通透视里竖线两端 w 必须有差，实测 ' + near.wRatio);
  // 俯视相机下顶端更靠近机位（w 更小），所以竖线是朝下收的；这正是原片里要消掉的那种斜
  assert.ok(near.wRatio < 1, '俯视时竖线上端 w 应更小，实测 ' + near.wRatio);
}

// 3) k=1：同一根竖线上下端点屏幕 x 完全相同，且 w 沿 y 不变化
for (const [x, z] of [[0, 0], [1.2, 0], [-3, -4], [4.5, 6], [0, -9]]) {
  const { mixed } = compareProjection({ ...BASE, k: 1 });
  const e = verticalEdge(mixed, x, z, 0, 3);
  assert.ok(e, `竖线 (${x},${z}) 应该可见`);
  assert.ok(e.driftNdc < 1e-9, `k=1 竖线必须笔直：(${x},${z}) drift ${e.driftNdc}`);
  assert.ok(Math.abs(e.wRatio - 1) < 1e-9, `k=1 竖线两端 w 必须相同：${e.wRatio}`);
  // 上下端 y 仍然是分开的，说明不是把整根线压成一个点
  assert.ok(e.heightNdc > 0.02, '竖线高度不能塌成 0：' + e.heightNdc);
}

// 4) 中间档必须单调：收敛量随 k 递减，k=0 与不调用完全一致
{
  const { stock } = compareProjection({ ...BASE, k: 0 });
  let prev = Infinity;
  for (const k of [0, 0.25, 0.5, 0.75, 1]) {
    const m = withVerticalParallel(stock, k, TARGET[1]);
    const drift = verticalEdge(m, 2.2, -1, 0, 3).driftNdc;
    assert.ok(drift <= prev + 1e-12, `k=${k} 收敛量应单调不增：${drift} > ${prev}`);
    prev = drift;
  }
  assert.deepEqual(withVerticalParallel(stock, 0, TARGET[1]), stock, 'k=0 必须逐元素等于原矩阵');
  assert.deepEqual(withVerticalParallel(stock, -5, TARGET[1]), stock, '非法 k 按 0 处理');
  assert.deepEqual(withVerticalParallel(stock, NaN, TARGET[1]), stock, 'NaN k 按 0 处理');
}

// 5) pivotY 那一行的 w 必须被保住，否则整幅画面会上下漂移
{
  const { stock } = compareProjection({ ...BASE, k: 0 });
  const m = withVerticalParallel(stock, 1, TARGET[1]);
  for (const x of [-4, 0, 3.5]) {
    const a = projectPoint(stock, x, TARGET[1], 0);
    const b = projectPoint(m, x, TARGET[1], 0);
    assert.ok(Math.abs(a.w - b.w) < 1e-9, '基准行 w 必须不变');
    assert.ok(Math.abs(a.x - b.x) < 1e-9, '基准行屏幕 x 必须不变');
  }
}

// 6) 原文的"近大远小"这一点必须活着：远处同尺寸房子仍要更小，且基准行上的水平缩放不变
let depthScale = [];
{
  const { stock, mixed } = compareProjection({ ...BASE, k: 1 });
  const pivot = TARGET[1];
  const width = (m, z, y) => {
    const l = projectPoint(m, -1, y, z), r = projectPoint(m, 1, y, z);
    return Math.abs(r.x - l.x);
  };
  for (const z of [6, 0, -6, -12]) {
    depthScale.push({ z, stock: width(stock, z, pivot), mixed: width(mixed, z, pivot) });
  }
  for (let i = 1; i < depthScale.length; i++) {
    assert.ok(depthScale[i].stock < depthScale[i - 1].stock * 0.92, 'z=' + depthScale[i].z + ' 应该明显更小');
    assert.ok(depthScale[i].mixed < depthScale[i - 1].mixed * 0.92, 'k=1 时远处也必须变小（不能退化成正交）');
  }
  // 混合透视只动 w 行的 y 项、并以 pivotY 那一行为基准：基准行上的宽度必须与透视逐值相同
  for (const d of depthScale) assert.ok(Math.abs(d.mixed - d.stock) < 1e-12, '基准行水平宽度不该被改：z=' + d.z);
  // 反过来，基准行以外必须确实被改过（否则等于没做事）
  const offPivot = Math.abs(width(mixed, 0, 3) - width(stock, 0, 3));
  assert.ok(offPivot > 1e-6, '基准行以外的宽度应当被改写，实测差 ' + offPivot);
  // 竖直广告牌的上沿收窄率：透视 >0，k=1 必须为 0
  const sTaper = quadWidths(stock, 0, 1, 0, 3).taperPct;
  const mTaper = quadWidths(mixed, 0, 1, 0, 3).taperPct;
  assert.ok(Math.abs(sTaper) > 3, '普通透视的竖直面上沿必须与下沿不等宽，实测 ' + sTaper.toFixed(2) + '%');
  assert.ok(Math.abs(mTaper) < 1e-9, 'k=1 上沿收窄率必须为 0，实测 ' + mTaper);
}

// 7) 渲染器接口：P' = M'·V⁻¹，P'·V 必须逐元素回到 M'
{
  const { mixed, view } = compareProjection({ ...BASE, k: 1 });
  const P2 = projectionForRenderer(mixed, view);
  assert.ok(P2, '折回投影矩阵不应失败');
  const back = multiply(P2, view);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(back[i] - mixed[i]) < 1e-9, 'P\'·V 必须等于混合后的视图投影 @' + i);
  // 越界保护
  assert.equal(projectionForRenderer(mixed, new Array(16).fill(0)), null);
}

// 8) 退化输入不许炸
{
  assert.equal(projectPoint(withVerticalParallel(perspectiveMatrix(30, 1, .1, 500), 1, 0), 0, 0, 0), null);
  assert.equal(verticalEdge(perspectiveMatrix(30, 1, .1, 500), 0, 0, 1, 0), null);
  assert.equal(quadWidths(perspectiveMatrix(30, 1, .1, 500), 0, 1, 0, 3), null);
}

console.log('PASS mixed perspective: verticals straight (drift<1e-9) at 5 placements x k grid, depth shrink preserved, pivot row pinned, P\'=M\'V⁻¹ exact');
console.log(depthScale.map((d) => ({ z: d.z, stockW: +d.stock.toFixed(4), mixedW: +d.mixed.toFixed(4) })));
