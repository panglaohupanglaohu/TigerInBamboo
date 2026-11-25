# 待用户决定的事项

凡是「采用哪套 / 设为默认」都要用户点头：这里登记候选、选项、怎么看对照、不动时的现状。各轮写码方只追加，不改别人的条目。

## P-R32-01 十二门徒采用哪套 ✅ 已决（2026-11-25 改定）

- **决定**：用户改定 **soft 为默认**。背景：11-24 旧实测（approved=113228 < soft=141652）属修复前状态；soft-tops 破面修复+成面放宽后 e2e 候选段验证可融台阶 163、`crack.bad:[]`、不写存档（run-1795573669728）。已落地：`apostlesLook.js` 默认 'soft'（`?apostlesLook=approved` / localStorage 可覆盖回原画面）、`RESOLVED_DEFAULTS` 记录翻成 soft、对照/管线 e2e 断言同步。**palette 仍为候选**（ΔE 5.766 色彩方向变化，`?apostlesLook=soft,palette` 预览）。
- **编号**：P-R32-01（Quick 写码，2026-11-23；实测已于 2026-11-24 跑完；同日用户拍板）
- **实测结果**（`artifacts/apostles-measure-pick-e2e/run-1795508523668`，三套各一次真实重载 + 破面/植被/白沫检查）：**approved 113228 分最低当选**；soft 141652、soft,palette 141652（分数越低越好，soft 系缺陷分反而多 ~25%）。推荐 = 维持认可现状，只待你点头关闭本条。
- **轮次**：R29–R32（Guide §9 C 组：十二门徒地形收尾）
- **要你决定什么**：十二门徒岩体地形以后默认用哪一套外观。三套都没有设成默认；你点头之前，正常进游戏一直是「认可现状」。
- **选项**：
  1. **认可现状 approved**（不带参数）：vendor 旧副本 + 十二门徒自己的石灰岩主题色。
  2. **软坡 soft**（`?apostlesLook=soft`）：换最新能力库 + 缓坡省 + 连续软坡顶面。诊断结论 3：认可高度场是平顶 + 2 层起跳，软坡只融得掉 1 层台阶，可能几乎看不出变化；之前一个机位上见过一处半透明破面（R29 的自动检查专门查这个）。
  3. **软坡 + 库地形色 soft,palette**（`?apostlesLook=soft,palette`）：在软坡上改用能力库地形色（草 #86a160、岩 #a7a49d），与建筑 `PALETTES.town` 同一来源。
  - 也可以选「都不要，先回去改高度场」（诊断「应该怎么补」第 2 步：让顶面在缓坡省里按 1 层渐变）。
- **怎么看对照**：
  - 页面：`pipeline.html#scene` → 当前场景选「十二门徒」→ 场景管线页最下方「十二门徒 · 三套方案并排对照」：每套 4 个机位（全景 / 侧面 / 俯视 / 崖脚特写）+ 破面 / 植被 / 白沫检查一句话；每张卡「切到这套看实景」一键切（游戏 iframe 带网址参数重载，不写默认）。
  - 截图：`TigerMessenger/artifacts/apostles-look-views-e2e/run-1795447161055/`（`approved-overview.png`、`approved-side.png`、`approved-top.png`、`approved-cliff-foot.png`；soft/soft+palette 因超时 NOT_RUN）；植被 / 白沫近景 `artifacts/apostles-surface-e2e/run-1795448109721/`（`approved-veg-top.png`、`approved-foam-cliff.png`、`soft-veg-top.png`、`soft-foam-cliff.png`；soft+palette 因超时 NOT_RUN）。由 Kiro 跑 `tests/apostles-look-views-browser.mjs`、`tests/apostles-surface-browser.mjs` 生成（2026-11-23）。
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
  - 截图：`TigerMessenger/artifacts/mountain-palette-e2e/run-1795447584156/R27-1-compare-panel.png`（并排面板，含擂台数据与缩略图）、`R27-2-live-badnorth-summer.png`（Bad North 夏季实景斜后机位）、`R27-3-live-townscaper.png`（Townscaper 实景斜后机位）；由 Kiro 跑 `tests/mountain-palette-browser.mjs` 生成（2026-11-23，pass）。
