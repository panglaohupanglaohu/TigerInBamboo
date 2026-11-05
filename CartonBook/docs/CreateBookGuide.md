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

## 3. 做到哪一步了（诚实状态）

| 步 | 状态 | 说明 |
|----|------|------|
| 0 导演原则 | **进行中** | 原则已反复确认；需写入导演技能并严格执行 |
| 1 物件清单 | **未完成** | 有部分资产笔记（`BOOKSHOP-CAMERA-STORY.md`），尚未做成「全量物件表 + 每件对应戏」的验收清单 |
| 2 剧本故事板 | **不合格 / 待重写** | 上一版像提纲不是故事；用户已否决；须按 Edena + 全物件 + 莫比斯舰队冲突重写 |
| 3 导演/摄影/剪辑研习 | **未做透** | 有 Edena / 镜头文档，但未按「学完再写板」落地到本版剧本 |
| 4 8931 无菜单真截 | **未完成** | `bookshop-letter` 仍是 `realCapture: false` / fixtures；**尚未**按新故事板对 8931 重拍 |
| 5 正式漫画书 | **未完成** | 8787 有书壳，画面仍是旧 fixture，不能当正式交付 |

**一句话：规划清楚了，书还没按规划做完；下一步必须先出全量物件表，再写剧本故事板，再对 8931 真截换页。**

---

## 4. 下一步（立刻执行）

1. 整理 **8931 书店镇全量物件列表**（多店、机器人、港区、飞艇、廊灯、招牌等），写入 `docs/BOOKSHOP-OBJECT-INVENTORY.md`。  
2. 按物件写 **Edena 风剧本故事板**（反抗莫比斯舰队），放书第一页。  
3. 镜头表对齐 NYFA + Edena。  
4. 对 **8931** capture-clean 多角度真截，换掉 fixtures。  
5. 刷新 8787 书链，自测无 HUD 后交人看。

---

## 5. 相关文档

- `BOOKSHOP-CAMERA-STORY.md` — 资产 × 镜头旧笔记  
- `BOOKSHOP-STORYBOARD.md` — 旧故事板（待替换）  
- `EDENA-STUDY.md` / `EDENA-APPLY.md` / `EDENA-CAMERA-STUDY.md`  
- `CAMERA-GRAMMAR.md` / `CAPTURE-CLEAN.md`  
- `MESSENGER-TIDE-LETTER.md` — 另一章参考（曾做过 8931 真截）

