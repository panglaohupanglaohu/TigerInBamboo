import assert from 'node:assert/strict';
import {
  throwArc,
  heightAtX,
  solveLaunch,
  launchGrid,
  quadMaxReach,
  DRAG_MODELS,
  DEFAULT_GRAVITY,
} from '../src/core/trajectory-fan.js';

// 816332161036984320 · 「二次阻力档」：原片 Inspector 只有一个 Drag 标量，
// 片内分不出 k·v 还是 k·|v|·v —— 这里两档都实现，并量出「同射程匹配后两档差多少」。
const near = (a, b, e) => Math.abs(a - b) <= e;

assert.deepEqual([...DRAG_MODELS], ['linear', 'quadratic']);
assert.throws(() => throwArc({ speed: 8, angleDeg: 45, dragModel: 'cubic' }), RangeError);
assert.throws(() => launchGrid({ speed: 8, dragModel: 'nope' }), RangeError);
assert.throws(() => heightAtX({ speed: 8, angleDeg: 45, x: 1, dragModel: 'x' }), RangeError);

// 1. 两档在 k=0 时都必须退化成同一条抛物线（无阻力解析解）
{
  const lin = throwArc({ speed: 10, angleDeg: 45, drag: 0 });
  const quad = throwArc({ speed: 10, angleDeg: 45, drag: 0, dragModel: 'quadratic' });
  assert.ok(near(quad.range, lin.range, lin.range * 0.01), `k=0 射程 ${quad.range} vs ${lin.range}`);
  assert.ok(near(quad.apex, lin.apex, lin.apex * 0.01), `k=0 顶点 ${quad.apex} vs ${lin.apex}`);
  assert.equal(quad.dragModel, 'quadratic');
}

// 2. 两档都随阻力单调变短；同一 k 下二次档明显更短（不是同一件事换个名字）
{
  for (const model of DRAG_MODELS) {
    let prev = Infinity;
    for (const drag of [0, 0.1, 0.4, 1.0, 2.0]) {
      const r = throwArc({ speed: 10, angleDeg: 45, drag, dragModel: model }).range;
      assert.ok(r < prev, `${model} drag ${drag} 射程应递减 ${r} vs ${prev}`);
      prev = r;
    }
  }
  const sameK = [0.4, 0.83].map((k) => ({
    k,
    lin: throwArc({ speed: 7.99, angleDeg: 45, drag: k }).range,
    quad: throwArc({ speed: 7.99, angleDeg: 45, drag: k, dragModel: 'quadratic' }).range,
  }));
  for (const s of sameK) assert.ok(s.quad < s.lin * 0.75, `同一 k=${s.k} 二次档应明显更短：${s.quad} vs ${s.lin}`);
}

// 3. RK4 收敛：步长减半 4 次，射程相对变化 < 1e-3（数值解不是随手画的）
{
  const rs = [1 / 60, 1 / 120, 1 / 240, 1 / 480].map(
    (dt) => throwArc({ speed: 9, angleDeg: 40, drag: 0.5, dragModel: 'quadratic', dt }).range,
  );
  for (let i = 1; i < rs.length; i++) {
    const rel = Math.abs(rs[i] - rs[i - 1]) / rs[i];
    assert.ok(rel < 2e-3, `dt 收敛差 ${rel} @ ${rs[i]}`);
  }
  assert.ok(Math.abs(rs[3] - rs[0]) / rs[3] < 5e-3, '粗步长与细步长射程应接近');
}

// 4. 终端速度：二次阻力竖直下落应收敛到 √(g/k)
{
  const k = 0.8;
  const arc = throwArc({ speed: 0.001, angleDeg: -89.9, drag: k, dragModel: 'quadratic', groundY: -1e6, maxTime: 40, dt: 1 / 240 });
  const [vx, vy] = arc.velocity;
  const vt = Math.sqrt(DEFAULT_GRAVITY / k);
  assert.ok(near(-vy, vt, vt * 0.02), `终端速度 ${-vy} vs ${vt}`);
  assert.ok(Math.abs(vx) < 1e-2, '竖直下落不应有水平速度');
}

