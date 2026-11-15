/**
 * texel-owner.js — 烘进大图之后「从一个像素反查回哪个面、面上哪个 u,v」（1481661852887265288，第 50 轮迁自 REACode src/megatex.js）
 *
 * README 原文：「Yet another light baker. Actually does some ray marching, but still pretty ad hoc. The textures are:
 *   1. Normals (procedurally painted in big chunky strokes) 2. 3D Signed Distance Field 3. 3D Ambient Occlusion in positive and negative X,Y and Z」
 * REACode 版本自写货架式打包（shelfPack）+ 烘图时顺手写 owner 表（owner[i] = 这个 texel 属于第几个面、pad[i] = 是否垫边），
 * 反查 = O(1) 查表 + 矩形内归一化；并量了垫边 0 / 2 像素时双线性采样与 mip 的串色。
 * 这里改用共享的增量图集（core/atlas.js 的 Atlas.allocate，烘焙器 life/impostor.js 用的同一个），owner 表跟着槽位写：
 *   · allocate(w + 2·pad, h + 2·pad)，面数据画在内框，四周 pad 圈复制边缘像素（垫边）；
 *   · resolveTexel(x, y) → { key, u, v, pad }；bilinearOwners(x, y) → 双线性四个采样点各属于谁（串色诊断）；
 *   · mipOwners(level)：按 2×2 多数派下采样 owner，量每一级有多少 texel 混了两个面。
 */
import { Atlas } from '../core/atlas.js';

export class TexelOwnerAtlas {
  constructor(width, height, { pad = 2 } = {}) {
    if (!Number.isInteger(pad) || pad < 0 || pad > 16) throw new RangeError('pad must be an integer 0..16');
    this.atlas = new Atlas(width, height); this.width = width; this.height = height; this.pad = pad;
    this.owner = new Int32Array(width * height).fill(-1); this.isPad = new Uint8Array(width * height);
    this.entries = [];   // [{key, x, y, w, h}]（内框，不含垫边）
  }
  /** 放一个 w×h 的面；返回内框矩形或 null（放不下）。 */
  add(key, w, h) {
    const P = this.pad, slot = this.atlas.allocate(w + 2 * P, h + 2 * P); if (!slot) return null;
    const id = this.entries.length, r = { key, x: slot.x + P, y: slot.y + P, w, h }; this.entries.push(r);
    for (let y = slot.y; y < slot.y + slot.h; y++) for (let x = slot.x; x < slot.x + slot.w; x++) {
      const k = y * this.width + x; this.owner[k] = id; this.isPad[k] = x < r.x || y < r.y || x >= r.x + w || y >= r.y + h ? 1 : 0;
    }
    return r;
  }
  /** 像素 (x,y) → { key, id, u, v, pad }；垫边像素的 u,v 夹到内框边上；空白返回 null。 */
  resolveTexel(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const k = (y | 0) * this.width + (x | 0), id = this.owner[k]; if (id < 0) return null;
    const r = this.entries[id], u = Math.min(1, Math.max(0, ((x | 0) + 0.5 - r.x) / r.w)), v = Math.min(1, Math.max(0, ((y | 0) + 0.5 - r.y) / r.h));
    return { key: r.key, id, u, v, pad: !!this.isPad[k] };
  }
  /** 面 id 的 (u,v) → 图集像素中心坐标（反查的逆）。 */
  texelOf(id, u, v) { const r = this.entries[id]; return [r.x + u * r.w, r.y + v * r.h]; }
  /** 双线性采样 (x,y)（像素坐标，中心在 +0.5）用到的四个 texel 各属于哪个面 → 是否串色。 */
  bilinearOwners(x, y) {
    const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), ids = new Set();
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = x0 + dx, yy = y0 + dy; ids.add(xx < 0 || yy < 0 || xx >= this.width || yy >= this.height ? -1 : this.owner[yy * this.width + xx]); }
    return ids;
  }
  /** mip 第 level 级：每个 texel 覆盖 2^level×2^level 原像素；返回「覆盖到 ≥2 个面（含空白）」的 texel 比例，只统计含内框像素的块。 */
  mipBleed(level) {
    const s = 1 << level, W = Math.floor(this.width / s), H = Math.floor(this.height / s); let mixed = 0, used = 0;
    for (let by = 0; by < H; by++) for (let bx = 0; bx < W; bx++) {
      const ids = new Set(); let core = false;
      for (let y = by * s; y < by * s + s; y++) for (let x = bx * s; x < bx * s + s; x++) { const k = y * this.width + x; ids.add(this.owner[k]); if (this.owner[k] >= 0 && !this.isPad[k]) core = true; }
      if (!core) continue; used++; if (ids.size > 1) mixed++;
    }
    return used ? mixed / used : 0;
  }
}
