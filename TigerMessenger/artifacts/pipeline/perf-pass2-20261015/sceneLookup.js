// 2026-10-14 perf: cached scene lookups for per-frame code. A full getObjectByName/traverse
// over the ~37k-object scene costs 1-4 ms; several systems did it every frame.
// findByName re-validates the cached hit (still named and still attached) and, when the
// object does not exist, only searches again after `retryMs` (negative cache).
const caches = new WeakMap();
const attached = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
export function findByName(root, name, retryMs = 1000) {
  if (!root) return null;
  let c = caches.get(root); if (!c) caches.set(root, c = new Map());
  const e = c.get(name), now = performance.now();
  if (e) {
    if (e.obj) { if (e.obj.name === name && attached(e.obj, root)) return e.obj; }
    else if (now - e.at < retryMs) return null;
  }
  const obj = root.getObjectByName(name) || null;
  c.set(name, { obj, at: now });
  return obj;
}
// Candidate list for per-frame filters: the expensive traverse runs at most every `ms`;
// callers still apply their own per-frame checks to the returned candidates.
export function throttledCollect(root, accept, ms = 500) {
  let list = [], at = -Infinity;
  return () => {
    const now = performance.now();
    if (now - at >= ms) { list = []; root.traverse(o => { if (accept(o)) list.push(o); }); at = now; }
    return list;
  };
}
