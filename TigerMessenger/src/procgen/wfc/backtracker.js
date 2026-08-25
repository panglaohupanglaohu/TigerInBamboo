// =====================================================================
//  Backtracker — choice point 栈与限界回溯（V7-G3）
//  每个 choice point 记录：cell、所选 variant（冲突后成为 failed
//  variant）、观察前的 remaining domain（BitSet 克隆）、trail offset、
//  RNG state。回溯只回放 trail（undoTo），不复制整张 wave；随后把失败
//  variant 以 "backtrack" 原因重新 ban 掉，让下一次观察在同 cell 的
//  剩余候选中继续选择。
//  上限语义：局部编辑默认 maxBacktrack=32（DEFAULT_MAX_BACKTRACK）；
//  完整生成由 profile.maxBacktrack 指定但必须为有限正整数。超过上限
//  返回 exceeded，由 solver 转成结构化 failure，绝不做无上限 restart。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/** 局部编辑默认回溯上限（PLAN 11.6 / TODO V7-G3） */
export const DEFAULT_MAX_BACKTRACK = 32;

/**
 * 解析回溯上限：显式 maxBacktrack > profile.maxBacktrack > 默认 32。
 * 任何路径都必须得到有限正整数，否则抛错（禁止无界搜索）。
 */
export function resolveMaxBacktrack({ maxBacktrack, profile } = {}) {
  const v = maxBacktrack ?? profile?.maxBacktrack ?? DEFAULT_MAX_BACKTRACK;
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`maxBacktrack 必须是有限正整数，got ${v}`);
  }
  return Math.floor(v);
}

export class Backtracker {
  /** @param {number} maxBacktrack 有限正整数（由 resolveMaxBacktrack 规范化） */
  constructor(maxBacktrack) {
    this.maxBacktrack = maxBacktrack;
    /** @type {object[]} choice point 栈（顶 = 最近决策） */
    this.stack = [];
    /** @type {object[]} 已被回溯弹出的决策（含 failedVariant，供决策路径诊断） */
    this.history = [];
    this.backtrackCount = 0;
  }

  /**
   * 观察一个 cell 前建立 choice point。
   * @param {WaveState} wave
   * @param {number} cellIndex
   * @param {Trail} trail
   * @param {StableRng} rng
   */
  beginChoice(wave, cellIndex, trail, rng) {
    trail.enterLevel();
    const cp = {
      cellIndex,
      cellId: wave.cellId(cellIndex),
      chosenVariant: -1, // observe 后由 solver 回填；冲突时即 failedVariant
      remainingDomain: wave.domain(cellIndex).clone(), // 观察前的完整候选域
      remainingCount: wave.count(cellIndex),
      trailOffset: trail.length, // 决策前 trail 长度（回滚锚点）
      rngState: rng.exportState(), // 决策前 RNG state（可精确恢复）
    };
    this.stack.push(cp);
    return cp;
  }

  /**
   * 冲突时回退到最近一个还有替代候选的决策层：
   * 回放 trail 到该 choice point 的 offset、恢复 RNG state，
   * 然后把该层已失败的 variant 以 "backtrack" 原因 ban 掉。
   * @returns
   *   { ok:true, cellIndex, failedVariant, restoredCells:number[] } —— 已恢复并 ban；
   *   { exceeded:true, conflict } —— 超过 maxBacktrack；
   *   null —— 决策栈耗尽（问题不可满足）。
   */
  undoToAlternative(wave, trail, rng) {
    if (this.backtrackCount >= this.maxBacktrack) return { exceeded: true };
    const cp = this.stack.pop();
    if (!cp) return null;
    this.backtrackCount++;
    cp.failedVariant = cp.chosenVariant;
    this.history.push(cp);
    // 只回放 trail：恢复全部被 ban 的候选与聚合量/版本戳
    const restored = [];
    trail.undoTo(cp.trailOffset, (cellId, variant, undoInfo) => {
      const idx = wave.restoreFromTrail(cellId, variant, undoInfo);
      restored.push(idx);
    });
    rng.restoreState(cp.rngState);
    // ban 掉本层失败的选择，下次观察在同一剩余域中另选
    wave.ban(cp.cellIndex, cp.failedVariant, trail, "backtrack");
    return {
      ok: true,
      cellIndex: cp.cellIndex,
      cellId: cp.cellId,
      failedVariant: cp.failedVariant,
      restoredCells: restored,
    };
  }

  /** 决策路径（当前栈 + 已回溯历史，按时间序），供结构化 failure */
  decisionPath(variantKeyOf) {
    const keyOf = (v) => (variantKeyOf ? variantKeyOf(v) : String(v));
    const live = this.stack.map((cp) => ({
      cell: cp.cellId,
      chosenVariant: keyOf(cp.chosenVariant),
      remainingCount: cp.remainingCount,
      status: "active",
    }));
    const done = this.history.map((cp) => ({
      cell: cp.cellId,
      chosenVariant: keyOf(cp.chosenVariant),
      failedVariant: keyOf(cp.failedVariant),
      remainingCount: cp.remainingCount,
      status: "backtracked",
    }));
    return [...done, ...live];
  }
}
