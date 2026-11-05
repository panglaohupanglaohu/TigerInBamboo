# 书店镇 · 资产 × 故事 × 镜头思路

> 回应：「先摸清场景资产；第二要有故事性；至少用镜头能力把故事讲清楚。」  
> 画面仍只能游戏截屏；镜头语言对齐 [EDENA-STUDY](./EDENA-STUDY.md)。

---

## 1. 场景资产盘点（现有可拍）

站点定位（`bookshopTownSite.js`）：**南海蒸汽工业基地 · 临海游客书店**（Hard To Find），球面小镇，抬升海堤台地；角色「第四座独立小游客书店」。

### 1.1 建筑 / 地标（Hero 级）

| 资产 | 来源 / id | 镜头用途 |
|------|-----------|----------|
| **Hard To Find 书店本体** | `createHardToFindBookshop`（`src/assets/bookshop.js`）；mesh `hard-to-find-bookshop`；砖红 + 维多利亚八角凸窗 + 三角门廊 | 章主角；远景轮廓 + 中景门廊 |
| 土坡 berm | mesh `bookshop-soil-berm` | 眼高中景前景；压人尺度 |
| 招牌 | `makeSignTexture` / `setBookshopSignText`；mesh `bookshop-sign-text`；文案 `HARD TO FIND` / `BOOKSHOP` | **全章唯一「可读字」近景插入** |
| 高台廊道 | `buildHardToFindTerrace`；mesh `hard-to-find-terrace`（`BOOKSHOP_TERRACE≈5.5`） | 低机位仰拍立面；廊下列车穿行勿抢戏 |
| 门洞 / 门廊柱 | 奶白 trim + 内凹门；种植净空 zone `building` | 取信交互前景框 |
| 立面细节 | `bookshopFacadeDetails.js` | 中景纹理，勿抢主体 |
| 广场竖牌 | `bookshopBasePlaza.js`：`HARD TO FIND` / `SEASIDE BOOKSHOP` | 抵达远景可入画；近景插入仍以店面 `bookshop-sign-text` 为准 |

**Landmark 键（勿混用）**

| 层 | id | 用途 |
|----|-----|------|
| CartonBook / `__tm` 截屏 | `tm.messenger.landmarks.bookshop`（recipe `landmark: "bookshop"`） | `captureShots.mjs` 对位 |
| 行星清单 | `bookshop-town`（`landmarkManifest.js`） | `routeAnchors`: `bookshop-door`, `hill-saddle`；`cameraKeepouts`: `bookshop-town`；`profile`: `bookshop-hill-chain` |
| 救援主线目标 | `rescueState` chapter `letter` → `target: "bookshop"` / place `书店镇` / action `接过苍竹的信` | 叙事对齐，非相机键 |

### 1.2 环境带（故事「地方大于人」）

| 资产 | 来源 / id | 镜头用途 |
|------|-----------|----------|
| 台地 / 海堤 / 抬升 | `BOOKSHOP_RAISE`（默认 5）、`bookshopTownSite`；ground mesh `bookshop-spherical-ground`；site outline r=100 / centerZ=-26 | 封面与启程：人小、地大 |
| 圆形广场 | `bookshopBasePlaza.js`；mesh `bookshop-base-circular-plaza` | 「抵达」中景走位 |
| 入口路径 | `bookshopPath.js`；`bookshop-blender-entrance-path`；净空 zone `approach` / `sign`（`BOOKSHOP_PLANTING_CLEARANCE`） | 坡道→门；树冠不得挡招牌 |
| Jakub 廊 / 灯 | `installBookshopJakubPass`；`bookshop-jakub-pass`、`jakub-lamp-glow`、`jakub-arcade-glow` | 静场侧廊（B1）；orbit 变号后用 |
| 蒸汽 / 大气 / 暖光 | `bookshopSteamClouds`、`bookshopAtmosphere`、`bookshopWarmLighting` | 空气感；蒸汽勿糊招牌 |
| 港湾 / 飞艇坞 / 货轨 / 装卸 | `bookshopJakubHarbor`、`AirshipDock`、`FreightSpurs`、`LoadingYards`、`FreighterHull`、`HarborDetail` | **仅启程远景**；取信页禁抢戏 |
| 行人 / 工人 / 机器人 | `bookshopPedestrians`、`bookshopWorker`、`bookshopRobots` / `bookshopRobotBase` | 背景生活感；拍前清近景挡门 NPC |
| 天空 / 时段 | `dayNight.js`；recipe `timeOfDay: 0.38`（晨后青绿天，非朝霞 0.28 / 非暮云 0.75） | 全章统一；勿中途改 TOD |

