// =====================================================================
//  Compatibility Table — compatible[direction][variant] -> BitSet（V7-G2）
//  兼容判据（不止 connector 字符串相等）：
//    1. connector 相等且非 "boundary"（boundary 只与 graph 边界匹配）；
//    2. parity 互补：normal↔flipped 或 symmetric↔symmetric；
//    3. 显式 neighbor exclusion（variantA.faces[dir].excludedNeighbors / rules.excludes）；
//    4. walkable-neighbor 要求：A 面 walkable ⇒ B 对面 face 必须也 walkable。
//  同时编译 opposite direction；对称性由断言保证。
//  dead variant（非 boundary variant 在声明方向无任何邻居）构建时直接报错。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

import { BitSet } from "../core/bitSet.js";
import { OPPOSITE_FACE } from "./orientationGroup.js";

/**
 * @param {object} compiled compileVariants() 的输出
 * @param {object} [opts]
 * @param {"throw"|"report"} [opts.onDeadVariant] 缺省 "throw"
 */
export function compileCompatibilityTable(compiled, opts = {}) {
  const { variants } = compiled;
  const n = variants.length;
  const onDead = opts.onDeadVariant || "throw";
  const directions = ["N", "E", "S", "W", "U", "D"];
  const dead = [];

  // compatible[dir][vi] = BitSet（与 variant vi 在 dir 方向相邻时合法的邻居集）
  const compatible = {};
  for (const dir of directions) {
    compatible[dir] = new Array(n);
    for (let i = 0; i < n; i++) compatible[dir][i] = new BitSet(n, false);
  }

  for (let a = 0; a < n; a++) {
    const va = variants[a];
    for (const dir of Object.keys(va.faces)) {
      const faceA = va.faces[dir];
      if (faceA.connector === "boundary") continue;
      const oppDir = OPPOSITE_FACE[dir];
      for (let b = 0; b < n; b++) {
        const vb = variants[b];
        const faceB = vb.faces[oppDir];
        if (!faceB) continue; // 对方未声明该面（如 2D 模块无 U/D）
        if (!facesCompatible(faceA, faceB, va, vb)) continue;
        compatible[dir][a].set(b);
        compatible[oppDir][b].set(a);
      }
    }
  }

  // dead variant 检测：每个声明了非 boundary 面的 variant，至少在一个方向有邻居
  for (let a = 0; a < n; a++) {
    const va = variants[a];
    const declaredDirs = Object.keys(va.faces).filter((d) => va.faces[d].connector !== "boundary");
    if (declaredDirs.length === 0) continue; // 全 boundary：合法（专用边界模块）
    let anyNeighbor = false;
    for (const dir of declaredDirs) {
      if (compatible[dir][a].popcount() > 0) {
        anyNeighbor = true;
        break;
      }
    }
    if (!anyNeighbor) dead.push({ key: va.key, declaredDirs });
  }
  if (dead.length > 0 && onDead === "throw") {
    throw new Error(`dead variants (no neighbor in any declared direction): ${dead.map((d) => d.key).join(", ")}`);
  }

  return {
    directions,
    compatible,
    deadVariants: dead,
    /** 便利查询 */
    isCompatible(variantAIndex, direction, variantBIndex) {
      return compatible[direction][variantAIndex].has(variantBIndex);
    },
    /** 邻居 BitSet（勿修改：共享引用） */
    neighborsOf(variantIndex, direction) {
      return compatible[direction][variantIndex];
    },
    stats: compatStats(compiled, compatible, directions, n),
  };
}

function facesCompatible(faceA, faceB, va, vb) {
  // 1. 连接器匹配（boundary 已在外层排除）
  if (faceA.connector !== faceB.connector) return false;
  // 2. parity 互补
  const pa = faceA.parity || "normal";
  const pb = faceB.parity || "normal";
  if (pa === "symmetric" || pb === "symmetric") {
    if (pa !== pb) return false;
  } else if (pa === pb) {
    return false; // normal-normal / flipped-flipped 不咬合
  }
  // 3. 显式排除
  const exA = faceA.excludedNeighbors || [];
  const exB = faceB.excludedNeighbors || [];
  const rulesA = va.rules?.excludes || [];
  const rulesB = vb.rules?.excludes || [];
  if (exA.includes(vb.protoId) || exB.includes(va.protoId)) return false;
  if (rulesA.includes(vb.protoId) || rulesB.includes(va.protoId)) return false;
  // 4. walkable 连续性：A 侧可走 ⇒ B 侧必须可走
  if (faceA.walkable && !faceB.walkable) return false;
  if (faceB.walkable && !faceA.walkable) return false;
  return true;
}

