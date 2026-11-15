// r56 C08 · 1765041830461055127「Now supports removing rects too! The bin space gets quite fragmented
// after a while ... Still packs tight though!」
// REACode src/rectpack.js 的 RectBin 接口（placed Map / stats / leaves / place / remove / canPlace /
// recursiveFill / report 字段）在共享 core/atlas.js 之上做兼容外观——不复制第二份树：
// 跨叶放置就是 Atlas.allocateAt（一块可占多个空闲叶，存活块不移动），删除就是 Atlas.remove（兄弟合并）。
// 另加 churn()：持续随机增删，记录占用率与碎片度曲线（片中 0000–0200 帧长时间增删）。
import { Atlas } from './atlas.js';

export class RectBin {
  constructor(width, height) {
    this.atlas = new Atlas(width, height);
    this.width = width; this.height = height;
    this.placed = new Map();
    this.stats = { places: 0, removals: 0, tests: 0, splits: 0, merges: 0, lastTried: 0 };
  }
  get root() { return this.atlas.root; }
  /** 树的全部叶子（与 REACode 同名；叶子 used=已占） */
  leaves(n = this.atlas.root, out = []) { if (!n) return out; if (!n.a) { out.push(n); return out; } this.leaves(n.a, out); this.leaves(n.b, out); return out; }
  canPlace(x, y, w, h) {
    if (![x, y].every(Number.isSafeInteger)) return false;
    if (x < 0 || y < 0 || x + w > this.width || y + h > this.height) return false;
    const ok = this.atlas.canPlace(x, y, w, h); this.stats.tests += this.atlas.lastSearch.visited; return ok;
  }
  place(key, w, h, { attempts = 240, rng = Math.random } = {}) {
    if (w > this.width || h > this.height) return null;
    const before = this.leaves().length;
    const slot = this.atlas.place(key, w, h, { attempts, rng });
    this.stats.tests += this.atlas.lastSearch.totalVisited || 0; this.stats.lastTried = this.atlas.lastSearch.tried || 0;
    if (!slot) return null;
    const leaves = this.leaves().filter((n) => n.used && n.x >= slot.x && n.y >= slot.y && n.x + n.w <= slot.x + slot.w && n.y + n.h <= slot.y + slot.h).length;
    this.stats.splits += Math.max(0, this.leaves().length - before);   // each split adds one leaf
    this.stats.places++;
    const r = { x: slot.x, y: slot.y, w: slot.w, h: slot.h, leaves };
    this.placed.set(key, r); return r;
  }
  remove(key) {
    if (!this.placed.has(key)) return false;
    const before = this.leaves().length;
    if (!this.atlas.remove(key)) return false;
    this.stats.merges += Math.max(0, before - this.leaves().length);   // each sibling merge removes one leaf
    this.placed.delete(key); this.stats.removals++; return true;
  }
  recursiveFill(opts = {}) {
    const res = this.atlas.recursiveFill(opts);
    for (const a of res.arm) this.placed.set(a.key, { x: a.x, y: a.y, w: a.w, h: a.h, leaves: 1 });
    return res;
  }
  report() {
    const r = this.atlas.report();
    let used = 0; for (const p of this.placed.values()) used += p.w * p.h;
    return { placed: this.placed.size, leaves: r.leaves, usedArea: used, fill: used / (this.width * this.height), freeArea: r.freeArea,
      freeLeaves: r.freeLeaves, largestFree: r.largestFree, largestShare: r.largestShare, avgFreeLeaf: r.freeLeaves ? r.freeArea / r.freeLeaves : 0, maxDepth: r.maxDepth, ...this.stats };
  }
}

/** 持续增删：每步以 pRemove 概率删一块随机存活块，否则放一块随机尺寸；返回曲线 */
export function churn(bin, { steps = 600, seed = 3, pRemove = .45, minSize = 2, maxSize = 12, attempts = 120 } = {}) {
  if (!(bin instanceof RectBin)) throw new TypeError('RectBin required');
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const curve = []; let n = 0, fails = 0;
  for (let i = 0; i < steps; i++) {
    if (bin.placed.size && rnd() < pRemove) { const keys = [...bin.placed.keys()]; bin.remove(keys[Math.floor(rnd() * keys.length)]); }
    else {
      const w = minSize + Math.floor(rnd() * (maxSize - minSize + 1)), h = minSize + Math.floor(rnd() * (maxSize - minSize + 1));
      if (!bin.place('c' + (n++), w, h, { attempts, rng: rnd })) fails++;
    }
    if (i % 10 === 9 || i === steps - 1) { const r = bin.report(); curve.push({ step: i + 1, fill: r.fill, largestShare: r.largestShare, freeLeaves: r.freeLeaves, leaves: r.leaves, placed: r.placed, fails }); }
  }
  return curve;
}

/** 所有节点（含内部节点）按深度展开，供「3D 树」视图：内部节点在上层、叶子在底层 */
export function treeNodes(bin) {
  const out = [], st = [[bin.atlas.root, 0, -1]];
  while (st.length) { const [n, d, p] = st.pop(); const id = out.length; out.push({ id, parent: p, depth: d, x: n.x, y: n.y, w: n.w, h: n.h, leaf: !n.a, used: !!n.used }); if (n.a) st.push([n.b, d + 1, id], [n.a, d + 1, id]); }
  return out;
}
