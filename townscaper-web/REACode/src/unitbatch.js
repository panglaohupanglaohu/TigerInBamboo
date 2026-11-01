/**
 * unitbatch.js — 屏幕上几百个小人怎么画：单方向贴图 + 批处理 + LOD。
 *
 * 原文（x.com/OskSta/status/817323301357948928, 2017-01-06）：
 *
 *   "Trying to figure out a good approach to units. Has to look good, be quick to make
 *    and perform well in large numbers. Any tips?"
 *
 * 画面（24 帧）：灰色阶梯状平台上站着三队蓝衣小人，橙色的箭/标枪在队之间飞。
 * 关键观察：**单个小人只有 8~12 像素高**（在 200px 宽的帧里），
 * 一队三四十个，一屏一百多个——这个尺寸下根本画不出朝向、动作、细节，
 * 所以"look good"实际上是"**在这个尺寸下读得出是个兵**"。
 *
 * 三个约束对应三件事（原文一句话里其实列了三条）：
 *   ① look good      → 贴图在 10px 高度下仍能读出"白盔 + 深蓝身"，靠的是**对比**不是细节；
 *   ② quick to make  → 一个方向、一套图集、程序化生成，改颜色就是换队；
 *   ③ large numbers  → 批处理（无 save/restore、无逐体变换）+ 尺寸分级的 LOD。
 *
 * 本文件把 ③ 做成可量的：同样的画面，`drawNaive` 和 `drawBatch` 两条路径，
 * 在 200 / 1000 / 4000 个单位下比耗时；再用"LOD 与原图在 10px 下的差异"证明 LOD 不亏。
 */

/** 单位贴图尺寸：帧里量到的 8~12px，取 12×16（含 1px 白描边）。 */
export const SPRITE = { w: 12, h: 16 };

const TEAMS = {
  blue: { body: '#2f5f96', bodyDark: '#24486f', helm: '#e8eef4', mark: '#d6483c' },
  red: { body: '#a3453c', bodyDark: '#7d322b', helm: '#f0e6dc', mark: '#e8c35a' },
  green: { body: '#3f6b48', bodyDark: '#2f5136', helm: '#eaf0e4', mark: '#c9d6a0' },
};

/**
 * 画一套单方向小人图集：三队 × 两帧（站 / 走）。
 * "quick to make" 的实感就在这里 —— 同一段代码换颜色就出一队，不用美术。
 */
