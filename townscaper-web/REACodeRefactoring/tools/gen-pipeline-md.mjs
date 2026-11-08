// 从 learn/pipeline.js 生成 PIPELINE.md：node tools/gen-pipeline-md.mjs
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../learn/pipeline.js', import.meta.url), 'utf8');
const window = {}; new Function('window', src)(window);
const P = window.PIPELINE, S = P.statusName;
const progress = JSON.parse(fs.readFileSync(new URL('../learn/coverage-progress.json', import.meta.url), 'utf8'));
const coverage = JSON.parse(fs.readFileSync(new URL('../learn/coverage.json', import.meta.url), 'utf8'));
let md = `# PIPELINE — 管线与学习路线（由管线与共享进度数据生成，别手改）\n\n## 审核说明\n\n按用户确认口径，快速静态对比确认有代码主体改进差异的条目标记为已重构，保留历史学习成果，无需全部从头学习。部分实现仍列缺口；静态确认与本轮逐帧、运行验收分别记录。完整 285 段清单见 refactoring-audit.html，模块对比见 learn/module-comparison.json。\n\n## 判断\n\n**${P.verdict.title}**\n\n`;
const latest = progress.latest;
const pace=progress.learningPace;

let current = `## 最新进度（${progress.updatedAt}）\n\n原版 ${coverage.modules.length} 个模块：${Object.entries(coverage.counts).map(([k,v])=>`${k} ${v}`).join('；')}。\n\n`;
if(progress.session?.status==='active') current += `本轮8小时迁移进行中，至 ${progress.session.endsAt}；本会话新增 ${pace.reviewedClips-progress.session.baselineReviewed} 段，当前实测 ${progress.session.actualClipsPerElapsedHour??0} 段/小时。逐帧记录 ${pace.reviewedClips}/${pace.totalClips}，剩余 ${pace.remainingClips}；已学片迁移不重复计数，代码验收另列。\n\n`;
else if(progress.session?.status==='paused') current += `8小时窗口已结束，任务已暂停。本会话新增 ${progress.session.newReviewedClips} 段（${progress.session.baselineReviewed}→${progress.session.reviewedNow}），按8小时为 ${progress.session.actualClipsPerHour} 段/小时。逐帧记录 ${pace.reviewedClips}/${pace.totalClips}，剩余 ${pace.remainingClips} 段；代码覆盖仍未全部完成。\n\n`;
else if(pace) current += `逐帧记录 ${pace.reviewedClips}/${pace.totalClips}，剩余 ${pace.remainingClips} 段；目标 ${pace.targetClipsPerHour} 段/小时，${pace.goalHours} 小时窗口至 ${pace.targetAt}。窗口内实际新增速率 ${pace.actualClipsPerHour??0} 段/小时。逐帧核验和代码验收分别记账。\n\n`;
if (latest) current += `**${latest.title}**\n\n${latest.summary}\n\n[本轮证据](${latest.evidence}) · [完整映射](MODULE-MAP.md) · [接手指南](GUIDE.md)\n\n${latest.links.map(l=>`[${l.label}](${l.href})`).join(' · ')}\n\n`;
current += `### 近期完成\n\n${progress.completed.slice(-8).map(t=>'- '+t).join('\n')}\n\n### 后续学习与缺口\n\n${progress.next.map(t=>'- '+t.title+'：'+t.clips.map(id=>'`'+id+'`').join('、')).join('\n')}\n\n`;
md = md.replace('## 判断\n', current + '## 判断\n');
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
