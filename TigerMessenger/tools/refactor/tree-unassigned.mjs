/** 列出还没归到能力线的文件（原版 REACode + 重构库模块）的紧凑文字证据，供 JEV 批量分类。只读。 */
import fs from 'node:fs'; import path from 'node:path';
import { computeLineage } from './build-capability-lineage.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const { manifest, lineage } = await computeLineage();
const head = (file) => { try { const t = fs.readFileSync(file, 'utf8').slice(0, 1500); const m = t.match(/\/\*\*?([\s\S]*?)\*\//) || t.match(/<title>([^<]*)/) || t.match(/((?:\/\/.*\n)+)/); return (m ? m[1] : '').replace(/[\s*\/]+/g, ' ').trim().slice(0, 150); } catch { return ''; } };
const byPath = new Map(manifest.modules.map((m) => [m.path, m])), al = new Map(manifest.alignment.map((a) => [a.source, a]));
const rows = [
  ...lineage.originals.unclassified.map((o) => ({ key: 'o:' + o.source, repo: 'REACode', path: o.source, exports: (al.get(o.source)?.originalExports || []).slice(0, 6), note: head(path.join(root, 'townscaper-web/REACode', o.source)) })),
  ...lineage.unownedModules.map((p) => ({ key: 'm:' + p, repo: 'REACodeRefactoring', path: p, exports: (byPath.get(p)?.exports || []).slice(0, 6), note: head(path.join(root, 'townscaper-web/REACodeRefactoring', p)) })),
];
const lines = lineage.lines.filter((l) => l.kind === 'line').map((l) => ({ id: l.id, name: l.name.split(/[：:]/)[0], question: (l.question || '').slice(0, 60) }));
console.log(JSON.stringify({ lines, rows }));
