// =====================================================================
//  GPU/逻辑资源引用计数（G10）。不操作 Three.js；调用方传入 dispose。
// =====================================================================

export function createResourceRegistry() {
  const items = new Map();
  let next = 1;
  return {
    retain(kind, key, factory) {
      const id = `${kind}:${key}`;
      const rec = items.get(id);
      if (rec) {
        rec.refs += 1;
        return rec.value;
      }
      const value = factory();
      items.set(id, { id, kind, key, value, refs: 1, dispose: value?.dispose });
      return value;
    },
    release(kind, key) {
      const id = `${kind}:${key}`;
      const rec = items.get(id);
      if (!rec) return false;
      rec.refs -= 1;
      if (rec.refs <= 0) {
        rec.dispose?.();
        items.delete(id);
      }
      return true;
    },
    replace(kind, key, factory) {
      const id = `${kind}:${key}`;
      const previous = items.get(id);
      previous?.dispose?.();
      const value = factory();
      items.set(id, { id, kind, key, value, refs: 1, dispose: value?.dispose });
      return value;
    },
    disposeAll() {
      for (const record of items.values()) record.dispose?.();
      items.clear();
    },
    size() {
      return items.size;
    },
    snapshot() {
      return [...items.values()].map((r) => ({ id: r.id, kind: r.kind, refs: r.refs })).sort((a, b) => (a.id < b.id ? -1 : 1));
    },
    allocId() {
      return next++;
    },
  };
}
