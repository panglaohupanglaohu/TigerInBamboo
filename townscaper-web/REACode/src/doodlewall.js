/**
 * doodlewall.js — 走廊墙面：一块一块的底色 + 手绘涂鸦线稿 + 护墙板竖条纹。
 *
 * 原文：x.com/OskSta/status/1897266928961700215 (2025-03-05)
 *       "Yet another hallway design"
 *       x.com/OskSta/status/1890018647655272491 (2025-02-13)
 *       "Further iterations on hallway design"      ← 同一条走廊的灰度版
 *
 * 画面观察（1897266928961700215 的第 8 帧，1:1 裁剪）：
 *   · 墙被竖缝切成 **一段一段的 panel**，每段一个柔和的底色（淡蓝 / 薄荷绿 /
 *     米黄 / 淡粉），相邻两段颜色不同，但**明度几乎一样**（都是"奶味"淡色）；
 *   · 每段 panel 上是一格一格的**涂鸦**：鱼、猫头鹰、花、四叶草、甲虫、山羊头，
 *     深褐色细线（不是纯黑，色相偏暖），线宽约为 panel 宽的 0.6%；
 *   · 涂鸦**不成行列**：纵向 3~5 个、横向 2~3 个，大小差一倍，互相挤在一起；
 *   · 段与段之间的竖缝里塞了一条**窄花边**（三角/箭头/横线），底色是白的；
 *   · 下半部是白色**护墙板**：竖向密条纹（间距约 6px），顶端一道深色横梁；
 *   · 1890018647655272491 是同一套东西的**灰度版**：只有线，没有底色。
 *
 * 所以这不是"一张手绘贴图"，而是**一套 generator**：
 *     每段 = 底色 + 若干 motif + 窄花边；motif 是参数化的线稿。
 * 下面就把 motif 写成路径函数 —— 这是整件事里唯一"必须手写"的部分，
 * 其余（布局、抖动、密度、配色）都是可量化的。
 */

/** 深褐色墨线：参考帧里的线不是纯黑，是 #3a332c 附近。 */
export const INK = 'rgba(58,51,44,0.92)';

/** 奶味淡色：明度都在 0.86~0.93，色相差很大但饱和度很低（0.10~0.22）。 */
export const PANEL_TINTS = ['#c9d6ea', '#c9e3c5', '#f0dfc0', '#efd2d4', '#dcd8ea', '#d9e6df'];
export const PAPER = '#f4f2ec';

export function makeRng(seed) {
  let s = (seed * 22695477 + 1) | 0;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 8) / 16777216;
}

/* ------------------------------------------------------------------ motif */

/**
 * 每个 motif 都是"以原点为中心、半径约为 s"的一簇笔画。
 * 参数 t 是这支笔的粗细（调用方按 panel 宽度算好，保证线宽一致）。
 */
