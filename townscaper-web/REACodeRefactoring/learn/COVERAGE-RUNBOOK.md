# 逐帧覆盖长跑手册（COVERAGE-RUNBOOK）

> 这份文件是定时任务的**唯一依据**。每一轮先读完它，再动手。不要凭记忆、不要跳步。
> 目标：把逐帧覆盖从 175/285 推到 285/285，一小时一轮，一轮 4 条，24 小时不停。

## 0. 口径（不要放宽，一放宽账就虚）

一条片子算「已核」必须**同时**满足四条，这四条由 `tools/update-learning-counts.py` 强制执行：

1. `artifacts/coverage/<id>/frames.json` 存在，且 `decoded > 0`；
2. `learn/data.js` 里该条 `decodedFrames` 等于 `frames.json` 的 `decoded`；
3. `learn/data.js` 里该条 `reviewEvidence` 指向的文件真实存在；
4. 该 `id` 在 `../../REA-agent/gifs/` 里有对应 mp4。

**没看过画面不算核过。** 只看原文、只读代码、只跑页面，都不算。

## 1. 开工（每条刷新，约 30 秒）

```bash
cd /Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring
node tools/coverage-lock.mjs status      # 退出码 0 才能开跑；3 表示上一轮还在跑 → 直接结束本轮
pmset -g | grep -E "^[[:space:]]*sleep" | sed 's/^[[:space:]]*//'   # 必须是 sleep 0；否则本轮开头就报出来
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8769/index.html   # 非 200 就用守护起：node tools/serve-guard.mjs 8769
ps -eo pid,etime,command | grep "serve\.py 8769" | grep -v grep                 # 已跑满 6 小时 → 重启（跑老的 serve.py 会 reset，伪装成测试超时）
node tools/coverage-lock.mjs start <本轮时间戳>
node tools/coverage-queue.mjs --take 4
```

`sleep` 不是 0 时**不要停下来去改**（改它要 sudo 密码，定时任务拿不到），只在收尾回复的**第一行**写：

> ⚠️ 系统睡眠为 `<值>`，今夜可能丢轮次，请执行 `sudo pmset -a sleep 0 disksleep 0`

机器真睡了只会丢那一小时（队列、锁、记账都是现算的，不会错账），所以不用补跑，直接从队列取下一批。

`coverage-lock.mjs status` 返回 **BUSY** 时，本轮**立刻结束**，不做任何事——两个进程同时改 `learn/data.js` 会互相覆盖。

## 2. 每轮只做 4 条，按类型分三条路

队列里每条都带 `status`，按它分支，**不要搞反**：

### A. `na` / `ref`（低价值：早判过与技术无关，但没证据）
目的只是把账做实，不写代码。

1. `python3 tools/extract-review-frames.py <id>`
2. 用 ViewImage 看 `artifacts/coverage/<id>/sheet-00.jpg`（100 帧一张，一般 1–3 张）
3. 写 `artifacts/coverage/<id>-review.md`：画面内容、判定理由（为什么与技术无关 / 是什么参考）
4. 记账，**status 保持原值**：
   ```bash
   node tools/record-review.mjs --id <id> --frames <decoded> \
     --evidence artifacts/coverage/<id>-review.md --status na \
     --note "<帧数>帧全核；<画面内容>，确认与原版实现无关" --scope "不涉及实现"
   ```
5. 如果看了发现**其实有机制**（原文写的是技术内容），改走 C 路径，`--status partial`，并把 `--where` 加上真实落点。

### B. `done` / `partial`（代码已有，缺全帧证据）
这是最容易被糊弄过去的一类，必须补真证据。

1. 抽帧、看联系表，**逐帧过一遍**（联系表至少全看，关键帧回看原尺寸）
2. 打开 `where` 指向的模块和对应实验页，确认代码做的**确实是片子里那件事**；不一致就在 `note` 里写清差在哪
3. 写 `artifacts/coverage/<id>-review.md`：原文摘要、逐帧观察、代码落点、做了什么/缺什么、跑过的命令与结果
4. 记账：
   ```bash
   node tools/record-review.mjs --id <id> --frames <decoded> \
     --evidence artifacts/coverage/<id>-review.md --status partial \
     --note "<帧数>帧全核；<做到哪>；<还缺什么>" \
     --where "<模块> · <实验页>" --scope "<验收范围>" --impl 1 --runtime 1 --native 1,40,<末帧>
   ```
   只有**真的跑过实验页并看过截图**才给 `--runtime 1`；只读了代码给 `--impl 0`。全片核完且代码等价可给 `--status done`。

