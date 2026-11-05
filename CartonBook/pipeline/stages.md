# CartonBook 流水线阶段

> 画面来源硬约束：**游戏截屏 only**。本文件只描述阶段划分与产物，不涉及任何文生图。

## 总览

```
故事板 / recipe
    │
    ▼
① planChapter     → chapters/<id>/plan.json（镜头计划）
    │
    ▼
② captureShots    → chapters/<id>/shots/*.png + manifest.json
    │                 （Playwright 打开 TigerMessenger，等 __tm，设机位，截屏）
    ▼
③ layoutEdena     → chapters/<id>/pages/*.html（Edena 分格）
    │
    ▼
④ exportBook      → chapters/<id>/book.html + viewer 索引
```

对照 AI Comic Factory / AI Manga Studio：它们的「脚本→分镜→风格→导出」在这里变成「故事→镜头计划→**截屏**→排版→导出」。

---

## ① 故事 → 镜头计划（planChapter）

**输入**：`recipes/*.json`（或故事板导出）

**做什么**：
- 校验 schema（id / scene / storyboard / pages）
- 为缺省镜补 camera preset、caption
- 写出规范化 `plan.json`（含每镜输出路径、页映射）

**不做什么**：不调 LLM 文生图；可选纯规则/模板扩写 caption（本仓库样例为手工写好）。

**产物**：`chapters/<id>/plan.json`

---

## ② 镜头计划 → 截屏（captureShots）

**输入**：plan.json / recipe

**做什么**：
1. 解析游戏根与 URL（默认 `http://127.0.0.1:8766/TigerMessenger/?scene=…&autostart=1`）
2. 若端口空闲则自启 `python3 -m http.server`（根 TigerInBamboo）
3. 启动 Chromium（SwiftShader WebGL），等待 `window.__tm`
4. 按每镜 `camera` 设 landmark / preset / dist / orbit
5. `page.screenshot` 或 canvas `toDataURL` → `shots/<shotId>.png`
6. 写 `manifest.json`（来源、时间、viewport、是否真实截屏）

**失败退化**：
- `--shots-dir` 接受已有 PNG
- 或 `layout-only` 使用 `chapters/_fixtures/`（仍须是本游戏截屏）

**产物**：`chapters/<id>/shots/` + `manifest.json`

---

## ③ 截屏 → Edena 排版（layoutEdena）

**输入**：shots + recipe.pages（模板与 panel→shot 映射）

**做什么**：
- 封面：大图 + 标题 + 章节题记
- 分镜页：3/4/5 格或「宽景+两格」等模板
- 旁白条、对话框叠在图上/格下
- 图片路径全部相对指向 `../shots/`

**视觉**：米白纸底、细黑框、大留白（`layouts/edena.css`）

**绝不**：调用外部图像生成 API。

**产物**：`pages/cover.html`、`page-01.html` …

---

## ④ 导出（exportBook）

**输入**：pages/

**做什么**：
- 汇总可翻页 `book.html`（封面 + 各页，打印友好 CSS）
- 更新 `viewer/index.html` 章节列表

**产物**：`chapters/<id>/book.html`

---

## 一章建议体量

| 元素 | 数量 |
|---|---|
| 封面主题图 | 1 |
| 分镜页 | 3–4 |
| 每页格数 | 3–6（不规则） |
| 故事板镜数 | 约 8–14（覆盖封面+各格） |