const MOTIFS = {
  /** 鱼：椭圆身体 + 三角尾 + 鳃 + 三片鳍 + 眼睛。 */
  fish(ctx, s, t) {
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.78, s * 0.40, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.74, 0); ctx.lineTo(-s * 1.18, -s * 0.40); ctx.lineTo(-s * 1.18, s * 0.40);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.46, -s * 0.08, s * 0.09, 0, Math.PI * 2); ctx.stroke();
    // 鳃
    ctx.beginPath(); ctx.arc(s * 0.22, 0, s * 0.26, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
    // 背鳍 / 腹鳍 / 侧鳍
    ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.36); ctx.quadraticCurveTo(0, -s * 0.72, s * 0.24, -s * 0.34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.36); ctx.quadraticCurveTo(0, s * 0.66, s * 0.22, s * 0.34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.02, s * 0.16); ctx.lineTo(s * 0.22, s * 0.5); ctx.stroke();
  },

  /** 猫头鹰：两个大眼 + 身体 + 耳羽 + 爪。 */
  owl(ctx, s, t) {
    ctx.beginPath(); ctx.ellipse(0, s * 0.16, s * 0.52, s * 0.66, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.24, -s * 0.26, s * 0.24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.24, -s * 0.26, s * 0.24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.24, -s * 0.26, s * 0.06, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.24, -s * 0.26, s * 0.06, 0, Math.PI * 2); ctx.stroke();
    // 喙
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.06); ctx.lineTo(-s * 0.09, s * 0.10); ctx.lineTo(s * 0.09, s * 0.10);
    ctx.closePath(); ctx.stroke();
    // 耳羽
    ctx.beginPath(); ctx.moveTo(-s * 0.46, -s * 0.42); ctx.lineTo(-s * 0.34, -s * 0.78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.46, -s * 0.42); ctx.lineTo(s * 0.34, -s * 0.78); ctx.stroke();
    // 翅膀
    ctx.beginPath(); ctx.arc(-s * 0.30, s * 0.30, s * 0.26, -Math.PI * 0.2, Math.PI * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.30, s * 0.30, s * 0.26, Math.PI * 0.5, Math.PI * 1.2); ctx.stroke();
  },

  /** 花：五瓣 + 花心 + 茎 + 两片叶。 */
  flower(ctx, s, t) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34, s * 0.22, s * 0.30, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.55); ctx.lineTo(0, s * 1.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.82); ctx.quadraticCurveTo(s * 0.34, s * 0.72, s * 0.30, s * 1.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.92); ctx.quadraticCurveTo(-s * 0.34, s * 0.84, -s * 0.30, s * 1.12); ctx.stroke();
  },

  /** 四叶草：三片心形 + 梗。 */
  clover(ctx, s, t) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const cx = Math.cos(a) * s * 0.30, cy = Math.sin(a) * s * 0.30;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.10, cy + s * 0.12);
      ctx.lineTo(cx, cy + s * 0.34);
      ctx.lineTo(cx + s * 0.10, cy + s * 0.12);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, s * 0.4); ctx.lineTo(0, s * 1.05); ctx.stroke();
  },

  /** 甲虫：椭圆身 + 中缝 + 六条腿 + 触角。 */
  bug(ctx, s, t) {
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.40, s * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.48); ctx.lineTo(0, s * 0.58); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.52, s * 0.20, 0, Math.PI * 2); ctx.stroke();
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y = s * (-0.18 + k * 0.26);
        ctx.beginPath();
        ctx.moveTo(side * s * 0.34, y);
        ctx.quadraticCurveTo(side * s * 0.72, y + s * 0.10, side * s * 0.80, y + s * 0.28);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(side * s * 0.12, -s * 0.66);
      ctx.quadraticCurveTo(side * s * 0.30, -s * 0.95, side * s * 0.10, -s * 1.05);
      ctx.stroke();
    }
  },

  /** 山羊头（参考帧里最大的一只）。 */
  mask(ctx, s, t) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.55);
    ctx.quadraticCurveTo(-s * 0.46, s * 0.35, 0, s * 0.92);
    ctx.quadraticCurveTo(s * 0.46, s * 0.35, s * 0.34, -s * 0.55);
    ctx.quadraticCurveTo(0, -s * 0.78, -s * 0.34, -s * 0.55);
    ctx.stroke();
    // 角
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.30, -s * 0.60);
      ctx.quadraticCurveTo(side * s * 0.78, -s * 0.86, side * s * 0.62, -s * 1.16);
      ctx.stroke();
    }
    // 眼 + 鼻
    ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.16, s * 0.075, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.16, s * 0.075, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.lineTo(0, s * 0.30); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, s * 0.34, s * 0.12, 0, Math.PI * 2); ctx.stroke();
  },

  /** 波浪（窄花边用）。 */
  wave(ctx, s, t) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = -s + (i / 8) * s * 2;
      const y = Math.sin((i / 8) * Math.PI * 2) * s * 0.35;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },

  /** 三角（窄花边用）。 */
  zig(ctx, s, t) {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const x = -s + (i / 6) * s * 2;
      const y = i % 2 ? s * 0.3 : -s * 0.3;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
};

const NAMES = ['fish', 'owl', 'flower', 'clover', 'bug', 'mask'];

/**
 * 画一格涂鸦。
 *
 * `scale` 是这一格的中心到边的距离（世界/像素都行，只要有意义）。
 * 线宽 = scale * ink，**统一**传入 —— 参考帧里所有涂鸦的线宽是一样的，
 * 只是尺寸不同；如果按尺寸缩放线宽，小涂鸦会糊成一团。
 */
export function drawMotif(ctx, kind, cx, cy, scale, lineWidth, rot = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.strokeStyle = INK;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fn = MOTIFS[kind] || MOTIFS.flower;
  fn(ctx, scale, lineWidth);
  ctx.restore();
}

/* ---------------------------------------------------------------- 布局 */

/**
 * 生成一整面墙的贴图。
 *
 * 参数量自参考帧（1897266928961700215 第 8 帧，640×640 裁剪）：
 *   · 一段 panel 宽 ≈ 140px，墙高 ≈ 640 → **宽高比 0.22**；
 *   · 每段 panel 里 1~2 列涂鸦，纵向 3~4 个，尺寸相差 1.6~2.2 倍；
 *   · 护墙板高度 ≈ 总高的 38%，竖条纹间距 ≈ 5.6px；
 *   · 竖缝 ≈ 12px，里面是一条花边 + 两侧各 2px 白边。
 */
