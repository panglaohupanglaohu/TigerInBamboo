# 剩余 190 条「partial」片子做完 · 子任务说明（第 56 批）

用户要求：REACode 对应 285 段视频，把 REACodeRefactoring 里 285 个片子的代码重构做完。现状：done 59 / partial 190 / ref 14 / na 22。
本批把 190 条 partial 按主题分 11 组。你的清单在 REPO/artifacts/coverage/clips-r56-<组名>.json（id / title / note / where / scope / reviewEvidence / decodedFrames）。
**note 里「缺…」就是这条片子的待办**——注意有些 note 可能已过时（后续轮次 / 第 53、55 批已经补过），先核实现状再动手。

## 目录（VM 路径）
- REPO = /sessions/optimistic-magical-dirac/mnt/TigerInBamboo/townscaper-web/REACodeRefactoring（改这里）
- 原版只读：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/townscaper-web/REACode
- 片子：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/REA-agent/gifs/<id>.mp4，原文 README.md（帖子ID → 原文）。**先读原文，再看帧，别学错。**
- 已抽好的帧：REPO/artifacts/coverage/<id>/frame-*.jpg、sheet-*.jpg（联系表）、frames.json；旧核验 REPO/artifacts/coverage/<id>-review.md 或 reviewEvidence。用 Read 工具看联系表（主机路径 /Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring/artifacts/coverage/<id>/sheet-00.jpg）。
- 模块状态：REPO/MODULE-REFACTOR-STATUS.md；上批报告 artifacts/coverage/r55-*.md（很多能力刚接进主场景，开关 ?shade= / ?fx= / Battle 的 battle-g3 选项）。

## 浏览器验收（VM 有 headless Chromium + WebGL）
```
cd REPO && (python3 -m http.server <端口> >/dev/null 2>&1 &) ; sleep 1; \
python3 tools/shot.py "http://localhost:<端口>/index.html?..." artifacts/coverage/shots-r56/<id>-<名>.png --wait 8000 --eval "..."
```
- 服务器不跨 bash 调用存活，每次在同一命令里起。端口：C01=8801 … C11=8811（按组号）。
- 截图必须 Read 打开看，并与片子联系表对照；控制台零 error。

## 每条片子的流程
1. 读原文 + 联系表 + 旧 note，列出片子展示的机制与「缺」清单，核实哪些已被后续工作补上。
2. 在共享系统里补齐（World / grid / View / Battle / 演示页）。主场景新效果默认关（开关 / URL 参数），打开后正确。缺原美术的用程序化替代并写明——这不阻碍 done，只要片子的**机制**复现了。
3. node 测试 tests/<名>.mjs（参考 tests/stun-stars-boat-gore.mjs 的 three 钩子与 document Proxy）。
4. 浏览器截图验收，与原片对照。
5. 在旧核验 md（或新建 artifacts/coverage/<id>-r56.md）末尾追加「第 56 批」段：做了什么、落点、测试、截图、对照结论。

## 文件冲突规则（11 组并行 + 另一个会话）
- src/world/view.js、src/badnorth/battle.js、src/world/worldmesh.js、src/world/app.js、index.html 是热点：**逻辑写进你自己的新文件**（如 src/badnorth/battle-c01.js、src/world/view-c07.js），热点文件里只加最少的挂钩行；每次编辑前重新 Read，用 Edit 精确替换，绝不整文件重写；编辑失败就重读再试。
- 改共享模块（src/core/*.js 等）保持旧行为不变（新参数默认关），改完跑引用它的测试。
- 最后跑全量：`for f in tests/*.mjs; do timeout 120 node $f >/dev/null 2>&1 || echo FAIL $f; done`。别组正在改导致的失败要注明，不要去改别组的文件。

## 红线
- 不改 REACode、REA-agent、.workbuddy；不 git commit/push；不删文件。
- **不写 learn/data.js**（不要跑 record-review.mjs —— 11 组并发写会互相覆盖，主会话统一记账），不写 learn/coverage*.json、learn/pipeline.js、CHANGELOG.md、PIPELINE.md、MODULE-REFACTOR-STATUS.md、GAP-PRIORITIES.md。

## 交付
- REPO/artifacts/coverage/r56-<组名>.md：每条片子一节（原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图）。
- 最终回复只要一个 JSON 数组 + 一句总结：
  `[{"id":"…","status":"done"|"partial","note":"中文一句：N帧全核；做到哪；（partial 时）缺什么","where":"src/… · xxx.html","scope":"验收范围短语","impl":1,"runtime":1|0,"native":[可选：本轮原尺寸回看的帧号],"tests":[…],"shots":[…]}]`
- done 标准：片子展示的每项机制都在重构版共享系统里复现（或证明不属于该片 / 已过时），node 测试过，**浏览器截图看过且与原片对照一致**。做不到的写清原因标 partial。实事求是——宁可 partial 写清楚，也不要把没做的标 done。runtime=1 只在你真的截图看过时。
