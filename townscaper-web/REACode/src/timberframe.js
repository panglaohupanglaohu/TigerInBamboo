/**
 * timberframe.js — 先立木框架、再填墙：吊脚楼的"骨架优先"建造法。
 *
 * 片子 1257213678056857600（2020-05-04）"First 20 people to reply gets a beta key"，512²，9.00s。
 * 这是**建造过程**的录屏，不是成品展示 —— 24 帧里能看清一架房子怎么从石头墩长起来，
 * 而这正是普通关卡编辑器最缺的一段：小镇生成器直接给"已建成"的楼，中间态没有。
 *
 * 逐帧看到的建造顺序（这一条是本轮最值钱的部分）：
 *   f00–f05 只有石头墩 + 红色核心，框架还没出现
 *   f06–f13 四根深色柱子从墩上长到屋顶高度，**此时墙是空的**，能看穿
 *   f14–f17 顶部横梁 + 斜撑 + 平台栏杆补齐，房子像被"架"在空中
 *   f18–f23 墙板才从下往上填进来（红墙 → 白墙），把框架挡住
 *   → 所以顺序是 墩 → 柱 → 梁/撑/栏杆 → 墙 → 屋顶。墙是**最后**填的。
 *
 * 量到的（f015，512²，正立面近似）：
 *   柱宽            10px（近柱 11、远柱 8，透视差），跨度 185px → **柱宽 = 0.054·跨度**
 *   框架高          顶梁 y=218 → 平台 y=375 = 157px → **高/跨 = 0.85**
 *   平台栏杆高      y=351..375 = 24px → **0.13·跨度**
 *   柱对偏移        左右各两根柱，同侧两根相距 8–9px → **0.048·跨度**（进深方向的投影）
 *   栏杆立柱        3–5px 宽、间距 ~19px → **0.10·跨度**
 *   斜撑            1px 细线，最暗 114 级（背景水 150 级）→ 只能确认"从梁下中央分到两柱"，
 *                   端点按结构惯例取梁 1/6 处 → 柱 45% 高处；**具体角度是估计值**
 *   石墩            宽度与框架同宽，底部有半圆拱洞（拱高 ≈ 0.28·跨度）
 *
 * 为什么"框架比墙先"这么重要：
 *   如果先填墙再立柱，柱子在墙外面看起来像贴上去的装饰条；片子里柱子在**墙的外侧**
 *   且墙能被柱子切断，说明构件有真实的先后与遮挡关系。做成数据后，建造动画只要把
 *   `stage` 从 0 推到 3，就自然得到"看到骨架 → 骨架被填满"的观感。
 */

// ── 实测比例（全部对跨度归一化，换尺寸不换形）─────────────────────
export const RATIO = {
  postW: 0.054,     // 柱宽 / 跨度
  frameH: 0.85,     // 框架高 / 跨度
  railH: 0.13,      // 栏杆高 / 跨度
  postPairGap: 0.048, // 同侧两柱的投影间距 / 跨度
  balusterGap: 0.10,  // 栏杆立柱间距 / 跨度
  pierH: 0.30,      // 石墩高 / 跨度（f015 墩顶 375 → 墩底 ~470，被水线截断，取可见部分）
  archH: 0.28,      // 拱高 / 跨度
  braceAt: 1 / 6,   // 斜撑在梁上的落点（距中）——估计值
  braceFoot: 0.45,  // 斜撑在柱上的落点（占框架高）——估计值
};

/** 建造阶段：0 墩 / 1 柱 / 2 梁撑栏杆 / 3 墙 / 4 屋顶 */
export const STAGE = { PIER: 0, POSTS: 1, BEAMS: 2, WALLS: 3, ROOF: 4 };

/**
 * 生成一架木框架的构件表（单位 = 世界单位，跨度 span）。
 * 返回的是**几何**，不是绘制指令 —— 这样它能接进 mesh 管线，也能在 lab 里画正立面。
 */
export function buildFrame(span = 1) {
  const R = RATIO;
  const w = span, h = span * R.frameH, pw = span * R.postW;
  const half = w / 2, gap = span * R.postPairGap;
  const posts = [];
  // 4 根柱：四角。近侧两根在 z=+half，远侧在 z=-half（正立面里表现为左右各一对）
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      posts.push({
        x: sx * (half - pw / 2), z: sz * (half - pw / 2),
        w: pw, h, stage: STAGE.POSTS,
      });
    }
  }
  const beams = [
    { kind: 'topRing', y: h, w, h: pw * 0.9, stage: STAGE.BEAMS },      // 顶部一圈梁
    { kind: 'deck', y: 0, w: w * 1.02, h: pw * 1.1, stage: STAGE.BEAMS }, // 平台板
  ];
  // 斜撑：梁上 ±1/6 处 → 柱 45% 高处。细（1px 级），所以宽度只取柱宽的 0.35
  const braces = [];
  for (const sx of [-1, 1]) {
    braces.push({
      a: { x: sx * w * R.braceAt, y: h - pw * 0.9 },
      b: { x: sx * (half - pw), y: h * (1 - R.braceFoot) },
      w: pw * 0.35, stage: STAGE.BEAMS,
    });
  }
  // 栏杆：平台板以上 railH，立柱按 balusterGap 均分
  const railH = span * R.railH;
  const nBal = Math.max(4, Math.round(w / (span * R.balusterGap)));
  const balusters = [];
  for (let i = 0; i <= nBal; i++) {
    balusters.push({ x: -half + (w * i) / nBal, h: railH, w: pw * 0.42, stage: STAGE.BEAMS });
  }
  const rails = [
    { y: railH, w, h: pw * 0.4, stage: STAGE.BEAMS },
  ];
  return { span, w, h, posts, beams, braces, balusters, rails, railH, gap };
}

