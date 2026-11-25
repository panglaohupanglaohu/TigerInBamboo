/**
 * 统一经验存储（WORKSHOP_LOOP_PLAN §6-1）。浏览器与 Node 同一份。
 * 记录格式：{ at, tier, capabilityId, lineId, clipIds, outcome, verify, why, blame, fingerprint, steps }
 *   capabilityId  运行里实际作用的能力（一条管线多步时取 steps；单步运行可直接给 id）
 *   lineId        能力线（Worker 回执带 line 后由步骤继承，见 §6-7）
 *   clipIds       能力对应的来源帖子 ID（能力 meta.clips）
 *   fingerprint   候选指纹：引擎 planHash，没有时退回运行 id
 * 写只写 v2 键 tm.capability.experience.v2；读合并 v2 + 旧分层键（tm.<层>.experience.v1），
 * 旧键不清空：已存的记录继续算经验，新记录全部进 v2。
 */
export const EXP_V2_KEY = 'tm.capability.experience.v2';
export const LEGACY_EXP_KEYS = [
  'tm.capability.experience.v1', 'tm.scene.experience.v1', 'tm.planet.experience.v1',
  'tm.object.experience.v1', 'tm.gscene.experience.v1', 'tm.battle.experience.v1', 'tm.mountain.experience.v1',
];
const MAX_ROWS = 400;

export function normalizeRow(r = {}, tier = 'scene') {
  const steps = Array.isArray(r.steps) ? r.steps.map((s) => ({ id: s.id, status: s.status, line: s.line })) : [];
  return {
    at: r.at || Date.now(), tier: r.tier || tier,
    capabilityId: r.capabilityId || r.capability || (steps.length === 1 ? steps[0].id : null),
    lineId: r.lineId || r.line || (steps.length === 1 ? steps[0].line || null : null),
    clipIds: Array.isArray(r.clipIds) ? r.clipIds : Array.isArray(r.clips) ? r.clips : [],
    outcome: r.outcome || 'previewed', verify: r.verify || null,
    why: r.why || '', blame: Array.isArray(r.blame) ? r.blame : [],
    fingerprint: r.fingerprint || r.planHash || r.id || null,
    id: r.id || null, goal: r.goal || '', steps,
  };
}

const rowKey = (r) => `${r.at}|${r.id || r.capabilityId || r.steps?.map((s) => s.id).join(',') || ''}|${r.outcome}|${r.verify || ''}`;
const safeRead = (storage, key) => { try { const v = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/** 合并读：v2 + 全部旧键，去重后按时间排序。 */
export function readRows(storage = globalThis.localStorage, keys = [EXP_V2_KEY, ...LEGACY_EXP_KEYS]) {
  const seen = new Set(), out = [];
  for (const key of keys) for (const raw of safeRead(storage, key)) {
    const r = normalizeRow(raw, /tm\.(\w+)\.experience\.v1/.exec(key)?.[1] || 'scene');
    const k = rowKey(r); if (seen.has(k)) continue; seen.add(k); out.push(r);
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/** 统一汇总：一条能力（或它所在任一步）的经验。 */
export function summaryFor(id, rows) {
  const has = (r) => r.capabilityId === id || r.steps?.some((s) => s.id === id);
  const runs = rows.filter((r) => r.outcome === 'previewed' && has(r));
  const lastFail = [...runs].reverse().find((r) => r.verify === 'fail');
  return {
    runs: runs.length,
    applied: runs.filter((r) => r.steps.find((s) => s.id === id)?.status === 'applied').length,
    passed: runs.filter((r) => r.verify === 'pass' || r.verify === 'warn').length,
    failed: runs.filter((r) => r.verify === 'fail').length,
    committed: rows.filter((r) => r.outcome === 'committed' && has(r)).length,
    // 失败只记在出问题的能力上（blame）；没有指明是谁时才算在整条管线上
    lastFailure: lastFail && (!lastFail.blame?.length || lastFail.blame.includes(id)) ? lastFail.why : '',
    lastAt: runs.at(-1)?.at || null,
  };
}

export function unifiedStore({ storage = globalThis.localStorage, key = EXP_V2_KEY, legacyKeys = LEGACY_EXP_KEYS, onWrite = null } = {}) {
  const read = () => readRows(storage, [key, ...legacyKeys]);
  return {
    read,
    key,
    add(row, tier = 'scene') {
      const r = normalizeRow(row, tier);
      try { const rows = safeRead(storage, key); rows.push(r); while (rows.length > MAX_ROWS) rows.shift(); storage.setItem(key, JSON.stringify(rows)); } catch {}
      onWrite?.(r);
      return r;
    },
    summary: (id, rows = read()) => summaryFor(id, rows),
    export: () => ({ schemaVersion: 1, exportedAt: Date.now(), key, rows: read() }),
    import(payload) {
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      const merged = read(), seen = new Set(merged.map(rowKey)); let added = 0;
      const cur = safeRead(storage, key);
      for (const raw of rows) { const r = normalizeRow(raw); const k = rowKey(r); if (seen.has(k)) continue; seen.add(k); cur.push(r); added++; }
      cur.sort((a, b) => a.at - b.at); while (cur.length > MAX_ROWS) cur.shift();
      try { storage.setItem(key, JSON.stringify(cur)); } catch {}
      return { added, total: cur.length };
    },
  };
}

/** 兼容旧签名：experienceStore('tm.<层>.experience.v1')。add 写 v2（带层名），read 返回合并后的全部记录。 */
let _pushTimer = 0;
/** 把刚写入的经验行推给本地后端（夜间管线消费）；无服务/无窗口时静默。 */
export function scheduleExperiencePush(rows) {
  if (typeof location === 'undefined' || typeof fetch !== 'function') return;
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    try { fetch(new URL('/api/workshop/experience', location.origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }), credentials: 'omit' }).catch(() => {}); } catch {}
  }, 2500);
}

export function experienceStore(key, storage = globalThis.localStorage) {
  const tier = /tm\.(\w+)\.experience\.v1/.exec(key)?.[1] || 'scene';
  const store = unifiedStore({ storage, onWrite: (r) => { try { globalThis.dispatchEvent?.(new CustomEvent('tm:experience', { detail: r })); } catch {} scheduleExperiencePush([r]); } });
  return { read: store.read, add: (row) => store.add(row, tier), summary: store.summary, export: store.export, import: store.import, key };
}
