// R28 30 种子分布报告（Guide §1.4 创新 6），纯 Node：在擂台的固定种子测试岛上跑同一条山形管线 30 次（只换噪声种子），
// 写 artifacts/mountain-seeds/report-<时间>.json 与 latest.json（分布、最好 / 最差 / 最典型）。实景（高山圣城）的分布在山形面板「跑 30 个种子」里出。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/mountain-seed-report.mjs [个数，默认 30]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { seedReport, SEED_METRICS } from '../../src/system-workshop/mountain/seeds.js';
import { arenaIsland, ARENA_SEED } from '../../src/system-workshop/mountain/arena.js';
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.resolve(here, '../../artifacts/mountain-seeds'); fs.mkdirSync(out, { recursive: true });
const count = Number(process.argv[2]) || 30, t0 = Date.now(), r = seedReport(arenaIsland(ARENA_SEED), { count });
const report = { at: new Date().toISOString(), field: `arenaIsland(${ARENA_SEED})`, genome: 'seedGenome(s)：massif.seed = s，rolling.seed = 37s mod 1000，其余默认', ms: Date.now() - t0, ...r };
const name = 'report-' + report.at.replace(/[:.]/g, '-') + '.json';
fs.writeFileSync(path.join(out, name), JSON.stringify(report, null, 1)); fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(report, null, 1));
const f = (k, v) => (SEED_METRICS.find((m) => m.key === k).unit === '%' ? (v * 100).toFixed(1) + '%' : v.toFixed(2) + ' m');
console.log(`${r.count} 座 · ${r.passed} 座过硬检查 · 最好 种子 ${r.pick.best} · 最差 种子 ${r.pick.worst} · 最典型 种子 ${r.pick.typical} · ${report.ms} ms`);
for (const { key, label } of SEED_METRICS) { const d = r.distribution[key]; if (d) console.log(`  ${label}：${f(key, d.min)} / p10 ${f(key, d.p10)} / 中位 ${f(key, d.median)} / p90 ${f(key, d.p90)} / ${f(key, d.max)}`); }
console.log('写入 ' + path.join(out, name));
