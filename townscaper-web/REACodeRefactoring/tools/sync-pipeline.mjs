// sync-pipeline.mjs — 把 learn/data.js 的逐条核验结果同步到右侧面板泳道（learn/pipeline.js），并把面板里缺的已学条目补登进来。
// 只改：已有条目的 status / where / note / decodedFrames / reviewEvidence / reviewStages（以 data.js 为准），以及 PAGE_OVERRIDE 里的页面入口；
// 缺的 done / partial 条目按 project 放进对应泳道的「逐帧核验补登」分组。用法：node tools/sync-pipeline.mjs [--dry]
import fs from 'node:fs';
const url = new URL('../learn/pipeline.js', import.meta.url);
globalThis.window = {};
eval(fs.readFileSync(url, 'utf8'));
const P = window.PIPELINE;
const src = fs.readFileSync(new URL('../learn/data.js', import.meta.url), 'utf8');
const L = JSON.parse(src.slice(src.indexOf('window.LEARN = ') + 15).replace(/;\s*$/, ''));
const byId = new Map(L.items.map((i) => [i.id, i]));
const PAGE_OVERRIDE = {
  '1707490932017279035': ['index.html?scene=terrain&on=shrubtex', '纯纹理灌木：台地边灌木带 + 小阴影（顶面着色，不加几何）'],
  '1707497006640365880': ['index.html?scene=terrain&on=shrubtex', '生成地形上自动出现的纯纹理灌木'],
  '793545297376972801': ['multitile.html', '多格 tile 三维 WFC + 顶点体素 AO（回放长出来）'],
  '816748103193817088': ['navmesh-flow.html', '导航面内连续流场 · 百人经坡道换层'],
};
let synced = 0, added = 0;
const seen = new Set();
for (const lane of P.lanes) for (const [, items] of lane.groups) for (const s of items) {
  if (!s.id || !byId.has(s.id)) continue;
  seen.add(s.id);
  const it = byId.get(s.id);
  for (const k of ['status', 'where', 'note', 'decodedFrames', 'reviewEvidence', 'reviewStages']) if (it[k] !== undefined && JSON.stringify(s[k]) !== JSON.stringify(it[k])) { s[k] = it[k]; synced++; }
  if (PAGE_OVERRIDE[s.id]) { [s.page, s.name] = PAGE_OVERRIDE[s.id]; }
}
const laneFor = (project) => P.lanes.find((l) => l.name.startsWith(project === 'badnorth' ? '北境' : project === 'townscaper' ? '建筑管线' : project === 'next' ? '融合' : '共享底座'));
const pageOf = (where = '') => (where.match(/[\w-]+\.html(?:\?[\w=&-]+)?/) || [null])[0];
for (const it of L.items) {
  if (!['done', 'partial'].includes(it.status) || seen.has(it.id)) continue;
  const lane = laneFor(it.project) || P.lanes[0];
  let g = lane.groups.find(([name]) => name === '逐帧核验补登');
  if (!g) { g = ['逐帧核验补登', []]; lane.groups.push(g); }
  const text = String(it.text || '').replace(/\s+/g, ' ').trim();
  g[1].push({ id: it.id, name: (text ? text.slice(0, 48) + (text.length > 48 ? '…' : '') : '（无原文）') , status: it.status, where: it.where || '', page: pageOf(it.where), note: it.note, decodedFrames: it.decodedFrames, reviewEvidence: it.reviewEvidence, reviewStages: it.reviewStages });
  added++;
}
if (!process.argv.includes('--dry')) fs.writeFileSync(url, 'window.PIPELINE = ' + JSON.stringify(P, null, 2) + ';\n');
console.log(`同步字段 ${synced} 处，补登 ${added} 条`);
