// =====================================================================
//  注入式种子随机源（P0 · 高山城堡攻防 V2）
//  - mulberry32：32 位种子 → [0,1) 均匀序列，同 seed 必同序列
//  - 攻防关键逻辑一律经 createRng(seed) 注入，禁止直接 Math.random()
//  - 纯数据模块，不依赖 three，Node 测试可直接 import
// =====================================================================

/** mulberry32 PRNG。seed 为任意有限数；返回 () => [0,1) */
export function createRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed: seed >>> 0,
    next,
    /** [min, max) 均匀浮点 */
    range: (min, max) => min + next() * (max - min),
    /** [min, max] 整数（含两端） */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** 以概率 p 返回 true */
    chance: (p) => next() < p,
    /** 从数组均匀取一个元素 */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** 按 tick/标签派生互不干扰的子源（PLAN V4 固定步长契约） */
    fork: (label = 0) => {
      const extra =
        typeof label === "number" && Number.isFinite(label)
          ? label >>> 0
          : seedFromString(String(label));
      return createRng(((a ^ extra ^ 0x9e3779b9) >>> 0) || 1);
    },
    /** 稳定洗牌（Fisher–Yates，同序列同排列） */
    shuffle: (arr) => stableShuffle(arr, { next }),
  };
}

/**
 * 由字符串生成稳定 32 位种子（FNV-1a）。
 * 用于 "harbor-crane" 这类命名子随机源，避免字符串 seed 四处手写散列。
 */
export function seedFromString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 命名子随机源：同一母 seed 下各子序列互不干扰且可复现 */
export function deriveRng(parentSeed, name) {
  return createRng(((parentSeed >>> 0) ^ seedFromString(name)) >>> 0);
}

/** FNV-1a 十六进制指纹（canonical hash / 重放比对） */
export function hashHex(str) {
  return seedFromString(String(str)).toString(16).padStart(8, "0");
}

/**
 * 稳定洗牌：同 rng 序列必得同一排列；不修改入参。
 * @template T
 * @param {T[]} arr
 * @param {{ next: () => number }} rng
 */
export function stableShuffle(arr, rng) {
  const out = arr.slice();
  const next = rng.next;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
