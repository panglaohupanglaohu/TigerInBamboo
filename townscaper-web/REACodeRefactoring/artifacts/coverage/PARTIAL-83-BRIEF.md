# 83 个「部分覆盖」模块补齐 · 子任务说明（第 53 批起）

目录（VM 路径）：
- 原版（只读，不许改）：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/townscaper-web/REACode
- 重构版（改这里）：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/townscaper-web/REACodeRefactoring
- 片子原文：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/REA-agent/gifs/README.md（每行：帖子ID [日期] 原文）。先按模块里引用的帖子 ID 找原文、理解后再动手，别学错。
- 清单：REACodeRefactoring/artifacts/coverage/partial-83.json（source / targets / gap / clips）。

每个模块的流程：
1. 读 REACode 原模块（src/<名>.js 或 engine/<名>.js，及同名 *lab.html）+ gap 文字 + README 原文。
2. 读重构版 targets 里的现有实现，判断缺口是否仍真实存在（有些 gap 已过时——那就写测试证明已覆盖）。
3. 在重构版补机制：优先放进已有共享模块或新建 src/<区>/<名>.js；接共享 World / grid / atlas 等，不要原样复制一个独立实验。
4. 写 node 测试 tests/<名>.mjs（纯 node，可跑）。需要 three 时用：
   `import { register } from 'node:module'; register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root,'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));` 然后 `await import('three')`；需要 document 时做个 Proxy 桩（参考 tests/stun-stars-boat-gore.mjs、tests/shrub-texture.mjs）。
5. 跑你写的测试 + 你改动文件相关的既有测试（tests/ 下 grep 引用），全部通过才算。
6. 本 VM 没有 Chrome：浏览器测试（*-browser.cjs）跑不了，不要声称浏览器验收。

红线：
- 不改 REACode；不写 learn/data.js、learn/coverage*.json、learn/pipeline.js、CHANGELOG.md、PIPELINE.md（记账由主会话统一做）。
- 另一个会话可能同时在改 src/badnorth/battle.js、src/world/view.js、src/world/traffic.js、src/world/contour-overlay.js、src/world/worldmesh.js：尽量不碰；非碰不可时，改前立刻重新读文件、只做最小插入（用 python 精确字符串替换），不要整文件重写。
- 不删任何文件。

交付：
- 在 artifacts/coverage/r53-<组名>.md 写一张表：模块 | 片子 | 原缺口 | 判定（缺口已过时 / 本轮补上 / 仍缺：原因）| 落点 | 测试。
- 最终回复（给主会话）只要一个 JSON 数组：[{ "source": "src/x.js", "verdict": "done" | "partial", "targets": [...], "gap": "一句话：做到哪、还缺什么", "tests": ["tests/x.mjs"] }]，外加一句总结。done = 机制已接进共享系统且 node 测试证明；仍有实质缺口就 partial 并写清缺什么。实事求是，别把没做的标 done。
