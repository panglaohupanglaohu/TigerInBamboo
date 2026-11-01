/**
 * portrait.js — 分层插槽的头像生成器：同一套"层级"，换内容就换风格。
 *
 * 原文（x.com/OskSta/status/958371606350454784, 2018-01-30）：
 *
 *   "The beginnings of a portrait generator. It currently runs on 5 examples
 *    (all male and with a similar hierarchy) but it's content agnostic and
 *    should support a diverse set of inputs."
 *
 * 画面（24 帧 = 24 张不同的脸，同一构图）：深蓝底，一张竖长的白脸；
 * 头发有侧分/平头/后移/卷曲纹理/光头+胡茬五种；眉毛细而深，眼是重眼皮的椭圆，
 * 鼻子是一条长竖笔 + 粉红鼻头，嘴是一条短横线，耳是两个小 C。
 * **层级完全一致**，变的只有每个槽位里的形状。
 *
 * 原文那句 "content agnostic" 是关键：生成器不认识"男性/发型/鼻子"这些概念，
 * 它只知道"一条槽位序列 + 每条槽位有一组可选形状"。所以换一套素材就能画别的东西。
 * 这里把这条做实：
 *   ① `SLOTS` 是一张**纯数据**表（顺序 + 每个槽的可选变体 + 锚点）；
 *   ② 每个变体是一个 `(ctx, box, rnd, params)` 的绘制函数，只认自己的盒子；
 *   ③ 生成器只负责给每条槽位抽一个变体（可带层级继承，比如"鼻子长度影响嘴的高度"）。
 *
 * 量化：24 个种子的**剪影差异**（两两 IoU 的 1−均值）。太低说明"换汤不换药"，
 * 太高说明层级没起作用（脸都不像同一套系统画的）。这条曲线是这套做法唯一能自证的方式。
 */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INK = '#2a2118';
const SKIN = '#efe6d8';
const SKIN_SH = '#dfd2c0';
const PINK = '#e79a92';

/* ------------------------------------------------------------ 画具 */

function path(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

/** 一个变体的签名：在给定盒子里画，坐标全部归一化到 0..1。 */
const V = {};

/* ---- 底：背景 ---- */
V.bg = {
  flat(ctx, b) {
    ctx.fillStyle = '#2f5f8c';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // 帧里背景有极淡的横向色带
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 6; i++) ctx.fillRect(b.x, b.y + (i * b.h) / 6, b.w, b.h / 22);
  },
  vignette(ctx, b) {
    const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h * 0.42, b.w * 0.15,
      b.x + b.w / 2, b.y + b.h * 0.5, b.w * 0.75);
    g.addColorStop(0, '#3a6f9e');
    g.addColorStop(1, '#1e4266');
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  },
};

/* ---- 头型 ---- */
V.head = {
  oval(ctx, b, p) {
    // 竖长椭圆，下颌略窄
    const cx = b.x + b.w * 0.5, cy = b.y + b.h * 0.46;
    const rx = b.w * 0.30 * p.wide, ry = b.h * 0.40 * p.long;
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // 下颌阴影
    ctx.fillStyle = 'rgba(200,185,168,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.55, rx * 0.82, ry * 0.34, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = b.w * 0.012;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    return { cx, cy, rx, ry };
  },
  narrow(ctx, b, p) {
    const box = V.head.oval(ctx, b, { ...p, wide: p.wide * 0.86, long: p.long * 1.06 });
    return box;
  },
};

/* ---- 耳 ---- */
V.ear = {
  small(ctx, b, p, head) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = b.w * 0.011;
    ctx.fillStyle = SKIN;
    for (const sgn of [-1, 1]) {
      const x = head.cx + sgn * head.rx * 0.98;
      const y = head.cy + head.ry * 0.02;
      ctx.beginPath();
      ctx.ellipse(x, y, head.rx * 0.14, head.ry * 0.13, 0, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.fill(); ctx.stroke();
    }
  },
  big(ctx, b, p, head) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = b.w * 0.012;
    ctx.fillStyle = SKIN;
    for (const sgn of [-1, 1]) {
      const x = head.cx + sgn * head.rx * 1.0;
      const y = head.cy + head.ry * 0.04;
      ctx.beginPath();
      ctx.ellipse(x, y, head.rx * 0.19, head.ry * 0.17, 0, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, head.rx * 0.09, head.ry * 0.09, 0, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
    }
  },
};

/* ---- 发 ---- */
function hairFill(ctx, head, style) {
  // 统一用"帽壳"思路：沿头顶画一段弧，再按风格决定下沿
  const { cx, cy, rx, ry } = head;
  ctx.fillStyle = style.color || '#4a3526';
  ctx.strokeStyle = INK;
  ctx.lineWidth = rx * 0.06;
  return { cx, cy, rx, ry };
}

