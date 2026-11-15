// audit-partial.mjs — 把 partial 条目压成可执行批次清单（只读，不写 data.js / progress）。
// 用法：node tools/audit-partial.mjs [--write]
// 输出：learn/partial-backlog.md（--write 时才写盘），stdout 打印分组统计。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

// data.js 是给浏览器用的全局脚本，这里用最小 shim 载入
global.window = {};
const dataUrl = 'file://' + path.join(ROOT, 'learn/data.js');
await import(dataUrl);
const items = (global.window.LEARN && global.window.LEARN.items) || [];

// 判「还差东西」的词表：只要 note 自认有缺口，就不许直接转 done
const GAP = /未实现|待补|未接|未完成|未验收|仍待|未迁移|未复现|不完整|尚未|未做|未联动|未证明|不足以|仍缺|还缺|缺[：:]|缺 |待实现|未覆盖|未重写|未接入|只做到|仅做到|局部通过/;

const rows = [];
for (const it of items) {
  if (it.status !== 'partial') continue;
  const rs = it.reviewStages || {};
  const note = it.note || '';
  const frames = it.decodedFrames || 0;
  // 第 62 轮起 note 里带【卡点·X ...】：直接用它（人工归因），比关键词猜准。
  const tag = note.match(/【卡点·([A-E]) /);
  let cls;
  if (tag) cls = tag[1];
  else if (!rs.runtimeAccepted) cls = 'B';
  else if (GAP.test(note)) cls = 'C';
  else cls = 'A';
  rows.push({ id: String(it.id), cls, frames, impl: !!rs.implementationVerified, rt: !!rs.runtimeAccepted, note, where: it.where || '', scope: it.scope || '' });
}

const byCls = { A: [], B: [], C: [], D: [], E: [] };
rows.forEach((r) => byCls[r.cls].push(r));

const LABEL = {
  A: 'A · 机制未做（本仓无对应实现，可做但没做）',
  B: 'B · 缺原片美术资产（贴图/模型/动画/UI 稿，无源素材只能近似）',
  C: 'C · 原片算法未公开（配文与画面不足以反推）',
  D: 'D · 需接主管线（battle.js / 共享 World / 游戏语义）',
  E: 'E · 环境不具备（job/线程、主机性能、跨平台）',
};

const brief = (s, n = 150) => (s.length > n ? s.slice(0, n) + '…' : s).replace(/\n/g, ' ');

let md = `# partial 批次清单（自动生成，勿手改）\n\n`;
md += `- 生成时间：${new Date().toISOString()}\n- partial 总数：**${rows.length}**\n`;
md += `- A ${byCls.A.length} · B ${byCls.B.length} · C ${byCls.C.length} · D ${byCls.D.length} · E ${byCls.E.length}\n\n`;
md += `> 生成器：\`node tools/audit-partial.mjs --write\`。分类依据是 \`reviewStages\` + \`note\` 里的自认缺口词，不等于真实结论——A 类仍需逐片复核才能转 done。\n\n`;

for (const k of ['A', 'B', 'C', 'D', 'E']) {
  const list = byCls[k].sort((a, b) => a.frames - b.frames);
  md += `## ${LABEL[k]}（${list.length} 条）\n\n`;
  md += `| # | id | 帧 | impl | runtime | 落点 | 现状摘要 |\n|---|---|---|---|---|---|---|\n`;
  list.forEach((r, i) => {
    md += `| ${i + 1} | ${r.id} | ${r.frames} | ${r.impl ? '1' : '0'} | ${r.rt ? '1' : '0'} | ${brief(r.where, 60)} | ${brief(r.note, 120)} |\n`;
  });
  md += `\n`;
}

if (write) {
  const out = path.join(ROOT, 'learn/partial-backlog.md');
  fs.writeFileSync(out, md);
  console.log('written', out);
}

console.log(JSON.stringify(Object.fromEntries([['partial', rows.length], ...['A','B','C','D','E'].map((k) => [k, byCls[k].length])]), null, 1));
for (const k of ['A', 'B', 'C', 'D', 'E']) {
  console.log(`--- ${k}（按帧数升序，前 8）`);
  byCls[k].sort((a, b) => a.frames - b.frames).slice(0, 8).forEach((r) => console.log(` ${r.id} ${r.frames}f ${brief(r.note, 80)}`));
}
