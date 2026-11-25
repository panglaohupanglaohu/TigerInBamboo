#!/usr/bin/env node
/**
 * record-lightlife-arena.mjs — 光影与生命层 9 个能力的擂台（⑦）登记表的唯一写入方。实算，不手填。
 *
 *   cd /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger
 *   $NODE tools/refactor/record-lightlife-arena.mjs          写 catalog/arena/<能力ID>.json（9 份）
 *   $NODE tools/refactor/record-lightlife-arena.mjs --dry    只打印，不写
 *
 * 每个能力：同一颗 syntheticSite(LIGHTLIFE_ARENA_SEED) 上「排在它前面的能力（prev）」vs「前面的 + 它（next）」各跑一遍
 * runPlan + verifyLightLife，按 src/system-workshop/lightlife/arena.js 写死的 ARENA_RULES 判定（judge）。
 * 登记表里的 rule 与代码不同 → 退出码 1，不覆盖（规则改动要单独说明）。不读浏览器本机数据，不改任何场景 / 存档。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIGHTLIFE_CAPABILITIES } from '../../src/system-workshop/lightlife/capabilities.js';
import { runArena, ARENA_RULES } from '../../src/system-workshop/lightlife/arena.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(here, '../../src/scene-authoring/catalog/arena');
const dry = process.argv.includes('--dry');
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const write = (p, j) => { if (!dry) fs.writeFileSync(p, JSON.stringify(j, null, 1) + '\n'); };
const stamp = new Date().toISOString();
let bad = 0;

for (const cap of LIGHTLIFE_CAPABILITIES) {
  const id = cap.meta.id, file = path.join(CATALOG, id + '.json'), reg = read(file) || {};
  if (reg.rule && JSON.stringify(reg.rule) !== JSON.stringify(ARENA_RULES[id])) { bad++; console.log(`✗ ${id}：登记表里的规则和 lightlife/arena.js ARENA_RULES 不一样，不覆盖`); continue; }
  const a = runArena(id), { planSummary, verify, ...rest } = a;
  console.log(`${a.pass ? '✓' : '✗'} 擂台 ${id}：${a.judge.why}（verify ${verify.prev} → ${verify.next}）`);
  for (const row of a.judge.rows) console.log(`     ${row.role} ${row.key}: ${row.prev} → ${row.next}（${row.delta >= 0 ? '+' : ''}${row.delta}，容差 ${row.tol}）`);
  if (!a.pass) bad++;
  write(file, { ...reg, ...rest, metrics: a.next, status: 'measured', recordedAt: stamp, recordedBy: 'record-lightlife-arena.mjs（实算）', planSummary });
}
console.log(dry ? '（--dry：没有写文件）' : '已写登记表：' + CATALOG);
process.exit(bad ? 1 : 0);
