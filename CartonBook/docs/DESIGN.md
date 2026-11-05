# CartonBook 详细设计与计划（DESIGN）

> 路径：`TigerInBamboo/CartonBook`  
> 关联：`TigerInBamboo/TigerMessenger`  
> 配套：[`PLAN.md`](./PLAN.md)（阶段摘要）· [`QA-CHECKLIST.md`](./QA-CHECKLIST.md)（验收）· `pipeline/stages.md` · `pipeline/schema.json`  
> 状态：样章可 HTTP 打开；正式画面 = 游戏截屏；**禁止文生图 / 图生动画**

---

## 0. 一句话目标

在 Tiger Messenger **真实 3D 场景**里，选定「场景 + 故事板」，由智能体编辑部完成镜头计划、游戏内拍摄、Edena 式排版与可翻页 Web 书交付——**每一格漫画像素都必须来自本游戏截屏**，不是模型画出来的。

---

## 1. 产品目标与非目标

### 1.1 目标

| 目标 | 说明 |
|---|---|
| 场景子故事成书 | 每个场景/子故事 → 一章：`1` 主题封面 + `3–4` 分镜页 |
| 画面真实性 | 面板图仅来自 Playwright / canvas / 既有 shot harness 截取的 TigerMessenger 画面 |
| Edena 排版感 | 参考 Moebius《The World of Edena》：ligne claire、大留白、宽景横幅、旁白条、少而精对话框 |
| 可访问 Web | 用 `http://127.0.0.1:8787/` 打开首页与样章（**不要**依赖易坏的 `file://`） |
| 可复现流水线 | recipe → plan → capture → layout → export，CLI 可一键跑 |
| 诚实验收 | manifest 标明 `realCapture` / `fixture`；fixtures 仅可验排版，不可冒充正式画面 |

### 1.2 硬约束（不可妥协）

1. **禁止**文生图、图生图、图生动画、外部 AI 绘图、风格迁移「重绘」冒充游戏格。  
2. **正式拍摄前必须关闭 HUD**（任务栏、小地图、fps、操作提示、shot/storyboard 面板等）。优先用游戏内 **capture-clean**（`?cartonCapture=1` / `__tm.setCaptureMode(true)`）；必要时再缩小截取范围。带 HUD 的 fixture **只允许**做 layout 样章。  
3. `book.html` 位于章节根目录时，图片路径必须是 **`shots/...`**，不能是 `../shots/...`（那是 `pages/*.html` 的相对路径）。  
4. 验收报告不得隐瞒 fixture 回退；必须写清本次是否真截屏成功及原因。

### 1.3 非目标（本阶段不做）

- 完整商业 PDF 印刷排版（仅保留打印 CSS）
- 多语言自动翻译管线
- 改写 TigerMessenger 主循环或强制侵入式钩子（优先 `page.evaluate` 零侵入）
- 正式 Web 控制台的完整后台（选题→排队→权限）；当前先做静态 Web 首页 + 章节翻页

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  CartonBook（本仓库子项目）                                   │
│  recipes/  pipeline/  src/  layouts/  chapters/  web/ viewer/ │
└───────────────┬───────────────────────────────▲─────────────┘
                │ Playwright evaluate / screenshot              │
                ▼                                               │
┌─────────────────────────────────────────────────────────────┐
│  TigerMessenger（游戏）  ?scene=&autostart=1                 │
│  window.__tm · landmarks · cameraRig · canvas                │
└─────────────────────────────────────────────────────────────┘
                │
                ▼ 静态 HTTP
┌─────────────────────────────────────────────────────────────┐
│  用户浏览器  http://127.0.0.1:8787/                          │
│  web/ 或 viewer/ → chapters/<id>/book.html                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 目录职责