### C. 完全未登记（23 条 2016–17 老片，无原文）
1. 先抽帧看，**先判读再动手**：写清画面里是什么（地形？建筑？UI？纯美术？）
2. 判为展示/纯美术 → 按 A 记账，`--status ref`
3. 判出机制 → 找已有模块能否承载：
   - 能承载 → 补代码 + 加/改实验页入口 + 跑测试，按 B 记账
   - 承载不了 → 新建 `src/<模块>.js` + `<模块>.html`，跑浏览器测试，记账 `--status partial`
4. 新建记录：`data.js` 里没有这条 ID 时先补一条 item（`projects/topics` 照现有取值），再记账

## 3. 写证据的最低要求

`artifacts/coverage/<id>-review.md` 必须包含：

```md
# <id> · <原文首句或"无原文（2016 老片）">

- 帧数 / fps / 时长：<decoded> 帧 / <fps> / <秒>s
- 联系表：sheet-00.jpg …（看的页码全列）
- 原文：<英文原文，无则写"无">

## 逐帧观察
<按帧号区间写画面变化，不要写"画面在动"这种废话>

## 判定
<有机制 / 无机制；有机制则写清机制是什么>

## 代码落点与差距
<模块、函数；做到哪、缺什么>

## 验证
<跑过的命令 + 结果；没跑就写"未跑">
```

## 4. 验收

改代码就必须有测试，两条至少跑一条：

```bash
node tests/<name>.mjs                                              # 纯逻辑
NODE_PATH=/tmp/pw-shim:/Users/panglaohu/Downloads/TigerInBamboo/REA-agent/node_modules \
  node tests/<name>-browser.cjs                                    # 浏览器（本机只有 playwright-core，需要 shim）
```

`/tmp/pw-shim/playwright` 若不存在就重建：

```bash
mkdir -p /tmp/pw-shim/playwright && printf '{"name":"playwright","version":"1.0.0","main":"index.js"}' > /tmp/pw-shim/playwright/package.json && printf "module.exports = require('playwright-core');\n" > /tmp/pw-shim/playwright/index.js
```

截图验收：`artifacts/coverage/<name>-<grid>.png`，必须用 ViewImage 看过，不许只信 exit code。

## 5. 记账纪律

- **只准用 `tools/record-review.mjs`**，不要手改 `learn/data.js` 和 `learn/coverage-progress.json`；
- 先写证据、先跑测试，**再**记账；顺序反了就是造假；
- `--frames` 必须等于 `frames.json` 的 `decoded`，脚本会校验，不匹配直接报错；
- 没跑到运行验收就不许 `--runtime 1`；没全片看过就不许 `--status done`。

## 6. 收尾（每轮必做，约 2 分钟）

1. `CHANGELOG.md` 顶部插一条，格式照现有条目：
   `## <ISO 时间> · <一句话>` + 下面写本轮新增 N 条、做到哪、缺什么、跑过的测试；
2. 更新 `learn/coverage-progress.json` 的 `next`（把本轮做完的删掉，把新发现的缺口写进下一组）和 `latest`；
3. `node tools/coverage-queue.mjs --write` 刷新 `learn/coverage-queue.json`；
4. `node tools/coverage-lock.mjs end`；
5. 在回复里给出：本轮编号、做了哪 4 条、总账从 X/285 到 Y/285、剩多少。

## 7. 红线

- 不 `git commit` / `git push`；
- 不动 `../../REA-agent/`（只读 gifs）、不动 `../REACode/`（旧版只读）、不动 `.workbuddy/`；
- 不改 `PIPELINE.md`（由 `tools/gen-pipeline-md.mjs` 生成，改了会被覆盖）；
- 不删 `artifacts/coverage/` 下任何东西；
- 一轮最多 4 条，**超时 90 分钟强制收尾**，没做完的写进 `next` 留到下一轮，不许无限重试；
- 单条重试上限 2 次，仍失败就把失败原因写进 `note`，`--status` 保持原值，不许标 done。