export function makeDoodleWall({
  width = 1024,
  height = 640,
  seed = 7,
  panelWidth = 150,
  gray = false,
  wainscot = 0.38,
  // 每段 panel 纵向几个涂鸦；参考帧实测墨线占墙区 5.6%，密度由这个数决定
  rows = 7,
  // 涂鸦相对 panel 宽度的尺寸
  motifScale = 0.34,
  // 额外塞一只小配饰的概率
  garnish = 0.85,
} = {}) {
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  const ctx = cv.getContext('2d');
  const rnd = makeRng(seed);

  // 底：纸色
  ctx.fillStyle = gray ? '#ffffff' : PAPER;
  ctx.fillRect(0, 0, width, height);

  const wallH = height * (1 - wainscot);
  const ink = Math.max(1.4, width * 0.0028);
  let x = 0;
  let panel = 0;
  const panels = [];

  while (x < width) {
    const w = panelWidth * (0.82 + rnd() * 0.42);
    const tint = gray ? '#ffffff' : PANEL_TINTS[(panel + seed) % PANEL_TINTS.length];

    // 底色
    ctx.fillStyle = tint;
    ctx.fillRect(x, 0, w, wallH);

    // 涂鸦：不按行列，随机撒，互相可以重叠（参考帧里就是挤在一起）
    const cols = w > panelWidth * 0.95 ? 2 : 1;
    const perCol = rows + ((rnd() * 2) | 0) - 1;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < perCol; r++) {
        const s = (w / (cols + 0.35)) * (motifScale * (0.72 + rnd() * 0.56));
        const cx = x + w * (c + 0.5) / cols + (rnd() - 0.5) * w * 0.14;
        // 纵向抖动给到 0.18：太小会排成整齐的格子，参考帧里涂鸦是挤着长的
        const cy = wallH * (0.13 + r * 0.76 / Math.max(1, perCol - 1)) + (rnd() - 0.5) * wallH * 0.18;
        const kind = NAMES[(rnd() * NAMES.length) | 0];
        drawMotif(ctx, kind, cx, cy, s, ink, (rnd() - 0.5) * 0.35);
        if (rnd() < garnish) {
          // 小配饰：一朵小花 / 一只小虫，塞在空隙里（"密度不均匀"的关键）
          drawMotif(ctx, rnd() < 0.5 ? 'clover' : 'bug',
            cx + (rnd() - 0.5) * s * 2.2, cy + (rnd() - 0.5) * s * 2.0, s * 0.42, ink * 0.9);
        }
      }
    }

    // 段末的窄花边（白底 + 一条竖排花纹）
    const gapW = Math.max(10, width * 0.012);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + w, 0, gapW, wallH);
    ctx.save();
    ctx.translate(x + w + gapW / 2, wallH * 0.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = ink * 0.9;
    ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const y = (k - 4) * wallH * 0.10;
      const s = gapW * 0.34;
      ctx.beginPath();
      ctx.moveTo(-s, y - s * 0.4); ctx.lineTo(0, y + s * 0.4); ctx.lineTo(s, y - s * 0.4);
      ctx.stroke();
    }
    ctx.restore();

    panels.push({ x, w, tint });
    x += w + gapW;
    panel++;
  }

  // 护墙板：白底 + 竖条纹 + 顶梁
  const wy = wallH;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, wy, width, height - wy);
  ctx.strokeStyle = 'rgba(58,51,44,0.55)';
  ctx.lineWidth = 1;
  const pitch = Math.max(4, Math.round(width * 0.0055));
  for (let gx = pitch; gx < width; gx += pitch) {
    ctx.beginPath(); ctx.moveTo(gx + 0.5, wy + height * 0.045); ctx.lineTo(gx + 0.5, height); ctx.stroke();
  }
  // 顶梁（粗一道 + 细一道，参考帧里是"双线"）
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, height * 0.006);
  ctx.beginPath(); ctx.moveTo(0, wy + 1); ctx.lineTo(width, wy + 1); ctx.stroke();
  ctx.lineWidth = Math.max(1, height * 0.002);
  ctx.beginPath(); ctx.moveTo(0, wy + height * 0.032); ctx.lineTo(width, wy + height * 0.032); ctx.stroke();

  const ink_ = measureInk(ctx, width, height);
  return {
    canvas: cv,
    panels: panels.length,
    width, height, wallH, pitch,
    stats: {
      panels: panels.length,
      panelWidthAvg: +(width / Math.max(1, panels.length)).toFixed(1),
      inkPct: ink_,
      wainscotPct: +(wainscot * 100).toFixed(0),
      flutePitch: pitch,
    },
  };
}

/** 墨线占比：非白的像素比例。用来量化"涂鸦有多密"。 */
function measureInk(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 170 && d[i + 1] < 170) dark++;
  }
  return +((dark / (w * h)) * 100).toFixed(2);
}
