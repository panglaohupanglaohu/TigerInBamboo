# -*- coding: utf-8 -*-
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/docs/")

# ---------------- PLAN §6 门槛表对账 ----------------
p = R + "CITADEL_BUILD_PIPELINE_PLAN.md"
s = io.open(p, encoding="utf-8").read()
pairs = [
("| **J · 角落无缝（新）** | 相邻角柱共享边上的顶点逐位相等；基座跨格零间隙 | 未开始 | 阶段 4 |",
 "| **J · 角落无缝（新）** | 相邻角柱共享边上的顶点逐位相等；基座跨格零间隙 | ✅ 2026-09-05 `tools/test_corner_seams.mjs`：任选件 3546 对 / 两侧同件 1840 对，不对齐 **0** | 阶段 4 |"),
("| **K · 不规则网格有效（新）** | 全四边形、无自交、最小内角 ≥ 45°、边长比 ≤ 2、同 seed 同 hash；ASCII→face 迁移双向可逆 | 未开始 | 阶段 5 |",
 "| **K · 不规则网格有效（新）** | 全四边形、无自交、最小内角 ≥ 45°、边长比 ≤ 2、同 seed 同 hash；ASCII→face 迁移双向可逆 | ✅ 上半（内角 50.49° / 边长比 1.977）+ ✅ 下半 `tools/test_grid_migration.mjs`（P95 0.790 / 0.778 · hash `0b70f22c`） | 阶段 5 |"),
("| **L · stencil 窗（新）** | 窗洞里不露描边壳；窗位不跨格角；draw call 增量 ≤ +2/层 | 未开始 | 阶段 6 |",
 "| **L · stencil 窗（新）** | **（新增前置）renderer 必须显式申请模板缓冲**；窗洞里不露描边壳；窗位不跨格角；draw call 增量 ≤ +2/层 | ⚠️ 前置 ✅ 2026-09-05 已修（见 §6.1）· 窗位 ✅ 420 窗跨格角 0 · draw call ✅ +2/层 · **「不露描边壳」仍待目视** | 阶段 6 |"),
]
for o, n in pairs:
    assert o in s, o[:40]
    s = s.replace(o, n, 1)

