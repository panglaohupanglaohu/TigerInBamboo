/**
 * 生成 docs/CAPABILITY_LINEAGE.md：能力线代际、到达位置、下一目标、组合前置与补学队列。
 * 与学习工坊「能力成长与闭环」、系统工坊左栏「能力线」使用同一个计算（REACodeRefactoring/src/core/capability-lineage.js）。
 *   node TigerMessenger/tools/refactor/build-capability-lineage.mjs            写文档
 *   node TigerMessenger/tools/refactor/build-capability-lineage.mjs --stdout   只输出 JSON 摘要
 * 只读源码与学习记录；不含本机执行经验和当前管线需求（那两项只存在浏览器本机，页面上实时计入）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCodeLibrary } from './scan-code-library.mjs';
import { scanSceneConsumers } from './scan-scene-consumers.mjs';
import { buildCapabilityLineage, describeDirection, LEVELS } from '../../../townscaper-web/REACodeRefactoring/src/core/capability-lineage.js';
import { describeCapabilities } from '../../../townscaper-web/REACodeRefactoring/src/capabilities/registry.js';
import { describeObjectCapabilities } from '../../src/system-workshop/object/capabilities.js';
import { describeGsceneCapabilities } from '../../src/system-workshop/gscene/capabilities.js';
import { describePlanetCapabilities } from '../../src/system-workshop/planet/capabilities.js';
import { describeBattleCapabilities } from '../../src/system-workshop/battle/capabilities.js';
import { describeMountainCapabilities } from '../../src/system-workshop/mountain/capabilities.js';
import { describeFxCapabilities } from '../../src/system-workshop/fx/capabilities.js';
import { describeApostlesTerrainCapabilities } from '../../src/system-workshop/apostles-terrain/capabilities.js';
import { describeReliefCapabilities } from '../../src/system-workshop/relief/capabilities.js';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** 谱系 / 能力树 / 成熟度共用的可执行能力清单（R23 抽出来，内容与原来 computeLineage 里的一致；不含场景管线的 editor / live 节点）。 */
export function collectExecutables() {
  return [...describeCapabilities().map((c) => ({ ...c, tier: 'scene' })), ...describeGsceneCapabilities().map((c) => ({ ...c, tier: 'scene' })), ...describePlanetCapabilities().map((c) => ({ ...c, tier: 'planet' })), ...describeObjectCapabilities().map((c) => ({ ...c, tier: 'object' })), ...describeBattleCapabilities().map((c) => ({ ...c, tier: 'scene' })), ...describeMountainCapabilities().map((c) => ({ ...c, tier: 'scene', modules: (c.sources || []).filter((x) => x.includes('REACodeRefactoring/')).map((x) => x.split('REACodeRefactoring/')[1]) })), ...describeFxCapabilities().map((c) => ({ ...c, tier: 'scene', modules: (c.sources || []).filter((x) => x.includes('REACodeRefactoring/')).map((x) => x.split('REACodeRefactoring/')[1]) })), ...describeApostlesTerrainCapabilities().map((c) => ({ ...c, tier: 'scene' })), ...describeReliefCapabilities().map((c) => ({ ...c, tier: 'scene' }))];
}
export async function computeLineage({ root = workspace, experience = {}, demand = [] } = {}) {
  const manifest = await scanCodeLibrary({ root });
  const executables = collectExecutables();
  return { manifest, lineage: buildCapabilityLineage(manifest.evolution, { modules: manifest.modules, alignment: manifest.alignment, executables, experience, demand, consumers: scanSceneConsumers({ root }).consumers }) };
}
const short = (n) => n.split(/[：:]/)[0], cell = (t) => String(t ?? '').replace(/\|/g, '／').replace(/\s+/g, ' ').trim();
export function renderLineageDoc({ manifest, lineage }) {
  const L = lineage.loop, lines = lineage.lines.filter((l) => l.kind === 'line').sort((a, b) => (a.from || '').localeCompare(b.from || '')), byLine = new Map(lineage.lines.map((l) => [l.id, l]));
  const out = [];
  out.push('# 能力谱系：代际、到达位置与补学队列', '',
    '> 本文件由 `tools/refactor/build-capability-lineage.mjs` 生成，不要手改；学习记录或源码变化后重跑。',
    `> 源码快照 \`${manifest.snapshotId.slice(0, 23)}…\` · 作者时间线指纹 \`${(manifest.evolution.fingerprint || '').slice(0, 23)}…\``, '',
    '作者先做出 A，再做出 A+。每条能力线按发布时间切成代际：有依据的「扩展 / 改进 / 替代 / 跨场景适配 / 再次探索」关系，或作者在新阶段再次处理同一问题，开新一代。',
    '「代码到达」取原库 done 状态所在的最新一代；方向先向前（补到达位置之后的缺口），前面没有缺口才回补旧代。本文件不含浏览器本机的执行经验与当前管线需求，那两项在页面上实时加权。', '',
    '## 闭环现状', '',
    '| 环节 | 数量 |', '|---|---|',
    `| 来源材料 | ${L.sources} 条视频来源；原版 REACode 文件 ${L.originalsClassified}/${L.originals} 已归到能力线 |`,
    `| 学习工坊 | ${L.lines} 条能力线，${L.generations} 代；未补缺口 ${L.gaps}（高优先级 ${L.highGaps}） |`,
    `| 实现与适配 | 补学队列 ${L.gaps} 项；代码已有但不能执行的能力线 ${L.adapt} 条 |`,
    `| 能力库 | 可执行能力 ${L.executables} 项（${L.linkedExecutables} 项能排进能力线，覆盖 ${L.linesWithExecutables} 条线）；源码模块 ${L.ownedModules}/${L.modules} 已归线（${L.inferredModules} 个按 import 推断） |`,
    `| 管线 | ${L.runnableCombinations}/${L.combinations} 个组合里本线已有可执行能力 |`, '',
    '层级：' + LEVELS.map((l) => `${l.mark} ${l.name}`).join(' → '), '',
    '## 各能力线：到了哪一代，下一步', '',
    '| 起始 | 能力线 | 代际（●完成 ◐部分 ○仅学习；!缺口数） | 代码到达 | 可执行 | 下一步 | 前置 |', '|---|---|---|---|---|---|---|');
  for (const l of lines) {
    const gens = l.generations.map((g) => `${g.label}${({ complete: '●', building: '◐', learning: '○' })[g.state]}${g.gaps.length ? '!' + g.gaps.length : ''}`).join(' ');
    const q = l.target && lineage.queue.find((x) => x.id === l.target.clip);
    out.push(`| ${(l.from || '').slice(0, 4)} | ${cell(l.name)} | ${gens} | ${l.frontier >= 0 ? l.generations[l.frontier].label : '—'} | ${l.executables.length || '—'} | ${l.target ? `${l.target.mode === 'advance' ? '向前' : '回补'} ${l.target.label}${q ? '（队列 #' + q.rank + '）' : ''}` : '无缺口'} | ${l.requires.slice(0, 4).map((r) => short(byLine.get(r.id).name)).join(' · ') || '—'} |`);
  }
  out.push('', '## 每条线的方向与代际', '');
  for (const l of lines) {
    out.push(`### ${l.name}`, '', describeDirection(l, lineage), '');
    if (l.question) out.push('问题：' + l.question, '');
    out.push('| 代 | 时间 | 阶段 | 如何到这一代 | 状态 | 来源 / 缺口 | 起点 |', '|---|---|---|---|---|---|---|');
    for (const g of l.generations) out.push(`| ${g.label}${g.index === l.frontier ? ' ▲' : ''}${l.target?.generation === g.index ? ' ◎' : ''} | ${g.from === g.to ? g.from : g.from + ' → ' + g.to} | ${cell(g.projectLabel)} | ${g.via ? cell(g.via.label) : '起点'} | ${({ complete: '完成', building: '部分实现', learning: '仅学习' })[g.state]} | ${g.members.length} / ${g.gaps.length} | [${g.headId}](http://localhost:8769/pipeline.html?evolutionClip=${g.headId}) ${cell(g.title).slice(0, 60)} |`);
    out.push('', `▲ 代码到达 · ◎ 下一步。源码 ${l.counts.modules} 个模块（${l.counts.inferredModules} 个推断归线）· 原版文件 ${l.originals.length} 个 · 可执行：${l.executables.join('、') || '无'}`, '');
  }
  out.push('## 补学队列（前 40）', '', lineage.formula, '', '| # | 分 | 能力线 · 代 | 发布 | 优先级 | 来源 | 缺口 | 排序理由 |', '|---|---|---|---|---|---|---|---|');
  for (const q of lineage.queue.slice(0, 40)) out.push(`| ${q.rank} | ${q.score} | ${short(q.lineName)} · ${q.generation} | ${q.date} | ${q.priority} | [${q.id}](http://localhost:8769/pipeline.html?evolutionClip=${q.id}) | ${cell(q.gap || q.title).slice(0, 110)} | ${cell(q.why.join('；'))} |`);
  out.push('', `其余 ${Math.max(0, lineage.queue.length - 40)} 项在页面「能力成长与闭环 → 补学队列」查看。`, '', '## 适配队列：代码已有，尚无可执行能力', '', '| 能力线 | 代码到达 | 完成来源 | 被依赖 | 主要模块 |', '|---|---|---|---|---|');
  for (const a of lineage.adaptQueue) out.push(`| ${cell(a.name)} | ${a.generation} | ${a.doneClips} | ${a.requiredBy} | ${a.modules.slice(0, 4).join('、')} |`);
  out.push('', '## 组合：能力线的前置顺序', '', '| 组合 | 顺序 | 状态 | 已可执行的步骤 |', '|---|---|---|---|');
  for (const c of lineage.combinations.filter((c) => c.prerequisites.length)) out.push(`| ${short(byLine.get(c.line).name)} | ${c.order.map((id) => short(byLine.get(id).name)).join(' → ')} | ${({ runnable: '可排入管线', 'needs-adapter': '待封装', learning: '待补学' })[c.readiness]} | ${c.steps.map((s) => s.id).join('、') || '—'} |`);
  out.push('', '## 场景诊断：每个场景在能力网上差在哪里', '', '来自 `scan-scene-consumers.mjs` 的静态 import 清单。「旧副本」= 场景用的模块与最新库字节不同（版本分叉），不单独证明画面退化。查的顺序：① 旧副本与库现行版本的差异（同机位对照后再决定换不换）→ ② 库里已有而场景没用的代际 → ③ 库里也没学到位的缺口。', '');
  for (const c of lineage.consumers) {
    out.push(`### ${c.name}`, '', `入口 ${c.entries.map((e) => '`' + e + '`').join('、')}；用到 ${c.counts.modules} 个库模块，${c.counts.different || 0} 个是旧副本，涉及 ${c.counts.lines} 条能力线。引导：同步 ${c.counts.sync} · 接入 ${c.counts.wire} · 补学 ${c.counts.learn}。`, '', ...c.notes.flatMap((n) => [`> 对照结论 ${n.date}：${n.text}（证据 \`${n.evidence}\`）`, '']), '| 能力线 | 用到模块 | 旧副本 | 各代在场景里的状态（✓一致 ✗旧副本 ○未接 ·无代码） |', '|---|---|---|---|');
    for (const r of c.lines) out.push(`| ${short(r.name)} | ${r.modules} | ${r.stale.map((m) => m.path.replace('src/', '')).join('、') || '—'} | ${r.generations.map((g) => g.label + ({ 'in-scene': '✓', stale: '✗', 'not-wired': '○', 'no-code': '·' })[g.state]).join(' ')} |`);
    out.push('');
  }
  out.push('## 尚未归线', '', `源码模块 ${lineage.unownedModules.length} 个、原版 REACode 文件 ${lineage.originals.unclassified.length} 个没有来源记录，也没有被已归线模块 import。`, '',
    '<details><summary>源码模块</summary>', '', lineage.unownedModules.map((p) => '`' + p + '`').join(' '), '', '</details>', '', '<details><summary>原版 REACode 文件</summary>', '', lineage.originals.unclassified.map((o) => '`' + o.source + '`').join(' '), '', '</details>', '',
    '## 边界', '', ...lineage.limits.map((t) => '- ' + t), '');
  return out.join('\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await computeLineage();
  if (process.argv.includes('--stdout')) process.stdout.write(JSON.stringify({ loop: result.lineage.loop, queue: result.lineage.queue.slice(0, 20), adaptQueue: result.lineage.adaptQueue }));
  else { const file = path.join(workspace, 'TigerMessenger/docs/CAPABILITY_LINEAGE.md'); fs.writeFileSync(file, renderLineageDoc(result)); console.log(JSON.stringify(result.lineage.loop)); }
}
