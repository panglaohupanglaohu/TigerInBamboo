/**
 * blobshadow.js — 单位脚下那圈软影不是 shadow map，是一张**贴地的径向软盘**，半径随离地高度变大、浓度变淡。
 *
 * 帖子 ID：820977247083528192（2017-01-16，无原文字，仅有视频）
 *   画面：一个披斗篷、扛长矛的小人站在灰蓝的空地上；脚下有一圈**软边的圆形暗斑**，
 *   没有任何几何投影的形状（没有矛的影子、没有斗篷的锯齿边），纯粹是一个圆；
 *   暗斑外面套着一个**线框四边形**（贴地的占地范围），再外面是一个上收的线框棱柱包住整个人。
 *   圆形暗斑正好落在四边形里面，直径略小于四边形对角线。
 *
 * 帖子 ID：821321422140309504 / 821680056514781186（2017-01-17 / 01-18，无原文字）
 *   画面：同一批小人成排站在灰色台地上，台面高低错落；每个人脚下都有一小圈软影，
 *   站在高台边缘的人也**没有**影子甩到下面的低台上 —— 影子只贴自己脚下那一小块地面。
 *
 * 为什么这么做（原文无字，从画面反推）：
 *   ① **不投几何形状**：小人只有 20 来个像素，真做 shadow map 得到的是噪点；一个软圆
 *      既能读出"他站在这儿"，又不会因为斗篷锯齿而脏。全图几百个单位也只是几百个 alpha 圆。
 *   ② **半径跟高度走**：离地越远，接触越弱，影子该越大越淡。h=0 时最实最小，是"踩在地上"的读数；
 *      飞到空中还留着同样实的圆，会看起来像"地面有块污渍"。
 *   ③ **影子要落在自己的占地四边形里**：四边形是"这块地归他"，圆出了框就变成"他悬在旁边"。
 *      这也是为什么高处的单位圆虽大、却仍要收在框内（用 r ≤ 0.9·半对角线 卡住（worst case E））。
 *   ④ **坡面上要沿坡向拉长**：软盘贴的是地面不是水平面，投影到坡上必须按 1/cosθ 拉长，
 *      否则上坡的那一半会陷进地里。拉长同时压暗短轴，保持面积不变 —— 视觉浓度才不变。
 *
 * 纯 2D/等距模块，不依赖 three。世界坐标 (x, z) 贴地，y 向上。
 */

/** 太阳/主光方向（世界 xz 平面上的单位向量）：影子朝这个方向偏。 */
export const LIGHT_DIR = [0.62, 0.78];

/** 一个单位的软影参数。 */
export function shadowParams(h, slopeDeg = 0, base = { r0: 0.52, a0: 0.46, grow: 0.16, fade: 0.10 }) {
  const { r0, a0, grow, fade } = base;
  const r = r0 * (1 + grow * h);                       // 半径随高度线性放大
  const alpha = Math.max(0.06, a0 * (1 - fade * h));   // 浓度随高度线性衰减
  const offset = 0.36 * h;                             // 影子沿光方向偏移（越高越偏）
  const c = Math.cos((slopeDeg * Math.PI) / 180);
  const stretch = 1 / c;                               // 沿坡向拉长
  const squash = c;                                    // 横向压短 → 面积守恒
  return {
    h, slopeDeg, r, alpha,
    off: [LIGHT_DIR[0] * offset, LIGHT_DIR[1] * offset],
    major: r * stretch, minor: r * squash,
    area: Math.PI * r * r,                             // 拉长×压短 = 1，所以面积与坡无关
    softness: 0.42 + 0.10 * h,                         // 越高越糊（羽化带占半径比例）
  };
}

/** 占地四边形（等距菱形）的半对角线长，用来卡"影子不许出框"。 */
export function footprintHalfDiag(side = 1.25) {
  return side * Math.SQRT1_2;
}

/** 一组样本单位的完整指标表 —— lab 与 shot.mjs 共用。 */
export function measure() {
  const units = [
    { id: 'A', h: 0.0, slope: 0, x: -1.15, z: 0.55 },
    { id: 'B', h: 0.9, slope: 0, x: 0.15, z: 0.20 },
    { id: 'C', h: 2.0, slope: 0, x: 1.35, z: -0.10 },
    { id: 'D', h: 0.0, slope: 26, x: 0.35, z: 1.55 },
    { id: 'E', h: 3.2, slope: 0, x: -0.75, z: -1.35 },
  ];
  const halfDiag = footprintHalfDiag(1.25);
  const rows = units.map((u) => {
    const s = shadowParams(u.h, u.slope);
    // 影子外接圆的半径 = major（拉长后的长半轴），占对角线比例
    const fit = s.major / halfDiag;
    return { ...u, ...s, fit, inside: fit <= 1.0 };
  });
  // 面积守恒对照：拉长 1/cos、压短 cos，椭圆面积比应为 1
  const slopeRow = rows.find((r) => r.slopeDeg > 0);
  const slopeless = shadowParams(slopeRow.h, 0, undefined);
  const areaRatio = (Math.PI * slopeRow.major * slopeRow.minor) / (Math.PI * slopeRow.r * slopeRow.r);
  return {
    rows: rows.map((r) => ({ id: r.id, h: r.h, slope: r.slopeDeg, r: +r.r.toFixed(3),
      alpha: +r.alpha.toFixed(3), major: +r.major.toFixed(3), minor: +r.minor.toFixed(3),
      fit: +r.fit.toFixed(3), inside: r.inside, off: r.off.map((v) => +v.toFixed(3)) })),
    stretch: +(slopeRow.major / slopeRow.r).toFixed(4),
    squash: +(slopeRow.minor / slopeRow.r).toFixed(4),
    areaRatio: +areaRatio.toFixed(4),
    cosSlope: +(Math.cos((slopeRow.slopeDeg * Math.PI) / 180)).toFixed(4),
    outOfBox: rows.filter((r) => !r.inside).length,
    alphaRange: [+rows[0].alpha.toFixed(3), +Math.min(...rows.map((r) => r.alpha)).toFixed(3)],
    rRange: [+rows[0].r.toFixed(3), +Math.max(...rows.map((r) => r.r)).toFixed(3)],
    halfDiag: +halfDiag.toFixed(3),
  };
}

if (typeof window !== 'undefined') window.__blob = measure();
