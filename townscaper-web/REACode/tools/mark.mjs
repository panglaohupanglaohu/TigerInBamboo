/**
 * mark.mjs — 按批回写 learn/data.js 的状态，别手改那个 96KB 的单行 JSON。
 *
 * 用法：
 *   node tools/mark.mjs <start> <count> --status game --where "src/combatfx.js" \
 *        --note "已落地：击退出崖状态机 / 长矛线段命中 / 贴花局部坐标"
 *
 * 规则（GUIDE 第 5 条：学完必须更新 data.js）：
 *   status 只允许 game / both / engine / partial / ref / todo / na
 *   - 有 src/ 实现且是给这个项目用的        → game
 *   - 同时有 engine/ 里的原型              → both
 *   - 只有 engine/                         → engine
 *   - 只做了一半，别吹成 game              → partial
 *   --where 用 "主文件 / 次文件"，--note 以「已落地：」开头。
 *
 * 只改 status / where / note 三个字段，text/topic/project 一个字不动。
 */
import fs from 'node:fs';

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode';
const argv = process.argv.slice(2);
const nums = argv.filter((a) => /^\d+$/.test(a)).map(Number);
const [start, count] = nums;

const flag = (name) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : null;
};
const status = flag('status');
const where = flag('where');
const note = flag('note');
const forceIds = flag('ids');   // 可选：直接指定 id，逗号分隔

if ((start === undefined || count === undefined) && !forceIds) {
  console.error('usage: node tools/mark.mjs <start> <count> --status game --where "a / b" --note "已落地：..." [--ids id1,id2]');
  process.exit(1);
}
const OK = ['game', 'both', 'engine', 'partial', 'ref', 'todo', 'na'];
if (!OK.includes(status)) {
  console.error('status 必须是 ' + OK.join('/'));
  process.exit(1);
}

const queue = JSON.parse(fs.readFileSync(ROOT + '/learn/queue.json', 'utf8')).items;
const ids = forceIds
  ? forceIds.split(',').map((s) => s.trim()).filter(Boolean)
  : queue.slice(start, start + count).map((q) => q.id);

const file = ROOT + '/learn/data.js';
const raw = fs.readFileSync(file, 'utf8');
const m = raw.match(/^window\.LEARN\s*=\s*([\s\S]*);\s*$/);
if (!m) {
  console.error('data.js 格式不是 window.LEARN = {...}; 中止');
  process.exit(1);
}
const data = JSON.parse(m[1]);
const byId = new Map(data.items.map((it) => [it.id, it]));

let changed = 0;
const missing = [];
for (const id of ids) {
  const it = byId.get(id);
  if (!it) { missing.push(id); continue; }
  it.status = status;
  if (where) it.where = where;
  if (note) it.note = note;
  changed++;
}
fs.writeFileSync(file, 'window.LEARN = ' + JSON.stringify(data) + ';');
console.log(`改 ${changed}/${ids.length} 条 → ${status}` + (missing.length ? `；不在 data.js 里：${missing.join(',')}` : ''));
