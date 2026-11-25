/**
 * stilts.js — 悬空建筑的「支柱」与落位前的半透明白块
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1209519206233968641（2019-12-24）原文只有一句 **"A very merry Christmas to you all"**，
 *   是节庆贺词，一个字的实现都没有。同一周的三条才是有内容的：
 *     1205422438437273601  门窗用 stencil buffer 在 zbuffer 上打洞
 *     1205420678859632640  植物：alpha 用视角调制、叶子贴图贴到球上
 *     1205416648397721601  新的道具摆放系统（尽量多放、不重叠，门窗也走它）
 *   也就是说这段时间他在做「道具怎么贴到建筑上」。支柱与幽灵块没人写过，只能从画面量。
 *
 * ── 帧实测（512×512，f016，逐像素；f010/f022 复算一致）────────────────────
 *   水        #315192  (49,81,146)
 *   柱（上段）#182e4e  (24,46,78)
 *   柱（下段）#091f3f  (9,31,63)
 *   柱宽      9.5px  （y=420/450/460 三行游程都是 x237..246，9–10px）
 *   柱长      从楼底 y≈400 到水面 y=469，约 70px；**到水面就断**，没有钉进水里的部分
 *   入水倒影  水下 6px 内从柱色爬回水色：(19,46,91)→(30,59,107)→(46,78,133)→(53,91,151)，
 *            也就是**一条 6px 的渐隐**，不是描边、不是阴影
 *   幽灵块    覆盖水面后 (96,124,172)：
 *            α=(96−49)/(255−49)=0.228、(124−81)/(255−81)=0.247、(172−146)/(255−146)=0.238
 *            → **白 24%**，三个通道独立算出来一致（差 0.02，是 8bit 量化）
 *
 * ── 三条结论 ────────────────────────────────────────────────────────────
 *   ① 柱子**不是黑**。第一版按"水色 × 0.2"推，得到 (10,16,29)，蓝得不够、也太黑；
 *      实测是把水往一个冷navy压（蓝通道只掉到 0.43，红通道掉到 0.18），
 *      所以柱子比水**更冷更去饱和**，而不是等比变暗。这里两档都按实测值写死。
 *   ② 柱子在水面处**硬断 + 6px 倒影**。少了倒影柱子像贴纸；把倒影画成实线又像柱子插进水里。
 *   ③ 幽灵块是「白 24% 覆盖」，不是半透明材质。它的亮度跟背后的东西**无关**（水面、屋顶上都一样），
 *      所以实现成 over 混合的常量 alpha，不需要读背景色。
 */

/** 片中量到的常量。坐标/像素全部来自 f016（512×512，3× 放大后逐像素读）。 */
export const MEASURED = {
  water: [49, 81, 146],
  legTop: [24, 46, 78],
  legCore: [9, 31, 63],
  legW: 9.5,          // px @512 帧
  legLen: 70,         // px，楼底到水面
  reflLen: 6,         // px，水下渐隐
  ghostAlpha: 0.24,   // 白 24%（0.228 / 0.247 / 0.238 三通道均值）
  frame: 512,
};

/** 片中那套配色（圣诞），实测：屋顶 #e48c74 (228,140,116)、墙 #48e080 (72,224,128)、墙受光 #69fbb0 (105,251,176)。 */
export const HOLIDAY = {
  wall: [72, 224, 128],
  wallLit: [105, 251, 176],
  wallDark: [38, 148, 92],
  roof: [228, 140, 116],
  roofDark: [176, 86, 68],
  trim: [42, 54, 66],
};

const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const rgbCss = (c) => rgba(c, 1);

/**
 * 柱子颜色。不按水色等比推 —— 见文件头结论①。
 * @param t 0 = 楼底（上段），1 = 水面（下段）
 */
export function legShade(t = 0, measured = MEASURED) {
  const k = Math.max(0, Math.min(1, t));
  const a = measured.legTop, b = measured.legCore;
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

/**
 * 一根支柱的几何 + 颜色。
 * @param {object} o
 * @param {number} o.x        柱中心的屏幕 x
 * @param {number} o.floorY   楼底（柱顶）的屏幕 y
 * @param {number} o.waterY   水面的屏幕 y
 * @param {number} o.w        柱宽 px。默认按实测 9.5/512 的画面比例给。
 * @returns {{x:number,y0:number,y1:number,w:number,color:string,refl:Array}}
 */
export function makePost({ x, floorY, waterY, w = 9.5, scale = 1, measured = MEASURED }) {
  const ww = w * scale;
  const len = Math.max(0, waterY - floorY);
  return {
    x, y0: floorY, y1: waterY, w: ww, len,
    color: rgba(legShade(1, measured)),
    // 上段略亮一点点：片子里 y=430 那行是 (36,56,79)，y=450 已经 (8,29,64)
    gradient: [rgba(legShade(0, measured)), rgba(legShade(1, measured))],
    refl: reflectionRamp(legShade(1, measured), measured.water, measured.reflLen * scale),
  };
}

/**
 * 水下倒影：一串从柱色爬到水色的色标（实测 4 档 + 水色本身）。
 * 返回 [{dy, css}]，dy 是水面以下的像素。
 */
export function reflectionRamp(legColor, waterColor, len = 6) {
  const out = [];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({
      dy: (len * i) / n,
      css: rgba([
        Math.round(legColor[0] + (waterColor[0] - legColor[0]) * t),
        Math.round(legColor[1] + (waterColor[1] - legColor[1]) * t),
        Math.round(legColor[2] + (waterColor[2] - legColor[2]) * t),
      ]),
    });
  }
  return out;
}

