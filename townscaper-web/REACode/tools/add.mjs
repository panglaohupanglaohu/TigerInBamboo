/**
 * add.mjs — 给 gifs/ 里存在、但 learn/data.js 没登记的片子补一条记录。
 *
 * 那 48 条 2016–2017 的老片只有 mp4、没有帖子原文，所以：
 *   text 固定写 "(无原文，仅有视频)"，日期从雪花 ID 还原，note 写看画面看到的东西。
 *
 * 用法：
 *   node tools/add.mjs --ids 768886648625061889,777501038274281472 \
 *        --topic fx --status todo --project badnorth --note "画面：…"
 */
import fs from 'node:fs';

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode';
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };

const ids = (flag('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
const topic = flag('topic') || 'show';
const status = flag('status') || 'todo';
const project = flag('project') || 'badnorth';
const note = flag('note') || '';
const where = flag('where') || '';

if (!ids.length) {
  console.error('usage: node tools/add.mjs --ids a,b --topic fx --status todo --project badnorth --note "画面：…"');
  process.exit(1);
}

const file = ROOT + '/learn/data.js';
const raw = fs.readFileSync(file, 'utf8');
const data = JSON.parse(raw.match(/^window\.LEARN\s*=\s*([\s\S]*);\s*$/)[1]);
const have = new Set(data.items.map((i) => i.id));

// 雪花 ID → 日期（Twitter 纪元 1288834974657）
const snowDate = (id) => new Date(Number(BigInt(id) >> 22n) + 1288834974657).toISOString().slice(0, 10);

let added = 0;
for (const id of ids) {
  if (have.has(id)) continue;
  if (!fs.existsSync(ROOT + '/gifs/' + id + '.mp4')) { console.error('缺片 ' + id); continue; }
  data.items.push({
    id,
    date: snowDate(id),
    text: '(无原文，仅有视频)',
    topic, status, where, note, project,
  });
  have.add(id);
  added++;
}
// 按日期排序，和其他条目一致（新→旧）
data.items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
fs.writeFileSync(file, 'window.LEARN = ' + JSON.stringify(data) + ';');
console.log(`新增 ${added} 条，总计 ${data.items.length} 条`);
