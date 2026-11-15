# CartonBook · Tiger Messenger 漫画流水线

把 TigerMessenger 的真实游戏场景拍成可翻页的漫画书。当前正式章为 **《书店镇 · 四盏灯，一封信》**：霸天舰队限期索书，信使取出《联藏约》，请四家书店共同签署，在机器人与居民守路时把信送到 DUKE，带往潮气边境。

> 硬约束：正式画面只能来自 **http://localhost:8931/TigerMessenger/** 的游戏 canvas。禁止文生图、外部 AI 绘图、旧 fixture 冒充正式画面，以及任务栏、小地图、FPS、操作提示、「遥控」等任何 HUD。

## 成品与制作文档

- 翻书：http://127.0.0.1:8787/chapters/bookshop-letter/book.html
- PDF：http://127.0.0.1:8787/chapters/bookshop-letter/book.pdf（页面右上角也可直接下载）
- 完整故事与逐镜表：`docs/BOOKSHOP-STORYBOARD.md`
- 可拍物件与入场覆盖：`docs/BOOKSHOP-OBJECT-INVENTORY.md`
- Edena 研究：`docs/EDENA-STUDY.md`、`docs/EDENA-CAMERA-STUDY.md`
- 无菜单规则：`docs/CAPTURE-CLEAN.md`
- 正式 recipe：`recipes/bookshop-letter.sample.json`

本书使用一张连续实景横跨左右两个封面页。序页和每个故事叶都有独立网格；内页按两个实际书叶组成跨页，不用网页卡片冒充书本。

## 运行环境

```bash
export PATH="/Users/panglaohu/.workbuddy/binaries/node/versions/22.22.2-6/bin:$PATH"
cd "/Users/panglaohu/Downloads/TigerInBamboo/CartonBook"
npm run serve
```

- 8931：唯一正式实景源，需已经运行。
- 8787：CartonBook 静态书。
- Playwright：优先复用 `../tools/shot/node_modules/playwright`。
- 8765 与本书无关。

## 正式制作顺序

### 1. 物件 → 故事 → 镜头

先核对 `BOOKSHOP-OBJECT-INVENTORY.md`，再改完整故事和 `storyboard[].camera`。每镜写清主体、景别、机位、读格时长与叙事职责，不能只写“远景一张”。

### 2. 生成镜头计划

```bash
node src/cli.mjs plan --recipe "/Users/panglaohu/Downloads/TigerInBamboo/CartonBook/recipes/bookshop-letter.sample.json"
```

`capture` 和 `run` 也会重新读取 recipe 并生成 plan，不会沿用旧镜头表。

### 3. 从 8931 无菜单实拍

```bash
CARTONBOOK_NO_SPAWN_SERVER=1 CARTONBOOK_NO_FIXTURES=1 \
node src/cli.mjs capture \
  --recipe "/Users/panglaohu/Downloads/TigerInBamboo/CartonBook/recipes/bookshop-letter.sample.json" \
  --port 8931
```

拍摄器自动使用 `cartonCapture=1` 和 `__tm.setCaptureMode(true)`，每镜检查游戏侧完整 `CAPTURE_HIDE_SELECTORS`，优先 `canvas.toDataURL`。霸天战斗使用真实 `__tm.batianFleet.start('bookshop')`，空降镜等待真实地面部署，不用静态模型假装战斗。

**失败保护**：live 拍摄先写章节目录下的临时暂存区。只有全部镜头通过文件、HUD 与黑帧/空帧检测后，才替换正式 `shots/` 和 `manifest.json`；任何失败都保留上一版好书，暂存路径会打印在日志中。

### 4. 逐张肉眼验收

自动检查只证明像素与 DOM 状态，不证明构图。必须检查：主体是否出画、黑帧、空天空、遮挡、重复图、战斗阶段、持信连续性、任何菜单残留。

正式 `manifest.json` 需写入：

```json
"visualReview": {
  "status": "approved",
  "approvedShotIds": ["cover", "s01", "s02"]
}
```

实际验收必须列出本章全部 shot id。书店镇章节未通过肉眼验收时，`export` 会拒绝发布。

### 5. 排版与导出

