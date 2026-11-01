/**
 * barycentric.js — 重心坐标：每个权重只花「一次减法 + 一次点积」。
 *
 * 原文（x.com/OskSta/status/974579499802202113, 2018-03-16）：
 *
 *   "For a given position, Barycentric Coordinates can be calculated with
 *    1 subtraction and 1 dot product (if you've precalculated some nice
 *    vectors in the triangle)"
 *
 * 同一天的配对片（974564862729838592）是他自己做的教学 gizmo：一个三角形 +
 * 一个白点在里面滑动，三个角上各挂一个小球（红/绿/蓝）。
 *
 * 画面（24 帧）：三角形平铺在灰色地面上，边是细深线；一个白球（查询点）在
 * 三角形内部来回滑，始终不出边界；某个角上立着三根坐标轴箭头（绿上/红/蓝），
 * 另外两个角各有一个小球。全程机位不动，只在演示"点 → 三个权重"。
 *
 * 原文那句话说得很省，实际的"nice vectors"是什么？
 *   朴素写法（Cramer）每个点要算 d20/d21、乘 4 次、除 1 次：
 *     w1 = (d11*d20 - d01*d21) / denom
 *     w2 = (d00*d21 - d01*d20) / denom
 *   把 /denom 折进两个**常量向量**里，就能把上式整体收成一次点积：
 *     P1 = (d11*e1 - d01*e2) / denom
 *     则 w1 = dot(p - a, P1)          ← 一次减法，一次点积
 *     P2 = (d00*e2 - d01*e1) / denom
 *     则 w2 = dot(p - a, P2)
 *     w0 = 1 - w1 - w2                ← 第三个不必再算（而且保证和为 1）
 * 所以"1 减法 + 1 点积"是**每个坐标**的价；共享那次减法后，整点共 1 减 + 2 点积。
 * 这比 Cramer 少两次乘法、少一次除法，而 P1/P2 是三角形预处理时算一次就好的。
 *
 * 为什么要在本项目里做：Townscaper 线里所有"点落在哪个三角/四边形上"的判定
 * （插地形、贴地路线、鼠标拾取、贴花锚定）都可复用这套预处理；
 * `src/triGraph.js` 里 Lambert/插值现在还在每次现算 denom。
 *
 * 这个文件刻意**不 import three**，二维/三维都能用（传 {x,y} 或 {x,y,z} 都行），
 * 这样能在 node 里直接跑统计：`maxErr` 对 Cramer 的误差、`opsPerQuery` 运算计数。
 */

/** 点积：只取 x/y/z 三个分量，缺的当 0（二维向量也能用）。 */
function dot(a, b) {
  return (a.x || 0) * (b.x || 0) + (a.y || 0) * (b.y || 0) + (a.z || 0) * (b.z || 0);
}

function sub(a, b) {
  return { x: (a.x || 0) - (b.x || 0), y: (a.y || 0) - (b.y || 0), z: (a.z || 0) - (b.z || 0) };
}

function scale(a, s) {
  return { x: (a.x || 0) * s, y: (a.y || 0) * s, z: (a.z || 0) * s };
}

function add(a, b) {
  return { x: (a.x || 0) + (b.x || 0), y: (a.y || 0) + (b.y || 0), z: (a.z || 0) + (b.z || 0) };
}

/**
 * 预处理一个三角形，产出两个"nice vectors" P1/P2（以及退化判定）。
 *
 * @param {{x:number,y:number,z?:number}} a 顶点 0
 * @param {{x:number,y:number,z?:number}} b 顶点 1
 * @param {{x:number,y:number,z?:number}} c 顶点 2
 * @returns {{a,b,c,e1,e2,denom,p1,p2,degenerate:boolean}}
 */
export function prepTriangle(a, b, c) {
  const e1 = sub(b, a);            // 边 ab
  const e2 = sub(c, a);            // 边 ac
  const d00 = dot(e1, e1);
  const d01 = dot(e1, e2);
  const d11 = dot(e2, e2);
  const denom = d00 * d11 - d01 * d01;

  // 退化（三点共线/重合）：denom→0。这里**不抛错**，给一个安全值让调用方自己
  // 用 `degenerate` 判断 —— 网格里偶尔会有极扁的三角形，抛错会把整帧画面干掉。
  const safe = Math.abs(denom) < 1e-18 ? (denom >= 0 ? 1e-18 : -1e-18) : denom;

  // 把 1/denom 折进向量里 —— 这就是原文说的 "precalculated some nice vectors"。
  const p1 = scale(sub(scale(e1, d11), scale(e2, d01)), 1 / safe);
  const p2 = scale(sub(scale(e2, d00), scale(e1, d01)), 1 / safe);

  return { a, b, c, e1, e2, d00, d01, d11, denom, p1, p2, degenerate: Math.abs(denom) < 1e-18 };
}