V.hair = {
  sidePart(ctx, b, p, head) {
    const { cx, cy, rx, ry } = head;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.02, cy - ry * 0.18);
    ctx.quadraticCurveTo(cx - rx * 1.06, cy - ry * 1.06, cx, cy - ry * 1.10);
    ctx.quadraticCurveTo(cx + rx * 1.02, cy - ry * 1.12, cx + rx * 1.0, cy - ry * 0.10);
    ctx.lineTo(cx + rx * 0.34, cy - ry * 0.24);
    ctx.quadraticCurveTo(cx + rx * 0.10, cy - ry * 0.72, cx - rx * 0.42, cy - ry * 0.72);
    ctx.quadraticCurveTo(cx - rx * 0.92, cy - ry * 0.66, cx - rx * 1.02, cy - ry * 0.18);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = rx * 0.055;
    ctx.stroke();
    // 纹理：几道顺着头型走的深色细线（帧里最显眼的特征）
    ctx.strokeStyle = 'rgba(30,20,12,0.5)';
    ctx.lineWidth = rx * 0.035;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      ctx.beginPath();
      ctx.moveTo(cx - rx * (0.92 - t * 0.5), cy - ry * (0.95 - t * 0.15));
      ctx.quadraticCurveTo(cx + rx * (0.1 + t * 0.5), cy - ry * (0.95 - t * 0.5),
        cx + rx * (0.85 - t * 0.2), cy - ry * (0.22 + t * 0.28));
      ctx.stroke();
    }
    ctx.restore();
  },
  buzz(ctx, b, p, head) {
    const { cx, cy, rx, ry } = head;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy - ry * 0.52, rx * 1.02, ry * 0.62, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = rx * 0.05;
    ctx.stroke();
    // 短发点阵
    ctx.fillStyle = 'rgba(20,14,8,0.35)';
    for (let i = 0; i < 90; i++) {
      const a = Math.PI + (i / 90) * Math.PI;
      const r = 0.55 + (i % 5) * 0.08;
      ctx.fillRect(cx + Math.cos(a) * rx * r * 1.02, cy - ry * 0.52 + Math.sin(a) * ry * r * 0.62, rx * 0.03, rx * 0.03);
    }
    ctx.restore();
  },
  bald(ctx, b, p, head) {
    const { cx, cy, rx, ry } = head;
    ctx.save();
    // 只留两侧一小撮
    ctx.fillStyle = p.color;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sgn * rx * 0.95, cy - ry * 0.16, rx * 0.16, ry * 0.26, 0, 0, 7);
      ctx.fill();
    }
    // 胡茬点
    ctx.fillStyle = 'rgba(90,70,50,0.30)';
    for (let i = 0; i < 60; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 60));
      const rr = 0.82 + (i % 4) * 0.05;
      ctx.fillRect(cx + Math.cos(a) * rx * rr * 0.8, cy + Math.sin(a) * ry * rr * 0.86, rx * 0.026, rx * 0.026);
    }
    ctx.restore();
  },
  receding(ctx, b, p, head) {
    const { cx, cy, rx, ry } = head;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.98, cy - ry * 0.06);
    ctx.quadraticCurveTo(cx - rx * 0.9, cy - ry * 0.78, cx, cy - ry * 0.80);
    ctx.quadraticCurveTo(cx + rx * 0.9, cy - ry * 0.78, cx + rx * 0.98, cy - ry * 0.06);
    ctx.lineTo(cx + rx * 0.78, cy - ry * 0.02);
    ctx.quadraticCurveTo(cx + rx * 0.5, cy - ry * 0.42, cx, cy - ry * 0.40);
    ctx.quadraticCurveTo(cx - rx * 0.5, cy - ry * 0.42, cx - rx * 0.78, cy - ry * 0.02);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = rx * 0.05;
    ctx.stroke();
    ctx.restore();
  },
};

/* ---- 眉 / 眼 / 鼻 / 嘴 ---- */
V.brow = {
  thin(ctx, b, p, head) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = head.rx * 0.07;
    ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(head.cx + sgn * head.rx * 0.62, head.cy - head.ry * 0.14);
      ctx.lineTo(head.cx + sgn * head.rx * 0.20, head.cy - head.ry * 0.19 + p.tilt);
      ctx.stroke();
    }
  },
  thick(ctx, b, p, head) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = head.rx * 0.12;
    ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(head.cx + sgn * head.rx * 0.66, head.cy - head.ry * 0.12);
      ctx.lineTo(head.cx + sgn * head.rx * 0.18, head.cy - head.ry * 0.20 + p.tilt);
      ctx.stroke();
    }
  },
};