| 路径 | 职责 |
|---|---|
| `recipes/*.json` | 选题输入：故事板 + 页模板映射 |
| `pipeline/schema.json` | recipe / shot / page 契约 |
| `pipeline/stages.md` | 阶段说明（截屏替换文生图） |
| `src/planChapter.mjs` | recipe → `plan.json` |
| `src/captureShots.mjs` | plan → `shots/*.png` + `manifest.json` |
| `src/layoutEdena.mjs` | shots → `pages/*.html`（路径 `../shots/`） |
| `src/exportBook.mjs` | pages → `book.html`（**改写为 `shots/`**）+ 更新 web/viewer |
| `src/cli.mjs` | 命令编排 |
| `layouts/edena.css` + `page-templates/` | Edena 视觉与模板参考 |
| `chapters/<id>/` | 单章产物 |
| `chapters/_fixtures/` | **本游戏**既有验收截屏，仅 layout-only |
| `web/` · `viewer/` · `index.html` | HTTP 入口（首页 / 目录） |

### 2.2 运行时依赖

- Node ≥ 18（本机可用：`~/.workbuddy/binaries/node/versions/22.22.2-6/bin`）
- 真截屏：Chrome + Playwright（优先 `../tools/shot/node_modules/playwright`）+ 游戏静态服（默认 `127.0.0.1:8766`，根为 TigerInBamboo）
- 浏览样章：`python3 -m http.server 8787`（`npm run serve`）

---

## 3. Web UX

### 3.1 入口（优先 HTTP）

| URL | 用途 |
|---|---|
| `http://127.0.0.1:8787/` | 根 `index.html` → 跳转 `web/` |
| `http://127.0.0.1:8787/web/` | Web 首页：章节卡片、真截屏/fixtures 徽章 |
| `http://127.0.0.1:8787/viewer/` | 同源目录页（导出时同步更新） |
| `http://127.0.0.1:8787/chapters/bookshop-letter/book.html` | 样章翻页书 |

启动：

```bash
cd CartonBook
npm run serve
# 或：python3 -m http.server 8787 --bind 127.0.0.1
```

### 3.2 翻页书交互（`book.html`）

- 顶栏导航：封面 / page-01… + 上一页 / 下一页
- 键盘：←/→、PageUp/PageDown
- 打印：取消 `[hidden]`，每 section 分页（`@media print`）
- 缺图：`img.onerror` → `.panel-missing` 占位文案（不得静默空白）
- 约束条：页顶固定提示「画面来自游戏截屏 · 禁止文生图」

### 3.3 路径契约（曾导致「图全丢」）

| 文档位置 | 正确 `img src` | 错误 |
|---|---|---|
| `pages/cover.html` 等 | `../shots/s01.png` | `shots/s01.png`（相对 pages/ 会 404） |
| `book.html`（章节根） | `shots/s01.png` | `../shots/s01.png`（会指到 `chapters/shots`，404） |

`exportBook` 必须在内联 article 时把 `(?:\.\./)+shots/` **全部改写**为 `shots/`，写盘前断言无残留 `../shots/`。

### 3.4 后续正式控制台（规划，未实现）

1. 选题：选 scene + 贴故事板 / 编辑 recipe  
2. 跑管线：plan → capture → layout → export，进度与 `realCapture` 状态  
3. 翻书：嵌入或跳转 `book.html`  
4. 验收：一键跑 QA curl 清单  

当前交付以静态站 + CLI 为准，避免半成品控制台阻断样章可读。

---

## 4. 流水线阶段（对标 AI Comic Factory，捕获替换生成）

业界常见：`剧本 → 分镜 → 文生图填格 → 气泡排版 → 导出`。  
CartonBook：`故事板 → 镜头计划 → **游戏截屏** → Edena 排版 → 导出`。

| # | 阶段 | 模块 | 输入 | 产物 |
|---|---|---|---|---|
| 0 | 选题 | 人工/故事板角色 | 场景意图 | `recipes/<id>.json` |
| 1 | 镜头计划 | `planChapter` | recipe | `chapters/<id>/plan.json` |
| 2 | 拍摄 | `captureShots` | plan | `shots/*.png` + `manifest.json` |
| 3 | 排版 | `layoutEdena` | plan + shots | `pages/*.html` |
| 4 | 导出 | `exportBook` | pages | `book.html` + web/viewer |
| 5 | 验收 | QA + 人工 | HTTP 资源 | `docs/QA-CHECKLIST.md` 记录 |

