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
