// =====================================================================
//  Trail — WFC ban 轨迹与决策层回滚（V7-G1）
//  回溯只回放 trail，不复制整张 wave。每条记录含被 ban 的
//  (cell, variant, 之前的 sumW/sumWLogW/count, reason, decision level)。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/**
 * 决策点：观察某 cell 时的 wave 上下文快照锚。
 * 不复制 domain——domain 恢复靠回放 trail 中的 undo 信息。
 */
export class ChoicePoint {
  constructor(cellId, trailOffset, remainingCount, rngState) {
    this.cellId = cellId;
    this.trailOffset = trailOffset; // 决策前 trail 长度
    this.remainingCount = remainingCount; // 观察前候选数（含被选者）
    this.rngState = rngState; // StableRng.exportState()
  }
}

export class Trail {
  constructor() {
    /** @type {{cellId:string|number, variant:number, prevSumW:number, prevSumWLogW:number, prevCount:number, reason:string, level:number}[]} */
    this.records = [];
    this.level = 0; // 当前决策层
  }

  get length() {
    return this.records.length;
  }

  /**
   * 记录一次 ban。
   * @param {object} undoInfo { prevSumW, prevSumWLogW, prevCount } — ban 前的聚合量
   * @param {string} reason "observation" | "neighbor-support" | "backtrack" | ...
   */
  push(cellId, variant, undoInfo, reason) {
    this.records.push({
      cellId,
      variant,
      prevSumW: undoInfo.prevSumW,
      prevSumWLogW: undoInfo.prevSumWLogW,
      prevCount: undoInfo.prevCount,
      reason,
      level: this.level,
    });
    return this;
  }

  /** 进入新决策层（观察一个 cell） */
  enterLevel() {
    this.level++;
  }

  /**
   * 回滚到 offset（某 choice point 的 trailOffset）：
   * 逆序回放记录，把 prevSumW/sumWLogW/count 恢复给调用方提供的恢复回调。
   * @param {number} offset 目标 trail 长度
   * @param {(cellId, variant, undoInfo) => void} restoreCell 单 cell 聚合量恢复钩子
   */
  undoTo(offset, restoreCell) {
    while (this.records.length > offset) {
      const rec = this.records.pop();
      restoreCell(rec.cellId, rec.variant, {
        prevSumW: rec.prevSumW,
        prevSumWLogW: rec.prevSumWLogW,
        prevCount: rec.prevCount,
      });
      this.level = Math.min(this.level, rec.level);
    }
    return this;
  }

  clear() {
    this.records.length = 0;
    this.level = 0;
  }

  /** 导出诊断切片（不进热循环） */
  describe(limit = 32) {
    return this.records.slice(-limit).map((r) => ({
      cell: r.cellId,
      variant: r.variant,
      reason: r.reason,
      level: r.level,
    }));
  }
}
