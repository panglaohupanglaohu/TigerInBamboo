/**
 * occmask.js — 体素占据/合法性用**位集**做，再用两级（粗格 / 叶子）画出来看。
 *
 * 原文（794993371261665280）：无文字说明，只有一段 18.1 秒的屏幕录制。
 *
 * 画面观察（508×506, 18.1s, 24 帧全看）：
 *   · 场景是编辑器视图（灰底、网格面、"Gol" 按钮、光标可见），中间一座小岛模型。
 *   · 岛上与空气中散布着**白色细线框方盒**，大小不一、层层叠叠，明显是两级尺度：
 *     大盒子套小盒子，越往上越稀。
 *   · 另一组是**黄色小四边形**，密密地排在一个规则栅格上，但**有缺格** ——
 *     缺的那几格和白色盒子的位置对得上。也就是说白盒 = "这格被占了/不合法"，
 *     黄片 = "这格空着/可放"。
 *   · 3.2s 之后模型上方出现一组悬空的白色方块串（像被抬起来的一段结构），
 *     黄色栅格的数量随之变少 —— 这条是先有占用后有合法性，不是两套数据。
 *
 * 所以这条落地成：**一个 3 维位集占据表 + 一个粗化层**。粗化层不是为渲染好看，
 * 是为了"先问大格、再问小格"能把查询砍掉大半：一片 24×24 的空域里，
 * 真正被占的叶子可能只有百分之几，先看粗格能一次排除 8 格。
 *
 * 为什么用位集而不是 Set<string>：一条 24×16×24 的体素岛 = 9216 格，
 * 用 `"x,y,z"` 字符串当 Set 的键，光键的分配就比查询本身贵（见 lab 里的对照表）。
 * 位集的成本是 `(i*ny + j)*nz + k` 三次乘加 + 一次 `>>>5` 和一次 `&31`。
 */

const POP = new Uint8Array(256);
for (let i = 0; i < 256; i++) POP[i] = (i & 1) + POP[i >> 1];

export class OccMask {
  /**
   * @param {number} nx @param {number} ny @param {number} nz 叶子格数
   * @param {number} coarse 粗化倍数（默认 2 → 每 8 个叶子一格）
   */
  constructor(nx, ny, nz, coarse = 2) {
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.coarse = coarse;
    this.wx = Math.ceil(nx / 32);
    this.bits = new Uint32Array(this.wx * ny * nz);
    this.cx = Math.ceil(nx / coarse);
    this.cy = Math.ceil(ny / coarse);
    this.cz = Math.ceil(nz / coarse);
    this.cwx = Math.ceil(this.cx / 32);
    this.cbits = new Uint32Array(this.cwx * this.cy * this.cz);
    this.n = 0;      // 叶子占用数
    this.cn = 0;     // 粗格占用数
    this.coarseHits = 0; // 统计：有多少次查询被粗格直接否掉
    this.queries = 0;
  }

  _w(i, j, k) { return (i * this.ny + j) * this.wx + (k >> 5); }
  _b(k) { return 1 << (k & 31); }
  _cw(i, j, k) { return (i * this.cy + j) * this.cwx + (k >> 5); }

  has(i, j, k) {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return false;
    return (this.bits[this._w(i, j, k)] & this._b(k)) !== 0;
  }

  set(i, j, k, v = true) {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return this;
    const w = this._w(i, j, k), b = this._b(k);
    if (v) {
      if (this.bits[w] & b) return this;
      this.bits[w] |= b;
      this.n++;
      const c = this.coarse;
      const ci = (i / c) | 0, cj = (j / c) | 0, ck = (k / c) | 0;
      const cw = this._cw(ci, cj, ck), cb = this._b(ck);
      if (!(this.cbits[cw] & cb)) { this.cbits[cw] |= cb; this.cn++; }
    } else {
      if (!(this.bits[w] & b)) return this;
      this.bits[w] &= ~b;
      this.n--;
      // 粗格不做向下回收：只有整块 8 格都空了才降级。这里用一个查询判断，
      // 而不是让 set(false) 变成 O(8) 的扫描 —— 实际跑起来 8 次的代价比这更贵。
      const c = this.coarse;
      const ci = (i / c) | 0, cj = (j / c) | 0, ck = (k / c) | 0;
      let any = false;
      for (let a = 0; a < c && !any; a++)
        for (let b2 = 0; b2 < c && !any; b2++)
          for (let d = 0; d < c; d++) if (this.has(ci * c + a, cj * c + b2, ck * c + d)) { any = true; break; }
      if (!any) {
        const cw = this._cw(ci, cj, ck), cb = this._b(ck);
        if (this.cbits[cw] & cb) { this.cbits[cw] &= ~cb; this.cn--; }
      }
    }
    return this;
  }

  /**
   * 两级查询：先粗后细。粗格空 → 直接 false（一次移位一次与）。
   * 这是这条片子唯一能"量"出来的一点：排除率。
   */
  has2(i, j, k) {
    this.queries++;
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return false;
    const c = this.coarse;
    const ci = (i / c) | 0, cj = (j / c) | 0, ck = (k / c) | 0;
    if (!(this.cbits[this._cw(ci, cj, ck)] & this._b(ck))) { this.coarseHits++; return false; }
    return (this.bits[this._w(i, j, k)] & this._b(k)) !== 0;
  }

