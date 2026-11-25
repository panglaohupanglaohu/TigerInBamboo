/**
 * edit-fx-schedule.js — 1260586697538113537：一帧内多个编辑特效的确定序错拍。
 *
 * 撤销 / 重做 / 历史回放按**整笔**快照颗粒度恢复：一笔拖了几十格会一次差分出几十个 edit
 * （worldmesh.edits），原片里楼体是**依次**长出来的，全堆在同一帧就只剩"一整片瞬现"。
 * 快照里没有笔内拖动顺序——那是永久不可恢复的元数据，这里用确定性的「变心径向波」近似：
 * 按变化格集质心的距离升序（并列按 cell.id、再按输入下标），在窗口内均匀摊开。
 *
 * 灰尘 / 水花粒子在 spawn 时刻才生成、pop 弹性动画以 uTime 为基准，所以错拍必须是
 * "到期才触发"而不是"提前生成再显示"：planEditFx 只出纯数据，EditFxQueue 按 uTime 到期
 * drain 给 effects.onEdit / sound.onEdit（view.js render 里同一调用点）。
 *
 * 纯数据层，不依赖 THREE / DOM，node 可测；enabled=false 时整层丢帧（可关）。
 */

/** 把一批 edit 排成 [{cell,before,after,delay}]：径向波序 + 均匀间隔，delay 相对入队时刻（秒）。 */
export function planEditFx(edits, { step = 0.045, maxSpan = 1.4 } = {}) {
  if (!Array.isArray(edits)) throw new TypeError('edits must be an array');
  if (!Number.isFinite(step) || step < 0 || !Number.isFinite(maxSpan) || maxSpan < 0) throw new RangeError('Invalid edit-fx timing');
  const n = edits.length;
  if (!n) return [];
  let cx = 0, cz = 0;
  for (const e of edits) { cx += e.cell.cx; cz += e.cell.cz; }
  cx /= n; cz /= n;
  const order = edits
    .map((e, i) => ({ e, i, d: (e.cell.cx - cx) ** 2 + (e.cell.cz - cz) ** 2 }))
    .sort((a, b) => a.d - b.d || a.e.cell.id - b.e.cell.id || a.i - b.i);
  // 间距优先 step；批太大时压缩间距保证整体不拖过 maxSpan
  const dt = n > 1 ? Math.min(step, maxSpan / (n - 1)) : 0;
  return order.map(({ e }, k) => ({ cell: e.cell, before: e.before, after: e.after, delay: k * dt }));
}

/** 到期队列：push 时按 planEditFx 排程（due = t0 + delay），drain(t) 按时序触发。 */
export class EditFxQueue {
  constructor({ step = 0.045, maxSpan = 1.4 } = {}) {
    if (!Number.isFinite(step) || step < 0 || !Number.isFinite(maxSpan) || maxSpan < 0) throw new RangeError('Invalid edit-fx timing');
    this.step = step;
    this.maxSpan = maxSpan;
    this.pending = [];
    this.enabled = true;      // setDebug('editfx') / ?editfx=0：整层可关
    this.fired = 0;           // 调试计数
    this.dropped = 0;
  }
  /** edits = worldmesh.edits 元素（{cell,before,after}），t0 = 当前 uTime。返回排程条数。 */
  push(edits, t0) {
    const n = edits?.length || 0;
    if (!this.enabled) { this.dropped += n; return 0; }
    if (!Number.isFinite(t0)) throw new RangeError('Invalid edit-fx time');
    const plan = planEditFx(edits, { step: this.step, maxSpan: this.maxSpan });
    for (const p of plan) this.pending.push({ cell: p.cell, before: p.before, after: p.after, due: t0 + p.delay });
    return plan.length;
  }
  /** 触发所有 due <= t 的项（保持排程顺序），返回触发条数。 */
  drain(t, fire) {
    if (!this.pending.length) return 0;
    const due = [], keep = [];
    for (const p of this.pending) (p.due <= t ? due : keep).push(p);
    this.pending = keep;
    for (const p of due) { fire(p); this.fired++; }
    return due.length;
  }
  clear() { this.pending.length = 0; }
}
