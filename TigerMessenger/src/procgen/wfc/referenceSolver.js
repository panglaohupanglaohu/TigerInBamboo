// =====================================================================
//  ReferenceSolver — 慢速参考求解器 / oracle（V7-G3）
//  故意用朴素实现（数组 + 线性查找 + 不动点重扫，允许 O(A×B) 比较），
//  与快速 solver 的 BitSet/计数器实现相互独立，用于交叉验证：
//  · referenceArcClosure：朴素 AC 闭包（反复全图重扫直到不动点）。
//    快速 propagator 的最终可行域必须与之完全一致——这直接证明
//    快速 solver 没有错误删候选（也不多删）。
//  · referenceEnumerate：小网格穷举回溯（按 cell index 升序、variant
//    升序，逐点做 arc closure 前向检查），枚举全部解（带数量上限，
//    有限终止）。快速 solver 的解必须落在该集合中。
//  仅限小 fixture 使用；纯数据，禁止 import Three.js / DOM。
// =====================================================================

/**
 * 朴素 AC 闭包。
 * @param {object} graph 图适配器
 * @param {(direction:string)=>{has:(v:number)=>boolean}[]} compatibleFor
 *   方向 → 每 variant 的兼容集（只需提供 has(v) 查询；BitSet 天然满足）
 * @param {number} variantCount
 * @param {number[][]} domains 每 cell 候选 variant 升序数组（会被原地修改的副本由调用方负责）
 * @returns {{ ok:true, domains:number[][] } | { ok:false, emptyCell:number }}
 */
export function referenceArcClosure(graph, compatibleFor, variantCount, domains) {
  const cellCount = graph.cellCount;
  const compatCache = new Map();
  const compatOf = (dir) => {
    if (!compatCache.has(dir)) compatCache.set(dir, compatibleFor(dir));
    return compatCache.get(dir);
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let c = 0; c < cellCount; c++) {
      for (const edge of graph.neighborsOf(c)) {
        const compat = compatOf(edge.direction);
        const src = domains[c];
        const dst = domains[edge.to];
        const kept = [];
        for (const v of dst) {
          // v 有支持 ⟺ 源域中存在 u 使 compat[u] 含 v（朴素两两比较）
          let supported = false;
          for (const u of src) {
            if (compat[u].has(v)) {
              supported = true;
              break;
            }
          }
          if (supported) kept.push(v);
        }
        if (kept.length !== dst.length) {
          domains[edge.to] = kept;
          changed = true;
          if (kept.length === 0) return { ok: false, emptyCell: edge.to };
        }
      }
    }
  }
  return { ok: true, domains };
}

/** 便利：全候选初始域 */
export function fullDomains(cellCount, variantCount) {
  const all = [];
  for (let v = 0; v < variantCount; v++) all.push(v);
  const out = [];
  for (let i = 0; i < cellCount; i++) out.push(all.slice());
  return out;
}

/**
 * 小网格穷举求解（有限终止：递归深度 = cell 数，分支 = variant 数，
 * 且 maxSolutions 封顶）。
 * @param {object} opts
 * @param {object} opts.graph
 * @param {(direction:string)=>{has:(v:number)=>boolean}[]} opts.compatibleFor
 * @param {number} opts.variantCount
 * @param {Map<number,number>|Array<[number,number]>} [opts.pins] cellIndex → variant
 * @param {number} [opts.maxSolutions] 枚举上限（默认 10000）
 * @returns {{ solvable:boolean, solutionCount:number, solutions:number[][],
 *   steps:number, truncated:boolean }}
 */
export function referenceEnumerate({
  graph,
  compatibleFor,
  variantCount,
  pins = [],
  maxSolutions = 10000,
}) {
  const cellCount = graph.cellCount;
  const pinMap = pins instanceof Map ? pins : new Map(pins);
  const base = fullDomains(cellCount, variantCount);
  for (const [cell, variant] of pinMap) base[cell] = [variant];
  const solutions = [];
  let steps = 0;
  let truncated = false;

  const assignment = new Array(cellCount).fill(-1);
  // 稳定顺序：cell index 升序；每点候选 variant 升序
  const rec = (domains, nextCell) => {
    if (solutions.length >= maxSolutions) {
      truncated = true;
      return;
    }
    steps++;
    if (nextCell === cellCount) {
      solutions.push(assignment.slice());
      return;
    }
    for (const v of domains[nextCell]) {
      assignment[nextCell] = v;
      // 前向检查：arc closure（朴素，全量重扫）
      const next = domains.map((d) => d.slice());
      next[nextCell] = [v];
      const closed = referenceArcClosure(graph, compatibleFor, variantCount, next);
      if (closed.ok) rec(closed.domains, nextCell + 1);
      if (truncated) return;
    }
    assignment[nextCell] = -1;
  };

  const initial = referenceArcClosure(graph, compatibleFor, variantCount, base);
  if (initial.ok) rec(initial.domains, 0);
  return { solvable: solutions.length > 0, solutionCount: solutions.length, solutions, steps, truncated };
}
