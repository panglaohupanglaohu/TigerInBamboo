# 信使日记 · 潮气那封

> 章 id：`messenger-tide-letter`  
> 页数决策：**封面 + 6 内页 = 7 页**，约 **16 镜**。  
> 画面：仅 TigerMessenger 游戏截屏；**强制 capture-clean（零 HUD）**；禁止文生图；禁止把 `_fixtures` 里带菜单的验收图塞进正式页。

## 为何是 7 页

旧样章 `bookshop-letter` 把「到→取→走」压进封面+3 页，港湾/飞艇只能远景一笔带过，信使经历偏短。  
本版按 Edena 竖条节奏拆开：

| 页 | 戏剧任务 | 不加页的代价 |
|----|----------|--------------|
| 封面 | 地方先于故事 | — |
| P1 坡道 | 路径→广场→berm 建立尺度 | 抵达挤成一格，坡道/广场/berm 资产丢 |
| P2 立面 | 眼高仍小 + **唯一**低仰纪念碑 | 低仰与眼高同页才有对比 |
| P3 取信 | 廊静场→一句店主→**唯一** macro 招牌 | 近景插入需要前后静场/交互垫 |
| P4 信在身上 | tele 拉开 + 背影带信 | macro 后必须焦段拉开，独立成页才「信已到手」 |
| P5 港湾 | 水面 + 坞/蒸汽 | 取信页禁抢戏，港区只能晚出场 |
| P6 启程 | 登艇→**唯一** airshipPilot→告别 panorama | POV 特殊视野需邻格回到观察者机位 |

再少一页会被迫合并「取信/带信」或「港湾/启程」，资产覆盖与信使弧都会糊。再多则稀。

## 页 × 镜映射

| 页 | 模板 | 镜 | 镜头族 |
|----|------|----|--------|
| 封面 | `cover` | c0 | panorama |
| P1 坡道 | `edena-stack-3` | s01–s03 | cinematic ×3 |
| P2 立面 | `edena-banner-pair` | s04–s05 | cinematic；s05 负 pitch（全章唯一仰） |
| P3 取信 | `edena-close-insert` | s06–s08 | cinematic ×2 → **macro** |
| P4 信在身上 | `edena-banner-pair` | s09–s10 | **tele** → cinematic 背影 |
| P5 港湾 | `edena-banner-pair` | s11–s12 | cinematic ×2 |
| P6 启程 | `edena-banner-pair` + depart | s13–s15 | cinematic → **airshipPilot** → panorama |

文字：少旁白；**仅 s07 一个店主短气泡**；其余可静默。章题在顶条内，无厚顶栏。

## 资产覆盖（须入画）

| 资产 | 主要镜 |
|------|--------|
| 书店本体 | c0, s04, s05 |
| berm | s03 |
| 招牌 HARD TO FIND | s08（macro） |
| 台地 terrace | c0, s04 |
| 圆形广场 | s02 |
| 入口路径 | s01 |
| Jakub 廊/灯 | s06 |
| 大气/蒸汽 | s12 |
| 港湾/坞 | s11–s13 |
| 信使小人 | c0, s10, s15 |
| 取信/信在身上 | s07–s10 |

Landmark 一律 `bookshop`；港区靠 **orbit 单调外推**，不换 landmark。

## capture-clean（硬约束）

1. URL：`cartonCapture=1`；拍前 `__tm.setCaptureMode(true)`，确认 `isCaptureMode()`。  
2. 下列节点不可见：`#minimap-panel` `#quest-panel` `#hud` `#hint-panel` `#controls-dock` `#touch-toggle` `#touch-toggle-slot` `#tm-perf-probe` `#bubble` `#bubble-crosshair` `#npc-hint` `#toast` `#rescue-campaign` 等（见 `uiLayers.js` `CAPTURE_HIDE_SELECTORS`）。  
3. **禁止**用 `chapters/_fixtures` 带 HUD 的验收图充当本正式章。真截失败时用诚实占位或留空，并在 `manifest.json` 标明 `realCapture: false` + 原因。  
4. 排版进 `book.html` 前肉眼/启发式抽检 PNG。

## 文件

- 配方：`recipes/messenger-tide-letter.json`  
- 产物：`chapters/messenger-tide-letter/`（`plan.json` `shots/` `pages/` `book.html` `manifest.json`）  
- 镜头语法：`docs/CAMERA-GRAMMAR.md`  
- 资产思路：`docs/BOOKSHOP-CAMERA-STORY.md`
