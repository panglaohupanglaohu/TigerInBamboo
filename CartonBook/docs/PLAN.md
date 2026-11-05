# CartonBook 规划文档（PLAN）

> **完整详细设计请读 [`DESIGN.md`](./DESIGN.md)**（目标、架构、Web UX、流水线、角色、数据模型、捕获契约、QA、里程碑、风险、业界对照）。  
> 本文件保留为较短阶段摘要与样章范围；若与 DESIGN 冲突，以 DESIGN 为准。

> 子项目路径：`TigerInBamboo/CartonBook`  
> 关联游戏：`TigerInBamboo/TigerMessenger`  
> 状态：可跑流水线（截屏 → Edena 排版 → HTML 书）；**禁止文生图**

---

## 1. 产品定位

在 Tiger Messenger **游戏场景**里，每次选定：

1. 一个场景（如 `messenger` / 书店镇）
2. 一份故事板（分镜意图、旁白、对白、机位提示）

信使在该场景发生的**子故事** → 导出为一本**卡通书小章节**：

| 元素 | 体量 |
|---|---|
| 主题 / 封面图 | 1 张（全页或大跨页感） |
| 分镜页 | 3–4 页 |
| 每页格数 | 3–6 格（Edena 式不规则但清晰） |

**硬约束（不可妥协）**

- 所有漫画**面板图像**必须来自本游戏系统截屏  
  （Playwright / `canvas.toDataURL` / 既有 shot harness）
- **禁止**文生图、图生动画、外部 AI 绘图或“风格迁移成漫画格”冒充游戏画面
- 智能体可以写故事、润色旁白/对白、规划机位与页模板；**不能**生成面板位图

---

## 2. 与业界流水线的异同（故意不用文生图）