V.eye = {
  heavy(ctx, b, p, head) {
    for (const sgn of [-1, 1]) {
      const x = head.cx + sgn * head.rx * 0.40;
      const y = head.cy - head.ry * 0.02;
      // 眼白（椭圆）
      ctx.fillStyle = '#f7f4ee';
      ctx.strokeStyle = INK;
      ctx.lineWidth = head.rx * 0.035;
      ctx.beginPath();
      ctx.ellipse(x, y, head.rx * 0.19, head.ry * 0.10, 0, 0, 7);
      ctx.fill(); ctx.stroke();
      // 瞳孔
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + sgn * head.rx * 0.02, y, head.ry * 0.045, 0, 7);
      ctx.fill();
      // 重眼皮：上缘一条粗线 + 眼袋
      ctx.strokeStyle = 'rgba(90,70,55,0.55)';
      ctx.lineWidth = head.rx * 0.05;
      ctx.beginPath();
      ctx.ellipse(x, y + head.ry * 0.015, head.rx * 0.19, head.ry * 0.10, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,100,85,0.35)';
      ctx.lineWidth = head.rx * 0.03;
      ctx.beginPath();
      ctx.ellipse(x, y + head.ry * 0.09, head.rx * 0.16, head.ry * 0.05, 0, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
  },
  wide(ctx, b, p, head) {
    for (const sgn of [-1, 1]) {
      const x = head.cx + sgn * head.rx * 0.40;
      const y = head.cy - head.ry * 0.03;
      ctx.fillStyle = '#fbf8f2';
      ctx.strokeStyle = INK;
      ctx.lineWidth = head.rx * 0.035;
      ctx.beginPath();
      ctx.ellipse(x, y, head.rx * 0.22, head.ry * 0.13, 0, 0, 7);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + sgn * head.rx * 0.03, y + head.ry * 0.01, head.ry * 0.055, 0, 7);
      ctx.fill();
    }
  },
};

V.nose = {
  long(ctx, b, p, head) {
    const x = head.cx, y0 = head.cy - head.ry * 0.02, y1 = head.cy + head.ry * (0.30 * p.len);
    // 鼻梁：一条略带弯的粗线
    ctx.strokeStyle = 'rgba(60,45,35,0.85)';
    ctx.lineWidth = head.rx * 0.055;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - head.rx * 0.02, y0);
    ctx.quadraticCurveTo(x + head.rx * 0.04, (y0 + y1) / 2, x + head.rx * 0.02, y1);
    ctx.stroke();
    // 鼻头：粉红团（帧里最抢眼的色块）
    ctx.fillStyle = PINK;
    ctx.strokeStyle = 'rgba(60,45,35,0.8)';
    ctx.lineWidth = head.rx * 0.03;
    ctx.beginPath();
    ctx.ellipse(x + head.rx * 0.02, y1, head.rx * 0.085, head.rx * 0.07, 0, 0, 7);
    ctx.fill(); ctx.stroke();
  },
  short(ctx, b, p, head) {
    V.nose.long(ctx, b, { ...p, len: p.len * 0.62 }, head);
  },
};

V.mouth = {
  line(ctx, b, p, head) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = head.rx * 0.06;
    ctx.lineCap = 'round';
    const y = head.cy + head.ry * (0.50 + p.drop);
    ctx.beginPath();
    ctx.moveTo(head.cx - head.rx * 0.18, y);
    ctx.quadraticCurveTo(head.cx, y + p.curl, head.cx + head.rx * 0.18, y);
    ctx.stroke();
  },
  open(ctx, b, p, head) {
    const y = head.cy + head.ry * (0.50 + p.drop);
    ctx.fillStyle = '#6a3d38';
    ctx.strokeStyle = INK;
    ctx.lineWidth = head.rx * 0.04;
    ctx.beginPath();
    ctx.ellipse(head.cx, y, head.rx * 0.15, head.ry * 0.055, 0, 0, 7);
    ctx.fill(); ctx.stroke();
  },
};

V.marks = {
  freckles(ctx, b, p, head, rnd) {
    ctx.fillStyle = 'rgba(150,110,90,0.55)';
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = rnd();
      const x = head.cx + Math.cos(a) * head.rx * 0.8 * r;
      const y = head.cy + Math.sin(a) * head.ry * 0.85 * r;
      ctx.fillRect(x, y, head.rx * 0.022, head.rx * 0.022);
    }
  },
  none() {},
};

/* ------------------------------------------------------------ 层级（纯数据） */

