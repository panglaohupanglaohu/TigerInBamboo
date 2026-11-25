/**
 * parity.js — 原版当裁判（Guide §1.4 创新 1，R41 起成为制度）：同一个种子 / 同一份输入喂给原版和重构版，逐项比输出。
 * 纯逻辑，Node 测试、记录脚本（tools/refactor/record-relief-evidence.mjs）和页面（地貌管线面板「在本页实算」）共用。
 *
 * 一条对照（case）= { id: 能力 ID, original: 原版文件, refactored: [重构模块], inputs: 说明, tol: { 默认 / 路径模式 → 容差 }, run: async () => ({ original, refactored }) }。
 * 比较结果 = 差异列表 [{ path, kind: 'value' | 'missing' | 'extra' | 'type' | 'length', original, refactored }]。
 * 登记表（catalog/parity/<能力ID>.json）的 diffs = [{ path: 路径模式（* 匹配任意字符）, kind, reason }]：
 *   每条实际差异都必须被某条登记覆盖，否则判 unregistered（测试红）；全部覆盖 → diff-registered；没有任何差异 → equivalent。
 *   verdict 只取 capability-maturity.js 认的两个值（equivalent / diff-registered）；unregistered 不写进登记表的 verdict。
 * 登记表里没出现的差异 = 一条自动生成的缺口，带着能复现的输入（seed / 参数）。
 */

const isNum = (v) => typeof v === 'number';
const isArr = (v) => Array.isArray(v) || ArrayBuffer.isView(v);
const kindOf = (v) => (v === null ? 'null' : isArr(v) ? 'array' : typeof v);

/** 路径模式 → 正则：* 匹配任意字符（含点），其余字面量 */
export function patternRe(p) {
  return new RegExp('^' + String(p).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
}
/** tol 可以是数字，或 { default, '路径模式': 容差 }；取最长（最具体）的匹配模式 */
export function tolFor(tol, path) {
  if (isNum(tol)) return tol;
  if (!tol) return 0;
  let best = null, len = -1;
  for (const [k, v] of Object.entries(tol)) { if (k === 'default') continue; if (patternRe(k).test(path) && k.length > len) { best = v; len = k.length; } }
  return best ?? tol.default ?? 0;
}

/** 深比较。数组按下标；对象按键并集；数字按容差（NaN 与 NaN 相等）。最多记 maxDiffs 条，超出的只计数。 */
export function diffValues(a, b, { tol = 0, path = '', maxDiffs = 200 } = {}) {
  const out = []; let dropped = 0;
  const push = (d) => { if (out.length < maxDiffs) out.push(d); else dropped++; };
  const walk = (x, y, p) => {
    const kx = kindOf(x), ky = kindOf(y);
    if (x === undefined && y !== undefined) return push({ path: p, kind: 'extra', original: undefined, refactored: brief(y) });
    if (y === undefined && x !== undefined) return push({ path: p, kind: 'missing', original: brief(x), refactored: undefined });
    if (kx !== ky) return push({ path: p, kind: 'type', original: brief(x), refactored: brief(y) });
    if (kx === 'number') {
      if (Number.isNaN(x) && Number.isNaN(y)) return;
      if (!(Math.abs(x - y) <= tolFor(tol, p))) push({ path: p, kind: 'value', original: x, refactored: y });
      return;
    }
    if (kx === 'array') {
      if (x.length !== y.length) push({ path: p + '.length', kind: 'length', original: x.length, refactored: y.length });
      const m = Math.min(x.length, y.length);
      for (let i = 0; i < m; i++) walk(x[i], y[i], p + '[' + i + ']');
      return;
    }
    if (kx === 'object') {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const k of [...keys].sort()) walk(x[k], y[k], p ? p + '.' + k : k);
      return;
    }
    if (x !== y) push({ path: p, kind: 'value', original: x, refactored: y });
  };
  walk(a, b, path);
  return { diffs: out, dropped, total: out.length + dropped };
}
function brief(v) { if (isArr(v)) return `[${v.length} 项]`; if (v && typeof v === 'object') return '{' + Object.keys(v).slice(0, 6).join(',') + '}'; return v; }

/** 每条差异找登记：path 模式匹配且（登记没写 kind 或 kind 相同）。返回 { verdict, unregistered, used, unused } */
export function classifyDiffs(diffs = [], registered = []) {
  const res = registered.map((r) => ({ ...r, re: patternRe(r.path) }));
  const used = new Set(), unregistered = [];
  for (const d of diffs) {
    const hit = res.find((r) => r.re.test(d.path) && (!r.kind || r.kind === d.kind));
    if (hit) used.add(hit.path); else unregistered.push(d);
  }
  const verdict = unregistered.length ? 'unregistered' : diffs.length ? 'diff-registered' : 'equivalent';
  return { verdict, unregistered, used: [...used], unused: registered.map((r) => r.path).filter((p) => !used.has(p)) };
}

/** 跑一条对照：两边各跑一次 + 比较 + 按登记归类。全部差异都参与归类（不截断），只在返回值里截取前 keep 条给人看。 */
export async function runParityCase(c, registry = null) {
  const t0 = Date.now(), { original, refactored } = await c.run();
  const d = diffValues(original, refactored, { tol: c.tol ?? 0, maxDiffs: 1e7 });
  const cls = classifyDiffs(d.diffs, registry?.diffs || []);
  const keep = 40, byPath = {};
  for (const x of d.diffs) { const k = x.path.replace(/\[\d+\]/g, '[]'); byPath[k] = (byPath[k] || 0) + 1; }
  return { id: c.id, original: c.original, refactored: c.refactored, inputs: c.inputs, diffs: d.diffs.slice(0, keep), byPath, total: d.total, verdict: cls.verdict, unregistered: cls.unregistered.slice(0, keep), unregisteredCount: cls.unregistered.length, used: cls.used, unused: cls.unused, ms: Date.now() - t0 };
}

/** 登记表的固定字段（record 脚本写，测试核对）。verdict 只有 record 脚本实算后才写；Quick 预填的登记表 verdict = null。 */
export function registryShape(r) {
  const errs = [];
  if (!r || typeof r !== 'object') return ['不是对象'];
  for (const k of ['capability', 'line', 'original', 'refactored', 'inputs', 'diffs']) if (!(k in r)) errs.push('缺 ' + k);
  if (!Array.isArray(r.diffs)) errs.push('diffs 不是数组');
  else for (const d of r.diffs) if (!d.path || !d.reason) errs.push('登记差异缺 path / reason：' + JSON.stringify(d));
  if (r.verdict != null && !['equivalent', 'diff-registered'].includes(r.verdict)) errs.push('verdict 只能是 equivalent / diff-registered / null');
  return errs;
}

/** 32 位 FNV-1a：大块体素 / 数组只比指纹（两边用同一个函数算） */
export function fingerprint(arr) {
  let h = 0x811c9dc5;
  for (let i = 0; i < arr.length; i++) { h ^= (arr[i] * 1000 | 0) & 0xffffffff; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