- **不动时的现状**：游戏里是原山形（没采用就不换）；你在工坊里切的配色只在那一页实景里，不写采用记录；如果切完再点「✓ 采用山形」，采用记录会记下当时的配色（采用本身是你亲手点的）。

## P-R28-01 新山形要不要「设为默认」

- **编号**：P-R28-01（Quick 写码，2026-11-23，NOT_RUN）
- **轮次**：R28
- **要你决定什么**：是否让所有人（不需要先在工坊点「采用」）进游戏就看到新山形。本轮只做到「你在本机点过采用 → 你这台机器进游戏自动换上」，没有设默认。
- **选项**：
  1. **不设默认**（现状）：只有点过「✓ 采用山形」的浏览器才换；
  2. **设为默认**：把一份固定的山形计划（例如 30 种子分布里的「最典型」或你挑的一座）随代码发布，进游戏默认换上，仍保留 `?mountainAdopted=0` 看原样；
  3. 先不定，等擂台（R26）判 mountain.rolling 这一代赢了再说——当前登记表记的是「没赢：中等坡占比退步 0.0078 > 容差 0.005」（数字待 Kiro 复算）。
- **怎么看对照**：`pipeline.html#mountain` → 山形验收台「R28 采用 · 30 种子分布」：采用状态、「跑 30 个种子」的分布直方图与最好 / 最典型 / 最差三张缩略图（实景截图在 `TigerMessenger/artifacts/mountain-seeds-e2e/latest/`，由 Kiro 跑 `tests/mountain-adopt-browser.mjs` 生成）；固定机位原样 vs 候选在 `artifacts/mountain-views-e2e/run-1795447380939/R26-{front,side,top,oblique}-{0-original,1-candidate}.png`（Kiro 已看，2026-11-23）、`R26-eye-1-candidate.png`（玩家视角）、`R26-arena-panel.png`（擂台面板）。
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

## P-R49-01 旧港湾要不要换成地形管线做的地形

- **编号**：P-R49-01（Quick 写码，2026-11-23；截图由 Kiro 跑出后补路径，写本条时 NOT_RUN）
- **轮次**：R41–R50（Guide §10「地貌枝长全」：圣城之外再有一个场景用地形管线重做地形）
- **要你决定什么**：旧港湾（`old-port`）的地形以后要不要换成地貌管线（软坡 + 硬崖 + 河谷 + 悬垂岩檐 + 崖边梯子 + 等高线）算出来的那一版。现在它只是候选：没有设成默认，正常进游戏一直是原地形。
- **选项**：
  1. **不换**（现状）：旧港湾保持原地形；地貌管线只在工坊里看。
  2. **换，但只换形状**：采用管线算出的高度面，岩檐 / 梯子 / 等高线线层都不进游戏（只要「软坡 + 硬崖 + 河谷」）。
  3. **全换**：高度面 + 岩檐（悬垂）+ 梯子都进游戏；等高线线层仍只在工坊里看。
  4. **先不定**：等 Kiro 把原版对照（④）和擂台（⑦）实算、端到端截图拍出来再看；也可以先换苔庭（`?relief=moss`）试。
  - 无论选哪个，玩家地面 / 碰撞要单独一轮跟上（现在候选只换画面，玩家仍踩原地面；见 WORKSHOP_LOG R49「没做到」）。
- **怎么看对照**：
  - 页面：`pipeline.html?relief=old-port#scene`（直达：自动切到旧港湾、扫描、预装 6 个能力）→ 地貌管线面板 ▶ 执行管线 → 游戏里贴上候选；面板「实景候选」一栏：看候选 / 看原样 / 拆掉候选（回原样）、机位斜看 / 俯视 / 侧面。
  - 截图：`TigerMessenger/artifacts/relief-old-port-e2e/run-<时间戳>/`（`2-original-oblique.png` 原样、`3-candidate-oblique.png` 候选同机位、`4-candidate-top.png` 俯视、`6-compare-original-oblique.png`、`7-reverted-oblique.png`），由 Kiro 跑 `tests/relief-oldport-browser.mjs` 生成。
  - 擂台与对照：同一面板下方「地貌枝 · 原版对照（④）与擂台（⑦）」，可在本页实算；登记表 `src/scene-authoring/catalog/parity/relief.*.json`、`catalog/arena/relief.*.json`。
