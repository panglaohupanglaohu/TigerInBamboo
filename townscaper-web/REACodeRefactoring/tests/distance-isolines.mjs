// 距离场等值线（902103473365417984 "Distances this time"）逻辑验收
import { distanceField, isoContours, evenLevels, polygonDistance } from '../src/core/distance-isolines.js';

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

// 7. 任意多边形占地：polygonDistance 有向距离（负=内部），凸/凹/斜边全支持
{
  const sq = [[2, 2], [6, 2], [6, 6], [2, 6]];
  ok('方形内部为负', close(polygonDistance(4, 4, sq), -2, 1e-9));
  ok('方形边上为 0', close(polygonDistance(4, 2, sq), 0, 1e-9));
  ok('方形外到角', close(polygonDistance(0, 0, sq), 2 * Math.SQRT2, 1e-9));
  // 菱形（斜边）：点 (7,5) 最近边是 (7.1,5.5)→(5.5,3.9)，线 x−y=1.6 → |7−5−1.6|/√2 = 0.4/√2
  const dia = [[7.1, 5.5], [5.5, 7.1], [3.9, 5.5], [5.5, 3.9]];
  ok('菱形斜边距离', close(polygonDistance(7, 5, dia), 0.4 / Math.SQRT2, 1e-9), `got ${polygonDistance(7, 5, dia)}`);
  ok('菱形内部', polygonDistance(5.5, 5.5, dia) < 0);
  // 凹 L 形：凹口里算外部
  const L = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
  ok('凹口内=外部', polygonDistance(3, 3, L) > 0 && close(polygonDistance(3, 3, L), 1, 1e-9));
  ok('凹形实体内部', polygonDistance(1, 1, L) < 0);
  ok('顶点不足报错', (() => { try { polygonDistance(0, 0, [[0, 0], [1, 1]]); return false; } catch { return true; } })());
  ok('非有限顶点报错', (() => { try { polygonDistance(0, 0, [[0, 0], [1, 0], [NaN, 1]]); return false; } catch { return true; } })());
}

// 8. 多边形占地进距离场：斜边 footprint 的亚格精度 + 等值线贴真实边线
{
  const w = 13, h = 13, mask = new Array(w * h).fill(1);
  const dia = [[9.1, 6.5], [6.5, 9.1], [3.9, 6.5], [6.5, 3.9]];   // 菱形楼：中心 (6.5,6.5)、半对角 2.6，斜边 x±y 穿格
  const f = distanceField(mask, { w, h, obstacles: [dia] });
  const g = distanceField(mask, { w, h });
  // |x-6.5|+|y-6.5| ≤ 2.6 为内部：(6,6)→1.0、(7,7)→1.0 内；(9,6)→3.0 外
  ok('占地内格心距离 0', f.dist[6 * w + 6] === 0 && f.dist[7 * w + 7] === 0, `got ${f.dist[6 * w + 6]},${f.dist[7 * w + 7]}`);
  // 格心 (9,6)：最近边 (9.1,6.5)→(6.5,3.9)，线 x−y=2.6 → |9−6−2.6|/√2 = 0.4/√2 ≈ 0.2828
  ok('斜边亚格距离', close(f.dist[6 * w + 9], 0.4 / Math.SQRT2, 1e-6), `got ${f.dist[6 * w + 9]} vs ${(0.4 / Math.SQRT2).toFixed(4)}`);
  ok('at() 同精度', close(f.at(9, 6), 0.4 / Math.SQRT2, 1e-6) && f.at(6.5, 6.5) === 0);
  // (9,6) 无占地时 EDT 距离 = 到岛外列 x=13 的 4，占地把它压到 0.2828；远角 (11,0) 不受影响
  ok('占地是更近的源', f.dist[6 * w + 9] < g.dist[6 * w + 9] && close(g.dist[6 * w + 9], 4, 1e-6), `plain ${g.dist[6 * w + 9]}`);
  ok('远离占地不受影响', f.dist[11] === g.dist[11], `${f.dist[11]} vs ${g.dist[11]}`);
  ok('obstacles:[] 结果不变', [...distanceField(mask, { w, h, obstacles: [] }).dist].every((v, i) => v === g.dist[i]));
  ok('坏占地报错', (() => { try { distanceField(mask, { w, h, obstacles: [[[0, 0], [1, 1]]] }); return false; } catch { return true; } })());
  // 等值线贴真实菱形边线：level .8 只剩绕楼一圈（边界格距离 1 > .8 没有岛缘环）
  const [L8] = isoContours(f, { levels: [0.8] });
  ok('绕楼单闭环', L8.closed === 1 && !L8.openEnds, `closed ${L8.closed} open ${L8.openEnds}`);
  let worst8 = 0;
  for (const path of L8.paths) for (const p of path.points) worst8 = Math.max(worst8, Math.abs(polygonDistance(p.x, p.y, dia) - 0.8));
  ok('等值线贴斜边（亚格）', worst8 < 0.06, `max dev ${worst8.toFixed(3)}`);
  // level .8 环长 ≈ 菱形 .8 偏移环（凸形 Steiner：周长 + 2π·r = 4·2.6·√2 + 2π·.8 ≈ 19.72）
  const ring8 = L8.paths.find((p) => p.closed);
  const per8 = ring8.points.reduce((acc, q, i) => i ? acc + Math.hypot(q.x - ring8.points[i - 1].x, q.y - ring8.points[i - 1].y) : acc, 0);
  ok('环长≈Steiner 偏移', Math.abs(per8 - (4 * 2.6 * Math.SQRT2 + 2 * Math.PI * 0.8)) < 0.9, `got ${per8.toFixed(2)}`);
  // level 1.5：绕楼一圈 + 岛缘一圈
  const [L15] = isoContours(f, { levels: [1.5] });
  ok('楼环+岛缘两闭环', L15.closed >= 2, `closed ${L15.closed}`);
}

console.log(`PASS distance-isolines ${pass} checks`);
