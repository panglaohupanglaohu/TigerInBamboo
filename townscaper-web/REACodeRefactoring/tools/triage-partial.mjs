// triage-partial.mjs — 把 partial 按「代码是否真的存在 + 该跑哪个页面」重新分拣。
// 与 audit-partial.mjs 的区别：那个只看 reviewStages 标记；这个去磁盘上核实
//   · 证据 md 是否存在
//   · where 里点到的模块/页面是否真实存在
//   · 模块是否被某个 html import（找到能实跑的页面）
// 用法：node tools/triage-partial.mjs [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (p) => path.join(ROOT, p);
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--json') >= 0 ? argv[argv.indexOf('--json') + 1] : null;

// data.js 里 window.LEARN = {...};
const data = JSON.parse(
  fs.readFileSync(P('learn/data.js'), 'utf8').replace(/^window\.LEARN\s*=\s*/, '').replace(/;\s*$/, ''),
);

const htmls = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const htmlSrc = new Map(htmls.map((f) => [f, fs.readFileSync(P(f), 'utf8')]));

// 模块路径 → 引用它的页面
function pagesFor(modPath) {
  const rel = modPath.replace(/^\.\//, '');
  const hits = [];
  for (const [f, src] of htmlSrc) {
    // 页面里 import 常写成 './src/xxx.js'
    if (src.includes(rel) || src.includes(rel.replace(/^src\//, './src/'))) hits.push(f);
  }
  return [...new Set(hits)];
}

const rows = [];
for (const it of data.items) {
  if (it.status !== 'partial') continue;
  const rs = it.reviewStages || {};
  const where = it.where || '';
  const ev = it.reviewEvidence || '';
  const evOk = !!ev && fs.existsSync(P(ev));

  // where 是「模块 · 模块 · 页面」这种写法，按 · 拆开
  const parts = where.split(/\s*·\s*/).filter(Boolean);
  const files = parts.filter((s) => /\.(js|mjs|html|css|py)$/.test(s)).map((s) => s.replace(/（.*$/, '').trim());
  const missing = files.filter((f) => !fs.existsSync(P(f)));
  const pages = [...new Set(files.filter((f) => f.endsWith('.html')))];

  // 没写页面时，用模块反查
  let inferred = [];
  if (!pages.length) {
    for (const f of files.filter((x) => x.endsWith('.js'))) inferred.push(...pagesFor(f));
    inferred = [...new Set(inferred)];
  }

  rows.push({
    id: String(it.id),
    frames: it.decodedFrames || 0,
    status: it.status,
    impl: !!rs.implementationVerified,
    runtime: !!rs.runtimeAccepted,
    evidence: ev,
    evOk,
    files,
    missing,
    pages: pages.length ? pages : inferred,
    pageSource: pages.length ? 'where' : inferred.length ? 'import' : 'none',
    note: it.note || '',
  });
}

const has = (r) => r.impl && r.runtime;
const groups = {
  A_双向都有: rows.filter((r) => has(r) && !/缺|待补|未|仍/.test(r.note)),
  B_双向都有但有缺口: rows.filter((r) => has(r) && /缺|待补|未|仍/.test(r.note)),
  C_缺运行时: rows.filter((r) => r.impl && !r.runtime),
  D_缺实现: rows.filter((r) => !r.impl),
};
console.log('partial 总数', rows.length);
for (const [k, v] of Object.entries(groups)) console.log(k, v.length);
console.log('证据 md 缺失', rows.filter((r) => !r.evOk).length);
console.log('where 点到但磁盘上没有的模块', rows.filter((r) => r.missing.length).length, '条');
const noPage = rows.filter((r) => !r.pages.length);
console.log('找不到可跑页面的条数', noPage.length);
console.log('可跑页面的去重页面数', new Set(rows.flatMap((r) => r.pages)).size);

if (outArg) {
  fs.writeFileSync(P(outArg), JSON.stringify({ rows, groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((r) => r.id)])) }, null, 1));
  console.log('写入', outArg);
}

// 打印分组明细，便于人工判断
for (const [k, v] of Object.entries(groups)) {
  console.log('\n### ' + k + ' (' + v.length + ')');
  for (const r of v.slice(0, 200)) {
    console.log(`${r.id} ${String(r.frames).padStart(4)}f ev=${r.evOk ? 'y' : 'N'} page=${r.pages.join(',') || '-'} miss=${r.missing.length} | ${r.note.slice(0, 64)}`);
  }
}
