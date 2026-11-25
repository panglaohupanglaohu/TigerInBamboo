# 待用户决定的事项

凡是「采用哪套 / 设为默认」都要用户点头：这里登记候选、选项、怎么看对照、不动时的现状。各轮写码方只追加，不改别人的条目。

## P-R32-01 十二门徒采用哪套

- **编号**：P-R32-01（Quick 写码，2026-11-23；验收截图由 Kiro 跑出后补路径）
- **轮次**：R29–R32（Guide §9 C 组：十二门徒地形收尾）
- **要你决定什么**：十二门徒岩体地形以后默认用哪一套外观。三套都没有设成默认；你点头之前，正常进游戏一直是「认可现状」。
- **选项**：
  1. **认可现状 approved**（不带参数）：vendor 旧副本 + 十二门徒自己的石灰岩主题色。
  2. **软坡 soft**（`?apostlesLook=soft`）：换最新能力库 + 缓坡省 + 连续软坡顶面。诊断结论 3：认可高度场是平顶 + 2 层起跳，软坡只融得掉 1 层台阶，可能几乎看不出变化；之前一个机位上见过一处半透明破面（R29 的自动检查专门查这个）。
  3. **软坡 + 库地形色 soft,palette**（`?apostlesLook=soft,palette`）：在软坡上改用能力库地形色（草 #86a160、岩 #a7a49d），与建筑 `PALETTES.town` 同一来源。
  - 也可以选「都不要，先回去改高度场」（诊断「应该怎么补」第 2 步：让顶面在缓坡省里按 1 层渐变）。
- **怎么看对照**：
  - 页面：`pipeline.html#scene` → 当前场景选「十二门徒」→ 场景管线页最下方「十二门徒 · 三套方案并排对照」：每套 4 个机位（全景 / 侧面 / 俯视 / 崖脚特写）+ 破面 / 植被 / 白沫检查一句话；每张卡「切到这套看实景」一键切（游戏 iframe 带网址参数重载，不写默认）。
  - 截图：`TigerMessenger/artifacts/apostles-look-views-e2e/run-*/`（`approved-*.png`、`soft-*.png`、`soft+palette-*.png`，清单 `artifacts/apostles-look-views-e2e/latest.json`）；植被 / 白沫近景 `artifacts/apostles-surface-e2e/run-*/`。由 Kiro 跑 `tests/apostles-look-views-browser.mjs`、`tests/apostles-surface-browser.mjs` 生成（写本条时 NOT_RUN）。
  - 管线：同一页「十二门徒地形管线」里 ▶ 执行管线（软坡 + 库地形色两个能力）会预览 soft,palette；「✓ 记为候选（不改默认）」只在本机记一条 `tm.apostles.look.choice.v1`。
- **不动时的现状**：游戏保持认可现状（approved）；网址参数 `?apostlesLook=soft` / `soft,palette` 和 `localStorage['tm.apostles.look.v1']` 照旧可用，只影响带了它们的那个浏览器页面；不改岩体存档、不改湖上建筑。

## P-R27-01 高山圣城山形用哪套配色

- **编号**：P-R27-01（Quick 写码，2026-11-23；截图由 Kiro 跑出后补，写本条时 NOT_RUN）
- **轮次**：R27（Guide §9 B 组：高山圣城山形做到可采用）
- **要你决定什么**：新山形以后用哪套颜色。两套都只是候选，没有改任何默认；`mountain.lowpoly` 的配色参数默认值本轮没动（仍是 1 = Bad North 夏季，那是 R22 时定的能力默认，不等于你已选）。
- **选项**：
  1. **Bad North 夏季**（配色 1，来自 `townscaper-web/REACodeRefactoring/src/badnorth/theme.js BN_PAL.summer`）：草偏黄绿、岩壁偏紫灰。
  2. **Townscaper**（配色 2，来自 `townscaper-web/REACodeRefactoring/src/core/palette.js`）：草更绿更饱和、岩壁中性灰。
  - 也可以「都不要」，继续用原配色 0。
