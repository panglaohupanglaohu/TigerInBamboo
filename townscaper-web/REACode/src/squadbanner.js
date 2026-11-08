/**
 * squadbanner.js — 小队旗 = 一块图集 + 一个队色，不是一个一个画
 *
 * 帖子 ID：827216768783495168（Bad North，2017 老片，data.js 原无登记）
 * 原文：`(无原文，仅有视频)` —— 六帧画面判读：
 *   - 三支小队各举一面浅蓝底大旗，旗面正中白色徽记：**骷髅 / 剑 / 三叉戟**，一队一个；
 *   - 旗面挂在旗杆顶端的**横杆**下，杆顶还露着一颗金属球（比横杆更高）；
 *   - 单位头盔、盾面与小旗的底色都是**同一族的蓝**，队内没有第二个蓝；
 *   - 前排单位的盾面上刻着同一个小徽记（和本队大旗一致）。
 *
 * 为什么这么做：三面旗的差别只在"图集第几格 + 队色"，其余（杆高、横杆、旗宽、垂坠、
 * 徽记居中）全队共用一份。所以这里把徽记画进一张 3 格图集，旗面只是
 * `drawImage(atlas, cell)`；单位色由队色一个值派生。判据用三样可数的东西：
 *   ① 旗面墨量 ↔ 图集那一格的墨量（证明旗面真的是图集贴上去的，不是重画）；
 *   ② 队内色差恒 0、队间最小 ΔE（证明"一队一色"而不是"一人一色"）；
 *   ③ 旗面是 billboard：投影宽 = 宽 · cos(偏航)，夹在 ±40° 内，所以最窄也有 0.766。
 */

export const ROLES = {
  body: { dl: -0.16, s: 0.34 },   // 军色压暗 = 身子
  shield: { dl: 0.04, s: 0.52 },  // 军色提亮 = 盾面
  helmet: { dl: 0.30, s: 0.16 },  // 军色洗白 = 头盔
  field: { dl: 0.26, s: 0.46 },   // 军色淡化成旗面底色
};

export const EMBLEMS = [
  { key: 'skull', name: '骷髅' },
  { key: 'sword', name: '剑' },
  { key: 'trident', name: '三叉戟' },
];

/* ---------- 图集：3 格，徽记一律画成白色 + 深蓝描边 ---------- */
export const CELL = 96;
export const PAD = 10;

export function drawEmblem(ctx, key, cx, cy, s) {
  // s = 徽记方框边长
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(30,58,88,.92)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  const u = s / 2;
  if (key === 'skull') {
    ctx.beginPath();
    ctx.ellipse(0, -u * 0.16, u * 0.52, u * 0.56, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();                      // 下颌
    ctx.moveTo(-u * 0.30, u * 0.28); ctx.lineTo(u * 0.30, u * 0.28);
    ctx.lineTo(u * 0.24, u * 0.60); ctx.lineTo(-u * 0.24, u * 0.60);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b3d4d';           // 眼窝 + 鼻孔
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * u * 0.24, -u * 0.20, u * 0.15, u * 0.17, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(0, u * 0.06); ctx.lineTo(u * 0.10, u * 0.22); ctx.lineTo(-u * 0.10, u * 0.22); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,58,88,.92)'; ctx.lineWidth = Math.max(1, s * 0.02);
    for (const x of [-0.10, 0.02, 0.14]) { ctx.beginPath(); ctx.moveTo(u * x, u * 0.34); ctx.lineTo(u * x, u * 0.58); ctx.stroke(); }
  } else if (key === 'sword') {
    ctx.beginPath();                     // 刃
    ctx.moveTo(0, -u * 0.84); ctx.lineTo(u * 0.11, -u * 0.60);
    ctx.lineTo(u * 0.11, u * 0.24); ctx.lineTo(-u * 0.11, u * 0.24);
    ctx.lineTo(-u * 0.11, -u * 0.60); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();                     // 护手
    ctx.roundRect(-u * 0.42, u * 0.24, u * 0.84, u * 0.11, u * 0.05); ctx.fill(); ctx.stroke();
    ctx.beginPath();                     // 握柄 + 柄头
    ctx.roundRect(-u * 0.075, u * 0.35, u * 0.15, u * 0.34, u * 0.04); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, u * 0.76, u * 0.10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();                     // 杆
    ctx.roundRect(-u * 0.085, -u * 0.30, u * 0.17, u * 0.92, u * 0.04); ctx.fill(); ctx.stroke();
    ctx.beginPath();                     // 横梁
    ctx.roundRect(-u * 0.46, -u * 0.38, u * 0.92, u * 0.16, u * 0.05); ctx.fill(); ctx.stroke();
    for (const [x, hgt] of [[-0.40, 0.30], [0, 0.52], [0.40, 0.30]]) {   // 三股尖
      ctx.beginPath();
      ctx.moveTo(u * (x - 0.085), -u * 0.30);
      ctx.lineTo(u * (x + 0.085), -u * 0.30);
      ctx.lineTo(u * x, -u * (0.30 + hgt));
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

export function buildAtlas() {
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!cv) return null;
  cv.width = EMBLEMS.length * CELL;
  cv.height = CELL;
  const ctx = cv.getContext('2d');
  const cells = EMBLEMS.map((e, i) => {
    const x = i * CELL;
    drawEmblem(ctx, e.key, x + CELL / 2, CELL / 2, CELL - PAD * 2);
    return { ...e, sx: x, sy: 0, size: CELL };
  });
  return { canvas: cv, cells, ctx };
}

/** 某一格图集里"墨"（近白）像素的占比 —— 旗面墨量要跟它对得上 */
export function cellInk(atlas, index) {
  const d = atlas.ctx.getImageData(index * CELL, 0, CELL, CELL).data;
  let ink = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 232 && d[i + 1] > 232) ink++;
  return ink / (CELL * CELL);
}

/* ---------- 颜色：一队一个值，单位按角色派生 ---------- */
export function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c);
  };
  return [f(0), f(8), f(4)];
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export function toOklab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const roleColor = (hue, role) => hsl(hue, ROLES[role].s, 0.5 + ROLES[role].dl);
export const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ---------- 三支小队 ---------- */
export const ARMY_HUE = 212;   // 六帧里三面旗底色是同一个蓝：军色全军一份
export const SQUADS = [
  { name: '小队 A', hue: ARMY_HUE, emblem: 0, cx: 196, cy: 598, yaw: -4, units: 8, seed: 3 },
  { name: '小队 B', hue: ARMY_HUE, emblem: 1, cx: 452, cy: 540, yaw: 3, units: 9, seed: 11 },
  { name: '小队 C', hue: ARMY_HUE, emblem: 2, cx: 700, cy: 610, yaw: 0, units: 7, seed: 29 },
];