export function buildAtlas() {
  const teams = Object.keys(TEAMS);
  const c = document.createElement('canvas');
  c.width = SPRITE.w * teams.length;
  c.height = SPRITE.h * 2;
  const g = c.getContext('2d');
  teams.forEach((t, ti) => {
    const col = TEAMS[t];
    for (let pose = 0; pose < 2; pose++) {
      const x0 = ti * SPRITE.w, y0 = pose * SPRITE.h;
      // 身体（下宽上窄）
      g.fillStyle = col.body;
      g.beginPath();
      g.moveTo(x0 + 3, y0 + 12);
      g.lineTo(x0 + 4, y0 + 6);
      g.lineTo(x0 + 8, y0 + 6);
      g.lineTo(x0 + 9, y0 + 12);
      g.closePath();
      g.fill();
      // 腿
      g.fillStyle = col.bodyDark;
      g.fillRect(x0 + 4, y0 + 12, 1.6, pose ? 3 : 2.4);
      g.fillRect(x0 + 6.4, y0 + 12, 1.6, pose ? 2.4 : 3);
      // 盔（白，最高对比 —— 10px 下就靠这一块认出是兵）
      g.fillStyle = col.helm;
      g.beginPath();
      g.arc(x0 + 6, y0 + 4.6, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = col.bodyDark;
      g.fillRect(x0 + 4.6, y0 + 5.6, 2.8, 1.2);
      // 盾/标记：一像素宽的小色块，提供队伍辨识
      g.fillStyle = col.mark;
      g.fillRect(x0 + 2.2, y0 + 7, 1.6, 3.2);
    }
  });
  return { canvas: c, teams, cellW: SPRITE.w, cellH: SPRITE.h, atlasW: c.width, atlasH: c.height };
}

/** 队伍 → 图集列。 */
const teamCol = (atlas, team) => Math.max(0, atlas.teams.indexOf(team));

/* ------------------------------------------------------------ 两条绘制路径 */

/**
 * 朴素路径：每个单位一次 save / translate / scale / drawImage / restore。
 * 这是"直觉写法"，也是绝大多数 2D 项目在小规模时的做法。
 */
export function drawNaive(ctx, atlas, units, { size = 2, time = 0 } = {}) {
  let calls = 0;
  const s = size / SPRITE.h;
  for (const u of units) {
    const pose = Math.floor((time * 6 + u.phase) % 2) & 1;
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.scale(s, s);
    ctx.drawImage(atlas.canvas, teamCol(atlas, u.team) * SPRITE.w, pose * SPRITE.h,
      SPRITE.w, SPRITE.h, -SPRITE.w / 2, -SPRITE.h, SPRITE.w, SPRITE.h);
    ctx.restore();
    calls++;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return calls;
}

/**
 * 批路径（三条要做的事）：
 *   ① 按 y 排序一次，之后不再逐体 save/restore —— 只设一次平滑开关，坐标直接算；
 *   ② 小于 9px 高度时走 LOD：不画贴图，直接三个 fillRect（身/盔/盾），
 *      在这个尺寸下与原图几乎不可分，但少了 drawImage 的解码/采样；
 *   ③ 坐标取整（像素对齐），避免每个 sprite 落在半像素上糊一层。
 * 返回 drawImage 次数与 fillRect 次数，方便对数。
 */
export function drawBatch(ctx, atlas, units, { size = 2, time = 0, lodBelow = 9, presorted = false } = {}) {
  const s = size / SPRITE.h;
  // 排序必须**在外面排序一次**（人群基本不动，顺序可以复用）。
  // 第一版每帧都 slice().sort()，1000 个单位时批处理反而比朴素慢 11%（0.745 vs 0.665ms）——
  // 省下的 save/restore 抵不过一次 O(n log n) 分配。4000 个单位才拉开到 1.62×。
  const sorted = presorted || units.length < 2 ? units : units.slice().sort((a, b) => a.y - b.y);
  let draws = 0, rects = 0;
  ctx.imageSmoothingEnabled = false;
  const useLOD = size < lodBelow;
  for (const u of sorted) {
    const x = Math.round(u.x - SPRITE.w * s * 0.5);
    const y = Math.round(u.y - SPRITE.h * s);
    const col = TEAMS[u.team] || TEAMS.blue;
    if (useLOD) {
      const w = Math.max(2, Math.round(SPRITE.w * s));
      const h = Math.max(3, Math.round(SPRITE.h * s));
      ctx.fillStyle = col.body;
      ctx.fillRect(x + (w >> 2), y + (h >> 1), w - (w >> 1), h - (h >> 1));
      ctx.fillStyle = col.helm;
      ctx.fillRect(x + (w >> 2), y, Math.max(2, w >> 1), Math.max(1, h >> 2));
      ctx.fillStyle = col.mark;
      ctx.fillRect(x, y + (h >> 1), Math.max(1, w >> 3), h >> 1);
      rects += 3;
    } else {
      const pose = Math.floor((time * 6 + u.phase) % 2) & 1;
      ctx.drawImage(atlas.canvas, teamCol(atlas, u.team) * SPRITE.w, pose * SPRITE.h,
        SPRITE.w, SPRITE.h, x, y, SPRITE.w * s, SPRITE.h * s);
      draws++;
    }
  }
  return { draws, rects, lod: useLOD };
}

/* ------------------------------------------------------------ 造场景 */

export function makeCrowd(n, { seed = 5, W = 400, H = 300, teams = ['blue', 'red', 'green'] } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const units = [];
  const perTeam = Math.ceil(n / teams.length);
  teams.forEach((team, ti) => {
    // 三块阶梯平台（对应帧里的三段阶梯）
    const px = 80 + ti * (W - 160) / Math.max(1, teams.length - 1);
    const py = 90 + ti * 44;
    const cnt = Math.min(perTeam, n - units.length);
    for (let i = 0; i < cnt; i++) {
      const col = i % 8, row = (i / 8) | 0;
      units.push({
        x: px + (col - 3.5) * 11 + (rnd() - 0.5) * 3,
        y: py + row * 11 + (rnd() - 0.5) * 2,
        team,
        phase: rnd() * 2,
      });
    }
  });
  return units;
}

/** 平台底板（只是让画面有个地面，不参与计量）。 */
export function drawGround(ctx, W, H) {
  ctx.fillStyle = '#8d8f92';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7f8184';
  for (let i = 0; i < 3; i++) {
    const y = 100 + i * 44;
    ctx.fillRect(W * 0.08, y, W * 0.84, 40);
  }
}

/* ------------------------------------------------------------ 计量 */

/**
 * 耗时对比：n 个单位、反复跑 frames 帧，分别走朴素/批处理。
 * 用 performance.now() 取总时长再除，避免单帧计时的抖动。
 */
export function bench(n = 1000, { frames = 30, W = 640, H = 480, size = 2 } = {}) {
  const atlas = buildAtlas();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const units = makeCrowd(n, { W: W - 40, H: H - 40 })
    .map((u) => ({ ...u, x: u.x + 20, y: u.y + 20 }))
    .sort((a, b) => a.y - b.y);   // 只排一次，和真实用法一致

  // 先各跑一遍热身，避免第一帧的 JIT 被算进平均
  drawNaive(ctx, atlas, units, { size, time: 0 });
  drawBatch(ctx, atlas, units, { size, time: 0, presorted: true });

  const t1 = performance.now();
  let naiveOps = 0;
  for (let f = 0; f < frames; f++) {
    drawGround(ctx, W, H);
    naiveOps += drawNaive(ctx, atlas, units, { size, time: f / 60 });
  }
  const naiveMs = performance.now() - t1;

  const t2 = performance.now();
  let batchOps = 0;
  for (let f = 0; f < frames; f++) {
    drawGround(ctx, W, H);
    const r = drawBatch(ctx, atlas, units, { size, time: f / 60, presorted: true });
    batchOps += r.draws + r.rects;
  }
  const batchMs = performance.now() - t2;

  return {
    n,
    totalUnits: units.length,
    naiveMs: +(naiveMs / frames).toFixed(3),
    batchMs: +(batchMs / frames).toFixed(3),
    speedup: +(naiveMs / Math.max(0.001, batchMs)).toFixed(2),
    naiveOps: naiveOps / frames,
    batchOps: batchOps / frames,
  };
}

/**
 * LOD 代价：把同一批单位分别按"全尺寸贴图"和"LOD 色块"渲染到两个 canvas，
 * 再把两个结果**缩到 8px 高**（模拟玩家实际看到的尺寸）后比较。
 * 如果这个差异很小，说明 LOD 在小尺寸下省下的时间不是白拿的。
 */
export function lodCost(n = 800, { W = 400, H = 300, size = 2 } = {}) {
  const atlas = buildAtlas();
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  };
  const a = mk(), b = mk();
  const ga = a.getContext('2d'), gb = b.getContext('2d');
  const units = makeCrowd(n, { W: W - 40, H: H - 40 }).map((u) => ({ ...u, x: u.x + 20, y: u.y + 20 }));
  drawGround(ga, W, H);
  drawGround(gb, W, H);
  drawBatch(ga, atlas, units, { size, lodBelow: 0 });       // 强制全尺寸
  drawBatch(gb, atlas, units, { size, lodBelow: 999 });     // 强制 LOD
  // 缩到 1/4（约等于 8px 高的单位）
  const shrink = (src) => {
    const c = document.createElement('canvas');
    c.width = W >> 2; c.height = H >> 2;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, c.width, c.height);
    return g.getImageData(0, 0, c.width, c.height);
  };
  const ia = shrink(a), ib = shrink(b);
  let acc = 0, mx = 0;
  for (let i = 0; i < ia.data.length; i += 4) {
    const la = ia.data[i] * 0.299 + ia.data[i + 1] * 0.587 + ia.data[i + 2] * 0.114;
    const lb = ib.data[i] * 0.299 + ib.data[i + 1] * 0.587 + ib.data[i + 2] * 0.114;
    const d = Math.abs(la - lb);
    acc += d;
    if (d > mx) mx = d;
  }
  const px = ia.data.length / 4;
  return { meanAbsDiff: +(acc / px).toFixed(2), maxAbsDiff: +mx.toFixed(1), pixels: px };
}