  /** 32 位整字 popcount，借 POP 表；比逐位循环快 4~5 倍。 */
  count() {
    let n = 0;
    for (let i = 0; i < this.bits.length; i++) {
      const v = this.bits[i];
      n += POP[v & 255] + POP[(v >> 8) & 255] + POP[(v >> 16) & 255] + POP[v >>> 24];
    }
    return n;
  }

  /** 粗格列表 —— 片子里那批"白色线框大盒"。 */
  coarseCells() {
    const out = [];
    const c = this.coarse;
    for (let i = 0; i < this.cx; i++)
      for (let j = 0; j < this.cy; j++)
        for (let k = 0; k < this.cz; k++)
          if (this.cbits[this._cw(i, j, k)] & this._b(k)) out.push({ i, j, k, s: c });
    return out;
  }

  /** 叶子格列表 —— 片子里那批"黄色小片"，max 只是防止一次画太多。 */
  leafCells(max = 4000) {
    const out = [];
    for (let i = 0; i < this.nx; i++)
      for (let j = 0; j < this.ny; j++)
        for (let k = 0; k < this.nz; k++)
          if (this.bits[this._w(i, j, k)] & this._b(k)) {
            out.push({ i, j, k });
            if (out.length >= max) return out;
          }
    return out;
  }

  /** 空位（可放东西的地方）—— 黄片画的是"空的"那半边。 */
  freeCells(max = 4000) {
    const out = [];
    for (let i = 0; i < this.nx; i++)
      for (let j = 0; j < this.ny; j++)
        for (let k = 0; k < this.nz; k++)
          if (!(this.bits[this._w(i, j, k)] & this._b(k))) {
            out.push({ i, j, k });
            if (out.length >= max) return out;
          }
    return out;
  }
}

/**
 * 同内容用 Set<string> 存一份，只为了在 lab 里做**同机位对照**。
 * 这不是"更差的实现"，是"最容易先写出来的实现"——很多人第一步就这么写。
 */
export function buildSetMirror(mask) {
  const s = new Set();
  const cells = mask.leafCells(1e9);
  for (const c of cells) s.add(c.i + ',' + c.j + ',' + c.k);
  return s;
}

/** 随机查询 N 次，返回 ns/次。两边用同一批坐标，避免缓存命中率不同带来的偏差。 */
export function bench(mask, set, n = 200000) {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const q = new Int32Array(n * 3);
  for (let t = 0; t < n; t++) {
    q[t * 3] = (rnd() * mask.nx) | 0;
    q[t * 3 + 1] = (rnd() * mask.ny) | 0;
    q[t * 3 + 2] = (rnd() * mask.nz) | 0;
  }
  // 预热
  for (let t = 0; t < 2000; t++) { mask.has2(q[t * 3], q[t * 3 + 1], q[t * 3 + 2]); }

  const t0 = performance.now();
  let hit1 = 0;
  for (let t = 0; t < n; t++) if (mask.has2(q[t * 3], q[t * 3 + 1], q[t * 3 + 2])) hit1++;
  const t1 = performance.now();

  const t2 = performance.now();
  let hit2 = 0;
  for (let t = 0; t < n; t++) if (set.has(q[t * 3] + ',' + q[t * 3 + 1] + ',' + q[t * 3 + 2])) hit2++;
  const t3 = performance.now();

  return {
    bitsetNs: ((t1 - t0) * 1e6) / n,
    setNs: ((t3 - t2) * 1e6) / n,
    hits: [hit1, hit2],
    exclude: mask.queries ? mask.coarseHits / mask.queries : 0,
  };
}

/**
 * 造一座"岛"的占据：高度场 + 塔。形状照着片子里那个小岛 —— 一坨宽的底座，
 * 加两三根细高的塔。不是为了像，是为了让粗格排除率落在一个真实区间里
 * （全空/全满的极端形状量出来的排除率没有意义）。
 */
export function makeIsland(nx, ny, nz, rng = Math.random) {
  const m = new OccMask(nx, ny, nz, 2);
  const cx = nx / 2, cz = nz / 2;
  const hAt = (i, k) => {
    const dx = (i - cx) / (nx * 0.34), dz = (k - cz) / (nz * 0.30);
    const r = dx * dx + dz * dz;
    const base = Math.max(0, 1 - r) * ny * 0.42;
    return Math.round(base + Math.sin(i * 0.7) * 0.5 + Math.cos(k * 0.55) * 0.5);
  };
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++) {
      const h = hAt(i, k);
      for (let j = 0; j < Math.min(ny, h); j++) m.set(i, j, k);
    }
  // 两根塔
  const towers = [[0.42, 0.38, 6], [0.62, 0.62, 8]];
  for (const [ui, uk, hh] of towers) {
    const ti = Math.round(ui * nx), tk = Math.round(uk * nz);
    for (let i = ti; i < ti + 3; i++)
      for (let k = tk; k < tk + 3; k++)
        for (let j = 0; j < Math.min(ny, hh); j++) m.set(i, j, k);
  }
  return m;
}
