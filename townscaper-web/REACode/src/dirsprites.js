/**
 * dirsprites.js — 单方向贴图怎么做到"看不出朝向"，以及怎么量它。
 *
 * 原文（x.com/OskSta/status/969860566322958336, 2018-03-03）：
 *
 *   "My unit sprites have 1 direction, so they need to be directionally ambiguous.
 *    They are mostly symmetrical and avoid features that feel jarring when they flip.
 *    Would these sword tips be axe heads, you would notice at a glance that they are
 *    pointing in two distinct directions"
 *
 * 画面（24 帧，320×320）：一小队蓝色小人站在悬崖边，红色旗子插在旁边；
 * 镜头绕着小队转（不是小人在转）。单个人物在画面里只有 **约 17×31 像素**，
 * 蓝身 + 白描边 + 深蓝阴影。24 帧里人一直朝同一个朝向画 —— 这就是"1 direction"。
 * 关键观察：这么小的尺寸下，你**确实**分不出他们面朝哪边，而这正是设计目标。
 *
 * 为什么要"方向模糊"：
 *   · 8 方向就要 8 倍美术 + 8 倍图集；Bad North 一屏几十上百人，走 1 方向最省。
 *   · 但 1 方向意味着**左右移动时必须水平翻转**。如果贴图有明确的"前"，
 *     翻过来就成了"人也朝后"，一眼就看出是镜像 —— 这就是原文说的 jarring。
 *   · 解法：把造型做成**近似镜像对称**的，并且避免"只在一侧有辨识特征"的部件。
 *     原文点名的反例是"剑尖换斧头"：剑尖细、可以看成两边都指；斧头是一坨，
 *     翻过来你会看到"斧刃朝左"和"斧刃朝右"两张不同的图 —— 立刻露馅。
 *
 * 这里把"ambiguous"变成三个可量的数（原文只是感觉，我把它做成指标）：
 *   flipDiff   —— 原图与水平镜像的平均亮度差（你"一眼看到"的就是这个）
 *   mirrorIoU  —— 不透明区域与镜像的交并比（形状层面的对称度）
 *   massSkew   —— 不透明像素重心相对包围盒中线的偏移 / 半宽（"朝哪边"的显式程度）
 * 好设计的三个数应该同时**低**（skew 低、IoU 高、flipDiff 低）。
 */

const PAL = {
  body: '#3d6f96',
  bodyDark: '#2b5171',
  outline: '#eef4f8',
  steel: '#c9d6de',
  wood: '#7a5b3c',
  gold: '#e8c35a',
};

/**
 * 画一个 1 方向的维京小人（朝向画布右侧），按 Bad North 的观感：
 * 深蓝身子、白描边、没有明显"脸"。武器由参数决定 —— 这是唯一影响模糊度的部件。
 *
 * `variant`:
 *   sword — 剑尖朝上略前倾：细、两侧都能读成"指引"，模糊度低
 *   axe   — 斧头挂在一侧：一坨、重心偏，翻转后立刻"两边朝向不同"
 *   spear — 长矛竖持：几乎完全竖直 → 对称，但杆身有前后之分（中等）
 */
