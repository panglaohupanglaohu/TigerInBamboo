/**
 * rectpack.js — 矩形打包器：暴力撒点 + 二叉树做碰撞查询（可增可删）。
 *
 * 原文（x.com/OskSta/status/1764958522398146667, 2024-03-05）：
 *
 *   "A cute binary tree rect packer. Generating the placement attempts is kinda
 *    brute force (to get into all the nooks and crannies), but then it's using
 *    the tree properly for fast collision checks. I think this is the first time
 *    I've actually written a proper space partion tree."
 *
 *   拆成两句就是两个模块：
 *     ① **撒点**很笨 —— 大量候选位置（随机 + 贴边 + 贴角）硬试，目的不是优雅，
 *        是把碎片角落也试到；这一步本来就没有好算法，索性暴力。
 *     ② **判**很快 —— 树只走与候选矩形相交的那些叶子，不看整张已放列表。
 *   两句必须分开：把撒点也塞进树里（"从树里找第一个装得下的叶子"）就退化成
 *   spritepack.js 那种整表重排，只能整批重算，没法逐块增量放/删。
 *
 *   → 所以 spritepack.js（1593215065423245313）和本文件是两种东西：
 *     spritepack 是**离线**整表重排（插入就重排全部，尺寸固定，结果确定）；
 *     rectpack 是**增量**的（放一块只切几片叶子，删一块只并几个节点），
 *     代价是结果依赖放置顺序 —— 但换来的正是下一条原文要的"运行时删除"。
 *
 * 原文（x.com/OskSta/status/1765041830461055127, 2024-03-05）：
 *
 *   "Now supports removing rects too! The bin space gets quite fragmented after
 *    a while though.. I've tried to optimize it on the fly but I can't figure out
 *    how to when it get sort of interlocked. Still packs tight though!"
 *
 *   画面（第 0~4 帧）是一整板彩色矩形，5~12 帧矩形成片消失又成片长回来。
 *   所以"删除"必须在同一张板上跑，不能重建 —— 重建会丢掉"空隙长什么样"。
 *   他的"interlocked"在这里是可测的：删除后空闲叶数量涨、最大空闲叶变小，
 *   但总占用率几乎不掉。本文件把这三个量都吐出来（fragmentation 统计）。
 *
 * 原文（x.com/OskSta/status/1765115069837221962, 2024-03-05）：
 *
 *   "Here, I'm visualizing the recursive tree parsing as it adds new rects. Note
 *    that when the board is more fragmented the arm tends to have more fingers."
 *
 *   画面：一条细线从板子左下角伸出来，线上每隔一段冒出一个矩形，像一条手臂；
 *   板子越碎，那条手臂上分出来的"手指"越多（frame 14~23 手臂绕开已有矩形）。
 *   "手指"= 递归解析时同一层要同时试的候选分支数。碎板子上候选更多 →
 *   手指更多。本文件用 `recursiveFill()` 复现：每步记录 `fingers`。
 */

const EPS = 1e-6;

class Node {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.key = null;      // 非空 = 已占用
    this.a = null;        // 沿 x 切出来的左半
    this.b = null;        // 右半（或下半）
  }
  get leaf() { return !this.a && !this.b; }
  get used() { return this.key !== null; }
  get area() { return this.w * this.h; }
}

/** 两个矩形是否相交（含边接触；接触不算重叠，用 EPS 让"贴边"能过）。 */
function overlaps(n, r) {
  return n.x < r.x + r.w - EPS && r.x < n.x + n.w - EPS &&
         n.y < r.y + r.h - EPS && r.y < n.y + n.h - EPS;
}

