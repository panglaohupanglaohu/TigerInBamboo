/**
 * field-cache.js — 1168571866405097472「每次改动把分层网格重投影成纹理」的另一半：
 * 纹理是**常驻**的，一次编辑只重投影改动的那几格。
 *
 * bake.js buildOcclusionField 每次都整层栅格化 + 整层模糊，而一次点击只改一格
 * （裁判 src/lighting.js 头部同一笔账：栅格化 ~3.4ms + 模糊 ~13.5ms 全是重活）。
 * 本类对齐只读裁判 src/lightingcache.js 的机制与精确性口径：
 *
 *   1. 底片：keepRaw 留下模糊前占用/颜色数组；
 *   2. 签名：逐格 FNV-1a（层数 + 逐层 solid/rock/colorOf + 形变切面顶点）——
 *      比裁判多记 rock 与 shape.at，因为本仓栅格化对岩石层用切面顶点；
 *   3. 脏矩形 = 各脏格「旧写入区 ∪ 新可写区」并集（cellWriteRect 保守上界，
 *      变矮/消失的格靠旧矩形把残留擦干净）；
 *   4. 底片脏矩形清零后，按 world.cells 原序重投影所有与脏矩形相交的格 ——
 *      相邻格共享边界纹素，同序覆写保证与全量栅格化逐值一致；
 *   5. 只重模糊脏矩形（field.reblur：窗口 ±2·P·R、写回 ±P·R，可分离盒式
 *      P 遍半径 R 只读 P·R 邻域，写回区里与全量同式）。
 *
 * 与全量 buildOcclusionField 的差：窗口化滑动前缀和的锚点不同，个别纹素可能
 * 差 ~1e-15 浮点尾数（verifyAgainstFull 实测上报）；机制上是同一套算术，
 * 不是近似。回退全量：无旧场、包围盒/层数/格子数变了、或脏格占比超阈值。
 *
 * 用法：
 *   const cache = new LayeredFieldCache({ L, colorOf, res, radius });
 *   const { field, mode } = cache.update(world, { shape });   // 'full'|'dirty'|'clean'
 *   bakeLighting(mesh, world, { field, ... });                // 顶点采样（CPU 路径）
 *   packLayeredField(field) → DataTexture → 顶点着色器采样（GPU 路径，voxel-field.js）
 */
import { buildOcclusionField } from './bake.js';

/** FNV-1a —— 只用来判「这格变了没有」。 */
const mix = (h, v) => { let x = (h ^ (v | 0)) >>> 0; x = Math.imul(x, 16777619) >>> 0; return x; };

export class LayeredFieldCache {
  /**
   * @param {object} o 同 buildOcclusionField：{ L, colorOf, res, radius, pad }；fullRatio 脏格占比阈值
   */
  constructor({ L, colorOf, res = null, radius = null, pad = 0.8, fullRatio = 0.35 } = {}) {
    if (!Number.isFinite(L) || L <= 0) throw new RangeError('LayeredFieldCache L');
    if (typeof colorOf !== 'function') throw new RangeError('LayeredFieldCache colorOf');
    if (res != null && !(res > 0)) throw new RangeError('LayeredFieldCache res');
    if (radius != null && !(radius >= 1)) throw new RangeError('LayeredFieldCache radius');
    this.opts = { L, colorOf, res, radius, pad, fullRatio };
    this.field = null;
    this.world = null;
    this.shape = undefined;
    this.bounds = null;
    this.cellsLen = 0;
    this.sigs = new Map();     // cellId → 签名
    this.rects = new Map();    // cellId → 上次写入的保守纹素矩形
    this.last = { mode: 'none', dirty: 0, ms: 0 };
  }

  /* ---------------------------------------------------------------- helpers */

