// R61 多种子分布报告命令行（Guide §1.4 创新 6，推广到所有管线层）：一层或全部层各跑 N 个种子（默认 30），写分布、最好 / 最差 / 最典型。
// 用法（仓库根或 TigerMessenger 目录都行；输出路径按本文件位置算，不随当前目录漂）：
//   $NODE TigerMessenger/tools/refactor/seed-report.mjs <层|all> [个数，默认 30] [--from=起始种子] [--stdout]
//   层 = mountain / lightlife / battle / fx / apostles-terrain / gscene / object / planet / scene（scene 会写 NOT_RUN）
// 写出 TigerMessenger/artifacts/seed-report/<层>/report-<时间>.json 与 latest.json；all 另写 artifacts/seed-report/index.json（每层一行摘要）。
// 光影与生命层的能力里有 REACode 原版对照之外的部分都只用重构库，不需要 three；本脚本不 import 原版 REACode。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { SEED_LAYER_IDS, layerSeedReport } from '../../src/system-workshop/seed-layers.js';
import { summarizeReport, formatMetric } from '../../src/system-workshop/seed-report.js';

const here = path.dirname(fileURLToPath(import.meta.url)), OUT = path.resolve(here, '../../artifacts/seed-report');
const args = process.argv.slice(2), flags = new Set(args.filter((a) => a.startsWith('--'))), pos = args.filter((a) => !a.startsWith('--'));
const which = pos[0] || 'all', count = Number(pos[1]) || 30, from = Number((args.find((a) => a.startsWith('--from=')) || '').split('=')[1]) || 1;
const layers = which === 'all' ? SEED_LAYER_IDS : [which];
if (!layers.every((l) => SEED_LAYER_IDS.includes(l))) { console.error('不认识的层：' + which + '（可选：' + SEED_LAYER_IDS.join(' / ') + ' / all）'); process.exit(2); }
const index = [];
for (const layer of layers) {
  const t0 = Date.now(), r = await layerSeedReport(layer, { count, from }), at = new Date().toISOString();
  const report = { at, generator: 'TigerMessenger/tools/refactor/seed-report.mjs', ms: Date.now() - t0, ...r };
  console.log(summarizeReport(report) + (r.status === 'RUN' ? ` · ${report.ms} ms` : ''));
  if (r.status === 'RUN') for (const m of r.metrics) { const d = r.distribution[m.key]; if (d) console.log(`  ${m.label}：${formatMetric(m, d.min)} / p10 ${formatMetric(m, d.p10)} / 中位 ${formatMetric(m, d.median)} / p90 ${formatMetric(m, d.p90)} / ${formatMetric(m, d.max)}`); }
  index.push({ layer, label: r.label, status: r.status, reason: r.reason || null, count: r.count, passed: r.passed, errors: r.errors, pick: r.pick, at });
  if (flags.has('--stdout')) continue;
  const dir = path.join(OUT, layer); fs.mkdirSync(dir, { recursive: true });
  const name = 'report-' + at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(dir, name), JSON.stringify(report, null, 1)); fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(report, null, 1));
  console.log('  写入 ' + path.join(dir, name));
}
if (which === 'all' && !flags.has('--stdout')) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ at: new Date().toISOString(), count, from, layers: index }, null, 1)); console.log('写入 ' + path.join(OUT, 'index.json')); }
