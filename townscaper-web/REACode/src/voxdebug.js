/**
 * voxdebug.js — 体素编辑器的调试覆盖层：暗格 / 亮面 / 笔刷环，三层各管一件事。
 *
 * 片子 1151152046055272449（2019-07-16）"Having a look around"，420²，22.26s。
 * 原文只有一句"四处看看"，没有任何技术描述 —— 全部靠逐像素量。24 帧里画面只做了
 * 一次缓慢的推近 + 鼠标移动，所以能把这套 UI 的定尺全部量死。
 *
 * 量到的（f008，420²）：
 *   背景            纯灰 #585858(88)，占 19.7% 像素；旁边 #5a/#57 各 10% → 是渐变底，不是死灰
 *   空格子线        #787878(120)，比底亮 **+32 级**，1px。换算成白色叠 alpha 就是
 *                    88 + a·(255-88) = 120 → **a = 0.19**（不是随手 0.3）
 *   亮面线          #f2f2f2，同样 1px（游程直方图：1px 216 段、2px 202 段，2px 是抗锯齿）
 *   亮面占比        1.46%（白像素 2584 / 176400）
 *   笔刷环          拟合圆 r = 124.7px = **画幅的 29.7%**，圆心跟着光标走，不跟画幅中心
 *   十字线          竖 x=329..330、横 y=270，**2px**（比环粗一档），只画到环外一点点
 *   选中格          22×20 的方块，#E8F95A，外面一圈 2px 白边
 *   方位箭头        10×16 的实心三角，两个（+Y / +X 方向），顶在环上
 *   箭头橙色值      (232,249,90) —— 偏绿的高亮黄，不是纯 #FF0
 *
 * 为什么分三层而不是一层：
 *   如果空格子和实心面用同一条线，"哪块已经填了"就只能靠明暗猜；片子里两条线的
 *   alpha 差 0.19 : 1.0（约 5 倍），一眼就分得开。而 HUD（环/十字/箭头/选中框）
 *   必须**画在几何之后**、不做深度测试，否则被方块挡住就找不到了 —— 片子里的环
 *   穿过整片亮面仍然是完整的细线，说明它是屏幕空间后绘制的。
 */

export const VOXHUD = {
  bg: '#585858',
  bgTop: '#5b5b5b',
  bgBot: '#565656',
  lattice: 'rgba(255,255,255,0.19)', // 实测 +32 级 / 底 88 → alpha 0.19
  latticeW: 1,
  surface: '#f2f2f2',
  surfaceAlpha: 1,
  surfaceW: 1,
  ringW: 1,
  crossW: 2,
  ringR: 0.297,     // 占画幅宽度的比例（实测 124.7/420）
  arrowL: 16,       // 三角长
  arrowW: 10,       // 三角宽
  cellBox: [22, 20], // 选中格方块（实测 22×20）
  accent: '#e8f95a',
  accentEdge: '#ffffff',
  edgeW: 2,
};

/** 等距投影：体素坐标 → 屏幕。s = 每格像素。 */
export function iso(x, y, z, s, ox, oy) {
  return [ox + (x - z) * s * 0.866, oy + (x + z) * s * 0.5 - y * s];
}

/**
 * 空格子的暗线：**只画"从外面看得见的那一层壳"**。
 *
 * 踩过的坑（很贵，记下来）：第一版对每个空格画 3 个面的 6 条棱。等距投影下，
 * 同一个屏幕位置会被 20 多层格子的棱**完全重合**地画上去，alpha 0.19 叠 20 次 → 1.0，
 * 整颗立方体渲染成了纯白线球（白像素 23.96%，片子 1.46%）。
 * 片子里的暗格是"深度测试后的线框"——每条屏幕线只出现一次，所以必须是 0.19 不是 1.0。
 *
 * 做法：对三个可视面方向各做一次"从外往里步进，撞到实心就停"，
 * 只画最前面那个空格的面；棱再用 Set 去重，保证一条线只描一次。
 */