### 1.3 叙事交互 / 角色（玩法层）

| 项 | 源码证据 | 拍法 |
|----|----------|------|
| 接信 | `main.js` 提示「在书店按 **R** 接过家书」；`questSystem` → `holdingLetter` + `messengerMesh.userData.letter` | B2 交互距离可暗示；真拍可不弹出 toast |
| 救援章 | `story/rescueState.js`：`id: letter` / `接过苍竹的信` / target `bookshop` | 与四拍「转」对齐 |
| 玩家信使 | 持信道具可见性由 quest 切换 | D1 背影可带信；禁大脸特写 |
| 店主 | recipe 气泡「店主」—— overlay 对白，**非**独立 NPC mesh | 只在 B2 一格；画面仍以门洞为英雄 |
| 行人/工人 | `bookshopPedestrians` 等 | 远景点缀；B3 近景必须清场 |

**拍漫画必须隐藏的 UI**（`uiLayers.js` `CAPTURE_HIDE_SELECTORS` = `PLAY_SELECTORS` + 编辑层 + monitor + extras）：

`#hud` `#quest-panel` `#minimap-panel` `#compass` `#rescue-campaign` `#controls-dock` `#hint-panel` `#touch-controls` `#touch-toggle` `#touch-toggle-slot` `#toast` `#intro` `#startup-progress` `#journal-panel` `#npc-hint` `#bubble` `#bubble-crosshair` `#shot-harness-panel` `#storyboard-panel` `#storyboard-toggle` `#tm-ui-dock` `#tm-perf-probe` 及全部 edit/monitor 面板。

### 1.3.1 去菜单截屏：两种策略（优先 1）

| 策略 | 做法 | 入口 |
|------|------|------|
| **① 专用 capture-clean 模式（推荐）** | 拍前隐藏全部 overlay，拍后可恢复；世界 canvas 不动 | URL `?cartonCapture=1` 或 `__tm.setCaptureMode(true)` / `__tmUiLayers.setCaptureMode(true)` |
| **② 缩小截取范围（兜底）** | 若仍有残留 HUD，裁安全中心区 | `captureShots` 的 `cropRect` / `cropInset` / 环境变量 `CARTONBOOK_CROP=1`（默认 inset：左/右 4%、上 6%、下 14%） |

`captureShots.mjs` 已：goto 时自动加 `cartonCapture=1`；就绪后调用 `setCaptureMode(true)`；可选 crop 写入 manifest。

可保留：**世界内**几何招牌 / 门廊；不要留屏幕空间任务条。

### 1.4 相机能力（已有）

> **跨场景科学镜头族**（摄影师简报）见 [`CAMERA-GRAMMAR.md`](./CAMERA-GRAMMAR.md)；Edena×电影景别研习见 [`EDENA-CAMERA-STUDY.md`](./EDENA-CAMERA-STUDY.md)。  
> recipe：`camera.mode` / `camera.family` = `panorama`｜`cinematic`｜`macro`｜`tele`｜`airshipPilot`（中文：全景 / 镜头感 / 微距 / 长焦 / 飞艇）。  
> 封面·主题 → panorama；场所 → cinematic；近景插入 → macro；拉开凝视 → tele；旅程特殊 → airshipPilot。


`CartonBook/src/captureShots.mjs` 已接 `__tm`：

- `landmark` → `tm.messenger.landmarks[landmark]`（样章用 `bookshop`）  
- `preset`: `cover` / `wide` / `medium` / `close` / `high`  
- `dist` / `orbit` / `pitch` + rig `orbitBy` / `orbitPitchBy`  

`pitch` 符号（`core/camera.js` `camPitch`）：**负 = 仰（低机位看立面）**，**正 = 俯（高位/路径）**。A3 必须用负值；D2/`high` 用大正值。与样章 recipe `s03.pitch: -0.08`、`s09.pitch: 0.48` 一致。

**思路核心**：故事性 = 机位序列，不是旁白堆字。

---

## 2. 故事核（四拍）

主题：**信使到 Hard To Find，取一封要送出的信，转身上路。**

| 拍 | 戏剧任务 | 情绪 | Edena 页 |
|----|----------|------|----------|
| **起 · 抵达** | 建立「这是一座镇，书店只是其中一点」 | 开阔、安静 | 封面 + 抵达竖条 |
| **承 · 靠近** | 路→门廊，人仍小于建筑 | 期待 | 抵达后两带 |
| **转 · 取信** | 交互瞬间；**一次**招牌/门近景证明「就是这里」 | 停顿、交接 | 取信页 |
| **合 · 启程** | 背影离开，镇缩成风景 | 轻、远 | 启程竖条 |

