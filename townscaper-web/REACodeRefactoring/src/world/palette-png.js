/**
 * palette-png.js — 浏览器侧 Palette.png 热重载（1371460793032716290，第 56 批 C05）。
 *
 * 片子：外部编辑器里改 Palette.png → 保存 → 游戏里墙色和左侧色槽一起变。
 * 这里：按间隔用 fetch(no-store) 拉文件字节，FNV 摘要变了才解码（createImageBitmap → canvas → getImageData），
 * 取下行（wallRow）喂给 app 的 setWallPalette（私有色槽 → WorldMesh 按 palette 引用失效 → 重烘墙色 + 重建色槽面板）。
 * 用 http.server 起本仓时，直接用任何图片编辑器改 palettes/Palette.png 并保存即可看到效果。
 *
 * 默认不加载：index.html?palettePng=（空 = palettes/Palette.png）或 ?palettePng=<url>。
 * fetchBytes / decode / schedule 可注入，node 测试不需要 DOM。
 */
import { paletteRowsFromPixels, pixelsDigest, changedSlots, encodePaletteImage } from '../core/palette-image.js';

export async function decodePngBytes(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  return { width: bmp.width, height: bmp.height, pixels: g.getImageData(0, 0, bmp.width, bmp.height).data };
}

export function watchPalettePng(url, apply, {
  interval = 400, wallRow = 1, getColors = () => null,
  fetchBytes = async (u) => new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer()),
  decode = decodePngBytes,
  schedule = (fn, ms) => setTimeout(fn, ms), cancel = (t) => clearTimeout(t),
} = {}) {
  const state = { url, version: 0, digest: null, rows: null, lastChanged: [], errors: 0, lastError: null, stopped: false, polls: 0 };
  let timer = null;
  async function poll() {
    state.polls++;
    try {
      const bytes = await fetchBytes(url);
      const d = pixelsDigest(bytes);
      if (d !== state.digest) {
        const img = await decode(bytes);
        const rows = paletteRowsFromPixels(img.pixels, img.width, img.height, 4);
        const row = rows[Math.min(wallRow, rows.length - 1)];
        const before = getColors() ?? [];
        state.digest = d; state.rows = rows; state.version++;
        state.lastChanged = changedSlots(before, row.slice(0, before.length || row.length));
        apply(row, rows, state);
      }
    } catch (e) { state.errors++; state.lastError = String(e?.message ?? e); }
    if (!state.stopped) timer = schedule(poll, interval);
  }
  const ready = poll();
  return {
    state, ready,
    pollNow: () => { cancel(timer); return poll(); },
    stop() { state.stopped = true; cancel(timer); },
  };
}

/** 把当前墙色导出成 16×2 PNG（data URL），给外部编辑器当起点。 */
export async function exportPalettePng(palette, opts) {
  const { width, height, pixels } = encodePaletteImage(palette, opts);
  const c = new OffscreenCanvas(width, height), g = c.getContext('2d');
  g.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  const blob = await c.convertToBlob({ type: 'image/png' });
  return blob;
}
