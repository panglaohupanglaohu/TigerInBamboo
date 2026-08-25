// =====================================================================
//  Diagnostics — 限长 trace ring buffer 与稳定计数器（V7-G1）
//  生产关闭（enabled=false）时所有记录调用为早退短路，接近零开销；
//  debug 开启时按插入序稳定导出。禁止把 trace 塞进热循环对象字段。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/** 限长 ring buffer：容量满后覆盖最旧记录 */
export class TraceRingBuffer {
  constructor(capacity = 1024) {
    capacity = Math.max(1, capacity >>> 0);
    this.capacity = capacity;
    this.items = new Array(capacity);
    this.head = 0; // 下一写入位
    this.count = 0; // 已写总数（含被覆盖）
  }

  /** 记录一条（record 应为可 JSON 序列化的纯数据） */
  push(record) {
    this.items[this.head] = record;
    this.head = (this.head + 1) % this.capacity;
    this.count++;
    return this;
  }

  /** 按插入序导出副本（最多 capacity 条） */
  toArray() {
    const n = Math.min(this.count, this.capacity);
    const out = new Array(n);
    const start = (this.head - n + this.capacity) % this.capacity;
    for (let i = 0; i < n; i++) out[i] = this.items[(start + i) % this.capacity];
    return out;
  }

  clear() {
    this.items = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }
}

/**
 * 引擎诊断聚合器：开关 + 计数器 + trace。
 * 生产路径调用 record()/count() 在 enabled=false 时为空操作。
 */
export class Diagnostics {
  constructor({ enabled = false, traceCapacity = 1024 } = {}) {
    this.enabled = enabled === true;
    this.trace = new TraceRingBuffer(traceCapacity);
    /** @type {Map<string, number>} */
    this._counters = new Map();
  }

  /** 计数器自增（始终可用，零成本极低；生产统计不依赖 trace） */
  count(key, by = 1) {
    const v = (this._counters.get(key) || 0) + by;
    this._counters.set(key, v);
    return v;
  }

  getCounter(key) {
    return this._counters.get(key) || 0;
  }

  /** trace 记录：生产关闭时早退 */
  record(kind, data) {
    if (!this.enabled) return;
    this.trace.push({ kind, ...data });
  }

  /** 计数器快照（稳定键序导出） */
  countersSnapshot() {
    const out = {};
    for (const key of [...this._counters.keys()].sort()) out[key] = this._counters.get(key);
    return out;
  }

  /** 稳定导出（调试/失败 manifest 用） */
  exportDiagnostics() {
    return {
      enabled: this.enabled,
      counters: this.countersSnapshot(),
      trace: this.enabled ? this.trace.toArray() : [],
    };
  }

  reset() {
    this.trace.clear();
    this._counters.clear();
  }
}

/**
 * 限长字符串队列：WFC 传播/回溯事件的文本轨迹（供 conflictExplain 消费）。
 */
export class EventLog {
  constructor(capacity = 256) {
    this.buf = new TraceRingBuffer(capacity);
  }

  log(message) {
    this.buf.push(message);
    return this;
  }

  tail(n = 32) {
    return this.buf.toArray().slice(-n);
  }
}
