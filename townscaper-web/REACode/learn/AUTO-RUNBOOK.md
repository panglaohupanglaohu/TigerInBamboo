# AUTO-RUNBOOK — 无人值守学习一条片子批次

> 这份文件是定时任务唯一的说明书。每次运行都从「第 1 步」开始，不要凭记忆。
> 目标：把 142 段没学完的片子学完，一批 12 条，账要能对上。

## 0. 身份与位置

- 代码根：`/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode`
- 待学队列：`learn/queue.json`（142 条，已按主题排好：fx → grid → light → terrain → texture → build → life → water → tools → 48 条老片）
- 进度状态：`learn/progress.json`
- 帖子原文：`learn/data.js`（`window.LEARN.items[].text`）
- 抽帧结果：`tmp/cap/<id>/f00.png …`
- 总表截图：`/tmp/batch-<start>.png`

## 1. 环境（每次都先确认，别假设还活着）

```bash
# 静态服务：根必须是 REACode，端口 8817
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8817/tools/player.html
# 不是 200 就后台起一个（Bash 工具 run_in_background=true，不要用 nohup/&）
cd /Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode && python3 -m http.server 8817 --bind 127.0.0.1
```

## 2. 这一轮做什么（只看这个决定）

1. 读 `learn/progress.json`。
2. `batches` 里存在 `verified: false` 的最早一条 → **先补它**（补代码或补截图），不要开新批。
3. 全部 verified → 取 `nextIndex` 起 12 条，把 `nextIndex += 12`。

一轮只做 **一批**。目标 25 分钟收工，超过 40 分钟强制收尾（写清楚做到哪一步），不许跨批硬撑。

## 3. 抽帧 + 读画面

```bash
cd /Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACode
node tools/batch.mjs <start> 12 6 2
```

输出 `/tmp/batch-<start>.png`（12 行 × 6 帧）+ 每条原文 200 字。
**必须**用 ViewImage 读这张图。只看原文不看画面 = 违规（GUIDE 第 1 条）。
总表看着糊时，直接看单帧 `tmp/cap/<id>/f01.png` 放大。

## 4. 落代码

- **新建文件**，一两条视频一个机制，`src/<名字>.js` + 根目录 `<名字>lab.html`。
- 严禁修改这几个正在被别人写的文件：`scene.js`、`townmesh.js`、`halfedge.js`、`app.js`、`pipeline.js`。需要它们的接口就只 import。
- 文件头注释必须写：帖子 ID + 原文英文引文 + 为什么这么做。没写 ID 的不算学完。
- 拿不准机制时，宁可只写一个能跑的最小实验，也不要把猜测写成注释里的结论。

## 5. 验收（没有截图 = 没学完）

```bash
node tools/shot.mjs "http://127.0.0.1:8817/<name>lab.html?v=1" /tmp/<name>.png 1280 800
```

- 看 stderr 有没有 `pageerror`；有就修，不能带病记账。
- 用 ViewImage 看截图：物体在不在视野内、有没有穿模/悬空、UI 有没有压住内容。
- 机位不对就改机位重截，最多重试 2 次。仍失败 → 该批 `verified:false` + note 写原因，下一轮再来，不许循环死磕。

## 6. 记账（顺序不能反：先验收，后记账）

```bash
# 已登记条目
node tools/mark.mjs <start> 12 --status game \
  --where "src/<name>.js / engine/<maybe>.js" \
  --note "已落地：<一句话说清机制>"

# 48 条老片（data.js 里没有的）先补记录，再标状态
node tools/add.mjs --ids <id1>,<id2> --topic <fx|grid|...> --project badnorth --status todo --note "画面：…"
```

- 只做了一半就写 `partial`，别写 `game`。
- 状态词只有：`game` / `both` / `engine` / `partial` / `ref` / `todo` / `na`。

## 7. 收尾（三件事都做完才算这一轮结束）

1. 更新 `learn/progress.json`：把这一批 `verified` 改 true、`code` 填文件名、`nextIndex` 前移；`runs` 里追加
   `{"at":"<ISO 时间>","start":N,"segments":12,"module":"src/x.js","verified":true}`
2. 追加 `learn/RUNLOG.md`（不存在就建）一句话：时间 / 批次 / 覆盖了哪几条 / 产出文件 / 验收结果。
3. 报告本轮：学了哪 12 条、加了什么文件、还剩多少条。

## 8. 红线

- 不跑 `git`（这个目录没有仓库，另一个会话在同目录工作）。
- 不动 `gifs/`、不删任何 mp4。
- 不用 `rm -rf`，不碰家目录。
- 不伪造验收结论；截图没通过就如实写 `verified:false`。
- 一轮只做一批，宁可慢，不许把 3 批的帧抽完却一条代码没写。
