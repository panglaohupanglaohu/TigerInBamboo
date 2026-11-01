// 从 learn/pipeline.js 生成 PIPELINE.md：node tools/gen-pipeline-md.mjs
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../learn/pipeline.js', import.meta.url), 'utf8');
const window = {}; new Function('window', src)(window);
const P = window.PIPELINE, S = P.statusName;
let md = `# PIPELINE — 管线与学习路线（由 learn/pipeline.js 生成，别手改）\n\n## 审核说明\n\n按用户确认口径，快速静态对比确认有代码主体改进差异的条目标记为已重构，保留历史学习成果，无需全部从头学习。部分实现仍列缺口；静态确认与本轮逐帧、运行验收分别记录。完整 285 段清单见 refactoring-audit.html，模块对比见 learn/module-comparison.json。\n\n## 判断\n\n**${P.verdict.title}**\n\n`;
for (const [id, t] of P.verdict.points) md += `- \`${id}\` ${t}\n`;
md += `\n## 学习路线\n\n`;
for (const r of P.roadmap) {
  md += `### ${r.step}. ${r.name}（${S[r.status] || r.status}）\n\n${r.why}\n\n- 要学的视频：${r.study.map((i) => '`' + i + '`').join('、')}\n`;
  if (r.reuse?.length) md += `- 可以直接用的代码：\n${r.reuse.map((x) => '  - `' + x + '`').join('\n')}\n`;
  md += `- 验收：${r.check}\n\n`;
}
md += `## 四条管线\n\n`;
for (const l of P.lanes) {
  md += `### ${l.name}\n\n${l.note || ''}\n\n| 分组 | 步骤 | 帖子 | 状态 | 代码 |\n|---|---|---|---|---|\n`;
  for (const [g, items] of l.groups) for (const it of items)
    md += `| ${g} | ${it.name} | \`${it.id || ''}\` | ${S[it.status] || it.status} | ${it.where ? '`' + it.where + '`' : ''} |\n`;
  md += '\n';
}
fs.writeFileSync(new URL('../PIPELINE.md', import.meta.url), md);
console.log('PIPELINE.md', md.length);