CLI：

```bash
node src/cli.mjs run --recipe recipes/bookshop-letter.sample.json
node src/cli.mjs layout-only --recipe recipes/bookshop-letter.sample.json   # fixtures 排版
node src/cli.mjs export --recipe recipes/bookshop-letter.sample.json
```

---

## 5. 智能体 / 角色分工（编辑部）

**共同禁令：任何角色不得用文生图填充面板。**

| 角色 | 职责 | 可做 | 不可做 |
|---|---|---|---|
| 故事板 | 选场景、写 `storyboard[]` | 标题/note/镜头目的；从游戏故事板导出 | 生成图像 |
| 设计 | 页模板与 panel→shot 映射 | 选 `wide-plus-two` 等；封面/收束节奏 | 改主玩法逻辑 |
| 美工指导 | Edena 规范、留白、气泡密度 | 审 CSS/模板；要求重拍 | 外发 AI 重绘截屏 |
| 拍摄 | 跑 capture、关 HUD、机位 | Playwright、preset、landmark；写 manifest | 网图 / AI 图冒充 |
| 编辑 | 旁白/对白润色 | LLM 润色文案 | 接出图 API |
| 呈现测试 | 开 HTTP、curl 验图、打印预览 | layout-only 回归；列缺口 | 假验收 |
| 交付统一编辑 | DESIGN/PLAN/QA/README 齐全 | 汇总 `realCapture`、文件列表 | 破坏 TigerMessenger 主逻辑 |

协作顺序：故事板 → 设计 → 拍摄 → 美工过目 → 编辑定稿 → 呈现测试 → 交付。

---

## 6. 数据模型

### 6.1 Recipe（选题输入）

见 `pipeline/schema.json` · `CartonBookRecipe`。

关键字段：

- `id` / `title` / `subtitle` / `scene` / `gameUrl` / `timeOfDay` / `viewport`
- `storyboard[]`：每镜 `id`、`title`、`note`、`camera{preset,landmark,dist,orbit,pitch,waitMs}`、`caption`、`dialog`
- `pages[]`：`kind`=`cover|story`，`template`，`panels[{shotId,role,showCaption,showDialog}]`

样章：`recipes/bookshop-letter.sample.json`（封面 + 3 分镜页，约 11 镜）。

### 6.2 Plan（规范化镜头计划）

`chapters/<id>/plan.json`：由 `planChapter` 写出，补全缺省 camera / 输出路径 / 页映射，供 capture 与 layout 共用。

### 6.3 Manifest（拍摄事实）

`chapters/<id>/manifest.json`：

| 字段 | 含义 |
|---|---|
| `realCapture` | 是否本次真截屏成功 |
| `mode` | `live` / `fixtures` / `external-dir` 等 |
| `shots[]` | `shotId`、`file`、`source`、`ok`、可选 `fixture` |
| `captureError` | 失败原因（诚实记录） |
| `generatedAt` | ISO 时间 |

`source` 枚举：`playwright-screenshot` | `canvas-todataurl` | `fixture` | `external-dir`。

### 6.4 章节产物树

```
chapters/<id>/
  plan.json
  manifest.json
  shots/*.png
  pages/cover.html, page-01.html, …
  book.html          ← 对外主阅读物
```

---

## 7. 捕获契约（Capture Contract）

### 7.1 正式拍摄步骤

