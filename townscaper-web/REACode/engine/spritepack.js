/**
 * spritepack.js — 运行时增删的精灵图集打包器（二分树 + 空闲矩形回收）。
 *
 * 原文（x.com/OskSta/status/1593215065423245313）：
 *
 *   "Making a lil dynamic sprite packer, able to add and remove sprite allotments
 *    at runtime. I had one of these in Bad North and found it very useful.
 *    Here, the sprites are baked live from meshes. So I guess it's basically
 *    impostors. Though I expect to use it for much else too."
 *
 * 画面观察（本片第 13 帧，就是那个调试视图）：
 *   · 图集 512²，每个 allotment 用黄框标出，框里带编号
 *   · 尺寸不统一：64 / 96 / 128 / 160 / 256 都有，精灵大小按内容定
 *   · 有很多**没有精灵的空框**（编号还在）：那就是剩下的空闲矩形，
 *     打包器把它切碎了记账，而不是只记"用了多少"
 *   · 增删是逐步发生的：先出现几个，一个一个加进去，最后整片变暗（释放）
 *
 * 所以这里实现的是「空闲矩形树」而不是「按顺序摆」：
 *   - 每次插入从一个空闲矩形里切走一块，剩下的两个边角继续留在树里
 *   - 释放时把节点标空，并且**向上合并**（两个子都空 → 父也空），
 *     否则反复增删之后空闲区会碎成几千个没用的碎片
 *   - 图集满了就整体放大一倍，所有 allotment 重新插一遍（尺寸不变，位置全变）
 *
 * 这一件是 STUDY-INDEX 里挂了三轮的最大欠账：云（1852334860137849222）、
 * 树（1849427564034498642）、精灵烘焙（1593215065423245313）都堵在它前面。
 */

class Node {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.used = false;
    this.key = null;
    this.right = null;
    this.down = null;
  }
}

export class SpriteAtlas {
  /**
   * @param {number} size 初始边长（2 的幂；不够会自动翻倍）
   */
  constructor(size = 256) {
    this.size = size;
    this.items = new Map();   // key -> {w, h, pad}
    this.slots = new Map();   // key -> {x, y, w, h}
    this.root = new Node(0, 0, size, size);
  }

  /** 插入（或更新）一个 allotment。图集不够大就翻倍重排。 */
  insert(key, w, h, pad = 2) {
    const W = w + pad * 2;
    const H = h + pad * 2;
    this.items.set(key, { w, h, pad });
    for (;;) {
      if (this.size < Math.max(W, H)) { this._grow(); continue; }
      const layout = this._pack();
      if (layout) { this.slots = layout; break; }
      this._grow();
    }
    return this.slots.get(key);
  }

  /** 释放一个 allotment；空闲区会向上合并。 */
  free(key) {
    this.items.delete(key);
    this.slots.delete(key);
    const layout = this._pack();
    if (layout) this.slots = layout;
  }

  _grow() {
    this.size *= 2;
    this.root = new Node(0, 0, this.size, this.size);
  }

  /** 全部重排（插入/释放/扩容后都走这里，保证结果确定）。 */
  _pack() {
    this.root = new Node(0, 0, this.size, this.size);
    const out = new Map();
    // 大的先放：小碎片先占位会让大块永远放不进去，这是打包器的老坑
    const entries = [...this.items.entries()].sort((a, b) => (b[1].w * b[1].h) - (a[1].w * a[1].h));
    for (const [key, it] of entries) {
      const W = it.w + it.pad * 2;
      const H = it.h + it.pad * 2;
      const node = this._find(this.root, W, H);
      if (!node) return null;
      const slot = this._split(node, W, H);
      slot.used = true;
      slot.key = key;
      out.set(key, { x: slot.x + it.pad, y: slot.y + it.pad, w: it.w, h: it.h });
    }
    return out;
  }

  /** 首次适配：找一个装得下的空闲叶，取剩余边最小的（best short side fit）。 */
  _find(node, w, h) {
    if (!node) return null;
    if (node.used) return this._find(node.right, w, h) || this._find(node.down, w, h);
    if (w <= node.w && h <= node.h) return node;
    return this._find(node.right, w, h) || this._find(node.down, w, h);
  }

