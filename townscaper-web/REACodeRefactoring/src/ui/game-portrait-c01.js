/** 第 56 批 C01 · 1010979395719319552「A selection of the many handsome faces you might come across in @BadNorthGame」。
 * 958371606350454784 说生成器「content agnostic」——这里就用同一个 sampleSlots / drawSlotPortrait 走表器，
 * 只换一张「游戏内」槽表 + 绘制表，不改走表逻辑：
 *   bg     粉 / 青 / 琥珀 / 淡紫底，背后一排同色系的小兵剪影（片中头像背后是队友的身影）
 *   gear   none / helmet（圆盔）/ nasal（圆盔 + 护鼻条）/ mail（锁甲兜帽：只露一张脸，铁环纹）/ hood（布兜帽）
 *   beard  none / moustache / full
 *   frame  切角相框（浅灰描深边，八边形切角）
 * 原作素材不可得：全部是本地程序化矢量替代（椭圆 / 二次曲线 / 环纹），只复现「切角卡 + 装备层 + 背景队友」的组合机制。
 */
import { PORTRAIT_SLOTS, sampleSlots } from '../core/part-random.js';
import { SLOT_DRAWERS, drawSlotPortrait } from './slot-portrait.js';

const INK = '#2a2118';
const BG = { pink: ['#e4607e', '#c94b6a'], teal: ['#4fa7a0', '#3b8a85'], amber: ['#e2a64a', '#c98a33'], lilac: ['#a98ad0', '#8d70b8'] };
const base = PORTRAIT_SLOTS.filter((s) => s.key !== 'bg');
export const GAME_SLOTS = Object.freeze([
  Object.freeze({ key: 'bg', variants: Object.keys(BG) }),
  ...base,
  Object.freeze({ key: 'beard', variants: ['none', 'moustache', 'full'], needs: 'head' }),
  Object.freeze({ key: 'gear', variants: ['none', 'helmet', 'nasal', 'mail', 'hood'], needs: 'head' }),
  Object.freeze({ key: 'frame', variants: ['cut'] }),
]);
function hash(seed, k) { let h = Math.imul(seed ^ (k * 374761393), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// 不在这里 beginPath：调用方要把它和外框矩形拼成 evenodd 环
const cutPath = (ctx, x, y, w, h, c) => { ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath(); };

function drawBg(key) {
  return ({ ctx, box, spec, X, Y, S }) => {
    const [a, b] = BG[key];
    ctx.fillStyle = a; ctx.fillRect(box.x, box.y, box.w, box.h);
    // 背后的队友：一排圆头 + 肩，深一档的同色系
    ctx.fillStyle = b;
    for (let i = 0; i < 4; i++) {
      const u = i < 2 ? .1 + i * .13 : .77 + (i - 2) * .13, v = .5 + hash(spec.seed, 60 + i) * .08;
      ctx.beginPath(); ctx.ellipse(X(u), Y(v), .07 * S, .085 * S, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(X(u), Y(v + .28), .12 * S, .2 * S, 0, 0, Math.PI * 2); ctx.fill();
    }
  };
}
function drawBeard(kind) {
  return ({ ctx, g, X, Y, S, spec }) => {
    if (kind === 'none') return;
    const col = ['#3d2a1c', '#6b4a2e', '#8a6a44', '#2e2118'][spec.seed % 4];
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = .01 * S;
    if (kind === 'moustache') { for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(X(g.cx + sg * g.hw * .2), Y(g.cy + g.hh * .45), g.hw * .24 * S, g.hh * .05 * S, sg * .3, 0, Math.PI * 2); ctx.fill(); } return; }
    ctx.beginPath(); ctx.moveTo(X(g.cx - g.hw * .95), Y(g.cy + g.hh * .1)); ctx.quadraticCurveTo(X(g.cx - g.hw * .9), Y(g.cy + g.hh * 1.25), X(g.cx), Y(g.cy + g.hh * 1.2));
    ctx.quadraticCurveTo(X(g.cx + g.hw * .9), Y(g.cy + g.hh * 1.25), X(g.cx + g.hw * .95), Y(g.cy + g.hh * .1));
    ctx.quadraticCurveTo(X(g.cx), Y(g.cy + g.hh * .62), X(g.cx - g.hw * .95), Y(g.cy + g.hh * .1)); ctx.fill(); ctx.stroke();
  };
}
function helmet(f, nasal) {
  const { ctx, g, X, Y, S } = f;
  ctx.fillStyle = '#9aa3ad'; ctx.strokeStyle = INK; ctx.lineWidth = .014 * S;
  ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.top + g.hh * .42), g.hw * 1.08 * S, g.hh * .52 * S, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7c858f'; ctx.fillRect(X(g.cx - g.hw * 1.1), Y(g.top + g.hh * .38), g.hw * 2.2 * S, .035 * S); ctx.strokeRect(X(g.cx - g.hw * 1.1), Y(g.top + g.hh * .38), g.hw * 2.2 * S, .035 * S);
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(X(g.cx - g.hw * .3), Y(g.top + g.hh * .3), g.hw * .45 * S, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  if (nasal) { ctx.fillStyle = '#8b949e'; ctx.strokeStyle = INK; ctx.lineWidth = .012 * S; ctx.fillRect(X(g.cx - .018), Y(g.top + g.hh * .4), .036 * S, g.hh * .62 * S); ctx.strokeRect(X(g.cx - .018), Y(g.top + g.hh * .4), .036 * S, g.hh * .62 * S); }
}
function mail({ ctx, g, X, Y, S, box }) {
  // 锁甲兜帽：盖住头 / 肩，只在脸上开一个椭圆窗；铁环纹 = 一格格小弧
  ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h);
  ctx.ellipse(X(g.cx), Y(g.cy + g.hh * .08), g.hw * .78 * S, g.hh * .72 * S, 0, 0, Math.PI * 2); ctx.clip('evenodd');
  ctx.fillStyle = '#3e5566';
  ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy - g.hh * .05), g.hw * 1.22 * S, g.hh * 1.18 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy + g.hh * 1.25), g.hw * 1.9 * S, g.hh * .8 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(190,215,230,.55)'; ctx.lineWidth = .006 * S;
  for (let v = g.top - .12; v < 1.05; v += .028) for (let u = g.cx - g.hw * 2; u < g.cx + g.hw * 2; u += .03) { const o = (Math.round((v - g.top) / .028) & 1) * .015; ctx.beginPath(); ctx.arc(X(u + o), Y(v), .011 * S, 0, Math.PI); ctx.stroke(); }
  ctx.restore();
}
function hood({ ctx, g, X, Y, S, spec }) {
  ctx.save(); ctx.fillStyle = ['#6d5a48', '#5d6670', '#7a4a3a'][(spec.seed >>> 2) % 3]; ctx.strokeStyle = INK; ctx.lineWidth = .014 * S;
  ctx.beginPath(); ctx.ellipse(X(g.cx), Y(g.cy - g.hh * .05), g.hw * 1.25 * S, g.hh * 1.2 * S, 0, Math.PI * .92, Math.PI * 2.08); ctx.lineTo(X(g.cx + g.hw * 1.6), Y(1.02)); ctx.lineTo(X(g.cx - g.hw * 1.6), Y(1.02)); ctx.closePath();
  ctx.ellipse(X(g.cx), Y(g.cy + g.hh * .05), g.hw * .82 * S, g.hh * .8 * S, 0, 0, Math.PI * 2); ctx.fill('evenodd'); ctx.stroke(); ctx.restore();
}
function frame({ ctx, box }) {
  const c = box.w * .12, t = Math.max(2, box.w * .045);
  ctx.save(); ctx.beginPath(); ctx.rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4); cutPath(ctx, box.x + t, box.y + t, box.w - 2 * t, box.h - 2 * t, c * .7);
  ctx.fillStyle = '#e9e7e2'; ctx.fill('evenodd');
  ctx.strokeStyle = '#3a3a3f'; ctx.lineWidth = Math.max(1, box.w * .012); ctx.beginPath(); cutPath(ctx, box.x + t, box.y + t, box.w - 2 * t, box.h - 2 * t, c * .7); ctx.stroke(); ctx.beginPath(); cutPath(ctx, box.x + 1, box.y + 1, box.w - 2, box.h - 2, c); ctx.stroke();
  // 切角之外透明：把四个角挖掉
  ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); cutPath(ctx, box.x, box.y, box.w, box.h, c); ctx.fill('evenodd');
  ctx.restore();
}
export const GAME_DRAWERS = Object.freeze({
  ...SLOT_DRAWERS,
  bg: Object.fromEntries(Object.keys(BG).map((k) => [k, drawBg(k)])),
  beard: Object.fromEntries(['none', 'moustache', 'full'].map((k) => [k, drawBeard(k)])),
  gear: { none() {}, helmet: (f) => helmet(f, false), nasal: (f) => helmet(f, true), mail, hood },
  frame: { cut: frame },
});
/** 同一走表器、换表画游戏内头像。返回 { spec, drawn }。 */
export function drawGamePortrait(ctx, seed, box) {
  const spec = sampleSlots(seed, GAME_SLOTS);
  // 盔 / 锁甲 / 兜帽盖住头发：头发槽照样采样（同一随机流），只是被装备层盖住
  const drawn = drawSlotPortrait(ctx, spec, box, { slots: GAME_SLOTS, drawers: GAME_DRAWERS });
  return { spec, drawn };
}
