// coverage-queue.mjs — 覆盖队列的唯一入口。口径与 tools/update-learning-counts.py 完全一致：
// 一条片子算「已核」必须同时满足 frames.json 存在、decoded>0、data.js 里 decodedFrames 相等、
// reviewEvidence 指向的文件真的在盘上。不要在这里放宽，否则账会虚。
//
// 用法：
//   node tools/coverage-queue.mjs             # 只打印总账 + 下一批
//   node tools/coverage-queue.mjs --take 4    # 打印下一批 4 条（供定时任务照抄 ID）
//   node tools/coverage-queue.mjs --write     # 顺便写 learn/coverage-queue.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GIFS = path.resolve(ROOT, '../../REA-agent/gifs');
const p = (...a) => path.join(ROOT, ...a);

const argv = process.argv.slice(2);
const take = Number((argv.includes('--take') && argv[argv.indexOf('--take') + 1]) || 4);
const write = argv.includes('--write');

const data = JSON.parse(
  fs.readFileSync(p('learn/data.js'), 'utf8').replace(/^window\.LEARN\s*=\s*/, '').replace(/;\s*$/, '')
);
const videos = fs.readdirSync(GIFS).filter((f) => f.endsWith('.mp4')).map((f) => f.replace('.mp4', ''));

function reviewed(item) {
  const id = item.id;
  const seq = p('artifacts/coverage', id, 'frames.json');
  if (!fs.existsSync(seq)) return false;
  if (!(item.decodedFrames > 0)) return false;
  if (!item.reviewEvidence) return false;
  if (!fs.existsSync(p(item.reviewEvidence))) return false;
  try {
    return JSON.parse(fs.readFileSync(seq, 'utf8')).decoded === item.decodedFrames;
  } catch {
    return false;
  }
}

const done = new Set();
for (const it of data.items) if (reviewed(it)) done.add(it.id);

// 队列顺序：coverage-progress.json 的 next 分组优先（人工排过的优先级），其余按未核顺序补齐。
const progress = JSON.parse(fs.readFileSync(p('learn/coverage-progress.json'), 'utf8'));
const priority = [];
for (const g of progress.next || []) for (const id of g.clips || []) if (!priority.includes(id)) priority.push(id);

const byId = new Map(data.items.map((it) => [it.id, it]));
const remaining = [];
for (const id of priority) if (videos.includes(id) && !done.has(id)) remaining.push(id);
for (const id of videos) if (!done.has(id) && !remaining.includes(id)) remaining.push(id);

// 难度分档：便宜且能立刻把账做实的排前面，需要新建模块的（无原文老片）放最后，
// 这样每小时那轮总是在一个预算内收得住，不会半夜卡在一条没有原文的片子上。
const RANK = { na: 0, ref: 0, done: 1, partial: 2, unregistered: 3 };
const rankOf = (st) => (st in RANK ? RANK[st] : 2);
remaining.sort((a, b) => rankOf(byId.get(a)?.status || 'unregistered') - rankOf(byId.get(b)?.status || 'unregistered'));

const rows = remaining.map((id) => {
  const it = byId.get(id) || {};
  return {
    id,
    topic: it.topic || '?',
    project: it.project || '?',
    status: it.status || 'unregistered',
    text: (it.text || '').slice(0, 120),
    where: it.where || '',
    hasFrames: fs.existsSync(p('artifacts/coverage', id, 'frames.json')),
    priority: priority.includes(id),
  };
});

const byTopic = {};
for (const r of rows) byTopic[r.topic] = (byTopic[r.topic] || 0) + 1;
const statusCount = {};
for (const it of data.items) statusCount[it.status || '?'] = (statusCount[it.status || '?'] || 0) + 1;

console.log(`视频 ${videos.length} · 已核 ${done.size} · 剩 ${rows.length}`);
console.log(`data.js 状态 ${JSON.stringify(statusCount)}`);
console.log(`剩下来源：有笔记 TODO/PARTIAL ${rows.filter((r) => r.status === 'todo' || r.status === 'partial').length} · 完全未登记 ${rows.filter((r) => r.status === 'unregistered').length}`);
console.log(`按主题 ${JSON.stringify(byTopic)}`);
console.log(`\n下一批 ${Math.min(take, rows.length)} 条：`);
for (const r of rows.slice(0, take)) {
  console.log(`  ${r.id}  ${r.status.padEnd(12)} ${r.topic.padEnd(8)} ${r.hasFrames ? '已抽帧' : '待抽帧'}  ${r.text.replace(/\s+/g, ' ').slice(0, 66)}`);
}
if (rows.length > take) console.log(`  …（还剩 ${rows.length - take} 条）`);

if (write) {
  fs.writeFileSync(
    p('learn/coverage-queue.json'),
    JSON.stringify({ built: new Date().toISOString(), total: videos.length, reviewed: done.size, remaining: rows.length, items: rows }, null, 1)
  );
  console.log('\n已写 learn/coverage-queue.json');
}
