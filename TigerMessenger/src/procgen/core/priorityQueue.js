// =====================================================================
//  PriorityQueue — 带版本戳的最低熵堆（V7-G1）
//  陈旧 entry（version 落后于 wave 的 entropyVersion）在 pop 时被静默
//  丢弃，不产生回放差异：确定性只由 (priority, cellId) 决定。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/**
 * 二叉最小堆 + 版本戳校验。
 * entry = { cellId, priority, version }。
 * popValid(waveVersion)：丢弃 version < waveVersion 的陈旧项后返回有效项。
 */
export class VersionedMinHeap {
  constructor() {
    /** @type {{cellId:number|string, priority:number, version:number}[]} */
    this.heap = [];
    this._idSeq = 0; // 同 priority tie-break 的稳定序（插入序）
  }

  get size() {
    return this.heap.length;
  }

  /**
   * @param {number|string} cellId 稳定 cell ID
   * @param {number} priority 越小越先出（熵小者先观察）
   * @param {number} version 该 priority 计算时的 wave 版本
   */
  push(cellId, priority, version) {
    const entry = {
      cellId,
      priority: Number.isFinite(priority) ? priority : Infinity,
      version,
      _seq: this._idSeq++,
    };
    const h = this.heap;
    h.push(entry);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (compareEntry(h[i], h[p]) < 0) {
        const t = h[i];
        h[i] = h[p];
        h[p] = t;
        i = p;
      } else break;
    }
    return entry;
  }

  /**
   * 弹出最小有效项；陈旧项（version < currentVersion）被丢弃。
   * @param {number} currentVersion 当前 wave 的 entropy 版本
   * @returns 有效 entry 或 null
   */
  popValid(currentVersion) {
    const h = this.heap;
    while (h.length > 0) {
      const top = h[0];
      const last = h.pop();
      if (h.length > 0) {
        h[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < h.length && compareEntry(h[l], h[m]) < 0) m = l;
          if (r < h.length && compareEntry(h[r], h[m]) < 0) m = r;
          if (m === i) break;
          const t = h[i];
          h[i] = h[m];
          h[m] = t;
          i = m;
        }
      }
      if (top.version >= currentVersion) return top;
      // 陈旧 entry 丢弃（其 priority 已过时，重新 push 由调用方负责）
    }
    return null;
  }

  clear() {
    this.heap.length = 0;
  }
}

/** 全序比较：priority → 插入序（同 priority 稳定，禁止随机 tie-break） */
function compareEntry(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a._seq - b._seq;
}
