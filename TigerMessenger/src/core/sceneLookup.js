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
// Candidate list for per-frame filters. The scene walk is time-sliced: each call visits at most
// `budget` objects, and a finished pass replaces the list (a new pass starts every `ms`). This
// replaces the old one-shot full traverse, which spiked 15-40 ms twice a second (2026-10-15).
// Callers keep their own per-frame checks on the returned candidates.
export function throttledCollect(root, accept, ms = 500, budget = 2000) {
  let list = [], next = null, stack = null, startedAt = -Infinity, first = true;
  return () => {
    const now = performance.now();
    if (!stack && (first || now - startedAt >= ms)) { stack = [root]; next = []; startedAt = now; }
    if (stack) {
      // first ever pass completes immediately so callers never see an empty list at start
      let n = first ? Infinity : budget;
      while (stack.length && n-- > 0) {
        const o = stack.pop();
        if (accept(o)) next.push(o);
        const c = o.children; for (let i = c.length - 1; i >= 0; i--) stack.push(c[i]);
      }
      if (!stack.length) { list = next; stack = null; next = null; first = false; }
    }
    return list;
  };
}
