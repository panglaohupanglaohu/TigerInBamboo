// 原版当裁判：同一个能力在 REACode（原版）和 REACodeRefactoring（重构版）各有一份实现，
// 喂同样的种子比输出。一致 → 「行为等价」；不一致 → 一条带可复现输入的缺口。
// 用法（在 TigerMessenger 目录）：node tools/referee/run.mjs [案例id…] [--out 路径]
// 结果写 src/scene-authoring/catalog/referee.json。新增案例：在 tools/referee/cases/ 加一个文件。
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), tm = path.resolve(here, '../..'), web = path.resolve(tm, '../townscaper-web');
const load = (p) => import(pathToFileURL(p).href);

export async function referee(only = []) {
  const files = fs.readdirSync(path.join(here, 'cases')).filter((f) => f.endsWith('.mjs')).sort(), cases = [];
  for (const f of files) {
    const c = (await load(path.join(here, 'cases', f))).default; if (only.length && !only.includes(c.id)) continue;
    const row = { id: c.id, line: c.line, clip: c.clip, original: c.original, refactored: c.refactored, claim: c.claim, declared: c.declared || [], seeds: c.seeds.length, metrics: {}, observed: {}, failures: [] };
    try {
      const orig = await load(path.join(web, 'REACode', c.original)), ref = await load(path.join(web, 'REACodeRefactoring', c.refactored));
      for (const seed of c.seeds) {
        const r = c.run(seed, { orig, ref });
        for (const [name, m] of Object.entries(r.metrics)) {
          const d = Math.abs(m.orig - m.ref), agg = row.metrics[name] ||= { agree: 0, worst: 0, worstSeed: null, tol: m.tol };
          if (d <= m.tol) agg.agree++; else row.failures.push({ seed, metric: name, original: m.orig, refactored: m.ref, tol: m.tol });
          if (d > agg.worst) { agg.worst = d; agg.worstSeed = seed; }
        }
        for (const [name, v] of Object.entries(r.observed || {})) { const o = row.observed[name] ||= { min: v, max: v, sum: 0 }; o.min = Math.min(o.min, v); o.max = Math.max(o.max, v); o.sum += v; }
      }
      for (const o of Object.values(row.observed)) { o.mean = o.sum / c.seeds.length; delete o.sum; }
      row.verdict = row.failures.length ? 'diverges' : row.declared.length ? 'equivalent-with-declared-differences' : 'equivalent';
    } catch (e) { row.verdict = 'error'; row.error = String(e.message || e).slice(0, 400); }
    row.failures = row.failures.slice(0, 12); cases.push(row);
  }
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), note: '裁判只证明「在这些种子和这些度量上」一致；度量没覆盖到的行为不在结论内。', cases };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), oi = args.indexOf('--out'), out = oi >= 0 ? args[oi + 1] : path.join(tm, 'src/scene-authoring/catalog/referee.json');
  const doc = await referee(args.filter((a, i) => !a.startsWith('--') && i !== oi + 1));
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  for (const c of doc.cases) {
    console.log(`\n[${c.verdict}] ${c.id}  ${c.original} ↔ ${c.refactored}  (${c.seeds} 个种子)${c.error ? '  ' + c.error : ''}`);
    for (const [n, m] of Object.entries(c.metrics)) console.log(`  ${m.agree === c.seeds ? '✓' : '✗'} ${n}: ${m.agree}/${c.seeds} 一致，最大差 ${+m.worst.toPrecision(3)}（容差 ${+m.tol.toPrecision(3)}${m.worstSeed != null ? '，种子 ' + m.worstSeed : ''}）`);
    for (const [n, o] of Object.entries(c.observed)) console.log(`  · ${n}: ${+o.min.toPrecision(4)} – ${+o.max.toPrecision(4)}，均值 ${+o.mean.toPrecision(4)}`);
    for (const f of c.failures.slice(0, 4)) console.log(`  缺口 种子 ${f.seed} · ${f.metric}: 原版 ${+f.original.toPrecision(5)} / 重构版 ${+f.refactored.toPrecision(5)}`);
  }
}
