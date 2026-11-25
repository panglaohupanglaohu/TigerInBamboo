/**
 * orderbadge.js — 小队头顶那面「待命」小盾旗：屏幕空间定尺 + 竖向避让。
 *
 * 原文（827561690896162816，2017-02-03）：
 *   "I'm trying to figure out spears. Anyone know of a game that does spears well?"
 *   —— 这句讲的是矛，不是 HUD。所以旗子完全是从画面读出来的（归类「仅展示 + 观察」）。
 *
 * 画面（410×414，17.73s，24 帧）：
 *   · 山坡上几队蓝衣兵，每队头顶悬一面**蓝底白边小盾旗**，盾心一个**深蓝的感叹号**。
 *     盾形：上边是直的，下面收成一个尖（heater shield），顶上还压着一根**深色横杆**，
 *     像挂墙上的招牌，不是插在杆上的旗。
 *   · 6× 放大（tools/pixprobe.mjs crop）量到：旗宽 26px、高 34px → 宽高比 0.76；
 *     同一帧里近处那队 29×35、坡上那队 30×36（差 3%）——**远处那面并没有变小**。
 *     这就是关键：它是屏幕空间的定尺精灵，不是 3D 里的 billboard 面片。
 *   · 它压在悬崖上方也不被地形裁掉（f012 里旗子跨过山脊线），说明是最后一遍画的 HUD 层。
 *   · 一队一面，不是一人一面：画面里 20+ 个兵，旗只有 4–5 面。
 *
 * 为什么必须定尺：Bad North 一屏几十队，镜头能拉到很远。如果按世界尺寸做 billboard，
 * 拉远时旗子会缩成 3px 的点，而它承载的是"这队还没收到命令"这条**必读信息**；
 * 反过来按深度反向放大又会在近处糊住半个屏幕。定尺是唯一同时满足两端的做法 ——
 * 代价是旗子和它代表的部队在透视上是"脱开"的，所以必须画在最后、且永远不被遮挡。
 *
 * 定尺带来的新问题：队伍扎堆时旗子会重叠（片子里前排两队正好挨着）。
 * 所以布局这一步要做竖向避让：同列（横向重叠）的旗子从上往下推，推不开就压扁间距。
 */

export const BADGE = {
  w: 26, h: 34,          // 410×414 的片子里量到的像素尺寸（6× 裁剪反算）
  aspect: 0.76,          // 26/34
  barH: 3,               // 顶上那根深色横杆
  barOverhang: 0.16,     // 横杆每边比盾宽出的比例
  gap: 3,                // 避让时的最小间距
  colors: {
    field: '#6fa9d8',    // 盾面（片子蓝簇均值 #6193b3，取偏亮的一档）
    edge: '#f9fdfe',     // 白描边（裁剪里最亮那簇就是它）
    glyph: '#22334d',    // 感叹号
    bar: '#2f3b4d',      // 横杆
  },
};

/** 状态 → 字形。片子只拍到「!」这一种；另外两种是同系统的推断，注释里标明。 */
export const GLYPHS = {
  order: '!',    // 实测：还没下令
  routed: '×',   // 推断：溃败（片子里没出现）
  rally: '+',    // 推断：集合
};

/**
 * 定尺：不管深度，永远是 BADGE.w × BADGE.h。
 * 这里保留成函数而不是常量，是为了让"定尺"这件事在代码里显式可见 ——
 * 它和 naiveSize() 的对比就是这个模块唯一的判据。
 */
export function badgeSize() {
  return { w: BADGE.w, h: BADGE.h };
}

/**
 * 反例：按世界尺寸投影（depth = 相机到小队的距离 / 参考距离）。
 * 只用来做 A/B —— 片子里远队没有缩小，所以真实实现一定不是这个。
 */
export function naiveSize(depth) {
  const k = 1 / Math.max(0.15, depth);
  return { w: BADGE.w * k, h: BADGE.h * k };
}

/**
 * 布局：输入小队（屏幕坐标 + 锚点高度），输出每面旗的左上角。
 * 锚点：小队包围盒顶部再抬高 0.45×旗高（片子里旗底离最近的头盔约 4–5px）。
 * 避让：按 y 排序，同列重叠就往上顶 —— 往上不往下，因为下面是小队本身。
 */