- **不动时的现状**：游戏保持原地形；候选只存在于你点 ▶ 的那个工坊页面里，「拆掉候选」或刷新页面就没了；「✓ 记为候选（不改默认）」只在本机写一条 `tm.relief.candidate.v1`；不改场景存档、不碰湖上建筑。

## P-R57-01 建筑群采用后要不要进游戏自动换上

- **编号**：P-R57-01（Quick 写码，2026-11-23，NOT_RUN；截图由 Kiro 跑出后补路径）
- **轮次**：R51–R60（Guide §10「构筑枝」：建筑管线进高山圣城和水晶城）
- **要你决定什么**：建筑管线在高山圣城 / 水晶城上用联合 WFC 摆出的建筑群，现在只是候选。「✓ 采用建筑群（只记候选）」只在本机写一条 `tm.building.adopted.v1:<场景>`（`autoDeploy: false`），进游戏**不会**自动摆上。要不要像山形 R28 那样，采用后进游戏自动换上。
- **选项**：
  1. **不自动**（现状）：建筑群只在工坊页里预览；采用记录只是记下来。
  2. **采用后进游戏自动摆上**：要再写一轮（进游戏等场景就绪 → 指纹核对 → 摆上；站在山形候选上的那一组还要求山形也已采用、且指纹一致）。
  3. **先不定**：等 Kiro 的截图（圣城 / 水晶城 / 两段连跑）看过再说。
- **怎么看对照**：`pipeline.html#mountain` → 建筑面板 ▶ 执行管线 → 侧栏「斜俯机位」「俯视机位」，「对照原样」切换；水晶城在「当前场景」里选水晶城。截图：`TigerMessenger/artifacts/building-citadel-e2e/run-<时间戳>/R57-1-candidate-oblique.png`（候选）与 `R57-2-original-same-camera.png`（同机位原样）、`building-crystal-e2e/run-<时间戳>/R58-1-crystal-oblique.png`、`terrain-building-chain-e2e/run-<时间戳>/R60-2-chain-oblique.png`。
- **不动时的现状**：游戏里没有任何新建筑；已有建筑、用户搭建的水晶城（`tm.crystalCity.layout.v1`）、圣城存档、湖上建筑一概不动；撤回 / 放弃 / 刷新页面候选就没了。

## P-R51-01 mountain / battle / fx 三层的能力契约迁进各自的 meta —— ✅ 已执行（2026-11-25）

- **结果**：21 个契约条目全部从 `contracts.js` 的 `OVERLAY` 过渡表迁进各自能力的 meta（reads / writes / preserves 字面值，TERRAIN_KEEP 已展开）；OVERLAY 清空为空壳供 contractOf 兼容。21/21 逐字一致核验通过，契约/演化/自动拼装/管线测试 30/30 绿。`?v=` 版本串已升到 `contract-r1`（mountain/battle/fx capabilities、nav-capabilities、frontier-lines 的 import 点）。契约面板现在全部标「meta」来源，不再有「过渡表」。
- **遗留**：地貌层（relief）仍无契约——这是 R41–R50 新层本来就没写，契约面板如实显示「没有」，不是迁移遗漏。

<details><summary>原决定记录（2026-11-23）</summary>

- **编号**：P-R51-01（Quick 写码，2026-11-23，NOT_RUN）
- **轮次**：R51（统一能力契约）
- **要你决定什么**（其实是给并行编码者的交接，你点头即可）：这三层的 `capabilities.js` 在并行编码者的区域里（R33–R40、山形擂台调参），R51 没改他们的文件，契约先登记在 `src/system-workshop/contracts.js` 的过渡表 `OVERLAY`。等他们收工后，把过渡表里那几行原样搬进各自 meta（`reads / writes / preserves` 三个字段），再把过渡表删空；`contractOf` 会自动改读 meta。地貌层（relief，R41–R50 新层）还没有契约，契约面板如实显示「没有」。
- **选项**：1. 同意按上面迁（推荐）；2. 契约一直留在过渡表。
- **不动时的现状**：功能不受影响（自动拼管线、生成的检查都读得到过渡表）；契约面板里这 14 个能力标「过渡表」、地貌层标「没有」。

</details>