export class RectBin {
  /**
   * @param {number} width  板宽（世界单位 / 像素都行，只要同一套）
   * @param {number} height 板高
   */
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.root = new Node(0, 0, width, height);
    this.placed = new Map();   // key -> {x,y,w,h}
    this.stats = { places: 0, removals: 0, tests: 0, splits: 0, merges: 0 };
  }

  /** 树里所有叶子（调试/量化用）。 */
  leaves(node = this.root, out = []) {
    if (!node) return out;
    if (node.leaf) { out.push(node); return out; }
    this.leaves(node.a, out);
    this.leaves(node.b, out);
    return out;
  }

  /** 候选位置是否整块落在空闲叶子上（树只走与候选相交的枝）。 */
  canPlace(x, y, w, h) {
    const r = { x, y, w, h };
    if (x < -EPS || y < -EPS || x + w > this.width + EPS || y + h > this.height + EPS) return false;
    const stack = [this.root];
    while (stack.length) {
      const n = stack.pop();
      this.stats.tests++;
      if (!overlaps(n, r)) continue;
      if (n.leaf) { if (n.used) return false; continue; }
      stack.push(n.a, n.b);
    }
    return true;
  }

  /**
   * 放一块。撒点是暴力：随机点 + 贴已有矩形的边/角 + 贴板边。
   *
   * @param {string} key
   * @param {number} w
   * @param {number} h
   * @param {object} opts { attempts, rng, snap }
   * @returns {{x,y,w,h}|null}
   */
  place(key, w, h, { attempts = 240, rng = Math.random, snap = true } = {}) {
    if (w > this.width || h > this.height) return null;
    const cands = [];
    // ① 板边与板角：最容易被漏掉的、也是最好的位置
    cands.push([0, 0], [this.width - w, 0], [0, this.height - h], [this.width - w, this.height - h]);
    // ② 贴已有矩形的右边/下边（"nooks and crannies"）
    if (snap) {
      for (const p of this.placed.values()) {
        cands.push([p.x + p.w, p.y], [p.x, p.y + p.h]);
        cands.push([p.x + p.w, p.y + p.h - h], [p.x + p.w - w, p.y + p.h]);
      }
    }
    // ③ 随机点（均匀撒，负责覆盖前两类到不了的角落）
    for (let i = 0; i < attempts; i++) {
      cands.push([rng() * (this.width - w), rng() * (this.height - h)]);
    }
    let tried = 0;
    for (const [x, y] of cands) {
      tried++;
      if (x < -EPS || y < -EPS) continue;
      if (this.canPlace(x, y, w, h)) {
        this._commit(key, x, y, w, h);
        this.stats.places++;
        this.stats.lastTried = tried;
        return this.placed.get(key);
      }
    }
    this.stats.lastTried = tried;
    return null;
  }

  /**
   * 真正占位：把相交的空闲叶切到与候选对齐，然后**每个被覆盖的叶子都记上同一个 key**。
   *
   * 为什么允许多个叶子共用一个 key：如果把"被覆盖"的部分硬切成一个正好等于候选的
   * 叶子，每放一块都要在四周产生极细的边条，几百块之后就是几千条 1e-6 宽的碎片，
   * 递归还会打转（第一版就是这么爆栈的）。让叶子共用 key 之后，"这块地被谁占了"
   * 这件事只存在叶子上，切分只需要把**外面**的部分分出去，切口永远严格落在叶子内部。
   */
  _commit(key, x, y, w, h) {
    const r = { x, y, w, h };
    let hits = 0;
    const carve = (n) => {
      if (!overlaps(n, r)) return;
      if (n.leaf) {
        if (n.used) return;
        const coverX = x <= n.x + EPS && x + w >= n.x + n.w - EPS;
        const coverY = y <= n.y + EPS && y + h >= n.y + n.h - EPS;
        if (coverX && coverY) { n.key = key; hits++; return; }
        if (!coverX) {
          // 候选的某个 x 边界一定严格落在叶子里 → 这一刀一定能切开
          const cx = x > n.x + EPS ? x : x + w;
          if (!(cx > n.x + EPS && cx < n.x + n.w - EPS)) { n.key = key; hits++; return; }
          n.a = new Node(n.x, n.y, cx - n.x, n.h);
          n.b = new Node(cx, n.y, n.x + n.w - cx, n.h);
        } else {
          const cy = y > n.y + EPS ? y : y + h;
          if (!(cy > n.y + EPS && cy < n.y + n.h - EPS)) { n.key = key; hits++; return; }
          n.a = new Node(n.x, n.y, n.w, cy - n.y);
          n.b = new Node(n.x, cy, n.w, n.y + n.h - cy);
        }
        this.stats.splits++;
        carve(n.a); carve(n.b);
        return;
      }
      carve(n.a); carve(n.b);
    };
    carve(this.root);
    if (!hits) return false;
    this.placed.set(key, { x, y, w, h, leaves: hits });
    return true;
  }

  /**
   * 删一块：叶子标空，然后**向上合并**两个都空的兄弟。
   * 不合并的话反复增删会把空闲区碎成几千片（原文说的 interlocked）。
   */
  remove(key) {
    if (!this.placed.has(key)) return false;
    // 后序：先回收子枝，再尝试把两个都空的兄弟并回父节点
    const walk = (n) => {
      if (!n) return 0;
      if (n.leaf) {
        if (n.key === key) { n.key = null; return 1; }
        return 0;
      }
      const hit = walk(n.a) + walk(n.b);
      if (n.a && n.b && n.a.leaf && n.b.leaf && !n.a.used && !n.b.used) {
        n.a = null; n.b = null;
        this.stats.merges++;
      }
      return hit;
    };
    const hit = walk(this.root);
    if (!hit) return false;
    this.placed.delete(key);
    this.stats.removals++;
    return true;
  }

  /**
   * 递归解析式填充（1765115069837221962 那条"手臂"）。
   *
   * 手臂 = 一串首尾相接的矩形；"手指" = 某一步同时要试的分支数。
   * 实现上就是深度优先：放下一块，然后从它的右边缘/下边缘各派一个子任务；
   * 子任务如果能多派（周围有空隙），就用它。碎板子上同一位置的可用派生子任务
   * 更多 → fingers 更多，和原文"board fragmented → arm has more fingers"对上。
   */
  recursiveFill({ seed = 1, size = 14, minSize = 3, budget = 400 } = {}) {
    let s = seed | 0;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffff) / 0xffff; };
    const arm = [];
    let fingersTotal = 0;
    let n = 0;
    const step = (x, y, w, h, depth) => {
      if (n++ > budget || w < minSize || h < minSize) return;
      const slot = this.place('arm' + n, w, h, { attempts: 40, rng: rnd, snap: true });
      if (!slot) return;
      // 手指：这一块周围有几条不同方向的空闲叶边界可继续生长
      let fingers = 0;
      const probes = [[slot.x + slot.w, slot.y], [slot.x, slot.y + slot.h],
                      [slot.x + slot.w * 0.5, slot.y + slot.h], [slot.x + slot.w, slot.y + slot.h * 0.5]];
      for (const [px, py] of probes) if (this.canPlace(px, py, Math.max(minSize, w * 0.6), Math.max(minSize, h * 0.6))) fingers++;
      fingersTotal += fingers;
      arm.push({ ...slot, depth, fingers });
      if (depth > 40) return;
      // 主枝继续，副枝只在有手指时开（这就是"碎片多→手指多"的机制）
      step(slot.x + slot.w, slot.y, w * 0.72, h * 0.86, depth + 1);
      if (fingers >= 3) step(slot.x, slot.y + slot.h, w * 0.6, h * 0.6, depth + 1);
      if (fingers >= 4) step(slot.x + slot.w * 0.3, slot.y + slot.h, w * 0.5, h * 0.5, depth + 1);
    };
    step(0, 0, size, size, 0);
    return { arm, fingers: fingersTotal, avgFingers: arm.length ? fingersTotal / arm.length : 0 };
  }

  /** 占用率 + 碎片度。 */
  report() {
    const leaves = this.leaves();
    let free = 0, freeLeaves = 0, largest = 0;
    for (const n of leaves) {
      if (!n.used) { free += n.area; freeLeaves++; if (n.area > largest) largest = n.area; }
    }
    let used = 0;
    for (const p of this.placed.values()) used += p.w * p.h;
    return {
      placed: this.placed.size,
      leaves: leaves.length,
      usedArea: used,
      fill: used / (this.width * this.height),
      freeArea: free,
      freeLeaves,
      largestFree: largest,
      // 碎片度：**最大一块空闲**占全部空闲的比例。1.0 = 空闲区是一整块；
      // 越低越碎。原文那句"interlocked"就是这一项掉下去、而 fill 掉得不多。
      largestShare: free > 0 ? largest / free : 1,
      avgFreeLeaf: freeLeaves ? free / freeLeaves : 0,
      ...this.stats,
    };
  }
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

/** 对照基线：货架式（一行一行摆），证明"暴力撒点"确实值这个成本。 */
export function shelfPack(width, height, sizes) {
  let x = 0, y = 0, rowH = 0, used = 0, placed = 0;
  for (const [w, h] of sizes) {
    if (x + w > width) { x = 0; y += rowH; rowH = 0; }
    if (y + h > height) break;
    x += w; rowH = Math.max(rowH, h); used += w * h; placed++;
  }
  return { placed, fill: used / (width * height) };
}
