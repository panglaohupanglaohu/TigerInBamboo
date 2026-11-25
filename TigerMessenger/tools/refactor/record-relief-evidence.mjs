#!/usr/bin/env node
/**
 * record-relief-evidence.mjs — 地貌枝六条线的原版对照（④）与擂台（⑦）登记表的唯一写入方（R41 / R47）。实算，不手填。
 *
 *   cd /Users/panglaohu/Downloads/TigerInBamboo
 *   $NODE TigerMessenger/tools/refactor/record-relief-evidence.mjs          写 catalog/parity/relief.*.json、catalog/arena/relief.*.json
 *   $NODE TigerMessenger/tools/refactor/record-relief-evidence.mjs --dry    只打印，不写
 *
 * 对照：每条 case 原版 / 重构各跑一遍（TigerMessenger/src/system-workshop/terrain/parity-cases.js），按登记的 diffs 归类：
 *   没有差异 → verdict = equivalent；差异全被登记覆盖 → diff-registered；有登记外的差异 → 不写 verdict（保持 null）、退出码 1，
 *   登记外的差异列在输出里——那是一条新缺口：要么修重构版，要么查明原因后把它登记进 diffs（写清 reason），不许为了变绿删比较项。
 * 擂台：relief/arena.js runArena（固定种子 20261123 的测试岛，加这一代 vs 不加），写 prev / next / metrics / judge / pass。
 *   规则（rule）以 ARENA_RULES 为准；登记表里的 rule 与代码不同 → 退出码 1，不覆盖（规则改动要单独说明）。
 * 不读浏览器本机数据，不改任何场景 / 存档。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARITY_CASES } from '../../src/system-workshop/terrain/parity-cases.js';
import { runParityCase } from '../../src/system-workshop/terrain/parity.js';
import { runArena, ARENA_RULES } from '../../src/system-workshop/relief/arena.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(here, '../../src/scene-authoring/catalog');
const dry = process.argv.includes('--dry');
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const write = (p, j) => { if (!dry) fs.writeFileSync(p, JSON.stringify(j, null, 1) + '\n'); };
const stamp = new Date().toISOString();
let bad = 0;

for (const c of PARITY_CASES) {
  const file = path.join(CATALOG, 'parity', c.id + '.json'), reg = read(file);
  if (!reg) { console.log(`✗ ${c.id}：没有登记表 ${file}`); bad++; continue; }
  const r = await runParityCase(c, reg);
  const measured = { at: stamp, total: r.total, byPath: r.byPath, unregisteredCount: r.unregisteredCount, used: r.used, unused: r.unused, ms: r.ms };
  if (r.verdict === 'unregistered') {
    bad++; console.log(`✗ ${c.id}：${r.unregisteredCount} 条登记外的差异（verdict 不写）`); for (const d of r.unregistered.slice(0, 12)) console.log('    ', JSON.stringify(d));
    write(file, { ...reg, verdict: null, status: 'unregistered-diffs', measured: { ...measured, unregistered: r.unregistered.slice(0, 20) }, recordedBy: 'record-relief-evidence.mjs（实算）' });
  } else {
    console.log(`✓ ${c.id}：${r.verdict}（差异 ${r.total} 处，用到登记 ${r.used.length} 条，没用到 ${r.unused.length} 条）`);
    write(file, { ...reg, verdict: r.verdict, status: 'measured', measured, recordedBy: 'record-relief-evidence.mjs（实算）' });
  }
}
for (const id of Object.keys(ARENA_RULES)) {
  const file = path.join(CATALOG, 'arena', id + '.json'), reg = read(file) || {};
  if (reg.rule && JSON.stringify(reg.rule) !== JSON.stringify(ARENA_RULES[id])) { bad++; console.log(`✗ ${id}：登记表里的规则和 relief/arena.js ARENA_RULES 不一样，不覆盖`); continue; }
  const a = runArena(id), { plan, ...rest } = a;
  console.log(`${a.pass ? '✓' : '✗'} 擂台 ${id}：${a.judge.why}`); for (const row of a.judge.rows) console.log(`     ${row.role} ${row.key}: ${row.prev} → ${row.next}（${row.delta >= 0 ? '+' : ''}${row.delta}，容差 ${row.tol}）`);
  if (!a.pass) bad++;
  write(file, { ...reg, ...rest, metrics: a.next, status: 'measured', recordedAt: stamp, recordedBy: 'record-relief-evidence.mjs（实算）', planSummary: { applied: plan.applied, lips: plan.lips.length, ladders: plan.ladders.length, river: plan.valley?.river.length ?? null } });
}
console.log(dry ? '（--dry：没有写文件）' : '已写登记表：' + CATALOG);
process.exit(bad ? 1 : 0);
