/**
 * modulecensus.js — "378 个模块覆盖所有情况"到底是多少情况：把邻居掩码按对称群约简
 *
 * ── 原文 ─────────────────────────────────────────────────────────────────
 *   1189109278361165825（2019-10-29）：
 *     "I'm happy to announce that at a count of 378 I've now built enough modules
 *      to cover all possible cases in whatever funky townscape you might want to
 *      build with this."
 *   1279107097108635649（2020-07-03）：
 *     "Here's a tour of the puzzle pieces that make up #Townscaper. To date, there
 *      are 545 of them."
 *
 *   两条加起来是一句**口径**：件（piece）545，模块（module）378，而 378 这个数之所以
 *   能"覆盖所有情况"，前提是**情况本身是有限的**，且作者对它做了对称约简。
 *   所以这条要落地的不是"再造 378 个模块"，是**把情况空间数清楚**：
 *   8 邻域掩码 256 种，在 D4（旋转 4 + 镜像 4）下只剩多少类。
 *
 * ── 画面观察（这两条片子本身给不出参数）────────────────────────────────
 *   1189 是一条 48 秒的密集城区环拍：颜色成片区（红块/绿块/蓝块挨着），不是每栋随机；
 *   1279 是"零件巡展"：545 个件散落在一块**线框网格平面**上，各自带 UV 调试色，
 *     没有对齐格子 —— 说明它是把所有件一次性 spawn 出来看的工具，不是真实场景。
 *   两条都拿不到"378"的构成，只能自己算。
 *
 * ── 为什么这样写 ────────────────────────────────────────────────────────
 *   ① **"情况数"必须给对称群，否则没有唯一答案。** 8 邻域的 256 种里，
 *      大部分互为旋转/镜像；作者说的"case"几乎肯定是约简后的类。
 *   ② **两个数不该相等，也不该硬凑。** 378 是他的**模块件数**（含屋顶/门窗/海岸等
 *      非邻居掩码的维度），不是掩码类数。所以这里只报"我这套拓扑下掩码类的真实数目"，
 *      再报一个"任取一座城，实际用到多少类"，让缺口自己显形。
 *   ③ **census 必须能被证伪**：给一座城，它会打印"用了几类 / 总共几类 / 最稀有的一类"，
 *      这些数字换一座城就该变。
 */

/**
 * 3×3 环上的 8 个邻居，按顺时针固定顺序（顺序一旦定下，掩码位就有意义）。
 * ⚠ 注意：**偶数下标是斜角，奇数下标才是 4 邻**（NW, N, NE, E, SE, S, SW, W）。
 *   第一版用 `i % 2 === 0` 取"4 邻"，取到的其实是四个斜角，于是 2×2 被标成"尽头 ×4"、
 *   1×5 长条被标成"独格 ×5" —— 标签全错，数字看着还挺像回事。
 */
export const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
export const EDGE = [1, 3, 5, 7];          // N, E, S, W 的位号
export const N = 1 << 1, E = 1 << 3, S = 1 << 5, W = 1 << 7;

/** D4 的 8 个变换，作用在 (x,z) 上。 */
export const D4 = [
  (x, z) => [x, z], (x, z) => [-z, x], (x, z) => [-x, -z], (x, z) => [z, -x],
  (x, z) => [-x, z], (x, z) => [x, -z], (x, z) => [z, x], (x, z) => [-z, -x],
];

/** 把掩码（bit i = RING[i] 有人）按某个 D4 变换重排，返回新掩码。 */
export function transformMask(mask, f) {
  const pos = new Map();
  for (let i = 0; i < RING.length; i++) if (mask & (1 << i)) pos.set(RING[i][0] + ',' + RING[i][1], 1);
  let out = 0;
  for (let i = 0; i < RING.length; i++) {
    const [x, z] = f(RING[i][0], RING[i][1]);
    if (pos.has(x + ',' + z)) out |= 1 << i;
  }
  return out;
}

/** 掩码的规范形（8 个变换里最小的那个）→ 用来做并查集/去重。 */
export function canonMask(mask) {
  let best = mask;
  for (const f of D4) {
    const t = transformMask(mask, f);
    if (t < best) best = t;
  }
  return best;
}

