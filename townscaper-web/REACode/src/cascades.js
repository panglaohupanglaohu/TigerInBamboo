/**
 * cascades.js — 崖面上的小瀑布：槽口出水 → 贴壁下落 → 基部摊成白扇
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1007587828992266240（2018-06-15）**帖子无任何文字**，只是屏录。
 *   所以这一条的每一行都只能从画面里量：没有"作者说他是这么做的"，别把下面的数字
 *   当成设计意图，它们只是"画出来是这样"。
 *
 * ── 帧实测（420×420，f000；2 号机位 f010 复算一致）──────────────────────
 *   画面分块占比   水 64.0% / 泡沫 7.1% / 沙 1.6% / 崖 1.8%
 *   白色石灰岩崖  #E8EDEC 受光面、#C9D2D1 背光面（差值只有 31，几乎不发灰）
 *   草            #A9C39A
 *   水（远处）    #9AB0B3  → 崖脚（近处）#6B8089（越靠近崖越深，见 WORTH 注释）
 *   泡沫          #F5F7F6
 *
 *   槽口（水从崖顶平台上"咬"出来的缺口）：
 *     宽度 **16–18px**，底部带一道 3px 的暗边 #8E9A9A（缺口内侧的阴影）
 *   落水带（ribbon）：
 *     顶部宽 **5px** → 中途 7px → 入水处 **10px**，也就是**向下变宽**，不是等宽
 *     x=130 那一挂是从 y=262 落到 y=322（**落差 60px**）
 *     中间有一条 **1px 的暗缝**把水劈成两股（crop_wf 放大 8× 看得很清楚）
 *   基部（fan）：
 *     摊开成 **30px 宽 / 8px 高**的白扇，比落水带宽 3 倍，边缘是软的（无描边）
 *
 * ── 三个结论（为什么这样写）─────────────────────────────────────────────
 *   ① **水是"上青下白"，不是上白下青。** 第一版我按常识把泡沫量放在底部、顶部留清水色，
 *      结果整挂水看起来像一根插在崖上的玻璃棒。实测 x=336 那一列从 y=242 到 y=290 是
 *      (172,217,218)→(194,233,233)→(220,250,251)→(246,252,254)→(255,255,255)，
 *      也就是**只有最上面 30% 是青的**，剩下全是纯白 —— 重力把水打碎成沫，越往下越白。
 *      所以色标不是线性 lerp，是 t^0.45（前段快、后段几乎不动）。
 *   ② **变宽发生在最后 20%。** 若按全程线性从 5px 加到 10px，整挂水像喇叭；
 *      实测中途（y≈290，落差过半）只有 7px，10px 是贴到水面那一下才到的。
 *      所以 halfW(t) = lerp(2.5, 5, t^1.8)，末尾再叠一个 fan。
 *   ③ **基部必须"没有边"。** 片子里白扇和岸线泡沫是连成一片的，任何 stroke 都会把它
 *      切回"一根管子插进水里"。所以 fan 用径向渐变从白到透明，且不落笔描边。
 */

export const MEASURED = {
  frame: 420,
  notchW: 17,          // 槽口宽（16–18 取中）
  notchLip: 3,         // 缺口内侧暗边
  ribTopW: 5,
  ribMidW: 7,
  ribBotW: 10,
  fanW: 30,
  fanH: 8,
  drop: 60,            // 崖顶水面到入水
  slitW: 1,            // 把水劈成两股的暗缝
  // 色标（实测五档，见结论①）
  ramp: [
    [172, 217, 218],   // t=0.00 出水口：青
    [194, 233, 233],   // t=0.18
    [220, 250, 251],   // t=0.40
    [246, 252, 254],   // t=0.65
    [255, 255, 255],   // t=1.00 入水：纯白
  ],
  rockLit: [232, 237, 236],
  rockDark: [201, 210, 209],
  notchIn: [142, 154, 154],
  grass: [169, 195, 154],
  waterFar: [154, 176, 179],
  waterNear: [107, 128, 137],
  foam: [245, 247, 246],
};

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const rgbCss = (c) => rgba(c);

