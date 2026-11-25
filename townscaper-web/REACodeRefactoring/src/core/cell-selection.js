/**
 * cell-selection.js — 编辑器「选中态」（格子集合）的纯逻辑体。
 *
 * 片 1120036868966502401（703 帧 / 14.63fps / 48.1s，"It's marching squares on irregular
 * quadrilateral grids"）里那块白格网**只画在「正在编辑的对象」上**：frame-0300 补丁包住一栋房子、
 * 0445 包住另一处、0620 移到高台上 —— 补丁位置逐段跟着选中对象跑，同时画面里还有红/蓝两种
 * 选择轮廓（红=跨多格的组合，蓝=单格）。第 94–98 轮把「选中态 → 包围盒 → 补丁窗口」这条路
 * 在 `quad-lattice.js#selectionBounds` / `view.setGridWindowForSelection` 里做完了，但选中态本身
 * 一直靠外部手灌（测试里写死），本仓编辑器没有「选中」这件事 —— note 里挂了几轮的
 * 「仍缺与真编辑器撤销/多选联动」说的就是这一层。
 *
 * 这里只做账本，不碰 three、不碰 DOM、不碰键盘：
 *   · 一个有序去重的格子 id 集合（点选 = 单个，Shift/⌘ 点 = 加减 = 多选）；
 *   · `prune(valid)`：世界变了以后把已经不存在的格子剔掉（撤销/清空/拆到没顶层都会走到这里）；
 *   · `snapshot()` / `restore()`：撤销栈要**逐条**记住当时的选中态，撤销/重做时选中态跟着回位；
 *   · `toSelection(resolve)`：交给 `selectionBounds` 吃的 `{ cells }` 形状，空选中返回 null。
 *
 * 纪律：非法输入一律抛错（宁可在测试里炸掉，也不要把 NaN 记进包围盒）。
 */

const isCellId = (v) => Number.isInteger(v) && v >= 0;

function assertCellId(id) {
  if (!isCellId(id)) throw new RangeError(`格子 id 必须是非负整数，收到 ${JSON.stringify(id)}`);
  return id;
}

function idList(ids) {
  if (ids == null) return [];
  if (ids instanceof CellSelection) return ids.ids();
  if (ids instanceof Set) return [...ids];
  if (Array.isArray(ids)) return ids;
  if (typeof ids === 'object' && Array.isArray(ids.cells)) return ids.cells.map((c) => (c && typeof c === 'object' ? c.id : c));
  throw new TypeError('选中态需要 id 数组 / Set / CellSelection');
}

export class CellSelection {
  /** @param {number[]|Set<number>} [ids] */
  constructor(ids = []) {
    this._set = new Set();
    if (ids != null) this.set(ids);
  }

  get size() { return this._set.size; }
  get empty() { return this._set.size === 0; }

  /** 有序（插入序）id 列表；不要就地改它。 */
  ids() { return [...this._set]; }

  has(id) { return isCellId(id) && this._set.has(id); }

  /** @returns {boolean} 是否真的新增（重复 add 返回 false） */
  add(id) {
    assertCellId(id);
    if (this._set.has(id)) return false;
    this._set.add(id);
    return true;
  }

  /** @returns {boolean} 是否真的删掉 */
  remove(id) {
    assertCellId(id);
    return this._set.delete(id);
  }

  /** 加减切换（Shift/⌘ 点选）。@returns {boolean} 切换后是否在选中里 */
  toggle(id) {
    assertCellId(id);
    if (this._set.has(id)) { this._set.delete(id); return false; }
    this._set.add(id);
    return true;
  }

  /** 整体替换。@returns {number[]} 替换后的 id 列表 */
  set(ids) {
    const list = idList(ids).map(assertCellId);
    this._set.clear();
    for (const id of list) this._set.add(id);
    return this.ids();
  }

  /** @returns {number} 清掉的数量 */
  clear() {
    const n = this._set.size;
    this._set.clear();
    return n;
  }

  /**
   * 剔掉不再有效的格子（世界重建 / 撤销 / 清空之后）。
   * `valid` 可以是 Set、id 数组、或 `(id) => boolean`。
   * @returns {{removed:number[], kept:number}}
   */
  prune(valid) {
    let okFn;
    if (typeof valid === 'function') okFn = valid;
    else {
      const s = valid instanceof Set ? valid : new Set(idList(valid));
      okFn = (id) => s.has(id);
    }
    const removed = [];
    for (const id of [...this._set]) {
      let keep = false;
      try { keep = !!okFn(id); } catch { keep = false; }
      if (!keep) { this._set.delete(id); removed.push(id); }
    }
    return { removed, kept: this._set.size };
  }

  /**
   * 交给 `quad-lattice.js#selectionBounds` 的形状：`{ cells:[cell...], ids }`。
   * 空选中 / 解不出任何格子 → null（= 没有选中，窗口该清掉）。
   */
  toSelection(resolve) {
    if (this._set.size === 0) return null;
    if (typeof resolve !== 'function') throw new TypeError('toSelection 需要一个 (id) => cell 的解析函数');
    const ids = this.ids();
    const cells = ids.map((id) => resolve(id)).filter(Boolean);
    if (!cells.length) return null;
    return { cells, ids };
  }

  /** 撤销栈用：只记 id，不记格子对象（世界重造后对象会换）。 */
  snapshot() { return this.ids(); }

  /** @returns {number[]} 回位后的 id 列表（null 当清空） */
  restore(ids) { return ids == null ? this.set([]) : this.set(ids); }

  toString() { return `CellSelection(${this.ids().join(',') || '空'})`; }
}

export { isCellId };
