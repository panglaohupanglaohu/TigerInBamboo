// 距离场等值线（902103473365417984 "Distances this time"）逻辑验收
import { distanceField, isoContours, evenLevels } from '../src/core/distance-isolines.js';

let pass = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) { console.error('FAIL', label, extra); process.exit(1); }
  pass++; console.log('ok  ', label, extra);
};
const close = (a, b, tol) => Math.abs(a - b) <= tol;

// 1. 满格 9×9：距离 = 到岛外最近格心距离，中心 5、角 1
{
  const w = 9, h = 9, mask = new Array(w * h).fill(1);
  const f = distanceField(mask, { w, h });
  ok('满格中心距离 5', close(f.dist[4 * w + 4], 5, 1e-6), `got ${f.dist[4 * w + 4]}`);
  ok('满格角距离 1', close(f.dist[0], 1, 1e-6), `got ${f.dist[0]}`);
  ok('最远距离 5', close(f.max, 5, 1e-6), `got ${f.max}`);
}

// 2. 与暴力最近格心距离逐格比对（随机遮罩）
{
  const w = 17, h = 13, mask = [];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < w * h; i++) mask.push(rnd() > 0.28 ? 1 : 0);
  const f = distanceField(mask, { w, h });
  let worst = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    let best = Infinity;
    for (let by = -1; by <= h; by++) for (let bx = -1; bx <= w; bx++) {
      const inside = bx >= 0 && bx < w && by >= 0 && by < h;
      const blocked = !inside || !mask[by * w + bx];
      if (blocked) best = Math.min(best, Math.hypot(bx - x, by - y));
    }
    worst = Math.max(worst, Math.abs(f.dist[y * w + x] - best));
  }
  ok('EDT 与暴力解一致', worst < 1e-4, `max err ${worst.toExponential(2)}`);
}

// 3. 单级等值线：满格 9×9 上 level 2.5 是一条闭合的倒角方框
//    （marching squares 在格子距离场上会切角，不是理想矩形，断言按实际几何写）
{
  const w = 9, h = 9, mask = new Array(w * h).fill(1);
  const f = distanceField(mask, { w, h });
  const [L] = isoContours(f, { levels: [2.5] });
  ok('单级闭合', L.closed === 1 && !L.openEnds, `closed ${L.closed} open ${L.openEnds}`);
  const xs = L.segments.flatMap(([x1, , x2]) => [x1, x2]), ys = L.segments.flatMap(([, y1, , y2]) => [y1, y2]);
  ok('包围盒左=level-1', close(Math.min(...xs), 1.5, 1e-6), `got ${Math.min(...xs).toFixed(3)}`);
  ok('包围盒右=w-level', close(Math.max(...xs), 6.5, 1e-6), `got ${Math.max(...xs).toFixed(3)}`);
  ok('包围盒上下对称', close(Math.min(...ys), 1.5, 1e-6) && close(Math.max(...ys), 6.5, 1e-6));
  let per = 0;
  for (const [x1, y1, x2, y2] of L.segments) per += Math.hypot(x2 - x1, y2 - y1);
  // 4 条直边各 4 + 4 个 0.5 切角
  ok('倒角方框周长', close(per, 16 + 4 * Math.SQRT1_2, 0.02), `got ${per.toFixed(3)}`);
  const worst = Math.max(...L.segments.flatMap(([x1, y1, x2, y2]) => [Math.abs(f.at(x1, y1) - 2.5), Math.abs(f.at(x2, y2) - 2.5)]));
  ok('线上采样值=等值', worst < 1e-3, `max dev ${worst.toExponential(2)}`);
}

// 4. 越界等值与空遮罩
{
  const w = 9, h = 9, f = distanceField(new Array(w * h).fill(1), { w, h });
  const [L] = isoContours(f, { levels: [8] });
  ok('超出最远距离无线段', L.segments.length === 0, `seg ${L.segments.length}`);
  const g = distanceField(new Array(w * h).fill(0), { w, h });
  ok('全遮罩场为 0', g.max === 0);
  ok('全遮罩无等值线', isoContours(g, { levels: [1] })[0].segments.length === 0);
}

// 5. 中间挖一格：等值线绕洞，同时外层岛缘还有一圈 → 至少两个闭环
{
  const w = 11, h = 11, mask = new Array(w * h).fill(1);
  mask[5 * w + 5] = 0;
  const f = distanceField(mask, { w, h });
  ok('洞旁距离 1', close(f.dist[5 * w + 4], 1, 1e-6), `got ${f.dist[5 * w + 4]}`);
  ok('洞对角距离 √2', close(f.dist[4 * w + 4], Math.SQRT2, 1e-6), `got ${f.dist[4 * w + 4]}`);
  const [L] = isoContours(f, { levels: [1.2] });
  ok('绕洞+岛缘两个闭环', L.closed >= 2, `closed ${L.closed}`);
  const pts = L.segments.flat();
  const inside = pts.filter((_, i) => i % 2 === 0).every((x, k) => x >= 0 && x <= w - 1) && pts.filter((_, i) => i % 2 === 1).every((y) => y >= 0 && y <= h - 1);
  ok('等值线不越出网格', inside);
}

// 6. 等距层级：间距等分、不越界
{
  ok('evenLevels 等距', JSON.stringify(evenLevels(5, 1)) === JSON.stringify([1, 2, 3, 4, 5]), JSON.stringify(evenLevels(5, 1)));
  ok('evenLevels 截断', JSON.stringify(evenLevels(4.9, 1)) === JSON.stringify([1, 2, 3, 4]));
  const levels = evenLevels(4, 0.5);
  const f = distanceField(new Array(9 * 9).fill(1), { w: 9, h: 9 });
  const out = isoContours(f, { levels });
  ok('多级条数一致', out.length === levels.length);
  // 边界格距离正好 1，level<1 的线在网格外（无格可用）→ 只有 0 段
  ok('level<1 无线段', out.filter((L, i) => levels[i] < 1).every((L) => !L.segments.length));
  const inner = out.filter((L, i) => levels[i] > 1);
  ok('level>1 各层单闭环', inner.every((L) => L.closed === 1), inner.map((L) => L.closed).join(','));
  const per = inner.map((L) => L.segments.reduce((s, [x1, y1, x2, y2]) => s + Math.hypot(x2 - x1, y2 - y1), 0));
  const monotone = per.every((p, i) => i === 0 || p < per[i - 1]);
  ok('越靠内周长越短', monotone, per.map((p) => p.toFixed(1)).join(' → '));
}

console.log(`PASS distance-isolines ${pass} checks`);