export function drawLattice(ctx, grid, s, ox, oy, opts = {}) {
  const alpha = opts.alpha ?? VOXHUD.lattice;
  const [nx, ny, nz] = grid.dim;
  ctx.save();
  ctx.strokeStyle = alpha;
  ctx.lineWidth = VOXHUD.latticeW;
  ctx.beginPath();
  const at = (x, y, z) => iso(x, y, z, s, ox, oy);
  const seen = new Set();
  const seg = (p, q) => {
    const ka = `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const kb = `${q[0].toFixed(1)},${q[1].toFixed(1)}`;
    const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    if (seen.has(key)) return;
    seen.add(key);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  };
  const quad = (a, b, c, d) => { seg(a, b); seg(b, c); seg(c, d); seg(d, a); };

  // 顶面：从 y=ny-1 往下走，第一个空格就停
  for (let x = 0; x < nx; x++) {
    for (let z = 0; z < nz; z++) {
      let y = ny - 1;
      while (y >= 0 && grid.get(x, y, z)) y--;
      if (y < 0) continue;                       // 整列都是实心 → 顶面被占
      const yy = y + 1;
      quad(at(x, yy, z), at(x + 1, yy, z), at(x + 1, yy, z + 1), at(x, yy, z + 1));
    }
  }
  // +x 面：从 x=nx-1 往里走
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      let x = nx - 1;
      while (x >= 0 && grid.get(x, y, z)) x--;
      if (x < 0) continue;
      const xx = x + 1;
      quad(at(xx, y, z), at(xx, y + 1, z), at(xx, y + 1, z + 1), at(xx, y, z + 1));
    }
  }
  // +z 面：从 z=nz-1 往里走
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      let z = nz - 1;
      while (z >= 0 && grid.get(x, y, z)) z--;
      if (z < 0) continue;
      const zz = z + 1;
      quad(at(x, y, zz), at(x + 1, y, zz), at(x + 1, y + 1, zz), at(x, y + 1, zz));
    }
  }
  ctx.stroke();
  ctx.restore();
  return seen.size;
}

/**
 * 实心体的亮线框：**只画暴露面**的边框。
 *
 * 踩过的坑：一开始把每个实心格的 6 条棱全画了，白像素占到 25.7%（片子 1.46%），
 * 整坨变成白纸 —— 内部的棱全在球体内部，正常渲染根本看不见。
 * 片子里那层亮线是"表面网格"，所以判据是"邻格为空"，只画 top/+x/+z 三个可视面。
 */
export function drawSurfaceWire(ctx, grid, s, ox, oy) {
  const [nx, ny, nz] = grid.dim;
  ctx.save();
  ctx.strokeStyle = VOXHUD.surface;
  ctx.lineWidth = VOXHUD.surfaceW;
  ctx.beginPath();
  const at = (x, y, z) => iso(x, y, z, s, ox, oy);
  // 唯一棱集：同一条棱被相邻两个面共用，直接画两遍会叠成实白
  // （第二版就吃了这个：每格 12 条边、重叠 2~4 次，白像素冲到 23.9%，片子 1.46%）
  const edges = new Map();
  const addEdge = (p, q) => {
    const ka = `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const kb = `${q[0].toFixed(1)},${q[1].toFixed(1)}`;
    const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    if (!edges.has(key)) edges.set(key, [p, q]);
  };
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      for (let z = 0; z < nz; z++) {
        if (!grid.get(x, y, z)) continue;
        const a = at(x, y + 1, z), b = at(x + 1, y + 1, z), d = at(x, y + 1, z + 1);
        const e2 = at(x + 1, y + 1, z + 1);
        const c = at(x + 1, y, z), e = at(x, y, z + 1), f = at(x + 1, y, z + 1);
        if (!grid.get(x, y + 1, z)) { addEdge(a, b); addEdge(b, e2); addEdge(e2, d); addEdge(d, a); }
        if (!grid.get(x + 1, y, z)) { addEdge(b, c); addEdge(c, f); addEdge(f, e2); addEdge(e2, b); }
        if (!grid.get(x, y, z + 1)) { addEdge(d, e2); addEdge(e2, f); addEdge(f, e); addEdge(e, d); }
      }
    }
  }
  for (const [p, q] of edges.values()) {
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  ctx.restore();
  return edges.size;
}

/**
 * HUD：环 + 十字 + 两个方位箭头 + 选中格方框。
 * 全部**不透明、1px/2px 定宽**，画在几何之后（相当于 no-depth-test 的屏幕空间 pass）。
 */
