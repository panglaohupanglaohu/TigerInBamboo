# 截屏无菜单（Capture-Clean）

正式漫画分镜 **不得** 带 HUD / 编辑坞 / 任务栏。两种互补策略：

## 策略 1：专用干净模式（首选）

游戏侧已实现（`TigerMessenger/src/ui/uiLayers.js`）：

| 入口 | 作用 |
|---|---|
| `__tm.setCaptureMode(true/false)` | 开关干净模式 |
| `__tm.isCaptureMode()` | 查询状态 |
| `?cartonCapture=1` | URL 自动启用 |
| `html.tm-capture-clean` | CSS 隐藏 `CAPTURE_HIDE_SELECTORS` |

隐藏范围：玩家 HUD、编辑组、监控探针、坞、对话气泡，以及桌面端被挪出 `#touch-controls` 的 **「遥控」**（`#touch-toggle` / `#touch-toggle-slot`，见 `CAPTURE_EXTRA_SELECTORS`）；**世界 canvas 保留**。

工坊桥接（`pipeline-bridge.js`）：

- `open`（进入编辑）→ `setCaptureMode(true)`，视口无菜单便于构图
- `play` → `setCaptureMode(false)`
- `captureClean` + payload 布尔 → 仅切换干净模式
- `screenshot` → 开干净模式 → 强制 `renderer.render` → 返回 `canvas.toDataURL`（`{ png, via:'canvas', captureMode:true }`）

## 零容忍（正式分镜）

反例（禁止当正式画面）：小地图、任务/家书面板、R 接信提示、WASD/操作提示条、FPS 探针、准星、中央交互提示（E/F/R 叠字）、桌面「遥控」、toast/气泡。

`CAPTURE_HIDE_SELECTORS` = `PLAY_SELECTORS` + 编辑层 + `MONITOR_SELECTORS`（含 `#tm-perf-probe`）+ `CAPTURE_EXTRA_SELECTORS`，其中 EXTRA 必须覆盖：

- 交互叠字：`#npc-hint` `#tram-hint` `#airship-hint` `#scout-hint` `#elder-hint` `#fox-hint` `#bubble-hint` `#boat-hint`
- 准星 / 气泡：`#bubble` `#bubble-crosshair`
- 遥控：`#touch-toggle` `#touch-toggle-slot`
- 潜水手感滤镜：`#dive-tint`

`html.tm-capture-clean` 对这些选择器强制 `display:none` + `visibility:hidden` + `opacity:0`。  
缺任一正式镜 = **废片**，只能当 fixture / 排版自测。

## 策略 2：缩小截取区域（兜底）

当必须走 `page.screenshot`（canvas 读像素失败）时：

1. 用 `canvas.getBoundingClientRect()` 得到 clip（整数，钳到视口）
2. Playwright：`page.screenshot({ type:'png', clip })`
3. 工坊人工构图：只截 `.viewport` / iframe 内游戏画面

`CARTONBOOK_CROP=1` 或 `opts.cropInset` / `opts.cropRect` 可再收一圈边距。

## 正式画面 vs fixtures

| 用途 | 要求 |
|---|---|
| 正式漫画分镜 | **必须** `captureClean: true`（策略 1）；优先 `canvas.toDataURL` |
| fixtures / 排版自测 | 允许带 HUD，仅验证版式；`manifest.realCapture=false` |

## CLI / 工坊用法

**直连游戏（默认）**

```bash
# 自动追加 cartonCapture=1，开 setCaptureMode
node src/cli.mjs capture --recipe recipes/bookshop-letter.sample.json
```

**经 Pipeline 工坊**（人工构图 UI = `pipeline.html#scene`）

```bash
CARTONBOOK_VIA_PIPELINE=1 node src/cli.mjs capture --recipe ...
# 或 plan.captureVia === 'pipeline' / opts.viaPipeline === true
```

- 优先打开 `http://127.0.0.1:8931/TigerMessenger/pipeline.html#scene`，在 `#game` iframe 内截屏
- iframe 未就绪时回退到与工坊相同的 embed：`authoringEmbed=1&dev=1&cartonCapture=1`
- 结束时 `setCaptureMode(false)`

**Manifest 字段**

- `captureClean: true`
- `cropUsed: boolean`（是否用了策略 2 / inset）
- `via: 'pipeline' | 'direct'`

**人工在工坊里截**

1. 打开 pipeline →「进入编辑」（自动干净模式）
2. 调机位
3. 父页可发 `screenshot` / `captureClean` 命令；或 CLI 读同一 iframe

`book.html` 图片路径保持 `shots/…`（不要写成 `../shots/`）。
