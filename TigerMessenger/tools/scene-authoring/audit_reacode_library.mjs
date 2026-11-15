/** Regenerate human-readable inventory from the same physical parser as the live workshop API. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {scanCodeLibrary} from '../refactor/scan-code-library.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),game=path.join(root,'TigerMessenger'),report=await scanCodeLibrary();
const out=path.join(game,'artifacts/code-library-rebuild-20261113');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'library-inventory.json'),JSON.stringify(report,null,2)+'\n');
const group={};for(const m of report.modules){const g=group[m.directory]??={count:0,exports:0,drift:0};g.count++;g.exports+=m.exports.length;g.drift+=m.gameCopy==='different';}
let md='# REACodeRefactoring 实际代码能力库\n\n能力库指整个 REACodeRefactoring；registry 只是其中的执行适配入口。扫描不执行源模块，使用 esbuild 解析真实导出和依赖。\n\n'+`生成时间：${report.generatedAt}；快照：${report.snapshotId}。\n\n`+Object.entries(report.counts).map(([k,v])=>`${k}: ${v}`).join(' · ')+'\n\n| 目录 | 模块 | 导出接口 | 游戏旧副本不同 |\n|---|---:|---:|---:|\n';
for(const [dir,g]of Object.entries(group))md+=`| src/${dir} | ${g.count} | ${g.exports} | ${g.drift} |\n`;
md+='\n代码存在、来源学习、执行适配、运行核验分别记录。上下文仅为静态线索；旧vendor不是最新库。全量原版差异见 [REACODE_LIBRARY_ALIGNMENT.md](REACODE_LIBRARY_ALIGNMENT.md)。\n\n| 实际模块 | 导出接口 | 上下文线索 | 游戏旧副本 |\n|---|---|---|---|\n';for(const m of report.modules)md+=`| ${m.path} | ${m.exports.join(', ')||'入口/副作用模块'} | ${m.context} | ${m.gameCopy} |\n`;
fs.writeFileSync(path.join(game,'docs/REACODE_REFACTORING_LIBRARY_INVENTORY.md'),md);
let diff='# REACode → REACodeRefactoring 逐文件差异\n\n'+`扫描 ${report.generatedAt}，原版 ${report.alignment.length} 文件；物理落点缺失 ${report.counts.missingTargets}。原件只读。\n\n`+'同名导出匹配只是兼容线索；改名、合并、拆分不能机械判为未实现。有候选落点不代表行为等价，仍保留当前coverage缺口与历史有效范围。\n\n| 原版代码 | 当前差异状态 | 候选落点 | 未匹配原导出（需核对改名） | 剩余行为缺口 |\n|---|---|---|---|---|\n';
for(const r of report.alignment)diff+=`| ${r.source} | ${r.status} | ${r.targets.filter(t=>t.exists).map(t=>t.path).join(', ')||'无'} | ${r.unmatchedExports.join(', ')||'—'} | ${r.gap.replaceAll('|','/').replaceAll('\n',' ')} |\n`;
fs.writeFileSync(path.join(game,'docs/REACODE_LIBRARY_ALIGNMENT.md'),diff);console.log(JSON.stringify(report.counts));
