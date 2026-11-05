# CartonBook · Tiger Messenger 卡通书流水线

详细设计见 [`docs/DESIGN.md`](docs/DESIGN.md)；摘要见 [`docs/PLAN.md`](docs/PLAN.md)；验收见 [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md)。

> **硬约束：所有漫画图必须来自本游戏系统截屏**（Playwright / `canvas.toDataURL` / 既有 shot harness）。  
> **禁止**文生图、图生动画、外部 AI 绘图管线。

在 Tiger Messenger 游戏场景里，每次选一个**场景** + 一份**故事板**，信使在此发生的子故事形成一本卡通书。每个场景 = 一个小章节：

1. **1 张主题/封面图**（全页或大跨页感）
2. **3–4 页分镜页**（每页 3–6 格，Edena / ligne claire 式不规则但清晰）

---

## 与 AI Comic Factory / AI Manga Studio 的异同

| | [AI Comic Factory](https://aicomicfactory.ai/) / [AI Manga Studio](https://github.com/morsoli/aimangastudio) | **CartonBook** |
|---|---|---|
| 阶段划分 | 脚本 → 分镜 → 角色风格 → 多页导出 | **故事板 → 镜头计划 → 游戏截屏 → Edena 排版 → 导出** |
| 画面来源 | 文生图 / 图生图 | **仅 TigerMessenger 运行时截屏** |
| 角色一致 | 靠提示词/LoRA | 靠游戏内同一套资产与相机 |
| 导出 | HTML/PDF/页图 | HTML 翻页书 + 打印 CSS（可选 PDF） |

我们只学「阶段划分与导出」，画面来源全部换成游戏截屏。

---

## Edena 排版要点（参考 Moebius《The World of Edena》）

- **ligne claire**：清晰细黑线框、色块干净、少阴影糊面
- **大留白**：格与格之间、页边距充裕；不把页塞满
- **宽景横幅格**：远景/建立镜头用通栏横幅
- **旁白条**：可跨格放在格下，米白纸底上的细条
- **对话框**：少而精，简洁圆角白底黑字
- **章节感**：封面主题图 + 3–4 页分镜把一个子故事讲完

样式见 `layouts/edena.css` 与 `layouts/page-templates/`。

---

## 目录结构

```
CartonBook/
  README.md
  docs/PLAN.md              # 规划：阶段、Edena、智能体分工
  package.json
  pipeline/stages.md          # 阶段说明
  pipeline/schema.json        # chapter/page/panel/shot schema
  recipes/*.json              # 可跑样章
  src/planChapter.mjs         # 故事 → 镜头计划
  src/captureShots.mjs        # 游戏截屏 → chapters/<id>/shots/
  src/layoutEdena.mjs         # 截屏 → Edena HTML 页
  src/exportBook.mjs          # 汇总 book.html + viewer
  src/cli.mjs                 # 命令行入口
  layouts/edena.css
  layouts/page-templates/
  chapters/                   # 运行产物
  chapters/_fixtures/         # layout-only 用的游戏截屏占位（仍是本游戏截图）
  viewer/index.html
```

---

## 打开现成样章（书店镇送信）

样章已生成，**可直接用浏览器打开**（无需先跑 CLI）：

```text
CartonBook/chapters/bookshop-letter/book.html
```

绝对路径示例：

```text
/Users/panglaohu/Downloads/TigerInBamboo/CartonBook/chapters/bookshop-letter/book.html
```

- 内容：封面 + 3 页分镜（Edena 分格）
- 画面：`chapters/bookshop-letter/shots/*.png`，来自 `chapters/_fixtures/`（TigerMessenger bookshop **游戏验收截屏**，非文生图）
- 亦可打开 `viewer/index.html` 浏览章节列表
- 打印：浏览器打印该 `book.html`（已含打印 CSS）

> 若你本地又跑了 `run` / `layout` / `export`，会重写该目录产物；无必要请勿覆盖已验收样章。

## 本地 Web（HTTP，非 file://）

从仓库根目录起静态站（固定端口 **8787**）：

```bash
cd /Users/panglaohu/Downloads/TigerInBamboo/CartonBook
npm run serve
# 等价：python3 -m http.server 8787 --bind 127.0.0.1
```

然后打开：

- 首页：http://127.0.0.1:8787/ 或 http://127.0.0.1:8787/web/
- 样章：http://127.0.0.1:8787/chapters/bookshop-letter/book.html

### 本机 Node 提示

默认 shell **PATH 里可能没有 `node`**。若命令找不到，可先：

```bash
export PATH="/Users/panglaohu/.workbuddy/binaries/node/versions/22.22.2-6/bin:$PATH"
# 或改用你机器上已有的 node 路径
node -v
cd /Users/panglaohu/Downloads/TigerInBamboo/CartonBook
node src/cli.mjs layout-only --recipe recipes/bookshop-letter.sample.json
```

`layout-only` 与当前样章同源（fixtures → 排版 → `book.html`）。真截屏再用 `run`（需 Chrome + Playwright + 游戏静态服）。

## 如何跑

前置：本机已装 Node ≥ 18。截屏阶段复用仓库已有 Playwright：

`../tools/shot/node_modules/playwright`

### 一键（计划 → 截屏 → 排版 → 导出）

```bash
cd /Users/panglaohu/Downloads/TigerInBamboo/CartonBook
node src/cli.mjs run --recipe recipes/bookshop-letter.sample.json
```

会尽量自启静态服（默认 `127.0.0.1:8766`，根为 TigerInBamboo），打开  
`/TigerMessenger/?scene=messenger&autostart=1`，等 `window.__tm`，按 recipe 机位截屏。

### 仅排版（无游戏 / WebGL 不可用时）

```bash
node src/cli.mjs layout-only --recipe recipes/bookshop-letter.sample.json
```

使用 `chapters/_fixtures/` 里**仍来自本游戏系统**的既有截屏（bookshop 周边验收图），生成完整 `book.html`。  
**不会**调用任何外部图像 API。

### 分步

```bash
node src/cli.mjs plan    --recipe recipes/bookshop-letter.sample.json
node src/cli.mjs capture --recipe recipes/bookshop-letter.sample.json
node src/cli.mjs layout  --recipe recipes/bookshop-letter.sample.json
node src/cli.mjs export  --recipe recipes/bookshop-letter.sample.json
```

产物：

- `chapters/<id>/shots/*.png` + `manifest.json`
- `chapters/<id>/pages/cover.html`、`page-01.html` …
- `chapters/<id>/book.html` ← 浏览器直接打开
- `viewer/index.html` 可浏览已生成章节

---

## 与游戏的关系

| 游戏侧 | CartonBook 用法 |
|---|---|
| `TigerMessenger/` + `?scene=messenger&autostart=1` | capture 打开的目标 |
| `window.__tm`（camera / cameraRig / player / messenger） | 机位与等待就绪 |
| `src/ui/shotHarnessPanel.js`、`tools/shot/shot.mjs` | 截屏先例；本流水线零侵入用 Playwright |
| `src/story/storyboardPanel.js`、`storyCatalog.js` | 故事板字段参考；导出/粘贴成 recipe |
| `pipeline.html` + `src/scene-authoring/` | 场景工坊；场景 id 写入 recipe.scene |

**默认零侵入**：不改 TigerMessenger 主逻辑。若日后要加截屏钩子，做成可选补丁并在本 README 注明。

### 相机扩展点

`captureShots.mjs` 中 `applyCameraPreset(page, shot)`：

1. 若 recipe 镜有 `camera.landmark`，尝试把 player 挪到 `__tm.messenger.landmarks[id]` 附近并 `cameraRig.snapToPlayer()`
2. 应用 `preset`：`wide` / `medium` / `close` / `high`（调 `setDist` + `orbitPitchBy`）
3. 可选 `orbit` / `pitch` / `dist` 数值覆盖
4. 等若干帧后 `page.screenshot` 或 `canvas.toDataURL`

扩展：在 recipe 的 `storyboard[].camera` 增加字段即可，无需改游戏。

---

## 从故事板导出 / 粘贴成 recipe

1. 在游戏里打开故事板面板，写好各镜 `title` / `note`
2. 按 `pipeline/schema.json` 手工或脚本填入 `recipes/<id>.json`：
   - `id`, `title`, `scene`, `gameUrl`
   - `storyboard[]`：每镜 `id`, `title`, `note`, `camera`, `caption`, `dialog`
   - `pages[]`：封面 + 分镜页；`panels[].shotId` 映射到 storyboard id
3. `node src/cli.mjs plan --recipe ...` 会写出规范化的 `chapters/<id>/plan.json`

样章：`recipes/bookshop-letter.sample.json`（书店镇送信）。

---

## Playwright 依赖

优先：

```text
../tools/shot/node_modules/playwright
```

若不可用，`capture` 会报错并提示安装；同时可用：

```bash
node src/cli.mjs capture --recipe ... --shots-dir /path/to/existing/pngs
```

或直接 `layout-only`（读 `_fixtures`）。

本机 Chrome 路径默认识别 `/Applications/Google Chrome.app/...`，可用环境变量 `CHROME_PATH` 覆盖。

---

## 假验收禁令

- 不得用外部 AI 生成的图冒充游戏截屏
- `_fixtures` 必须标注来源为游戏/既有验收截屏
- README / 报告须如实写：本次截屏是否真实成功、失败原因

---

## 许可与归属

从属于 TigerInBamboo / TigerMessenger 仓库。排版灵感致敬 Moebius《The World of Edena》，实现为独立 HTML/CSS，非官方素材复制。
