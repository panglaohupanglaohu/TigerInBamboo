// annotate-blocked.mjs — 给「推进不下去」的条目写结构化卡点，不抬高状态。
// 只改 note（在原文后追加【卡点】段），status 保持 partial，impl/runtime 原样保留。
// 用法：node tools/annotate-blocked.mjs --ids a.txt --dry
//       node tools/annotate-blocked.mjs --ids a.txt
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CODES } from './blocked-codes.mjs';

const MANUAL = new Map();
for (const [code, list] of Object.entries(CODES)) for (const id of list) MANUAL.set(id, code);

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring';
const argv = process.argv.slice(2);
const idsFile = argv[argv.indexOf('--ids') + 1];
const dry = argv.includes('--dry');
const ids = fs.readFileSync(idsFile.startsWith('/') ? idsFile : ROOT + '/' + idsFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);

const data = JSON.parse(fs.readFileSync(ROOT + '/learn/data.js', 'utf8')
  .replace(/^window\.LEARN\s*=\s*/, '').replace(/;\s*$/, ''));
const byId = Object.fromEntries(data.items.map((i) => [String(i.id), i]));

// 缺口句：按「；」切段，从后往前找第一段带缺口词且长度够的（避免只抓到"未实现""仍部分"这种碎句）
function gapOf(note) {
  const segs = (note || '').split(/[；;]/).map((t) => t.trim())
    .map((t) => t.replace(/【卡点·[^】]*】[\s\S]*$/, ''))
    .filter(Boolean);
  const MARK = /(缺|未|仍|待补|尚未|没有|无)/;
  const clip = (t) => (t.length > 70 ? t.slice(0, 70) + '…' : t);
  for (let i = segs.length - 1; i >= 0; i--) if (MARK.test(segs[i]) && segs[i].length >= 8) return clip(segs[i]);
  const last = segs[segs.length - 1] || '';
  return last.length >= 6 ? clip(last) : '原片内容未复现（原文未写具体缺口）';
}

// 卡在哪：按关键词打分归因（命中数最多者胜，平票按 A 类兜底）
const LEX = {
  A: ['未实现','未做','未迁移','未完成'],
  B: ['图稿','美术','贴图','atlas','纹样','笔触','配色','色板','材质','模型','动画','界面','图标','雕饰','音效','手绘','视觉','素材','美学'],
  C: ['原片','原作','原文','不能证明','不足以','未公开','公式','算法','推断','近似','无法证','未证实'],
  D: ['接 battle','battle.js','主管线','主循环','接入战斗','共享 World','游戏语义','玩法','选中态'],
  E: ['worker','job','线程','性能','Switch','跨平台','低端','帧预算'],
};
const REASON = {
  A: '还差一层没写的机制（本仓无对应实现，属于可做但没做的活）',
  B: '卡在原片美术资产（贴图/模型/动画/UI 稿），没有源素材，程序化只能近似',
  C: '卡在原片算法未公开：配文只说"某算法"，画面也不足以反推，只能近似',
  D: '卡在需要接主管线（battle.js / 共享 World 状态），单页实验验收不了',
  E: '卡在环境（job/线程、主机性能基线），本机实验页验不了',
  F: '证据不足：被遮挡或分辨率不够，判不出机制',
};
function classify(gap) {
  let best = 'A', bestScore = 0;
  for (const [k, words] of Object.entries(LEX)) {
    let sc = 0;
    for (const w of words) if (gap.includes(w)) sc += w.length > 2 ? 2 : 1;
    if (sc > bestScore) { bestScore = sc; best = k; }
  }
  return best;
}

const report = [];
for (const id of ids) {
  const it = byId[id];
  if (!it) { report.push([id, 'MISS', '']); continue; }
  const rs = it.reviewStages || {};
  const gap = gapOf(it.note || '');
  const code = MANUAL.get(id) || classify(gap);
  const tag = { A: '机制未做', B: '美术资产', C: '算法未公开', D: '需接主管线', E: '环境不具备', F: '证据不足' }[code];
  const tail = `【卡点·${code} ${tag}】${gap} → ${REASON[code]}`;
  let base = (it.note || '').replace(/；?【卡点·[^】]*】[\s\S]*$/, '');
  const room = Math.max(120, 660 - tail.length);
  if (base.length > room) base = base.slice(0, room - 1) + '…';
  const note = `${base}；${tail}`;
  report.push([id, it.status, code, gap, note]);
  if (dry) continue;
  const args = [
    'tools/record-review.mjs', '--id', id, '--frames', String(it.decodedFrames),
    '--evidence', it.reviewEvidence, '--status', 'partial', '--note', note,
    '--where', it.where || '', '--scope', rs.acceptanceScope || '',
    '--impl', rs.implementationVerified ? '1' : '0',
    '--runtime', rs.runtimeAccepted ? '1' : '0',
    '--native', (rs.nativeRevisits || []).join(','),
    '--range', (rs.frameRange || [0, it.decodedFrames - 1]).join('-'),
  ];
  try { execFileSync('node', args, { cwd: ROOT, encoding: 'utf8' }); } catch (e) {
    console.log('FAIL', id, (e.stderr || '').slice(0, 160));
  }
}

// 台账
const byCat = {};
for (const r of report) { const k = r[2] || '?'; (byCat[k] = byCat[k] || []).push(r); }
const lines = ['# 卡点台账（第 62 轮）', '', `- 条目数：**${report.length}**`, `- 生成：${new Date().toISOString()}`, ''];
for (const k of Object.keys(byCat).sort()) {
  lines.push(`## ${k} 类 · ${byCat[k].length} 条`, '');
  lines.push('| id | 状态 | 缺口 | 卡在哪 |', '|---|---|---|---|');
  for (const r of byCat[k]) lines.push(`| ${r[0]} | ${r[1]} | ${(r[3] || '').replace(/\|/g, '/')} | ${(r[4] || '').split('→').pop().trim().replace(/\|/g, '/')} |`);
  lines.push('');
}
if (!dry) fs.writeFileSync(ROOT + '/learn/blocked-ledger.md', lines.join('\n'));
console.log(report.length, 'items', Object.entries(byCat).map(([k, v]) => k + '=' + v.length).join(' '));
if (dry) report.slice(0, 6).forEach((r) => console.log(r[0], '|', r[2], '|', r[3], '|', r[4].slice(-110)));
