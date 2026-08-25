// =====================================================================
// 带 schema/hash 的 solution/chunk cache（V7-G14，TODO 1306）
// 条目携带 schema 指纹与内容 hash；schema 漂移或 hash 不匹配自动失效，
// cache 只活在内存，不写回存档，不污染 snapshot。
// =====================================================================

import { schemaVersionStamp } from "../core/schema.js";

export function createVersionedCache({ schema = schemaVersionStamp(), maxEntries = 256 } = {}) {
  if (!(maxEntries > 0)) throw new Error("maxEntries must be > 0");
  const entries = new Map();
  let current = schema;
  let purges = 0;
  return {
    get schema() { return current; },
    get size() { return entries.size; },
    get purges() { return purges; },
    /** expectedHash 提供时不匹配同样失效；失效即删，不残留脏条目。 */
    get(key, expectedHash) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.schema !== current || (expectedHash !== undefined && entry.hash !== expectedHash)) {
        entries.delete(key);
        purges++;
        return undefined;
      }
      return entry.value;
    },
    set(key, value, { hash = null } = {}) {
      entries.set(key, Object.freeze({ schema: current, hash, value }));
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value); // FIFO 逐出最老条目
      return value;
    },
    /** schema 升级：整表失效；返回新 schema。 */
    rekey(next) {
      if (next !== current) {
        entries.clear();
        purges++;
        current = next;
      }
      return current;
    },
  };
}
