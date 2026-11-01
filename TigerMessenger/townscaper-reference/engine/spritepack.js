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
