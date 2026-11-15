/**
 * palette-image.js — 1371460793032716290「Palette.png」墙色贴图（第 56 批 C05）。
 *
 * 片子（524 帧）：Photoshop 里开着 Palette.png @3200%，状态栏 "Doc: 96 bytes/128 bytes" →
 * 96 B = 16×2 像素 × RGB8。上行是一排鲜艳的参考色，下行被逐格涂成浅色；保存（frame 300 "Saving 0%"）后
 * 游戏左侧色槽和墙面一起变成下行的颜色（frame 200/300/340 原尺寸对照：色槽 = 下行逐格）。
 * 所以机制是：一张小图的「某一行」就是墙色槽，文件一保存，游戏重新读图并重烘墙色。
 *
 * 纯函数，不碰 DOM：像素 ↔ 行色、行 → 私有墙色槽、像素摘要（判断文件是否真的变了）、
 * 以及反向把当前配色写成同尺寸 RGBA（导出给外部编辑器）。浏览器侧读图/轮询在 world/palette-png.js。
 * 本地实现：行号约定（默认下行 = 墙）来自帧观察，不是原作资源格式文档；上行在本仓只保留不渲染。
 */
import { withPaletteColors } from './palette.js';

const hex2 = (v) => v.toString(16).padStart(2, '0');

/** RGBA（或 RGB）像素 → rows[y][x] = '#rrggbb'。 */
export function paletteRowsFromPixels(pixels, width, height, channels = 4) {
  if (!(width > 0 && height > 0) || !Number.isInteger(width) || !Number.isInteger(height)) throw new RangeError('palette image size');
  if (channels !== 3 && channels !== 4) throw new RangeError('palette channels');
  if (!pixels || pixels.length < width * height * channels) throw new RangeError('palette pixels');
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      row.push('#' + hex2(pixels[i]) + hex2(pixels[i + 1]) + hex2(pixels[i + 2]));
    }
    rows.push(row);
  }
  return rows;
}

/**
 * 图的第 wallRow 行 → 私有墙色槽（不改共享预设）。图比槽宽：多余列忽略（16 列 vs 15 槽）；
 * 图比槽窄：剩下的槽沿用 base 原色。行号越界时退到最后一行（单行图也能用）。
 */
export function paletteFromImageRows(base, rows, { wallRow = 1, column0 = 0 } = {}) {
  if (!base || !Array.isArray(base.colors) || !Array.isArray(rows) || !rows.length) throw new RangeError('palette rows');
  const row = rows[Math.min(Math.max(0, wallRow | 0), rows.length - 1)];
  const colors = base.colors.map((c, i) => row[column0 + i] ?? c);
  const p = withPaletteColors(base, colors);
  p.imageRows = rows.map((r) => [...r]);
  return p;
}

/** 当前配色 → width×2 RGBA：上行 = 参考色（默认同墙色），下行 = 墙色；多出的列用 filler。 */
export function encodePaletteImage(palette, { width = 16, reference = palette.colors, filler = '#c9a98c' } = {}) {
  withPaletteColors(palette, palette.colors);
  const px = new Uint8Array(width * 2 * 4);
  const put = (x, y, h) => { const i = (y * width + x) * 4; px[i] = parseInt(h.slice(1, 3), 16); px[i + 1] = parseInt(h.slice(3, 5), 16); px[i + 2] = parseInt(h.slice(5, 7), 16); px[i + 3] = 255; };
  for (let x = 0; x < width; x++) { put(x, 0, reference[x] ?? filler); put(x, 1, palette.colors[x] ?? filler); }
  return { width, height: 2, pixels: px };
}

/** FNV-1a 32 位摘要：判定"保存后内容真变了"（同内容重复保存不触发重烘）。 */
export function pixelsDigest(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** 两版墙色差了哪些槽（热重载日志 / 测试用）。 */
export function changedSlots(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || '').toLowerCase() !== (b[i] || '').toLowerCase()) out.push(i);
  return out;
}
