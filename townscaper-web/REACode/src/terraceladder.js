/**
 * terraceladder.js — 跨层木梯：梯长不是层高，是 sqrt(H² + run²)，梯脚落在下层台面、
 * 梯顶正好搭在上层台沿那个角上。
 *
 * 帖子 ID：781957658597269506（2017-04-19，无原文字，仅有视频）
 *   画面（6 帧，480×576，无贴图）：一座黄色浮岛，能数出 4 级台面，台面之间是竖直崖壁。
 *   顶上一栋红顶红墙的房子 + 两间小屋 + 柴垛 + 垃圾桶 + 桌椅，烟囱冒黑烟。
 *   两处木梯跨层：一处在顶台左沿，几乎是竖着靠上去的（倾角很小）；一处在中层
 *   台面正中，从下层台面立起来搭到上一层台沿（看得出一点斜度）。两把梯子的
 *   **梯脚都踩在下层台面上，梯顶都搭在上层台沿**，没有一把是悬空的。
 *   同题材的另一条 1669315384619540487 是同一套台地地形，只是没有梯子。
 *
 * 原文只有一句提问式的标题（"Can you make good looking foliage..."）不在本文件范围，
 * 本条无文字，机制全部来自画面判读 —— 所以下面每个数字都是本页自己量出来的，
 * 不冒充原帖结论。
 *
 * 为什么"梯长 = 层高"是错的：
 *   梯子必须**斜着**立才能靠在崖面上（竖直立起来的梯子会贴着墙、没法踩）。
 *   一旦有了水平退让 run，梯顶到梯脚的真实距离就是 sqrt(H² + run²)，比层高 H 长。
 *   把 H 当梯长做出来，梯顶就短一截：run=0.62、H=1 时缺口 0.167 —— 视觉上就是
 *   "梯子还没够到台沿"，人爬上去最后一步落空。
 *   反过来，梯顶必须**正好**落在外沿那条角线上（离梯梁的距离 = 0），否则要么穿墙
 *   插进土里，要么悬在墙外。
 *
 * 本页把参数拉开差别（原片两把梯子都很陡，量不出倾角带来的差异）：
 *   三处崖面 run = 0.22 / 0.40 / 0.62 → 倾角 12.4° / 21.8° / 31.8°。
 */

export const CFG = {
  H: 1.0,            // 一级台地的高度（层高）
  RAIL: 0.09,        // 梯梁半宽（世界单位）
  RUNG: 0.26,        // 踏棍间距（沿梯梁量）
  OVER: 0.12,        // 梯顶高出台沿的扶手长度
  // 四级台面（从左到右升高），每级的 [起, 止] x，顶面高度 = 序号
  TERRACES: [
    { k: 0, x0: 0.00, x1: 2.40 },
    { k: 1, x0: 2.40, x1: 4.50 },
    { k: 2, x0: 4.50, x1: 6.40 },
    { k: 3, x0: 6.40, x1: 8.00 },
  ],
  // 三处崖面上的梯子：崖面 = 上层台面的左沿；run = 梯脚离崖面多远
  LADDERS: [
    { id: 'A', face: 1, run: 0.22 },
    { id: 'B', face: 2, run: 0.40 },
    { id: 'C', face: 3, run: 0.62 },
  ],
};

/** 台面高度：第 k 级顶面在 z = k·H */
export const topZ = (k) => k * CFG.H;

/**
 * 一把梯子的几何。
 *  foot = (edgeX − run, 下层台面高)          ← 梯脚踩在下层台面上
 *  lip  = (edgeX, 上层台面高)                ← 梯顶搭在上层台沿那条角线上
 *  L    = |lip − foot| = sqrt(H² + run²)     ← 梯长（沿梯梁）
 *  over = 沿同一方向再伸出 OVER（扶手，略高出台沿）
 */
export function ladder(spec) {
  const H = CFG.H;
  const upper = CFG.TERRACES[spec.face];
  const lower = CFG.TERRACES[spec.face - 1];
  const edgeX = upper.x0;
  const zLow = topZ(lower.k);
  const zHigh = topZ(upper.k);
  const foot = { x: edgeX - spec.run, z: zLow };
  const lip = { x: edgeX, z: zHigh };
  const dx = lip.x - foot.x, dz = lip.z - foot.z;
  const L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;               // 梯梁方向（向上）
  const head = { x: lip.x + ux * CFG.OVER, z: lip.z + uz * CFG.OVER };

  // 踏棍：沿梯梁等距，垂直于梯梁
  const n = Math.max(2, Math.floor((L + CFG.OVER) / CFG.RUNG));
  const rungs = [];
  for (let i = 1; i <= n; i++) {
    const t = (i * CFG.RUNG) / (L + CFG.OVER);
    rungs.push({ x: foot.x + (head.x - foot.x) * t, z: foot.z + (head.z - foot.z) * t });
  }

  // 把梯子"缩短成层高"的错误版本：梯梁方向不变，长度取 H
  const short = { x: foot.x + ux * H, z: foot.z + uz * H };

  return {
    ...spec,
    edgeX, zLow, zHigh, foot, lip, head, L, ux, uz, rungs,
    angle: Math.atan2(dx, dz) * 180 / Math.PI,   // 与崖面的夹角（离竖直线多少度）
    // 三条验收量
    footErr: Math.abs(foot.z - zLow),            // 梯脚离台面的高差
    lipDist: Math.abs((lip.x - foot.x) * uz - (lip.z - foot.z) * ux), // 台沿到梯梁的垂距
    shortGap: L - H,                             // 若把层高当梯长，梯顶差多少够不着
    short, rungCount: rungs.length,
  };
}

export function ladders() {
  return CFG.LADDERS.map(ladder);
}

export function measure() {
  const ls = ladders();
  const gaps = ls.map((l) => l.shortGap);
  return {
    n: ls.length,
    footOn: ls.filter((l) => l.footErr < 1e-9).length,
    lipOn: ls.filter((l) => l.lipDist < 1e-9).length,
    angMin: +Math.min(...ls.map((l) => l.angle)).toFixed(1),
    angMax: +Math.max(...ls.map((l) => l.angle)).toFixed(1),
    gapMax: +Math.max(...gaps).toFixed(3),
    gapMin: +Math.min(...gaps).toFixed(3),
    lenMin: +Math.min(...ls.map((l) => l.L)).toFixed(3),
    lenMax: +Math.max(...ls.map((l) => l.L)).toFixed(3),
    rungs: ls.map((l) => l.rungCount),
    // 梯脚是否留在下层台面内（不越到下一级崖外）
    footInside: ls.filter((l) => {
      const lower = CFG.TERRACES[l.face - 1];
      return l.foot.x > lower.x0 + 0.02 && l.foot.x < lower.x1 - 0.02;
    }).length,
  };
}