/**
 * 每个坐标 1 次减法 + 1 次点积。
 * 返回 [w0, w1, w2]，和为 1（w0 用 1-… 保底，不是再点一次）。
 */
export function barycentric(prep, p) {
  const v = sub(p, prep.a);                       // ← 唯一的一次减法（三点共享）
  const w1 = dot(v, prep.p1);                     // ← 一次点积
  const w2 = dot(v, prep.p2);                     // ← 又一次（每个坐标一次）
  return [1 - w1 - w2, w1, w2];
}

/** 只要一个权重时（比如只关心是不是在 bc 边一侧），可以单点。 */
export function barycentricWeight(prep, p, i) {
  if (i === 0) {
    const v = sub(p, prep.a);
    const w1 = dot(v, prep.p1);
    const w2 = dot(v, prep.p2);
    return 1 - w1 - w2;
  }
  return dot(sub(p, prep.a), i === 1 ? prep.p1 : prep.p2);
}

/**
 * 朴素 Cramer 写法 —— 只用来在 node 里对答案（误差应在 1e-15 量级）。
 * 生产路径不要用它：每个点多两次乘法 + 一次除法。
 */
export function barycentricCramer(a, b, c, p) {
  const v0 = sub(b, a), v1 = sub(c, a), v2 = sub(p, a);
  const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1);
  const d20 = dot(v2, v0), d21 = dot(v2, v1);
  const den = d00 * d11 - d01 * d01 || 1e-18;
  const w1 = (d11 * d20 - d01 * d21) / den;
  const w2 = (d00 * d21 - d01 * d20) / den;
  return [1 - w1 - w2, w1, w2];
}

/** 最小权重 ≥ 0 即在三角形内（含边）。用它比三个叉积判定省，且退化三角形安全。 */
export function insideTriangle(w, eps = 0) {
  return w[0] >= -eps && w[1] >= -eps && w[2] >= -eps;
}

/** 反算：权重 → 点。用来验证"权重 + 三顶点"信息无损（画面里小球就挂在 w*顶点 上）。 */
export function fromBarycentric(a, b, c, w) {
  return add(add(scale(a, w[0]), scale(b, w[1])), scale(c, w[2]));
}

/**
 * 给 gizmo 用的辅助：把权重映射成三色（红/绿/蓝 = 三个顶点），
 * 片子里角上那三个小球就是这个颜色。
 */
export function weightsToRGB(w) {
  return {
    r: Math.max(0, Math.min(1, w[0])),
    g: Math.max(0, Math.min(1, w[1])),
    b: Math.max(0, Math.min(1, w[2])),
  };
}

/**
 * 自检 + 统计（node 里跑）。
 * 返回值刻意给"可对账"的数字：误差、退化数、运算次数。
 */
export function selfCheck(samples = 20000, seed = 7) {
  let s = seed | 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) | 0) >>> 0) / 4294967296;
  let maxErr = 0, sumErr = 0, n = 0, degenerate = 0;
  for (let k = 0; k < samples; k++) {
    const a = { x: rnd() * 10, y: rnd() * 10 };
    const b = { x: rnd() * 10, y: rnd() * 10 };
    const c = { x: rnd() * 10, y: rnd() * 10 };
    const prep = prepTriangle(a, b, c);
    if (prep.degenerate) { degenerate++; continue; }
    const p = { x: rnd() * 10, y: rnd() * 10 };
    const w = barycentric(prep, p);
    const ref = barycentricCramer(a, b, c, p);
    const e = Math.max(Math.abs(w[0] - ref[0]), Math.abs(w[1] - ref[1]), Math.abs(w[2] - ref[2]));
    maxErr = Math.max(maxErr, e); sumErr += e; n++;
    // 反算必须回到原点
    const back = fromBarycentric(a, b, c, w);
    const e2 = Math.hypot(back.x - p.x, back.y - p.y);
    maxErr = Math.max(maxErr, e2);
  }
  return {
    samples: n,
    degenerate,
    maxErr,
    meanErr: n ? sumErr / n : 0,
    opsPerQuery: { sub: 1, dot: 2 },       // 对比 Cramer：sub 3 / dot 4 / mul 4 / div 1
    cramerOps: { sub: 3, dot: 4, mul: 4, div: 1 },
  };
}
