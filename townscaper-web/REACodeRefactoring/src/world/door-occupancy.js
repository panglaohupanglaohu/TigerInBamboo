/**
 * 906425294533394432 "It's like navigating a Swiss cheese";
 * 797119718477991936 "Got some basic navigation going".
 *
 * 洞口占用（门洞互斥 + 排队）：
 * 导航层只算**代价**（`BattleNavigation.doorCost`：一条洞道两个洞口、洞身平价），
 * 谁此刻在洞口是**跨单位**的状态，不属于任何一棵最短路树 —— 所以单独一张占用表。
 *
 * 规则（每条都能在页面上数出来）：
 * 1. 容量按**实际净宽**算：`floor(净宽 / (2·体径 + 缝))`，窄门 1 人、宽拱多人 —— 不发明「所有门都单列」；
 * 2. 洞口满 → 这一步不迈，停在洞前重试（这就是排队）；先到者先过（FIFO，防同一帧互让造成抖动）；
 * 3. 一个人同时只占一个洞口；一帧内没再申请就视为离开（`release`），死亡/掉头/卡住由 ttl 兜底；
 * 4. 只读账：`stats()` 给轮次验收用（claims/granted/denied/expired/maxQueue/holders）。
 *
 * 实测口径见 `tests/door-occupancy.mjs`、`tests/door-queue-battle.mjs`、
 * `tests/door-queue-browser.cjs`；证据 `artifacts/coverage/797119718477991936-review-r245.md`。
 */
export class DoorOccupancy {
  constructor({ ttl = 1.2, gap = .01 } = {}) {
    if (!Number.isFinite(ttl) || ttl <= 0) throw new RangeError('Invalid door hold ttl');
    if (!Number.isFinite(gap) || gap < 0) throw new RangeError('Invalid door body gap');
    this.ttl = ttl; this.gap = gap;
    this.holds = new Map();   // id → {key,t}
    this.slots = new Map();   // key → Map(id → t)
    this.queues = new Map();  // key → [id]（先到先过）
    this.stats = { claims: 0, granted: 0, denied: 0, released: 0, expired: 0, evicted: 0, maxQueue: 0 };
  }
  /** 一个洞口一次放得下几个身体（圆盘直径 = 2·半径 + 缝）。净宽量不到就按 1 人算。 */
  static capacity(width, radius, { gap = .01 } = {}) {
    const r = Number(radius) || 0, body = 2 * r + gap;
    const clear = Math.max(0, Number(width) || 0);
    if (!(r > 0) || !(clear > 0)) return 1;      // 量不到体径或净宽：按 1 人算，不放大成「无限并行」
    return Math.max(1, Math.floor(clear / body));
  }
  #prune(key, t) {
    const slot = this.slots.get(key); if (!slot) return;
    for (const [id, at] of slot) if (t - at > this.ttl) { slot.delete(id); this.holds.delete(id); this.stats.expired++; }
    if (!slot.size) this.slots.delete(key);
  }
  #dequeue(key, id) {
    const q = this.queues.get(key); if (!q) return;
    const i = q.indexOf(id); if (i >= 0) q.splice(i, 1);
    if (!q.length) this.queues.delete(key);
  }
  /** 申请进入洞口 key。cap 必须是容量（`DoorOccupancy.capacity(width,radius)` 的结果，≥1）。
   *  返回 {granted, cap, holders, queue, reason}。 */
  claim(id, key, { t, cap = 1 } = {}) {
    if (!Number.isFinite(t)) throw new RangeError('Invalid door claim time');
    if (!Number.isInteger(cap) || cap < 1) throw new RangeError('Invalid door capacity');
    this.stats.claims++;
    this.#prune(key, t);
    const held = this.holds.get(id);
    if (held && held.key !== key) this.release(id);              // 一人一次只占一个洞口
    let slot = this.slots.get(key);
    if (held?.key === key && slot?.has(id)) {                    // 已在洞口里：续期，不重新排队
      slot.set(id, t); held.t = t;
      return { granted: true, cap, holders: slot.size, queue: this.queues.get(key)?.length ?? 0, reason: 'held' };
    }
    const queue = this.queues.get(key);
    const head = queue?.[0] ?? null;
    if (head !== null && head !== id) {                          // 有人排在前面：让先到的先过
      this.stats.denied++;
      return { granted: false, cap, holders: slot?.size ?? 0, queue: queue.length, reason: 'fifo' };
    }
    if (!slot) { slot = new Map(); this.slots.set(key, slot); }
    if (slot.size < cap) {
      this.#dequeue(key, id);
      slot.set(id, t); this.holds.set(id, { key, t });
      this.stats.granted++;
      return { granted: true, cap, holders: slot.size, queue: this.queues.get(key)?.length ?? 0, reason: 'free' };
    }
    if (!queue || !queue.includes(id)) {                         // 洞口满：排队等，下一帧再试
      const q = this.queues.get(key) ?? [];
      if (!q.includes(id)) q.push(id);
      this.queues.set(key, q);
      this.stats.maxQueue = Math.max(this.stats.maxQueue, q.length);
    }
    this.stats.denied++;
    return { granted: false, cap, holders: slot.size, queue: this.queues.get(key).length, reason: 'full' };
  }
  release(id) {
    const held = this.holds.get(id); if (!held) return false;
    this.holds.delete(id);
    const slot = this.slots.get(held.key);
    if (slot) { slot.delete(id); if (!slot.size) this.slots.delete(held.key); }
    for (const [key] of [...this.queues]) this.#dequeue(key, id);
    this.stats.released++;
    return true;
  }
  /** 每帧收尾：清掉没人再申请的占用（掉头 / 死亡 / 站着不动）与仍在排队但已消失的人。 */
  sweep(alive = null, t = 0) {
    let dropped = 0;
    for (const [id] of [...this.holds]) {
      if (alive && !alive(id)) { this.release(id); this.stats.evicted++; dropped++; }
    }
    for (const [key, q] of [...this.queues]) {
      const keep = alive ? q.filter((id) => alive(id)) : q;
      dropped += q.length - keep.length;
      if (keep.length) this.queues.set(key, keep); else this.queues.delete(key);
    }
    for (const key of [...this.slots.keys()]) this.#prune(key, t);
    return dropped;
  }
  queueLength(key) { return this.queues.get(key)?.length ?? 0; }
  holders(key) { return this.slots.get(key)?.size ?? 0; }
  holding(id) { return this.holds.get(id)?.key ?? null; }
  summary() {
    let holders = 0; for (const s of this.slots.values()) holders += s.size;
    let queue = 0; for (const q of this.queues.values()) queue += q.length;
    return { ...this.stats, mouths: this.slots.size, holders, queue, holding: this.holds.size, ttl: this.ttl };
  }
}