export function layoutBadges(squads) {
  const { w, h } = badgeSize();
  const list = squads
    .filter((s) => s.state && s.state !== 'none')
    .map((s) => ({ ...s, bx: s.x - w / 2, by: s.y - h * 1.45 }))
    .sort((a, b) => a.by - b.by);

  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = list[j], b = list[i];
      const overlapX = Math.abs((a.bx + w / 2) - (b.bx + w / 2)) < w + 2;
      if (!overlapX) continue;
      const need = (a.by + h + BADGE.gap) - b.by;
      if (need > 0) b.by -= need;     // 往上顶
    }
  }
  return list;
}

/** 盾形路径（heater shield：直上边 + 收尖的下摆）。 */
export function shieldPath(ctx, x, y, w, h) {
  const shoulder = y + h * 0.62;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, shoulder);
  ctx.quadraticCurveTo(x + w, y + h * 0.84, x + w / 2, y + h);
  ctx.quadraticCurveTo(x, y + h * 0.84, x, shoulder);
  ctx.closePath();
}

/** 画一面旗。ctx 需已经是"屏幕像素"坐标系。 */
export function drawBadge(ctx, x, y, state = 'order', opts = {}) {
  const { w, h } = badgeSize();
  const c = { ...BADGE.colors, ...(opts.colors || {}) };

  // 横杆（比盾宽一点，两端各露 barOverhang）
  const bw = w * (1 + BADGE.barOverhang * 2);
  ctx.fillStyle = c.bar;
  ctx.fillRect(x - w * BADGE.barOverhang, y - BADGE.barH - 1, bw, BADGE.barH + 1);

  // 盾面
  shieldPath(ctx, x, y, w, h);
  ctx.fillStyle = c.field;
  ctx.fill();

  // 白描边 + 内层白线（片子里是"白边 + 里面再一圈细白框"）
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const inset = Math.max(2.2, w * 0.16);
  shieldPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2);
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // 字形
  const g = GLYPHS[state];
  if (g) {
    ctx.fillStyle = c.glyph;
    ctx.font = `700 ${Math.round(h * 0.5)}px ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g, x + w / 2, y + h * 0.44);
  }
  return { x, y, w, h };
}

/**
 * 画整层。调用方保证这是最后一遍（不被地形遮挡）。
 * 返回每面旗的实际矩形，供像素验证去扫。
 */
export function drawBadgeLayer(ctx, squads) {
  const out = [];
  for (const b of layoutBadges(squads)) out.push(drawBadge(ctx, b.bx, b.by, b.state));
  return out;
}

/**
 * 像素验证：在画布上找旗面颜色（蓝色域）的连通块，返回它们的包围盒。
 * 这样"定尺"不是靠我说，是靠在渲染结果里量出来的高度。
 */
export function measureBadges(imgData, W, H, field = BADGE.colors.field) {
  const fr = parseInt(field.slice(1, 3), 16), fg = parseInt(field.slice(3, 5), 16), fb = parseInt(field.slice(5, 7), 16);
  const hit = (i) => Math.abs(imgData.data[i] - fr) < 26 && Math.abs(imgData.data[i + 1] - fg) < 26 && Math.abs(imgData.data[i + 2] - fb) < 26;
  const seen = new Uint8Array(W * H);
  const boxes = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (seen[p] || !hit(p * 4)) continue;
    const st = [p]; seen[p] = 1;
    let minx = x, maxx = x, miny = y, maxy = y, n = 0;
    while (st.length) {
      const q = st.pop(); const qx = q % W, qy = (q - qx) / W; n++;
      if (qx < minx) minx = qx; if (qx > maxx) maxx = qx;
      if (qy < miny) miny = qy; if (qy > maxy) maxy = qy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const r = ny * W + nx;
        if (!seen[r] && hit(r * 4)) { seen[r] = 1; st.push(r); }
      }
    }
    if (n > 60) boxes.push({ x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, px: n });
  }
  return boxes;
}