/**
 * 槽位表：顺序即绘制顺序，`deps` 声明它依赖上层算出来的东西（比如 head 的盒子）。
 * **这就是"content agnostic"的全部**：换一套表 = 换一种内容，生成器一行不用改。
 */
export const SLOTS = [
  { key: 'bg', variants: ['flat', 'vignette'], order: 0 },
  { key: 'head', variants: ['oval', 'narrow'], order: 1, provides: 'head' },
  { key: 'ear', variants: ['small', 'big'], order: 2, needs: 'head' },
  { key: 'hair', variants: ['sidePart', 'buzz', 'bald', 'receding'], order: 3, needs: 'head' },
  { key: 'brow', variants: ['thin', 'thick'], order: 4, needs: 'head' },
  { key: 'eye', variants: ['heavy', 'wide'], order: 5, needs: 'head' },
  { key: 'nose', variants: ['long', 'short'], order: 6, needs: 'head' },
  { key: 'mouth', variants: ['line', 'open'], order: 7, needs: 'head' },
  { key: 'marks', variants: ['none', 'freckles'], order: 8, needs: 'head' },
];

const HAIR_COLORS = ['#3d2a1c', '#5a3d26', '#6b4a2e', '#2e2118', '#8a6a44'];

/** 抽一张脸：每条槽位一个变体 + 一组连续参数。 */
export function samplePortrait(seed = 1, { hairColors = HAIR_COLORS } = {}) {
  const rnd = mulberry32(seed * 2654435761 % 2147483647);
  const spec = { seed, parts: {}, params: {} };
  for (const s of SLOTS) {
    const v = s.variants[(rnd() * s.variants.length) | 0];
    spec.parts[s.key] = v;
  }
  spec.params = {
    wide: 0.9 + rnd() * 0.26,
    long: 0.9 + rnd() * 0.26,
    tilt: (rnd() - 0.5) * 0.02,
    len: 0.8 + rnd() * 0.5,
    drop: (rnd() - 0.5) * 0.06,
    curl: (rnd() - 0.5) * 0.03,
    color: hairColors[(rnd() * hairColors.length) | 0],
  };
  return spec;
}

/**
 * 画一张脸。`box` 是这张脸的画布区域；所有变体都归一化到它。
 * 返回 head 盒，方便外面做剪影统计。
 */
export function drawPortrait(ctx, spec, box, { outline = true } = {}) {
  const rnd = mulberry32(spec.seed * 40503 % 2147483647);
  let head = null;
  const sorted = SLOTS.slice().sort((a, b) => a.order - b.order);
  for (const s of sorted) {
    const variant = spec.parts[s.key];
    const fn = V[s.key] && V[s.key][variant];
    if (!fn) continue;
    const r = fn(ctx, box, spec.params, head, rnd);
    if (s.provides === 'head' && r) head = r;
  }
  return head;
}

/**
 * 剪影差异：把 N 张脸只渲染"形状"（黑块），两两算 IoU，取 1 − 均值。
 * 这是"这套层级真的能产出不同内容"的证据；纯随机噪声会接近 1.0，全都一样会接近 0。
 */
export function silhouetteDiversity(specs, { size = 64 } = {}) {
  const masks = [];
  for (const spec of specs) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    // 只画头 + 发 + 耳，涂黑
    const box = { x: 0, y: 0, w: size, h: size };
    const rnd = mulberry32(spec.seed);
    let head = null;
    for (const s of SLOTS) {
      if (!['head', 'hair', 'ear'].includes(s.key)) continue;
      const fn = V[s.key][spec.parts[s.key]];
      if (!fn) continue;
      g.save();
      // 强制单色：把所有 fill/stroke 变成黑
      const oldFill = g.fillStyle, oldStroke = g.strokeStyle;
      g.fillStyle = '#000'; g.strokeStyle = '#000';
      const r = fn.call(V[s.key], g, box, spec.params, head, rnd);
      if (s.key === 'head' && r) head = r;
      g.restore();
    }
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1, 1);
    masks.push(g.getImageData(0, 0, size, size).data);
  }
  let sum = 0, n = 0;
  for (let i = 0; i < masks.length; i++) {
    for (let j = i + 1; j < masks.length; j++) {
      let inter = 0, uni = 0;
      for (let k = 3; k < masks[i].length; k += 4) {
        const a = masks[i][k] > 40, b = masks[j][k] > 40;
        if (a && b) inter++;
        if (a || b) uni++;
      }
      sum += inter / Math.max(1, uni);
      n++;
    }
  }
  return { pairs: n, meanIoU: +(sum / Math.max(1, n)).toFixed(3), diversity: +(1 - sum / Math.max(1, n)).toFixed(3) };
}