/** 一次性 LCG：同一个 seed 出同一条水，lab 里才能 A/B。 */
function lcg(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * 落水带颜色。t=0 出水口，t=1 入水。
 * 用 t^0.45 而不是 t —— 见结论①：青色只占最上面三成。
 */
export function fallColor(t, measured = MEASURED) {
  const k = Math.pow(Math.max(0, Math.min(1, t)), 0.45);
  const r = measured.ramp;
  const seg = k * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = r[i], b = r[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/**
 * 半宽曲线。中途 7px、末尾 10px —— 见结论②。
 * @param t 0..1 沿落差
 * @returns 半宽（px，片中尺度）
 */
export function halfWidth(t, measured = MEASURED) {
  const k = Math.max(0, Math.min(1, t));
  return (measured.ribTopW / 2) + (measured.ribBotW / 2 - measured.ribTopW / 2) * Math.pow(k, 1.8);
}

/**
 * 造一挂水。
 *
 * @param {object} o
 * @param {number} o.x      槽口中心屏幕 x
 * @param {number} o.topY   崖顶平台（水面开始处）的 y
 * @param {number} o.baseY  水面线的 y
 * @param {number} [o.scale] 片中像素 → 画布像素
 * @param {number} [o.seed]
 * @param {'slot'|'ledge'} [o.mode]
 *        slot  = 水从崖壁上的横向石缝里涌出来（片中 x≈300 那组，缝是凹进去的）
 *        ledge = 水从崖顶平台的缺口翻出来（片中 x≈130，缺口"咬"在平台边上）
 */
export function makeCascade({ x, topY, baseY, scale = 1, seed = 1, mode = 'slot' }) {
  const rnd = lcg(seed);
  const M = MEASURED;
  // slot：水是从壁面上一道横向石缝里**涌出来**的，所以水面起点在崖顶边下面十来像素，
  // 上面那段是实心岩 —— 起点如果直接放在崖顶边上，缝就没地方画，只能画到顶面上，
  // 看起来像崖顶长了一排灰帽子（第一版就是这样）。
  const lipH = 11 * scale;
  const startY = mode === 'slot' ? topY + lipH : topY;
  const drop = Math.max(8, baseY - startY);

  // 贴壁下落的走向：片子里不是笔直的，会有一点左右漂（幅度量到 ~1.5px）
  // 每个采样点都要带 x —— 上一版只放了 dx，paintCascade 读 sway[i].x 拿到 undefined，
  // 整条路径全是 NaN，canvas 静默吞掉：画面上一点水都没有，反测也全 0。
  const sway = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    sway.push({
      t,
      x,
      dx: (i === 0 || i === n ? 0 : (rnd() - 0.5) * 3) * scale,
      y: startY + drop * t,
      hw: halfWidth(t) * scale,
    });
  }

  // 基部白扇：宽度是落水带的 3 倍，位置略偏（片子两挂都偏 1–3px）
  const fan = {
    x: x + (rnd() - 0.5) * 4 * scale,
    y: baseY + 1 * scale,
    rx: (M.fanW / 2) * scale * (0.9 + rnd() * 0.2),
    ry: (M.fanH / 2) * scale,
  };

  return {
    x, topY, startY, baseY, drop, scale, mode, seed,
    slot: { y0: topY + 4 * scale, y1: topY + lipH, w: M.notchW * scale },
    notch: { w: M.notchW * scale, lip: M.notchLip * scale },
    sway, fan,
    // 暗缝（把水劈成两股）——只在落差够长时出现，短片子里那几挂短的没有
    slit: drop * scale > 44 ? { dx: (rnd() - 0.5) * 1.2 * scale, w: M.slitW * scale } : null,
  };
}

/**
 * 画一挂水。**先画槽口、再画水、最后画白扇** —— 顺序反了水会被槽口压住一半。
 */
export function paintCascade(ctx, cas, { opacity = 1 } = {}) {
  const { sway, fan, scale } = cas;
  ctx.save();
  ctx.globalAlpha = opacity;

  // ── ⓪ 壁面阴影：水的前面永远有一条更暗的竖带（水贴着墙，墙在水的遮挡下变暗）。
  //    少了它，水像"贴在墙上的白纸"；加上以后水才像在墙**前面**。
  const n0 = sway[0];
  const shW = Math.max(2, sway[0].hw * 3.2);
  const shG = ctx.createLinearGradient(n0.x - shW, 0, n0.x + shW, 0);
  shG.addColorStop(0, 'rgba(30,26,34,0)');
  shG.addColorStop(0.5, 'rgba(30,26,34,0.16)');
  shG.addColorStop(1, 'rgba(30,26,34,0)');
  ctx.fillStyle = shG;
  ctx.fillRect(n0.x - shW, n0.y - 2 * scale, shW * 2, cas.baseY - n0.y + 4 * scale);

  // ── ① 槽口。两种出水方式分开画：
  //    slot  = 壁面上一道横缝（片中 x≈300 那组）：缝是**暗的**，水从缝的下沿涌出来；
  //    ledge = 崖顶平台被水"咬"出一个缺口，水从平台边上翻下来。
  //    上一版两种都画成"灰白横杠 + 整条亮边"，结果每条水顶上顶一顶灰帽子 ——
  //    槽口是凹进去的，必须比岩面更暗，只有下沿那一线才是亮的。
  const S2 = scale;
  if (cas.mode === 'slot') {
    const { y0: sy0, y1: sy1, w: sw } = cas.slot;
    // 缝是"凹"不是"洞"：alpha 只到 0.5、宽度收窄到 0.78。压到 0.92 又画满 17px，
    // 每个出水口顶上会顶一条黑杠（白石灰岩上尤其明显，像给水安了个屋顶）。
    ctx.fillStyle = 'rgba(58,52,62,0.5)';
    ctx.beginPath();
    ctx.moveTo(n0.x - sw * 0.39, sy0 + 1.5 * S2);
    ctx.quadraticCurveTo(n0.x, sy0 - 2.2 * S2, n0.x + sw * 0.39, sy0 + 1.5 * S2);
    ctx.lineTo(n0.x + sw * 0.39, sy1);
    ctx.quadraticCurveTo(n0.x, sy1 + 2.4 * S2, n0.x - sw * 0.39, sy1);
    ctx.closePath();
    ctx.fill();
    // 缝里那点水色
    ctx.fillStyle = 'rgba(196,232,238,0.85)';
    ctx.fillRect(n0.x - sw / 2 + 1.5 * S2, sy1 - 2.2 * S2, sw - 3 * S2, Math.max(1, 1.6 * S2));
  } else {
    // 平台被咬掉的缺口：画成顶边上的一道 V，深度 ~9px
    const wN = cas.notch.w;
    // 平台的缺口只往上咬 3.5px（再深就咬到顶面的草色上，看着像顶被凿穿）
    ctx.fillStyle = 'rgba(58,52,62,0.5)';
    ctx.beginPath();
    ctx.moveTo(n0.x - wN / 2, n0.y - 3.5 * S2);
    ctx.quadraticCurveTo(n0.x + n0.dx, n0.y + 2.6 * S2, n0.x + wN / 2, n0.y - 3.5 * S2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(206,238,242,0.9)';
    ctx.fillRect(n0.x - wN / 2 + 2 * S2, n0.y - 1.2 * S2, wN - 4 * S2, Math.max(1, 1.2 * S2));
  }

  // ── ② 落水带：一条左右边界各自成折线的带子，用竖向渐变填
  const g = ctx.createLinearGradient(0, cas.startY, 0, cas.baseY);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    g.addColorStop(t, rgba(fallColor(t)));
  }
  ctx.beginPath();
  ctx.moveTo(sway[0].x - sway[0].hw + sway[0].dx, sway[0].y);
  for (let i = 1; i < sway.length; i++) ctx.lineTo(sway[i].x - sway[i].hw + sway[i].dx, sway[i].y);
  for (let i = sway.length - 1; i >= 0; i--) ctx.lineTo(sway[i].x + sway[i].hw + sway[i].dx, sway[i].y);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // ── ③ 中间那道暗缝（1px）。少了它整挂水是"一整片白"，看不出是水
  if (cas.slit) {
    ctx.strokeStyle = 'rgba(150,196,203,0.55)';
    ctx.lineWidth = cas.slit.w;
    ctx.beginPath();
    ctx.moveTo(sway[0].x + cas.slit.dx, sway[0].y + 4 * scale);
    for (let i = 1; i < sway.length; i++) {
      ctx.lineTo(sway[i].x + cas.slit.dx * (1 - i / sway.length), sway[i].y);
    }
    ctx.stroke();
  }

  // ── ④ 基部白扇：径向渐变到透明，**不描边**（结论③）
  const rg = ctx.createRadialGradient(fan.x, fan.y, 0, fan.x, fan.y, fan.rx);
  rg.addColorStop(0, 'rgba(255,255,255,0.98)');
  rg.addColorStop(0.55, 'rgba(252,255,255,0.72)');
  rg.addColorStop(1, 'rgba(245,251,252,0)');
  ctx.save();
  ctx.translate(fan.x, fan.y);
  ctx.scale(1, fan.ry / fan.rx);
  ctx.beginPath();
  ctx.arc(0, 0, fan.rx, 0, Math.PI * 2);
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/**
 * 一整套海岸小瀑布：按崖面宽度排若干挂，间距不等。
 * 片中 420px 宽的岛上有 4 挂（x≈130 / 300 / 345 / 一组小滴），间距 40–170px。
 */
export function cascadeSet({ x0, x1, topY, baseY, scale = 1, seed = 3 }) {
  const rnd = lcg(seed);
  const out = [];
  let x = x0 + (x1 - x0) * (0.08 + rnd() * 0.18);
  while (x < x1 - (x1 - x0) * 0.06) {
    out.push(makeCascade({
      x, topY: topY + (rnd() - 0.5) * 6 * scale, baseY,
      scale, seed: (seed * 31 + out.length * 7) | 0,
      mode: rnd() < 0.5 ? 'slot' : 'ledge',
    }));
    x += (46 + rnd() * 110) * scale;
  }
  return out;
}

/* ── 反测：从渲染结果里把"顶部宽 / 基部宽 / 色标"再量回来 ───────────────── */

/**
 * 在画布上沿一条竖直扫描线量"白水"的横向游程。
 * @returns {{widths:number[], ramp:Array}} 每行的宽度（px）+ 中轴采样到的颜色
 */
export function probeFall(ctx, cas, rows = 12) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return [img[i], img[i + 1], img[i + 2]];
  };
  // 判据必须同时吃得下"顶端那截青"和"底端纯白"，又不能把白石灰岩的崖面认成水：
  //   青端 (172,217,218)：b−r = 46  → 走 b > r+12
  //   白端 (254,255,255)：三通道都 >245 → 走第二条
  //   石灰岩 (232,237,236)：b−r 只有 4、r 也到不了 245 → 两条都不中
  // 上一版用 "g>195 && b>200 && r>150"，在白崖上整面墙都算水，反测量出"顶部宽 38px"。
  const isWater = (c) => (c[2] > c[0] + 12) || (c[0] > 245 && c[1] > 245 && c[2] > 245);
  const win = Math.round(30 * (cas.scale || 1));
  const cx0 = Math.max(0, Math.round(cas.x) - win);
  const cx1 = Math.min(width - 1, Math.round(cas.x) + win);
  const widths = [];
  const ramp = [];
  for (let r = 0; r < rows; r++) {
    const y = cas.topY + ((cas.baseY - cas.topY) * (r + 0.5)) / rows;
    const yy = Math.round(y);
    if (yy < 0 || yy >= height) continue;
    // 把所有游程收起来，**合并间隔 ≤3px 的段**，再取跨过中轴的那一段。
    // 不合并的话，中轴那条 1px 暗缝会把整挂水劈成两半，量出来的宽度是真实值的一半
    // （实测第 6 行量到 3px、最后一行 10px，都是被缝劈的）。
    const runs = [];
    let x = cx0;
    while (x <= cx1) {
      if (isWater(at(x, yy))) {
        const s0 = x;
        while (x <= cx1 && isWater(at(x, yy))) x++;
        runs.push([s0, x - 1]);
      } else x++;
    }
    const merged = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] <= 3) last[1] = r[1];
      else merged.push([r[0], r[1]]);
    }
    let best = 0;
    for (const m of merged) if (m[0] - 3 <= cas.x && m[1] + 3 >= cas.x) best = Math.max(best, m[1] - m[0] + 1);
    if (!best && merged.length) best = merged[0][1] - merged[0][0] + 1;
    widths.push(best);
    // 采样点要**避开中轴**：中轴上正好是那条 1px 暗缝（见 paintCascade ③），
    // 采在中轴会把色标读成"缝 + 白"的混合，永远读不到纯白。
    const hwNow = halfWidth((r + 0.5) / rows) * (cas.scale || 1);
    ramp.push(at(Math.round(cas.x + Math.max(1, hwNow * 0.45)), yy));
  }
  return { widths, ramp };
}