1. 游戏静态服就绪（默认 `http://127.0.0.1:8766/TigerMessenger/?scene=…&autostart=1&cartonCapture=1`）。  
2. Chromium（SwiftShader WebGL 可回退）启动，等待 `window.__tm`。  
3. **去菜单截屏（两种策略，优先 ①）**  
   - **① capture-clean（推荐）**：`?cartonCapture=1` 或 `__tm.setCaptureMode(true)` —— 给 `html` 加 `tm-capture-clean`，按 `uiLayers.js` 的 `CAPTURE_HIDE_SELECTORS` 隐藏玩家 HUD + 编辑层 + monitor + `#tm-ui-dock` / `#npc-hint` / `#bubble` 等；拍后 `__tm.setCaptureMode(false)` 可恢复。  
   - **② 缩小截取范围（兜底）**：`cropRect`（CSS 像素）或 `cropInset` / `CARTONBOOK_CROP=1`（默认安全中心 inset），canvas 裁切或 Playwright `clip`。  
4. 按镜 `applyCamera`：再次确保 clean → landmark → 玩家落位 → `cameraRig` dist/orbit/pitch → snap。  
5. `page.screenshot` 或 canvas `toDataURL`（可带 crop）→ `shots/<shotId>.png`。  
6. 写 manifest：`realCapture=true`；并记录 `captureClean` / 可选 `crop`。

### 7.2 退化路径

| 条件 | 行为 |
|---|---|
| `--shots-dir` | 使用已有 PNG |
| `layout-only` / 真截失败 | 复制 `chapters/_fixtures/`，`source=fixture`，`realCapture=false` |
| Playwright 缺失 | 同上，并在日志说明 |

### 7.3 Fixtures 政策

- 必须是 **本游戏**既有验收截屏，不是网图、不是 AI 图。  
- 允许带 HUD（历史验收图常见）→ **只能**验证排版与路径，**不能**当正式章节画面。  
- 首页徽章应显示「样章/fixtures（仅排版）」vs「真截屏」。

### 7.4 相机预设

| preset | 用途 | 默认 dist 量级 |
|---|---|---|
| cover | 封面主题 | ~28 |
| wide | 建立/收束 | ~22 |
| medium | 叙事中景 | ~12 |
| close | 对白/物件 | ~7 |
| high | 俯视路径 | ~20 + pitch |

Landmark 例：`bookshop` → `__tm.messenger.landmarks.bookshop`。

科学镜头族（`panorama` / `cinematic` / `macro` / `tele` / `airshipPilot`）见 [`CAMERA-GRAMMAR.md`](./CAMERA-GRAMMAR.md)；景别研习见 [`EDENA-CAMERA-STUDY.md`](./EDENA-CAMERA-STUDY.md)。

---

## 8. Edena 排版规则

实现：`layouts/edena.css` + `layoutEdena.mjs` + `layouts/page-templates/`。

1. ligne claire：细黑线框、干净色块；截屏可轻处理但不重绘。  
2. 大留白：页边距与格间距充裕。  
3. 宽景横幅：`wide-plus-two` / 通栏首格。  
4. 旁白条：格下横条，米白底 + 左侧细墨线。  
5. 对话框：少而精；发言人小字 + 一句对白。  
6. 章节节奏：1 封面 + 3–4 分镜页讲完子故事。  
7. 纸感：`#f4efe4`，非纯白网页灰。

模板槽：`cover` / `panels-3` / `panels-4` / `panels-5` / `wide-plus-two`。

---

## 9. QA 清单（摘要）

完整可勾选清单见 [`QA-CHECKLIST.md`](./QA-CHECKLIST.md)。强制项：

1. `export` 后 `book.html` **零** `../shots/`；全部 `img[src^="shots/"]`。  
2. `curl -sI`：首页、`book.html`、每张 `shots/*.png`、`layouts/edena.css` → **HTTP 200**。  
3. manifest 与首页徽章一致（fixtures 不得标成真截屏）。  
4. 正式交付前：HUD-off 真截屏重跑（本阶段样章可用 fixtures，但报告必须标明）。

---

## 10. 里程碑