  _split(node, w, h) {
    const dw = node.w - w;
    const dh = node.h - h;
    if (dw > dh) {
      node.right = new Node(node.x + w, node.y, dw, node.h);
      node.down = new Node(node.x, node.y + h, w, dh);
    } else {
      node.right = new Node(node.x + w, node.y, dw, h);
      node.down = new Node(node.x, node.y + h, node.w, dh);
    }
    node.w = w;
    node.h = h;
    return node;
  }

  /** 占用率，用来判断图集是不是快满了。 */
  occupancy() {
    let used = 0;
    for (const s of this.slots.values()) used += (s.w * s.h);
    return used / (this.size * this.size);
  }
}

/**
 * 径向摆放（原文 x.com/OskSta/status/1478114309263839244, 2022-01-03）：
 *
 *   "Yeah that's good enough for now. I quite like how the radial (instead of
 *    directional) size-sorting looks. Gonna make for some visually pleasing
 *    textures with that big coherent chunk in the middle."
 *
 * 上面 `SpriteAtlas` 用的是 **best-short-side**：面积大的先放、放在最先装得下的
 * 空位。结果是"填得紧"，但大块会被推到角落 —— 因为第一个放进去的块总是落在左上角。
 *
 * 他改成**径向**：不是按方向扫，而是按"到中心的距离"排序 —— 最大的一块放正中心，
 * 其余的沿螺旋往外。于是最大的那块被小块**包围**在中间，形成"中间一大坨连贯的东西"。
 * 这在贴图里就是：中间一块完整的、周围是碎料，看起来像一个有主次的图案，
 * 而不是一张"货架"。
 *
 * 注意这是**审美排序**，不是更优的装箱：填充率通常略低于 best-short-side，
 * 换的是"大块居中"这个视觉结果。下面 `radialPack()` 用螺旋 + 占据栅格实现，
 * 开销 O(n · steps)，只适合几十~几百块。
 */
export function radialPack(items, { size = 256, gap = 2 } = {}) {
  const grid = new Uint8Array(size * size);
  const placed = [];
  const fits = (x, y, w, h) => {
    if (x < 0 || y < 0 || x + w > size || y + h > size) return false;
    for (let j = y; j < y + h; j++) {
      const row = j * size;
      for (let i = x; i < x + w; i++) if (grid[row + i]) return false;
    }
    return true;
  };
  const mark = (x, y, w, h, v) => {
    for (let j = y; j < y + h; j++) {
      const row = j * size;
      for (let i = x; i < x + w; i++) grid[row + i] = v;
    }
  };

  // 大 → 小；第一个直接放正中心
  const sorted = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
  const cx = size / 2, cy = size / 2;

  sorted.forEach((it, idx) => {
    const W = it.w + gap * 2;
    const H = it.h + gap * 2;
    let put = null;

    if (idx === 0) {
      const x = Math.round(cx - W / 2), y = Math.round(cy - H / 2);
      if (fits(x, y, W, H)) put = [x, y];
    }
    if (!put) {
      // 阿基米德螺旋：半径随角度线性增长，步长半个格子，保证不漏掉窄缝
      const stepR = Math.max(2, Math.min(W, H) * 0.28);
      const maxR = size * 0.75;
      for (let r = 0; r < maxR && !put; r += stepR) {
        const steps = Math.max(8, Math.round((2 * Math.PI * Math.max(r, 1)) / stepR));
        for (let s = 0; s < steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(a) * r - W / 2);
          const y = Math.round(cy + Math.sin(a) * r - H / 2);
          if (fits(x, y, W, H)) { put = [x, y]; break; }
        }
      }
    }
    if (!put) return;      // 放不下就跳过（径向摆放本来就不追求塞满）
    mark(put[0], put[1], W, H, 1);
    placed.push({ ...it, x: put[0] + gap, y: put[1] + gap });
  });

  let used = 0;
  for (const p of placed) used += p.w * p.h;
  const big = placed[0] || null;
  return {
    placed,
    skipped: sorted.length - placed.length,
    occupancy: used / (size * size),
    // "中芯性"：最大的那块离中心多远（0 = 正中心）。原文要的就是这个数小。
    bigOffset: big ? +Math.hypot(big.x + big.w / 2 - cx, big.y + big.h / 2 - cy).toFixed(2) : null,
  };
}