/** 画正立面（lab 用）。stage 控制建到哪一步，这样能直接演出片子的建造顺序。 */
export function drawFrame(ctx, f, ox, oy, opts = {}) {
  const stage = opts.stage ?? 4;
  const color = opts.color ?? '#2a3140';
  const wall = opts.wall ?? '#c8383f';
  const roof = opts.roof ?? '#c8622f';
  const span = f.span;

  // 石头墩（永远最先有）
  const pierH = span * RATIO.pierH;
  ctx.fillStyle = '#8e8f93';
  ctx.fillRect(ox - f.w * 0.51, oy, f.w * 1.02, pierH);
  // 拱洞
  ctx.fillStyle = '#4a4d55';
  ctx.beginPath();
  ctx.moveTo(ox - span * 0.16, oy + pierH);
  ctx.lineTo(ox - span * 0.16, oy + pierH - span * RATIO.archH * 0.45);
  ctx.arc(ox, oy + pierH - span * RATIO.archH * 0.45, span * 0.16, Math.PI, 0);
  ctx.lineTo(ox + span * 0.16, oy + pierH);
  ctx.closePath();
  ctx.fill();

  const baseY = oy - pierH * 0 + 0; // 框架从墩顶起
  const y0 = oy - pierH;            // 墩顶（画布 y 向下，所以减）

  if (stage >= STAGE.WALLS) {
    // 墙板：填在框架**内侧**（左右各让开一根柱宽），红墙 / 白墙各一半
    // （片子里 f20 起红墙是从下往上被白墙替换的，这里定格成左右各半）
    const inset = span * RATIO.postW;
    ctx.fillStyle = wall;
    ctx.fillRect(ox - f.w / 2 + inset, oy - f.h, f.w / 2 - inset, f.h);
    ctx.fillStyle = '#eee9df';
    ctx.fillRect(ox, oy - f.h, f.w / 2 - inset, f.h);
  }
  if (stage >= STAGE.ROOF) {
    ctx.fillStyle = roof;
    ctx.beginPath();
    const rw = f.w * 1.06, rh = span * 0.26;   // 屋顶必须比墙宽，否则看起来浮在墙里
    ctx.moveTo(ox - rw / 2, oy - f.h);
    ctx.lineTo(ox, oy - f.h - rh);
    ctx.lineTo(ox + rw / 2, oy - f.h);
    ctx.closePath();
    ctx.fill();
  }
  if (stage < STAGE.POSTS) return;

  ctx.fillStyle = color;
  // 柱：四根投影成左右各两根
  for (const p of f.posts) {
    const dx = p.x + (p.z > 0 ? f.gap / 2 : -f.gap / 2);
    ctx.fillRect(ox + dx - p.w / 2, oy - p.h, p.w, p.h);
  }
  if (stage < STAGE.BEAMS) return;

  // 顶梁 + 平台板
  for (const b of f.beams) {
    ctx.fillRect(ox - b.w / 2, oy - b.y - b.h, b.w, b.h);
  }
  // 斜撑（细线）
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, span * 0.008);
  for (const b of f.braces) {
    ctx.beginPath();
    ctx.moveTo(ox + b.a.x, oy - b.a.y);
    ctx.lineTo(ox + b.b.x, oy - b.b.y);
    ctx.stroke();
  }
  // 栏杆
  for (const r of f.rails) ctx.fillRect(ox - r.w / 2, oy - r.y - r.h, r.w, r.h);
  for (const b of f.balusters) ctx.fillRect(ox + b.x - b.w / 2, oy - b.h, b.w, b.h);
}

/** 反测：把渲染用的比例再算一遍，和片子上量到的数对比。 */
export function verify(span = 185) {
  const f = buildFrame(span);
  return {
    postWRatio: +(f.posts[0].w / span).toFixed(3),
    frameHRatio: +(f.h / span).toFixed(3),
    railHRatio: +(f.railH / span).toFixed(3),
    balusters: f.balusters.length,
    braces: f.braces.length,
    film: { postW: 0.054, frameH: 0.85, railH: 0.13, balusters: 10 },
  };
}