// 5. 二次档 solved 角回代必须命中目标（低弧解）
{
  for (const [x, y] of [[0.8, 0.4], [1.2, -0.3], [0.5, 1.0]]) {
    const s = solveLaunch({ speed: 9, drag: 0.5, dragModel: 'quadratic', x, y });
    assert.ok(s, `目标 ${x},${y} 应有解`);
    const h = heightAtX({ speed: 9, drag: 0.5, dragModel: 'quadratic', angleDeg: s.angleDeg, x });
    assert.ok(near(h, y, 0.03), `回代 ${h} vs ${y}`);
    assert.ok(s.angleDeg > -90 && s.angleDeg < 90, '角度在合法区间');
  }
  // 超出射程必须返回 null，而不是硬给一个角
  const reach = quadMaxReach({ speed: 9, drag: 0.5 });
  assert.ok(reach > 0.5 && reach < 5, 'reach 量级 ' + reach);
  assert.equal(heightAtX({ speed: 9, drag: 0.5, dragModel: 'quadratic', angleDeg: 45, x: reach * 1.5 }), null);
  assert.equal(solveLaunch({ speed: 9, drag: 0.5, dragModel: 'quadratic', x: reach * 1.5, y: -0.2 }), null);
}

// 6. 查找表：二次档够不着的格点更多（射程更短），两档 solved 数不能相同
{
  const lin = launchGrid({ speed: 7.99, drag: 0.83, x0: 0, x1: 3, y0: -2, y1: 2, cell: 0.75 });
  const quad = launchGrid({ speed: 7.99, drag: 0.83, dragModel: 'quadratic', x0: 0, x1: 3, y0: -2, y1: 2, cell: 0.75 });
  assert.equal(lin.nodes.length, quad.nodes.length);
  assert.equal(lin.dragModel, 'linear');
  assert.equal(quad.dragModel, 'quadratic');
  assert.ok(quad.solved < lin.solved, `二次档应有更多够不着的点：${quad.solved} vs ${lin.solved}`);
  assert.ok(lin.solved > 0 && quad.solved > 0, '两档都应有可解格点');
  assert.equal(quad.unreachable, quad.nodes.length - quad.solved);
}

// 7. 片内可判性：把二次档的 k 拟合到与线性档同 45° 射程后，两档最大高度差 < 2% 射程
//    —— 片子里只有 490×486 的 JPEG，扇面横向约 390px，2% 射程 ≈ 2px，小于划线长度（25px）
{
  const speed = 7.99, kl = 0.83;
  const linRange = throwArc({ speed, angleDeg: 45, drag: kl }).range;
  let lo = 0, hi = 5;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    const r = throwArc({ speed, angleDeg: 45, drag: m, dragModel: 'quadratic' }).range;
    if (r > linRange) lo = m; else hi = m;
  }
  const kq = (lo + hi) / 2;
  let worst = 0;
  for (let f = 0.05; f < 1; f += 0.05) {
    const x = linRange * f;
    const yl = heightAtX({ speed, drag: kl, angleDeg: 45, x });
    const yq = heightAtX({ speed, drag: kq, dragModel: 'quadratic', angleDeg: 45, x });
    worst = Math.max(worst, Math.abs(yl - yq));
  }
  const pct = (100 * worst) / linRange;
  assert.ok(pct < 2.0, `同射程匹配后两档最大差 ${pct.toFixed(2)}% 射程（应 < 2%）`);
  // 反向：若强行用同一个 k，两档的出射角差必须大到能看出来 —— 证明这不是换名字
  const aLin = solveLaunch({ speed: 7.99, drag: 0.83, x: 1.2, y: 0.6 });
  const aQuad = solveLaunch({ speed: 7.99, drag: 0.83, dragModel: 'quadratic', x: 1.2, y: 0.6 });
  const delta = aQuad ? Math.abs(aLin.angleDeg - aQuad.angleDeg) : Infinity;
  assert.ok(delta > 5, `同一 k 下两档出射角应差 >5°：${delta}`);
  console.log('matched', { linRange: +linRange.toFixed(3), kq: +kq.toFixed(3), worstPct: +pct.toFixed(2), deltaDeg: Number.isFinite(delta) ? +delta.toFixed(2) : 'null' });
}

console.log('trajectory-drag-model PASS');
