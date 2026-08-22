// =====================================================================
//  攻防事件记录 / 重放（P0 · 高山城堡攻防 V2）
//  - 记录 seed、命令序列（外部输入）与关键战斗事件
//  - 同 seed + 同命令序列 + 同 dt 步进 → 事件流逐字节一致（可重放）
//  - 纯数据模块，不依赖 three；浏览器与 Node 测试共用
// =====================================================================
import { hashHex } from "../core/rng.js";

/** 稳定序列化：对象键排序，数字保留 4 位小数（消除浮点尾差） */
function stableStringify(value) {
  if (value == null || typeof value !== "object") {
    return typeof value === "number" ? String(Math.round(value * 1e4) / 1e4) : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

const roundT = (t) => Math.round(t * 1000) / 1000;

/**
 * @param {{ seed?: number, scenario?: string }} opts
 * @returns 事件日志。事件与命令分开存；digest() 用于跨运行一致性比对。
 */
export function createCombatEventLog({ seed = 1, scenario = "" } = {}) {
  /** @type {{t:number, kind:string, data?:object}[]} */
  const events = [];
  /** @type {{t:number, name:string, data?:object}[]} */
  const commands = [];
  return {
    seed: seed >>> 0,
    scenario,
    events,
    commands,
    /** 关键战斗事件：phase / wave / arrow / javelin / hit / redShip / redSquad / ... */
    record(t, kind, data) {
      const e = { t: roundT(t), kind };
      if (data) e.data = data;
      events.push(e);
    },
    /** 外部命令（whaleReturned / reset / 剧本注入）：重放时按 t 重放 */
    command(t, name, data) {
      const c = { t: roundT(t), name };
      if (data) c.data = data;
      commands.push(c);
    },
    /** 事件流指纹：同一输入必须逐行一致 */
    digest() {
      const lines = events.map((e) => `${e.t}|${e.kind}|${e.data ? stableStringify(e.data) : ""}`);
      return lines.join("\n");
    },
    commandDigest() {
      return commands.map((c) => `${c.t}|${c.name}|${c.data ? stableStringify(c.data) : ""}`).join("\n");
    },
    snapshot() {
      return { seed: this.seed, scenario, events: events.slice(), commands: commands.slice() };
    },
    /** PLAN V4 canonical hash：事件流 + 命令流，同输入必须逐字节一致 */
    canonicalHash() {
      return hashHex(`${this.seed}|${scenario}\n${this.digest()}\n${this.commandDigest()}`);
    },
  };
}
