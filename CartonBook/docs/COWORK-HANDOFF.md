# CartonBook 交接给 Cowork（2026-11-07）

用户要求：由 Cowork 负责按 `/Users/panglaohu/Downloads/CreateBookGuide.md`（副本 `docs/CreateBookGuide.md`）优化 CartonBook。
上一个会话只做了现状盘点，**未改任何代码、未截屏**。

> **2026-11-07 完成更新**：本章已由 Cowork 按下列顺序完成。新故事为《四盏灯，一封信》，24 张 8931 canvas 真截全部入书，双页封面 + 4 个内跨页已生成并通过浏览器 QA。成品：`http://127.0.0.1:8787/chapters/bookshop-letter/book.html`。当前状态以 `README.md`、`docs/CreateBookGuide.md` §3 与 `docs/QA-CHECKLIST.md` 为准；下方“现状”保留为接手时历史记录。

## 先读

1. `docs/CreateBookGuide.md`：六步规划、硬约束、当前状态
2. `README.md`、`docs/CAPTURE-CLEAN.md`、`docs/BOOKSHOP-CAMERA-STORY.md`（资产×镜头旧笔记，资产表可直接做物件清单的底稿）
3. `docs/MESSENGER-TIDE-LETTER.md` + `recipes/messenger-tide-letter.json`：**已成功的 8931 无 HUD 真截先例**（`manifest.realCapture=true`，`canvas-todataurl`），新章照这条路走

## 现状（已核实）

- 8931（游戏）、8787（书）服务都在跑，HTTP 200
- `chapters/bookshop-letter/` 仍是 fixtures：`manifest.mode="fixtures"`、`realCapture=false`，不能当正式交付
- `docs/BOOKSHOP-STORYBOARD.md` 是被用户否决的提纲版，待重写
- `docs/BOOKSHOP-OBJECT-INVENTORY.md` 还不存在
- shell PATH 里没有 node，需先设置：`export PATH="/Users/panglaohu/.workbuddy/binaries/node/versions/22.22.2-6/bin:$PATH"`
- Playwright 在 `../tools/shot/node_modules/playwright`
- 杂项可清理（先问用户）：`src/captureShots.mjs.bak-20261105`、根目录 `_smoke-8931.mjs`、三个 `.tgz`

## 要做的事（按指南顺序，不可跳）

1. **物件清单** → `docs/BOOKSHOP-OBJECT-INVENTORY.md`：从 8931 实景和 `TigerMessenger/src/` 书店镇相关源码（`bookshop*`、机器人、港、飞艇坞、Jakub 廊灯、招牌等）盘出全部可拍资产，每件写 id、用途、拟入哪一场戏。要覆盖多家书店、多台机器人
2. **剧本故事板**：重写 `docs/BOOKSHOP-STORYBOARD.md`，写成完整的故事而不是提纲，文风对齐 Moebius《Edena》。主冲突：书店们和机器人一起反抗莫比斯舰队，信使取信、潮气边境作为支线嵌进去，**每个物件都要用上**。放在书的第一页
3. **镜头表**：对齐 NYFA 导演/摄影/剪辑和 Edena 竖条节奏，写明景别、机位、时长感，落到新 recipe 的 `storyboard[].camera`
4. **8931 无菜单真截**：`cartonCapture=1` / `__tm.setCaptureMode(true)`，多角度拍，写入 `chapters/bookshop-letter/shots/`，`manifest.realCapture=true`，逐张肉眼检查有没有 HUD
5. **排版出书**：`node src/cli.mjs layout` + `export`，用 Edena 布局，图路径 `shots/`，在 http://127.0.0.1:8787/chapters/bookshop-letter/book.html 硬刷新确认

## 硬约束

- 画面只能来自游戏截屏，禁止文生图
- 正式页不能有任何 HUD（任务栏、小地图、fps、操作提示、「遥控」）
- 以 8931 最新书店镇实景为准，8765 端口不是本书，不要用
- 保留工作区未提交的修改，不从头重建


## 2026-11-07 后续检查点：两册实拍与长篇新页

书店镇：已替换fixtures，manifest为live；23个镜头、双页连续封面、逐页布局与4个内跨页。保留 `artifacts/bookshop-review/before/`。后续修改按现有产物继续，勿重跑layout-only覆盖实拍。

水晶城：用户新要求50页以上，已制作《把春天带回家》56页（2页封面+54页叙事）、28跨页、163分镜位置；独立阅读/故事板页面与56页PDF。入口README新册段。最终验收文件是 artifacts/crystal-rescue/browser-qa.json、pdf-qa.json、pdf-final/ 及 REVIEW.md；不把早期失败记录或旧接触表当最终通过。摄影用隔离游戏页，未改原存档。