业界常见（[AI Comic Factory](https://aicomicfactory.ai/)、[AI Manga Studio](https://github.com/morsoli/aimangastudio) 等）：

```
剧本 → 分镜脚本 → 文生图/图生图填格 → 气泡与排版 → 导出
```

角色一致靠提示词、LoRA、参考图；画格像素由生成模型产出。

**CartonBook 学阶段划分与导出，不学文生图画格：**

```
场景 + 故事板
    → 镜头计划（机位 / preset / landmark）
    → 游戏内截屏（唯一画面来源）
    → Edena 式排版（旁白条、对话框、分格）
    → 可翻页 HTML 书（+ 打印 CSS）
```

| 维度 | 业界文生图漫画 | CartonBook |
|---|---|---|
| 面板图像 | 模型生成 | **TigerMessenger 运行时截屏** |
| 角色 / 场景一致 | 提示词工程 | 游戏资产与同一世界 |
| 智能体价值 | 写提示词、修图 | 故事板、机位、文案、排版与验收 |
| 失败时 | 换模型重抽 | fixtures（仍须是**本游戏**既有截屏）或 `--shots-dir` |

---

## 3. 流水线阶段

详见 `pipeline/stages.md`。摘要：

| # | 阶段 | 模块 | 产物 |
|---|---|---|---|
| 0 | 选题 / 故事板 | recipe JSON | `recipes/<id>.json` |
| 1 | 镜头计划 | `src/planChapter.mjs` | `chapters/<id>/plan.json` |
| 2 | 拍摄截屏 | `src/captureShots.mjs` | `shots/*.png` + `manifest.json` |
| 3 | Edena 排版 | `src/layoutEdena.mjs` | `pages/cover.html` + `page-0N.html` |
| 4 | 呈现 / 导出 | `src/exportBook.mjs` | `book.html` + `viewer/` |
| 5 | 交付验收 | 人工 + CLI 报告 | 如实记录 `realCapture` |

一键：

```bash
cd CartonBook
node src/cli.mjs run --recipe recipes/bookshop-letter.sample.json
# 无 WebGL / 游戏未起时：
node src/cli.mjs layout-only --recipe recipes/bookshop-letter.sample.json
```

---

## 4. Edena 排版规则（参考 Moebius《The World of Edena》）

实现：`layouts/edena.css` + `layouts/page-templates/` + `layoutEdena.mjs`。

1. **ligne claire 感**：细黑线框、色块干净、少糊面阴影；截屏可轻微降饱和 / 提对比，但不重绘
2. **大留白**：页边距与格间距充裕，不把页塞满
3. **宽景横幅格**：建立镜头、远景用通栏（`wide-plus-two`、`panels-3/4` 首格）
4. **旁白条**：格下横条，可视觉跨格；米白纸底 + 左侧细墨线
5. **对话框**：少而精；白底圆角、发言人小字 + 一句对白
6. **章节节奏**：1 封面主题图 + 3–4 分镜页讲完一个子故事
7. **纸感**：米白 `#f4efe4`，非纯白网页灰

模板槽位：`cover` / `panels-3` / `panels-4` / `panels-5` / `wide-plus-two`。

---

## 5. 样章范围：书店镇送信（bookshop-letter）

| 字段 | 值 |
|---|---|
| id | `bookshop-letter` |
| 场景 | `messenger`（书店镇 landmark: `bookshop`） |
| 故事 | 信使抵达 → 近前 → 取信 → 启程回望 |
| 结构 | 封面 + 3 页分镜（宽景+两格 / 四格 / 三格） |
| recipe | `recipes/bookshop-letter.sample.json` |
| 产物 | `chapters/bookshop-letter/book.html` |

游戏侧复用：

- URL：`?scene=messenger&autostart=1`（可选 `timeOfDay`）
- `__tm.messenger.landmarks.bookshop`、`camera` / `cameraRig` / `player`
- 截屏先例：`shotHarnessPanel.js`、`tools/shot/shot.mjs`、`capture_world_audit.mjs`

---

## 6. 智能体团队分工

流水线按「编辑部」角色划分；可用多个子代理，也可一人多角。  
**共同禁令：任何角色不得用文生图填充面板。**

| 角色 | 职责 | 可做 | 不可做 |
|---|---|---|---|
| **故事板** | 选场景、写分镜意图、`storyboard[]` | 标题/note/镜头目的；从游戏故事板面板导出粘贴 | 生成图像 |
| **设计** | 页模板与 panel→shot 映射、节奏 | 选 `wide-plus-two` 等；封面/收束 | 改主游戏玩法逻辑 |
| **美工指导** | Edena 规范、留白、气泡密度 | 审 CSS/模板；要求重拍机位 | 外发 AI 重绘截屏 |
| **拍摄截屏** | 跑 `captureShots`、机位 evaluate | Playwright、preset、landmark；记 manifest | 用库存网图 / AI 图冒充 |
| **编辑** | 旁白/对白润色、章节题记 | LLM 润色文案；统一语气 | 把文案模型接到出图 API |
| **呈现测试** | 打开 `book.html`、打印预览、缺图检查 | layout-only 回归；列缺口 | 假验收（隐瞒 fixture 回退） |
| **交付统一编辑** | README/PLAN/报告、目录齐全、一键命令 | 汇总 `realCapture`、文件列表 | 改坏 TigerMessenger 主逻辑 |

协作顺序建议：故事板 → 设计 → 拍摄 → 美工指导过目 → 编辑定稿文案 → 呈现测试 → 交付统一编辑出报告。

智能体协助边界（写进验收口径）：

- ✅ 旁白 / 对白润色、机位计划、页结构、HTML 排版
- ❌ 面板位图的任何生成式管线

---

## 7. 技术边界与扩展点

- **零侵入优先**：Playwright `page.evaluate` 操作 `__tm`；不默认改游戏源码
- **Playwright 路径**：`../tools/shot/node_modules/playwright`；缺失则 `--shots-dir` 或 `layout-only`
- **相机扩展**：`captureShots.mjs` → `applyCamera`；recipe 增 `camera.*` 即可
- **fixtures**：`chapters/_fixtures/` 只允许本游戏既有验收截屏，并在 manifest 标明 `source: fixture`
- **假验收禁令**：报告必须写清本次是否真实截屏成功及原因

---

## 8. 成功标准（本阶段）

- [x] 目录结构与中文 README / 本 PLAN
- [x] schema + 样章 recipe
- [x] layout → 可打开的 `book.html`（封面 + ≥3 分镜页）
- [x] 阶段文档写明「画面 = 游戏截屏」
- [ ] 本机尽量真截若干张；失败则 layout-only + 如实报告（见交付说明）

---

## 9. 非目标（本阶段不做）

- 文生图 / 图生视频 / 自动「漫画滤镜重绘」
- 改写 TigerMessenger 主循环或强制合并侵入式钩子
- 完整 PDF 商业印刷排版（仅保留打印 CSS）
- 多语言自动翻译管线（文案以中文为主）