export function drawHUD(ctx, cx, cy, frameW, sel = null) {
  const r = frameW * VOXHUD.ringR;
  ctx.save();
  ctx.lineWidth = VOXHUD.ringW;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 十字：比环粗一档（实测 2px），长度只到环外 6%
  ctx.lineWidth = VOXHUD.crossW;
  const arm = r * 1.06;
  ctx.beginPath();
  ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
  ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
  ctx.stroke();

  // 方位箭头：顶在环上，一个朝上（+Y）、一个朝右（+X）
  const tri = (x, y, dir) => {
    const L = VOXHUD.arrowL, W = VOXHUD.arrowW;
    ctx.beginPath();
    if (dir === 'up') {
      ctx.moveTo(x, y - L / 2); ctx.lineTo(x - W / 2, y + L / 2); ctx.lineTo(x + W / 2, y + L / 2);
    } else {
      ctx.moveTo(x + L / 2, y); ctx.lineTo(x - L / 2, y - W / 2); ctx.lineTo(x - L / 2, y + W / 2);
    }
    ctx.closePath();
    ctx.fillStyle = VOXHUD.accent;
    ctx.fill();
  };
  tri(cx, cy - r, 'up');
  tri(cx + r, cy, 'right');

  // 选中格：22×20 黄底 + 2px 白边
  if (sel) {
    const [w, h] = VOXHUD.cellBox;
    ctx.fillStyle = VOXHUD.accentEdge;
    ctx.fillRect(sel.x - w / 2 - VOXHUD.edgeW, sel.y - h / 2 - VOXHUD.edgeW, w + VOXHUD.edgeW * 2, h + VOXHUD.edgeW * 2);
    ctx.fillStyle = VOXHUD.accent;
    ctx.fillRect(sel.x - w / 2, sel.y - h / 2, w, h);
  }
  ctx.restore();
  return r;
}

// ── 反测：从渲染结果里把上面那些数再量回来 ──────────────────────────
/**
 * measureCanvas — 量一帧：白像素占比、黄色块、环半径（沿十字线扫描）。
 * 用来断言"改完还和片子一个样"，也用来抓"线画粗了/环画大了"这类回归。
 */
export function measureCanvas(imgData) {
  const { width: w, height: h, data } = imgData;
  let white = 0, ink = 0, accent = 0;
  const accPts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 200) white++;
      if (lum > 140) ink++;
      if (r > 190 && g > 170 && b < 130) { accent++; accPts.push([x, y]); }
    }
  }
  // 环半径：取"最外圈亮像素"的半径，**排除十字臂**（|x-cx|<=2 或 |y-cy|<=2 的整行整列）。
  // 早两版都翻在这上面：沿 +X 扫会量到十字臂端点（132），沿 45° 扫会被 1px 圆弧的
  // 抗锯齿吃成 100 级以下（阈值 150 直接漏检，返回 -1）。取最外圈半径最稳。
  const cx = Math.round(w / 2), cy = Math.round(h / 2);
  let ring = -1;
  for (let y = 0; y < h; y++) {
    if (Math.abs(y - cy) <= 3) continue;
    for (let x = 0; x < w; x++) {
      if (Math.abs(x - cx) <= 3) continue;
      const i = (y * w + x) * 4;
      if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] <= 140) continue;
      const r = Math.hypot(x - cx, y - cy);
      if (r > ring) ring = r;
    }
  }
  ring = Math.round(ring);
  return {
    whitePct: (100 * white) / (w * h),
    inkPct: (100 * ink) / (w * h),
    accentPct: (100 * accent) / (w * h),
    accentBlobs: accPts.length,
    ringRadius: ring,
    ringRatio: ring > 0 ? ring / w : -1,
  };
}

/** 简单体素网格容器。 */
export class VoxGrid {
  constructor(nx, ny, nz) {
    this.dim = [nx, ny, nz];
    this.d = new Uint8Array(nx * ny * nz);
  }
  idx(x, y, z) { return (y * this.dim[2] + z) * this.dim[0] + x; }
  get(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.dim[0] || y >= this.dim[1] || z >= this.dim[2]) return 0;
    return this.d[this.idx(x, y, z)];
  }
  set(x, y, z, v = 1) { this.d[this.idx(x, y, z)] = v; }
  /** 灌一个球（片子里被选中的那坨就是这种团块） */
  sphere(cx, cy, cz, r) {
    for (let y = 0; y < this.dim[1]; y++)
      for (let z = 0; z < this.dim[2]; z++)
        for (let x = 0; x < this.dim[0]; x++) {
          const dx = x - cx, dy = (y - cy) * 1.25, dz = z - cz;
          if (dx * dx + dy * dy + dz * dz <= r * r) this.set(x, y, z, 1);
        }
  }
}
