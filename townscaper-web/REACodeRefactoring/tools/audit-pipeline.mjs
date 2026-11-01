// audit-pipeline.mjs — 已学（done / partial）但不在右侧面板泳道里的视频；每轮学完跑一遍
import fs from 'fs';
globalThis.window = {};
eval(fs.readFileSync(new URL('../learn/pipeline.js', import.meta.url), 'utf8'));
const P = window.PIPELINE;
const inP = new Set();
for (const l of P.lanes) for (const [, items] of l.groups) for (const s of items) if (s.id) inP.add(s.id);
const src = fs.readFileSync(new URL('../learn/data.js', import.meta.url), 'utf8');
const L = JSON.parse(src.slice(src.indexOf('window.LEARN = ') + 15).replace(/;\s*$/, ''));
const miss = L.items.filter((i) => ['done', 'partial'].includes(i.status) && !inP.has(i.id));
console.log(`面板泳道里缺 ${miss.length} 段`);
for (const i of miss) console.log(' ', i.id, i.status, (i.note || '').slice(0, 50));
process.exit(miss.length ? 1 : 0);