| 里程碑 | 内容 | 状态意向 |
|---|---|---|
| M0 | 目录 / schema / 样章 recipe / PLAN | 已有 |
| M1 | layout-only 样章 + HTTP 8787 + 路径改写修复 | **本轮** |
| M2 | DESIGN + QA 自测证明（curl 200） | **本轮** |
| M3 | 真截屏稳定（HUD-off、多 landmark、失败重试） | 下一轮 |
| M4 | Web 控制台雏形（选题→跑管线→翻书） | 规划 |
| M5 | 多章节目录、打印/PDF 增强、编辑部智能体编排 | 规划 |

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| `../shots/` 未改写 | 浏览器整书缺图 | export 正则 + 写盘前断言；QA curl |
| 用 file:// 打开 | CSS/图相对路径偶发失败 | 固定 `npm run serve` 8787 |
| HUD 入画 | 正式画面不可用 | ① `__tm.setCaptureMode` / `?cartonCapture=1`；② crop 兜底；契约见 §7.1 |
| WebGL / Playwright 失败 | 只能 fixtures | 诚实 manifest；不阻断 layout |
| fixtures 被当成终稿 | 质量/信任问题 | 徽章 + QA 强制读 `realCapture` |
| 侵入改游戏 | 回归成本高 | 优先 evaluate；相机扩展走 recipe |
| Node 不在 PATH | CLI 跑不起来 | README 写明 workbuddy node 路径 |

---

## 12. 业界对照与建议

| 维度 | AI Comic Factory / AI Manga Studio 等 | CartonBook |
|---|---|---|
| 面板像素 | 文生图 / 图生图 | **游戏运行时截屏** |
| 角色一致 | 提示词 / LoRA | 同一套游戏资产与世界 |
| 智能体价值 | 写提示词、修图 | 故事板、机位、文案、排版、验收 |
| 失败策略 | 换模型重抽 | fixtures（本游戏图）或 `--shots-dir` |
| 导出 | HTML/PDF | HTML 翻页 + 打印 CSS |

**建议（与业界差异处主动补强）：**

1. **把「捕获质量」当一等公民**：构图检查（中心是否落在 landmark）、曝光/裁切、HUD 检测（简单像素/DOM 断言），而不是只追求跑通。  
2. **镜头语言库**：把成功机位沉淀为可复用 preset 包（书店镇套、寺院套），减少每章从零调参。  
3. **故事板双向**：游戏内故事板面板 ↔ recipe JSON 导入导出，减少手工抄写。  
4. **Web 控制台**：业界工具强在「一键成书」；我们应在不引入文生图的前提下，把 capture 进度与真伪状态做同样直观。  
5. **印刷**：后期可加「页图栅格化」导出 PDF，但仍禁止用生成模型补像素。

---

## 13. 样章：bookshop-letter

| 字段 | 值 |
|---|---|
| 标题 | 书店镇 · 一封要送出的信 |
| 场景 | `messenger` · landmark `bookshop` |
| 结构 | 封面 + 抵达 / 取信 / 启程（3 分镜页） |
| 当前画面 | fixtures（`realCapture=false`）— 仅排版样章 |
| 阅读 | `http://127.0.0.1:8787/chapters/bookshop-letter/book.html` |

---

## 13.5 截屏无菜单（Capture-Clean）

正式漫画分镜必须去掉 HUD/菜单：优先策略 1（`__tm.setCaptureMode` / `?cartonCapture=1` / 工坊「进入编辑」），必要时策略 2（`page.screenshot` clip 到 canvas）。详见 [`CAPTURE-CLEAN.md`](./CAPTURE-CLEAN.md)。

## 14. 文档索引

- 本文件：详细设计与计划  
- [`PLAN.md`](./PLAN.md)：较短规划摘要（指向本 DESIGN）  
- [`QA-CHECKLIST.md`](./QA-CHECKLIST.md)：自测通过/失败记录  
- [`CAPTURE-CLEAN.md`](./CAPTURE-CLEAN.md)：截屏无菜单（策略 1/2）  
- `../pipeline/stages.md`：阶段细节  
- `../pipeline/schema.json`：数据契约  
- `../README.md`：快速上手  

---

*CartonBook DESIGN · 画面只来自 TigerMessenger 截屏*