/**
 * 掩码空间 → 等价类。返回 { orbits, bySize }。
 * orbits: Map<canon, count>；bySize: 按"有几个邻居"分桶的类数。
 */
export function maskOrbits() {
  const orbits = new Map();
  for (let m = 0; m < 256; m++) {
    const c = canonMask(m);
    orbits.set(c, (orbits.get(c) || 0) + 1);
  }
  const bySize = {};
  for (const c of orbits.keys()) {
    const n = popcount(c);
    bySize[n] = (bySize[n] || 0) + 1;
  }
  return { orbits, bySize, total: orbits.size };
}

const popcount = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

/**
 * 一座城的普查。
 * town: Map<'x,z', {stories}>；相邻 = 面相邻（4 邻）。
 *
 * ⚠ 第一版把"模块"当成连通块，于是每座小城都只报 cases = 1 —— 因为任何连成一片的城
 *   本来就是一个连通块，"案"退化成"这座城有几个块"。那不是作者说的 module。
 *   现在拆成三个各自有意义的数：件数 / 连通块数 / **这片城实际用到的件级掩码类数**。
 *   后者才是能和 51 类比的那个量。
 */
export function census(town) {
  const seen = new Set();
  const modules = [];
  const has = (x, z) => town.has(x + ',' + z);
  for (const key of town.keys()) {
    if (seen.has(key)) continue;
    // BFS
    const stack = [key], comp = [];
    seen.add(key);
    while (stack.length) {
      const k = stack.pop();
      comp.push(k);
      const [x, z] = k.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = (x + dx) + ',' + (z + dz);
        if (town.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
      }
    }
    modules.push(comp);
  }
  // 件级掩码：只看水平 4 邻（bit 0/2/4/6），再做 D4 规范形
  const hist = new Map();
  for (const key of town.keys()) {
    const [x, z] = key.split(',').map(Number);
    let mask = 0;
    RING.forEach(([dx, dz], i) => { if (EDGE.includes(i) && has(x + dx, z + dz)) mask |= 1 << i; });
    const c = canonMask(mask);
    hist.set(c, (hist.get(c) || 0) + 1);
  }
  const sorted = [...hist.entries()].sort((a, b) => b[1] - a[1]);
  return {
    pieces: town.size,
    clusters: modules.length,
    pieceCases: hist.size,
    biggest: modules.reduce((a, b) => (b.length > a.length ? b : a), { length: 0 }).length,
    hist: sorted.map(([mask, n]) => ({ mask, n, label: maskLabel(mask) })),
  };
}

/** 把 4 邻掩码说成人话：独格 / 一头 / 拐角 / 夹在中间 / T / 四通 */
export function maskLabel(mask) {
  const n = EDGE.filter((b) => mask & (1 << b)).length;
  if (n === 0) return '独格';
  if (n === 1) return '尽头';
  if (n === 2) return ((mask & N) && (mask & S)) ? '直通 N-S' : ((mask & E) && (mask & W)) ? '直通 E-W' : '拐角';
  if (n === 3) return 'T 字';
  return '四通';
}

/** 造几座测试城：单格、2×2、L 形、长条、带湖的 5×5、6×6 甜甜圈 */
export function sampleTowns() {
  const mk = (cells) => new Map(cells.map(([x, z]) => [x + ',' + z, { stories: 1 }]));
  return {
    '单格': mk([[0, 0]]),
    '2×2': mk([[0, 0], [1, 0], [0, 1], [1, 1]]),
    'L 形': mk([[0, 0], [1, 0], [0, 1]]),
    '长条 1×5': mk([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]),
    '5×5 带湖': mk(Array.from({ length: 25 }, (_, i) => [i % 5, (i / 5) | 0]).filter(([x, z]) => !(x === 2 && z === 2))),
    '6×6 甜甜圈': mk(Array.from({ length: 36 }, (_, i) => [i % 6, (i / 6) | 0])
      .filter(([x, z]) => !(x >= 1 && x <= 4 && z >= 1 && z <= 4))),
  };
}