- **怎么看对照**：
  - 页面：`pipeline.html#mountain` → 执行山形管线（实景换上候选）→ 山形面板下方「山形验收台 · R27 配色二选一」→「对照两套配色」：同一座山两张缩略图并排，各带「草坡面积够（≥ 45%）」「不偏灰（灰面 ≤ 35%、草坡饱和度 ≥ 0.18）」检查；每张卡「实景换上这套」一键切，「实景回计划配色」一键回。
  - 截图：`TigerMessenger/artifacts/mountain-palette-e2e/run-*/R27-1-compare-panel.png`（并排面板）、`R27-2-live-badnorth-summer.png`、`R27-3-live-townscaper.png`（同一斜后机位）；由 Kiro 跑 `tests/mountain-palette-browser.mjs` 生成。
- **不动时的现状**：游戏里是原山形（没采用就不换）；你在工坊里切的配色只在那一页实景里，不写采用记录；如果切完再点「✓ 采用山形」，采用记录会记下当时的配色（采用本身是你亲手点的）。

## P-R28-01 新山形要不要「设为默认」

- **编号**：P-R28-01（Quick 写码，2026-11-23，NOT_RUN）
- **轮次**：R28
- **要你决定什么**：是否让所有人（不需要先在工坊点「采用」）进游戏就看到新山形。本轮只做到「你在本机点过采用 → 你这台机器进游戏自动换上」，没有设默认。
- **选项**：
  1. **不设默认**（现状）：只有点过「✓ 采用山形」的浏览器才换；
  2. **设为默认**：把一份固定的山形计划（例如 30 种子分布里的「最典型」或你挑的一座）随代码发布，进游戏默认换上，仍保留 `?mountainAdopted=0` 看原样；
  3. 先不定，等擂台（R26）判 mountain.rolling 这一代赢了再说——当前登记表记的是「没赢：中等坡占比退步 0.0078 > 容差 0.005」（数字待 Kiro 复算）。
- **怎么看对照**：`pipeline.html#mountain` → 山形验收台「R28 采用 · 30 种子分布」：采用状态、「跑 30 个种子」的分布直方图与最好 / 最典型 / 最差三张缩略图（实景截图在 `TigerMessenger/artifacts/mountain-seeds-e2e/latest/`，由 Kiro 跑 `tests/mountain-adopt-browser.mjs` 生成）；固定机位原样 vs 候选在 `artifacts/mountain-views-e2e/run-*/R26-*.png`。
- **不动时的现状**：没点采用 = 原山形；点了采用 = 本机自动换上；「回到原山形（删除采用记录）」或网址 `?mountainAdopted=0` 一键回原。不改存档、不碰湖上建筑。

## P-R28-02 要不要放宽山体可改范围（峰高）

- **编号**：P-R28-02（Quick 写码，2026-11-23，NOT_RUN）
- **轮次**：R28
- **要你决定什么**：现在山能长多高、能离建筑 / 轨道多近，是你之前定的「轨道保留，其他可编辑」+ 能力默认：`mountain.massif.peak` 主峰隆起 8–60 m（默认 22）、保护带建筑 6 m / 轨道 8 m、轨旁 24 m 内新增山体不超过 1.6 坡比包络（超出 0.5 m 就判失败）。要不要放宽。
- **选项**：
  1. **不放宽**（现状）；
  2. **只放宽峰高**：例如 peak 上限 60 → 90 m，默认 22 → 30 m（建筑 / 轨道约束不变）；
  3. **放宽保护带**：建筑保护带 6 → 3 m（山能贴着城墙起），轨道不动。
- **怎么看对照**：进化墙（`pipeline.html#mountain` 上方「山形进化墙」）里把「主峰隆起」调到上限的候选能直接在实景里看；30 种子分布里的「主峰高出中位」「最高点」两行直方图就是现有范围下的分布。
- **不动时的现状**：范围不变；所有验证（保护区不动、轨道净空、海岸线、玩家地面）照旧是硬检查。