旁白原则：每格 ≤1 短句；转拍可有 **一个** 店主气泡 + **一个** 信使气泡；其余静默。

---

## 3. 镜头表（用相机讲戏）

约定：`landmark=bookshop`；拍前 HUD off；人高约占画幅高度 5–20%（远）或 ≤35%（中）；近景插入只给物，不给大脸特写。

| 镜号 | 叙事职责 | preset | dist | orbit | pitch | 画面英雄资产 | 入画 | 禁入画 |
|------|----------|--------|------|-------|-------|--------------|------|--------|
| **C0 封面** | 地方先于故事 | cover | 34–40 | 0.2 | 0.05 | 书店+台地轮廓 | 天空大、海/堤一线、招牌可读轮廓 | HUD、大前景角色 |
| **A1** | 坡道远眺 | wide | 24–28 | 0.35 | 0.08 | 书店立面 | 空前景路面、中景人点、远景屋 | 港区巨物抢戏 |
| **A2** | 眼高靠近 | medium | 12–14 | 0.15 | 0.05 | 门廊 | 人全身仍小、土坡 berm | 特写脸 |
| **A3** | **唯一低机位（仰）** | medium | 10–12 | 0.05 | **-0.08～-0.15** | 立面纪念感 | 门廊三角顶压上沿；人在脚下 | 第二次低机位；正 pitch（那是俯视） |
| **B1** | 静场廊道 | wide | 16–18 | -0.7 | 0.1 | 树/廊+屋侧 | 负空间、无人或远处行人 | 对白 |
| **B2** | 交互距离 | medium | 8–10 | 0.2 | 0.1 | 门洞 | 可感「能按 R」的距离 | HUD 任务板 |
| **B3** | **唯一近景插入** | close | 5–6.5 | 0.1 | 0.12 | **招牌字或门把手** | 金边黑底字清晰 | 全身人、第二次近景 |
| **B4** | 拉开交接后 | medium | 11–13 | 0.4 | 0.08 | 门廊+信使 | 信已在身（姿态/道具若有） | 再特写 |
| **D1** | 转身背影 | medium | 14–16 | 1.0–1.2 | 0.05 | 人背+屋 | 走向画面外一侧 | 正脸 |
| **D2** | 路径 | high | 20–24 | 1.5 | 0.5 | 路网/台地 | 小人在路上 | 回书店特写 |
| **D3** | 告别风景 | wide | 28–32 | 1.8–2.0 | 0.2 | 镇缩影 | 人≈剪影 | 任何 UI |

**连续性**：C0→A1 同侧光线与 TOD=0.38；A3 仰拍（负 pitch）→B1 侧廊（orbit 变号，回正/微俯）；B3→B4 焦段拉开勿跳轴；D1→D3 orbit 单调增加＝「一直往外走」。

---

## 4. 故事性检查（拍前自问）

1. 若不看旁白，只看 11 镜静帧，能否读出「到→取→走」？  
2. 是否有一格几乎「空」（天空/立面/廊）？  
3. 近景是否 **只有一格**？低机位是否 **只有一格**？  
4. 港区/飞艇是否只在启程远景出现，而未污染取信页？  
5. 截屏是否无 HUD？

---

## 5. 与现状差距 → 下一刀

| 现状 | 问题 | 下一刀 |
|------|------|--------|
| fixtures 验收图 | HUD 满屏；机位未按上表；`realCapture: false` | **capture-clean 真连拍** 按表重采 `shots/` |
| ~~`captureShots` HUD 列表不全~~ | ~~只藏 harness/storyboard/toast/intro~~ | **已对齐** `CAPTURE_HIDE_SELECTORS` + `?cartonCapture=1` / `__tm.setCaptureMode`（见 §1.3.1）；必要时再开 crop 兜底 |
| recipe 已有 dist/orbit/pitch | 未强制「人高比例 / 英雄资产」；A3 勿误用正 pitch | QA：每镜英雄资产 + A3 仰角截图核对 |
| 行人/蒸汽随机 | 可能挡门/招牌 | 拍前冻帧或清近景 NPC |
| 招牌近景未保证 | fixtures 未必对上 B3 | close 专拍 mesh `bookshop-sign-text` |
| landmark 键混用风险 | 行星 `bookshop-town` ≠ 截屏 `bookshop` | recipe 继续用 `bookshop`；文档已标明 |

**建议顺序**：资产核对（本页）→ 按镜头表改 recipe → HUD off capture → Edena 排版不动 → 肉眼过「无旁白也能读故事」。

---

*本思路可直接驱动 `recipes/bookshop-letter.sample.json` 的 camera 字段与拍摄智能体。*
