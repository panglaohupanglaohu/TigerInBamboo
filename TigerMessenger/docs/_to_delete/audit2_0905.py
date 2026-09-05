# -*- coding: utf-8 -*-
import io, os
D = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/")
p = D + "CITADEL_BUILD_PIPELINE_TODOS.md"
s = io.open(p, encoding="utf-8").read()

MARK = "## 目视核对（2026-09-05，Claude 实际截图）"
if MARK in s:
    print("已存在，跳过"); raise SystemExit

s += """

---

""" + MARK + """

上一节说「剩下的三条都要眼睛看」。眼睛已经看了：设备端的 Linux VM 装不上浏览器
（playwright CDN 不在放行名单里），改成把 `src/` + `vendor/` 打包上传到云端容器，
用那边预装的 Chromium（SwiftShader 软渲）无头跑 `townscaper.html`，逐个开关截图对照。

### 结论先写：**两个开关现在都不能翻默认，而且各有一个真 bug**

| 开关 | 目视结论 |
| --- | --- |
| `P.cornerModulesV1` | ❌ **不要上原型**——画面直接塌了，评估报告的「可以进生产原型」建议作废 |
| `P.stencilWindowsV1` | ❌ **翻了也没用**——现网根本没分配模板缓冲，这个开关目前是空转 |
| `P.wfcTownV1` | ⚠️ 画面成立，但有副作用要主人拍板（见下） |

### 1 · `?cornerModules=1`：屋顶、城垛、绿植全没了

同一存档、同一机位，只多了这一个开关：

| 底部统计行 | 默认 | `?cornerModules=1` |
| --- | --- | --- |
| 格 | 142 | 142 |
| 穹顶 / 塔顶 / 拱 / 拱窗 | 1 / 1 / 1 / 112 | 1 / 1 / 1 / 112 |
| **城垛** | **44** | **0** |
| **绿植** | **10** | **1** |

画面上：所有坡屋顶消失，整城变成一排灰色平顶方块。
也就是说 `citadelTown.js:1761` 那条 `cornerBody` 分支接管体块之后，
**顶面那一档（坡/露台/花园/城垛）没有被角柱目录接住**——
`citadel-corner-eval.md` §1 自己写了「顶面 196/256 只剩 1 件」，
当时把它当成「变化少」，实际是「顶面几乎没件可选，退化成平顶」。

评估报告的三条绿（图 validate、bans、接缝）都只证了**拼得上**，
没有任何一条证**拼出来好看**——这正是脚本判不了、必须截图的那一类。

**给 Grok 的下一张单（未派）**：先补顶面角柱件（露台/坡/歇山/花园各至少一件带 Y4 变体），
让 `?cornerModules=1` 的城垛与绿植计数回到 44 / 10，再谈默认值。

### 2 · `?stencilWindowsV1=1`：现网没有模板缓冲，开关是空转

`src/core/stage.js:22`、`src/planet/main.js:33`、`townscaper.html`、`shot-harness.html`
四处 `new THREE.WebGLRenderer(...)` **都没有传 `stencil: true`**。
本仓库 vendor 的 three（r16x，`vendor/three.module.js:14738`）里
`stencil` 的默认值是 **false**——早年 three 默认给 true，这个默认在 r163 翻过来了。

实测（云端 Chromium，`applyStencilWindows` 手工调用，两档对照）：

| renderer 参数 | `getContextAttributes().stencil` | `gl.getParameter(STENCIL_BITS)` | 挖窗 |
| --- | --- | --- | --- |
| 现网写法 | `false` | **0** | 模板测试恒真 → 不挖 |
| 加 `stencil: true` | `true` | 8 | 才有可能挖 |

`probe_stencil_windows.mjs` / `test_window_stencil_positions.mjs` 都是无头脚本，
只查材质状态与网格计数，**拿不到真 GL 上下文**，所以这个洞两边都漏过去了。

**修法（Claude，未做）**：给 `stage.js` 与 `planet/main.js` 的 renderer 传 `stencil: true`，
再重截一次对照，才谈得上「窗洞里露不露描边壳」。在那之前 C11 行 488 那条打不了勾。

### 3 · `?wfcTownV1=1`：画面成立，但花园几乎消失

| 底部统计行 | 默认 | `?wfcTownV1=1` |
| --- | --- | --- |
| 城垛 | 44 | **58** |
| 绿植 | 10 | **1** |

屋顶还在、坡顶形态正常，天际线比现网碎一点（与体检里「顶格 ~35% 长成屋顶」对得上）。
但**顶格花园从 10 掉到 1**——WFC 接管顶格角色后，`top.garden` 基本抢不到格。
这是取舍不是 bug：要么调 `wfcTownWiring` 里 garden 的权重，要么接受「屋顶多、花园少」。
**这一条要主人看画面拍板**，脚本给不出答案。

### 复现命令

云端容器里（`src/` + `vendor/` + `townscaper.html` 同目录）：

```bash
node shot_flags.mjs     # base / stencil / corner / wfc 四档 × 远近两机位
node shot_stencil.mjs   # stencilBuf=0/1 两档，打印 STENCIL_BITS
```

浏览器直接看也行：`townscaper.html?cornerModules=1` / `?wfcTownV1=1`，
看左下角那行统计的**城垛**与**绿植**两个数，比看画面还快。
"""
io.open(p, "w", encoding="utf-8").write(s)
print("已追加目视核对")
