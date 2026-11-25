/**
 * palette-store.js — 「常用墙色」本地存档（1200520827898343425「tune your town to your favorite palette」）。
 *
 * 片子里只有一件事：改一个色槽 → 整座镇里用到该槽的体素在同一帧换色，屋顶橙与其它槽不动（4 次硬切）。
 * 没有 UI、也没有存档画面，所以「持久化」按本仓口径落：色槽列表以固定 schema 存进 localStorage，
 * 刷新后自动恢复；坏数据（长度不对 / 非 #rrggbb / 版本不认 / 非 JSON）一律拒绝，不许污染线上世界。
 *
 * 纯函数，不碰 DOM localStorage（读写在 world/palette-png.js 之外的页面脚本里，见 wall-palette.html）。
 */
import { withPaletteColors } from './palette.js';

export const STORE_KEY = 'rea.wallPalette.v1';
export const STORE_VERSION = 1;

/**
 * colors → 存档对象。base 提供槽数量与合法预设的参照（不会被修改）。
 * grid 只是「这份常用配色是在哪种网格上调的」，读回时不强制匹配（几何已经写在存档里）。
 */
export function encodePaletteRecord(colors, { base, grid = null, savedAt = null } = {}) {
  if (!base) throw new RangeError('palette store: 需要 base 预设');
  const p = withPaletteColors(base, colors);                 // 槽数量 / #rrggbb / 字符串 全在这里把关
  if (grid !== null && typeof grid !== 'string') throw new RangeError('palette store: grid 必须是字符串');
  return { v: STORE_VERSION, colors: [...p.colors], grid, savedAt };
}

/**
 * 存档对象（或它的 JSON 文本）→ { colors, grid, savedAt }。
 * raw 为空（null / '' / undefined）→ 返回 null，表示「没有存档」，不是错误。
 */
export function decodePaletteRecord(raw, base) {
  if (!base) throw new RangeError('palette store: 需要 base 预设');
  if (raw === null || raw === undefined || raw === '') return null;
  let rec = raw;
  if (typeof raw === 'string') {
    try { rec = JSON.parse(raw); } catch { throw new RangeError('palette store: 存档不是 JSON'); }
  }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new RangeError('palette store: 存档不是对象');
  if (rec.v !== STORE_VERSION) throw new RangeError(`palette store: 存档版本 ${rec.v} 不认（需要 ${STORE_VERSION}）`);
  const p = withPaletteColors(base, rec.colors);             // 长度不符 / 非法色值 都会抛 RangeError
  const grid = rec.grid === null || rec.grid === undefined ? null : rec.grid;
  if (grid !== null && typeof grid !== 'string') throw new RangeError('palette store: grid 必须是字符串');
  const savedAt = Number.isFinite(rec.savedAt) ? rec.savedAt : null;
  return { colors: [...p.colors], grid, savedAt };
}

/** 两份颜色逐槽是否相同（用来跳过多余的写入 / 重烘）。不合法时抛 RangeError。 */
export function sameWallColors(a, b, base) {
  const A = withPaletteColors(base, a).colors, B = withPaletteColors(base, b).colors;
  return A.every((c, i) => c.toLowerCase() === B[i].toLowerCase());
}
