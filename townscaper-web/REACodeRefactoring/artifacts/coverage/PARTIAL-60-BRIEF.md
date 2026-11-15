# 剩余 60 个「部分覆盖」模块做完 · 子任务说明（第 55 批）

用户要求：「60 个做完」。第 53 批已给每个模块补了机制并写了缺口（见 artifacts/coverage/partial-60.json 的 gap 字段与 r53-G*.md）。
本批目标：**把缺口真正关掉**——接进主场景（View / WorldMesh / Battle / 演示页），并做**浏览器验收**。

## 目录（VM 路径）
- 原版（只读）：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/townscaper-web/REACode
- 重构版（改这里）：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/townscaper-web/REACodeRefactoring （下称 REPO）
- 片子原文：/sessions/optimistic-magical-dirac/mnt/TigerInBamboo/REA-agent/gifs/README.md（帖子ID → 原文）；mp4 在同目录，需要时可用 ffmpeg 抽帧看（`~/.cache/ms-playwright/ffmpeg-1013/ffmpeg-linux` 或系统 ffmpeg）。先读原文再动手，别学错。
- 清单：REPO/artifacts/coverage/partial-60.json；上批报告 REPO/artifacts/coverage/r53-G1..G5-*.md。

## 新能力：VM 里现在有 headless Chromium + WebGL（SwiftShader）
```
cd REPO && (python3 -m http.server <你的端口> >/dev/null 2>&1 &) ; sleep 1; \
python3 tools/shot.py "http://localhost:<端口>/index.html?..." artifacts/coverage/shots-r55/<名>.png --wait 6000 --eval "JSON.stringify(window.__something)"
```
- 服务器进程不跨 bash 调用存活：**每次截图在同一条命令里起服务**。端口：G1=8791 G2=8792 G3=8793 G4=8794 G5=8795。
- shot.py 输出 JSON：eval 结果 + 控制台 error/warn。**截图必须用 Read 工具打开看**（路径 /Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring/artifacts/coverage/shots-r55/<名>.png），确认画面对、无报错，才能算浏览器验收。SwiftShader 慢，wait 给足（6–15 s）。
- 现有 *-browser.cjs 测试若用 puppeteer/playwright，可酌情改用 shot.py 或 python playwright 跑（`export LD_LIBRARY_PATH=~/deblib/usr/lib/aarch64-linux-gnu`，launch 参数 `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`）。

## 每个模块的流程
1. 读 gap、上批报告、REACode 原模块 + README 原文。
2. 关缺口：接进主场景时**默认关**（toggle / URL 参数 / 面板复选框），打开后效果正确；新增演示页或改现有演示页都行。缺原美术素材的，用程序化替代并写清楚。
3. node 测试 tests/<名>.mjs（参考 tests/stun-stars-boat-gore.mjs 的 three resolve 钩子与 document Proxy）。
4. 浏览器验收：打开开关截图 + 关掉对比（或 eval 出的度量），Read 看过。shader 编译错误在控制台里能看到——必须零 error。
5. 跑 `for f in tests/*.mjs; do node $f >/dev/null 2>&1 || echo FAIL $f; done` 中与你改动相关的那些（最后全跑一遍更好）。

## 文件归属（避免并行冲突）
- **src/world/view.js 只有 G1 可以多处修改**；G2 只能在 view.js 里加「一行 import + 一处调用」（挂到你自己的新文件 src/world/view-post-extras.js 等），改前必须重新 Read。其他组不碰 view.js——需要接 View 的，写进自己的文件，在报告里写清楚接法。
- src/world/worldmesh.js、src/badnorth/battle.js：另一个会话也在改。改前重新读，只用精确字符串替换做最小插入，不整文件重写。battle.js 归 G3，worldmesh.js 归 G2。
- index.html / 面板：G1 负责 view 面板复选框；其他组若需要加面板项，在自己的报告写明，或只加 URL 参数。

## 红线
- 不改 REACode、REA-agent、.workbuddy；不 git commit/push；不删文件。
- 不写 learn/data.js、learn/coverage*.json、learn/pipeline.js、CHANGELOG.md、PIPELINE.md、MODULE-REFACTOR-STATUS.md（主会话统一记账）。

## 交付
- REPO/artifacts/coverage/r55-<组名>.md：模块 | 片子 | 原缺口 | 本轮做了什么 | 判定 | 落点 | node 测试 | 浏览器截图（文件名 + 看到了什么）。
- 最终回复只要一个 JSON 数组：`[{ "source": "src/x.js", "verdict": "done"|"partial", "targets": [...], "gap": "一句话：做到哪、（若 partial）还缺什么", "tests": [...], "shots": [...] }]` + 一句总结。
- done 的标准：缺口里列的每一项都关了（或证明已过时），接进共享系统，node 测试过，**且有浏览器截图看过**。真做不到的（例如需要原美术素材、需要真 GPU 性能数据），写清原因标 partial——实事求是，不要把没做的标 done。
