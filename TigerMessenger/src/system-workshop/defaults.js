/**
 * defaults.js — R-A1 管线级「采用 / 设为默认」共享登记处（用户 2026-11-23 决定）。
 *
 * 之前每层各写各的采用键（tm.mountain.adopted.v1、tm.building.adopted.v1、tm.relief.candidate.v1……），
 * 页面上看不到「这个场景现在默认用的是哪套」，也没法一键撤回。这里收成一份登记：
 *
 *   localStorage['tm.defaults.v1'] = {
 *     v: 1,
 *     records: {
 *       '<场景>:<层>': { capabilityId, planId, plan, adoptedBy, at, source, note,
 *                       status?, pendingRef? }
 *     }
 *   }
 *
 * R-A5 起记录带两个可选字段：
 *   - status：'active'（默认，可当默认用）| 'pending-user'（待用户决定）| 'pending-measurement'（待实测选优）。
 *     pending-* 记录只是「待决定登记」，绝不能被当成可应用默认——defaultsHook 见到会直接 skipped-pending。
 *   - pendingRef：对应 docs/PENDING_USER_DECISIONS.md 的编号（如 'P-R32-01'，可逗号串多编号）。
 *   旧记录没有 status 字段一律视为 'active'，兼容不变。
 * 规则：
 *   - 只登记「设为默认」的候选；工坊里的临时预览 / 撤销不写这里。
 *   - adoptedBy 记是谁定的（'user' 页面点的 / 'auto-test' 按实测选优代选的），at 是 ISO 时间。
 *   - plan 是该层 adopt 函数需要的最小计划数据（各层自己解释）；登记处不解释、不执行。
 *   - 不碰任何场景存档、不碰 tm.*.adopted.v1 旧键——旧键由各层自己的 adopt 模块继续读；
 *     defaults 只做「当前默认」的统一视图与撤销入口（撤销 = 删记录 + 调层的 unadopt/撤预览，见 pipeline-bridge）。
 *   - 纯函数核心 + 可注入 storage，Node / 浏览器 / Worker 共用；浏览器侧用 defaultStorage()。
 */
export const DEFAULTS_KEY = 'tm.defaults.v1';
export const DEFAULTS_VERSION = 1;
/** R-A5：记录状态。active = 可当默认；pending-* = 待决定登记，不可应用。 */
export const RECORD_STATUSES = Object.freeze(['active', 'pending-user', 'pending-measurement']);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const normStatus = (v) => (RECORD_STATUSES.includes(v) ? v : 'active');
const normPendingRef = (v) => (typeof v === 'string' && v ? v : null);

/** 纯函数：把存储里的原始值解析成 { v, records }；坏数据当空表，不抛。 */
export function parseDefaults(raw) {
  let data = raw;
  if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { return { v: DEFAULTS_VERSION, records: {} }; } }
  if (!isObj(data) || !isObj(data.records)) return { v: DEFAULTS_VERSION, records: {} };
  const records = {};
  for (const [k, r] of Object.entries(data.records)) {
    if (!isObj(r) || typeof r.capabilityId !== 'string' || !r.capabilityId) continue;
    records[k] = {
      capabilityId: r.capabilityId,
      planId: typeof r.planId === 'string' ? r.planId : null,
      plan: r.plan ?? null,
      adoptedBy: r.adoptedBy === 'auto-test' ? 'auto-test' : 'user',
      at: typeof r.at === 'string' ? r.at : null,
      source: typeof r.source === 'string' ? r.source : 'registry',
      note: typeof r.note === 'string' ? r.note : '',
      status: normStatus(r.status),
      pendingRef: normPendingRef(r.pendingRef),
    };
  }
  return { v: DEFAULTS_VERSION, records };
}

export const recordKey = (scene, layer) => `${scene}:${layer}`;

/** 默认 storage：浏览器用 localStorage；Node / Worker 里没有就退化成内存表（测试注入自己的 storage）。 */
export function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch { /* 沙箱里访问 localStorage 会抛 */ }
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}

const read = (storage) => parseDefaults(storage.getItem(DEFAULTS_KEY));
const write = (storage, data) => storage.setItem(DEFAULTS_KEY, JSON.stringify(data));

/** 读一个场景某层的默认记录；没有返回 null。 */
export function getDefault(storage, scene, layer) {
  return read(storage).records[recordKey(scene, layer)] ?? null;
}

/** 列出一个场景全部层的默认（{ layer: record }，按 key 排序保证确定性）。 */
export function listDefaults(storage, scene) {
  const prefix = `${scene}:`;
  const out = {};
  for (const [k, r] of Object.entries(read(storage).records)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = r;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** 设为默认：同一 scene:layer 覆盖旧记录（新决定取代旧决定），返回写入的记录。 */
export function setDefault(storage, scene, layer, rec) {
  if (!isObj(rec) || typeof rec.capabilityId !== 'string' || !rec.capabilityId) {
    throw new Error('defaults: 记录必须有 capabilityId');
  }
  const data = read(storage);
  const record = {
    capabilityId: rec.capabilityId,
    planId: typeof rec.planId === 'string' ? rec.planId : null,
    plan: rec.plan ?? null,
    adoptedBy: rec.adoptedBy === 'auto-test' ? 'auto-test' : 'user',
    at: typeof rec.at === 'string' ? rec.at : new Date().toISOString(),
    source: typeof rec.source === 'string' ? rec.source : 'registry',
    note: typeof rec.note === 'string' ? rec.note : '',
    status: normStatus(rec.status),
    pendingRef: normPendingRef(rec.pendingRef),
  };
  data.records[recordKey(scene, layer)] = record;
  write(storage, data);
  return record;
}

/** 撤销默认：删记录；没有记录返回 false。 */
export function clearDefault(storage, scene, layer) {
  const data = read(storage);
  const k = recordKey(scene, layer);
  if (!(k in data.records)) return false;
  delete data.records[k];
  write(storage, data);
  return true;
}

/** 撤销一个场景的全部默认；返回删了几条。 */
export function clearScene(storage, scene) {
  const data = read(storage);
  const prefix = `${scene}:`;
  let n = 0;
  for (const k of Object.keys(data.records)) if (k.startsWith(prefix)) { delete data.records[k]; n++; }
  if (n) write(storage, data);
  return n;
}

/** 全部场景的默认（给「当前默认」总栏用）：{ '<scene>:<layer>': record }，按 key 排序。 */
export function listAll(storage) {
  const records = read(storage).records;
  return Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)));
}
