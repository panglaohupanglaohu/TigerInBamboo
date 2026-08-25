// =====================================================================
//  调试计数器 / 计时（PLAN V4 G0）
//  纯数据；生产路径不得依赖它改变结果。
// =====================================================================

const counters = new Map();
const timings = new Map();

export function debugCount(name, delta = 1) {
  counters.set(name, (counters.get(name) || 0) + delta);
}

export function debugTime(name, ms) {
  const slot = timings.get(name) || { n: 0, sum: 0, max: 0 };
  slot.n += 1;
  slot.sum += ms;
  slot.max = Math.max(slot.max, ms);
  timings.set(name, slot);
}

export function debugSnapshot() {
  const countObj = {};
  for (const [k, v] of [...counters.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    countObj[k] = v;
  }
  const timeObj = {};
  for (const [k, v] of [...timings.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    timeObj[k] = {
      n: v.n,
      meanMs: v.n ? v.sum / v.n : 0,
      maxMs: v.max,
      p95Ms: v.max, // G0：样本少时用 max 占位；G10 再换成真实分位
    };
  }
  return { counters: countObj, timings: timeObj };
}

export function debugReset() {
  counters.clear();
  timings.clear();
}
