// =====================================================================
//  轻量领域事件总线（PLAN V4 G0）
//  监听器按注册名稳定排序触发，避免插入顺序漂移。
// =====================================================================

/**
 * @returns {{ on: Function, off: Function, emit: Function, clear: Function }}
 */
export function createEventBus() {
  /** @type {Map<string, Map<string, Function>>} */
  const listeners = new Map();
  let seq = 0;
  return {
    on(type, fn, id = "") {
      if (!listeners.has(type)) listeners.set(type, new Map());
      const key = id || `fn:${seq++}`;
      listeners.get(type).set(key, fn);
      return () => listeners.get(type)?.delete(key);
    },
    off(type, id) {
      listeners.get(type)?.delete(id);
    },
    emit(type, payload) {
      const bag = listeners.get(type);
      if (!bag) return 0;
      const keys = [...bag.keys()].sort();
      for (const key of keys) bag.get(key)(payload, type);
      return keys.length;
    },
    clear() {
      listeners.clear();
    },
  };
}