/** 兼容性统计（供 compatibility-report.json） */
function compatStats(compiled, compatible, directions, n) {
  const variants = compiled.variants;
  const density = {};
  for (const dir of directions) {
    let edges = 0;
    for (let i = 0; i < n; i++) edges += compatible[dir][i].popcount();
    density[dir] = edges;
  }
  // 强连通分量（变体级，Kosaraju 简化版：无向视角连通块）
  const seen = new Array(n).fill(false);
  let components = 0;
  const adjOf = (i) => {
    const out = [];
    for (const dir of directions) {
      compatible[dir][i].forEachSetBit((j) => out.push(j));
    }
    return out;
  };
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    components++;
    const stack = [i];
    seen[i] = true;
    while (stack.length) {
      const cur = stack.pop();
      for (const j of adjOf(cur)) {
        if (!seen[j]) {
          seen[j] = true;
          stack.push(j);
        }
      }
    }
  }
  // 稀有 socket：每个 connector 名的平均兼容对数
  const socketUse = new Map();
  for (const v of variants) {
    for (const face of Object.values(v.faces)) {
      const c = face.connector;
      if (c === "boundary") continue;
      socketUse.set(c, (socketUse.get(c) || 0) + 1);
    }
  }
  return {
    variantCount: n,
    directionDensity: density,
    components,
    socketUse: Object.fromEntries([...socketUse.entries()].sort()),
    deadVariantCount: 0, // 由上层填 deadVariants.length
  };
}

/**
 * 任意方向 token 的兼容表（V7-G4 HalfEdgeGraph SimpleTiled）。
 * 共享边两侧使用同一 token（无 N/S 反向面概念），parity 互补规则不变；
 * faces 以 token 为键。dead variant（在所有 token 上都无邻居）默认报错。
 * @param {object[]} variants [{ key, protoId, weight, faces, rules }]
 * @param {string[]} tokens 方向 token 列表（边类别）
 */
export function compileTokenCompatibilityTable(variants, tokens, opts = {}) {
  const n = variants.length;
  const onDead = opts.onDeadVariant || "throw";
  const compatible = {};
  for (const token of tokens) {
    compatible[token] = new Array(n);
    for (let i = 0; i < n; i++) compatible[token][i] = new BitSet(n, false);
  }
  for (let a = 0; a < n; a++) {
    for (const token of tokens) {
      const faceA = variants[a].faces?.[token];
      if (!faceA || faceA.connector === "boundary") continue;
      for (let b = 0; b < n; b++) {
        const faceB = variants[b].faces?.[token];
        if (!faceB || faceB.connector === "boundary") continue;
        if (!facesCompatible(faceA, faceB, variants[a], variants[b])) continue;
        compatible[token][a].set(b);
      }
    }
  }
  const dead = [];
  for (let a = 0; a < n; a++) {
    const declared = tokens.filter((t) => variants[a].faces?.[t] && variants[a].faces[t].connector !== "boundary");
    if (declared.length === 0) continue;
    if (!declared.some((t) => compatible[t][a].popcount() > 0)) dead.push({ key: variants[a].key, declaredDirs: declared });
  }
  if (dead.length > 0 && onDead === "throw") {
    throw new Error(`dead variants (no neighbor in any declared direction): ${dead.map((d) => d.key).join(", ")}`);
  }
  return {
    directions: [...tokens],
    compatible,
    deadVariants: dead,
    isCompatible(a, direction, b) {
      return compatible[direction][a].has(b);
    },
    neighborsOf(variantIndex, direction) {
      return compatible[direction][variantIndex];
    },
  };
}