export function drawUnit(ctx, x, y, h = 120, variant = 'sword') {
  const w = h * 0.55;
  ctx.save();
  ctx.translate(x, y);
  const u = h / 100;          // 以 100 高为设计单位
  ctx.scale(u, u);
  const H = 100, W = w / u;

  const outline = (fill, path) => {
    ctx.lineWidth = 5;
    ctx.strokeStyle = PAL.outline;
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;
    path();
    ctx.stroke();
    ctx.fill();
  };
  // 单位和设计稿的偏移：让小人站在 y=0 上，向上长 100
  ctx.translate(-W / 2, -H);

  // 两条腿（对称）
  outline(PAL.bodyDark, () => {
    ctx.beginPath();
    ctx.moveTo(W * 0.32, H);
    ctx.lineTo(W * 0.36, H * 0.56);
    ctx.lineTo(W * 0.47, H * 0.56);
    ctx.lineTo(W * 0.46, H);
    ctx.closePath();
  });
  outline(PAL.bodyDark, () => {
    ctx.beginPath();
    ctx.moveTo(W * 0.54, H);
    ctx.lineTo(W * 0.53, H * 0.56);
    ctx.lineTo(W * 0.64, H * 0.56);
    ctx.lineTo(W * 0.68, H);
    ctx.closePath();
  });
  // 躯干（窄一点，好让盾的轮廓读得出来）
  outline(PAL.body, () => {
    ctx.beginPath();
    ctx.moveTo(W * 0.36, H * 0.60);
    ctx.lineTo(W * 0.39, H * 0.28);
    ctx.quadraticCurveTo(W * 0.5, H * 0.22, W * 0.61, H * 0.28);
    ctx.lineTo(W * 0.64, H * 0.60);
    ctx.closePath();
  });
  // 头 + 盔顶（左右对称）
  outline(PAL.body, () => {
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.17, W * 0.185, 0, Math.PI * 2);
  });
  ctx.fillStyle = PAL.bodyDark;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.15, W * 0.19, Math.PI * 1.04, Math.PI * 1.96);
  ctx.fill();
  ctx.strokeStyle = PAL.outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.15, W * 0.19, Math.PI * 1.04, Math.PI * 1.96);
  ctx.stroke();

  // 圆盾：居中偏前，近似左右对称 —— 这正是"1 方向"能成立的关键
  outline(PAL.bodyDark, () => {
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.45, W * 0.25, 0, Math.PI * 2);
  });
  ctx.strokeStyle = PAL.steel;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.45, W * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PAL.steel;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.45, W * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // 武器：唯一破坏对称的地方
  if (variant === 'sword') {
    // 剑尖朝上、略前倾 6°：细长，两侧读数接近
    ctx.save();
    ctx.translate(W * 0.78, H * 0.52);
    ctx.rotate(-0.10);
    ctx.strokeStyle = PAL.outline; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H * 0.40); ctx.stroke();
    ctx.strokeStyle = PAL.steel; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H * 0.40); ctx.stroke();
    ctx.strokeStyle = PAL.outline; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-W * 0.09, -H * 0.03); ctx.lineTo(W * 0.09, -H * 0.03); ctx.stroke();
    ctx.strokeStyle = PAL.wood; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-W * 0.09, -H * 0.03); ctx.lineTo(W * 0.09, -H * 0.03); ctx.stroke();
    ctx.restore();
  } else if (variant === 'axe') {
    // 斧头：刃朝右的一坨 → 翻转后刃朝左，两个朝向一眼可分
    ctx.save();
    ctx.translate(W * 0.80, H * 0.50);
    ctx.rotate(-0.07);
    ctx.strokeStyle = PAL.outline; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, H * 0.06); ctx.lineTo(0, -H * 0.34); ctx.stroke();
    ctx.strokeStyle = PAL.wood; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(0, H * 0.06); ctx.lineTo(0, -H * 0.34); ctx.stroke();
    // 斧刃：从杆向外张开的三角
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.30);
    ctx.quadraticCurveTo(W * 0.26, -H * 0.26, W * 0.22, -H * 0.10);
    ctx.quadraticCurveTo(W * 0.10, -H * 0.14, 0, -H * 0.10);
    ctx.closePath();
    ctx.lineWidth = 7; ctx.strokeStyle = PAL.outline; ctx.stroke();
    ctx.fillStyle = PAL.steel; ctx.fill();
    ctx.restore();
  } else {
    // 长矛：几乎竖直，但杆尾只在右侧一小段 → 中等不对称
    ctx.save();
    ctx.translate(W * 0.72, H * 0.60);
    ctx.strokeStyle = PAL.outline; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, H * 0.22); ctx.lineTo(0, -H * 0.52); ctx.stroke();
    ctx.strokeStyle = PAL.wood; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, H * 0.22); ctx.lineTo(0, -H * 0.52); ctx.stroke();
    ctx.fillStyle = PAL.steel;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.52); ctx.lineTo(-W * 0.05, -H * 0.44); ctx.lineTo(W * 0.05, -H * 0.44);
    ctx.closePath();
    ctx.fillStyle = PAL.steel;
    ctx.strokeStyle = PAL.outline; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** 把一个小人渲染到离屏 canvas，返回像素数据（指标都在它上面算）。 */
