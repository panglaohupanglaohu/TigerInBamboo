/**
 * report.mjs — 把「哪些学过、哪些没学」摊成一张可核对的清单。
 *
 * 为什么不直接信 data.js 的 status：status 是人写的，可能是自我感觉良好。
 * 这里对每条已学的条目做一次可追溯检查 —— where 里第一个文件是否存在、
 * 文件里是否真的出现过这条帖子的 ID。查不到就标 "✗ 无痕"，这种条目不能算学过。
 *
 * 用法：node tools/report.mjs [--md learn/STATUS.md]
 * 输出：控制台汇总 + MARKDOWN 全量清单
 */
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode';
const mdArg = process.argv.indexOf('--md');
const MD = mdArg > 0 ? process.argv[mdArg + 1] : ROOT + '/learn/STATUS.md';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + '/learn/data.js', 'utf8'), ctx);
const items = ctx.window.LEARN.items;

const files = fs.readdirSync(ROOT + '/gifs').filter((f) => f.endsWith('.mp4')).map((f) => f.replace('.mp4', ''));
const byId = new Map(items.map((i) => [i.id, i]));
const unreg = files.filter((f) => !byId.has(f));

// 可追溯检查：where 的第一个文件里有没有出现这条 ID
const cache = new Map();
function trace(where, id) {
  if (!where) return { ok: false, file: null, why: '无 where' };
  // where 里常带注释（"src/townmesh.js #underside"、"src/scene.js 倒影 / engine"），
  // 所以用正则抓第一个像路径的片段，而不是按 "/" 切分。
  const m = where.match(/([\w./-]+\.(?:js|html))/);
  if (!m) return { ok: false, file: null, why: 'where 里没有文件名' };
  const first = m[1];
  const p = ROOT + '/' + first.replace(/^\.\//, '');
  if (!fs.existsSync(p)) return { ok: false, file: first, why: '文件不存在' };
  if (!cache.has(p)) cache.set(p, fs.readFileSync(p, 'utf8'));
  const src = cache.get(p);
  if (!src.includes(id)) {
    // 代码里没有 ID，退一步看文档：早期条目把 ID 记在 LEARNING.md / STUDY-INDEX.md 里，
    // 那时候还没要求「注释必须写 ID」。这种算「只有文档可追溯」，单独一档，不混进代码档。
    for (const doc of ['LEARNING.md', 'STUDY-INDEX.md']) {
      if (!cache.has(doc)) {
        const dp = ROOT + '/' + doc;
        cache.set(doc, fs.existsSync(dp) ? fs.readFileSync(dp, 'utf8') : '');
      }
      if (cache.get(doc).includes(id)) return { ok: false, doc: true, file: first, why: '代码里没有，仅 ' + doc + ' 记过' };
    }
    return { ok: false, file: first, why: '文件里没这条 ID' };
  }
  return { ok: true, file: first };
}

const DONE = ['game', 'both', 'engine'];
const rows = items.map((it) => {
  const t = DONE.includes(it.status) ? trace(it.where, it.id) : null;
  return { ...it, trace: t };
});

const c = {};
for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;

const done = rows.filter((r) => DONE.includes(r.status));
const doneOk = done.filter((r) => r.trace.ok);
const doneDoc = done.filter((r) => !r.trace.ok && r.trace.doc);
const doneBad = done.filter((r) => !r.trace.ok && !r.trace.doc);
const half = rows.filter((r) => r.status === 'partial');
const todo = rows.filter((r) => r.status === 'todo');
const skip = rows.filter((r) => r.status === 'na' || r.status === 'ref');

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const snip = (s, n = 90) => (s || '').replace(/\s+/g, ' ').slice(0, n);

console.log('总 mp4        ' + files.length);
console.log('已学完        ' + done.length + '（代码可追溯 ' + doneOk.length + '，仅文档 ' + doneDoc.length + '，无痕 ' + doneBad.length + '）');
console.log('半成品        ' + half.length);
console.log('有笔记未做    ' + todo.length);
console.log('连登记都没有  ' + unreg.length);
console.log('不用学        ' + skip.length);
console.log('待学合计      ' + (half.length + todo.length + unreg.length));
if (doneDoc.length) {
  console.log('\n只有文档记录、代码里没写 ID（要复核才能算数）：');
  for (const r of doneDoc) console.log('  ' + r.id + '  ' + r.status + '  ' + (r.where || '-'));
}
if (doneBad.length) {
  console.log('\n标了已学但代码和文档都查不到，视为未学完：');
  for (const r of doneBad) console.log('  ' + r.id + '  ' + r.status + '  ' + (r.where || '-') + '  ← ' + r.trace.why);
}

const L = [];
L.push('# 学习状态总表（自动生成，勿手改）');
L.push('');
L.push('生成时间：' + stamp() + '　·　由 `tools/report.mjs` 生成');
L.push('');
L.push('判定规则：`game/both/engine` 且 where 里的文件**真的包含这条帖子 ID** 才算学过；');
L.push('`partial` 算没学完；`na/ref` 是不用学的；gifs 里有但 data.js 没登记的算「没看过」。');
L.push('');
L.push('| 口径 | 数量 |');
L.push('|---|---|');
L.push('| 视频总数 | ' + files.length + ' |');
L.push('| 学过（含可追溯校验） | ' + done.length + '（' + doneOk.length + ' 代码可追溯 / ' + doneDoc.length + ' 仅文档 / ' + doneBad.length + ' 无痕） |');
L.push('| 半成品 partial | ' + half.length + ' |');
L.push('| 有笔记未实现 todo | ' + todo.length + ' |');
L.push('| 未登记（没看过） | ' + unreg.length + ' |');
L.push('| 不用学 na+ref | ' + skip.length + ' |');
L.push('| **还剩** | **' + (half.length + todo.length + unreg.length) + '** |');
L.push('');

const section = (title, list, extra) => {
  L.push('## ' + title + '（' + list.length + '）');
  L.push('');
  if (!list.length) { L.push('（无）'); L.push(''); return; }
  L.push('| id | 日期 | 主题 | 状态 | 落点 | 原文 |');
  L.push('|---|---|---|---|---|---|');
  for (const r of list) L.push('| ' + r.id + ' | ' + r.date + ' | ' + r.topic + ' | ' + (extra ? extra(r) : r.status) + ' | ' + (r.where || '-') + ' | ' + snip(r.text).replace(/\|/g, '/') + ' |');
  L.push('');
};

section('✅ 学过（可追溯）', doneOk);
if (doneDoc.length) section('📄 学过（仅文档记录，代码没写 ID）', doneDoc, (r) => '◌ ' + r.trace.why);
if (doneBad.length) section('⚠️ 标了已学但查不到痕迹', doneBad, (r) => '✗ ' + r.trace.why);
section('🟡 半成品', half);
section('⬜ 有笔记、没代码', todo);
section('🕳 有视频、没登记', unreg.map((id) => ({ id, date: '-', topic: '?', status: '未登记', where: '-', text: '(无原文)' })));
section('➖ 不用学', skip);

fs.writeFileSync(MD, L.join('\n'));
console.log('\n清单 -> ' + MD);

// ---------- 顺手把 learn/learned.js 的 meta 数字同步一遍 ----------
// 为什么放在这里：页面上「已学 X / 285」「台账 N 条」必须和 data.js 一致。
// 之前这些数字是手写的（还写着 237 / 134），跑几轮就跟不上；改成每次出报告时重算。
const LEDGER = ROOT + '/learn/learned.js';
if (fs.existsSync(LEDGER)) {
  let s = fs.readFileSync(LEDGER, 'utf8');
  const block = s.match(/meta:\s*\{[\s\S]*?\n  \},/);
  if (block) {
    let rounds = 0, ledger = 0;
    try {
      const ctx2 = { window: {} };
      vm.createContext(ctx2);
      vm.runInContext(s, ctx2);
      const G = ctx2.window.LEARNED;
      rounds = (G.rounds || []).length;
      ledger = (G.rounds || []).reduce((n, r) => n + (r.items || []).length, 0);
    } catch (e) {
      console.log('learned.js 解析失败，meta 未同步：' + e.message);
    }
    const now = stamp();
    const nb = block[0]
      .replace(/updated:\s*'[^']*'/, `updated: '${now}'`)
      .replace(/total:\s*\d+/, `total: ${done.length}`)
      .replace(/corpus:\s*\d+/, `corpus: ${files.length}`)
      .replace(/rounds:\s*\d+/, `rounds: ${rounds}`)
      .replace(/ledger:\s*\d+/, `ledger: ${ledger}`);
    s = s.replace(block[0], nb);
    fs.writeFileSync(LEDGER, s);
    console.log('台账 meta 已同步：已学 ' + done.length + ' / ' + files.length + ' · 台账 ' + rounds + ' 轮 ' + ledger + ' 条');
  }
}
