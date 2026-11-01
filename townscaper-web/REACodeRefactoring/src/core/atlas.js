/**
 * atlas.js — 动态图集分配（二叉树矩形打包）。
 *
 * 依据：
 *   1593215065423245313 "a lil dynamic sprite packer, able to add and remove sprite allotments at runtime …
 *     the sprites are baked live from meshes. So I guess it's basically impostors."
 *   1764958522398146667 "A cute binary tree rect packer … using the tree properly for fast collision checks"
 *   画面：一张图集里大小不一的矩形（球、花、方块），可以随时加、随时删。
 *
 * 每个节点要么是叶子（空 / 已占用），要么被切成两块（先按较长的剩余边切）。
 * free() 之后，两个孩子都空了就合并回父节点 —— 碎片不会一直累积。
 */

export class Atlas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.root = { x: 0, y: 0, w: width, h: height, used: false, a: null, b: null, parent: null };
  }

  /** 分配 w×h 的一块，返回 { x, y, w, h, node }；放不下返回 null。 */
  allocate(w, h) {
    const node = this.#insert(this.root, w, h);
    if (!node) return null;
    node.used = true;
    return { x: node.x, y: node.y, w, h, node };
  }

  #insert(n, w, h) {
    if (n.a) return this.#insert(n.a, w, h) || this.#insert(n.b, w, h);
    if (n.used || w > n.w || h > n.h) return null;
    if (w === n.w && h === n.h) return n;
    // 切成两块：按剩余较多的方向切，让留下的空间尽量方
    const dw = n.w - w, dh = n.h - h;
    if (dw > dh) {
      n.a = { x: n.x, y: n.y, w, h: n.h, used: false, a: null, b: null, parent: n };
      n.b = { x: n.x + w, y: n.y, w: dw, h: n.h, used: false, a: null, b: null, parent: n };
    } else {
      n.a = { x: n.x, y: n.y, w: n.w, h, used: false, a: null, b: null, parent: n };
      n.b = { x: n.x, y: n.y + h, w: n.w, h: dh, used: false, a: null, b: null, parent: n };
    }
    return this.#insert(n.a, w, h);
  }

  /** 释放一块；兄弟也空了就向上合并。 */
  free(rect) {
    let n = rect.node;
    n.used = false;
    n = n.parent;
    while (n && this.#empty(n.a) && this.#empty(n.b)) {
      n.a = n.b = null;
      n = n.parent;
    }
  }

  #empty(n) { return !n.used && !n.a; }

  /** 调试：所有已占用的矩形。 */
  rects(n = this.root, out = []) {
    if (n.a) { this.rects(n.a, out); this.rects(n.b, out); }
    else if (n.used) out.push({ x: n.x, y: n.y, w: n.w, h: n.h });
    return out;
  }
}
