/**
 * 场景消费清单：游戏里每个场景实际 import 了能力库的哪些模块、用的是哪一份（旧 vendor 副本 / 最新库），与最新库差多少。
 * 只做静态读取（正则解析 import 字符串 + 字节比较），不执行任何场景或库代码。
 *   node TigerMessenger/tools/refactor/scan-scene-consumers.mjs            写 src/scene-authoring/catalog/scene-consumers.json
 *   node TigerMessenger/tools/refactor/scan-scene-consumers.mjs --stdout
 * 供 capability-lineage.js 的 consumers 输入：场景 → 模块 → 能力线 / 代际 → 差在哪里。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// 场景归组：按入口文件名。没有列到的文件各自成组，不丢。
export const SCENES = [
  { id: 'apostles', name: '十二门徒', match: /^src\/world\/apostles/ },
  { id: 'morris-lake', name: '莫西斯湖', match: /^src\/world\/morris/ },
  { id: 'citadel', name: '高山圣城', match: /^src\/world\/citadel/ },
  { id: 'battle', name: '战斗场', match: /^src\/world\/rea\// },
];
const SKIP = /^src\/(?:vendor|scene-authoring|system-workshop|pipeline-engine)\//;   // 工坊与执行引擎是工具，不是场景
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);

export function scanSceneConsumers({ root = workspace } = {}) {
  const game = path.join(root, 'TigerMessenger'), vendor = path.join(game, 'src/vendor/townscaper-rea-refactoring'), lib = path.join(root, 'townscaper-web/REACodeRefactoring');
  const importsOf = (file) => [...fs.readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.{1,2}\/[^'"?]+\.m?js)(?:\?[^'"]*)?['"]/g)].map((m) => path.resolve(path.dirname(file), m[1]));
  // vendor 树内的传递闭包
  const closure = (starts, base) => { const seen = new Set(), todo = [...starts]; while (todo.length) { const f = todo.pop(); if (seen.has(f) || !f.startsWith(base + path.sep) || !fs.existsSync(f)) continue; seen.add(f); todo.push(...importsOf(f)); } return seen; };
  const groups = new Map();
  for (const file of walk(path.join(game, 'src')).sort()) {
    const rel = path.relative(game, file).split(path.sep).join('/'); if (SKIP.test(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const direct = { vendor: new Set(), library: new Set() };
    for (const m of text.matchAll(/townscaper-rea-refactoring\/(src\/[\w./-]+\.m?js)/g)) direct.vendor.add(m[1]);
    for (const m of text.matchAll(/REACodeRefactoring\/(src\/[\w./-]+\.m?js)/g)) direct.library.add(m[1]);
    if (!direct.vendor.size && !direct.library.size) continue;
    const scene = SCENES.find((s) => s.match.test(rel)) || { id: 'file:' + rel, name: path.basename(rel, '.js') };
    if (!groups.has(scene.id)) groups.set(scene.id, { id: scene.id, name: scene.name, entries: [], vendor: new Map(), library: new Map() });
    const g = groups.get(scene.id); g.entries.push(rel);
    for (const [tree, base] of [['vendor', vendor], ['library', lib]]) {
      const starts = [...direct[tree]].map((p) => path.join(base, p));
      for (const f of closure(starts, base)) { const p = path.relative(base, f).split(path.sep).join('/'); if (!p.startsWith('src/')) continue; const was = g[tree].get(p); g[tree].set(p, was || direct[tree].has(p)); }
    }
  }
  // 人工记录的对照结论（同机位截图等），随诊断一起显示；没有记录的场景只有静态清单
  const notesFile = path.join(game, 'tools/refactor/scene-consumer-notes.json'), notes = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : {};
  const consumers = [...groups.values()].map((g) => {
    const modules = [];
    for (const [p, direct] of g.vendor) {
      const v = path.join(vendor, p), l = path.join(lib, p), inLib = fs.existsSync(l);
      modules.push({ path: p, via: 'vendor', direct, state: !inLib ? 'absent-in-library' : sha(v) === sha(l) ? 'identical' : 'different', bytes: fs.statSync(v).size, libraryBytes: inLib ? fs.statSync(l).size : null, copiedAt: fs.statSync(v).mtime.toISOString().slice(0, 10) });
    }
    for (const [p, direct] of g.library) if (!g.vendor.has(p)) { const l = path.join(lib, p); if (fs.existsSync(l)) modules.push({ path: p, via: 'library', direct, state: 'identical', bytes: fs.statSync(l).size, libraryBytes: fs.statSync(l).size, copiedAt: null }); }
    modules.sort((a, b) => a.path.localeCompare(b.path));
    return { id: g.id, name: g.name, entries: g.entries, notes: notes[g.id] || [], modules, counts: { modules: modules.length, direct: modules.filter((m) => m.direct).length, identical: modules.filter((m) => m.state === 'identical').length, different: modules.filter((m) => m.state === 'different').length, absent: modules.filter((m) => m.state === 'absent-in-library').length } };
  }).sort((a, b) => b.counts.modules - a.counts.modules);
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), vendorRoot: 'TigerMessenger/src/vendor/townscaper-rea-refactoring', libraryRoot: 'townscaper-web/REACodeRefactoring', consumers,
    limits: ['静态 import 解析：运行时拼接的路径和未执行到的分支不区分。', 'different 只说明字节不同（版本分叉），不单独证明画面退化；差在哪要看对应代际的来源与同机位对照。', 'vendor 副本的日期取文件修改时间，不等于它对应库里的哪个版本。'] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = scanSceneConsumers();
  if (process.argv.includes('--stdout')) process.stdout.write(JSON.stringify(result));
  else { fs.writeFileSync(path.join(workspace, 'TigerMessenger/src/scene-authoring/catalog/scene-consumers.json'), JSON.stringify(result)); console.log(JSON.stringify(result.consumers.map((c) => [c.name, c.counts]))); }
}
