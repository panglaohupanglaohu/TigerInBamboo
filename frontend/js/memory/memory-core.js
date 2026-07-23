// 记忆核心：localStorage 读写适配 + 四层聚合 + 共享时间轴
// 命名空间 tib.memory.<creatureId>.<layer>；storage 不可用时退化为内存 Map
// 设计定稿见 docs/memory-architecture.md
import { EpisodicLog } from "./log.js";
import { PerceptionStream } from "./perception.js";
import { IntentionQueue } from "./intentions.js";
import { AffectResidue } from "./affect.js";

export const MEMORY_PREFIX = "tib.memory.";
export const MEMORY_SCHEMA = "tib.memory/v1";
export const LAYERS = ["log", "perception", "intentions", "affect"];

const memoryFallback = new Map();
let storageOk = null;

function storageAvailable() {
  if (storageOk !== null) return storageOk;
  try {
    const probe = "tib.memory.__probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    storageOk = true;
  } catch (_) {
    storageOk = false;
  }
  return storageOk;
}

/** 读一个键（JSON 反序列化）；不存在或解析失败返回 null */
export function storageGet(key) {
  if (storageAvailable()) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  return memoryFallback.has(key) ? memoryFallback.get(key) : null;
}

/** 写一个键（JSON 序列化）；返回是否成功 */
export function storageSet(key, value) {
  if (storageAvailable()) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }
  memoryFallback.set(key, value);
  return true;
}

/** 删一个键 */
export function storageRemove(key) {
  if (storageAvailable()) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      /* ignore */
    }
    return;
  }
  memoryFallback.delete(key);
}

/** 列出某前缀下的全部键 */
export function storageKeys(prefix = MEMORY_PREFIX) {
  const out = [];
  if (storageAvailable()) {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
    } catch (_) {
      /* ignore */
    }
    return out;
  }
  for (const k of memoryFallback.keys()) {
    if (k.startsWith(prefix)) out.push(k);
  }
  return out;
}

/** 层存储键：tib.memory.<creatureId>.<layer> */
export function memKey(creatureId, layer) {
  return `${MEMORY_PREFIX}${creatureId}.${layer}`;
}

/** 从存储键中枚举拥有记忆（或遗存）的 creatureId 列表 */
export function listCreatureIds() {
  const ids = new Set();
  for (const k of storageKeys(MEMORY_PREFIX)) {
    const rest = k.slice(MEMORY_PREFIX.length);
    const dot = rest.lastIndexOf(".");
    if (dot > 0) ids.add(rest.slice(0, dot));
  }
  return [...ids];
}

/** 深冻结（封存快照只读化用） */
export function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    for (const v of Object.values(obj)) deepFreeze(v);
    Object.freeze(obj);
  }
  return obj;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v) => clamp(Number.isFinite(+v) ? +v : 0, 0, 1);
export const uid = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 一只生物的记忆核心：聚合四层子模块，共享同一条时间轴。
 * const core = new MemoryCore("tiger");
 * core.log.append(...); core.perception.perceive(...); ...
 */
export class MemoryCore {
  constructor(creatureId) {
    if (!creatureId) throw new Error("MemoryCore 需要 creatureId");
    this.creatureId = creatureId;
    this.log = new EpisodicLog(creatureId);
    this.perception = new PerceptionStream(creatureId);
    this.intentions = new IntentionQueue(creatureId);
    this.affect = new AffectResidue(creatureId);
  }

  /**
   * 共享时间轴：返回四层在时刻 t 的切片并集（回放任一层可拉到另外三层）
   * @param {number} t 毫秒时间戳
   * @param {number} windowMs 前后窗口（默认 ±60s）
   */
  at(t, windowMs = 60_000) {
    return {
      t,
      log: this.log.at(t, windowMs),
      perception: this.perception.perceiveAt(t, windowMs),
      intentions: this.intentions.at(t),
      affect: this.affect.at(t),
    };
  }

  /** 整只生物记忆导出为 JSON 对象（四层全量） */
  exportAll() {
    return {
      schema: MEMORY_SCHEMA,
      creatureId: this.creatureId,
      exportedAt: Date.now(),
      layers: {
        log: this.log.toJSON(),
        perception: this.perception.toJSON(),
        intentions: this.intentions.toJSON(),
        affect: this.affect.toJSON(),
      },
    };
  }

  /**
   * 从 JSON（对象或字符串）整只导入，覆盖四层现状
   * @returns {boolean} 是否成功
   */
  importAll(json) {
    let data = json;
    if (typeof json === "string") {
      try {
        data = JSON.parse(json);
      } catch (_) {
        return false;
      }
    }
    const layers = data?.layers;
    if (!data || data.schema !== MEMORY_SCHEMA || !layers) return false;
    if (data.creatureId && data.creatureId !== this.creatureId) {
      // 允许导入他者记忆（传递 = 复制），但按本核心 creatureId 落盘
    }
    this.log.replace(layers.log);
    this.perception.replace(layers.perception);
    this.intentions.replace(layers.intentions);
    this.affect.replace(layers.affect);
    return true;
  }
}