export function renderUnit({ h = 120, variant = 'sword', pad = 8 } = {}) {
  const w = Math.round(h * 0.55) + pad * 2 + Math.round(h * 0.5);
  const cw = w, ch = h + pad * 2;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  drawUnit(g, cw / 2, ch - pad, h, variant);
  return { canvas: c, data: g.getImageData(0, 0, cw, ch) };
}

/**
 * 三个指标。全部在"包围盒内"计算，避免空白边把数字冲淡。
 * 注意 flipDiff 用的是**亮度**而不是 alpha：白描边在翻转下几乎不变，
 * 但斧刃的钢色块会整块挪到另一边 —— 那才是"一眼看到"的东西。
 */
export function measureAmbiguity(imgData) {
  const { width: w, height: h, data } = imgData;
  // 包围盒
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) return { empty: true, flipDiff: 0, mirrorIoU: 0, massSkew: 0, pixels: 0 };
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

  let inter = 0, uni = 0, massX = 0, mass = 0;
  let lumaDiff = 0, lumaN = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3] > 24 ? 1 : 0;
      const mx = x0 + (x1 - x);                 // 包围盒内的水平镜像
      const j = (y * w + mx) * 4;
      const b = data[j + 3] > 24 ? 1 : 0;
      if (a && b) inter++;
      if (a || b) uni++;
      if (a) { massX += (x - x0); mass++; }
      // 亮度（含 alpha 预乘，让描边边界也算进去）
      const la = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) * (a ? 1 : 0);
      const lb = (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114) * (b ? 1 : 0);
      lumaDiff += Math.abs(la - lb);
      lumaN++;
    }
  }
  // 重心：massX 是"像素 x 坐标之和"，除以像素数才是重心。
  // 第一版写成 mass / max(1, mass)，恒等于 1 —— 于是 massSkew 对所有人都是 0.97，
  // 三个武器看起来"一样不对称"，白量了一场。
  const cx = massX / Math.max(1, mass);
  const mid = (bw - 1) / 2;
  // 像素占包围盒的比例（太稀疏的小人指标不稳，用它当置信度）
  const fill = mass / (bw * bh);
  const skew = Math.abs(cx - mid) / Math.max(1, mid);
  return {
    empty: false,
    pixels: mass,
    bbox: { w: bw, h: bh },
    fill: +fill.toFixed(3),
    flipDiff: +(lumaDiff / Math.max(1, lumaN)).toFixed(2),
    mirrorIoU: +(inter / Math.max(1, uni)).toFixed(3),
    massSkew: +skew.toFixed(3),
    // 综合判据：原文说"most symmetrical + avoid jarring features"。
    // 形状对称（IoU）占 60%，重心居中（1-skew）占 40%；flipDiff 单独报，不揉进来 ——
    // 它受描边抗锯齿影响大，绝对值不能当主判据，但作为"肉眼差多少"的证据很好用。
    ambiguity: Math.round(100 * (0.6 * (inter / Math.max(1, uni)) + 0.4 * (1 - Math.min(1, skew)))),
  };
}

/** 一次量完几种武器，方便对照（原文点名的 sword vs axe 就在这里）。 */
export function compareVariants({ h = 120, variants = ['sword', 'axe', 'spear'] } = {}) {
  const out = [];
  for (const v of variants) {
    const { canvas, data } = renderUnit({ h, variant: v });
    out.push({ variant: v, canvas, ...measureAmbiguity(data) });
  }
  return out;
}
