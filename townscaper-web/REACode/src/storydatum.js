/**
 * storydatum.js — 楼层线不属于某一栋楼，属于**整座城的标高网格**。
 *
 * 帖子 ID：803190517534248960（2016-11-28，无原文字，仅有视频）
 *   画面：青绿墙面 + 红瓦压顶的一组塔楼坐在灰石台基上；每层楼之间都有一道白色挑檐，
 *   而这些白线在**不同的塔之间是同一高度**——塔基不在一个平面上，挑檐照样横着连成一条。
 *
 * 帖子 ID：806856212260278272（2016-12-08，无原文字，仅有视频）
 *   画面：橙红砖塔群，同样一层一道白檐；两座塔基差着半层高，檐线仍然对齐。
 *
 * 原文：两条都是 2016 老片，只有视频。所以这里记的是从画面读出来的做法，不是引述：
 * 楼层线 y = k × 层高（全局整数 k），而不是 y = 塔基 + m × 层高。
 *
 * 为什么这么做：这是"一堆各自长出来的塔看起来是一座城"的原因。塔基随地形高低不平，
 * 如果每栋自己从基座往上数层，白檐就会跟着基座一格一格错开，整片立面变成锯齿；
 * 把标高交给全局网格以后，塔基在哪都无所谓，檐线天然连成水平长线。
 * 代价也很直接：塔顶不能随便定高，必须落在 grid 线上——所以顶层那一层会被截短（实测每栋少 0.65~1.95，
 * 不到一层），想多一层就得整层往上抬。
 *
 * 于是可以量的东西：
 *   - 檐线落在 k×H 上的偏差（datum 模式恒 0，local 模式最大 = 基座错位量）；
 *   - 全局不同檐高的数量（datum 模式 = 楼层数，local 模式 = 塔数 × 楼层数，几乎全不重样）；
 *   - 有多少条檐线被 ≥2 座塔共用（"横着连成一条"的量化）。
 */

export const STOREY_H = 2.6;
export const CORNICE = 0.30;   // 挑檐外挑
export const CORNICE_T = 0.12; // 挑檐厚（半高）

/** 确定性 PRNG：同一 seed 每次跑出同一座城。 */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 台地剖面：城市建在阶梯地形上，台阶高 **故意不是** 层高的整数分之一（0.65 = H/4），
 * 这样"每栋自己数层"的错误做法才会真的错开，而不是碰巧对齐。
 */
export const TERRACE = 0.65;

export function terrainBase(i) {
  const steps = [3, 2, 1, 0, 1, 2];
  return steps[i % steps.length] * TERRACE;
}

/**
 * 造一排塔。
 * mode='datum' → 檐线吸附到全局 k×层高；mode='local' → 从各自塔基往上累加（对照用）。
 */
export function buildTowers({ mode = 'datum', seed = 7, count = 6 } = {}) {
  const rnd = mulberry32(seed);
  const towers = [];
  for (let i = 0; i < count; i++) {
    const base = terrainBase(i);
    const w = 1.9 + rnd() * 1.1;
    const floors = 2 + Math.floor(rnd() * 3);       // 2~4 层
    const x = i * 2.55;

    let bands = [];
    let top;
    if (mode === 'datum') {
      // 全局网格：第一个 ≥ base+0.8 的 k×H 起，到 base+floors×H 为止
      const k0 = Math.ceil((base + 0.8) / STOREY_H);
      const want = base + floors * STOREY_H;
      for (let k = k0; k * STOREY_H <= want + 1e-9; k++) bands.push(k * STOREY_H);
      top = bands.length ? bands[bands.length - 1] : Math.ceil((base + 1) / STOREY_H) * STOREY_H;
    } else {
      for (let m = 1; m <= floors; m++) bands.push(base + m * STOREY_H);
      top = base + floors * STOREY_H;
    }
    towers.push({ i, x, w, base, floors, bands, top });
  }
  return towers;
}

const r2 = (v) => Math.round(v * 100) / 100;

/** 量这套立面：檐线是否连成水平长线。 */
export function measureFacade(towers) {
  const levels = [];
  for (const t of towers) for (const y of t.bands) levels.push(r2(y));
  const uniq = [...new Set(levels)].sort((a, b) => a - b);

  // 每条檐高被几座塔共用
  const users = new Map();
  for (const t of towers) {
    for (const y of new Set(t.bands.map(r2))) {
      users.set(y, (users.get(y) ?? 0) + 1);
    }
  }
  const sharedLevels = [...users.entries()].filter(([, n]) => n >= 2).length;
  const maxShared = Math.max(0, ...users.values());

  // 相对全局网格的偏差
  let maxDev = 0;
  for (const y of levels) {
    const dev = Math.abs(y - Math.round(y / STOREY_H) * STOREY_H);
    maxDev = Math.max(maxDev, Math.min(dev, STOREY_H - dev));
  }

  const bandTotal = levels.length;
  return {
    towers: towers.length,
    bandTotal,
    distinctLevels: uniq.length,
    sharedLevels,
    maxShared,
    maxDevFromGrid: maxDev,
    levels: uniq,
    // 平均每层被几座塔共用：1.0 = 谁也不挨谁，>1 = 檐线在塔间连成一条
    reuse: bandTotal / uniq.length,
    // 塔顶实际落在 grid 线上，跟「想要的层数」差多少（负 = 顶层被截短，单位米）
    topFill: towers.map((t) => r2(t.top - (t.base + t.floors * STOREY_H))),
  };
}

/** 每座塔该开几排窗：檐与檐之间一排，datum 模式下最底层可能太薄，跳过。 */
export function windowRows(t) {
  const rows = [];
  for (let i = 0; i < t.bands.length; i++) {
    const lo = i === 0 ? t.base : t.bands[i - 1];
    const hi = t.bands[i];
    if (hi - lo > 1.0) rows.push((lo + hi) * 0.5);
  }
  return rows;
}