/**
 * 一个 footprint 需要几根柱、长在哪。
 *
 * 片子只露出两根（f016 左侧那个翼下），但两根都**长在翼的左右两端**、并且都在可见的
 * 那一侧 —— 也就是"每一跨两角各一根"。所以这里按 footprint 的左右两端给柱，
 * 中间跨宽度小于 1.4 倍柱宽就只给一根（太窄不必撑两根，片中没有反例）。
 */
export function postsForFootprint({ x0, x1, floorY, waterY, legW = 9.5, span = 4 }) {
  const w = x1 - x0;
  const inset = Math.min(w * 0.16, legW * 1.6);
  const n = w < legW * 1.4 * span ? 1 : 2;
  const xs = n === 1 ? [(x0 + x1) / 2] : [x0 + inset, x1 - inset];
  return xs.map((x) => makePost({ x, floorY, waterY, w: legW }));
}

/**
 * 幽灵块：白 24% 的 over 混合。
 * 片子里的实测表明它与背景无关（水面/屋顶上都是 24%），所以不需要采样背景。
 */
export function ghostFill(alpha = MEASURED.ghostAlpha) {
  return `rgba(255,255,255,${alpha})`;
}

export function ghostEdge(alpha = MEASURED.ghostAlpha) {
  return `rgba(255,255,255,${Math.min(1, alpha * 1.9)})`;
}

/**
 * 把 alpha 从"渲染结果"反解回来 —— lab 用它验自己画的就是 0.24。
 * @param pixel 渲染后采样到的 [r,g,b]
 * @param behind 同一位置、没有幽灵块时的 [r,g,b]
 */
export function solveAlpha(pixel, behind) {
  const per = [0, 1, 2]
    .filter((i) => behind[i] < 250)
    .map((i) => (pixel[i] - behind[i]) / (255 - behind[i]));
  const mean = per.reduce((a, b) => a + b, 0) / (per.length || 1);
  return { alpha: mean, per };
}

/* ── 绘制（纯 2D，跟项目里别的 lab 一致；不引 WebGL）──────────────────── */

/** 水面：实测纯色 #315192，撒一层稀疏亮点（片子里水面有极淡的颗粒）。 */
export function paintWater(ctx, W, H, waterY, seed = 7) {
  ctx.fillStyle = rgbCss(MEASURED.water);
  ctx.fillRect(0, 0, W, H);
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  for (let i = 0; i < W * H * 0.0012; i++) {
    const x = rnd() * W, y = waterY + rnd() * (H - waterY);
    ctx.fillRect(x, y, 1, 1);
  }
}

/**
 * 画一根柱 + 它的入水倒影。
 * 倒影画成 6 段横向短线（不是渐变矩形）—— 因为实测是"逐像素爬升"，
 * 用渐变会在末端留下一段假的平滑，用色阶才和片子一样在水面处硬断。
 */
export function paintPost(ctx, post) {
  const g = ctx.createLinearGradient(0, post.y0, 0, post.y1);
  g.addColorStop(0, post.gradient[0]);
  g.addColorStop(1, post.gradient[1]);
  ctx.fillStyle = g;
  ctx.fillRect(post.x - post.w / 2, post.y0, post.w, post.len);
  for (const r of post.refl) {
    ctx.fillStyle = r.css;
    ctx.fillRect(post.x - post.w / 2, post.y1 + (r.dy - post.refl[0].dy), post.w, post.refl[0].dy + 0.6);
  }
}

/**
 * 画一个等距方块。footprint 菱形四条边 = corners[0..3]，侧面取 +x（右）与 +y（左前）。
 *
 * 上一版这里有个真 bug 值得记下来：我按 [0,1,2,3] 建了顶环 `t`，却按 [1,2,3,0] 的顺序
 * 建了底环 `bot`，于是左面那条四边形的第四个点落到了别的角上 —— 画出来是个回折的箭头。
 * 修法是**顶环和底环共用同一个 corners 数组**，只给顶环减 h。
 */
export function paintIsoBox(ctx, { cx, cy, w, d, h, top, left, right, alpha = 1 }) {
  const hw = w / 2, hd = d / 2;
  const P = (ux, uy) => [cx + (ux - uy) * 0.866, cy + (ux + uy) * 0.5];
  const bot = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)];
  const t = bot.map(([x, y]) => [x, y - h]);
  ctx.globalAlpha = alpha;
  const face = (i0, i1, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(t[i0][0], t[i0][1]);
    ctx.lineTo(t[i1][0], t[i1][1]);
    ctx.lineTo(bot[i1][0], bot[i1][1]);
    ctx.lineTo(bot[i0][0], bot[i0][1]);
    ctx.closePath();
    ctx.fill();
  };
  face(1, 2, right);       // +x 面
  face(2, 3, left);        // +y 面
  // 顶面最后画，压在两个侧面的上沿
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(t[0][0], t[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(t[i][0], t[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  return { top: t, bottom: bot, halfW: (hw + hd) * 0.866, floorY: Math.max(...bot.map((p) => p[1])) };
}

/** 楼底轮廓（菱形）的中心 y —— 柱子的起点就是这里。 */
export function footprintFloorY({ cx, cy, d }) {
  return cy + (d / 2) * 0.5 * 2;   // hd 两端的 y 差，取最低那条边
}