  /** 与 buildOcclusionField 同一套包围盒（cell 包围盒 + maxH）；不变 ⇒ res/radius/层数/纹素网格全不变。 */
  #bounds(world) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 0;
    for (const c of world.cells) {
      const h = world.top(c);
      if (!h) continue;
      if (c.minX < minX) minX = c.minX; if (c.maxX > maxX) maxX = c.maxX;
      if (c.minZ < minZ) minZ = c.minZ; if (c.maxZ > maxZ) maxZ = c.maxZ;
      if (h > maxH) maxH = h;
    }
    return Number.isFinite(minX) ? { minX, maxX, minZ, maxZ, maxH } : null;
  }

  /**
   * 格的写入输入全部进签名：层数、逐层 solid/rock、colorOf 颜色，
   * 以及形变切面顶点（rock 层栅格化用 shape.at —— 平滑参数变了也要判脏）。
   */
  #signature(world, c, shape) {
    const top = world.top(c);
    if (!top) return 0;
    const colorOf = this.opts.colorOf;
    let h = mix(2166136261, top);
    for (let lv = 1; lv <= top; lv++) {
      const solid = world.isSolid(c, lv), rock = world.isRock(c, lv);
      h = mix(h, solid ? 1 : 0);
      h = mix(h, rock ? 1 : 0);
      if (!solid) continue;
      const cc = colorOf(c, lv) || { r: 1, g: 1, b: 1 };
      h = mix(h, Math.round(cc.r * 255));
      h = mix(h, Math.round(cc.g * 255));
      h = mix(h, Math.round(cc.b * 255));
      if (shape && rock) for (const p of c.pts) {
        const [x, z] = shape.at(p, lv);
        h = mix(h, Math.round(x * 1e4));
        h = mix(h, Math.round(z * 1e4));
      }
    }
    return h;
  }

  /* ----------------------------------------------------------------- public */

  /**
   * 建场或增量更新。返回 { field, mode, dirty, ms, rect?, blurMs? }；
   * mode 'full' = 假设不成立整建（含首建/空场 field=null）；'dirty' = 增量；'clean' = 无改动。
   */
  update(world, { shape = null } = {}) {
    if (!world?.cells) throw new RangeError('LayeredFieldCache.update needs a world');
    const t0 = performance.now();
    const bounds = this.#bounds(world);
    // shape 的有无变了 ⇒ 栅格化 grow(0/0.26) 变了 ⇒ 写入矩形口径不同，直接全量；
    // 同是非空 shape 时签名里的 shape.at 会判出脏格，走增量。
    const sameShape = this.field && this.world === world && this.cellsLen === world.cells.length && bounds && this.bounds
      && (shape != null) === (this.shape != null)
      && this.bounds.minX === bounds.minX && this.bounds.maxX === bounds.maxX
      && this.bounds.minZ === bounds.minZ && this.bounds.maxZ === bounds.maxZ
      && this.bounds.maxH === bounds.maxH;
    if (!sameShape) return this.#full(world, shape, bounds, t0);

    // ---- 签名 diff ----
    const field = this.field;
    const dirty = [];
    const seen = new Set();
    for (const c of world.cells) {
      seen.add(c.id);
      const sig = this.#signature(world, c, shape);
      if (this.sigs.get(c.id) !== sig) dirty.push({ c, sig });
    }
    const removed = [];
    for (const id of [...this.sigs.keys()]) if (!seen.has(id)) removed.push(id);
    if (!dirty.length && !removed.length) {
      this.last = { mode: 'clean', dirty: 0, ms: +(performance.now() - t0).toFixed(2) };
      return { field, ...this.last };
    }
    if (dirty.length + removed.length > world.cells.length * this.opts.fullRatio) return this.#full(world, shape, bounds, t0);

    // ---- 脏矩形 = 旧写入区 ∪ 新可写区（变矮/消失只靠旧矩形擦不干净）----
    let i0 = Infinity, i1 = -1, j0 = Infinity, j1 = -1;
    const growRect = (r) => {
      if (!r) return;
      if (r.i0 < i0) i0 = r.i0; if (r.i1 > i1) i1 = r.i1;
      if (r.j0 < j0) j0 = r.j0; if (r.j1 > j1) j1 = r.j1;
    };
    for (const d of dirty) {
      d.newRect = field.cellWriteRect(d.c, shape);
      growRect(this.rects.get(d.c.id));
      growRect(d.newRect);
    }
    for (const id of removed) growRect(this.rects.get(id));
    const rect = { i0, i1, j0, j1 };
    const newRects = new Map(dirty.map((d) => [d.c.id, d.newRect]));

    // ---- 底片：脏矩形清零 → 按格序重投影所有与脏矩形相交的格 ----
    field.clearRect(rect);
    for (const c of world.cells) {
      const r = newRects.has(c.id) ? newRects.get(c.id) : (this.rects.get(c.id) ?? field.cellWriteRect(c, shape));
      if (!r || r.i1 < rect.i0 || r.i0 > rect.i1 || r.j1 < rect.j0 || r.j0 > rect.j1) continue;
      field.restamp(c, shape);
    }
    field.refreshBits(rect);
    const rb = field.reblur(rect);

    for (const d of dirty) {
      this.sigs.set(d.c.id, d.sig);
      if (d.newRect) this.rects.set(d.c.id, d.newRect); else this.rects.delete(d.c.id);
    }
    for (const id of removed) { this.sigs.delete(id); this.rects.delete(id); }
    this.shape = shape;
    this.last = { mode: 'dirty', dirty: dirty.length + removed.length, ms: +(performance.now() - t0).toFixed(2), rect, blurMs: rb ? rb.ms : 0 };
    return { field, ...this.last };
  }

  #full(world, shape, bounds, t0) {
    const field = buildOcclusionField(world, {
      L: this.opts.L, colorOf: this.opts.colorOf, shape,
      res: this.opts.res, radius: this.opts.radius, pad: this.opts.pad,
      keepBits: true, keepRaw: true,
    });
    this.field = field;
    this.world = world;
    this.shape = shape;
    this.bounds = bounds;
    this.cellsLen = world.cells.length;
    this.sigs.clear();
    this.rects.clear();
    if (field) for (const c of world.cells) {
      this.sigs.set(c.id, this.#signature(world, c, shape));
      this.rects.set(c.id, field.cellWriteRect(c));
    }
    this.last = { mode: 'full', dirty: 0, ms: +(performance.now() - t0).toFixed(2) };
    return { field, ...this.last };
  }

  /**
   * 验证：把同一 world 重新全量建一张场，逐纹素比占用/颜色/位图。
   * 返回各通道 { max, bad(>1e-9) } 与汇总 maxDiff/badTexels；场是 null 时返回 null。
   */
  verifyAgainstFull(world, { shape = this.shape } = {}) {
    if (!this.field) return null;
    const ref = buildOcclusionField(world, {
      L: this.opts.L, colorOf: this.opts.colorOf, shape,
      res: this.opts.res, radius: this.opts.radius, pad: this.opts.pad,
      keepBits: true,
    });
    const a = this.field;
    if (!ref) return { empty: true, fieldWasBuilt: true };
    const stat = (x, y) => {
      let max = 0, bad = 0;
      for (let k = 0; k < x.length; k++) { const d = Math.abs(x[k] - y[k]); if (d > max) max = d; if (d > 1e-9) bad++; }
      return { max: +max.toExponential(3), bad };
    };
    const occ = stat(a.occ, ref.occ), cr = stat(a.cr, ref.cr), cg = stat(a.cg, ref.cg), cb = stat(a.cb, ref.cb);
    const bits = a.bits && ref.bits ? stat(a.bits, ref.bits) : null;
    return { occ, cr, cg, cb, bits, maxDiff: Math.max(occ.max, cr.max, cg.max, cb.max), badTexels: occ.bad + cr.bad + cg.bad + cb.bad };
  }
}