```bash
node src/cli.mjs layout --recipe "/Users/panglaohu/Downloads/TigerInBamboo/CartonBook/recipes/bookshop-letter.sample.json"
node src/cli.mjs export --recipe "/Users/panglaohu/Downloads/TigerInBamboo/CartonBook/recipes/bookshop-letter.sample.json"
npm run pdf
npm test
```

硬刷新 http://127.0.0.1:8787/chapters/bookshop-letter/book.html 验收。`book.html` 的图片路径必须为 `shots/...`；导出会检查本次 plan 的页面和全部图片，不会把旧页面重新混入书。`npm run pdf` 用 Playwright 将整书导出为 5 个完整跨页的 `book.pdf`，不会拆成单叶，也不会把工具栏带入 PDF。

## 一键与预览

```bash
# 正式：plan → capture → layout → export
CARTONBOOK_NO_SPAWN_SERVER=1 CARTONBOOK_NO_FIXTURES=1 \
node src/cli.mjs run --recipe recipes/bookshop-letter.sample.json --port 8931

# fixtures 仅用于独立排版预览；默认写 artifacts/layout-only/
node src/cli.mjs layout-only --recipe recipes/bookshop-letter.sample.json
```

`layout-only` 不得覆盖 `chapters/` 正式章节。Playwright 缺失时正式拍摄直接失败，不再静默回退 fixtures。

## Recipe 镜头字段

- 传统 rig：`preset`、`landmark`、`dist`、`orbit`、`pitch`、`fov`。
- 镜头族：`mode: panorama | cinematic | macro | tele | airshipPilot`。
- 主体局部坐标：`object`、`eye`、`aim`，适合书店、机器人、港口稳定构图。
- 动态主体：`aimObject`、`aimObjectMix`，让广场机位跟随真实旗舰而不拍到空天空。
- 战斗：`battle: start | ground | retreat`。
- 持信摆拍：`stagePlayer`、`holdingLetter`、`releaseLetterAfterCapture`；只控制既有信使和信件视觉，不伪称新增任务日志。

Schema 见 `pipeline/schema.json`。排版规则见 `layouts/edena.css`。

## 目录

```text
CartonBook/
  docs/                    故事、资产、镜头与 QA
  recipes/                 可执行故事板
  src/planChapter.mjs      recipe → plan
  src/captureShots.mjs     8931 canvas → shots + manifest
  src/layoutEdena.mjs      plan → 独立书叶
  src/exportBook.mjs       书叶 → 跨页书 + viewer
  src/selfTest.mjs         镜头覆盖、布局、门禁回归测试
  layouts/edena.css        Edena 纸页与网格
  chapters/bookshop-letter/正式产物
  artifacts/               审查联系表、日志、独立预览
```

排版灵感来自 Moebius《The World of Edena》的尺度、留白和竖条节奏；实现与截图均为本项目独立产物，不复制原书页面像素。


## 2026-11-07 新册：水晶城 · 把春天带回家

- 阅读： http://127.0.0.1:8787/chapters/crystal-tiger-rescue/book.html
- PDF： `chapters/crystal-tiger-rescue/book.pdf`，共56个A4书本页（2页连续封面 + 54页故事）。页面内可直接下载。
- 逐页故事板： `docs/CRYSTAL-TIGER-STORYBOARD.md`，网页旁附 `storyboard.html`。
- 故事：水晶城求援、叹息之门约定、湖沼反抗、寻找并认出女儿虎虎、护送与回城互助。信使为父亲，红狐为不能说话的母亲。
- 本册使用 `recipes/crystal-tiger-rescue.json` 与 `src/buildLongComic.mjs`，不是旧样章的CLI recipe格式。保留既有短册管线。
- 重排：在仓库根运行 `node CartonBook/src/buildLongComic.mjs`。PDF使用配有Pillow/reportlab/pypdf的Python运行 `CartonBook/src/exportLongComicPdf.py`；需要本机 Arial Unicode.ttf。
- 实拍、失败记录和验收： `artifacts/crystal-rescue/`。拍摄边界见 `capture-limits.md`。没有修改用户存档；新编剧情与角色摄影摆位不冒充已实现的新游戏任务。
