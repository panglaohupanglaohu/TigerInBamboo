// =====================================================================
//  ConflictExplain — 结构化失败与近似最小冲突（V7-G3）
//  超上限 / 不可满足时返回结构化 failure：冲突 cell、决策路径、
//  hard locks、ban reasons、suggested relaxations。
//  ban provenance 链：从使冲突 cell 变空的 ban 记录出发，沿
//  "neighbor-support:from=<cell>" 的成因回溯相关 cell 的 ban，
//  生成近似最小相关冲突集（近似：按 trail 逆序沿 provenance 收集，
//  上限 CONFLICT_CHAIN_CAP 条）——不只报告第一个 empty cell。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/** provenance 链上限：近似最小冲突集的最大规模（有限终止保证） */
export const CONFLICT_CHAIN_CAP = 64;

/**
 * 生成结构化失败对象。
 * @param {object} ctx
 * @param {string} ctx.reason "unsatisfiable" | "max-backtrack" | "invalid-pin"
 * @param {number} ctx.cellIndex 冲突（空域）cell index；无则 -1
 * @param {WaveState} ctx.wave
 * @param {Trail} ctx.trail
 * @param {Backtracker} ctx.backtracker
 * @param {object[]} ctx.hardLocks pin 列表 [{cell, variant, source}]
 * @param {(v:number)=>string} ctx.variantKeyOf variant index → 稳定 key
 */
export function explainFailure({ reason, cellIndex, wave, trail, backtracker, hardLocks, variantKeyOf }) {
  const keyOf = (v) => (variantKeyOf ? variantKeyOf(v) : String(v));
  const cellId = cellIndex >= 0 ? wave.cellId(cellIndex) : null;

  // —— ban reasons：直接造成冲突 cell 空域的全部 ban（含来源） ——
  const banReasons = [];
  if (cellIndex >= 0) {
    for (const rec of trail.records) {
      if (rec.cellId === cellId) {
        banReasons.push({ variant: keyOf(rec.variant), reason: rec.reason, level: rec.level });
      }
    }
  }

  // —— provenance 链：沿 neighbor-support 的 from 成因回溯相关 cell ——
  // 近似最小：只收"直接/间接导致冲突 cell 候选被删"的 ban，按 trail 逆序去重。
  const chain = [];
  const seenKey = new Set();
  const visitQueue = cellIndex >= 0 ? [cellId] : [];
  while (visitQueue.length && chain.length < CONFLICT_CHAIN_CAP) {
    const target = visitQueue.shift();
    for (let i = trail.records.length - 1; i >= 0 && chain.length < CONFLICT_CHAIN_CAP; i--) {
      const rec = trail.records[i];
      if (rec.cellId !== target) continue;
      const key = `${rec.cellId}#${rec.variant}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      const entry = {
        cell: rec.cellId,
        variant: keyOf(rec.variant),
        reason: rec.reason,
        level: rec.level,
      };
      const from = parseProvenanceFrom(rec.reason);
      if (from) {
        entry.causedBy = from;
        if (!seenKey.has(`cell:${from.cell}`)) {
          seenKey.add(`cell:${from.cell}`);
          visitQueue.push(from.cell);
        }
      }
      chain.push(entry);
    }
  }

  // —— 结构化建议（启发式，全部来自真实记录，不编造） ——
  const suggestedRelaxations = [];
  if (hardLocks.length > 0) {
    suggestedRelaxations.push(
      `检查 hard lock 是否互相矛盾：${hardLocks.map((l) => `${l.cell}=${l.variant}`).join(", ")}`
    );
  }
  const supportBans = chain.filter((e) => e.reason.startsWith("neighbor-support"));
  if (supportBans.length > 0) {
    const last = supportBans[0];
    suggestedRelaxations.push(
      `方向 ${last.causedBy?.direction ?? "?"} 上 ${last.causedBy?.cell ?? "?"} → ${last.cell} 的 socket 无交集：` +
        `新增过渡模块或放宽该方向的 connector/parity 约束`
    );
  }
  if (reason === "max-backtrack") {
    suggestedRelaxations.push(
      `回溯已达上限 ${backtracker.maxBacktrack}：增大 profile.maxBacktrack，或在预处理阶段锁定更多 hard route`
    );
  }
  if (suggestedRelaxations.length === 0) {
    suggestedRelaxations.push("约束网络在当前模块集下不可满足：检查兼容表中是否存在孤立连接器");
  }

  return {
    ok: false,
    reason,
    cell: cellId,
    conflict: {
      emptyCell: cellId,
      banChain: chain, // 近似最小相关冲突（provenance 链，非仅第一个空 cell）
      involvedCells: [...new Set(chain.map((e) => e.cell))],
    },
    decisionPath: backtracker ? backtracker.decisionPath(variantKeyOf) : [],
    hardLocks: hardLocks.map((l) => ({ ...l })),
    banReasons,
    suggestedRelaxations,
  };
}

/** 从 reason 字符串解析 provenance（"neighbor-support:from=<cell>:dir=<d>"，dir 本身可含冒号） */
function parseProvenanceFrom(reason) {
  const PREFIX = "neighbor-support:from=";
  if (!reason.startsWith(PREFIX)) return null;
  const sep = reason.lastIndexOf(":dir=");
  if (sep < PREFIX.length) return null;
  return { cell: reason.slice(PREFIX.length, sep), direction: reason.slice(sep + 5) };
}