anchor = "\n---\n\n## 7. 风险（v2）"
add = """

### 6.1 · 门 L 的前置：模板缓冲（2026-09-05 补）

门 L 原来只写了三条画面判据，漏了最底下那条**物理前提**：模板测试要生效，
renderer 得先申请模板缓冲。本仓库 vendor 的 three（r163+）里
`new THREE.WebGLRenderer({...})` 的 `stencil` 默认是 **false**（早年默认 true，r163 翻了过来），
而现网四处创建 renderer 的地方**一处都没传过它**。实测（云端 Chromium，真 GL 上下文）：

| renderer 写法 | `gl.getParameter(STENCIL_BITS)` | 结果 |
| --- | --- | --- |
| 修之前 | **0** | 模板测试恒真，`?stencilWindowsV1=1` 打开也不挖洞 |
| 传 `stencil: true` | 8 | 才谈得上挖 |

两个无头脚本（`probe_stencil_windows` / `test_window_stencil_positions`）只查材质状态
与网格计数，**拿不到真 GL**，所以两边都漏了。已修 `src/core/stage.js`（按
`P.stencilWindowsV1` 条件申请，关着时不为它付带宽）、`src/planet/main.js`、
`townscaper.html`，并在 `test_window_stencil_positions.mjs` 末尾加了一条**源码级**断言兜底。

### 6.2 · 按 §8 的完成定义，阶段 2 / 4 / 5 / 6 都还不算完成

§8 写死了：「生产代码路径消费该改动（不是死文件、**不是只在 `?flag=1` 下 import**）」。
现状是**四个开关默认全 false**：`P.wfcTownV1` / `P.cornerModulesV1` /
`P.irregularGridV1` / `P.stencilWindowsV1`。
也就是说这四个阶段正停在 §7 风险表点名的那个坑里——
「**Grok 交付停在 TESTED**（V4/V6/V7 三代先例）」，只不过这回停在 Claude 手上。
翻默认是它们唯一剩下的工作，且必须**一次一个**、每次带截图对照 + 全量回归。
"""
assert anchor in s
s = s.replace(anchor, add + anchor, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("PLAN §6 已对账")

# ---------------- TODOS ----------------
p2 = R + "CITADEL_BUILD_PIPELINE_TODOS.md"
t = io.open(p2, encoding="utf-8").read()
for o, n in [
("| J | 角柱共享边顶点逐位相等 | 未开始 | C9 |",
 "| J | 角柱共享边顶点逐位相等 | ✅ 2026-09-05 `test_corner_seams`：3546 对 / 1840 对，不对齐 **0** | C9 |"),
("| K | 全四边形 / 无自交 / 内角 ≥ 45° / 边长比 ≤ 2 / 迁移可逆 | 上半 ✅（内角 50.49° / 边长比 1.977）；下半（迁移）未开始 | C10 |",
 "| K | 全四边形 / 无自交 / 内角 ≥ 45° / 边长比 ≤ 2 / 迁移可逆 | ✅ 上半（内角 50.49° / 边长比 1.977）+ ✅ 下半 `test_grid_migration`（P95 0.790 / 0.778） | C10 |"),
("| L | 窗洞不露壳 / 不跨格角 / draw call ≤ +2/层 | 未开始 | C11 |",
 "| L | **模板缓冲已申请**（2026-09-05 新增前置，已修）/ 窗洞不露壳 / 不跨格角 / draw call ≤ +2/层 | 前置 ✅ · 窗位 ✅ · drawCall ✅ · 露壳与否**待目视** | C11 |"),
]:
    assert o in t, o[:40]
    t = t.replace(o, n, 1)

MARK = "## 「还差多远」实测（2026-09-05，Claude）"
if MARK not in t:
    t += """

---

""" + MARK + """

主人问「做完了吗？与 Townscaper 还有差距吗？」。按 PLAN §8 的完成定义逐条量的，不是估的。

### 一、没做完。四个开关默认全关，四个阶段就都不算完成

§8 白纸黑字：「生产代码路径消费该改动，**不是只在 `?flag=1` 下 import**」。

| 开关 | 默认 | 阶段 | 现在打开会怎样（实测截图） |
| --- | --- | --- | --- |
| `P.wfcTownV1` | false | 阶段 2 | 画面成立；顶格花园 10 → **1**，天际线更碎。取舍要主人拍板 |
| `P.cornerModulesV1` | false | 阶段 4 | **画面塌了**：城垛 44 → **0**、绿植 10 → **1**，坡屋顶全变灰平顶 |
| `P.irregularGridV1` | false | 阶段 5 | 编辑器里**零像素变化**——`gridV6` 只在整城路径（`odysseyCitadel.js:2577`）建，`buildCitadelTownAssembly` 收不到，编辑器压根预览不到不规则网格 |
| `P.stencilWindowsV1` | false | 阶段 6 | 修模板缓冲前是**空转**（`STENCIL_BITS = 0`）；编辑器路径也不调 `applyCitadelStencilPass`，同样零像素变化 |

四档对照的像素差（`node shot_flags.mjs`，同存档同机位）：

```
stencil  与 base 差异像素      0     ← 开了等于没开
grid     与 base 差异像素      0     ← 开了等于没开
corner   与 base 差异像素 196996     ← 变了，但是变坏
wfc      与 base 差异像素 104417     ← 变了，方向对，有副作用
```

### 二、与 Townscaper 的差距，现在能一条条点名

PLAN §10.8 的判断没错：「Oskar 的好看不来自更强的算法」。按影响面排：

| # | 差距 | 状态 |
| --- | --- | --- |
| 1 | **15 色高饱和色板** | ✅ 2026-09-05 修好（见下节）。这是最大的一条——之前编辑器建出来是 4 个淡色重复 |
| 2 | **不规则四边形网格** | 生成器、迁移、笼形变形、编辑器拾取都齐了，但 `irregularGridV1` 默认关，且编辑器根本收不到 `gridV6`。**这是「像不像 Townscaper」的第一眼差距**——现在还是正方格 |
| 3 | **角落模块**（圆角/斜角转角） | 目录齐、接缝 0，但一开就丢屋顶。缺的是顶面角柱件 |
| 4 | **真窗洞** | 现在是贴片 `town-window`，不是挖穿的洞 |
| 5 | 顶格屋顶占比 ~35% | WFC 路径的取舍，等主人看画面 |
| 6 | 砖级碎色 / 檐口三层色带 / 护栏轮廓 | C13 已做完（§10.1–10.7） |

### 三、顺手修掉的真 bug：编辑器色板与生产不是同一份

主人报「我在高山城堡，发现配色都与自己菜单对不上」。查实了，是真的：

- `townscaper.html` 的 16 个色块是**写死在 HTML 里的十六进制**
  （`#e8e4da 白` / `#a8543c 砖红` / `#4f7755 松绿` …一套土黄砖红）；
- 而它建城走的是 `buildCitadelTownAssembly(spec)` **不传 `highlandColors`**，
  于是回落到旧的 `CITADEL_PALETTE`——那份表 15 个字符里只有 **4 个不同的颜色**
  （瓷白 / 浅灰蓝 / 鹅黄 / 薄荷），15 个按钮只能建出 4 种效果；
- 游戏内用的是第三份 `TOWNSCAPER_HIGHLAND_PALETTE`（奶油白 / 珊瑚红 / 覆盆子 / 钴蓝…）。

**三份色板互不相同**，菜单写砖红、建出来是薄荷。

`citadelEditorPanel.js:61–70` 的注释里已经写明这个病犯过两次
（「面板一份硬编码、生产一份色板，改了色板忘了改面板」），**这是第三次**。

已修：
1. `townscaper.html` 改成 `buildCitadelTownAssembly(spec, { highlandColors: true })`
   —— 编辑器预览与游戏内走**同一条**配色/材质路径；
2. 色块底色与按钮文字改成**运行时**从 `TOWNSCAPER_HIGHLAND_PALETTE` 生成，
   HTML 里那串 hex 只剩占位；平面图 `PANEL_CHARS` 同源；
3. 新增 `tools/test_editor_palette_parity.mjs` 守门——不测颜色好不好看，
   只测**色板只有一个来源**，让这个病没有第四次。

### 四、建议顺序

1. **`irregularGridV1` 先接到编辑器**（`buildCitadelTownAssembly` 收 `gridV6`）——
   否则这个阶段连目视验收的场子都没有。然后翻默认。
2. **角柱补顶面件**（派 Grok），验收就是「`?cornerModules=1` 下城垛回到 44、绿植回到 10」。
3. **stencil 重截一次**（模板缓冲已修），量「窗洞里露不露描边壳」，再决定默认。
4. **`wfcTownV1` 的顶格花园权重**，主人看画面拍板。

一次一个开关，每次带截图对照 + 全量回归；同时翻出了问题分不清是谁的。
"""
io.open(p2, "w", encoding="utf-8").write(t)
print("TODOS 已追加差距实测")
