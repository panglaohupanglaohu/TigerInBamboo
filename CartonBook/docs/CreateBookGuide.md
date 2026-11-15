# CreateBookGuide · 书店镇漫画制作指南

更新日期：2026-11-06（Asia/Shanghai）  
实景源：**http://localhost:8931/TigerMessenger/**（唯一正式画面来源）  
浏览书：http://127.0.0.1:8787/chapters/bookshop-letter/book.html  

---

## 1. 整体规划（正确顺序，不可跳）

| 步 | 名称 | 做什么 | 完成标准 |
|----|------|--------|----------|
| 0 | **导演技能约束** | 先物件 → 再剧本故事板 → 学完导演/摄影/剪辑再拍；学 Edena；截屏零菜单 | 技能文档可查 |
| 1 | **物件清单** | 从 8931 / 源码注释盘清书店镇全部可拍资产（多店、多机器人、港、飞艇、廊、灯、招牌等） | 每件有 id、用途、拟入哪一戏 |
| 2 | **剧本故事板** | 按物件写**故事**（不是提纲）：时地人、曲折、细节、动人场、结局；**每个物件都要用上**；主冲突＝书店们与机器人共同反抗莫比斯舰队；文风对齐莫比斯《Edena》 | 第一页可一口气读完 |
| 3 | **导演 / 摄影 / 剪辑研习** | NYFA 导演系 → 摄影 → 剪辑；Edena 分镜与竖条节奏 | 镜头表可执行（景别/机位/时长感） |
| 4 | **无菜单真截** | 连 **8931**；`cartonCapture=1` / capture-clean；关 HUD；多角度按镜头表拍 | `manifest.realCapture=true`，肉眼无菜单 |
| 5 | **排版出书** | Edena 布局写入 `book.html`；图路径 `shots/`；8787 可翻 | 硬刷新可见正式页 |

硬约束：

- 画面**只能**来自游戏截屏，禁止文生图。
- 正式页**禁止**任务栏 / 小地图 / fps / 操作提示 /「遥控」等任何 HUD。
- 以本机 **8931** 最新书店镇实景为准，旧 fixture / 过时样貌不得冒充正式画面。

---

## 2. 现在是如何做的

当前流水线落在本机：

```
/Users/panglaohu/Downloads/TigerInBamboo/CartonBook/
  docs/          ← 本指南与 Edena / 镜头 / 截屏规范
  chapters/bookshop-letter/  ← 样章书壳 + shots/
  recipes/       ← 拍摄配方
  src/captureShots.mjs 等 ← 连拍脚本（应对 8931）
```

服务：

| 端口 | 用途 |
|------|------|
| **8931** | TigerMessenger 游戏实景（截屏源） |
| **8787** | CartonBook 静态书（给人翻） |
| 8765 | **不是**本书；本机曾被 Townscaper 占用，勿用 |

拍摄入口：对 `http://localhost:8931/TigerMessenger/` 开 capture-clean，按故事板镜头表多角度截屏，写入 `chapters/bookshop-letter/shots/`，再刷新 `book.html`。

叙事设定（用户确认过的）：

- 8931 场景里有**多家书店**、**多台机器人**。
- 他们**共同反抗莫比斯舰队**。
- 信使取信 / 潮气边境等支线要嵌进这条主冲突，且物件表全覆盖。

---

## 3. 当前完成状态（2026-11-07）

| 步 | 状态 | 说明 |
|----|------|------|
| 0 导演原则 | **完成** | 已落到逐镜景别、机位、读格时长和页面节奏 |
| 1 物件清单 | **完成** | `BOOKSHOP-OBJECT-INVENTORY.md` 覆盖四店、机器人、港、双货船、飞艇、廊灯、招牌、舰队与云墙 |
| 2 剧本故事板 | **完成** | 《四盏灯，一封信》：舰队索书 → 联藏约取信与三店联署 → 机器人守路 → DUKE 交付；完整故事位于序页 |
| 3 导演/摄影/剪辑研习 | **完成** | 双页封面、独立书叶、前景框景、肩部反打、同主体战后回扣和竖条节奏已入书 |
| 4 8931 无菜单真截 | **完成** | 24 张 canvas 真截，`realCapture=true`，逐张 HUD 与肉眼验收；s19/s23 另经补拍替换 |
| 5 正式漫画书 | **完成** | 双页封面 + 序页 + 7 个故事叶，合成 4 个内跨页；24 张图全部进入 `book.html` |

成品：http://127.0.0.1:8787/chapters/bookshop-letter/book.html 。浏览器 QA、24 镜覆盖、双页封面、视觉门禁、图片路径和导航回归均通过。

---

## 4. 后续维护（不跳过验收）

1. 改故事或机位后重跑 `plan` / `capture`；live 失败只看暂存区，正式好书不会被覆盖。  
2. 自动检查之后逐张肉眼验收，并更新 `manifest.visualReview.approvedShotIds`。  
3. 重跑 `layout` / `export` / `npm test`，再用浏览器逐跨页检查。  
4. fixtures 仅可进入 `artifacts/layout-only/`，不得覆盖正式章节。

---

## 5. 相关文档

- `BOOKSHOP-CAMERA-STORY.md` — 资产 × 镜头旧笔记  
- `BOOKSHOP-STORYBOARD.md` — 《四盏灯，一封信》完整故事与逐镜表  
- `EDENA-STUDY.md` / `EDENA-APPLY.md` / `EDENA-CAMERA-STUDY.md`  
- `CAMERA-GRAMMAR.md` / `CAPTURE-CLEAN.md`  
- `MESSENGER-TIDE-LETTER.md` — 另一章参考（曾做过 8931 真截）