export const POLE_H = 214;
export const BANNER_W = 104;
export const BANNER_H = 116;
export const CLAMP_DEG = 40;

/** 队内每个单位：位置（等距散布）+ 角色色 + 盾面徽记格 */
export function planScene(squads = SQUADS) {
  const out = [];
  for (const sq of squads) {
    let s = sq.seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const units = [];
    for (let i = 0; i < sq.units; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const px = sq.cx + (col - 1.5) * 26 + (rnd() - 0.5) * 9;
      const py = sq.cy + row * 17 + (rnd() - 0.5) * 7 - col * 4;
      units.push({
        x: px, y: py,
        // 屏幕竖直尺度：越靠后（py 小）越小
        scale: 0.88 + (py - sq.cy) * 0.004,
        body: roleColor(sq.hue, 'body'),
        shield: roleColor(sq.hue, 'shield'),
        helmet: roleColor(sq.hue, 'helmet'),
        cell: sq.emblem,
      });
    }
    out.push({ ...sq, units4: units, banner: { x: sq.cx, y: sq.cy - POLE_H, yaw: sq.yaw } });
  }
  return out;
}

/** 旗面投影宽 = W·cos(偏航)，偏航夹在 ±CLAMP 内（billboard 不让它转到侧边） */
export function bannerWidth(yawDeg, w = BANNER_W) {
  const y = Math.max(-CLAMP_DEG, Math.min(CLAMP_DEG, yawDeg));
  return { projected: w * Math.cos((Math.abs(y) * Math.PI) / 180), clamped: y !== yawDeg, yaw: y };
}

export function measure(scene, atlas) {
  const rows = scene.map((sq) => {
    const col = sq.units4[0].shield;
    const lab = toOklab(col);
    const intra = Math.max(...sq.units4.map((u) => dE(toOklab(u.shield), lab)));
    const inkCell = cellInk(atlas, sq.emblem);
    const bw = bannerWidth(sq.yaw);
    return {
      name: sq.name,
      emblem: EMBLEMS[sq.emblem].name,
      units: sq.units4.length,
      hue: sq.hue,
      intraDE: intra,
      inkCell,
      wRatio: bw.projected / BANNER_W,
      cellShare: sq.units4.filter((u) => u.cell === sq.emblem).length,
    };
  });
  // 24 个单位身上一共有几个颜色值？按角色派生 → 只有 body/shield/helmet 三个
  const all = scene.flatMap((s) => s.units4);
  const uniq = (key) => new Set(all.map((u) => u[key].join(','))).size;
  const hues = new Set(scene.map((s) => s.hue)).size;
  return { rows, colors: { body: uniq('body'), shield: uniq('shield'), helmet: uniq('helmet') }, hues, unitTotal: all.length };
}
