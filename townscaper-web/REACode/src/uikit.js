/**
 * uikit.js —— "把一排无聊的按钮变得有生气，只要把它们微微歪一点"。
 *
 * 帖子 ID：1242824460325052417（2020-03-25，tools，townscaper）
 *
 *   "Finally making some proper UI. Turns out you can make a boring list of
 *    buttons playful by just tilting them slightly."
 *
 * 同批参考（同一个 UI 改造阶段）：
 *   1016680972610359298 "This is what the confirm popup looks like:"
 *   1024679338292256769 "Some UI flair"
 *   1201179450668441600 "Icons!"
 *
 * ---- 画面观察（每条 6 帧，512²） ----
 *   · 左侧是**一列圆角方块**，颜色从红→橙→黄→绿→青→蓝→紫排下来（色相沿列表走一圈），
 *     每块里一个白色小图标；右侧是同一套风格的面板与标题条；
 *   · 关键不是颜色，是**对齐被故意破坏了一点点**：每块的左边缘、竖直位置、倾斜角
 *     都不完全一样，但整体仍然读得成一条线 —— 歪的幅度目测 ≤2°，位移 ≤3px；
 *   · 每块之间始终留着可见的缝（tap 目标不重叠），说明"歪"是加在**绘制**上的，
 *     不是把布局打散重排；
 *   · 确认弹窗（1016680972610359298）是同一套语言：米色/灰色的圆角面板、粗描边、
 *     按钮也是歪的，投影不带模糊（硬阴影）。
 *
 * ---- 机制：歪在绘制，不在布局 ----
 * 列表的**槽位**仍然是一列等距矩形（点击判定、滚动、对齐都靠它）；
 * 每个条目渲染时按 index 取一个确定性的小扰动（旋转/位移），
 * 所以同一块按钮每次都在同一个歪的姿势上 —— 不是每帧随机抖，那样看久了让人晕。
 * 扰动幅度必须小于槽距的一半，否则相邻条的包围盒会叠在一起、点击会串。
 * 这一条是能量出来的：这里直接给出"最大旋转 / 最大位移 / 相邻包围盒重叠对数"。
 */

// 确定性 hash：同一个 index + seed 永远给同一个数，便于美术微调后复现
export function hash01(n) {
  let h = (n | 0) * 2654435761;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296;
}

/**
 * 一个条目的"俏皮扰动"。
 * maxRot 度数、dx/dy 像素；三者的比例是有讲究的：
 * 旋转给"手摆"的感觉，位移给"没对齐"的感觉，但位移不能超过缝宽的一半。
 */
export function jitter(i, opt = {}) {
  const seed = opt.seed ?? 17;
  const maxRot = opt.maxRot ?? 1.6;      // 度
  const maxDx = opt.maxDx ?? 2.4;        // px
  const maxDy = opt.maxDy ?? 1.8;        // px
  const a = hash01(i * 3 + seed);
  const b = hash01(i * 3 + seed + 101);
  const c = hash01(i * 3 + seed + 211);
  return {
    rot: (a * 2 - 1) * maxRot,
    dx: (b * 2 - 1) * maxDx,
    dy: (c * 2 - 1) * maxDy,
    // 图标跟着歪一点点外带一点点位移，让它看起来是"贴在块上"而不是"贴在屏幕上"
    iconRot: (b * 2 - 1) * maxRot * 0.8,
  };
}

/**
 * 槽位布局：一列等距方块。槽位是"事实"，jitter 是"看法"。
 * 返回每条的槽矩形与扰动后的包围盒，顺带数一下重叠。
 */
export function layoutList(n, opt = {}) {
  const x = opt.x ?? 0, y = opt.y ?? 0;
  const size = opt.size ?? 40, gap = opt.gap ?? 6;
  const wob = opt.wobble !== false;
  const items = [];
  for (let i = 0; i < n; i++) {
    const slot = { x, y: y + i * (size + gap), w: size, h: size };
    const j = wob ? jitter(i, opt) : { rot: 0, dx: 0, dy: 0, iconRot: 0 };
    // 旋转后的 AABB 半边长（正方形转 θ 后外接半宽 = s/2·(|cos|+|sin|)）
    const r = (Math.abs(j.rot) * Math.PI) / 180;
    const half = (size / 2) * (Math.cos(r) + Math.sin(r));
    const cx = slot.x + size / 2 + j.dx, cy = slot.y + size / 2 + j.dy;
    items.push({ ...slot, ...j, cx, cy, aabb: { x: cx - half, y: cy - half, w: half * 2, h: half * 2 } });
  }
  let overlaps = 0, minGap = Infinity;
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1].aabb, b = items[i].aabb;
    const sep = b.y - (a.y + a.h);
    minGap = Math.min(minGap, sep);
    if (sep < 0) overlaps++;
  }
  const rot = items.map((it) => Math.abs(it.rot));
  const disp = items.map((it) => Math.hypot(it.dx, it.dy));
  return {
    items, overlaps,
    minGapPx: minGap,
    maxRotDeg: Math.max(...rot),
    maxDispPx: Math.max(...disp),
    meanRotDeg: rot.reduce((s, v) => s + v, 0) / rot.length,
  };
}

/** 色相沿列表走一圈：这是画面里最显眼的一层，红→紫排下来 */
export function hueFor(i, n) {
  return (i / Math.max(1, n - 1)) * 300;   // 0 = 红, 300 = 紫（不回红，避免首尾同色）
}

export function colorFor(i, n) {
  const h = hueFor(i, n);
  return { fill: `hsl(${h} 62% 62%)`, edge: `hsl(${h} 55% 44%)` };
}

/**
 * 图标：8 个 24×24 的路径，全部只用描边（stroke），跟画面里那种白色细线图标一致。
 * 用 path 数据而不是字体，是为了能跟着按钮一起旋转/缩放而不糊。
 */
export const GLYPHS = {
  brush: 'M4 20c3 0 4-1.5 4-4M4 20c0-2 1-3 3-3M7 17 17 7l-1-1-10 10ZM16 6l2 2-3 3-2-2Z',
  hammer: 'M4 20l5-5M9 15l7-7M13 5l6 6M16 8l2-2',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  water: 'M4 9c2-2 4-2 6 0s4 2 6 0 4-2 4 0M4 15c2-2 4-2 6 0s4 2 6 0 4-2 4 0',
  tree: 'M12 3l4 6h-2l3 5h-4v7h-2v-7H7l3-5H8Z',
  grid: 'M4 4h16v16H4Z M4 12h16 M12 4v16',
  camera: 'M3 8h4l2-2h6l2 2h4v11H3Z M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  wand: 'M5 19 15 9M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z',
};
